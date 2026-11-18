-- Untuk database LAMA yang schema.sql-nya pernah dijalankan lebih dari sekali.
-- INSERT IGNORE tidak mencegah duplikat karena tabel tarif tidak punya unique key,
-- sehingga tarif tampil ganda. Backup database dulu, lalu jalankan SATU kali.
-- Database baru yang dibuat dari schema.sql terkini TIDAK perlu migrasi ini.
USE bookpoint;

DELETE t1 FROM tarif t1
JOIN tarif t2 ON t1.nama=t2.nama AND t1.id_tarif>t2.id_tarif;

ALTER TABLE tarif ADD CONSTRAINT uq_tarif_nama UNIQUE (nama);
