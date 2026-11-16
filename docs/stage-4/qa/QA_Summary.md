# QA Summary – Stage 4: System Design

**Project:** BookPoint – GOR Smash  
**Team:** Tim 5 – System Analysis and Design  
**Reference:** SRS BookPoint v2.0, 9 November 2026  
**Overall Status:** **Revision in Progress**

## 1. Executive Summary

QA melakukan pemeriksaan statis terhadap artefak Stage 4 yang tersedia dalam repository archive. Fokus pemeriksaan adalah System Architecture Diagram, Database Schema, dan UI Mockup per Use Case, dengan SRS v2.0 sebagai acuan.

Beberapa artefak pendukung ditemukan: Context Diagram, DFD Level 1, ERD UML Studio JSON, SQL schema, Use Case Specification draft, dan prototype HTML dengan penanda SCR-01 sampai SCR-12. Namun, sejumlah deliverable wajib belum ditemukan sebagai dokumen tersendiri, khususnya System Architecture Diagram, DBML, Mermaid Diagram, Use Case to Screen Mapping, dan UI Mockup Documentation.

Pemeriksaan SQL juga mengidentifikasi kebutuhan revisi pada pembatasan satu pembayaran DP per booking, pencegahan overlap slot secara concurrency-safe, dan pembatasan reschedule satu kali. Pemeriksaan ini tidak membuktikan seluruh perilaku aplikasi gagal; pengujian runtime dan bukti implementasi masih diperlukan.

## 2. Scope of Review

| Deliverable | Artefak yang ditemukan | Fokus pemeriksaan |
|---|---|---|
| Architecture | Context Diagram JSON dan DFD Level 1 JSON; stack project pada README root | Komponen teknologi, hosting, autentikasi/otorisasi, HTTPS, dan aliran data UI/API/database |
| Database | ERD UML Studio JSON dan `database/schema.sql` | Entitas, relasi, kardinalitas, constraint pembayaran, jadwal, dan double booking |
| UI/UX | `prototype_revisi (1).html` dengan SCR-01–SCR-12; Use Case Specification draft | Kesesuaian layar, pemetaan Use Case, login, booking, DP, reschedule, pembatalan, Admin, dan Owner |

Pemeriksaan dilakukan terhadap file dalam archive yang tersedia. QA tidak menganggap prototype sebagai bukti implementasi backend dan tidak melakukan klaim lulus uji runtime.

## 3. Overall QA Status

| Area | Status | Ringkasan |
|---|---|---|
| Architecture | Needs Revision / Not Found | Diagram arsitektur khusus, source, dan dokumentasi arsitektur tidak ditemukan. Context Diagram dan DFD tersedia sebagai artefak analisis. |
| Database | Needs Revision | ERD dan SQL tersedia. DBML/Mermaid tidak ditemukan; terdapat risiko pada constraint satu DP, overlap slot, dan batas reschedule. |
| UI/UX | Needs Revision / Pending Verification | Prototype 12 layar tersedia; dokumen mapping dan dokumentasi UI tersendiri tidak ditemukan. Aturan bisnis dan integrasi role masih perlu diuji. |
| **Overall** | **Revision in Progress** | Belum memenuhi kriteria penerimaan Stage 4. |

## 4. Summary of Findings

| Kategori | Jumlah | Catatan |
|---|---:|---|
| Confirmed findings | 9 | Kekurangan/risiko yang dapat dibuktikan dari keberadaan atau struktur file yang diperiksa. |
| Pending verification | 4 | Hal yang memerlukan konfirmasi analis, pemeriksaan kode lebih lanjut, atau pengujian runtime. |

Temuan utama:

- **Architecture:** diagram arsitektur sistem dan dokumentasi arsitektur belum ditemukan.
- **Database:** SQL belum menunjukkan constraint satu DP per booking; index slot bukan mekanisme pencegah rentang overlap; pembatasan satu reschedule belum tampak pada schema.
- **Database deliverables:** DBML dan Mermaid belum ditemukan.
- **UI/UX:** prototype SCR-01–SCR-12 ditemukan, tetapi matriks Use Case to Screen dan dokumentasi UI/UX tersendiri belum ditemukan.
- **Verification:** penerapan aturan DP, tarif, membership, pembatalan, reschedule, HTTPS, dan akses role memerlukan bukti tambahan.

Rincian setiap temuan, severity, rekomendasi, dan penanggung jawab tercantum dalam `Revision_Findings.md`.

## 5. Required Revisions

1. **Architecture:** buat System Architecture Diagram yang memetakan React/Vite, Node.js/Express REST API, MySQL 8, aliran data, hosting, autentikasi, role authorization, dan HTTPS. Sertakan source file serta dokumentasi.
2. **Database:** lengkapi DBML dan Mermaid; sinkronkan ERD dengan SQL; rancang pembatasan satu DP per booking; dan buat mekanisme atomik pencegahan double booking pada request bersamaan.
3. **Database business rules:** tunjukkan enforcement DP 50% dan batas dua jam, pembatalan otomatis, pembatalan kurang dari 24 jam, diskon member 10%, serta reschedule satu kali lebih dari 24 jam sebelum jadwal.
4. **UI/UX:** buat Use Case to Screen Mapping formal dan UI Mockup Documentation untuk SCR-01–SCR-12.
5. **Traceability:** tautkan setiap kebutuhan SRS yang relevan ke desain arsitektur, entitas/atribut database, Use Case, dan layar UI.
6. **Evidence:** lakukan review ulang dan walkthrough; lampirkan screenshot, hasil uji, versi file, dan keputusan untuk setiap temuan.

## 6. Conclusion

Berdasarkan bukti yang tersedia, deliverable Stage 4 **belum dapat dinyatakan Passed**. Prototype UI dan beberapa artefak database/analisis telah tersedia, tetapi kelengkapan dokumen arsitektur dan dokumentasi UI masih perlu dipenuhi. Desain database juga memerlukan penajaman constraint untuk menjaga konsistensi pembayaran dan mencegah double booking.

Status **Revision in Progress** dipertahankan sampai seluruh artefak wajib tersedia, temuan prioritas tinggi ditangani, dan hasil verifikasi ulang didokumentasikan. Kesimpulan ini terbatas pada repository archive yang diperiksa; apabila branch GitHub terbaru memiliki file tambahan, file tersebut perlu diperiksa sebelum baseline QA final.

## 7. Next Steps

| Urutan | Tindakan | Penanggung Jawab Utama | Output/Bukti |
|---:|---|---|---|
| 1 | Konfirmasi versi branch/repository dan kumpulkan deliverable Stage 4 terbaru. | Project Manager | Daftar artefak dan versi yang disepakati |
| 2 | Lengkapi diagram dan dokumentasi arsitektur. | System Designer, Backend Developer | Diagram, source, architecture notes |
| 3 | Revisi model database dan hasilkan DBML/Mermaid. | Backend Developer, System Analyst | ERD/SQL/DBML/Mermaid sinkron |
| 4 | Lengkapi pemetaan Use Case ke SCR dan dokumentasi UI. | System Designer, System Analyst | Mapping matrix dan UI documentation |
| 5 | Jalankan review ulang berdasarkan checklist. | QA / Documentation | Checklist dan review results terbaru |
| 6 | Tutup temuan dengan bukti, lalu minta persetujuan Stage 4. | Seluruh tim; koordinasi Project Manager | Revision log dan QA sign-off |
