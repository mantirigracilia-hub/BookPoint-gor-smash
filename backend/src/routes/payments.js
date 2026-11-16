import {Router} from 'express';
import multer from 'multer';
import path from 'path';
import {fileURLToPath} from 'url';
import {pool} from '../db.js';
import {auth,allow} from '../middleware/auth.js';

const r=Router();
const uploadDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../uploads');
const storage=multer.diskStorage({
 destination:uploadDir,
 filename:(req,file,cb)=>cb(null,`${Date.now()}-${Math.random().toString(16).slice(2)}${path.extname(file.originalname).toLowerCase()}`)
});
const upload=multer({
 storage,
 limits:{fileSize:5*1024*1024},
 fileFilter:(req,file,cb)=>{
  if(!/^image\/(jpeg|png|webp)$/.test(file.mimetype)) return cb(new Error('Bukti harus berupa gambar JPG, PNG, atau WEBP.'));
  cb(null,true);
 }
});

async function validateProofBooking(req,res,next){
 try{
  const [[booking]]=await pool.query('SELECT id_booking,status_booking FROM booking WHERE id_booking=? AND id_pelanggan=?',[req.params.bookingId,req.user.customerId]);
  if(!booking||booking.status_booking!=='menunggu_dp') return res.status(404).json({message:'Booking tidak ditemukan atau tidak menunggu DP.'});
  req.booking=booking;
  next();
 }catch(e){next(e);}
}

r.post('/:bookingId/proof',auth,allow('customer'),validateProofBooking,upload.single('proof'),async(req,res)=>{
 try{
  if(!req.file) return res.status(400).json({message:'Pilih bukti JPG/PNG/WEBP maksimal 5MB.'});
  const [[booking]]=await pool.query('SELECT jumlah_dp FROM booking WHERE id_booking=?',[req.booking.id_booking]);
  const [payment]=await pool.query("INSERT INTO pembayaran(id_booking,jenis,metode,nominal,bukti_file,status) VALUES(?,'dp','transfer',?,?,'menunggu_verifikasi')",[req.booking.id_booking,booking.jumlah_dp,req.file.filename]);
  await pool.query("INSERT INTO riwayat_pembayaran(id_pembayaran,status_sesudah,dilakukan_oleh) VALUES(?,'menunggu_verifikasi',?)",[payment.insertId,req.user.id]);
  res.status(201).json({message:'Bukti DP berhasil diunggah dan menunggu verifikasi admin.',paymentId:payment.insertId});
 }catch(e){res.status(500).json({message:'Gagal mengunggah bukti pembayaran.',detail:e.message});}
});

r.get('/pending',auth,allow('admin'),async(req,res)=>{
 try{
  const [rows]=await pool.query(`SELECT p.*,b.kode_booking,b.total_harga,cu.nama,cu.nomor_hp
   FROM pembayaran p JOIN booking b ON b.id_booking=p.id_booking JOIN pelanggan cu ON cu.id_pelanggan=b.id_pelanggan
   WHERE p.jenis='dp' AND p.status='menunggu_verifikasi' ORDER BY p.created_at`);
  res.json(rows);
 }catch(e){res.status(500).json({message:'Gagal memuat pembayaran menunggu verifikasi.',detail:e.message});}
});

r.get('/refunds',auth,allow('admin','owner'),async(req,res)=>{
 try{
  const [rows]=await pool.query(`SELECT pb.id_pembatalan,pb.id_booking,pb.alasan,pb.status_pengembalian,pb.created_at,
   b.kode_booking,b.id_pelanggan,cu.nama,cu.nomor_hp,
   COALESCE((SELECT SUM(p.nominal) FROM pembayaran p WHERE p.id_booking=b.id_booking AND p.jenis='dp' AND p.status='diterima'),0) nominal_refund
   FROM pembatalan_booking pb JOIN booking b ON b.id_booking=pb.id_booking JOIN pelanggan cu ON cu.id_pelanggan=b.id_pelanggan
   WHERE pb.status_pengembalian='menunggu' ORDER BY pb.created_at`);
  res.json(rows);
 }catch(e){res.status(500).json({message:'Gagal memuat pengembalian yang menunggu.',detail:e.message});}
});

r.post('/refunds/:cancellationId/complete',auth,allow('admin'),async(req,res)=>{
 const conn=await pool.getConnection();
 try{
  await conn.beginTransaction();
  const [[cancellation]]=await conn.query('SELECT * FROM pembatalan_booking WHERE id_pembatalan=? FOR UPDATE',[req.params.cancellationId]);
  if(!cancellation||cancellation.status_pengembalian!=='menunggu') throw new Error('Pengembalian tidak ditemukan atau sudah diproses.');
  const [[amount]]=await conn.query("SELECT COALESCE(SUM(nominal),0) AS total FROM pembayaran WHERE id_booking=? AND jenis='dp' AND status='diterima'",[cancellation.id_booking]);
  const paid=Number(req.body.nominal);
  if(!Number.isFinite(paid)||paid<=0||paid!==Number(amount.total)) throw new Error(`Nominal pengembalian harus sama dengan DP diterima (${Number(amount.total)}).`);
  await conn.query("UPDATE pembatalan_booking SET status_pengembalian='selesai' WHERE id_pembatalan=?",[cancellation.id_pembatalan]);
  await conn.query('INSERT INTO pengembalian_dana(id_pembatalan,nominal,metode,diproses_oleh,waktu_pengembalian) VALUES(?,?,?,?,NOW())',[cancellation.id_pembatalan,paid,req.body.metode==='tunai'?'tunai':'transfer',req.user.id]);
  await conn.query("INSERT INTO riwayat_booking(id_booking,status_sebelum,status_sesudah,keterangan,dilakukan_oleh) VALUES(?,'dibatalkan','dibatalkan',?,?)",[cancellation.id_booking,`Pengembalian DP ${paid} diproses manual`,req.user.id]);
  await conn.commit();
  res.json({message:'Pengembalian DP dicatat selesai.',nominal:paid});
 }catch(e){await conn.rollback();res.status(400).json({message:e.message});}
 finally{conn.release();}
});

r.get('/:id/proof',auth,async(req,res)=>{
 try{
  const [[payment]]=await pool.query(`SELECT p.bukti_file,b.id_pelanggan FROM pembayaran p
   JOIN booking b ON b.id_booking=p.id_booking WHERE p.id_pembayaran=? AND p.jenis='dp'`,[req.params.id]);
  if(!payment) return res.status(404).json({message:'Bukti pembayaran tidak ditemukan.'});
  if(req.user.role==='customer'&&Number(payment.id_pelanggan)!==Number(req.user.customerId)) return res.status(403).json({message:'Akses ditolak.'});
  if(!['customer','admin','owner'].includes(req.user.role)) return res.status(403).json({message:'Akses ditolak.'});
  return res.sendFile(path.join(uploadDir,path.basename(payment.bukti_file||'')),err=>{
   if(err&&!res.headersSent) res.status(err.statusCode||404).json({message:'File bukti pembayaran tidak tersedia.'});
  });
 }catch(e){res.status(500).json({message:'Gagal membuka bukti pembayaran.',detail:e.message});}
});

r.post('/:id/verify',auth,allow('admin'),async(req,res)=>{
 const conn=await pool.getConnection();
 try{
  const accepted=req.body.accepted===true;
  const actual=Number(req.body.nominalDiterima);
  if(accepted&&(!Number.isFinite(actual)||actual<=0)) return res.status(400).json({message:'Nominal yang diterima wajib lebih dari nol.'});
  await conn.beginTransaction();
  const [[payment]]=await conn.query('SELECT * FROM pembayaran WHERE id_pembayaran=? FOR UPDATE',[req.params.id]);
  if(!payment||payment.jenis!=='dp'||payment.status!=='menunggu_verifikasi') throw new Error('Pembayaran DP tidak ditemukan atau sudah diproses.');
  if(accepted&&actual!==Number(payment.nominal)) throw new Error(`Nominal DP harus sesuai tagihan (${Number(payment.nominal)}). Booking tidak dikonfirmasi; penanganan selisih belum ditetapkan dalam SRS.`);
  const [[booking]]=await conn.query('SELECT * FROM booking WHERE id_booking=? FOR UPDATE',[payment.id_booking]);
  if(!booking||booking.status_booking!=='menunggu_dp') throw new Error('Booking tidak lagi menunggu DP.');
  const next=accepted?'diterima':'ditolak';
  const received=accepted?actual:Number(payment.nominal);
  await conn.query('UPDATE pembayaran SET status=?,nominal=?,diverifikasi_oleh=?,waktu_bayar=IF(?=1,NOW(),NULL) WHERE id_pembayaran=?',[next,received,req.user.id,accepted?1:0,payment.id_pembayaran]);
  await conn.query('INSERT INTO riwayat_pembayaran(id_pembayaran,status_sebelum,status_sesudah,nominal_diterima,dilakukan_oleh) VALUES(?,?,?,?,?)',[payment.id_pembayaran,payment.status,next,accepted?actual:null,req.user.id]);
  if(accepted){
   await conn.query("UPDATE booking SET status_booking='terkonfirmasi' WHERE id_booking=?",[booking.id_booking]);
   await conn.query("INSERT INTO riwayat_booking(id_booking,status_sebelum,status_sesudah,keterangan,dilakukan_oleh) VALUES(?,'menunggu_dp','terkonfirmasi',?,?)",[booking.id_booking,`DP diterima; nominal aktual ${actual}`,req.user.id]);
  }
  await conn.commit();
  res.json({message:accepted?'DP diverifikasi; booking terkonfirmasi.':'Bukti DP ditolak. Pelanggan dapat mengunggah ulang sebelum batas waktu.'});
 }catch(e){await conn.rollback();res.status(400).json({message:e.message});}
 finally{conn.release();}
});

r.post('/:bookingId/settle',auth,allow('admin'),async(req,res)=>{
 const conn=await pool.getConnection();
 try{
  const tender=Number(req.body.nominal);
  if(!Number.isFinite(tender)||tender<0) return res.status(400).json({message:'Nominal tunai tidak valid.'});
  await conn.beginTransaction();
  const [[booking]]=await conn.query('SELECT * FROM booking WHERE id_booking=? FOR UPDATE',[req.params.bookingId]);
  if(!booking||booking.status_booking!=='terkonfirmasi') throw new Error('Booking tidak dapat dilunasi.');
  const [[paid]]=await conn.query("SELECT COALESCE(SUM(nominal),0) AS total FROM pembayaran WHERE id_booking=? AND status='diterima'",[booking.id_booking]);
  const balance=Math.max(0,Number(booking.total_harga)-Number(paid.total));
  if(tender<balance) throw new Error(`Nominal kurang. Sisa tagihan ${balance}.`);
  const [result]=await conn.query("INSERT INTO pembayaran(id_booking,jenis,metode,nominal,status,diverifikasi_oleh,waktu_bayar) VALUES(?,'pelunasan','tunai',?,'diterima',?,NOW())",[booking.id_booking,balance,req.user.id]);
  await conn.query("INSERT INTO riwayat_pembayaran(id_pembayaran,status_sesudah,nominal_diterima,dilakukan_oleh) VALUES(?,'diterima',?,?)",[result.insertId,tender,req.user.id]);
  await conn.query("UPDATE booking SET status_booking='lunas' WHERE id_booking=?",[booking.id_booking]);
  await conn.query("INSERT INTO riwayat_booking(id_booking,status_sebelum,status_sesudah,keterangan,dilakukan_oleh) VALUES(?,'terkonfirmasi','lunas',?,?)",[booking.id_booking,`Pelunasan tunai diterima ${balance}; uang diserahkan ${tender}`,req.user.id]);
  await conn.commit();
  res.json({message:'Pelunasan berhasil dicatat.',paid:balance,change:tender-balance});
 }catch(e){await conn.rollback();res.status(400).json({message:e.message});}
 finally{conn.release();}
});

export default r;
