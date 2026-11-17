# Use Case to Screen Mapping

**Acuan:** SRS BookPoint v2.0 dan 13 UC pada
[`Use_Case_Specification_BookPoint_DRAFT.docx`](../source-reference/Use_Case_Specification_BookPoint_DRAFT.docx).
ID SCR merujuk ke prototype yang disimpan di `docs/source-reference`; implementasi
React mengelompokkan beberapa SCR ke dalam satu halaman/modal dan tidak memakai
ID SCR sebagai route.

| Use Case | Aktor | SCR / halaman React | REQ / BR | API dan data utama |
|---|---|---|---|---|
| UC01 Login/Register | Pelanggan, Admin, Owner | SCR-01 Login; SCR-02 Registrasi / `login` | REQ-01; BR-12 | `/api/auth/login`, `/api/auth/register`; `akun_pengguna`, `pelanggan` |
| UC02 Lihat Jadwal | Publik, Pelanggan, Admin | SCR-03 / `public-schedule`, `schedule` | REQ-02, REQ-03; BR-01, BR-11 | `/api/bookings/schedule`; `lapangan`, `detail_booking`, `booking`, `reservasi_slot` |
| UC03 Booking Mandiri | Pelanggan | SCR-03 + SCR-04 / `schedule` + modal konfirmasi | REQ-03, REQ-04, REQ-06–REQ-09, REQ-11; BR-01–BR-04, BR-08–BR-11 | `POST /api/bookings`; `booking`, `detail_booking`, `reservasi_slot`, `riwayat_booking` |
| UC04 Unggah Bukti DP | Pelanggan | SCR-05/SCR-06 / `bookings` + input bukti | REQ-09, REQ-10; BR-03, BR-04 | `POST /api/payments/:bookingId/proof`; `pembayaran`, `riwayat_pembayaran` |
| UC05 Batal/Reschedule | Pelanggan | SCR-05/SCR-06 + SCR-03 / `bookings`, `schedule`, modal konfirmasi | REQ-12, REQ-13; BR-05, BR-06 | `POST /api/bookings/:id/cancel`, `/reschedule`; `pembatalan_booking`, `reschedule_booking`, `reservasi_slot`, `riwayat_booking` |
| UC06 Lihat Riwayat Booking | Pelanggan | SCR-05/SCR-06 / `bookings` + modal detail/nota | REQ-19; BR-04, BR-10 | `GET /api/bookings/mine`, `GET /api/bookings/:id`; `booking`, `detail_booking`, `pembayaran`, `riwayat_booking` |
| UC07 Booking via Admin | Admin | SCR-07 + SCR-03/SCR-04 / `new-booking` + modal konfirmasi | REQ-03, REQ-05–REQ-09, REQ-11; BR-01–BR-04, BR-08–BR-12 | `POST /api/bookings/admin`, `GET /api/bookings/customer`; booking dan pelanggan |
| UC08 Verifikasi DP | Admin | SCR-08/SCR-09 / `verification` + modal bukti | REQ-10, REQ-11; BR-03, BR-04, BR-11 | `GET /api/payments/pending`, `GET /api/payments/:id/proof`, `POST /api/payments/:id/verify` |
| UC09 Catat Pelunasan | Admin | SCR-08/SCR-09 / `bookings` + input tunai | REQ-14, REQ-15; BR-07 | `POST /api/payments/:bookingId/settle`; `pembayaran`, `riwayat_pembayaran`, `riwayat_booking` |
| UC10 Kelola Member | Admin | SCR-10 / `members` | REQ-16; BR-08 | `GET/POST /api/members`; `keanggotaan`, `pembayaran`, `riwayat_pembayaran` |
| UC11 Batalkan Booking (GOR) | Admin | SCR-08/SCR-09 / `bookings` + konfirmasi/alasan | REQ-12 | `POST /api/bookings/:id/cancel-gor`; `pembatalan_booking`, `reservasi_slot`, `riwayat_booking` |
| UC12 Lihat Laporan | Owner | SCR-11 / `reports` | REQ-17, REQ-18 | `GET /api/reports/revenue`, `/occupancy`; `pembayaran`, `pengembalian_dana`, reservasi aktif |
| UC13 Kelola Data Master | Owner | SCR-12 / `master` (tab lapangan, tarif, jam, admin) | REQ-20; BR-01, BR-02 | `/api/management/*`; `lapangan`, `tarif`, `jam_operasional`, `akun_pengguna` |

## Alur otomatis dan kebutuhan lintas layar

- **REQ-11:** scheduler API membatalkan booking DP yang melewati dua jam,
  melepas reservasi, menolak bukti yang masih menunggu, dan menulis aktor
  `Sistem`. Alur ini tidak memerlukan layar terpisah; status terlihat di SCR-05,
  SCR-06, dan SCR-08.
- **REQ-21:** pembuatan/perubahan booking, verifikasi, pembatalan, reschedule,
  pelunasan, dan refund tercatat pada riwayat. Pelanggan/Admin/Owner melihat
  riwayat sesuai izin melalui detail SCR-06/SCR-09.
- Status empty/error/loading ditampilkan pada halaman terkait; kegagalan API
  disampaikan melalui komponen feedback. Bukti transfer hanya tersedia melalui
  endpoint terautentikasi.
- Payment gateway otomatis, WhatsApp otomatis, sewa raket, dan kantin tidak
  termasuk alur aplikasi.

UC source masih bertanda **DRAFT BACKUP**; tabel ini adalah pemetaan implementasi,
bukan persetujuan analis atas dokumen use case sumber.
