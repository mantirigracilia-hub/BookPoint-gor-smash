# BookPoint – GOR Smash

Sistem reservasi lapangan badminton berbasis SRS v2.0.

## Stack
- React + Vite
- Node.js + Express
- MySQL 8
- REST API

## Menjalankan aplikasi
1. Install Node.js LTS dan MySQL 8.
2. Untuk database baru, jalankan `database/schema.sql` di MySQL Workbench.
   Untuk database lama, backup terlebih dahulu lalu jalankan migrasi yang
   belum pernah dijalankan, berurutan: `001_srs_workflows.sql`, lalu
   `002_unique_tarif.sql` (hapus tarif ganda). Jangan jalankan migrasi pada
   database baru yang sudah dibuat dari schema terkini.
3. Salin `backend/.env.example` menjadi `backend/.env`, lalu isi kredensial
   MySQL dan ganti `JWT_SECRET` dengan nilai acak yang kuat (minimal 32 karakter).
   Isi `PAYMENT_BANK_NAME`, `PAYMENT_ACCOUNT_NUMBER`, dan `PAYMENT_ACCOUNT_NAME` agar instruksi transfer DP tampil ke pelanggan (REQ-09).
   Atur juga `DB_TIME_ZONE` ke offset zona waktu GOR (WITA = `+08:00`). Tanpa ini,
   hosting berzona UTC membuat slot "lewat" dan batas DP 2 jam meleset berjam-jam.
4. Dari root project jalankan `npm install`, lalu `npm run dev`.

Frontend: http://localhost:5173  
Backend health check: http://localhost:5000/api/health

## Konfigurasi deployment internet

Frontend dan backend harus sama-sama dapat diakses dari internet. Untuk frontend
dan backend pada host/domain berbeda, atur variabel build frontend
`VITE_API_URL` ke URL publik backend dengan akhiran `/api`, misalnya
`https://api.domain-anda.com/api`. Vite menyematkan variabel ini saat build,
jadi build dan deploy ulang frontend setelah mengubah nilainya.

Tambahkan `DB_TIME_ZONE=+08:00` (atau offset GOR Anda) pada environment backend.

Atur `CLIENT_ORIGIN` pada backend ke origin frontend yang tepat, misalnya
`https://domain-anda.com`. Beberapa origin dapat dipisahkan dengan koma.
Origin harus mencocokkan protokol, host, dan port yang dipakai browser; jangan
menambahkan path. Pada deployment satu domain, `VITE_API_URL` boleh dikosongkan
hanya jika reverse proxy di host frontend meneruskan `/api` ke backend.

Gunakan HTTPS untuk kedua layanan. Atur kredensial MySQL production dan
`JWT_SECRET` yang kuat melalui environment variables hosting, bukan file yang
diunggah. Verifikasi backend dari internet melalui
`https://api.domain-anda.com/api/health`; status database harus `connected`.

### Backend Railway untuk frontend Vercel

Root project menyediakan `npm start` untuk menjalankan API backend. Pada
service backend Railway, hubungkan MySQL Railway dan atur environment:

```text
NODE_ENV=production
CLIENT_ORIGIN=https://bookpoint.vercel.app
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
JWT_SECRET=<secret acak minimal 32 karakter>
```

Ganti `MySQL` pada referensi variabel dengan nama service database di project
Railway. Database perlu diinisialisasi dari `database/schema.sql` satu kali;
pastikan database bernama `bookpoint` karena schema membuat dan memilih nama
tersebut. Setelah API mendapat domain HTTPS Railway, set `VITE_API_URL` di
Vercel menjadi `https://<domain-api-railway>/api`, lalu build/deploy ulang
frontend. Verifikasi `/api/health` pada domain API sebelum mencoba login.

Jika mengaktifkan upload bukti pembayaran, pasang Railway Volume pada
`/app/backend/uploads` agar file tetap tersimpan setelah service restart.

## Akun awal
Registrasi publik hanya membuat akun pelanggan. Setelah MySQL aktif, schema
dibuat, dan `backend/.env` berisi konfigurasi DB serta `JWT_SECRET` acak minimal
32 karakter, buat akun Owner pertama sekali melalui PowerShell:

```powershell
$env:OWNER_USERNAME = Read-Host "Username Owner"
$secure = Read-Host "Password Owner (minimal 12 karakter)" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $env:OWNER_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  npm run provision-owner -w backend
} finally {
  Remove-Item Env:OWNER_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:OWNER_USERNAME -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  $secure.Dispose()
}
```

Perintah hanya membuat Owner jika belum ada; password disimpan sebagai hash
bcrypt dan tidak dicetak. Setelah provisioning, buka **Masuk**, gunakan username
dan password Owner, lalu buat akun admin dari menu **Data Master**. Akun admin
masuk dengan username dan password yang dibuat Owner.

## Cakupan fitur
- Login dan registrasi pelanggan, dashboard operasional admin, serta jadwal publik.
- Jadwal dan tarif dinamis, booking multi-slot, pemesanan manual oleh admin,
  upload bukti DP, verifikasi pembayaran, dan pelunasan.
- Membership, pembatalan dan pencatatan refund manual, pengajuan pembatalan
  tepat 24 jam untuk keputusan admin, serta reschedule satu kali.
- Laporan pendapatan/okupansi, pengelolaan master, dan riwayat aktivitas.

Implementasi alur tersedia, tetapi penerimaan terhadap seluruh SRS belum dapat
dinyatakan selesai sebelum migrasi/schema dan acceptance flow diuji dengan
MySQL, serta HTTPS, backup, dan deployment produksi disiapkan.
