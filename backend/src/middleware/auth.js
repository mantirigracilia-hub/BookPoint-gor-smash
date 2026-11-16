import jwt from 'jsonwebtoken';
export function auth(req,res,next){
 const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
 if(!token) return res.status(401).json({message:'Silakan login terlebih dahulu'});
 try { req.user=jwt.verify(token,process.env.JWT_SECRET); next(); }
 catch { return res.status(401).json({message:'Sesi tidak valid, silakan login kembali'}); }
}
export function allow(...roles){ return (req,res,next)=>roles.includes(req.user?.role)?next():res.status(403).json({message:'Akses ditolak'}); }
