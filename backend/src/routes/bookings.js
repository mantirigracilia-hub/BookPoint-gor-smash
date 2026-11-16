import {Router} from 'express';
import {pool} from '../db.js';
import {auth,allow} from '../middleware/auth.js';
const r=Router();
const money=n=>Number(n);
function price(date,hour,isMember){
 const d=new Date(`${date}T00:00:00`), weekend=[0,6].includes(d.getDay());
 const prime=hour>=17&&hour<22;
 return Math.round((weekend||prime?90000:60000)*(isMember?.9:1));
}
r.get('/schedule',async(req,res)=>{
 try{
  const date=req.query.date;
  if(!date) return res.status(400).json({message:'Parameter date wajib (YYYY-MM-DD)'});
  const [courts]=await pool.query('SELECT * FROM lapangan WHERE aktif=1 ORDER BY id_lapangan');
  const [rows]=await pool.query(`SELECT d.id_lapangan,d.jam_mulai,d.jam_selesai,b.status_booking
   FROM detail_booking d JOIN booking b ON b.id_booking=d.id_booking
   WHERE d.tanggal=? AND b.status_booking IN ('menunggu_dp','terkonfirmasi','lunas')`,[date]);
  const slots=[];
  for(const c of courts) for(let h=7;h<23;h++){
   const busy=rows.some(x=>x.id_lapangan===c.id_lapangan && x.jam_mulai<=`${String(h).padStart(2,'0')}:00:00` && x.jam_selesai>`${String(h).padStart(2,'0')}:00:00`);
   slots.push({courtId:c.id_lapangan,court:c.nama,hour:h,status:busy?'terisi':'kosong'});
  }
  res.json({date,courts,slots});
 }catch(e){res.status(500).json({message:'Gagal memuat jadwal',detail:e.message});}
});
r.post('/',auth,async(req,res)=>{
 const conn=await pool.getConnection();
 try{
  const {items,catatan=''}=req.body;
  if(!Array.isArray(items)||!items.length) return res.status(400).json({message:'Pilih minimal satu slot'});
  const customerId=req.user.customerId;
  if(!customerId) return res.status(400).json({message:'Akun ini belum terhubung ke data pelanggan'});
  await conn.beginTransaction();
  const [[member]]=await conn.query("SELECT id_keanggotaan FROM keanggotaan WHERE id_pelanggan=? AND status='aktif' AND CURDATE() BETWEEN mulai AND berakhir LIMIT 1",[customerId]);
  let total=0;
  for(const it of items){
   const hour=Number(it.hour), date=it.date;
   if(hour<7||hour>=23) throw new Error('Jam booking di luar operasional 07.00–23.00');
   const maxDays=member?14:3;
   const diff=Math.ceil((new Date(`${date}T00:00:00`)-new Date(new Date().toDateString()))/86400000);
   if(diff<0||diff>maxDays) throw new Error(`Batas booking ${maxDays} hari untuk akun ini`);
   const [[court]]=await conn.query('SELECT id_lapangan FROM lapangan WHERE id_lapangan=? AND aktif=1',[it.courtId]);
   if(!court) throw new Error('Lapangan tidak ditemukan');
   const [conflict]=await conn.query(`SELECT d.id_detail FROM detail_booking d JOIN booking b ON b.id_booking=d.id_booking
    WHERE d.id_lapangan=? AND d.tanggal=? AND d.jam_mulai=? AND b.status_booking IN ('menunggu_dp','terkonfirmasi','lunas') FOR UPDATE`,
    [it.courtId,date,`${String(hour).padStart(2,'0')}:00:00`]);
   if(conflict.length) throw new Error('Slot sudah dipesan pengguna lain');
   total+=price(date,hour,!!member);
  }
  const code='BP'+Date.now().toString().slice(-9);
  const dp=Math.ceil(total/2);
  const [b]=await conn.query(`INSERT INTO booking(kode_booking,id_pelanggan,dibuat_oleh,status_booking,total_harga,jumlah_dp,batas_dp,catatan)
   VALUES(?,?,?,'menunggu_dp',?,?,DATE_ADD(NOW(),INTERVAL 2 HOUR),?)`,[code,customerId,req.user.id,total,dp,catatan]);
  for(const it of items) await conn.query(`INSERT INTO detail_booking(id_booking,id_lapangan,tanggal,jam_mulai,jam_selesai,harga)
   VALUES(?,?,?,?,?,?)`,[b.insertId,it.courtId,it.date,`${String(it.hour).padStart(2,'0')}:00:00`,`${String(it.hour+1).padStart(2,'0')}:00:00`,price(it.date,Number(it.hour),!!member)]);
  await conn.query(`INSERT INTO riwayat_booking(id_booking,status_sesudah,keterangan,dilakukan_oleh) VALUES(?,'menunggu_dp','Booking dibuat',?)`,[b.insertId,req.user.id]);
  await conn.commit();
  res.status(201).json({id:b.insertId,code,total,dp,dueHours:2,status:'menunggu_dp'});
 }catch(e){await conn.rollback();res.status(400).json({message:e.message});}
 finally{conn.release();}
});
r.get('/mine',auth,async(req,res)=>{
 try{const [rows]=await pool.query(`SELECT b.*,GROUP_CONCAT(CONCAT(l.nama,' ',DATE_FORMAT(d.tanggal,'%d/%m'), ' ',TIME_FORMAT(d.jam_mulai,'%H:%i')) SEPARATOR ', ') jadwal
 FROM booking b JOIN detail_booking d ON d.id_booking=b.id_booking JOIN lapangan l ON l.id_lapangan=d.id_lapangan
 WHERE b.id_pelanggan=? GROUP BY b.id_booking ORDER BY b.created_at DESC`,[req.user.customerId]);res.json(rows);}
 catch(e){res.status(500).json({message:'Gagal memuat booking',detail:e.message});}
});
r.get('/',auth,allow('admin','owner'),async(req,res)=>{
 const [rows]=await pool.query(`SELECT b.*,p.nama,p.nomor_hp FROM booking b JOIN pelanggan p ON p.id_pelanggan=b.id_pelanggan ORDER BY b.created_at DESC`);
 res.json(rows);
});
export default r;