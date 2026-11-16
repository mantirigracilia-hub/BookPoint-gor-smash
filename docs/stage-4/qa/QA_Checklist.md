# QA Checklist – Stage 4: System Design

**Project:** BookPoint – GOR Smash  
**Baseline:** SRS BookPoint v2.0 (9 November 2026)  
**Review status:** Revision in Progress  
**Review basis:** Repository archive `BookPoint-gor-smash.zip` yang tersedia untuk pemeriksaan. Checklist ini menilai artefak desain, bukan hasil uji runtime.

## 1. Tujuan QA

Memeriksa kelengkapan, konsistensi, dan keterlacakan tiga deliverable Stage 4 terhadap SRS v2.0: System Architecture Diagram, Database Schema, dan UI Mockup per Use Case. QA mengidentifikasi bukti yang tersedia, kekurangan artefak, serta hal yang masih memerlukan konfirmasi dari pemilik deliverable.

## 2. Ruang Lingkup

- **Architecture:** diagram arsitektur sistem, sumber diagram, dokumentasi teknologi/hosting, autentikasi, otorisasi, dan aliran data.
- **Database:** ERD, SQL schema, relasi, constraint, aturan pembayaran, serta pencegahan double booking.
- **UI/UX:** prototype 12 layar SCR-01–SCR-12, pemetaan Use Case ke layar, dan alur login, booking, pembayaran, reschedule, pembatalan, admin, serta owner.
- **Di luar ruang lingkup:** pengujian penetrasi, load test, validasi deployment produksi, dan pengujian runtime menyeluruh. Hal-hal tersebut perlu direncanakan pada tahap pengujian implementasi.

## 3. Status Pemeriksaan

| Status | Arti |
|---|---|
| Passed | Bukti artefak yang diperiksa memenuhi kriteria. |
| Failed | Bukti yang diperiksa bertentangan dengan kriteria. |
| Needs Revision | Artefak tersedia, tetapi terdapat kekurangan/risiko yang perlu direvisi. |
| Not Found | Artefak yang dibutuhkan tidak ditemukan dalam repository yang diperiksa. |
| Pending Verification | Belum dapat dipastikan dari pemeriksaan statis; perlu bukti tambahan atau pengujian. |
| Not Applicable | Kriteria tidak berlaku untuk artefak/ruang lingkup tersebut. |

## 4. Checklist Architecture

| ID | Kriteria Pemeriksaan | Sumber Acuan | Status | Catatan |
|---|---|---|---|---|
| ARC-01 | Tersedia System Architecture Diagram yang menunjukkan frontend, backend/API, database, dan hubungan antarkomponen. | SRS v2.0 §1.2; stack project | Not Found | Yang ditemukan adalah Context Diagram dan DFD Level 1; keduanya bukan diagram arsitektur deployment/komponen. |
| ARC-02 | File sumber diagram arsitektur tersedia dan dapat diedit. | Deliverable Architecture | Not Found | Tidak ditemukan source file khusus System Architecture Diagram. |
| ARC-03 | Dokumentasi arsitektur menjelaskan React + Vite, Node.js + Express, MySQL 8, dan REST API. | Project Context; README project | Pending Verification | Stack tertulis di README root, tetapi dokumen arsitektur khusus tidak ditemukan. |
| ARC-04 | Diagram/dokumentasi menjelaskan lingkungan hosting dan batas antara development dan production. | SRS v2.0; kebutuhan deployment | Not Found | Tidak ditemukan uraian hosting/deployment pada artefak arsitektur yang tersedia. |
| ARC-05 | Mekanisme login, password hashing, dan role Customer/Admin/Owner dijelaskan pada desain. | SRS v2.0 REQ-01 dan NFR keamanan | Pending Verification | SRS dan source implementasi menyebut role/hash, tetapi bukti desain arsitektur khusus tidak tersedia. |
| ARC-06 | Aliran data UI → REST API → database dan respons API digambarkan. | SRS v2.0; REST API project context | Not Found | Context Diagram/DFD tersedia, tetapi diagram arsitektur yang menunjukkan komponen teknologi dan aliran API tidak ditemukan. |
| ARC-07 | Desain menjelaskan HTTPS dan pembatasan akses berdasarkan role. | SRS v2.0 NFR keamanan | Pending Verification | Belum ada bukti konfigurasi/deployment HTTPS atau desain kontrol akses end-to-end dalam dokumen arsitektur. |
| ARC-08 | Diagram konsisten dengan aktor Customer, Admin, dan Owner serta proses utama BookPoint. | SRS v2.0 §1.3 dan kebutuhan fungsional | Pending Verification | Context Diagram/DFD ditemukan; pemetaan lengkap ke komponen arsitektur belum dapat diperiksa. |

## 5. Checklist Database

| ID | Kriteria Pemeriksaan | Sumber Acuan | Status | Catatan |
|---|---|---|---|---|
| DB-01 | ERD dan file sumber ERD tersedia. | Deliverable Database; SRS v2.0 | Pending Verification | File JSON ERD UML Studio ditemukan di `docs/source-reference/`; belum ada bukti render final/versi yang disetujui. |
| DB-02 | SQL Database Schema tersedia dan konsisten dengan ERD. | `database/schema.sql`; ERD JSON | Needs Revision | Keduanya tersedia, tetapi konsistensi seluruh atribut/relasi perlu direkonsiliasi. Contoh: ERD dan SQL perlu dibandingkan pada atribut booking dan pembayaran. |
| DB-03 | Struktur mendukung empat lapangan dan jam operasional 07.00–23.00. | SRS v2.0; BR terkait jadwal | Pending Verification | SQL memiliki tabel `lapangan`, seed empat lapangan, dan `jam_operasional` default 07.00–23.00; validasi data dan aturan runtime belum dilakukan. |
| DB-04 | Struktur tarif mendukung Rp60.000/jam normal dan Rp90.000/jam prime time 17.00–22.00/akhir pekan. | SRS v2.0; business rules | Pending Verification | Seed tarif terlihat pada SQL; ketepatan pemilihan tarif lintas rentang jam/hari perlu diuji. |
| DB-05 | Struktur membership mendukung biaya Rp150.000/bulan dan diskon 10%. | SRS v2.0; business rules | Pending Verification | Tabel `keanggotaan` menyimpan biaya/periode; diskon merupakan aturan perhitungan yang perlu ditelusuri pada desain dan transaksi. |
| DB-06 | Satu booking dapat berisi beberapa lapangan dan jam. | SRS v2.0 definisi Booking | Passed | Relasi `booking` ke `detail_booking` memungkinkan beberapa detail untuk satu booking. |
| DB-07 | Satu booking dibatasi memiliki satu pembayaran DP dan satu bukti transaksi DP. | SRS v2.0; business rules | Needs Revision | Tabel `pembayaran` tidak menunjukkan unique constraint yang membatasi satu pembayaran jenis DP per booking. Perlu penegasan aturan satu bukti DP. |
| DB-08 | DP 50%, batas waktu dua jam, dan status kedaluwarsa dapat direpresentasikan. | SRS v2.0; business rules | Pending Verification | `jumlah_dp`, `batas_dp`, dan status booking tersedia; formula 50% dan pembatalan otomatis perlu dibuktikan melalui constraint/logika transaksi. |
| DB-09 | Pembatalan menyimpan pelaku, alasan, dan status DP hangus sesuai aturan waktu. | SRS v2.0; business rules | Pending Verification | Tabel `pembatalan_booking` memiliki alasan, pelaku, dan `dp_hangus`; aturan kurang dari 24 jam belum dibuktikan pada schema. |
| DB-10 | Reschedule dapat dilacak dan dibatasi satu kali per booking. | SRS v2.0; business rules | Needs Revision | Tabel `reschedule_booking` tersedia, tetapi schema tidak memiliki constraint/jumlah yang secara eksplisit membatasi satu kali reschedule. |
| DB-11 | Database mencegah slot bentrok termasuk permintaan bersamaan. | SRS v2.0 REQ-21 | Needs Revision | `idx_slot` hanya index biasa, bukan constraint pencegah rentang waktu overlap. Perlu desain transaksi/locking atau mekanisme constraint yang aman terhadap concurrency. |
| DB-12 | Password disimpan sebagai hash, bukan plaintext. | SRS v2.0 NFR keamanan | Passed | Kolom bernama `kata_sandi_hash` bertipe `VARCHAR(255)` tersedia; algoritma dan konfigurasi hash tetap perlu diverifikasi di implementasi. |
| DB-13 | Relasi pembayaran, booking, pelanggan, admin verifier, dan riwayat memiliki FK yang sesuai. | SRS v2.0; SQL schema | Pending Verification | Foreign key utama tersedia; perlu validasi aturan kardinalitas dan skenario pembayaran membership. |
| DB-14 | DBML dan Mermaid Diagram tersedia sebagai deliverable. | Deliverable Database README/brief | Not Found | Tidak ditemukan file DBML atau Mermaid pada repository archive yang diperiksa. |

## 6. Checklist UI/UX

| ID | Kriteria Pemeriksaan | Sumber Acuan | Status | Catatan |
|---|---|---|---|---|
| UI-01 | Prototype interaktif HTML tersedia. | Deliverable UI/UX | Passed | `prototype_revisi (1).html` ditemukan di `docs/source-reference/`. |
| UI-02 | Prototype mencakup layar SCR-01 sampai SCR-12. | SRS v2.0; UI deliverable brief | Passed | Penanda SCR-01–SCR-12 ditemukan pada HTML, termasuk login/register, jadwal, booking, admin, owner. |
| UI-03 | Dokumen Use Case to Screen Mapping tersedia sebagai artefak tersendiri. | Deliverable UI/UX | Not Found | Beberapa komentar HTML menyebut UC dan SCR, tetapi dokumen pemetaan tersendiri tidak ditemukan. |
| UI-04 | Dokumentasi UI/UX menjelaskan tujuan, aktor, input, output, dan navigasi setiap layar. | Deliverable UI/UX | Not Found | File dokumentasi UI/UX khusus tidak ditemukan. |
| UI-05 | Alur login dan routing sesuai role Customer/Admin/Owner. | SRS v2.0 REQ-01 | Pending Verification | UI memiliki form login dan role routing; perilaku autentikasi nyata perlu diverifikasi terhadap API dan hak akses backend. |
| UI-06 | Alur booking memungkinkan satu booking berisi beberapa lapangan/jam dan menampilkan ringkasan biaya. | SRS v2.0 definisi Booking; REQ terkait | Pending Verification | Prototype memiliki matriks jadwal dan layar ringkasan; skenario multi-slot dan kalkulasi tarif perlu diuji. |
| UI-07 | UI menampilkan DP 50%, batas pembayaran dua jam, dan status verifikasi. | SRS v2.0; business rules | Pending Verification | Elemen unggah bukti DP dan verifikasi terlihat; konsistensi nominal/timer/status belum diuji. |
| UI-08 | UI mendukung pembatalan dengan aturan DP hangus jika pelanggan membatalkan kurang dari 24 jam. | SRS v2.0; business rules | Pending Verification | Tombol/modal pembatalan terlihat; penerapan aturan waktu dan dampak DP belum diverifikasi. |
| UI-09 | UI mendukung reschedule satu kali jika lebih dari 24 jam sebelum jadwal. | SRS v2.0; business rules | Pending Verification | Kontrol reschedule dan modal tersedia; pembatasan satu kali dan batas waktu perlu diuji. |
| UI-10 | UI Admin mendukung booking atas nama pelanggan, verifikasi DP, pelunasan, dan pengelolaan member. | SRS v2.0 aktor Admin | Pending Verification | Layar SCR-07–SCR-10 ditemukan; kelengkapan alur dan kesesuaian aturan perlu diuji. |
| UI-11 | UI Owner menyediakan laporan pendapatan/okupansi dan pengelolaan data master. | SRS v2.0 aktor Pemilik | Pending Verification | Layar SCR-11–SCR-12 ditemukan; data, perhitungan, dan otorisasi belum diverifikasi. |
| UI-12 | UI konsisten dengan empat lapangan dan jam operasional 07.00–23.00. | SRS v2.0; business rules | Pending Verification | Prototype menampilkan matriks empat lapangan dan 16 jam operasional; validasi seluruh skenario tanggal/jam belum dilakukan. |
| UI-13 | UI memberikan feedback validasi/error dan mencegah tindakan yang tidak diizinkan. | SRS v2.0 NFR usability/security | Pending Verification | Elemen toast/modal terlihat; seluruh kondisi error dan kontrol role perlu diuji. |

## 7. Kriteria Penerimaan

Stage 4 dapat diajukan untuk persetujuan QA apabila:

1. Diagram arsitektur, file sumber, dan dokumentasi arsitektur tersedia serta menjelaskan komponen teknologi, hosting, autentikasi/otorisasi, HTTPS, dan aliran data.
2. ERD, SQL, DBML, dan Mermaid tersedia serta konsisten pada entitas, atribut, relasi, kardinalitas, dan constraint.
3. Desain database secara eksplisit mendukung satu DP per booking, batas DP dua jam, reschedule maksimal satu kali, pembatalan sesuai batas 24 jam, dan pencegahan double booking termasuk concurrency.
4. Prototype 12 layar memiliki dokumen pemetaan Use Case ke layar dan dokumentasi UI yang dapat ditelusuri ke SRS.
5. Seluruh temuan Critical/High ditutup atau memiliki keputusan revisi yang disetujui; item Pending Verification memiliki bukti pemeriksaan.
6. Tidak ada status Not Found pada artefak wajib sebelum baseline Stage 4 disetujui.

## 8. Catatan Baseline dan Batas Pemeriksaan

Pada repository archive yang diperiksa, folder `docs/stage-4/qa/` beserta README yang disebutkan dalam instruksi tidak ditemukan. Dokumen QA ini dibuat pada path tersebut. Folder `docs/source-reference/` berisi Context Diagram, DFD Level 1, ERD JSON, SRS, Use Case Specification draft, dan prototype HTML. Keberadaan Context Diagram/DFD tidak dianggap sebagai bukti bahwa System Architecture Diagram sudah tersedia.

Pemeriksaan dilakukan secara statis terhadap file yang tersedia. Status Pending Verification bukan pernyataan bahwa fitur telah lulus; status tersebut berarti bukti belum cukup untuk memutuskan.
