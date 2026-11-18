import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import paymentRoutes from './routes/payments.js';
import memberRoutes from './routes/members.js';
import reportRoutes from './routes/reports.js';
import managementRoutes from './routes/management.js';
import {pool} from './db.js';
import {DATABASE_UNAVAILABLE_MESSAGE,isDatabaseUnavailable} from './dbErrors.js';
dotenv.config();
const isProduction=process.env.NODE_ENV==='production';
if(!process.env.JWT_SECRET) throw new Error('JWT_SECRET wajib diatur di backend/.env.');
if(isProduction&&process.env.JWT_SECRET.length<32) throw new Error('JWT_SECRET production minimal 32 karakter.');
const app=express();
const __dirname=path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(path.join(__dirname,'../uploads'),{recursive:true});
const allowedOrigins=(process.env.CLIENT_ORIGIN||(isProduction?'':'http://localhost:5173')).split(',').map(origin=>origin.trim()).filter(Boolean);
if(isProduction&&allowedOrigins.length===0)throw new Error('CLIENT_ORIGIN wajib diatur di production ke origin frontend yang diizinkan.');
app.use(cors({origin:(origin,callback)=>{
 const localDevOrigin=!isProduction&&/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):517[3-9]$/.test(origin||'');
 callback(null,!origin||allowedOrigins.includes(origin)||localDevOrigin);
}}));
app.use(express.json());
app.get('/api/health',async(req,res)=>{
 try{
  await pool.query('SELECT 1');
  res.json({status:'ok',database:'connected',app:'BookPoint API'});
 }catch(e){
  console.error(`Database health check failed: ${e.code||e.name||'unknown error'}`);
  res.status(503).json({
   status:'error',
   database:'disconnected',
   code:e.code||'DATABASE_ERROR',
   message:isDatabaseUnavailable(e)?DATABASE_UNAVAILABLE_MESSAGE:'Pemeriksaan database gagal.'
  });
 }
});
app.use('/api/auth',authRoutes);
app.use('/api/bookings',bookingRoutes);
app.use('/api/payments',paymentRoutes);
app.use('/api/members',memberRoutes);
app.use('/api/reports',reportRoutes);
app.use('/api/management',managementRoutes);
app.use((err,req,res,next)=>{
 const status=err.code==='LIMIT_FILE_SIZE'?413:Number(err.status)||((err.message||'').startsWith('Bukti harus')?400:500);
 res.status(status).json({message:status===500?'Internal server error':err.message});
});
const port=process.env.PORT||5000;
// Cleanup expired pending-DP bookings every minute; slots become available after cancellation.
let cleanupRunning=false;
setInterval(async()=>{
 if(cleanupRunning) return;
 cleanupRunning=true;
 let conn;
 try{
  conn=await pool.getConnection();
  await conn.beginTransaction();
  const [expired]=await conn.query("SELECT id_booking,dibuat_oleh FROM booking WHERE status_booking='menunggu_dp' AND batas_dp < NOW() FOR UPDATE");
  for(const b of expired){
   await conn.query("UPDATE booking SET status_booking='dibatalkan' WHERE id_booking=? AND status_booking='menunggu_dp'",[b.id_booking]);
   await conn.query('DELETE FROM reservasi_slot WHERE id_booking=?',[b.id_booking]);
   const [pending]=await conn.query("SELECT id_pembayaran FROM pembayaran WHERE id_booking=? AND status='menunggu_verifikasi' FOR UPDATE",[b.id_booking]);
   for(const p of pending){
    await conn.query("UPDATE pembayaran SET status='ditolak' WHERE id_pembayaran=?",[p.id_pembayaran]);
    await conn.query("INSERT INTO riwayat_pembayaran(id_pembayaran,status_sebelum,status_sesudah,dilakukan_oleh) VALUES(?,'menunggu_verifikasi','ditolak',?)",[p.id_pembayaran,b.dibuat_oleh]);
   }
   await conn.query("INSERT INTO riwayat_booking(id_booking,status_sebelum,status_sesudah,keterangan,dilakukan_oleh) VALUES(?,'menunggu_dp','dibatalkan','DP tidak diverifikasi dalam dua jam; slot dilepas',?)",[b.id_booking,b.dibuat_oleh]);
  }
  await conn.commit();
 }catch(e){if(conn) await conn.rollback();console.error('Cleanup booking:',e.message);}
 finally{if(conn) conn.release();cleanupRunning=false;}
},60000);
app.listen(port,()=>console.log(`BookPoint API berjalan di http://localhost:${port}`));
