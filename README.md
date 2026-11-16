# BookPoint – GOR Smash

Implementasi awal berdasarkan SRS v2.0, prototype revisi, ERD, dan dokumen analisis yang diberikan tim.

## Stack
- React + Vite
- Node.js + Express
- MySQL 8
- REST API

## Persiapan
1. Install Node.js LTS dan MySQL 8.
2. Buat database dengan menjalankan `database/schema.sql` di MySQL Workbench.
3. Salin `backend/.env.example` menjadi `backend/.env`, lalu isi kredensial MySQL dan JWT secret.
4. Dari root project jalankan `npm install`.
5. Jalankan `npm run dev`.

Frontend: http://localhost:5173
Backend health check: http://localhost:5000/api/health

## Akun awal
Daftarkan akun pelanggan melalui halaman Register. Untuk membuat akun admin/owner pertama, jalankan SQL UPDATE/INSERT manual setelah akun terdaftar; jangan membuka registrasi publik untuk role admin/owner.

## Catatan implementasi
Ini adalah baseline MVP yang dapat dikembangkan dan diuji. Alur login/register, jadwal, pembuatan booking, upload bukti DP, verifikasi DP, dan pencatatan pelunasan disiapkan. Fitur pembatalan/reschedule, membership, audit trail lengkap, laporan, dan deployment tetap perlu divalidasi dan diselesaikan terhadap seluruh REQ-01–REQ-21 sebelum menyatakan sistem final.
Aturan slot ditahan sementara selama status menunggu DP mengikuti BR-11 (keputusan tim). Timer kedaluwarsa otomatis disediakan melalui endpoint cleanup yang dipanggil server; untuk produksi perlu scheduler permanen.
