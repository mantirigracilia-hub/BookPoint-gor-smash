USE bookpoint;

ALTER TABLE riwayat_booking
  MODIFY dilakukan_oleh BIGINT NULL;

ALTER TABLE riwayat_pembayaran
  MODIFY dilakukan_oleh BIGINT NULL;

CREATE TEMPORARY TABLE dp_proofs_to_close AS
SELECT p.id_pembayaran,p.status
FROM pembayaran p
JOIN booking b ON b.id_booking=p.id_booking
WHERE p.jenis='dp' AND p.status='menunggu_verifikasi'
  AND (b.status_booking<>'menunggu_dp' OR EXISTS (
    SELECT 1 FROM pembayaran accepted
    WHERE accepted.id_booking=p.id_booking AND accepted.jenis='dp' AND accepted.status='diterima'
  ));

UPDATE pembayaran p
JOIN dp_proofs_to_close c ON c.id_pembayaran=p.id_pembayaran
SET p.status='ditolak',p.diverifikasi_oleh=NULL,p.waktu_bayar=NULL;

INSERT INTO riwayat_pembayaran(id_pembayaran,status_sebelum,status_sesudah,dilakukan_oleh)
SELECT id_pembayaran,status,'ditolak',NULL FROM dp_proofs_to_close;

DROP TEMPORARY TABLE dp_proofs_to_close;

-- Resolve any remaining active DP or reschedule duplicates before continuing.
SELECT id_booking,COUNT(*) jumlah FROM pembayaran
WHERE jenis='dp' AND status IN ('menunggu_verifikasi','diterima')
GROUP BY id_booking HAVING COUNT(*)>1;
SELECT id_booking,COUNT(*) jumlah FROM reschedule_booking GROUP BY id_booking HAVING COUNT(*)>1;

ALTER TABLE pembayaran
  ADD COLUMN id_booking_dp BIGINT GENERATED ALWAYS AS (
    CASE WHEN jenis='dp' AND status IN ('menunggu_verifikasi','diterima') THEN id_booking ELSE NULL END
  ) STORED,
  ADD UNIQUE KEY uq_active_dp_booking(id_booking_dp);

ALTER TABLE reschedule_booking
  ADD CONSTRAINT uq_reschedule_booking UNIQUE (id_booking);

UPDATE jam_operasional
SET jam_buka='07:00:00',jam_tutup='23:00:00'
WHERE jam_buka<>'07:00:00' OR jam_tutup<>'23:00:00';

ALTER TABLE jam_operasional
  ADD CONSTRAINT chk_jam_operasional_srs
    CHECK (hari BETWEEN 0 AND 6 AND jam_buka='07:00:00' AND jam_tutup='23:00:00');
