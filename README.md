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
   Untuk database lama, backup terlebih dahulu lalu jalankan
   `database/migrations/001_srs_workflows.sql` satu kali. Jangan jalankan
   migrasi pada database baru yang sudah dibuat dari schema terkini.
3. Salin `backend/.env.example` menjadi `backend/.env`, lalu isi kredensial
   MySQL dan ganti `JWT_SECRET` dengan nilai acak yang kuat (minimal 32 karakter).
4. Dari root project jalankan `npm install`, lalu `npm run dev`.

Frontend: http://localhost:5173  
Backend health check: http://localhost:5000/api/health

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
