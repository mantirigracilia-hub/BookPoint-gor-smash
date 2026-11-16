import {Router} from 'express';
import bcrypt from 'bcryptjs';
import {pool} from '../db.js';
import {auth,allow} from '../middleware/auth.js';

const r=Router();

r.get('/courts',auth,allow('owner'),async(req,res)=>{
 try{const [rows]=await pool.query('SELECT id_lapangan,nama,aktif FROM lapangan ORDER BY id_lapangan');res.json(rows);}
 catch(e){res.status(500).json({message:'Gagal memuat data lapangan.',detail:e.message});}
});

r.post('/courts',auth,allow('owner'),async(req,res)=>{
 try{
  const name=String(req.body.nama||'').trim();
  if(!name||name.length>60) return res.status(400).json({message:'Nama lapangan wajib diisi (maksimal 60 karakter).'});
  const [result]=await pool.query('INSERT INTO lapangan(nama,aktif) VALUES(?,TRUE)',[name]);
  res.status(201).json({id:result.insertId,nama:name,aktif:true});
 }catch(e){res.status(e.code==='ER_DUP_ENTRY'?409:500).json({message:e.code==='ER_DUP_ENTRY'?'Nama lapangan sudah digunakan.':'Gagal menambahkan lapangan.',detail:e.message});}
});

r.put('/courts/:id',auth,allow('owner'),async(req,res)=>{
 try{
  const name=String(req.body.nama||'').trim();
  const active=req.body.aktif===true;
  if(!name||name.length>60) return res.status(400).json({message:'Nama lapangan wajib diisi (maksimal 60 karakter).'});
  if(!active){
   const [[future]]=await pool.query(`SELECT COUNT(*) AS jumlah FROM reservasi_slot s JOIN booking b ON b.id_booking=s.id_booking
    WHERE s.id_lapangan=? AND TIMESTAMP(s.tanggal,s.jam_mulai)>NOW() AND b.status_booking IN ('menunggu_dp','terkonfirmasi','lunas')`,[req.params.id]);
   if(Number(future.jumlah)>0) return res.status(409).json({message:'Lapangan masih memiliki booking aktif mendatang dan tidak dapat dinonaktifkan.'});
  }
  const [result]=await pool.query('UPDATE lapangan SET nama=?,aktif=? WHERE id_lapangan=?',[name,active,req.params.id]);
  if(!result.affectedRows) return res.status(404).json({message:'Lapangan tidak ditemukan.'});
  res.json({message:'Data lapangan diperbarui.'});
 }catch(e){res.status(e.code==='ER_DUP_ENTRY'?409:500).json({message:e.code==='ER_DUP_ENTRY'?'Nama lapangan sudah digunakan.':'Gagal memperbarui lapangan.',detail:e.message});}
});

r.get('/rates',auth,allow('owner'),async(req,res)=>{
 try{const [rows]=await pool.query('SELECT id_tarif,nama,harga_per_jam,jam_mulai,jam_selesai,hari_akhir_pekan,aktif FROM tarif ORDER BY id_tarif');res.json(rows);}
 catch(e){res.status(500).json({message:'Gagal memuat tarif.',detail:e.message});}
});

r.put('/rates',auth,allow('owner'),async(req,res)=>{
 const rates={normal:Number(req.body.normal),peak:Number(req.body.peak),weekend:Number(req.body.weekend)};
 if(Object.values(rates).some(value=>!Number.isFinite(value)||value<0)) return res.status(400).json({message:'Semua tarif harus berupa angka nol atau lebih.'});
 const conn=await pool.getConnection();
 try{
  await conn.beginTransaction();
  const [normal]=await conn.query("UPDATE tarif SET harga_per_jam=?,aktif=TRUE WHERE nama='Tarif Normal'",[rates.normal]);
  const [peak]=await conn.query("UPDATE tarif SET harga_per_jam=?,aktif=TRUE WHERE jam_mulai IS NOT NULL AND jam_selesai IS NOT NULL",[rates.peak]);
  const [weekend]=await conn.query("UPDATE tarif SET harga_per_jam=?,aktif=TRUE WHERE hari_akhir_pekan=TRUE",[rates.weekend]);
  if(!normal.affectedRows||!peak.affectedRows||!weekend.affectedRows) throw new Error('Tarif normal, prime time, atau weekend belum tersedia.');
  await conn.commit();
  res.json({message:'Tarif berhasil diperbarui.'});
 }catch(e){await conn.rollback();res.status(400).json({message:e.message});}
 finally{conn.release();}
});

r.get('/hours',auth,allow('owner'),async(req,res)=>{
 try{const [rows]=await pool.query('SELECT hari,jam_buka,jam_tutup FROM jam_operasional ORDER BY hari');res.json(rows);}
 catch(e){res.status(500).json({message:'Gagal memuat jam operasional.',detail:e.message});}
});

r.put('/hours',auth,allow('owner'),async(req,res)=>{
 const hours=req.body.hours;
 if(!Array.isArray(hours)||hours.length!==7) return res.status(400).json({message:'Jam operasional untuk tujuh hari wajib dikirim.'});
 for(const row of hours){
  if(!Number.isInteger(Number(row.hari))||Number(row.hari)<0||Number(row.hari)>6||!/^([01]\d|2[0-3]):00$/.test(row.jam_buka)||!/^([01]\d|2[0-3]):00$/.test(row.jam_tutup)||row.jam_buka>=row.jam_tutup) return res.status(400).json({message:'Setiap hari harus memiliki jam buka dan tutup yang valid.'});
 }
 const conn=await pool.getConnection();
 try{
  await conn.beginTransaction();
  for(const row of hours) await conn.query('UPDATE jam_operasional SET jam_buka=?,jam_tutup=? WHERE hari=?',[`${row.jam_buka}:00`,`${row.jam_tutup}:00`,row.hari]);
  await conn.commit();
  res.json({message:'Jam operasional diperbarui.'});
 }catch(e){await conn.rollback();res.status(500).json({message:'Gagal memperbarui jam operasional.',detail:e.message});}
 finally{conn.release();}
});

r.get('/admins',auth,allow('owner'),async(req,res)=>{
 try{
  const [rows]=await pool.query(`SELECT id_akun,username,aktif,created_at FROM akun_pengguna WHERE peran='admin' ORDER BY username`);
  res.json(rows);
 }catch(e){res.status(500).json({message:'Gagal memuat akun admin.',detail:e.message});}
});

r.post('/admins',auth,allow('owner'),async(req,res)=>{
 try{
  const username=String(req.body.username||'').trim(),password=String(req.body.password||'');
  if(!/^[a-zA-Z0-9._-]{3,80}$/.test(username)||password.length<8) return res.status(400).json({message:'Username (3–80 karakter) dan password minimal 8 karakter wajib diisi.'});
  const hash=await bcrypt.hash(password,12);
  const [result]=await pool.query("INSERT INTO akun_pengguna(username,kata_sandi_hash,peran) VALUES(?,?,'admin')",[username,hash]);
  res.status(201).json({id:result.insertId,username,aktif:true});
 }catch(e){res.status(e.code==='ER_DUP_ENTRY'?409:500).json({message:e.code==='ER_DUP_ENTRY'?'Username sudah digunakan.':'Gagal membuat akun admin.',detail:e.message});}
});

r.patch('/admins/:id',auth,allow('owner'),async(req,res)=>{
 try{
  const active=req.body.aktif;
  if(typeof active!=='boolean') return res.status(400).json({message:'Nilai aktif harus true atau false.'});
  const [result]=await pool.query("UPDATE akun_pengguna SET aktif=? WHERE id_akun=? AND peran='admin'",[active,req.params.id]);
  if(!result.affectedRows) return res.status(404).json({message:'Akun admin tidak ditemukan.'});
  res.json({message:active?'Akun admin diaktifkan.':'Akun admin dinonaktifkan.'});
 }catch(e){res.status(500).json({message:'Gagal memperbarui akun admin.',detail:e.message});}
});

export default r;
