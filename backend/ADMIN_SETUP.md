# Membuat akun Owner pertama

Registrasi publik hanya membuat role `customer`. Akun **Owner** dibuat sekali
lewat script provisioning (password disimpan sebagai hash bcrypt, tidak dicetak):

```powershell
cd backend
$env:OWNER_USERNAME = "owner"
$env:OWNER_PASSWORD = "<password minimal 12 karakter>"
npm run provision-owner
```

Syarat: `backend/.env` sudah berisi konfigurasi DB dan `JWT_SECRET` acak
(minimal 32 karakter), serta `database/schema.sql` sudah dijalankan.

Setelah itu masuk sebagai Owner (username + password), lalu buat akun **Admin**
dari menu **Data Master → Akun admin**. Username admin tidak boleh berupa nomor HP.
Script menolak berjalan jika Owner sudah ada. Jangan simpan password dalam teks biasa.
