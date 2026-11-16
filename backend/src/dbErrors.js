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
