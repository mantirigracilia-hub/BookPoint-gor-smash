import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import paymentRoutes from './routes/payments.js';
import {pool} from './db.js';
dotenv.config();
const app=express();
const __dirname=path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(path.join(__dirname,'../uploads'),{recursive:true});
app.use(cors({origin:process.env.CLIENT_ORIGIN||'http://localhost:5173'}));
app.use(express.json());
app.use('/uploads',express.static(path.join(__dirname,'../uploads')));
app.get('/api/health',async(req,res)=>{try{await pool.query('SELECT 1');res.json({status:'ok',database:'connected',app:'BookPoint API'});}catch(e){res.status(503).json({status:'error',database:'disconnected',detail:e.message});}});
app.use('/api/auth',authRoutes);
app.use('/api/bookings',bookingRoutes);
app.use('/api/payments',paymentRoutes);
app.use((err,req,res,next)=>res.status(500).json({message:'Internal server error',detail:err.message}));
const port=process.env.PORT||5000;
// Cleanup expired pending-DP bookings every minute; slots become available after cancellation.
setInterval(async()=>{
 try{
  const [expired]=await pool.query("SELECT id_booking,dibuat_oleh FROM booking WHERE status_booking='menunggu_dp' AND batas_dp < NOW()");
  for(const b of expired){
   await pool.query("UPDATE booking SET status_booking='dibatalkan' WHERE id_booking=? AND status_booking='menunggu_dp'",[b.id_booking]);
   await pool.query("INSERT INTO riwayat_booking(id_booking,status_sebelum,status_sesudah,keterangan,dilakukan_oleh) VALUES(?,'menunggu_dp','dibatalkan','DP kedaluwarsa otomatis',?)",[b.id_booking,b.dibuat_oleh]);
  }
 }catch(e){console.error('Cleanup booking:',e.message);}
},60000);
app.listen(port,()=>console.log(`BookPoint API berjalan di http://localhost:${port}`));
