# Dokumentasi UI BookPoint

**Baseline:** SRS BookPoint v2.0. ID SCR mengikuti prototype
`docs/source-reference/prototype_revisi (1).html`; UI React saat ini memakai
halaman dan modal, sehingga satu halaman dapat mengimplementasikan lebih dari
satu SCR. Untuk keterlacakan aktor/REQ/API, lihat
[`Use_Case_to_Screen_Mapping.md`](./Use_Case_to_Screen_Mapping.md).

| SCR | Tujuan dan aktor | Input/aksi | Output dan feedback | Validasi / kondisi alternatif | Implementasi |
|---|---|---|---|---|---|
| SCR-01 Login | Autentikasi Pelanggan, Admin, Owner | Identitas (nomor HP atau username) dan password | Sesi sesuai role; pesan gagal bila kredensial salah | Form wajib; server mengecek hash dan status akun aktif | `login` |
| SCR-02 Registrasi | Membuat akun pelanggan | Nama, nomor HP, password | Sesi pelanggan setelah pendaftaran berhasil | Nomor HP unik; password minimal 8 karakter; akun operasional tidak dapat dibuat publik | `login` |
| SCR-03 Jadwal | Menampilkan ketersediaan bagi publik/Pelanggan/Admin | Tanggal; pelanggan/admin memilih slot kosong | 4 lapangan × jam 07.00–23.00, status slot, tarif, pilihan member | Slot lewat/terisi/menunggu DP nonaktif; batas H+3/H+14 divalidasi server | `public-schedule`, `schedule` |
| SCR-04 Ringkasan booking | Memeriksa total dan DP sebelum booking/reschedule | Konfirmasi atau kembali mengubah pilihan | Slot, total sewa, DP 50%, status proses | Minimal satu slot; ketersediaan dan harga dicek ulang server-side | Modal konfirmasi |
| SCR-05 Booking saya | Melihat daftar/status booking Pelanggan | Buka detail, unggah bukti, batalkan, atau mulai reschedule | Total, DP, sisa, tenggat hitung mundur, status refund | Bukti hanya untuk booking menunggu DP sebelum batas; status kosong/loading/error | `bookings` |
| SCR-06 Detail & nota | Meninjau detail, pembayaran, audit dan mencetak nota | Buka modal detail; cetak/simpan | Jadwal per slot, total diterima, sisa, aktor dan keterangan audit | Pelanggan hanya melihat data sendiri; bukti tidak dimasukkan ke nota | Modal detail/nota |
| SCR-07 Booking Admin | Membuat booking telepon/WhatsApp oleh Admin | Cari/isi pelanggan, pilih transfer atau DP tunai, pilih slot | Kode booking, total, status, audit | Nomor HP divalidasi; pelanggan yang sudah ada tidak ditimpa namanya; slot dicek atomik | `new-booking` |
| SCR-08 Konsol booking Admin | Menemukan dan menangani booking | Cari kode/nama/HP; buka detail; pilih pembatalan GOR | Status, pembayaran, sisa tagihan dan aksi yang diizinkan | Role Admin; alasan wajib untuk pembatalan GOR | `dashboard`, `bookings` |
| SCR-09 Verifikasi/kasir | Admin mengonfirmasi DP atau melunasi tunai | Lihat bukti, catat nominal aktual; masukkan uang pelunasan | Status berubah dan riwayat tercatat | DP harus diverifikasi sebelum batas; pelunasan harus menutup saldo positif | `verification`, aksi pada `bookings` |
| SCR-10 Kelola member | Admin mencatat/perpanjang periode membership | Nama/nomor HP pelanggan | Iuran Rp150.000, periode 30 hari, status aktif/akan datang/berakhir | Nomor HP unik; perpanjangan dimulai setelah periode berjalan/terjadwal | `members` |
| SCR-11 Laporan | Owner memantau pendapatan dan okupansi | Pilih tanggal/bulan atau rentang maksimal 90 hari | Ringkasan dan seri harian/bulanan, slot per jam/tanggal | Hanya Owner; tanggal kalender dan rentang divalidasi; data kosong diberi state kosong | `reports` |
| SCR-12 Data master | Owner mengelola lapangan dan akun Admin; melihat tarif/jam SRS | Ubah nama/aktifkan lapangan; tambah/nonaktifkan Admin; buka tab tarif/jam | Daftar master dan konfirmasi perubahan | Maksimal empat lapangan; tarif/jam tetap sesuai SRS; username unik | `master` |

## Navigasi dan responsivitas

- Navigasi menyesuaikan role. Pada layar kecil, sidebar menjadi bar navigasi
  horizontal yang dapat digulir; tabel dibungkus container horizontal agar tidak
  merusak lebar layar.
- Form, panel, kartu, modal, dan metrik memakai layout responsif. Fokus keyboard
  dan pesan feedback menggunakan elemen semantik dasar.
- Tindakan yang mengubah status menggunakan validasi server sebagai otoritas;
  menonaktifkan tombol pada UI hanya merupakan bantuan UX, bukan kontrol akses.
- Catatan ini memetakan kode saat ini. Walkthrough visual lintas perangkat dan
  pengukuran NFR tetap harus dilakukan sebelum QA menyatakan Passed.
