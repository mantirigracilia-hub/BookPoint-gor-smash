import {Router} from 'express';
import {randomBytes} from 'crypto';
import {pool} from '../db.js';
import {auth,allow,optionalAuth} from '../middleware/auth.js';
import {isValidDate} from '../dateUtils.js';
import {canReschedule,cancellationOutcome,isHourWithinOperatingHours,isSlotInPast} from '../bookingPolicy.js';
import {errorDetail,publicMessage} from '../dbErrors.js';

const r=Router();
const ACTIVE_STATUSES=['menunggu_dp','terkonfirmasi','lunas'];
const toTime=hour=>`${String(hour).padStart(2,'0')}:00:00`;
const asMoney=value=>Number(value||0);


async function getRates(conn){
 const [rows]=await conn.query('SELECT nama,harga_per_jam,jam_mulai,jam_selesai,hari_akhir_pekan FROM tarif WHERE aktif=1');
 const normal=rows.find(x=>x.nama.toLowerCase().includes('normal'));
 const peak=rows.find(x=>x.jam_mulai&&x.jam_selesai);
 const weekend=rows.find(x=>x.hari_akhir_pekan);
 if(!normal||!peak||!weekend) throw new Error('Tarif aktif belum lengkap. Atur tarif normal, peak, dan akhir pekan.');
 return {normal:asMoney(normal.harga_per_jam),peak:asMoney(peak.harga_per_jam),weekend:asMoney(weekend.harga_per_jam),peakStart:Number(String(peak.jam_mulai).slice(0,2)),peakEnd:Number(String(peak.jam_selesai).slice(0,2))};
}

function slotPrice(date,hour,rates,isMember){
 const day=new Date(`${date}T00:00:00Z`).getUTCDay();
 const weekend=day===0||day===6;
 const base=weekend?rates.weekend:(hour>=rates.peakStart&&hour<rates.peakEnd?rates.peak:rates.normal);
 return Math.round(base*(isMember?0.9:1));
}

async function activeMember(conn,customerId){
 const [[member]]=await conn.query('SELECT id_keanggotaan FROM keanggotaan WHERE id_pelanggan=? AND CURDATE() BETWEEN mulai AND berakhir ORDER BY berakhir DESC LIMIT 1',[customerId]);
 return member||null;
}

async function validateItems(conn,items,customerId){
 if(!Array.isArray(items)||items.length===0) throw new Error('Pilih minimal satu slot.');
 const seen=new Set();
 for(const item of items){
  const hour=Number(item.hour),courtId=Number(item.courtId),date=item.date;
  if(!Number.isInteger(courtId)||courtId<1||!Number.isInteger(hour)||hour<0||hour>=24||!isValidDate(date)) throw new Error('Tanggal, lapangan, atau jam booking tidak valid.');
  const key=`${courtId}:${date}:${hour}`;
  if(seen.has(key)) throw new Error('Slot yang sama dipilih lebih dari sekali.');
  seen.add(key);
  const [[court]]=await conn.query('SELECT id_lapangan FROM lapangan WHERE id_lapangan=? AND aktif=1',[courtId]);
  if(!court) throw new Error('Lapangan tidak tersedia.');
  const [[limits]]=await conn.query(`SELECT jam_buka,jam_tutup,DAYOFWEEK(?) - 1 AS hari,
    DATEDIFF(?,CURDATE()) AS hari_ke_depan,
    TIMESTAMP(?,?) > NOW() AS belum_mulai
    FROM jam_operasional WHERE hari=DAYOFWEEK(?) - 1`,[date,date,date,toTime(hour),date]);
  if(!limits) throw new Error('Jam operasional untuk tanggal tersebut belum diatur.');
  const open=Number(String(limits.jam_buka).slice(0,2));
  const close=Number(String(limits.jam_tutup).slice(0,2));
  if(!isHourWithinOperatingHours(hour,open,close)) throw new Error(`Jam booking di luar operasional ${String(open).padStart(2,'0')}.00–${String(close).padStart(2,'0')}.00.`);
  if(!Number(limits.belum_mulai)) throw new Error('Jam booking sudah lewat.');
  const member=await activeMember(conn,customerId);
  const maxDays=member?14:3;
  if(Number(limits.hari_ke_depan)<0||Number(limits.hari_ke_depan)>maxDays) throw new Error(`Batas pemesanan ${maxDays} hari ke depan untuk akun ini.`);
 }
}

async function createBooking(conn,{items,customerId,actorId,catatan='',cashDeposit=false}){
 await validateItems(conn,items,customerId);
 const member=await activeMember(conn,customerId);
 const rates=await getRates(conn);
 const normalized=items.map(item=>({...item,courtId:Number(item.courtId),hour:Number(item.hour),price:slotPrice(item.date,Number(item.hour),rates,!!member)}));
 const total=normalized.reduce((sum,item)=>sum+item.price,0);
 const deposit=Math.ceil(total/2);
 const code=`BP${randomBytes(5).toString('hex').toUpperCase()}`;
 const status=cashDeposit?'terkonfirmasi':'menunggu_dp';
 const [booking]=await conn.query(`INSERT INTO booking(kode_booking,id_pelanggan,dibuat_oleh,status_booking,total_harga,jumlah_dp,batas_dp,catatan)
  VALUES(?,?,?,?,?,?,DATE_ADD(NOW(),INTERVAL 2 HOUR),?)`,[code,customerId,actorId,status,total,deposit,catatan]);
 for(const item of normalized){
  await conn.query('INSERT INTO reservasi_slot(id_lapangan,tanggal,jam_mulai,id_booking) VALUES(?,?,?,?)',[item.courtId,item.date,toTime(item.hour),booking.insertId]);
  await conn.query(`INSERT INTO detail_booking(id_booking,id_lapangan,tanggal,jam_mulai,jam_selesai,harga)
   VALUES(?,?,?,?,?,?)`,[booking.insertId,item.courtId,item.date,toTime(item.hour),toTime(item.hour+1),item.price]);
 }
 await conn.query('INSERT INTO riwayat_booking(id_booking,status_sesudah,keterangan,dilakukan_oleh) VALUES(?,?,?,?)',[booking.insertId,status,cashDeposit?'Booking admin dibuat dengan DP tunai':'Booking dibuat; slot ditahan sementara menunggu DP',actorId]);
 if(cashDeposit){
  const [payment]=await conn.query("INSERT INTO pembayaran(id_booking,jenis,metode,nominal,status,diverifikasi_oleh,waktu_bayar) VALUES(?,'dp','tunai',?,'diterima',?,NOW())",[booking.insertId,deposit,actorId]);
  await conn.query("INSERT INTO riwayat_pembayaran(id_pembayaran,status_sesudah,nominal_diterima,dilakukan_oleh) VALUES(?,'diterima',?,?)",[payment.insertId,deposit,actorId]);
 }
 return {id:booking.insertId,code,total,dp:deposit,dueHours:cashDeposit?0:2,status};
}

r.get('/schedule',optionalAuth,async(req,res)=>{
 try{
  const date=req.query.date;
  if(!isValidDate(date)) return res.status(400).json({message:'Parameter date wajib berformat YYYY-MM-DD'});
  const [[day]]=await pool.query(`SELECT jam_buka,jam_tutup,
   DATE_FORMAT(CURDATE(),'%Y-%m-%d') AS today,HOUR(NOW()) AS current_hour
   FROM jam_operasional WHERE hari=DAYOFWEEK(?) - 1`,[date]);
  if(!day) return res.status(404).json({message:'Jam operasional untuk tanggal tersebut belum diatur'});
  const [courts]=await pool.query('SELECT id_lapangan,nama FROM lapangan WHERE aktif=1 ORDER BY id_lapangan');
  const member=req.user?.role==='customer'?await activeMember(pool,req.user.customerId):null;
  const [busy]=await pool.query(`SELECT d.id_lapangan,d.jam_mulai,b.status_booking
   FROM detail_booking d JOIN booking b ON b.id_booking=d.id_booking
   WHERE d.tanggal=? AND b.status_booking IN ('menunggu_dp','terkonfirmasi','lunas')`,[date]);
  const rates=await getRates(pool);
  const start=Number(String(day.jam_buka).slice(0,2)),end=Number(String(day.jam_tutup).slice(0,2));
  const slots=[];
  for(const court of courts) for(let hour=start;hour<end;hour++){
   const row=busy.find(x=>Number(x.id_lapangan)===Number(court.id_lapangan)&&Number(String(x.jam_mulai).slice(0,2))===hour);
   const past=isSlotInPast(date,hour,day.today,Number(day.current_hour));
   const status=row?.status_booking==='menunggu_dp'?'menunggu_dp':row?'terisi':past?'lewat':'kosong';
   slots.push({courtId:court.id_lapangan,court:court.nama,hour,status,price:slotPrice(date,hour,rates,!!member)});
  }
  res.json({date,openingHours:{start,end},isMember:!!member,courts,slots});
 }catch(e){res.status(500).json({message:'Gagal memuat jadwal',detail:errorDetail(e)});}
});

r.post('/',auth,allow('customer'),async(req,res)=>{
 const conn=await pool.getConnection();
 try{
  await conn.beginTransaction();
  const data=await createBooking(conn,{items:req.body.items,customerId:req.user.customerId,actorId:req.user.id,catatan:req.body.catatan});
  await conn.commit();
  res.status(201).json(data);
 }catch(e){await conn.rollback();res.status(400).json({message:e.code==='ER_DUP_ENTRY'?'Slot baru saja dipesan. Silakan pilih slot lain.':publicMessage(e)});}
 finally{conn.release();}
});


r.get('/mine',auth,allow('customer'),async(req,res)=>{
  try{
    const [rows]=await pool.query(`SELECT
      b.*,
      DATE_FORMAT(MIN(TIMESTAMP(d.tanggal,d.jam_mulai)),'%Y-%m-%dT%H:%i:%s') AS waktu_mulai_pertama,
      GROUP_CONCAT(
        CONCAT(
          l.nama,' ',
          DATE_FORMAT(d.tanggal,'%d/%m/%Y'),' ',
          TIME_FORMAT(d.jam_mulai,'%H:%i')
        )
        ORDER BY d.tanggal,d.jam_mulai
        SEPARATOR ', '
      ) jadwal,

      COALESCE((
        SELECT SUM(p.nominal)
        FROM pembayaran p
        WHERE p.id_booking=b.id_booking
          AND p.jenis='dp'
          AND p.status='diterima'
      ),0) dp_diterima,

      COALESCE((
        SELECT SUM(p.nominal)
        FROM pembayaran p
        WHERE p.id_booking=b.id_booking
          AND p.jenis='pelunasan'
          AND p.status='diterima'
      ),0) pelunasan_diterima,

      (
        SELECT p.status
        FROM pembayaran p
        WHERE p.id_booking=b.id_booking
          AND p.jenis='dp'
        ORDER BY p.created_at DESC, p.id_pembayaran DESC
        LIMIT 1
      ) status_dp_terakhir,

      (
        SELECT COUNT(*)
        FROM reschedule_booking rb
        WHERE rb.id_booking=b.id_booking
      ) jumlah_reschedule

    FROM booking b
    JOIN detail_booking d ON d.id_booking=b.id_booking
    JOIN lapangan l ON l.id_lapangan=d.id_lapangan
    WHERE b.id_pelanggan=?
    GROUP BY b.id_booking
    ORDER BY b.created_at DESC`,
    [req.user.customerId]);

    res.json(rows);
  }catch(e){
    res.status(500).json({
      message:'Gagal memuat booking',
      detail:errorDetail(e)
    });
  }
});


r.get('/customer',auth,allow('admin'),async(req,res)=>{
 try{
  const phone=String(req.query.phone||'').trim();
  if(!phone) return res.status(400).json({message:'Nomor HP wajib diisi'});
  const [[customer]]=await pool.query('SELECT id_pelanggan,nama,nomor_hp FROM pelanggan WHERE nomor_hp=?',[phone]);
  res.json(customer||null);
 }catch(e){res.status(500).json({message:'Gagal mencari pelanggan',detail:errorDetail(e)});}
});

r.post('/customer',auth,allow('admin'),async(req,res)=>{
 try{
  const phone=String(req.body.nomor_hp||'').trim(),name=String(req.body.nama||'').trim();
  if(!/^0\d{8,19}$/.test(phone)||!name) return res.status(400).json({message:'Nama dan nomor HP yang valid wajib diisi'});
  const [result]=await pool.query('INSERT INTO pelanggan(nama,nomor_hp) VALUES(?,?) ON DUPLICATE KEY UPDATE nama=VALUES(nama)',[name,phone]);
  const [[customer]]=await pool.query('SELECT id_pelanggan,nama,nomor_hp FROM pelanggan WHERE nomor_hp=?',[phone]);
  res.status(result.affectedRows===1?201:200).json(customer);
 }catch(e){res.status(500).json({message:'Gagal menyimpan pelanggan',detail:errorDetail(e)});}
});

r.post('/admin',auth,allow('admin'),async(req,res)=>{
 const conn=await pool.getConnection();
 try{
  await conn.beginTransaction();
  let customerId=Number(req.body.customerId)||0;
  if(!customerId){
   const phone=String(req.body.nomor_hp||'').trim(),name=String(req.body.nama||'').trim();
   if(!/^0\d{8,19}$/.test(phone)||!name) throw new Error('Pelanggan dan nomor HP yang valid wajib diisi.');
   const [created]=await conn.query('INSERT INTO pelanggan(nama,nomor_hp) VALUES(?,?) ON DUPLICATE KEY UPDATE nama=VALUES(nama)',[name,phone]);
   const [[customer]]=await conn.query('SELECT id_pelanggan FROM pelanggan WHERE nomor_hp=?',[phone]);
   customerId=customer?.id_pelanggan||created.insertId;
  }
  const [[customer]]=await conn.query('SELECT id_pelanggan FROM pelanggan WHERE id_pelanggan=?',[customerId]);
  if(!customer) throw new Error('Pelanggan tidak ditemukan.');
  const data=await createBooking(conn,{items:req.body.items,customerId,actorId:req.user.id,catatan:req.body.catatan,cashDeposit:req.body.depositMethod==='tunai'});
  await conn.commit();
  res.status(201).json(data);
 }catch(e){await conn.rollback();res.status(400).json({message:e.code==='ER_DUP_ENTRY'?'Slot sudah dipesan. Silakan pilih jadwal lain.':publicMessage(e)});}
 finally{conn.release();}
});

r.get('/',auth,allow('admin','owner'),async(req,res)=>{
 try{
  const filters=[],params=[];
  if(req.query.date){filters.push('d.tanggal=?');params.push(req.query.date);}
  if(req.query.status&&['menunggu_dp','terkonfirmasi','lunas','dibatalkan'].includes(req.query.status)){filters.push('b.status_booking=?');params.push(req.query.status);}
  if(req.query.search){filters.push('(p.nomor_hp LIKE ? OR b.kode_booking LIKE ? OR p.nama LIKE ?)');const term=`%${req.query.search}%`;params.push(term,term,term);}
  const where=filters.length?`WHERE ${filters.join(' AND ')}`:'';
  const [rows]=await pool.query(`SELECT b.*,p.nama,p.nomor_hp,
   GROUP_CONCAT(CONCAT(l.nama,' ',DATE_FORMAT(d.tanggal,'%d/%m/%Y'),' ',TIME_FORMAT(d.jam_mulai,'%H:%i')) ORDER BY d.tanggal,d.jam_mulai SEPARATOR ', ') jadwal,
   COALESCE((SELECT SUM(py.nominal) FROM pembayaran py WHERE py.id_booking=b.id_booking AND py.status='diterima'),0) total_dibayar
   FROM booking b JOIN pelanggan p ON p.id_pelanggan=b.id_pelanggan
   JOIN detail_booking d ON d.id_booking=b.id_booking JOIN lapangan l ON l.id_lapangan=d.id_lapangan
   ${where} GROUP BY b.id_booking ORDER BY b.created_at DESC`,params);
  res.json(rows);
 }catch(e){res.status(500).json({message:'Gagal memuat daftar booking',detail:errorDetail(e)});}
});

r.get('/cancel-requests',auth,allow('admin'),async(req,res)=>{
 try{
  const [rows]=await pool.query(`SELECT pb.id_pembatalan,pb.id_booking,pb.alasan,pb.created_at,
   b.kode_booking,b.status_booking,cu.nama,cu.nomor_hp,
   GROUP_CONCAT(CONCAT(l.nama,' ',DATE_FORMAT(d.tanggal,'%d/%m/%Y'),' ',TIME_FORMAT(d.jam_mulai,'%H:%i')) ORDER BY d.tanggal,d.jam_mulai SEPARATOR ', ') jadwal
   FROM pembatalan_booking pb JOIN booking b ON b.id_booking=pb.id_booking
   JOIN pelanggan cu ON cu.id_pelanggan=b.id_pelanggan
   JOIN detail_booking d ON d.id_booking=b.id_booking JOIN lapangan l ON l.id_lapangan=d.id_lapangan
   WHERE pb.status_permohonan='menunggu_admin' GROUP BY pb.id_pembatalan ORDER BY pb.created_at`);
  res.json(rows);
 }catch(e){res.status(500).json({message:'Gagal memuat permohonan pembatalan.',detail:errorDetail(e)});}
});

r.post('/cancel-requests/:id/review',auth,allow('admin'),async(req,res)=>{
 const conn=await pool.getConnection();
 try{
  const approved=req.body.approved===true;
  await conn.beginTransaction();
  const [[request]]=await conn.query('SELECT * FROM pembatalan_booking WHERE id_pembatalan=? FOR UPDATE',[req.params.id]);
  if(!request||request.status_permohonan!=='menunggu_admin') throw new Error('Permohonan tidak ditemukan atau sudah diputuskan.');
  const [[booking]]=await conn.query('SELECT * FROM booking WHERE id_booking=? FOR UPDATE',[request.id_booking]);
  if(!booking||!ACTIVE_STATUSES.includes(booking.status_booking)) throw new Error('Booking tidak lagi aktif.');
  const [[paid]]=await conn.query("SELECT COALESCE(SUM(nominal),0) AS total FROM pembayaran WHERE id_booking=? AND jenis='dp' AND status='diterima'",[booking.id_booking]);
  if(approved){
   const forfeit=Number(paid.total)>0&&req.body.dpHangus===true;
   const refund=Number(paid.total)>0&&!forfeit?'menunggu':'tidak_ada';
   await conn.query("UPDATE pembatalan_booking SET status_permohonan='disetujui',dp_hangus=?,status_pengembalian=? WHERE id_pembatalan=?",[forfeit,refund,request.id_pembatalan]);
   await conn.query("UPDATE booking SET status_booking='dibatalkan' WHERE id_booking=?",[booking.id_booking]);
   await conn.query('DELETE FROM reservasi_slot WHERE id_booking=?',[booking.id_booking]);
   await conn.query('INSERT INTO riwayat_booking(id_booking,status_sebelum,status_sesudah,keterangan,dilakukan_oleh) VALUES(?,?,?,?,?)',[booking.id_booking,booking.status_booking,'dibatalkan',`Permohonan pembatalan disetujui admin; DP ${forfeit?'hangus':refund==='menunggu'?'menunggu pengembalian manual':'belum diterima'}`,req.user.id]);
  }else{
   const reason=String(req.body.alasan||'Permohonan pembatalan ditolak admin').trim();
   await conn.query("UPDATE pembatalan_booking SET status_permohonan='ditolak',alasan=CONCAT(alasan,' | Keputusan: ',?) WHERE id_pembatalan=?",[reason,request.id_pembatalan]);
   await conn.query('INSERT INTO riwayat_booking(id_booking,status_sebelum,status_sesudah,keterangan,dilakukan_oleh) VALUES(?,?,?,?,?)',[booking.id_booking,booking.status_booking,booking.status_booking,`Permohonan pembatalan ditolak admin: ${reason}`,req.user.id]);
  }
  await conn.commit();
  res.json({message:approved?'Permohonan pembatalan disetujui dan slot dilepas.':'Permohonan pembatalan ditolak; booking tetap aktif.'});
 }catch(e){await conn.rollback();res.status(400).json({message:publicMessage(e)});}
 finally{conn.release();}
});

r.get('/:id',auth,async(req,res)=>{
 try{
  const [[booking]]=await pool.query(`SELECT b.*,p.nama,p.nomor_hp FROM booking b
   JOIN pelanggan p ON p.id_pelanggan=b.id_pelanggan WHERE b.id_booking=?`,[req.params.id]);
  if(!booking) return res.status(404).json({message:'Booking tidak ditemukan.'});
  if(req.user.role==='customer'&&Number(booking.id_pelanggan)!==Number(req.user.customerId)) return res.status(403).json({message:'Akses ditolak.'});
  if(!['customer','admin','owner'].includes(req.user.role)) return res.status(403).json({message:'Akses ditolak.'});
  const [items]=await pool.query(`SELECT d.*,l.nama nama_lapangan,DATE_FORMAT(d.tanggal,'%Y-%m-%d') tanggal,
   TIME_FORMAT(d.jam_mulai,'%H:%i') jam_mulai_text,TIME_FORMAT(d.jam_selesai,'%H:%i') jam_selesai_text
   FROM detail_booking d JOIN lapangan l ON l.id_lapangan=d.id_lapangan WHERE d.id_booking=? ORDER BY d.tanggal,d.jam_mulai`,[req.params.id]);
  const [payments]=await pool.query(`SELECT id_pembayaran,jenis,metode,nominal,status,bukti_file,created_at,waktu_bayar
   FROM pembayaran WHERE id_booking=? ORDER BY created_at`,[req.params.id]);
  const [history]=await pool.query(`SELECT rb.status_sebelum,rb.status_sesudah,rb.keterangan,rb.created_at,
   COALESCE(p.nama,a.peran) aktor FROM riwayat_booking rb
   LEFT JOIN akun_pengguna a ON a.id_akun=rb.dilakukan_oleh LEFT JOIN pelanggan p ON p.id_pelanggan=a.id_pelanggan
   WHERE rb.id_booking=? ORDER BY rb.created_at`,[req.params.id]);
  res.json({...booking,items,payments:payments.map(({bukti_file,...payment})=>({...payment,hasProof:!!bukti_file})),history});
 }catch(e){res.status(500).json({message:'Gagal memuat detail booking.',detail:errorDetail(e)});}
});

r.get('/:id/history',auth,async(req,res)=>{
 try{
  const [[booking]]=await pool.query('SELECT id_booking,id_pelanggan FROM booking WHERE id_booking=?',[req.params.id]);
  if(!booking) return res.status(404).json({message:'Booking tidak ditemukan'});
  if(req.user.role==='customer'&&Number(booking.id_pelanggan)!==Number(req.user.customerId)) return res.status(403).json({message:'Akses ditolak'});
  const [rows]=await pool.query(`SELECT rb.*,a.peran,p.nama FROM riwayat_booking rb
   LEFT JOIN akun_pengguna a ON a.id_akun=rb.dilakukan_oleh
   LEFT JOIN pelanggan p ON p.id_pelanggan=a.id_pelanggan
   WHERE rb.id_booking=? ORDER BY rb.created_at`,[req.params.id]);
  res.json(rows.map(row=>({...row,aktor:row.nama||row.peran||'Pengguna sistem'})));
 }catch(e){res.status(500).json({message:'Gagal memuat riwayat booking',detail:errorDetail(e)});}
});

r.post('/:id/cancel',auth,allow('customer'),async(req,res)=>{
 const conn=await pool.getConnection();
 try{
  await conn.beginTransaction();
  const [[booking]]=await conn.query('SELECT * FROM booking WHERE id_booking=? AND id_pelanggan=? FOR UPDATE',[req.params.id,req.user.customerId]);
  if(!booking||!ACTIVE_STATUSES.includes(booking.status_booking)) throw new Error('Booking tidak ditemukan atau tidak dapat dibatalkan.');
  const [[start]]=await conn.query('SELECT MIN(TIMESTAMP(tanggal,jam_mulai)) AS mulai FROM detail_booking WHERE id_booking=?',[booking.id_booking]);
  if(!start.mulai) throw new Error('Jadwal booking tidak ditemukan.');
  const [[time]]=await conn.query('SELECT TIMESTAMPDIFF(SECOND,NOW(),?) AS detik',[start.mulai]);
  const secondsUntilStart=Number(time.detik);
  if(secondsUntilStart<=0) throw new Error('Jadwal sudah dimulai atau lewat sehingga tidak dapat dibatalkan. Hubungi admin GOR.');
  if(cancellationOutcome(secondsUntilStart,false)==='admin_review'){
   const [[request]]=await conn.query("SELECT id_pembatalan FROM pembatalan_booking WHERE id_booking=? AND status_permohonan='menunggu_admin' LIMIT 1",[booking.id_booking]);
   if(request) throw new Error('Permohonan pembatalan booking ini masih menunggu admin.');
   const reason=String(req.body.alasan||'Pembatalan tepat 24 jam; menunggu keputusan admin').trim();
   const [created]=await conn.query(`INSERT INTO pembatalan_booking(id_booking,alasan,pembatal_oleh,dp_hangus,status_permohonan,status_pengembalian)
    VALUES(?,?,?,FALSE,'menunggu_admin','tidak_ada')`,[booking.id_booking,reason,req.user.id]);
   await conn.query('INSERT INTO riwayat_booking(id_booking,status_sebelum,status_sesudah,keterangan,dilakukan_oleh) VALUES(?,?,?,?,?)',[booking.id_booking,booking.status_booking,booking.status_booking,'Permohonan pembatalan tepat 24 jam dikirim untuk keputusan admin',req.user.id]);
   await conn.commit();
   return res.status(202).json({message:'Permohonan dicatat. Admin akan memutuskan pembatalan dan status DP karena jadwal tepat 24 jam lagi.',requestId:created.insertId});
  }
  const [[paid]]=await conn.query("SELECT COALESCE(SUM(nominal),0) AS total FROM pembayaran WHERE id_booking=? AND jenis='dp' AND status='diterima'",[booking.id_booking]);
  const hasPaidDp=Number(paid.total)>0;
  const outcome=cancellationOutcome(secondsUntilStart,hasPaidDp);
  const forfeit=outcome==='dp_forfeit';
  const refund=outcome==='manual_refund'?'menunggu':'tidak_ada';
  const reason=String(req.body.alasan||'Pembatalan oleh pelanggan').trim();
  await conn.query('INSERT INTO pembatalan_booking(id_booking,alasan,pembatal_oleh,dp_hangus,status_pengembalian) VALUES(?,?,?,?,?)',[booking.id_booking,reason,req.user.id,forfeit,refund]);
  await conn.query("UPDATE booking SET status_booking='dibatalkan' WHERE id_booking=?",[booking.id_booking]);
  await conn.query('DELETE FROM reservasi_slot WHERE id_booking=?',[booking.id_booking]);
  await conn.query('INSERT INTO riwayat_booking(id_booking,status_sebelum,status_sesudah,keterangan,dilakukan_oleh) VALUES(?,?,?,?,?)',[booking.id_booking,booking.status_booking,'dibatalkan',forfeit?'Pembatalan kurang dari 24 jam; DP hangus':refund==='menunggu'?'Pembatalan lebih dari 24 jam; pengembalian DP menunggu proses manual':'Booking dibatalkan sebelum DP diterima',req.user.id]);
  await conn.commit();
  res.json({message:forfeit?'Booking dibatalkan; DP hangus sesuai kebijakan.':refund==='menunggu'?'Booking dibatalkan; pengembalian DP dicatat untuk diproses manual.':'Booking dibatalkan.',dpForfeited:!!forfeit,refundStatus:refund});

 }catch(e){await conn.rollback();res.status(400).json({message:publicMessage(e)});}
 finally{conn.release();}
});

r.post('/:id/cancel-gor',auth,allow('admin'),async(req,res)=>{
 const conn=await pool.getConnection();
 try{
  const reason=String(req.body.alasan||'').trim();
  if(!reason) return res.status(400).json({message:'Alasan pembatalan operasional wajib diisi.'});
  await conn.beginTransaction();
  const [[booking]]=await conn.query('SELECT * FROM booking WHERE id_booking=? FOR UPDATE',[req.params.id]);
  if(!booking||!ACTIVE_STATUSES.includes(booking.status_booking)) throw new Error('Booking tidak ditemukan atau tidak aktif.');
  const [[paid]]=await conn.query("SELECT COUNT(*) AS jumlah FROM pembayaran WHERE id_booking=? AND jenis='dp' AND status='diterima'",[booking.id_booking]);
  const refund=Number(paid.jumlah)>0?'menunggu':'tidak_ada';
  await conn.query('INSERT INTO pembatalan_booking(id_booking,alasan,pembatal_oleh,dp_hangus,status_pengembalian) VALUES(?,?,?,FALSE,?)',[booking.id_booking,reason,req.user.id,refund]);
  await conn.query("UPDATE booking SET status_booking='dibatalkan' WHERE id_booking=?",[booking.id_booking]);
  await conn.query('DELETE FROM reservasi_slot WHERE id_booking=?',[booking.id_booking]);
  await conn.query("INSERT INTO riwayat_booking(id_booking,status_sebelum,status_sesudah,keterangan,dilakukan_oleh) VALUES(?,?,'dibatalkan',?,?)",[booking.id_booking,booking.status_booking,`Pembatalan operasional GOR: ${reason}`,req.user.id]);
  await conn.commit();
  res.json({message:'Pembatalan operasional dicatat; DP tidak hangus dan tindak lanjut pengembalian dilakukan manual.',refundStatus:refund});
 }catch(e){await conn.rollback();res.status(400).json({message:publicMessage(e)});}
 finally{conn.release();}
});

r.post('/:id/reschedule',auth,allow('customer'),async(req,res)=>{
 const conn=await pool.getConnection();
 try{
  await conn.beginTransaction();
  const [[booking]]=await conn.query('SELECT * FROM booking WHERE id_booking=? AND id_pelanggan=? FOR UPDATE',[req.params.id,req.user.customerId]);
  if(!booking||!['terkonfirmasi','lunas'].includes(booking.status_booking)) throw new Error('Hanya booking terkonfirmasi yang dapat dijadwalkan ulang.');
  const [[start]]=await conn.query('SELECT MIN(TIMESTAMP(tanggal,jam_mulai)) AS mulai FROM detail_booking WHERE id_booking=?',[booking.id_booking]);
  if(!start.mulai) throw new Error('Jadwal booking tidak ditemukan.');
  const [[time]]=await conn.query('SELECT TIMESTAMPDIFF(SECOND,NOW(),?) AS detik',[start.mulai]);
  if(!canReschedule(Number(time.detik))) throw new Error('Reschedule hanya diizinkan lebih dari 24 jam sebelum jadwal awal.');
  const [[count]]=await conn.query('SELECT COUNT(*) AS jumlah FROM reschedule_booking WHERE id_booking=?',[booking.id_booking]);
  if(Number(count.jumlah)>0) throw new Error('Booking ini sudah pernah di-reschedule.');
  const [oldRows]=await conn.query(`SELECT l.nama,DATE_FORMAT(d.tanggal,'%Y-%m-%d') tanggal,TIME_FORMAT(d.jam_mulai,'%H:%i') jam_mulai,d.id_lapangan,d.jam_mulai jam
   FROM detail_booking d JOIN lapangan l ON l.id_lapangan=d.id_lapangan WHERE d.id_booking=? ORDER BY d.tanggal,d.jam_mulai`,[booking.id_booking]);
  const items=req.body.items;
  await validateItems(conn,items,booking.id_pelanggan);
  const member=await activeMember(conn,booking.id_pelanggan),rates=await getRates(conn);
  const normalized=items.map(item=>({...item,courtId:Number(item.courtId),hour:Number(item.hour),price:slotPrice(item.date,Number(item.hour),rates,!!member)}));
  const total=normalized.reduce((sum,item)=>sum+item.price,0);
  const [[payments]]=await conn.query("SELECT COALESCE(SUM(nominal),0) AS diterima FROM pembayaran WHERE id_booking=? AND status='diterima'",[booking.id_booking]);
  const paid=Number(payments.diterima);
  const balanceDue=Math.max(0,total-paid);
  const status=balanceDue===0?'lunas':'terkonfirmasi';
  const oldText=oldRows.map(x=>`${x.nama} ${x.tanggal} ${x.jam_mulai}`).join(', ');
  const newText=normalized.map(x=>`Lapangan ${x.courtId} ${x.date} ${toTime(x.hour)}`).join(', ');
  await conn.query('DELETE FROM reservasi_slot WHERE id_booking=?',[booking.id_booking]);
  await conn.query('DELETE FROM detail_booking WHERE id_booking=?',[booking.id_booking]);
  for(const item of normalized){
   await conn.query('INSERT INTO reservasi_slot(id_lapangan,tanggal,jam_mulai,id_booking) VALUES(?,?,?,?)',[item.courtId,item.date,toTime(item.hour),booking.id_booking]);
   await conn.query('INSERT INTO detail_booking(id_booking,id_lapangan,tanggal,jam_mulai,jam_selesai,harga) VALUES(?,?,?,?,?,?)',[booking.id_booking,item.courtId,item.date,toTime(item.hour),toTime(item.hour+1),item.price]);
  }
  await conn.query('UPDATE booking SET total_harga=?,jumlah_dp=?,status_booking=? WHERE id_booking=?',[total,Math.ceil(total/2),status,booking.id_booking]);
  await conn.query('INSERT INTO reschedule_booking(id_booking,jadwal_lama,jadwal_baru,diubah_oleh) VALUES(?,?,?,?)',[booking.id_booking,oldText,newText,req.user.id]);
  const message=balanceDue>0?'Jadwal berhasil diubah satu kali. Sisa tagihan dilunasi di GOR.':'Jadwal berhasil diubah satu kali; booking sudah lunas.';
  await conn.query("INSERT INTO riwayat_booking(id_booking,status_sebelum,status_sesudah,keterangan,dilakukan_oleh) VALUES(?,? ,? ,?,?)",[booking.id_booking,booking.status_booking,status,`Reschedule satu kali: ${oldText} → ${newText}; total ${total}, sudah dibayar ${paid}, sisa ${balanceDue}`,req.user.id]);
  await conn.commit();
  res.json({message,total,dp:Math.ceil(total/2),paid,balanceDue,status});
 }catch(e){await conn.rollback();res.status(400).json({message:e.code==='ER_DUP_ENTRY'?'Slot baru saja dipesan. Pilih slot lain.':publicMessage(e)});}
 finally{conn.release();}
});

export default r;
