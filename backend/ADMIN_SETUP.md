# Membuat akun Admin / Owner pertama

Registrasi publik hanya membuat role `customer`. Setelah mendaftarkan akun awal melalui UI, jalankan query berikut di MySQL Workbench dengan mengganti nomor HP:

```sql
USE bookpoint;
UPDATE akun_pengguna a
JOIN pelanggan p ON p.id_pelanggan=a.id_pelanggan
SET a.peran='admin'
WHERE p.nomor_hp='08xxxxxxxxxx';
```

Untuk owner, ganti `admin` menjadi `owner`. Lakukan hanya untuk akun tim yang dipercaya. Jangan pernah menyimpan password dalam bentuk teks biasa.
