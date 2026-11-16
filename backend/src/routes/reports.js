import {Router} from 'express';
import {pool} from '../db.js';
import {auth,allow} from '../middleware/auth.js';

const r=Router();
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(`${value}T00:00:00Z`));

r.get('/revenue',auth,allow('admin','owner'),async(req,res)=>{
 try{
  const period=req.query.period||'day';
  let start,end,cutoff;
  if(period==='day'){
   start=req.query.date;
   if(!validDate(start)) return res.status(400).json({message:'Tanggal wajib berformat YYYY-MM-DD.'});
   end=start;
   cutoff='DATE_ADD(?,INTERVAL 1 DAY)';
  }else if(period==='month'){
   const month=String(req.query.month||'');
   if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return res.status(400).json({message:'Bulan wajib berformat YYYY-MM.'});
   start=`${month}-01`;
   end=month;
   cutoff='DATE_ADD(?,INTERVAL 1 MONTH)';
  }else return res.status(400).json({message:'Pilih periode day atau month.'});
  const [rows]=await pool.query(`SELECT DATE(transaksi_waktu) tanggal,jenis,
   COUNT(*) transaksi,SUM(nominal) pendapatan FROM (
    SELECT waktu_bayar transaksi_waktu,jenis,nominal FROM pembayaran
    WHERE status='diterima' AND waktu_bayar>=? AND waktu_bayar<${cutoff}
    UNION ALL
    SELECT waktu_pengembalian transaksi_waktu,'pengembalian' jenis,-nominal FROM pengembalian_dana
    WHERE waktu_pengembalian>=? AND waktu_pengembalian<${cutoff}
   ) arus GROUP BY DATE(transaksi_waktu),jenis ORDER BY tanggal`,[start,start,start,start]);
  const summary={deposit:0,settlement:0,membership:0,refund:0,total:0};
  for(const row of rows){
   const key=row.jenis==='dp'?'deposit':row.jenis==='pelunasan'?'settlement':row.jenis==='pengembalian'?'refund':'membership';
   summary[key]+=Number(row.pendapatan||0);
   summary.total+=Number(row.pendapatan||0);
  }
  res.json({period,start,end,summary,series:rows});
 }catch(e){res.status(500).json({message:'Gagal memuat laporan pendapatan.',detail:e.message});}
});

r.get('/occupancy',auth,allow('admin','owner'),async(req,res)=>{
 try{
  const start=req.query.start,end=req.query.end;
  if(!validDate(start)||!validDate(end)||start>end) return res.status(400).json({message:'Rentang tanggal tidak valid.'});
  const [[span]]=await pool.query('SELECT DATEDIFF(?,?) AS days',[end,start]);
  if(Number(span.days)>89) return res.status(400).json({message:'Rentang laporan maksimal 90 hari.'});
  const [slots]=await pool.query(`WITH RECURSIVE calendar(tanggal) AS (
    SELECT CAST(? AS DATE) UNION ALL SELECT tanggal + INTERVAL 1 DAY FROM calendar WHERE tanggal < CAST(? AS DATE)
   ), hours(jam) AS (
     SELECT 0 UNION ALL SELECT jam + 1 FROM hours WHERE jam < 22
   )
   SELECT DATE_FORMAT(c.tanggal,'%Y-%m-%d') tanggal,h.jam,
    COUNT(l.id_lapangan) total_slot,
    SUM(CASE WHEN b.id_booking IS NULL THEN 0 ELSE 1 END) terisi
   FROM calendar c
   JOIN jam_operasional o ON o.hari=DAYOFWEEK(c.tanggal)-1
   JOIN hours h ON h.jam>=HOUR(o.jam_buka) AND h.jam+1<=HOUR(o.jam_tutup)
   CROSS JOIN lapangan l
   LEFT JOIN reservasi_slot s ON s.id_lapangan=l.id_lapangan AND s.tanggal=c.tanggal AND s.jam_mulai=MAKETIME(h.jam,0,0)
   LEFT JOIN booking b ON b.id_booking=s.id_booking AND b.status_booking IN ('menunggu_dp','terkonfirmasi','lunas')
   WHERE l.aktif=1
   GROUP BY c.tanggal,h.jam ORDER BY c.tanggal,h.jam`,[start,end]);
  const hourly=new Map(),daily=new Map();
  for(const slot of slots){
   const date=slot.tanggal,hour=Number(slot.jam),total=Number(slot.total_slot),occupied=Number(slot.terisi);
   const day=daily.get(date)||{date,total_slots:0,occupied_slots:0};
   day.total_slots+=total;day.occupied_slots+=occupied;daily.set(date,day);
   const block=hourly.get(hour)||{hour,total_slots:0,occupied_slots:0};
   block.total_slots+=total;block.occupied_slots+=occupied;hourly.set(hour,block);
  }
  const withRate=row=>({...row,occupancy_percent:row.total_slots?Number((row.occupied_slots/row.total_slots*100).toFixed(1)):0});
  res.json({start,end,byHour:[...hourly.values()].map(withRate),byDate:[...daily.values()].map(withRate)});
 }catch(e){res.status(500).json({message:'Gagal memuat laporan okupansi.',detail:e.message});}
});

export default r;
