# QA Review Results – Stage 4: System Design

**Project:** BookPoint – GOR Smash  
**Acuan utama:** SRS BookPoint v2.0 (9 November 2026)  
**Status:** Revision in Progress  
**Metode:** Pemeriksaan statis file repository yang tersedia. Tidak dilakukan klaim pengujian runtime.

## 1. Architecture Review

| Review ID | Area | Review Criteria | Expected Result | Actual Result | Status | Evidence/Notes |
|---|---|---|---|---|---|---|
| AR-01 | Architecture Diagram | System Architecture Diagram tersedia. | Diagram menunjukkan frontend, backend/API, database, dan koneksi. | Not available for verification | Not Found | Tidak ditemukan file System Architecture Diagram. File Context Diagram dan DFD Level 1 tersedia, tetapi merupakan artefak analisis aliran data, bukan diagram arsitektur sistem. |
| AR-02 | Source File | Sumber diagram arsitektur tersedia. | File sumber dapat diedit dan menghasilkan diagram yang sama. | Not available for verification | Not Found | Tidak ditemukan source file khusus diagram arsitektur. |
| AR-03 | Technology Stack | Komponen teknologi dijelaskan pada dokumen arsitektur. | React + Vite, Node.js + Express, MySQL 8, REST API dipetakan pada komponen. | README root menyebut stack tersebut; dokumentasi arsitektur khusus tidak ditemukan. | Needs Revision | `README.md` pada root repository hanya menyebut stack, belum menggantikan dokumen arsitektur. |
| AR-04 | Hosting/Deployment | Lingkungan hosting dijelaskan. | Lingkungan development/production dan lokasi hosting dijelaskan. | Not available for verification | Not Found | Tidak ditemukan dokumen arsitektur/hosting yang memadai. |
| AR-05 | Authentication & Authorization | Desain menjelaskan autentikasi dan akses berbasis role. | Customer, Admin, Owner memiliki hak akses sesuai SRS; password di-hash. | SRS menyebut tiga role; desain arsitektur khusus untuk alur autentikasi/otorisasi tidak tersedia. | Pending Verification | Perlu diagram alur autentikasi, batas middleware/API, dan pemetaan izin tiap role. |
| AR-06 | Data Flow | Aliran data antarkomponen dijelaskan. | UI mengakses REST API dan API mengakses MySQL dengan alur yang dapat ditelusuri. | Context Diagram dan DFD Level 1 ditemukan, tetapi diagram arsitektur teknologi tidak ditemukan. | Needs Revision | File `diagrams_context_diagram (1).json` dan `diagrams_dfd_level_1 (1).json` berada di `docs/source-reference/`. |
| AR-07 | Security/HTTPS | HTTPS dan pembatasan akses role tercakup dalam desain. | Desain menjelaskan HTTPS serta kontrol akses. | Not available for verification | Pending Verification | Tidak ada bukti konfigurasi HTTPS atau deployment dalam artefak desain yang diperiksa. |

## 2. Database Review

| Review ID | Area | Review Criteria | Expected Result | Actual Result | Status | Evidence/Notes |
|---|---|---|---|---|---|---|
| DR-01 | ERD | ERD tersedia beserta source file. | ERD menunjukkan entitas, atribut, PK/FK, dan relasi. | File ERD UML Studio JSON ditemukan. | Pending Verification | `docs/source-reference/BookPoint_ERD_UMLStudio (1) (1).json`. Perlu render dan review visual terhadap SQL. |
| DR-02 | SQL Schema | SQL schema tersedia. | Schema dapat membentuk struktur database sesuai model. | File `database/schema.sql` ditemukan dengan tabel pelanggan, akun_pengguna, lapangan, tarif, jam_operasional, keanggotaan, booking, detail_booking, pembayaran, pembatalan_booking, reschedule_booking, dan riwayat. | Pending Verification | Pemeriksaan sintaks/eksekusi MySQL belum dilakukan. |
| DR-03 | ERD–SQL Consistency | ERD dan SQL konsisten. | Nama entitas, atribut, relasi, dan constraint konsisten. | Kedua artefak tersedia, tetapi konsistensi penuh belum diverifikasi. | Pending Verification | Perlu matriks perbandingan ERD vs SQL, khususnya atribut booking/pembayaran dan kardinalitas. |
| DR-04 | DBML/Mermaid | DBML dan Mermaid tersedia. | Kedua representasi database disertakan dan sinkron. | Not available for verification | Not Found | Tidak ditemukan file DBML atau Mermaid dalam archive. |
| DR-05 | Court/Hours | Empat lapangan dan jam operasional 07.00–23.00 terwakili. | Empat lapangan tersedia dan jam operasional sesuai SRS. | SQL melakukan seed Lapangan 1–4 dan default `jam_buka` 07:00 serta `jam_tutup` 23:00. | Pending Verification | Bukti seed ada; aturan perubahan master dan validasi runtime belum diuji. |
| DR-06 | Pricing | Tarif normal dan tarif khusus terwakili. | Rp60.000/jam normal; Rp90.000/jam pada 17.00–22.00 dan akhir pekan. | SQL memiliki seed tarif normal 60000, prime time 90000 (17:00–22:00), dan weekend 90000. | Pending Verification | Perlu menguji prioritas tarif ketika jam prime time bertepatan dengan akhir pekan. |
| DR-07 | Membership | Data membership dapat menyimpan periode dan biaya. | Iuran Rp150.000/bulan dan periode keanggotaan tercatat. | Tabel `keanggotaan` memiliki `mulai`, `berakhir`, `biaya` default 150000, dan `status`. | Pending Verification | Diskon member 10% merupakan aturan perhitungan yang perlu diverifikasi pada desain transaksi. |
| DR-08 | Multi-slot Booking | Satu booking dapat mencakup beberapa slot/lapangan/jam. | Satu booking memiliki banyak detail slot. | Tabel `detail_booking` memiliki FK `id_booking`, `id_lapangan`, tanggal, jam mulai, dan jam selesai. | Passed | Struktur relasi one-to-many dimungkinkan oleh FK detail ke booking. |
| DR-09 | DP Cardinality | Satu booking memiliki satu pembayaran DP dan satu bukti DP. | Database membatasi satu DP per booking. | Tabel `pembayaran` memiliki FK `id_booking`, `jenis` termasuk `dp`, dan `bukti_file`; tidak terlihat unique constraint untuk satu jenis DP per booking. | Needs Revision | Risiko kardinalitas terkonfirmasi dari definisi SQL; perlu aturan unik yang sesuai tanpa membatasi pembayaran pelunasan. |
| DR-10 | DP Deadline | DP 50% dan batas dua jam dapat disimpan. | Nominal DP dan batas waktu tersimpan; pembatalan otomatis dapat diproses. | `booking` memiliki `jumlah_dp`, `batas_dp`, dan status; formula 50% tidak dipaksakan oleh schema. | Pending Verification | Perlu review logika aplikasi dan uji batas waktu dua jam. |
| DR-11 | Double Booking | Bentrok slot dicegah termasuk request bersamaan. | Mekanisme atomik mencegah dua booking aktif pada lapangan dan rentang waktu yang sama. | `detail_booking` hanya memiliki index `idx_slot(tanggal,id_lapangan,jam_mulai,jam_selesai)`; index tersebut bukan constraint pencegah overlap. | Needs Revision | Ketiadaan constraint overlap pada schema terkonfirmasi. Implementasi locking/transaksi perlu diverifikasi; catatan implementasi sendiri menyebut perlunya proteksi concurrency yang lebih kuat. |
| DR-12 | Reschedule Limit | Reschedule dibatasi satu kali dan tersimpan. | Sistem dapat menolak reschedule kedua dan memeriksa batas >24 jam. | Tabel `reschedule_booking` menyimpan histori, tetapi tidak terlihat constraint pembatas satu kali. | Needs Revision | Perlu enforcement pada transaksi dan bukti pengujian. |
| DR-13 | Cancellation Rule | Pembatalan menyimpan alasan, pelaku, dan status DP hangus. | DP hangus jika pelanggan membatalkan kurang dari 24 jam sebelum jadwal. | Tabel `pembatalan_booking` memiliki alasan, pembatal_oleh, dan `dp_hangus`; rule waktu tidak tampak pada schema. | Pending Verification | Perlu review logika aplikasi; tidak disimpulkan gagal hanya dari schema. |
| DR-14 | Password Hash | Password tidak disimpan plaintext. | Password tersimpan sebagai hash. | Kolom `akun_pengguna.kata_sandi_hash VARCHAR(255)` tersedia. | Passed | Algoritma hash dan konfigurasi tetap perlu diperiksa di kode backend. |
| DR-15 | Payment Model | Relasi DP, pelunasan, membership, dan verifier sesuai kebutuhan. | Jenis pembayaran dapat dibedakan dan diverifikasi oleh admin. | `pembayaran.jenis` mencakup `dp`, `pelunasan`, `membership`; `diverifikasi_oleh` FK ke akun. `id_booking` tetap wajib untuk seluruh baris. | Needs Revision | Perlu dikaji apakah pembayaran membership yang tidak terkait booking dapat direpresentasikan dengan benar; jangan menetapkan model final sebelum konfirmasi analis. |

## 3. UI/UX Prototype Review

| Review ID | Area | Review Criteria | Expected Result | Actual Result | Status | Evidence/Notes |
|---|---|---|---|---|---|---|
| UR-01 | Prototype Availability | Interactive HTML prototype tersedia. | File prototype dapat dibuka untuk review. | File prototype HTML ditemukan. | Passed | `docs/source-reference/prototype_revisi (1).html`. Pemeriksaan ini memastikan file ada, bukan seluruh interaksi berfungsi. |
| UR-02 | Screen Coverage | Prototype memiliki SCR-01 sampai SCR-12. | Seluruh 12 layar dirancang. | Penanda SCR-01–SCR-12 ditemukan pada HTML. | Passed | HTML memuat login/register, jadwal, ringkasan booking, booking saya, detail, layar admin, dan layar owner. |
| UR-03 | Use Case Mapping | Dokumen Use Case to Screen Mapping tersedia. | Setiap Use Case dipetakan ke layar dan aksi pengguna. | Not available for verification | Not Found | Komentar HTML menyebut UC pada beberapa layar, tetapi dokumen mapping tersendiri tidak ditemukan. |
| UR-04 | UI Documentation | Dokumentasi UI/UX tersedia. | Tujuan, aktor, elemen, input/output, dan navigasi tiap layar dijelaskan. | Not available for verification | Not Found | Tidak ditemukan dokumen UI Mockup Documentation terpisah. |
| UR-05 | Login/Roles | Login mengarahkan pengguna sesuai role. | Customer, Admin, Owner masuk ke area yang sesuai dan tidak dapat mengakses role lain. | Prototype memiliki form login dan role routing/demo switch. | Pending Verification | Routing visual tersedia; integrasi API dan enforcement backend tidak dapat disimpulkan dari prototype. |
| UR-06 | Booking Flow | Pemilihan jadwal, ringkasan, dan booking mendukung multi-slot. | Satu booking dapat memuat beberapa slot/lapangan dan ringkasan biaya. | Layar jadwal, ringkasan booking, dan detail booking terlihat pada HTML. | Pending Verification | Perlu uji skenario multi-lapangan/jam dan perhitungan total. |
| UR-07 | DP/Payment | Unggah bukti DP dan status verifikasi tersedia. | Pelanggan mengunggah satu bukti DP; admin memverifikasi dan pelanggan melihat status. | Prototype memiliki elemen upload bukti DP dan layar tindakan verifikasi admin. | Pending Verification | Konsistensi nominal 50%, satu bukti per booking, dan batas dua jam belum diuji. |
| UR-08 | Cancellation | Pembatalan pelanggan menerapkan aturan <24 jam. | UI menyampaikan dampak pembatalan dan sistem menerapkan aturan DP. | Tombol/modal pembatalan ditemukan. | Pending Verification | Tampilan kontrol bukan bukti penerapan rule bisnis. |
| UR-09 | Reschedule | Reschedule hanya sekali dan >24 jam sebelum jadwal. | UI mengarahkan pemilihan slot baru dan menolak permintaan yang tidak memenuhi syarat. | Tombol/modal reschedule ditemukan; prototype menampilkan keterangan maksimal 1x. | Pending Verification | Validasi batas waktu dan percobaan kedua belum diuji. |
| UR-10 | Admin Screens | Admin dapat mengelola booking, pembayaran, dan member. | Alur Admin sesuai kebutuhan pada SRS. | SCR-07–SCR-10 tersedia dalam prototype. | Pending Verification | Perlu walkthrough use case dan validasi semua kondisi alternatif. |
| UR-11 | Owner Screens | Owner melihat laporan dan mengelola data master. | Laporan pendapatan/okupansi dan master data tersedia. | SCR-11 dan SCR-12 tersedia. | Pending Verification | Akurasi data laporan dan batas akses owner belum diuji. |
| UR-12 | UI Rules | Tampilan konsisten dengan empat lapangan, jam 07.00–23.00, tarif dan diskon. | UI menyajikan aturan SRS secara konsisten. | Matriks jadwal menyebut empat lapangan dan 16 jam operasional. | Pending Verification | Perlu pengujian tanggal, weekend, prime time, member, dan kombinasi tarif. |

## 4. Overall Review Notes

1. Artefak yang benar-benar ditemukan: SRS v2.0, Context Diagram JSON, DFD Level 1 JSON, ERD UML Studio JSON, SQL schema, Use Case Specification draft, dan prototype HTML.
2. Artefak wajib yang belum ditemukan pada archive: System Architecture Diagram beserta source/documentation, DBML, Mermaid Diagram, dokumen Use Case to Screen Mapping, dan UI Mockup Documentation.
3. Temuan pada struktur SQL bersifat hasil inspeksi file. Perilaku aplikasi, concurrency, keamanan, dan validasi business rules tetap memerlukan pengujian implementasi.
4. Stage 4 belum direkomendasikan untuk dinyatakan Passed sampai artefak Not Found dilengkapi dan temuan Needs Revision ditangani.
