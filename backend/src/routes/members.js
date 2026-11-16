import {Router} from 'express';
import {pool} from '../db.js';
import {auth,allow} from '../middleware/auth.js';
import {membershipStatus} from '../membershipPolicy.js';

const r=Router();

r.get('/',auth,allow('admin'),async(req,res)=>{
 try{
  const [rows]=await pool.query(`SELECT k.*,p.nama,p.nomor_hp,CURDATE() AS tanggal_hari_ini
   FROM keanggotaan k JOIN pelanggan p ON p.id_pelanggan=k.id_pelanggan
   ORDER BY k.berakhir DESC`);
  res.json(rows.map(({tanggal_hari_ini,...membership})=>({
   ...membership,
   status_terkini:membershipStatus(membership.mulai,membership.berakhir,tanggal_hari_ini)
  })));
 }catch(e){res.status(500).json({message:'Gagal memuat data member.',detail:e.message});}
});

r.post('/',auth,allow('admin'),async(req,res)=>{
 const conn=await pool.getConnection();
 try{
  const name=String(req.body.nama||'').trim();
  const phone=String(req.body.nomor_hp||'').trim();
  const customerId=Number(req.body.customerId)||0;
  if(!customerId&&(!name||!/^0\d{8,19}$/.test(phone))) return res.status(400).json({message:'Pilih pelanggan atau isi nama dan nomor HP yang valid.'});
  await conn.beginTransaction();
  let id=customerId;
  if(!id){
   const [created]=await conn.query('INSERT INTO pelanggan(nama,nomor_hp) VALUES(?,?) ON DUPLICATE KEY UPDATE nama=VALUES(nama)',[name,phone]);
   if(created.insertId) id=created.insertId;
   else{
    const [[customer]]=await conn.query('SELECT id_pelanggan FROM pelanggan WHERE nomor_hp=?',[phone]);
    id=customer.id_pelanggan;
   }
  }
  const [[customer]]=await conn.query('SELECT id_pelanggan FROM pelanggan WHERE id_pelanggan=?',[id]);
  if(!customer) throw new Error('Pelanggan tidak ditemukan.');
  const [[latest]]=await conn.query(`SELECT MAX(berakhir) AS berakhir FROM keanggotaan
   WHERE id_pelanggan=? AND berakhir>=CURDATE()`,[id]);
  const [membership]=await conn.query(`INSERT INTO keanggotaan(id_pelanggan,mulai,berakhir,biaya,status)
   VALUES(?,IF(? IS NULL,CURDATE(),DATE_ADD(?,INTERVAL 1 DAY)),
   DATE_ADD(IF(? IS NULL,CURDATE(),DATE_ADD(?,INTERVAL 1 DAY)),INTERVAL 29 DAY),150000,'aktif')`,
   [id,latest.berakhir,latest.berakhir,latest.berakhir,latest.berakhir]);
  const [payment]=await conn.query(`INSERT INTO pembayaran(id_keanggotaan,jenis,metode,nominal,status,diverifikasi_oleh,waktu_bayar)
   VALUES(?,'membership','tunai',150000,'diterima',?,NOW())`,[membership.insertId,req.user.id]);
  await conn.query("INSERT INTO riwayat_pembayaran(id_pembayaran,status_sesudah,nominal_diterima,dilakukan_oleh) VALUES(?,'diterima',150000,?)",[payment.insertId,req.user.id]);
  await conn.commit();
  res.status(201).json({message:'Membership 30 hari berhasil dicatat.',id:membership.insertId,customerId:id,fee:150000});
 }catch(e){await conn.rollback();res.status(400).json({message:e.code==='ER_DUP_ENTRY'?'Data pelanggan duplikat. Periksa nomor HP.':e.message});}
 finally{conn.release();}
});

export default r;
