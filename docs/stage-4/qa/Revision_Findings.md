# Revision Findings – Stage 4: System Design

**Project:** BookPoint – GOR Smash  
**Status dokumen:** Revision in Progress  
**Prinsip pencatatan:** Temuan dibedakan menjadi *Confirmed* (terlihat langsung pada file yang diperiksa) dan *Pending Verification* (belum cukup bukti untuk menyatakan ketidaksesuaian).

## 1. Findings and Recommendations

| Finding ID | Related Deliverable | Description | Severity (Critical, High, Medium, Low) | Recommendation | Responsible Role | Status |
|---|---|---|---|---|---|---|
| F-ARC-01 | System Architecture | **Confirmed:** System Architecture Diagram khusus tidak ditemukan pada repository archive. Context Diagram dan DFD Level 1 tersedia, tetapi bukan pengganti diagram arsitektur komponen/deployment. | High | Buat diagram yang memperlihatkan React/Vite, REST API Node/Express, MySQL 8, hubungan request/response, batas kepercayaan, dan lingkungan hosting. Sertakan source file dan dokumentasi. | System Designer / Frontend Developer; Project Manager untuk integrasi | Open – Confirmed |
| F-ARC-02 | Architecture Documentation | **Confirmed:** Dokumen arsitektur yang menjelaskan hosting, HTTPS, autentikasi, otorisasi role, dan aliran data antarkomponen tidak ditemukan sebagai deliverable khusus. | High | Tambahkan dokumentasi arsitektur yang menautkan komponen dengan REQ/NFR terkait; jangan menyatakan HTTPS/hosting telah diterapkan tanpa bukti konfigurasi. | System Designer; Backend Developer | Open – Confirmed |
| F-DB-01 | Database Schema | **Confirmed:** Tabel `pembayaran` tidak memiliki unique constraint yang membatasi satu pembayaran jenis `dp` per booking. | High | Rancang pembatasan satu DP per booking tanpa menghalangi pembayaran pelunasan. Pastikan satu bukti DP terkait dengan pembayaran DP tersebut. | Backend Developer; System Analyst untuk validasi aturan | Open – Confirmed |
| F-DB-02 | Database Schema | **Confirmed:** Index `idx_slot` pada detail booking bukan constraint yang mencegah rentang waktu overlap. | Critical | Rancang pencegahan double booking yang aman untuk permintaan bersamaan, misalnya transaksi dan locking/reservasi slot yang atomik serta constraint yang sesuai. Uji dua request bersamaan untuk slot yang sama dan slot dengan rentang overlap. | Backend Developer; System Analyst | Open – Confirmed |
| F-DB-03 | Database Schema | **Confirmed:** Schema tidak memiliki constraint yang secara eksplisit membatasi satu reschedule per booking. | Medium | Tambahkan enforcement yang konsisten pada model data/transaksi agar reschedule kedua ditolak; uji juga syarat lebih dari 24 jam sebelum jadwal. | Backend Developer; System Analyst | Open – Confirmed |
| F-DB-04 | Database Deliverables | **Confirmed:** File DBML dan Mermaid Diagram tidak ditemukan. | Medium | Hasilkan DBML dan Mermaid dari model database yang sama, lalu lakukan sinkronisasi terhadap ERD dan SQL schema. | System Designer / Database Designer; Backend Developer | Open – Confirmed |
| F-DB-05 | Database Schema | **Pending Verification:** `pembayaran.id_booking` wajib diisi meskipun `jenis` mencakup `membership`. Belum dapat dipastikan apakah transaksi membership memang harus dikaitkan ke booking atau model saat ini tidak dapat merepresentasikan pembayaran membership mandiri. | Medium | Konfirmasikan aturan bisnis kepada System Analyst. Jika pembayaran membership berdiri sendiri, revisi relasi/model agar dapat disimpan tanpa booking dan tetap menjaga integritas referensial. | System Analyst; Backend Developer | Pending Verification |
| F-DB-06 | Database Schema | **Pending Verification:** Formula DP 50%, batas dua jam, pembatalan otomatis, diskon member 10%, dan aturan DP hangus kurang dari 24 jam tidak dipaksakan oleh schema saja. | High | Tunjukkan aturan pada desain logika/transaksi dan sediakan test evidence untuk nilai batas serta kondisi gagal. Jangan menambah kebijakan di luar SRS. | Backend Developer; QA / Documentation; System Analyst | Pending Verification |
| F-UI-01 | UI/UX Prototype | **Confirmed:** Dokumen Use Case to Screen Mapping tersendiri tidak ditemukan. Komentar HTML mengandung beberapa referensi UC/SCR, tetapi belum menjadi matriks keterlacakan formal. | Medium | Buat tabel seluruh Use Case → SCR → aktor → aksi utama/alternatif → REQ terkait. Pastikan tidak ada Use Case tanpa layar atau penjelasan alasan. | System Designer / Frontend Developer; System Analyst | Open – Confirmed |
| F-UI-02 | UI/UX Prototype | **Confirmed:** UI Mockup Documentation tersendiri tidak ditemukan. | Medium | Dokumentasikan tujuan, aktor, komponen, input/output, navigasi, validasi, empty/error state, dan keterkaitan tiap SCR-01–SCR-12. | System Designer / Frontend Developer | Open – Confirmed |
| F-UI-03 | UI/UX Prototype | **Pending Verification:** Prototype menampilkan kontrol booking, pembayaran, pembatalan, reschedule, member, laporan, dan master data, tetapi tampilan tidak membuktikan semua business rule berfungsi. | High | Lakukan walkthrough per Use Case dan uji kondisi batas: DP dua jam, pembatalan kurang dari 24 jam, reschedule satu kali dan lebih dari 24 jam, diskon member, tarif weekend/prime time, serta role access. Lampirkan hasil dan screenshot. | QA / Documentation bersama System Designer dan Backend Developer | Pending Verification |
| F-UI-04 | UI/UX Prototype | **Pending Verification:** Kelengkapan seluruh layar terhadap seluruh Use Case dan REQ belum dapat dipastikan hanya dari penanda SCR pada HTML. | Medium | Lengkapi matriks keterlacakan SRS → Use Case → layar, kemudian review bersama System Analyst. | System Analyst; System Designer; QA / Documentation | Pending Verification |
| F-QA-01 | QA Documentation | **Confirmed:** Pada repository archive yang diperiksa, folder `docs/stage-4/qa/` dan README yang disebut dalam instruksi tidak ditemukan. | Low | Tambahkan README QA pada folder Stage 4 dan tautkan empat dokumen QA. Jika folder sudah ada pada branch/repository terbaru, lakukan merge tanpa menimpa dokumen tim. | Project Manager; QA / Documentation | Open – Confirmed |

## 2. Severity Guidance

- **Critical:** Berpotensi menyebabkan kegagalan kebutuhan inti atau integritas transaksi, seperti double booking pada slot yang sama.
- **High:** Berpengaruh besar pada keamanan, konsistensi pembayaran, atau pemenuhan kebutuhan utama.
- **Medium:** Kekurangan artefak/desain yang menghambat keterlacakan, validasi, atau pemeliharaan.
- **Low:** Kekurangan dokumentasi administratif yang tidak langsung mengubah perilaku sistem.

## 3. Recommended Revision Order

1. Lengkapi System Architecture Diagram, source file, dan dokumentasi arsitektur.
2. Perbaiki desain database untuk pencegahan double booking concurrency dan satu DP per booking.
3. Tetapkan enforcement reschedule satu kali dan konfirmasi model pembayaran membership.
4. Lengkapi DBML dan Mermaid, lalu sinkronkan dengan ERD dan SQL.
5. Lengkapi Use Case to Screen Mapping serta UI Mockup Documentation.
6. Jalankan walkthrough QA terhadap seluruh alur dan aturan bisnis; simpan bukti dan perbarui status temuan.

## 4. Change Control

Setiap revisi sebaiknya mencantumkan penanggung jawab, tanggal, versi artefak, ringkasan perubahan, dan bukti review ulang. Status temuan hanya boleh diubah menjadi Closed setelah artefak revisi diperiksa dan kriteria penerimaan terpenuhi. Temuan Pending Verification tidak boleh dianggap sebagai bug terkonfirmasi sebelum bukti pengujian tersedia.
