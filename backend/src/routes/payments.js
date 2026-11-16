import {Router} from 'express';
import multer from 'multer';
import path from 'path';
import {pool} from '../db.js';
import {auth,allow} from '../middleware/auth.js';
const r=Router();
const storage=multer.diskStorage({destination:'uploads/',filename:(req,file,cb)=>cb(null,`${Date.now()}-${Math.random().toString(16).slice(2)}${path.extname(file.originalname).toLowerCase()}`)});
const upload=multer({storage,limits:{fileSize:5*1024*1024},fileFilter:(req,file,cb)=>cb(null,/^image\/(jpeg|png|webp)$/.test(file.mimetype))});
r.post('/:bookingId/proof',auth,upload.single('proof'),async(req,res)=>{
 try{
  if(!req.file)return res.status(400).json({message:'Unggah bukti JPG/PNG/WEBP maksimal 5MB'});
  const [[b]]=await pool.query('SELECT * FROM booking WHERE id_booking=? AND id_pelanggan=?',[req.params.bookingId,req.user.customerId]);
  if(!b||b.status_booking!=='menunggu_dp')return res.status(404).json({message:'Booking tidak ditemukan atau tidak menunggu DP'});
  const [p]=await pool.query("INSERT INTO pembayaran(id_booking,jenis,metode,nominal,bukti_file,status) VALUES(?,'dp','transfer',? ,?,'menunggu_verifikasi')",[b.id_booking,b.jumlah_dp,req.file.filename]);
  res.status(201).json({message:'Bukti DP berhasil diunggah dan menunggu verifikasi',paymentId:p.insertId});
 }catch(e){res.status(500).json({message:'Gagal mengunggah bukti',detail:e.message});}
});
r.get('/pending',auth,allow('admin','owner'),async(req,res)=>{
 const [rows]=await pool.query(`SELECT p.*,b.kode_booking,b.total_harga,cu.nama,cu.nomor_hp FROM pembayaran p JOIN booking b ON b.id_booking=p.id_booking JOIN pelanggan cu ON cu.id_pelanggan=b.id_pelanggan WHERE p.status='menunggu_verifikasi' ORDER BY p.created_at`);
 res.json(rows);
});
r.post('/:id/verify',auth,allow('admin','owner'),async(req,res)=>{
 const conn=await pool.getConnection();
 try{
  const {accepted,nominalDiterima}=req.body;
  await conn.beginTransaction();
  const [[p]]=await conn.query('SELECT * FROM pembayaran WHERE id_pembayaran=? FOR UPDATE',[req.params.id]);
  if(!p||p.status!=='menunggu_verifikasi')throw new Error('Pembayaran tidak ditemukan atau sudah diproses');
  const status=accepted?'diterima':'ditolak';
  await conn.query('UPDATE pembayaran SET status=?,nominal=?,diverifikasi_oleh=?,waktu_bayar=NOW() WHERE id_pembayaran=?',[status,Number(nominalDiterima??p.nominal),req.user.id,p.id_pembayaran]);
  if(accepted){
   await conn.query("UPDATE booking SET status_booking='terkonfirmasi' WHERE id_booking=?",[p.id_booking]);
   await conn.query("INSERT INTO riwayat_booking(id_booking,status_sebelum,status_sesudah,keterangan,dilakukan_oleh) VALUES(?,'menunggu_dp','terkonfirmasi','DP diverifikasi',?)",[p.id_booking,req.user.id]);
  }
  await conn.query('INSERT INTO riwayat_pembayaran(id_pembayaran,status_sebelum,status_sesudah,nominal_diterima,dilakukan_oleh) VALUES(?,?,?,?,?)',[p.id_pembayaran,'menunggu_verifikasi',status,Number(nominalDiterima??p.nominal),req.user.id]);
  await conn.commit();res.json({message:accepted?'DP diverifikasi':'Pembayaran ditolak'});
 }catch(e){await conn.rollback();res.status(400).json({message:e.message});}finally{conn.release();}
});
r.post('/:bookingId/settle',auth,allow('admin'),async(req,res)=>{
 try{
  const {nominal}=req.body;
  const [[b]]=await pool.query('SELECT * FROM booking WHERE id_booking=?',[req.params.bookingId]);
  if(!b||b.status_booking!=='terkonfirmasi')return res.status(400).json({message:'Booking tidak dapat dilunasi'});
  const paid=Number(nominal);
  if(paid<Number(b.total_harga)-Number(b.jumlah_dp))return res.status(400).json({message:'Nominal pelunasan kurang dari sisa tagihan'});
  await pool.query("INSERT INTO pembayaran(id_booking,jenis,metode,nominal,status,diverifikasi_oleh,waktu_bayar) VALUES(?,'pelunasan','tunai',?,'diterima',?,NOW())",[b.id_booking,paid,req.user.id]);
  await pool.query("UPDATE booking SET status_booking='lunas' WHERE id_booking=?",[b.id_booking]);
  await pool.query("INSERT INTO riwayat_booking(id_booking,status_sebelum,status_sesudah,keterangan,dilakukan_oleh) VALUES(?,'terkonfirmasi','lunas','Pelunasan tunai dicatat',?)",[b.id_booking,req.user.id]);
  res.json({message:'Pelunasan berhasil dicatat'});
 }catch(e){res.status(500).json({message:'Gagal mencatat pelunasan',detail:e.message});}
});
export default r;
