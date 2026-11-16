# Catatan Implementasi dan Validasi

## Dokumen acuan
- SRS v2.0 menjadi acuan kebutuhan fungsional dan bisnis (REQ-01–REQ-21).
- Prototype revisi menjadi referensi UI, bukan bukti implementasi.
- Palet aktif mengikuti prototype awal: emerald, slate, dan font Inter. Sporto
  bukan acuan warna aktif; konten serta alur bisnisnya tidak diadopsi.
- ERD, Context Diagram, DFD, Use Case, transkrip, dan dokumen elisitasi
  disimpan di `docs/source-reference/` sebagai sumber asli.

## Cakupan yang diimplementasikan
- Autentikasi pelanggan, role admin/owner, dan kontrol akses endpoint.
- Dashboard admin merangkum booking hari ini, DP menunggu verifikasi, booking
  yang perlu pelunasan, serta akses cepat ke tugas operasional sesuai skenario
  Admin pada SRS.
- Jadwal publik/terautentikasi, jam operasional, empat lapangan, tarif per slot,
  membership, diskon, dan batas booking berdasarkan jenis akun.
- Booking beberapa slot dalam satu transaksi; reservasi slot unik mencegah
  bentrok; booking manual admin dan hold DP selama dua jam.
- Upload bukti pembayaran yang hanya dapat diakses melalui endpoint terautentikasi,
  verifikasi DP dengan validasi nominal terhadap tagihan, pencatatan pelunasan,
  dan pembayaran membership.
- Pembatalan pelanggan dan operasional, permohonan pembatalan tepat 24 jam
  untuk keputusan admin, refund yang dicatat untuk proses manual, dan reschedule
  satu kali dengan audit trail.
- Administrasi lapangan, tarif, jam, akun admin; laporan pendapatan/okupansi;
  tampilan detail booking beserta pembayaran dan riwayat.

## Keputusan kebijakan
- Pembatalan tepat 24 jam sebelum slot pertama diajukan ke admin. Admin dapat
  menyetujui (DP hangus atau pengembalian manual) atau menolak.
- Pembatalan lebih dari 24 jam melepas slot dan mencatat DP diterima sebagai
  refund manual; pengembalian baru dihitung selesai setelah dicatat admin.
- Laporan pendapatan menjumlah pembayaran yang diterima (DP, pelunasan, dan
  membership) serta mengurangi refund yang sudah diproses.

## Database dan akun
- Database baru: jalankan `database/schema.sql`.
- Database lama: backup terlebih dahulu, lalu jalankan
  `database/migrations/001_srs_workflows.sql` satu kali. Migrasi menambah relasi
  pembayaran membership dan refund, status permohonan, serta reservasi slot
  untuk booking aktif. Pastikan data booking lama tidak memiliki slot tumpang
  tindih sebelum backfill.
- Registrasi publik hanya menghasilkan akun customer. Owner pertama perlu
  diprovisioning sekali dengan `npm run provision-owner -w backend`; perintah
  memvalidasi konfigurasi, menyimpan password sebagai bcrypt, dan menolak
  membuat Owner kedua. Owner mengelola akun admin dari UI.
- Jangan menaruh `.env`, kredensial, atau bukti transfer di repositori atau
  menyajikan direktori upload secara publik.

## Hasil validasi saat ini
- `npm run build -w frontend`: berhasil.
- `npm run test -w backend`: 5 uji backend berhasil.
- `node --check` untuk modul `src`, `scripts`, dan `test` backend: berhasil.
- MySQL 8.4.9 lokal terhubung, schema berhasil dimuat, dan seed master berisi
  empat lapangan serta tiga tarif.
- Health check terhubung; login admin berhasil diuji melalui API dan browser
  hingga dashboard tampil.
- Pemeriksaan pencarian label `SCR-` pada frontend: tidak ada hasil.
- Acceptance flow untuk seluruh REQ-01–REQ-21 belum diuji end-to-end. Lima uji
  backend saat ini bukan pengganti pengujian booking, pembayaran, membership,
  pembatalan, refund, laporan, dan kontrol akses secara menyeluruh.

## Sebelum rilis
- Jalankan migration/schema dan uji acceptance flow REQ-01–REQ-21 terhadap
  MySQL 8, termasuk concurrency slot, batas waktu booking/pembatalan, pembayaran,
  refund, audit, serta akses per role. Database lokal yang disiapkan bukan
  pengganti database production.
- Verifikasi endpoint, CORS, dan semua halaman UI di lingkungan yang memiliki
  database. Port dev lokal 5173–5179 diizinkan hanya di mode non-produksi.
- Deploy di HTTPS dengan secret dan database production yang dikelola aman;
  siapkan scheduler permanen untuk cleanup booking kedaluwarsa, backup/restore,
  monitoring, dan uji performa pada lingkungan produksi.

Build yang berhasil dan tersedianya endpoint bukan pengganti acceptance test
atau bukti bahwa seluruh persyaratan non-fungsional produksi telah terpenuhi.
