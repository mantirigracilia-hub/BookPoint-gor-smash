CREATE DATABASE IF NOT EXISTS bookpoint CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bookpoint;

CREATE TABLE IF NOT EXISTS pelanggan (
 id_pelanggan BIGINT AUTO_INCREMENT PRIMARY KEY,
 nama VARCHAR(120) NOT NULL,
 nomor_hp VARCHAR(20) NOT NULL UNIQUE,
 email VARCHAR(150) NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS akun_pengguna (
 id_akun BIGINT AUTO_INCREMENT PRIMARY KEY,
 id_pelanggan BIGINT NULL UNIQUE,
 username VARCHAR(80) NULL UNIQUE,
 kata_sandi_hash VARCHAR(255) NOT NULL,
 peran ENUM('customer','admin','owner') NOT NULL DEFAULT 'customer',
 aktif BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (id_pelanggan) REFERENCES pelanggan(id_pelanggan)
);
CREATE TABLE IF NOT EXISTS lapangan (
 id_lapangan BIGINT AUTO_INCREMENT PRIMARY KEY,
 nama VARCHAR(60) NOT NULL UNIQUE,
 aktif BOOLEAN DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS tarif (
 id_tarif BIGINT AUTO_INCREMENT PRIMARY KEY,
 nama VARCHAR(80) NOT NULL,
 harga_per_jam DECIMAL(12,2) NOT NULL,
 jam_mulai TIME NULL,
 jam_selesai TIME NULL,
 hari_akhir_pekan BOOLEAN DEFAULT FALSE,
 aktif BOOLEAN DEFAULT TRUE,
 UNIQUE KEY uq_tarif_nama(nama)
);
CREATE TABLE IF NOT EXISTS jam_operasional (
 id_jam BIGINT AUTO_INCREMENT PRIMARY KEY,
 hari TINYINT NOT NULL,
 jam_buka TIME NOT NULL DEFAULT '07:00:00',
 jam_tutup TIME NOT NULL DEFAULT '23:00:00',
 UNIQUE KEY uq_hari(hari)
);
CREATE TABLE IF NOT EXISTS keanggotaan (
 id_keanggotaan BIGINT AUTO_INCREMENT PRIMARY KEY,
 id_pelanggan BIGINT NOT NULL,
 mulai DATE NOT NULL,
 berakhir DATE NOT NULL,
 biaya DECIMAL(12,2) NOT NULL DEFAULT 150000,
 status ENUM('aktif','berakhir') DEFAULT 'aktif',
 FOREIGN KEY (id_pelanggan) REFERENCES pelanggan(id_pelanggan)
);
CREATE TABLE IF NOT EXISTS booking (
 id_booking BIGINT AUTO_INCREMENT PRIMARY KEY,
 kode_booking VARCHAR(30) NOT NULL UNIQUE,
 id_pelanggan BIGINT NOT NULL,
 dibuat_oleh BIGINT NOT NULL,
 status_booking ENUM('menunggu_dp','terkonfirmasi','lunas','dibatalkan') NOT NULL DEFAULT 'menunggu_dp',
 total_harga DECIMAL(12,2) NOT NULL,
 jumlah_dp DECIMAL(12,2) NOT NULL,
 batas_dp DATETIME NOT NULL,
 catatan TEXT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY (id_pelanggan) REFERENCES pelanggan(id_pelanggan),
 FOREIGN KEY (dibuat_oleh) REFERENCES akun_pengguna(id_akun),
 INDEX idx_booking_status(status_booking)
);
CREATE TABLE IF NOT EXISTS detail_booking (
 id_detail BIGINT AUTO_INCREMENT PRIMARY KEY,
 id_booking BIGINT NOT NULL,
 id_lapangan BIGINT NOT NULL,
 tanggal DATE NOT NULL,
 jam_mulai TIME NOT NULL,
 jam_selesai TIME NOT NULL,
 harga DECIMAL(12,2) NOT NULL,
 FOREIGN KEY (id_booking) REFERENCES booking(id_booking),
 FOREIGN KEY (id_lapangan) REFERENCES lapangan(id_lapangan),
 INDEX idx_slot(tanggal,id_lapangan,jam_mulai,jam_selesai)
);
CREATE TABLE IF NOT EXISTS reservasi_slot (
 id_lapangan BIGINT NOT NULL,
 tanggal DATE NOT NULL,
 jam_mulai TIME NOT NULL,
 id_booking BIGINT NOT NULL,
 PRIMARY KEY(id_lapangan,tanggal,jam_mulai),
 INDEX idx_reservasi_booking(id_booking),
 FOREIGN KEY (id_lapangan) REFERENCES lapangan(id_lapangan),
 FOREIGN KEY (id_booking) REFERENCES booking(id_booking)
);
CREATE TABLE IF NOT EXISTS pembayaran (
 id_pembayaran BIGINT AUTO_INCREMENT PRIMARY KEY,
 id_booking BIGINT NULL,
 id_keanggotaan BIGINT NULL,
 jenis ENUM('dp','pelunasan','membership') NOT NULL,
 metode ENUM('transfer','tunai') NOT NULL,
 nominal DECIMAL(12,2) NOT NULL,
 bukti_file VARCHAR(255) NULL,
 status ENUM('menunggu_verifikasi','diterima','ditolak') NOT NULL DEFAULT 'menunggu_verifikasi',
 diverifikasi_oleh BIGINT NULL,
 waktu_bayar DATETIME NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (id_booking) REFERENCES booking(id_booking),
 FOREIGN KEY (id_keanggotaan) REFERENCES keanggotaan(id_keanggotaan),
 FOREIGN KEY (diverifikasi_oleh) REFERENCES akun_pengguna(id_akun),
 CONSTRAINT chk_pembayaran_parent CHECK (
  (jenis='membership' AND id_booking IS NULL AND id_keanggotaan IS NOT NULL) OR
  (jenis IN ('dp','pelunasan') AND id_booking IS NOT NULL AND id_keanggotaan IS NULL)
 )
);
CREATE TABLE IF NOT EXISTS pembatalan_booking (
 id_pembatalan BIGINT AUTO_INCREMENT PRIMARY KEY,
 id_booking BIGINT NOT NULL,
 alasan TEXT NOT NULL,
 pembatal_oleh BIGINT NOT NULL,
 dp_hangus BOOLEAN DEFAULT FALSE,
 status_permohonan ENUM('menunggu_admin','disetujui','ditolak') NOT NULL DEFAULT 'disetujui',
 status_pengembalian ENUM('tidak_ada','menunggu','selesai') NOT NULL DEFAULT 'tidak_ada',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (id_booking) REFERENCES booking(id_booking),
 FOREIGN KEY (pembatal_oleh) REFERENCES akun_pengguna(id_akun)
);
CREATE TABLE IF NOT EXISTS pengembalian_dana (
 id_pengembalian BIGINT AUTO_INCREMENT PRIMARY KEY,
 id_pembatalan BIGINT NOT NULL UNIQUE,
 nominal DECIMAL(12,2) NOT NULL,
 metode ENUM('transfer','tunai') NOT NULL,
 diproses_oleh BIGINT NOT NULL,
 waktu_pengembalian DATETIME NOT NULL,
 FOREIGN KEY (id_pembatalan) REFERENCES pembatalan_booking(id_pembatalan),
 FOREIGN KEY (diproses_oleh) REFERENCES akun_pengguna(id_akun)
);
CREATE TABLE IF NOT EXISTS reschedule_booking (
 id_reschedule BIGINT AUTO_INCREMENT PRIMARY KEY,
 id_booking BIGINT NOT NULL,
 jadwal_lama TEXT NOT NULL,
 jadwal_baru TEXT NOT NULL,
 diubah_oleh BIGINT NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (id_booking) REFERENCES booking(id_booking),
 FOREIGN KEY (diubah_oleh) REFERENCES akun_pengguna(id_akun)
);
CREATE TABLE IF NOT EXISTS riwayat_booking (
 id_riwayat BIGINT AUTO_INCREMENT PRIMARY KEY,
 id_booking BIGINT NOT NULL,
 status_sebelum VARCHAR(40),
 status_sesudah VARCHAR(40),
 keterangan TEXT,
 dilakukan_oleh BIGINT NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (id_booking) REFERENCES booking(id_booking),
 FOREIGN KEY (dilakukan_oleh) REFERENCES akun_pengguna(id_akun)
);
CREATE TABLE IF NOT EXISTS riwayat_pembayaran (
 id_riwayat BIGINT AUTO_INCREMENT PRIMARY KEY,
 id_pembayaran BIGINT NOT NULL,
 status_sebelum VARCHAR(40),
 status_sesudah VARCHAR(40),
 nominal_diterima DECIMAL(12,2),
 dilakukan_oleh BIGINT NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (id_pembayaran) REFERENCES pembayaran(id_pembayaran),
 FOREIGN KEY (dilakukan_oleh) REFERENCES akun_pengguna(id_akun)
);

INSERT IGNORE INTO lapangan(nama) VALUES ('Lapangan 1'),('Lapangan 2'),('Lapangan 3'),('Lapangan 4');
INSERT IGNORE INTO tarif(nama,harga_per_jam,jam_mulai,jam_selesai,hari_akhir_pekan) VALUES
('Tarif Normal',60000,NULL,NULL,FALSE),('Tarif Prime Time',90000,'17:00','22:00',FALSE),('Tarif Weekend',90000,NULL,NULL,TRUE);
INSERT IGNORE INTO jam_operasional(hari) VALUES (0),(1),(2),(3),(4),(5),(6);
