import {Router} from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {pool} from '../db.js';
const r=Router();
r.post('/register',async(req,res)=>{
 try{
  const {nama,nomor_hp,password}=req.body;
  if(!nama||!nomor_hp||!password||password.length<8) return res.status(400).json({message:'Nama, nomor HP, dan password minimal 8 karakter wajib diisi'});
  const [exists]=await pool.query('SELECT id_pelanggan FROM pelanggan WHERE nomor_hp=?',[nomor_hp]);
  if(exists.length) return res.status(409).json({message:'Nomor HP sudah terdaftar'});
  const hash=await bcrypt.hash(password,12);
  const [p]=await pool.query('INSERT INTO pelanggan(nama,nomor_hp) VALUES(?,?)',[nama,nomor_hp]);
  const [a]=await pool.query("INSERT INTO akun_pengguna(id_pelanggan,kata_sandi_hash,peran) VALUES(?,?,'customer')",[p.insertId,hash]);
  const token=jwt.sign({id:a.insertId,role:'customer',customerId:p.insertId},process.env.JWT_SECRET,{expiresIn:'12h'});
  res.status(201).json({token,user:{id:a.insertId,nama,nomor_hp,role:'customer'}});
 }catch(e){res.status(500).json({message:'Gagal mendaftar',detail:e.message});}
});
r.post('/login',async(req,res)=>{
 try{
  const {nomor_hp,password}=req.body;
  const [rows]=await pool.query(`SELECT a.id_akun,a.kata_sandi_hash,a.peran,a.id_pelanggan,p.nama,p.nomor_hp
   FROM akun_pengguna a LEFT JOIN pelanggan p ON p.id_pelanggan=a.id_pelanggan
   WHERE p.nomor_hp=? OR a.username=? LIMIT 1`,[nomor_hp,nomor_hp]);
  if(!rows.length||!await bcrypt.compare(password||'',rows[0].kata_sandi_hash)) return res.status(401).json({message:'Nomor HP/username atau password salah'});
  const u=rows[0], token=jwt.sign({id:u.id_akun,role:u.peran,customerId:u.id_pelanggan},process.env.JWT_SECRET,{expiresIn:'12h'});
  res.json({token,user:{id:u.id_akun,nama:u.nama||u.peran,nomor_hp:u.nomor_hp,role:u.peran}});
 }catch(e){res.status(500).json({message:'Gagal login',detail:e.message});}
});
export default r;
