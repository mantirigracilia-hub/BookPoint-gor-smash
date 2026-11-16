import bcrypt from 'bcryptjs';
import {pool} from '../src/db.js';
import {DATABASE_UNAVAILABLE_MESSAGE,isDatabaseUnavailable} from '../src/dbErrors.js';

const LOCK_NAME='bookpoint_owner_provision';

async function provisionOwner(){
 const username=String(process.env.OWNER_USERNAME||'').trim();
 const password=String(process.env.OWNER_PASSWORD||'');
 const jwtSecret=String(process.env.JWT_SECRET||'');
 let conn;
 let lockAcquired=false;
 let transactionStarted=false;
 try{
  if(!/^[a-zA-Z0-9._-]{3,80}$/.test(username)){
   throw new Error('OWNER_USERNAME harus berisi 3-80 karakter: huruf, angka, titik, garis bawah, atau tanda hubung.');
  }
  if(password.length<12||Buffer.byteLength(password,'utf8')>72){
   throw new Error('OWNER_PASSWORD harus minimal 12 karakter dan maksimal 72 byte.');
  }
  if(jwtSecret.length<32||jwtSecret==='ganti_dengan_random_secret_minimal_32_karakter'){
   throw new Error('Atur JWT_SECRET acak minimal 32 karakter di backend/.env sebelum membuat Owner.');
  }
  conn=await pool.getConnection();
  const [[lock]]=await conn.query('SELECT GET_LOCK(?,10) AS acquired',[LOCK_NAME]);
  lockAcquired=Number(lock.acquired)===1;
  if(!lockAcquired) throw new Error('Tidak dapat memperoleh lock provisioning Owner.');
  await conn.beginTransaction();
  transactionStarted=true;
  const [[owner]]=await conn.query("SELECT id_akun FROM akun_pengguna WHERE peran='owner' LIMIT 1 FOR UPDATE");
  if(owner) throw new Error('Owner sudah tersedia. Masuk dengan akun Owner tersebut untuk membuat admin.');
  const hash=await bcrypt.hash(password,12);
  await conn.query("INSERT INTO akun_pengguna(username,kata_sandi_hash,peran) VALUES(?,?,'owner')",[username,hash]);
  await conn.commit();
  transactionStarted=false;
  console.log(`Akun Owner berhasil dibuat untuk username "${username}".`);
 }catch(error){
  if(conn&&transactionStarted){
   try{await conn.rollback();}
   catch(rollbackError){console.error(`Rollback provisioning gagal: ${rollbackError.code||rollbackError.name||'unknown error'}`);}
  }
  if(isDatabaseUnavailable(error)){
   console.error(`${DATABASE_UNAVAILABLE_MESSAGE} (${error.code||'database error'})`);
  }else if(error.code==='ER_NO_SUCH_TABLE'){
   console.error('Schema database belum tersedia. Jalankan database/schema.sql terlebih dahulu.');
  }else{
   console.error(error.message||'Provisioning Owner gagal.');
  }
  process.exitCode=1;
 }finally{
  if(conn&&lockAcquired){
   try{await conn.query('SELECT RELEASE_LOCK(?)',[LOCK_NAME]);}
   catch(error){console.error(`Pelepasan lock gagal: ${error.code||error.name||'unknown error'}`);process.exitCode=1;}
  }
  if(conn) conn.release();
  await pool.end();
 }
}

await provisionOwner();
