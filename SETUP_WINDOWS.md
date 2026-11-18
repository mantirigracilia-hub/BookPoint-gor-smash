# Cara Menjalankan BookPoint di Windows (VS Code)

## 1. Ekstrak dan buka
Ekstrak `BookPoint-gor-smash.zip`, lalu buka folder `BookPoint-gor-smash` melalui VS Code.

## 2. Siapkan database
1. Pastikan MySQL Server berjalan.
2. Buka MySQL Workbench dan koneksikan ke server lokal.
3. Buka `database/schema.sql`, lalu jalankan seluruh script.
4. Pastikan database `bookpoint` dan tabel-tabel berhasil dibuat.

## 3. Konfigurasi backend
Di terminal VS Code:
```powershell
cd backend
Copy-Item .env.example .env
```
Edit `backend/.env` dan isi `DB_PASSWORD` serta `JWT_SECRET` sendiri. Jangan commit file `.env`.

Frontend tidak perlu `.env` untuk development lokal (otomatis memakai
`http://<host yang dibuka>:5000/api`). Salin `frontend/.env.example` menjadi
`frontend/.env` hanya jika backend berada di alamat lain.

## 4. Install dependency
Kembali ke root folder:
```powershell
cd ..
npm.cmd install
```

## 5. Jalankan
```powershell
npm.cmd run dev
```
Buka:
- Frontend: http://localhost:5173
- Health check: http://localhost:5000/api/health

Jika PowerShell memblokir `npm`, gunakan `npm.cmd`.

## 6. Buat akun
Daftar sebagai pelanggan dari halaman BookPoint. Untuk membuat Owner pertama, ikuti `backend/ADMIN_SETUP.md`; admin berikutnya dibuat Owner dari menu Data Master.

## 7. Push ke GitHub
Pastikan berada di root project:
```powershell
git status
git add .
git commit -m "feat: add BookPoint implementation baseline"
git push origin main
```
Jangan commit `backend/.env`, `node_modules`, file upload bukti, atau password.

## Troubleshooting
- `ECONNREFUSED` MySQL: pastikan MySQL Server berjalan dan port 3306 benar.
- `Access denied`: cek DB_USER dan DB_PASSWORD di backend/.env.
- CORS: pastikan frontend di port 5173 (development: localhost dan IP jaringan lokal diizinkan otomatis).
- API 500: periksa terminal backend dan pastikan schema.sql sudah dijalankan.
