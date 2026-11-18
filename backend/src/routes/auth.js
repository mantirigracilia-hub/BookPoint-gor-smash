import {Router} from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {pool} from '../db.js';
import {DATABASE_UNAVAILABLE_MESSAGE,isDatabaseUnavailable} from '../dbErrors.js';
const r=Router();

function sendAuthError(res,action,error){
 if(isDatabaseUnavailable(error)){
  console.error(`Authentication ${action} failed: ${error.code}`);
  return res.status(503).json({message:DATABASE_UNAVAILABLE_MESSAGE});
 }
 console.error(`Authentication ${action} failed: ${error.code||error.name||'unknown error'}`);
 return res.status(500).json({message:`Gagal ${action}. Terjadi gangguan server.`});
}

r.post('/register',async(req,res)=>{
 let conn;
 try{
  const body=req.body||{};
  const nama=String(body.nama||'').trim(),nomor_hp=String(body.nomor_hp||'').trim(),password=String(body.password||'');
  if(!nama||nama.length>120||!/^0\d{8,19}$/.test(nomor_hp)||password.length<8) return res.status(400).json({message:'Nama, nomor HP yang valid, dan password minimal 8 karakter wajib diisi'});
  if(Buffer.byteLength(password,'utf8')>72) return res.status(400).json({message:'Password maksimal 72 byte.'});
  const hash=await bcrypt.hash(password,12);
  conn=await pool.getConnection();
  await conn.beginTransaction();
  const [exists]=await conn.query('SELECT id_pelanggan FROM pelanggan WHERE nomor_hp=?',[nomor_hp]);
  if(exists.length){await conn.rollback();return res.status(409).json({message:'Nomor HP sudah terdaftar'});}
  const [p]=await conn.query('INSERT INTO pelanggan(nama,nomor_hp) VALUES(?,?)',[nama,nomor_hp]);
  const [a]=await conn.query("INSERT INTO akun_pengguna(id_pelanggan,kata_sandi_hash,peran) VALUES(?,?,'customer')",[p.insertId,hash]);
  await conn.commit();
  const token=jwt.sign({id:a.insertId,role:'customer',customerId:p.insertId},process.env.JWT_SECRET,{expiresIn:'12h'});
  res.status(201).json({token,user:{id:a.insertId,nama,nomor_hp,role:'customer'}});
 }catch(e){
  if(conn){try{await conn.rollback();}catch{/* koneksi sudah tertutup */}}
  // Dua pendaftaran bersamaan dengan nomor HP sama: unique key menolak yang kedua.
  if(e.code==='ER_DUP_ENTRY') return res.status(409).json({message:'Nomor HP sudah terdaftar'});
  sendAuthError(res,'mendaftar',e);
 }finally{if(conn) conn.release();}
});
r.post('/login',async(req,res)=>{
 try{
  const body=req.body||{};
  const identifier=String(body.identifier??body.nomor_hp??'').trim(),password=String(body.password||'');
  if(!identifier||!password) return res.status(400).json({message:'Masukkan username atau nomor HP dan password.'});
  const [rows]=await pool.query(`SELECT a.id_akun,a.kata_sandi_hash,a.peran,a.id_pelanggan,a.aktif,p.nama,p.nomor_hp
   FROM akun_pengguna a LEFT JOIN pelanggan p ON p.id_pelanggan=a.id_pelanggan
   WHERE p.nomor_hp=? OR a.username=? ORDER BY (a.username=?) DESC LIMIT 1`,[identifier,identifier,identifier]);
  if(!rows.length||!rows[0].aktif||!await bcrypt.compare(password,rows[0].kata_sandi_hash)) return res.status(401).json({message:'Username/nomor HP atau password salah'});
  const u=rows[0], token=jwt.sign({id:u.id_akun,role:u.peran,customerId:u.id_pelanggan},process.env.JWT_SECRET,{expiresIn:'12h'});
  res.json({token,user:{id:u.id_akun,nama:u.nama||u.peran,nomor_hp:u.nomor_hp,role:u.peran}});
 }catch(e){sendAuthError(res,'login',e);}
});
export default r;
