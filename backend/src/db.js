import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

// Jam operasional GOR memakai waktu lokal. NOW()/CURDATE() di MySQL mengikuti zona waktu server
// (mis. UTC di hosting), sehingga slot "lewat" dan batas DP 2 jam bisa meleset berjam-jam.
// Atur DB_TIME_ZONE (offset, mis. +08:00 untuk WITA) agar setiap koneksi memakai zona waktu GOR.
export const DB_TIME_ZONE=(process.env.DB_TIME_ZONE||'+08:00').trim();
if(!/^[+-](0\d|1[0-4]):[0-5]\d$/.test(DB_TIME_ZONE)) throw new Error('DB_TIME_ZONE harus berupa offset seperti +08:00.');

export const pool = mysql.createPool({
 host:process.env.DB_HOST, port:Number(process.env.DB_PORT||3306),
 user:process.env.DB_USER, password:process.env.DB_PASSWORD,
 database:process.env.DB_NAME, waitForConnections:true,
 connectionLimit:10, dateStrings:true
});
pool.pool.on('connection',connection=>{
 connection.query('SET time_zone = ?',[DB_TIME_ZONE],error=>{
  if(error) console.error(`Gagal mengatur time_zone MySQL: ${error.code||error.message}`);
 });
});
