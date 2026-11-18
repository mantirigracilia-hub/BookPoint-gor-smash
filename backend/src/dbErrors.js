const DATABASE_CONNECTION_ERRORS=new Set([
 'ECONNREFUSED',
 'ECONNRESET',
 'ETIMEDOUT',
 'ENOTFOUND',
 'EHOSTUNREACH',
 'ER_ACCESS_DENIED_ERROR',
 'ER_BAD_DB_ERROR',
 'PROTOCOL_CONNECTION_LOST',
 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR'
]);

export const DATABASE_UNAVAILABLE_MESSAGE='Database belum dapat diakses. Pastikan MySQL berjalan dan konfigurasi DB_* pada backend/.env sudah benar.';

export function isDatabaseUnavailable(error){
 return DATABASE_CONNECTION_ERRORS.has(error?.code);
}

// Kesalahan MySQL (punya sqlState/errno) tidak boleh dibocorkan apa adanya ke klien.
// Pesan bisnis (Error biasa yang dilempar route) tetap diteruskan.
export function publicMessage(error){
 if(error?.sqlState||error?.errno){
  return isDatabaseUnavailable(error)?DATABASE_UNAVAILABLE_MESSAGE:'Terjadi gangguan pada server. Silakan coba lagi.';
 }
 return error?.message||'Terjadi kesalahan.';
}

// Detail teknis hanya untuk development; di production dihilangkan dari respons.
export function errorDetail(error){
 return process.env.NODE_ENV==='production'?undefined:error?.message;
}
