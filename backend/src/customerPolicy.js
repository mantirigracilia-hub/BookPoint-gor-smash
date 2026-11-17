// [REQ-05] [BR-12] Nomor HP pelanggan unik tanpa menimpa nama yang sudah terdaftar.
export async function getOrCreateCustomer(conn,{name,phone}){
 const [result]=await conn.query(`INSERT INTO pelanggan(nama,nomor_hp) VALUES(?,?)
  ON DUPLICATE KEY UPDATE id_pelanggan=LAST_INSERT_ID(id_pelanggan)`,[name,phone]);
 if(!result.insertId) throw new Error('Data pelanggan tidak dapat dipastikan.');
 return {id:Number(result.insertId),created:result.affectedRows===1};
}
