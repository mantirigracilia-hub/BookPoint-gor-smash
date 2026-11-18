# Catatan Koreksi BookPoint

Hasil review seluruh kode (backend, schema SQL, frontend, dokumen setup).
Diverifikasi: sintaks semua file backend, 17 unit test (`npm test -w backend`), dan
kompilasi JSX dengan esbuild. **Belum diuji terhadap MySQL nyata** (tidak tersedia di
lingkungan review) — jalankan alur booking → DP → pelunasan → batal/reschedule setelah menerapkan.

## Error yang diperbaiki
| # | Lokasi | Masalah | Perbaikan |
|---|--------|---------|-----------|
| 1 | `frontend/.env copy.example` | Nama file salah (spasi), isi `VITE_API_URL=VITE_API_URL=http://192.168.111.1...` (kunci ganda + IP LAN hard-code) → base URL API rusak | Diganti `frontend/.env.example`, isi benar |
| 2 | `db.js` | `NOW()`/`CURDATE()` ikut zona waktu server DB (UTC di hosting). Jam operasional GOR, slot "lewat", dan batas DP 2 jam meleset (mis. 22:30 UTC = 06:30 WITA hari berikutnya) | Setiap koneksi `SET time_zone` dari `DB_TIME_ZONE` (default `+08:00`) |
| 3 | `reports.js` | Validator tanggal lemah: `2026-02-30`, `2026-04-31` lolos ke MySQL | `dateUtils.js` (ketat) dipakai bersama bookings & reports |
| 4 | `auth.js` register | Insert pelanggan + akun tidak atomik (data yatim bila gagal); pendaftaran bersamaan nomor sama → 500 | Transaksi + `ER_DUP_ENTRY` → 409; password dibatasi 72 byte (batas bcrypt) |
| 5 | `server.js` | `JWT_SECRET` kosong baru ketahuan saat login (500 membingungkan); CORS dev menolak akses dari HP lewat IP LAN; cleanup bisa tumpang tindih | Validasi saat start; CORS dev izinkan IP privat; guard `cleanupRunning` |
| 6 | `bookings.js` cancel | Pelanggan bisa membatalkan booking yang sudah dimulai/lewat | Ditolak bila `secondsUntilStart<=0` |
| 7 | Semua routes | `detail:e.message` dan `message:e.message` membocorkan pesan SQL ke klien | `errorDetail`/`publicMessage` (dbErrors.js); detail hilang di production |
| 8 | `members.js` | Bergantung pada `insertId` hasil `ON DUPLICATE KEY UPDATE` (nilainya tidak andal) | Selalu cari id lewat nomor HP |
| 9 | `management.js` | Username admin berupa nomor HP bisa membajak login pelanggan bernomor sama | Username berbentuk nomor HP ditolak |
| 10 | `schema.sql` | `INSERT IGNORE` tarif tidak efektif (tak ada unique key) → tarif ganda tiap schema dijalankan ulang | `UNIQUE (nama)` + `migrations/002_unique_tarif.sql` untuk DB lama |
| 11 | `App.jsx` | Jadwal tidak dimuat ulang setelah login/logout → harga & status member basi | `loadSchedule` bergantung pada `user?.id` |
| 12 | `App.jsx` | Token kedaluwarsa membuat UI "login" tapi semua request gagal | Interceptor 401 → keluar sesi ke halaman login |
| 13 | `App.jsx` | User null di halaman selain home/login/public → crash `user.role` | Fallback ke halaman publik |
| 14 | `App.jsx` | Batal pada prompt pengembalian tetap memanggil API (`Number(null)=0`); input pelunasan kosong dihitung 0; file bukti sama tak bisa dipilih ulang | Divalidasi / input direset |
| 15 | `App.jsx` | Dev API hard-code `localhost` (gagal dari HP/LAN) | Memakai `window.location.hostname` |
| 16 | `ADMIN_SETUP.md`, README, SETUP_WINDOWS | Instruksi usang (promosi admin via SQL) bertentangan dengan `provision-owner` | Diselaraskan |

| 17 | `payments.js`, `App.jsx` | **REQ-09** mewajibkan instruksi transfer bersama hitung mundur, tetapi rekening tujuan tidak tampil di mana pun | Endpoint `GET /payments/instructions` (rekening dari env `PAYMENT_*`) + kotak instruksi di kartu booking; bila belum diisi, pelanggan diminta menghubungi admin (nomor rekening tidak dikarang) |

## Perlu keputusan Anda (tidak diubah otomatis)
1. **Pelanggan yang dibuat admin (booking telepon/member) tidak bisa mendaftar sendiri**: nomor HP-nya sudah ada sehingga register menjawab "sudah terdaftar". Menautkan akun ke data lama tanpa verifikasi (OTP) akan membuka riwayat booking orang lain ke siapa pun yang tahu nomornya. Disarankan: verifikasi OTP/WhatsApp, atau admin yang mengaktifkan akun.
2. **Diskon member dihitung dari tanggal hari ini**, bukan tanggal main. Booking 10 hari ke depan bisa berdiskon padahal member habis sebelum tanggal itu.
3. **Reschedule**: pesan error menyebut "hanya terkonfirmasi" tetapi kode juga mengizinkan `lunas`; jumlah slot boleh berubah sehingga DP yang sudah dibayar bisa melebihi total baru tanpa alur refund.
4. **Tidak ada pembatasan percobaan login** (brute force). Disarankan `express-rate-limit` pada `/api/auth/*`.
5. Prioritas Critical/High pada `docs/stage-4/qa/Revision_Findings.md` (diagram arsitektur, constraint satu DP per booking) masih terbuka.

## Audit terhadap SRS v2.0 (patokan)
REQ-01..21 dan NFR-04/05/08 sudah terpenuhi di kode, kecuali yang tercatat di bawah.
Diskrepansi berikut dibiarkan sampai tim memutuskan, sebab mengubahnya berarti mengubah kebijakan.

| Hal | SRS | Kode | Saran |
|-----|-----|------|-------|
| Pengembalian DP | Asumsi 5, Bagian 8, SC-ADM-05 langkah 4: pengembalian DP tidak dibuat, ditangani admin di luar sistem; DP batal >24 jam hanya boleh pindah jadwal | Ada alur refund manual (`pengembalian_dana`, layar Pengembalian, laporan mengurangi refund) | Selaraskan: hapus dari kode **atau** tambahkan ke SRS sebagai REQ baru (revisi 3.0) |
| Batal tepat 24 jam | Tidak diatur (hanya "<24 jam" dan ">24 jam") | Permohonan masuk antrean keputusan admin | Catat sebagai asumsi tim di Bagian 7 |
| DP tunai oleh admin | DP lewat transfer + bukti, diverifikasi admin | Admin bisa mencatat booking dengan DP tunai (langsung terkonfirmasi) | Catat sebagai asumsi atau hapus |
| Aktor REQ-12/13 | Pelanggan **dan Admin** membatalkan/memindahkan | Admin hanya bisa batal-GOR; tidak bisa batal/pindah atas nama pelanggan | Tambah endpoint admin atau ubah kolom Aktor di SRS |
| Akses laporan | REQ-17/18 aktor hanya Pemilik | Admin juga bisa membuka laporan | Batasi ke owner atau tambahkan Admin di SRS |
| Perhitungan member | BR-08: diskon & batas hari untuk member | Status member dinilai pada hari booking dibuat, bukan tanggal main | Konfirmasi aturan |

Untuk matriks keterlacakan: ID kebutuhan → endpoint utama (REQ-02 `GET /bookings/schedule`, REQ-04 `POST /bookings`,
REQ-05 `POST /bookings/admin`, REQ-10 `POST /payments/:id/proof` & `/verify`, REQ-11 job di `server.js`,
REQ-12 `POST /bookings/:id/cancel` & `/cancel-gor`, REQ-13 `POST /bookings/:id/reschedule`,
REQ-15 `POST /payments/:bookingId/settle`, REQ-16 `POST /members`, REQ-17/18 `/reports/*`,
REQ-20 `/management/*`, REQ-21 `GET /bookings/:id` (history)).
