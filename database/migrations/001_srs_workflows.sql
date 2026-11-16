USE bookpoint;

ALTER TABLE pembayaran
  MODIFY id_booking BIGINT NULL,
  ADD COLUMN id_keanggotaan BIGINT NULL AFTER id_booking,
  ADD CONSTRAINT fk_pembayaran_keanggotaan
    FOREIGN KEY (id_keanggotaan) REFERENCES keanggotaan(id_keanggotaan),
  ADD CONSTRAINT chk_pembayaran_parent CHECK (
    (jenis='membership' AND id_booking IS NULL AND id_keanggotaan IS NOT NULL) OR
    (jenis IN ('dp','pelunasan') AND id_booking IS NOT NULL AND id_keanggotaan IS NULL)
  );

ALTER TABLE pembatalan_booking
  ADD COLUMN status_permohonan ENUM('menunggu_admin','disetujui','ditolak')
    NOT NULL DEFAULT 'disetujui' AFTER dp_hangus,
  ADD COLUMN status_pengembalian ENUM('tidak_ada','menunggu','selesai')
    NOT NULL DEFAULT 'tidak_ada' AFTER dp_hangus;

CREATE TABLE pengembalian_dana (
  id_pengembalian BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_pembatalan BIGINT NOT NULL UNIQUE,
  nominal DECIMAL(12,2) NOT NULL,
  metode ENUM('transfer','tunai') NOT NULL,
  diproses_oleh BIGINT NOT NULL,
  waktu_pengembalian DATETIME NOT NULL,
  CONSTRAINT fk_refund_cancellation FOREIGN KEY (id_pembatalan)
    REFERENCES pembatalan_booking(id_pembatalan),
  CONSTRAINT fk_refund_actor FOREIGN KEY (diproses_oleh)
    REFERENCES akun_pengguna(id_akun)
);

CREATE TABLE reservasi_slot (
  id_lapangan BIGINT NOT NULL,
  tanggal DATE NOT NULL,
  jam_mulai TIME NOT NULL,
  id_booking BIGINT NOT NULL,
  PRIMARY KEY (id_lapangan, tanggal, jam_mulai),
  INDEX idx_reservasi_booking (id_booking),
  CONSTRAINT fk_reservasi_lapangan FOREIGN KEY (id_lapangan)
    REFERENCES lapangan(id_lapangan),
  CONSTRAINT fk_reservasi_booking FOREIGN KEY (id_booking)
    REFERENCES booking(id_booking)
);

INSERT INTO reservasi_slot (id_lapangan, tanggal, jam_mulai, id_booking)
SELECT d.id_lapangan, d.tanggal, MAKETIME(h.jam, 0, 0), d.id_booking
FROM detail_booking d
JOIN booking b ON b.id_booking=d.id_booking
JOIN (
  SELECT 7 AS jam UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10
  UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14
  UNION ALL SELECT 15 UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18
  UNION ALL SELECT 19 UNION ALL SELECT 20 UNION ALL SELECT 21 UNION ALL SELECT 22
) h ON d.jam_mulai<=MAKETIME(h.jam,0,0) AND d.jam_selesai>MAKETIME(h.jam,0,0)
WHERE b.status_booking IN ('menunggu_dp','terkonfirmasi','lunas');
