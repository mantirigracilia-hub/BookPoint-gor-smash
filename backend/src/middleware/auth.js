import jwt from 'jsonwebtoken';
import {pool} from '../db.js';
export async function auth(req,res,next){
 const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
 if(!token) return res.status(401).json({message:'Silakan login terlebih dahulu'});
 let claims;
 try { claims=jwt.verify(token,process.env.JWT_SECRET); }
 catch { return res.status(401).json({message:'Sesi tidak valid, silakan login kembali'}); }
 try{
  const [[account]]=await pool.query('SELECT peran,aktif FROM akun_pengguna WHERE id_akun=?',[claims.id]);
  if(!account||!account.aktif) return res.status(401).json({message:'Akun tidak aktif atau tidak ditemukan.'});
  req.user={...claims,role:account.peran};
  next();
 }catch(e){next(e);}
}
export function optionalAuth(req,res,next){
 const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
 if(!token) return next();
 return auth(req,res,next);
}
export function allow(...roles){ return (req,res,next)=>roles.includes(req.user?.role)?next():res.status(403).json({message:'Akses ditolak'}); }
