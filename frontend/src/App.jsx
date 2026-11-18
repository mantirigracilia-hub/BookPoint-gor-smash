import React,{useCallback,useEffect,useMemo,useState} from 'react';
import axios from 'axios';

const API=import.meta.env.VITE_API_URL?.trim()||(import.meta.env.DEV?`${window.location.protocol}//${window.location.hostname}:5000/api`:'/api');
const api=axios.create({baseURL:API});
api.interceptors.request.use(config=>{
 const token=localStorage.getItem('bp_token');
 if(token) config.headers.Authorization=`Bearer ${token}`;
 return config;
});
// Token kedaluwarsa (12 jam) atau akun dinonaktifkan: keluarkan sesi agar UI tidak terjebak sebagai "login" palsu.
api.interceptors.response.use(response=>response,error=>{
 const url=String(error.config?.url||'');
 if(error.response?.status===401&&localStorage.getItem('bp_token')&&!url.startsWith('/auth/')){
  localStorage.removeItem('bp_token');
  localStorage.removeItem('bp_user');
  window.dispatchEvent(new Event('bp:unauthorized'));
 }
 return Promise.reject(error);
});

const money=value=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(value||0));
const today=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
const readableDate=value=>value?new Date(`${String(value).slice(0,10)}T00:00:00`).toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):'';
const roleName={customer:'Pelanggan',admin:'Admin',owner:'Pemilik'};
const statusName={menunggu_dp:'Menunggu DP',terkonfirmasi:'Terkonfirmasi',lunas:'Lunas',dibatalkan:'Dibatalkan',menunggu_verifikasi:'Menunggu verifikasi',diterima:'Diterima',ditolak:'Ditolak',aktif:'Aktif',akan_datang:'Akan datang',berakhir:'Berakhir'};

function getStoredUser(){
 try{return JSON.parse(localStorage.getItem('bp_user')||'null');}
 catch{return null;}
}

function App(){
 const [user,setUser]=useState(getStoredUser);
 const [page,setPage]=useState(()=>{
  const stored=getStoredUser();
  return !stored?'home':stored.role==='admin'?'dashboard':stored.role==='owner'?'reports':'schedule';
 });
 const [authMode,setAuthMode]=useState('login');
 const [authForm,setAuthForm]=useState({nama:'',identifier:'',password:''});
 const [date,setDate]=useState(today);
 const [schedule,setSchedule]=useState(null);
 const [selected,setSelected]=useState([]);
 const [bookings,setBookings]=useState([]);
 const [bookingsLoaded,setBookingsLoaded]=useState(false);
 const [todayBookings,setTodayBookings]=useState([]);
 const [pending,setPending]=useState([]);
 const [adminDataLoaded,setAdminDataLoaded]=useState(false);
 const [members,setMembers]=useState([]);
 const [refunds,setRefunds]=useState([]);
 const [cancelRequests,setCancelRequests]=useState([]);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const [rescheduleTarget,setRescheduleTarget]=useState(null);
 const [manual,setManual]=useState({nama:'',nomor_hp:'',customerId:'',depositMethod:'transfer'});
 const [phoneSearch,setPhoneSearch]=useState('');
 const [report,setReport]=useState(null);
 const [occupancy,setOccupancy]=useState(null);
 const [reportPeriod,setReportPeriod]=useState('day');
 const [reportDate,setReportDate]=useState(today);
 const [reportMonth,setReportMonth]=useState(today().slice(0,7));
 const [occupancyRange,setOccupancyRange]=useState({start:today(),end:today()});
 const [master,setMaster]=useState({courts:[],rates:[],hours:[],admins:[]});
 const [masterLoaded,setMasterLoaded]=useState(false);
 const [masterTab,setMasterTab]=useState('courts');
 const [rateForm,setRateForm]=useState({normal:60000,peak:90000,weekend:90000});
 const [hourForm,setHourForm]=useState([]);
 const [newCourt,setNewCourt]=useState('');
 const [newAdmin,setNewAdmin]=useState({username:'',password:''});
 const [verifyAmounts,setVerifyAmounts]=useState({});
 const [settlementInputs,setSettlementInputs]=useState({});
 const [proof,setProof]=useState(null);
 const [bookingDetail,setBookingDetail]=useState(null);
 const [confirmBooking,setConfirmBooking]=useState(false);
 const [transferInfo,setTransferInfo]=useState(null);

 const run=useCallback(async action=>{
  setError('');
  setNotice('');
  setBusy(true);
  try{return await action();}
  catch(e){setError(e.response?.data?.message||e.response?.data?.detail||e.message||'Terjadi kesalahan.');return null;}
  finally{setBusy(false);}
 },[]);

 const loadSchedule=useCallback(async()=>{
  const {data}=await api.get('/bookings/schedule',{params:{date}});
  setSchedule(data);
 },[date,user?.id]); // user?.id: muat ulang saat login/logout agar harga & status member sesuai akun

 const loadBookings=useCallback(async()=>{
  if(!user)return;
  const {data}=user.role==='customer'?await api.get('/bookings/mine'):await api.get('/bookings');
  setBookings(data);
  setBookingsLoaded(true);
 },[user]);

 const loadAdminData=useCallback(async()=>{
  if(user?.role!=='admin')return;
  const [payments,memberRows,refundRows,requestRows,dayBookings]=await Promise.all([
   api.get('/payments/pending'),api.get('/members'),api.get('/payments/refunds'),api.get('/bookings/cancel-requests'),api.get('/bookings',{params:{date:today()}})
  ]);
  setPending(payments.data);
  setMembers(memberRows.data);
  setRefunds(refundRows.data);
  setCancelRequests(requestRows.data);
  setTodayBookings(dayBookings.data);
  setAdminDataLoaded(true);
 },[user]);

 const loadMaster=useCallback(async()=>{
  if(user?.role!=='owner')return;
  const [courts,rates,hours,admins]=await Promise.all([
   api.get('/management/courts'),api.get('/management/rates'),api.get('/management/hours'),api.get('/management/admins')
  ]);
  setMaster({courts:courts.data,rates:rates.data,hours:hours.data,admins:admins.data});
  setMasterLoaded(true);
  const getRate=predicate=>rates.data.find(predicate)?.harga_per_jam||0;
  setRateForm({normal:Number(getRate(row=>row.nama==='Tarif Normal')),peak:Number(getRate(row=>row.jam_mulai)),weekend:Number(getRate(row=>row.hari_akhir_pekan))});
  setHourForm(hours.data.map(row=>({...row,jam_buka:String(row.jam_buka).slice(0,5),jam_tutup:String(row.jam_tutup).slice(0,5)})));
 },[user]);

 useEffect(()=>{
  run(async()=>{await loadSchedule();});
 },[date,loadSchedule,run]);

 useEffect(()=>{
  if(!user)return;
  run(async()=>{
   if(user.role!=='owner')await loadBookings();
   if(user.role==='admin')await loadAdminData();
   if(user.role==='owner')await loadMaster();
  });
 },[user,loadBookings,loadAdminData,loadMaster,run]);

 useEffect(()=>{
  if(user?.role!=='customer'){setTransferInfo(null);return;}
  api.get('/payments/instructions').then(({data})=>setTransferInfo(data)).catch(()=>setTransferInfo(null));
 },[user]);

 useEffect(()=>{
  if(user?.role!=='owner'||page!=='booking-history')return;
  run(async()=>{await loadBookings();});
 },[user,page,loadBookings,run]);

 useEffect(()=>()=>{if(proof?.url)URL.revokeObjectURL(proof.url);},[proof]);

 useEffect(()=>{
  const handleUnauthorized=()=>{
   setUser(null);setPage('login');setAuthMode('login');setSchedule(null);setSelected([]);
   setBookings([]);setBookingsLoaded(false);setAdminDataLoaded(false);setMasterLoaded(false);
  };
  window.addEventListener('bp:unauthorized',handleUnauthorized);
  return ()=>window.removeEventListener('bp:unauthorized',handleUnauthorized);
 },[]);

 const selectedTotal=useMemo(()=>selected.reduce((sum,slot)=>sum+Number(slot.price||0),0),[selected]);
 const selectedDeposit=Math.ceil(selectedTotal/2);
 const canChoose=user?.role==='customer'||(user?.role==='admin'&&page==='new-booking');

 function logout(){
  localStorage.removeItem('bp_token');
  localStorage.removeItem('bp_user');
  setUser(null);
  setPage('home');
  setSchedule(null);
  setSelected([]);
  setBookings([]);
  setBookingsLoaded(false);
  setAdminDataLoaded(false);
  setMasterLoaded(false);
  setError('');
  setNotice('');
 }

 async function submitAuth(event){
  event.preventDefault();
  const result=await run(async()=>{
   const credentials=authMode==='login'
    ?{identifier:authForm.identifier.trim(),password:authForm.password}
    :{nama:authForm.nama,nomor_hp:authForm.identifier.trim(),password:authForm.password};
   const {data}=await api.post(`/auth/${authMode}`,credentials);
   localStorage.setItem('bp_token',data.token);
   localStorage.setItem('bp_user',JSON.stringify(data.user));
   setUser(data.user);
   setPage(data.user.role==='admin'?'dashboard':data.user.role==='owner'?'reports':'schedule');
   setAuthForm({nama:'',identifier:'',password:''});
   setNotice(`Berhasil masuk sebagai ${roleName[data.user.role]||data.user.role}.`);
  });
  return result;
 }

 async function refreshAll(){
  await run(async()=>{
   await loadSchedule();
   if(user?.role!=='owner'||page==='booking-history')await loadBookings();
   if(user?.role==='admin')await loadAdminData();
   if(user?.role==='owner')await loadMaster();
  });
 }

 function toggleSlot(slot){
  if(!canChoose||slot.status!=='kosong')return;
  setSelected(current=>{
   const exists=current.some(item=>item.courtId===slot.courtId&&item.hour===slot.hour&&item.date===date);
   return exists?current.filter(item=>!(item.courtId===slot.courtId&&item.hour===slot.hour&&item.date===date)):[...current,{courtId:slot.courtId,hour:slot.hour,date,price:slot.price,court:slot.court}];
  });
 }

 async function createBooking(){
  const items=selected.map(({courtId,hour,date:slotDate})=>({courtId,hour,date:slotDate}));
  const result=await run(async()=>{
   if(rescheduleTarget){
    const {data}=await api.post(`/bookings/${rescheduleTarget.id_booking}/reschedule`,{items});
    setNotice(`${data.message} Total sewa ${money(data.total)}; sudah dibayar ${money(data.paid)}; sisa tagihan ${money(data.balanceDue)}.`);
    setRescheduleTarget(null);
    setPage('bookings');
   }else if(user?.role==='admin'){
    const {data}=await api.post('/bookings/admin',{...manual,items});
    setNotice(`Booking ${data.code} berhasil dibuat; status ${statusName[data.status]}.`);
    setManual({nama:'',nomor_hp:'',customerId:'',depositMethod:'transfer'});
   }else{
    const {data}=await api.post('/bookings',{items});
    setNotice(`Booking ${data.code} berhasil dibuat. Total ${money(data.total)}; DP ${money(data.dp)} harus dibayar dalam 2 jam.`);
    setPage('bookings');
   }
   setSelected([]);
   setConfirmBooking(false);
   await loadSchedule();
   await loadBookings();
  });
  return result;
 }

 async function cancelBooking(booking){
  const reason=window.prompt('Alasan pembatalan (opsional):','Pembatalan oleh pelanggan');
  if(reason===null)return;
  const result=await run(async()=>{
   const {data}=await api.post(`/bookings/${booking.id_booking}/cancel`,{alasan:reason});
   setNotice(data.message);
   await loadBookings();
   await loadSchedule();
  });
  return result;
 }

 async function startReschedule(booking){
  setRescheduleTarget(booking);
  setSelected([]);
  setPage('schedule');
 }

 async function uploadProof(bookingId,file){
  if(!file)return;
  const result=await run(async()=>{
   const form=new FormData();
   form.append('proof',file);
   await api.post(`/payments/${bookingId}/proof`,form);
   setNotice('Bukti pembayaran berhasil dikirim dan menunggu verifikasi admin.');
   await loadBookings();
   await loadAdminData();
  });
  return result;
 }

 async function lookupCustomer(){
  const phone=phoneSearch.trim();
  if(!phone){setError('Masukkan nomor HP pelanggan.');return;}
  const result=await run(async()=>{
   const {data}=await api.get('/bookings/customer',{params:{phone}});
   setManual(current=>({...current,nomor_hp:phone,nama:data?.nama||'',customerId:data?.id_pelanggan||''}));
   setNotice(data?'Pelanggan ditemukan.':'Nomor belum terdaftar; isi nama untuk membuat data pelanggan saat booking.');
  });
  return result;
 }

 async function verifyDeposit(payment,accepted){
  const amount=Number(verifyAmounts[payment.id_pembayaran]??payment.nominal);
  if(accepted&&amount!==Number(payment.nominal)){
   setError(`Nominal yang diterima harus sama dengan tagihan ${money(payment.nominal)}. Tolak bukti jika pelanggan perlu mengunggah ulang.`);
   return null;
  }
  const result=await run(async()=>{
   const {data}=await api.post(`/payments/${payment.id_pembayaran}/verify`,{accepted,nominalDiterima:amount});
   setNotice(data.message);
   await loadAdminData();
   await loadBookings();
   await loadSchedule();
  });
  return result;
 }

 async function openProof(payment){
  const result=await run(async()=>{
   const {data}=await api.get(`/payments/${payment.id_pembayaran}/proof`,{responseType:'blob'});
   if(proof?.url)URL.revokeObjectURL(proof.url);
   setProof({url:URL.createObjectURL(data),name:payment.nama||payment.kode_booking});
  });
  return result;
 }

 async function openBookingDetail(booking){
  const result=await run(async()=>{
   const {data}=await api.get(`/bookings/${booking.id_booking}`);
   setBookingDetail(data);
  });
  return result;
 }

 async function settleBooking(booking){
  const rawTender=settlementInputs[booking.id_booking];
  const tender=Number(rawTender);
  if(rawTender===undefined||String(rawTender).trim()===''||!Number.isFinite(tender)||tender<0){setError('Masukkan nominal uang yang diterima.');return;}
  const result=await run(async()=>{
   const {data}=await api.post(`/payments/${booking.id_booking}/settle`,{nominal:tender});
   setNotice(`${data.message} Kembalian ${money(data.change)}.`);
   await loadBookings();
   await loadAdminData();
  });
  return result;
 }

 async function createMember(event){
  event.preventDefault();
  const formElement=event.currentTarget;
  const form=new FormData(formElement);
  const result=await run(async()=>{
   const {data}=await api.post('/members',{nama:form.get('nama'),nomor_hp:form.get('nomor_hp')});
   setNotice(data.message);
   formElement.reset();
   await loadAdminData();
  });
  return result;
 }

 async function cancelByGor(booking){
  const reason=window.prompt('Alasan pembatalan operasional wajib diisi:');
  if(!reason?.trim())return;
  if(!window.confirm('Konfirmasi pembatalan oleh GOR? Slot akan dilepas dan DP tidak otomatis hangus.'))return;
  const result=await run(async()=>{
   const {data}=await api.post(`/bookings/${booking.id_booking}/cancel-gor`,{alasan:reason.trim()});
   setNotice(data.message);
   await loadBookings();
   await loadAdminData();
   await loadSchedule();
  });
  return result;
 }

 async function processRefund(refund){
  const input=window.prompt(`Nominal pengembalian (maksimal ${money(refund.nominal_refund)}):`,String(refund.nominal_refund));
  if(input===null)return;
  const nominal=Number(input);
  if(!input.trim()||!Number.isFinite(nominal)||nominal<=0){setError('Nominal pengembalian tidak valid.');return;}
  const result=await run(async()=>{
   const {data}=await api.post(`/payments/refunds/${refund.id_pembatalan}/complete`,{nominal,metode:'transfer'});
   setNotice(data.message);
   await loadAdminData();
  });
  return result;
 }

 async function reviewCancellation(request,approved,dpHangus=false){
  const result=await run(async()=>{
   const {data}=await api.post(`/bookings/cancel-requests/${request.id_pembatalan}/review`,{approved,dpHangus});
   setNotice(data.message);
   await loadAdminData();
   await loadBookings();
   await loadSchedule();
  });
  return result;
 }

 async function loadRevenue(){
  const params=reportPeriod==='day'?{period:'day',date:reportDate}:{period:'month',month:reportMonth};
  const result=await run(async()=>{const {data}=await api.get('/reports/revenue',{params});setReport(data);});
  return result;
 }

 async function loadOccupancy(){
  const result=await run(async()=>{const {data}=await api.get('/reports/occupancy',{params:occupancyRange});setOccupancy(data);});
  return result;
 }

 async function loadMasterData(){
  const result=await run(loadMaster);
  return result;
 }

 async function addCourt(event){
  event.preventDefault();
  const result=await run(async()=>{
   await api.post('/management/courts',{nama:newCourt});
   setNewCourt('');
   setNotice('Lapangan ditambahkan.');
   await loadMaster();
   await loadSchedule();
  });
  return result;
 }

 async function saveRates(event){
  event.preventDefault();
  const result=await run(async()=>{
   await api.put('/management/rates',rateForm);
   setNotice('Tarif baru berhasil disimpan.');
   await loadMaster();
   await loadSchedule();
  });
  return result;
 }

 async function saveHours(event){
  event.preventDefault();
  const result=await run(async()=>{
   await api.put('/management/hours',{hours:hourForm});
   setNotice('Jam operasional berhasil disimpan.');
   await loadMaster();
   await loadSchedule();
  });
  return result;
 }

 async function toggleCourt(court){
  const result=await run(async()=>{
   await api.put(`/management/courts/${court.id_lapangan}`,{nama:court.nama,aktif:!court.aktif});
   setNotice('Status lapangan diperbarui.');
   await loadMaster();
   await loadSchedule();
  });
  return result;
 }

 async function renameCourt(court){
  const name=window.prompt('Nama lapangan:',court.nama);
  if(name===null||!name.trim()||name.trim()===court.nama)return;
  const result=await run(async()=>{
   await api.put(`/management/courts/${court.id_lapangan}`,{nama:name.trim(),aktif:Boolean(court.aktif)});
   setNotice('Nama lapangan diperbarui.');
   await loadMaster();
   await loadSchedule();
  });
  return result;
 }

 async function addAdmin(event){
  event.preventDefault();
  const result=await run(async()=>{
   await api.post('/management/admins',newAdmin);
   setNewAdmin({username:'',password:''});
   setNotice('Akun admin berhasil dibuat.');
   await loadMaster();
  });
  return result;
 }

 async function toggleAdmin(admin){
  const result=await run(async()=>{
   await api.patch(`/management/admins/${admin.id_akun}`,{aktif:!admin.aktif});
   setNotice('Status akun admin diperbarui.');
   await loadMaster();
  });
  return result;
 }

 const navItems=user?.role==='customer'
  ?[['schedule','Jadwal'],['bookings','Booking saya']]
  :user?.role==='admin'
    ?[['dashboard','Ringkasan'],['schedule','Jadwal'],['bookings','Booking'],['new-booking','Booking telepon'],['verification','Verifikasi DP'],['cancel-requests','Permohonan pembatalan'],['members','Member'],['refunds','Pengembalian'],['reports','Laporan']]
   :user?.role==='owner'
     ?[['reports','Laporan'],['booking-history','Riwayat booking'],['master','Data master']]
    :[];
 const navContext=key=>{
  if(user?.role==='customer'&&key==='bookings')return bookingsLoaded?bookings.length:null;
  if(user?.role==='admin'){
   if(key==='bookings')return bookingsLoaded?bookings.length:null;
   if(!adminDataLoaded)return null;
   if(key==='verification')return pending.filter(payment=>payment.jenis==='dp').length;
   if(key==='cancel-requests')return cancelRequests.length;
   if(key==='members')return members.length;
   if(key==='refunds')return refunds.length;
  }
  if(user?.role==='owner'&&key==='booking-history'&&bookingsLoaded)return bookings.length;
  if(user?.role==='owner'&&key==='master'&&masterLoaded)return master.courts.filter(court=>Boolean(court.aktif)).length;
  return null;
 };

 function renderSchedule(){
  const courts=schedule?.courts||[];
  const membershipKnown=typeof schedule?.isMember==='boolean';
  return <section className="panel">
   {user?.role==='customer'&&<div className={`membership-summary${schedule?.isMember===true?' is-member':''}`} aria-live="polite">
    <div className="membership-summary-head"><div><p className="eyebrow">STATUS KEANGGOTAAN</p><h3>{!schedule?'Memeriksa status…':!membershipKnown?'Status belum tersedia':schedule.isMember?'Member aktif':'Non-member'}</h3></div>{membershipKnown&&<span className={schedule.isMember?'status status-aktif':'status'}>{schedule.isMember?'Diskon diterapkan':'Tarif reguler'}</span>}</div>
    {!membershipKnown?<p className="muted">Status dan batas booking akan ditampilkan setelah informasi keanggotaan tersedia.</p>:<div className="membership-benefits"><span><strong>{schedule.isMember?'10% sudah diterapkan':'10%'}</strong><small>diskon sewa untuk member</small></span><span><strong>{schedule.isMember?'14 hari':'3 hari'}</strong><small>batas booking ke depan</small></span><span><strong>Rp150.000</strong><small>iuran member per bulan</small></span></div>}
    {membershipKnown&&<p className="small-note">{schedule.isMember?'Harga jadwal sudah memperhitungkan diskon member.':'Harga yang tampil adalah tarif tanpa diskon member. Keanggotaan dicatat oleh admin.'}</p>}
   </div>}
   <div className="panel-head">
    <div><p className="eyebrow">JADWAL LANGSUNG</p><h2>Pilih waktu bermain</h2><p className="muted">Operasional {String(schedule?.openingHours?.start??7).padStart(2,'0')}:00–{String(schedule?.openingHours?.end??23).padStart(2,'0')}:00 · Tarif diperbarui mengikuti master data</p></div>
    <div className="toolbar"><label className="field-inline">Tanggal<input type="date" value={date} min={today()} onChange={event=>{setDate(event.target.value);setSelected([]);}}/></label><button className="outline" onClick={refreshAll}>Perbarui</button></div>
   </div>
   {!schedule?<div className="empty">Memuat jadwal lapangan…</div>:courts.length===0?<div className="empty">Belum ada lapangan aktif.</div>:<div className="table-wrap">
    <table className="schedule-table"><thead><tr><th>Lapangan</th>{Array.from({length:(schedule.openingHours.end-schedule.openingHours.start)},(_,index)=><th key={index}>{String(schedule.openingHours.start+index).padStart(2,'0')}:00</th>)}</tr></thead>
     <tbody>{courts.map(court=><tr key={court.id_lapangan}><th>{court.nama}</th>{Array.from({length:(schedule.openingHours.end-schedule.openingHours.start)},(_,index)=>{
      const hour=schedule.openingHours.start+index;
      const slot=schedule.slots.find(item=>Number(item.courtId)===Number(court.id_lapangan)&&Number(item.hour)===hour);
      const active=selected.some(item=>Number(item.courtId)===Number(court.id_lapangan)&&Number(item.hour)===hour&&item.date===date);
      const className=active?'slot chosen':slot?.status==='lewat'?'slot past':slot?.status==='menunggu_dp'?'slot pending':slot?.status==='terisi'?'slot occupied':'slot';
      const label=active?'✓':slot?.status==='kosong'?money(slot.price):slot?.status==='menunggu_dp'?'DP':slot?.status==='lewat'?'Lewat':'Penuh';
      return <td key={hour}><button type="button" disabled={!canChoose||slot?.status!=='kosong'} className={className} title={`${slot?.status||'kosong'} · ${money(slot?.price)}`} onClick={()=>toggleSlot(slot)}>{label}</button></td>;
     })}</tr>)}</tbody>
    </table>
   </div>}
   <div className="legend"><span><i className="dot available"></i>Tersedia</span><span><i className="dot pending"></i>Menunggu DP (ditahan 2 jam)</span><span><i className="dot occupied"></i>Terisi</span>{schedule?.slots.some(slot=>slot.status==='lewat')&&<span>Waktu lewat</span>}{user&&<span>{schedule?.isMember?'Diskon member 10% sudah diterapkan':'Tarif tanpa diskon member'}</span>}</div>
   {canChoose&&<div className="booking-bar"><div><strong>{selected.length} slot dipilih</strong><span>{money(selectedTotal)} total · DP {money(selectedDeposit)}</span></div><div className="toolbar"><button className="text-button" onClick={()=>setSelected([])}>Hapus pilihan</button><button className="primary" disabled={!selected.length||busy} onClick={()=>setConfirmBooking(true)}>{rescheduleTarget?'Ajukan jadwal baru':user?.role==='admin'?'Simpan booking':'Lanjutkan booking'}</button></div></div>}
   {!user&&<div className="schedule-cta"><span>Masuk atau daftar untuk memilih slot dan membuat booking.</span><button className="primary" onClick={()=>{setAuthMode('login');setPage('login');}}>Masuk / Daftar</button></div>}
  </section>;
 }
function renderCustomerBookings(){
  return <section className="panel">
    <div className="panel-head">
      <div>
        <p className="eyebrow">RIWAYAT RESERVASI</p>
        <h2>Booking saya</h2>
        <p className="muted">Status, pembayaran, dan rincian jadwal tersimpan di sini.</p>
      </div>
      <button className="outline" onClick={refreshAll}>Perbarui</button>
    </div>

    {!bookings.length
      ? <div className="empty">{bookingsLoaded?'Belum ada booking.':'Memuat booking Anda…'}</div>
      : <div className="cards">
        {bookings.map(booking=>{
          const due=Math.max(
            0,
            Number(booking.total_harga)-
            Number(booking.dp_diterima||0)-
            Number(booking.pelunasan_diterima||0)
          );

          const dpStatus=booking.status_dp_terakhir;

          const canUpload=
            booking.status_booking==='menunggu_dp' &&
            (!dpStatus || dpStatus==='ditolak');

          return <article className="booking-card" key={booking.id_booking}>
            <div className="spread">
              <div>
                <span className="eyebrow">KODE BOOKING</span>
                <h3>{booking.kode_booking}</h3>
              </div>
              <Status value={booking.status_booking}/>
            </div>

            <p className="booking-schedule">{booking.jadwal}</p>

            <div className="amount-grid">
              <span>Total sewa<strong>{money(booking.total_harga)}</strong></span>
              <span>DP diterima<strong>{money(booking.dp_diterima||0)}</strong></span>
              <span>Sisa tagihan<strong>{money(due)}</strong></span>
            </div>

            {booking.status_booking === 'menunggu_dp' && dpStatus === 'menunggu_verifikasi' &&
              <p className="muted">
                Bukti pembayaran DP sudah dikirim dan sedang menunggu verifikasi Admin.
              </p>
            }

            {booking.status_booking === 'menunggu_dp' && dpStatus === 'ditolak' &&
              <p className="payment-mismatch">
                Bukti DP ditolak Admin. Silakan periksa pembayaran Anda dan unggah ulang bukti transfer.
              </p>
            }

             {['terkonfirmasi', 'lunas'].includes(booking.status_booking) && dpStatus === 'diterima' &&
              <p className="muted">
                DP berhasil diverifikasi oleh Admin.
              </p>
            }

            {booking.status_booking === 'menunggu_dp' && <>
              <p className="deadline">
                Batas DP: {new Date(String(booking.batas_dp).replace(' ', 'T')).toLocaleString('id-ID')}
                {' · '}
                <Countdown deadline={booking.batas_dp} />
              </p>

              <div className="transfer-info">
                <strong>Instruksi transfer DP {money(booking.jumlah_dp)}</strong>
                {transferInfo?.configured
                  ? <p>{transferInfo.bank} · {transferInfo.accountNumber} · a.n. {transferInfo.accountName}</p>
                  : <p className="muted">Rekening tujuan belum tersedia di aplikasi. Hubungi admin GOR untuk nomor rekening.</p>
                }
                <small>
                  Booking batal otomatis jika DP belum diverifikasi sebelum batas waktu.
                </small>
              </div>

              {canUpload
                ? <label className="upload">
                    {dpStatus==='ditolak'?'Unggah ulang bukti transfer (maks. 5 MB)':'Unggah bukti transfer (maks. 5 MB)'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={event=>{
                        const file=event.target.files?.[0];
                        uploadProof(booking.id_booking,file);
                        event.target.value='';
                      }}
                    />
                  </label>
                : dpStatus==='menunggu_verifikasi'
                  ? <p className="muted">Silakan tunggu hasil pemeriksaan Admin. Anda belum dapat mengunggah bukti baru.</p>
                  : null
              }
            </>}

            {booking.status_booking==='dibatalkan'&&
              <p className="muted">
                Pembatalan tercatat. Pengembalian dana (jika berlaku) diproses manual.
              </p>
            }

            <div className="actions">
              <button className="outline" onClick={()=>openBookingDetail(booking)}>
                Rincian & riwayat
              </button>

              {['menunggu_dp','terkonfirmasi','lunas'].includes(booking.status_booking)&&
                <button className="danger" onClick={()=>cancelBooking(booking)}>
                  Batalkan booking
                </button>
              }

              {['terkonfirmasi','lunas'].includes(booking.status_booking)&&
                Number(booking.jumlah_reschedule)===0&&
                booking.waktu_mulai_pertama&&
                (new Date(booking.waktu_mulai_pertama).getTime()-Date.now())>24*60*60*1000&&
                <button className="outline" onClick={()=>startReschedule(booking)}>
                  Ubah jadwal (1 kali)
                </button>
              }
            </div>
          </article>;
        })}
      </div>
    }
  </section>;
}


 function renderAdminBookings(){
  const filtered=bookings.filter(item=>{
   const query=phoneSearch.toLowerCase();
   return !query||`${item.kode_booking} ${item.nama} ${item.nomor_hp}`.toLowerCase().includes(query);
  });
  return <section className="panel"><div className="panel-head"><div><p className="eyebrow">OPERASIONAL</p><h2>Daftar booking</h2><p className="muted">Cari berdasarkan kode booking, nama, atau nomor HP.</p></div><button className="outline" onClick={refreshAll}>Perbarui</button></div>
   <label className="search-field">Cari<input value={phoneSearch} onChange={event=>setPhoneSearch(event.target.value)} placeholder="Kode booking, nama, nomor HP"/></label>
   {!filtered.length?<div className="empty">Tidak ada booking yang cocok.</div>:<div className="cards">{filtered.map(booking=><article className="booking-card" key={booking.id_booking}>
    <div className="spread"><div><span className="eyebrow">{booking.kode_booking}</span><h3>{booking.nama}</h3></div><Status value={booking.status_booking}/></div>
    <p>{booking.nomor_hp}</p><p className="booking-schedule">{booking.jadwal}</p>
    <div className="amount-grid"><span>Total<strong>{money(booking.total_harga)}</strong></span><span>Dibayar<strong>{money(booking.total_dibayar)}</strong></span><span>Sisa<strong>{money(Math.max(0,Number(booking.total_harga)-Number(booking.total_dibayar)))}</strong></span></div>
    <div className="actions"><button className="outline" onClick={()=>openBookingDetail(booking)}>Rincian & riwayat</button>{booking.status_booking==='terkonfirmasi'&&<><input aria-label="Uang diterima" className="cash-input" type="number" min="0" placeholder="Tunai diterima" value={settlementInputs[booking.id_booking]||''} onChange={event=>setSettlementInputs({...settlementInputs,[booking.id_booking]:event.target.value})}/><button className="primary" onClick={()=>settleBooking(booking)}>Catat pelunasan</button></>}
     {['menunggu_dp','terkonfirmasi','lunas'].includes(booking.status_booking)&&<button className="danger" onClick={()=>cancelByGor(booking)}>Batalkan oleh GOR</button>}</div>
   </article>)}</div>}
  </section>;
 }

 function renderOwnerHistory(){
  const query=phoneSearch.trim().toLowerCase();
  const filtered=bookings.filter(item=>!query||`${item.kode_booking} ${item.nama} ${item.nomor_hp}`.toLowerCase().includes(query));
  return <section className="panel"><div className="panel-head"><div><p className="eyebrow">PEMANTAUAN · BACA SAJA</p><h2>Riwayat booking</h2><p className="muted">Tinjau status, pembayaran, dan jejak perubahan tanpa mengubah booking.</p></div><button className="outline" onClick={refreshAll}>Perbarui</button></div>
   <label className="search-field">Cari<input value={phoneSearch} onChange={event=>setPhoneSearch(event.target.value)} placeholder="Kode booking, nama, nomor HP"/></label>
   {!bookingsLoaded?<div className="empty">Memuat riwayat booking…</div>:!filtered.length?<div className="empty">{query?'Tidak ada booking yang cocok.':'Belum ada data booking.'}</div>:<div className="cards">{filtered.map(booking=><article className="booking-card" key={booking.id_booking}>
    <div className="spread"><div><span className="eyebrow">{booking.kode_booking}</span><h3>{booking.nama}</h3></div><Status value={booking.status_booking}/></div>
    <p>{booking.nomor_hp}</p><p className="booking-schedule">{booking.jadwal}</p>
    <div className="amount-grid"><span>Total<strong>{money(booking.total_harga)}</strong></span><span>Dibayar<strong>{money(booking.total_dibayar)}</strong></span><span>Sisa<strong>{money(Math.max(0,Number(booking.total_harga)-Number(booking.total_dibayar)))}</strong></span></div>
    <div className="actions"><button className="outline" onClick={()=>openBookingDetail(booking)}>Lihat detail & riwayat</button></div>
   </article>)}</div>}
  </section>;
 }

 function renderAdminDashboard(){
  const pendingDeposits=pending.filter(payment=>payment.jenis==='dp').length;
  const unpaidToday=todayBookings.filter(booking=>booking.status_booking==='terkonfirmasi'&&Number(booking.total_dibayar)<Number(booking.total_harga)).length;
  const todayRows=todayBookings.slice(0,8);
  return <div className="admin-dashboard">
   <section className="panel">
    <div className="panel-head"><div><p className="eyebrow">RINGKASAN OPERASIONAL</p><h2>Fokus pekerjaan admin</h2><p className="muted">Pantau reservasi hari ini, pembayaran yang perlu diverifikasi, dan tindak lanjut pelanggan.</p></div><button className="outline" onClick={refreshAll}>Perbarui</button></div>
    <div className="metric-grid admin-metrics"><Metric label="Booking hari ini" value={adminDataLoaded?todayBookings.length:'Memuat…'}/><Metric label="DP menunggu verifikasi" value={adminDataLoaded?pendingDeposits:'Memuat…'}/><Metric label="Booking hari ini perlu pelunasan" value={adminDataLoaded?unpaidToday:'Memuat…'}/><Metric label="Permohonan pembatalan" value={adminDataLoaded?cancelRequests.length:'Memuat…'}/></div>
   </section>
   <section className="panel">
    <div className="panel-head"><div><p className="eyebrow">AKSES CEPAT</p><h2>Tugas operasional</h2></div></div>
    <div className="admin-quick-actions">
     <button className="admin-quick-action" onClick={()=>setPage('new-booking')}><span>＋</span><strong>Catat booking</strong><small>Pesanan telepon atau WhatsApp</small></button>
     <button className="admin-quick-action" onClick={()=>setPage('verification')}><span>✓</span><strong>Verifikasi DP</strong><small>{adminDataLoaded?`${pendingDeposits} menunggu ditinjau`:'Memuat antrean verifikasi…'}</small></button>
     <button className="admin-quick-action" onClick={()=>setPage('bookings')}><span>▤</span><strong>Cari booking</strong><small>{bookingsLoaded?`${bookings.length} booking tersedia · catat pelunasan`:'Memuat daftar booking…'}</small></button>
     <button className="admin-quick-action" onClick={()=>setPage('members')}><span>♧</span><strong>Kelola member</strong><small>{adminDataLoaded?`${members.length} data keanggotaan tercatat`:'Memuat data keanggotaan…'}</small></button>
     <button className="admin-quick-action" onClick={()=>setPage('cancel-requests')}><span>↩</span><strong>Tindak pembatalan</strong><small>{adminDataLoaded?`${cancelRequests.length} permohonan menunggu`:'Memuat permohonan…'}</small></button>
     <button className="admin-quick-action" onClick={()=>setPage('refunds')}><span>↗</span><strong>Pengembalian DP</strong><small>{adminDataLoaded?`${refunds.length} pengembalian perlu dicatat`:'Memuat tindak lanjut…'}</small></button>
    </div>
   </section>
   <section className="panel">
    <div className="panel-head"><div><p className="eyebrow">JADWAL HARI INI</p><h2>Booking yang perlu dipantau</h2><p className="muted">{readableDate(today())} · Tampilkan hingga 8 booking.</p></div><button className="text-button" onClick={()=>setPage('bookings')}>Semua booking →</button></div>
    {todayRows.length?<div className="table-wrap"><table className="admin-booking-table"><thead><tr><th>Kode booking</th><th>Pelanggan</th><th>Jadwal</th><th>Status</th><th>Sisa tagihan</th><th></th></tr></thead><tbody>{todayRows.map(booking=><tr key={booking.id_booking}><td><strong>{booking.kode_booking}</strong></td><td>{booking.nama}<br/><span className="muted">{booking.nomor_hp}</span></td><td>{booking.jadwal}</td><td><Status value={booking.status_booking}/></td><td>{money(Math.max(0,Number(booking.total_harga)-Number(booking.total_dibayar)))}</td><td><button className="text-button" onClick={()=>openBookingDetail(booking)}>Rincian</button></td></tr>)}</tbody></table></div>:<div className="empty">{adminDataLoaded?'Belum ada booking terjadwal hari ini.':'Memuat booking hari ini…'}</div>}
   </section>
  </div>;
 }

 function renderVerification(){
  return <section className="panel"><div className="panel-head"><div><p className="eyebrow">KONFIRMASI PEMBAYARAN</p><h2>Verifikasi DP</h2><p className="muted">Cocokkan bukti dengan transaksi bank dan catat nominal aktual.</p></div><button className="outline" onClick={refreshAll}>Perbarui</button></div>
   {!pending.length?<div className="empty">Tidak ada DP yang menunggu verifikasi.</div>:<div className="cards">{pending.map(payment=>{
    const amount=Number(verifyAmounts[payment.id_pembayaran]??payment.nominal);
    const matches=Number.isFinite(amount)&&amount===Number(payment.nominal);
    return <article className="booking-card" key={payment.id_pembayaran}>
     <div className="spread"><div><span className="eyebrow">{payment.kode_booking}</span><h3>{payment.nama}</h3></div><Status value={payment.status}/></div>
     <p>{payment.nomor_hp}</p><p>Tagihan DP: <strong>{money(payment.nominal)}</strong></p>
     <label>Nominal diterima (Rp)<input type="number" min="1" step="1" value={verifyAmounts[payment.id_pembayaran]??String(Number(payment.nominal))} onChange={event=>setVerifyAmounts({...verifyAmounts,[payment.id_pembayaran]:event.target.value})}/></label>
     <p className={matches?'muted':'payment-mismatch'}>{matches?'Nominal sesuai tagihan. Pastikan bukti cocok dengan mutasi bank.':`Belum sesuai tagihan ${money(payment.nominal)}. Jangan terima DP; tolak bukti agar pelanggan dapat mengunggah ulang sebelum batas waktu.`}</p>
     <div className="actions"><button className="outline" onClick={()=>openProof(payment)}>Lihat bukti</button><button className="primary" disabled={!matches||busy} onClick={()=>verifyDeposit(payment,true)}>Terima DP</button><button className="danger" onClick={()=>verifyDeposit(payment,false)}>Tolak</button></div>
    </article>;
   })}</div>}
  </section>;
 }

 function renderNewBooking(){
  return <div className="split-layout"><section className="panel"><p className="eyebrow">BOOKING TELEPON / WHATSAPP</p><h2>Catat pesanan pelanggan</h2><p className="muted">Cari nomor HP atau isi nama pelanggan baru, lalu pilih slot pada jadwal di bawah.</p>
   <div className="search-row"><input value={phoneSearch} onChange={event=>setPhoneSearch(event.target.value)} placeholder="Nomor HP pelanggan"/><button className="outline" onClick={lookupCustomer}>Cari</button></div>
   <label>Nama pelanggan<input value={manual.nama} onChange={event=>setManual({...manual,nama:event.target.value,customerId:''})} placeholder="Nama lengkap" required/></label>
   <label>Nomor HP<input value={manual.nomor_hp} onChange={event=>setManual({...manual,nomor_hp:event.target.value})} placeholder="08xxxxxxxxxx" required/></label>
   <label>DP diterima<select value={manual.depositMethod} onChange={event=>setManual({...manual,depositMethod:event.target.value})}><option value="transfer">Menunggu transfer (hold 2 jam)</option><option value="tunai">DP tunai diterima admin</option></select></label>
   <p className="muted">Dipilih: {selected.length} slot · Total {money(selectedTotal)} · DP {money(selectedDeposit)}</p>
   <button className="primary full" disabled={!selected.length||!manual.nama||!manual.nomor_hp} onClick={createBooking}>Simpan booking manual</button>
  </section><div>{renderSchedule()}</div></div>;
 }

 function renderMembers(){
  return <div className="split-layout"><section className="panel"><p className="eyebrow">KEANGGOTAAN</p><h2>Daftarkan atau perpanjang member</h2><p className="muted">Iuran Rp150.000 untuk 30 hari. Diskon 10% dan batas booking sampai 14 hari diterapkan otomatis.</p>
   <form onSubmit={createMember}><label>Nama lengkap<input name="nama" required/></label><label>Nomor HP<input name="nomor_hp" pattern="0[0-9]{8,19}" required placeholder="08xxxxxxxxxx"/></label><button className="primary full">Catat iuran Rp150.000</button></form>
  </section><section className="panel"><div className="panel-head"><div><p className="eyebrow">DAFTAR AKTIF & RIWAYAT</p><h2>Member</h2></div><button className="outline" onClick={refreshAll}>Perbarui</button></div>
   {members.length?members.map(member=><article className="list-row" key={member.id_keanggotaan}><div><strong>{member.nama}</strong><p>{member.nomor_hp} · {readableDate(member.mulai)} – {readableDate(member.berakhir)}</p></div><Status value={member.status_terkini}/></article>):<div className="empty">Belum ada data member.</div>}
  </section></div>;
 }

 function renderRefunds(){
  return <section className="panel"><div className="panel-head"><div><p className="eyebrow">TINDAK LANJUT MANUAL</p><h2>Pengembalian DP</h2><p className="muted">Setelah transfer pengembalian benar-benar dilakukan di luar aplikasi, catat prosesnya di sini.</p></div><button className="outline" onClick={refreshAll}>Perbarui</button></div>
   {refunds.length?refunds.map(refund=><article className="list-row" key={refund.id_pembatalan}><div><strong>{refund.kode_booking} · {refund.nama}</strong><p>{refund.alasan} · {money(refund.nominal_refund)} · {refund.nomor_hp}</p></div><button className="primary" onClick={()=>processRefund(refund)}>Tandai sudah dikembalikan</button></article>):<div className="empty">Tidak ada pengembalian yang menunggu.</div>}
  </section>;
 }

 function renderCancellationRequests(){
  return <section className="panel"><div className="panel-head"><div><p className="eyebrow">PERLU KEPUTUSAN ADMIN</p><h2>Permohonan pembatalan tepat 24 jam</h2><p className="muted">Tentukan apakah booking dibatalkan dan apakah DP hangus atau perlu dikembalikan.</p></div><button className="outline" onClick={refreshAll}>Perbarui</button></div>
   {cancelRequests.length?cancelRequests.map(request=><article className="booking-card" key={request.id_pembatalan}><div className="spread"><div><span className="eyebrow">{request.kode_booking}</span><h3>{request.nama}</h3></div><Status value="menunggu_verifikasi"/></div><p>{request.nomor_hp} · {request.jadwal}</p><p>{request.alasan}</p><div className="actions"><button className="danger" onClick={()=>reviewCancellation(request,true,true)}>Setujui · DP hangus</button><button className="primary" onClick={()=>reviewCancellation(request,true,false)}>Setujui · catat refund</button><button className="outline" onClick={()=>reviewCancellation(request,false)}>Tolak permohonan</button></div></article>):<div className="empty">Tidak ada permohonan pembatalan yang menunggu.</div>}
  </section>;
 }

 function renderReports(){
  const owner=user?.role==='owner';
  return <div className={owner?'owner-dashboard':'report-dashboard'}>
   {owner?<section className="panel owner-overview">
    <div className="panel-head"><div><p className="eyebrow">RINGKASAN PEMILIK</p><h2>Laporan & konfigurasi</h2><p className="muted">Pantau kinerja dan data master; tindakan booking operasional tetap ditangani admin.</p></div><button className="outline" onClick={loadMasterData}>Perbarui data master</button></div>
    <div className="metric-grid"><Metric label="Lapangan aktif" value={masterLoaded?master.courts.filter(court=>Boolean(court.aktif)).length:'Memuat…'}/><Metric label="Data tarif" value={masterLoaded?master.rates.length:'Memuat…'}/><Metric label="Hari operasional" value={masterLoaded?master.hours.length:'Memuat…'}/><Metric label="Admin aktif" value={masterLoaded?master.admins.filter(admin=>Boolean(admin.aktif)).length:'Memuat…'}/></div>
    <div className="owner-quick-actions"><button className="outline" onClick={()=>setPage('master')}>Kelola data master →</button><button className="outline" disabled={busy} onClick={loadRevenue}>Tampilkan laporan pendapatan</button><button className="outline" disabled={busy} onClick={loadOccupancy}>Tampilkan okupansi</button></div>
   </section>:<section className="panel"><p className="eyebrow">LAPORAN OPERASIONAL</p><h2>Pendapatan dan okupansi</h2><p className="muted">Tinjau transaksi yang diterima serta jam ramai dan sepi untuk mendukung operasional GOR.</p></section>}
   <div className="report-grid">
   <section className="panel report-panel"><div className="panel-head"><div><p className="eyebrow">LAPORAN KEUANGAN</p><h2>Pendapatan diterima</h2></div></div>
    <div className="toolbar"><select value={reportPeriod} onChange={event=>setReportPeriod(event.target.value)}><option value="day">Harian</option><option value="month">Bulanan</option></select>{reportPeriod==='day'?<input type="date" value={reportDate} onChange={event=>setReportDate(event.target.value)}/>:<input type="month" value={reportMonth} onChange={event=>setReportMonth(event.target.value)}/>}<button className="primary" onClick={loadRevenue}>Tampilkan</button></div>
    {report?<><div className="metric-grid"><Metric label="Total bersih diterima" value={money(report.summary.total)}/><Metric label="DP diterima" value={money(report.summary.deposit)}/><Metric label="Pelunasan" value={money(report.summary.settlement)}/><Metric label="Iuran member" value={money(report.summary.membership)}/><Metric label="Pengembalian DP" value={money(report.summary.refund)}/></div><div className="table-wrap"><table><thead><tr><th>Tanggal</th><th>Jenis transaksi</th><th>Jumlah transaksi</th><th>Pendapatan</th></tr></thead><tbody>{report.series.map((row,index)=><tr key={index}><td>{readableDate(row.tanggal)}</td><td>{row.jenis==='dp'?'DP':row.jenis==='pelunasan'?'Pelunasan':row.jenis==='pengembalian'?'Pengembalian DP':'Membership'}</td><td>{row.transaksi}</td><td>{money(row.pendapatan)}</td></tr>)}</tbody></table></div></>:<div className="empty">Pilih periode dan tampilkan laporan.</div>}
   </section>
   <section className="panel report-panel"><div className="panel-head"><div><p className="eyebrow">PENGELOLAAN KAPASITAS</p><h2>Okupansi lapangan</h2></div></div>
    <div className="toolbar"><label className="field-inline">Dari<input type="date" value={occupancyRange.start} onChange={event=>setOccupancyRange({...occupancyRange,start:event.target.value})}/></label><label className="field-inline">Sampai<input type="date" value={occupancyRange.end} onChange={event=>setOccupancyRange({...occupancyRange,end:event.target.value})}/></label><button className="primary" onClick={loadOccupancy}>Tampilkan</button></div>
    {occupancy?<><h3>Menurut jam</h3><div className="table-wrap"><table><thead><tr><th>Jam</th><th>Slot terisi</th><th>Kapasitas</th><th>Okupansi</th></tr></thead><tbody>{occupancy.byHour.map(row=><tr key={row.hour}><td>{String(row.hour).padStart(2,'0')}:00</td><td>{row.occupied_slots}</td><td>{row.total_slots}</td><td><strong>{row.occupancy_percent}%</strong></td></tr>)}</tbody></table></div><h3>Menurut tanggal</h3><div className="table-wrap"><table><thead><tr><th>Tanggal</th><th>Slot terisi</th><th>Kapasitas</th><th>Okupansi</th></tr></thead><tbody>{occupancy.byDate.map(row=><tr key={row.date}><td>{readableDate(row.date)}</td><td>{row.occupied_slots}</td><td>{row.total_slots}</td><td><strong>{row.occupancy_percent}%</strong></td></tr>)}</tbody></table></div></>:<div className="empty">Pilih rentang tanggal untuk melihat okupansi.</div>}
   </section>
   </div>
  </div>;
 }

 function renderMaster(){
  return <section className="panel"><div className="panel-head"><div><p className="eyebrow">KONFIGURASI SISTEM</p><h2>Data master BookPoint</h2><p className="muted">Perubahan berlaku untuk booking baru. Data historis tetap tersimpan.</p></div><button className="outline" onClick={loadMasterData}>Perbarui</button></div>
   <div className="tabs">{[['courts','Lapangan'],['rates','Tarif'],['hours','Jam operasional'],['admins','Akun admin']].map(([key,title])=><button key={key} className={masterTab===key?'active':''} onClick={()=>setMasterTab(key)}>{title}</button>)}</div>
   {masterTab==='courts'&&<div className="master-content"><form className="search-row" onSubmit={addCourt}><input value={newCourt} onChange={event=>setNewCourt(event.target.value)} placeholder="Nama lapangan baru"/><button className="primary">Tambah lapangan</button></form>{master.courts.map(court=><div className="list-row" key={court.id_lapangan}><div><strong>{court.nama}</strong><p>{court.aktif?'Aktif':'Nonaktif'}</p></div><div className="actions"><button className="outline" onClick={()=>renameCourt(court)}>Ubah nama</button><button className={court.aktif?'danger':'outline'} onClick={()=>toggleCourt(court)}>{court.aktif?'Nonaktifkan':'Aktifkan'}</button></div></div>)}</div>}
   {masterTab==='rates'&&<form className="master-content" onSubmit={saveRates}><div className="form-grid"><label>Tarif normal / jam<input type="number" min="0" value={rateForm.normal} onChange={event=>setRateForm({...rateForm,normal:event.target.value})}/></label><label>Tarif peak / jam (17:00–22:00)<input type="number" min="0" value={rateForm.peak} onChange={event=>setRateForm({...rateForm,peak:event.target.value})}/></label><label>Tarif weekend / jam<input type="number" min="0" value={rateForm.weekend} onChange={event=>setRateForm({...rateForm,weekend:event.target.value})}/></label></div><button className="primary">Simpan tarif</button></form>}
   {masterTab==='hours'&&<form className="master-content" onSubmit={saveHours}>{hourForm.map(row=><div className="hours-row" key={row.hari}><strong>{['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][row.hari]}</strong><input type="time" value={row.jam_buka} onChange={event=>setHourForm(hourForm.map(item=>item.hari===row.hari?{...item,jam_buka:event.target.value}:item))}/><span>hingga</span><input type="time" value={row.jam_tutup} onChange={event=>setHourForm(hourForm.map(item=>item.hari===row.hari?{...item,jam_tutup:event.target.value}:item))}/></div>)}<button className="primary">Simpan jam operasional</button></form>}
   {masterTab==='admins'&&<div className="master-content"><form className="form-grid" onSubmit={addAdmin}><label>Username admin<input required minLength="3" value={newAdmin.username} onChange={event=>setNewAdmin({...newAdmin,username:event.target.value})}/></label><label>Password awal (min. 8 karakter)<input required minLength="8" type="password" value={newAdmin.password} onChange={event=>setNewAdmin({...newAdmin,password:event.target.value})}/></label><button className="primary">Buat akun admin</button></form>{master.admins.map(admin=><div className="list-row" key={admin.id_akun}><div><strong>{admin.username}</strong><p>{admin.aktif?'Aktif':'Nonaktif'}</p></div><button className={admin.aktif?'danger':'outline'} onClick={()=>toggleAdmin(admin)}>{admin.aktif?'Nonaktifkan':'Aktifkan'}</button></div>)}</div>}
  </section>;
 }

 if(!user&&page==='login')return <main className="auth-page"><section className="auth-card"><button className="back-link" onClick={()=>setPage('home')}>← Kembali</button><div className="brand-icon">BP</div><p className="eyebrow">GOR SMASH · BADMINTON COURT</p><h1>{authMode==='login'?'Selamat datang kembali':'Buat akun BookPoint'}</h1><p className="muted">{authMode==='login'?'Masuk untuk mengelola reservasi Anda.':'Daftar sebagai pelanggan dengan nomor HP unik.'}</p><div className="tabs"><button className={authMode==='login'?'active':''} onClick={()=>setAuthMode('login')}>Masuk</button><button className={authMode==='register'?'active':''} onClick={()=>setAuthMode('register')}>Daftar pelanggan</button></div><form onSubmit={submitAuth}>{authMode==='register'&&<label>Nama lengkap<input required maxLength="120" value={authForm.nama} onChange={event=>setAuthForm({...authForm,nama:event.target.value})}/></label>}<label>{authMode==='login'?'Username atau nomor HP':'Nomor HP'}<input type={authMode==='login'?'text':'tel'} inputMode={authMode==='login'?'text':'numeric'} autoComplete={authMode==='login'?'username':'tel'} required pattern={authMode==='register'?'0[0-9]{8,19}':undefined} value={authForm.identifier} onChange={event=>setAuthForm({...authForm,identifier:event.target.value})} placeholder={authMode==='login'?'Masukkan username atau 08xxxxxxxxxx':'08xxxxxxxxxx'}/></label><label>Password<input required minLength="8" type="password" autoComplete={authMode==='login'?'current-password':'new-password'} value={authForm.password} onChange={event=>setAuthForm({...authForm,password:event.target.value})}/></label><button className="primary full" disabled={busy}>{authMode==='login'?'Masuk':'Buat akun'}</button></form><p className="small-note">Admin dan pemilik masuk memakai username. Pelanggan masuk memakai nomor HP. Registrasi publik hanya untuk pelanggan.</p><Feedback error={error} notice={notice}/></section></main>;

 if(!user&&page!=='public-schedule')return <div className="public-site">
  <header className="site-header"><a className="brand" href="#" onClick={event=>{event.preventDefault();setPage('home');}}><span className="brand-icon">BP</span><span><strong>BookPoint</strong><small>GOR Smash</small></span></a><nav><a href="#fitur">Fitur</a><a href="#cara-kerja">Cara kerja</a><a href="#harga">Harga</a></nav><div className="toolbar"><button className="outline" onClick={()=>{setAuthMode('login');setPage('login');}}>Masuk</button><button className="primary" onClick={()=>{setAuthMode('register');setPage('login');}}>Booking sekarang</button></div></header>
  <main><section className="hero"><div className="hero-copy"><span className="pill">Reservasi lapangan lebih praktis</span><h1>Waktunya main,<br/><em>bukan menunggu.</em></h1><p>Temukan jadwal lapangan yang tersedia, pesan beberapa slot sekaligus, dan pantau konfirmasi pembayaran dalam satu tempat.</p><div className="toolbar"><button className="primary" onClick={()=>{setAuthMode('register');setPage('login');}}>Mulai booking <span>→</span></button><button className="text-button" onClick={()=>setPage('public-schedule')}>Lihat jadwal publik</button></div><div className="hero-facts"><span><strong>4</strong> lapangan</span><span><strong>07–23</strong> setiap hari</span><span><strong>10%</strong> diskon member</span></div></div></section>
   <section className="feature-section" id="fitur"><div className="section-title"><span className="eyebrow">UNTUK PERMAINAN ANDA</span><h2>Semua yang dibutuhkan,<br/>dalam satu reservasi.</h2></div><div className="feature-grid"><Feature icon="◷" title="Jadwal yang jelas" text="Lihat ketersediaan empat lapangan berdasarkan tanggal dan jam."/><Feature icon="↗" title="Booking lebih mudah" text="Pilih beberapa jam atau lapangan dalam satu transaksi dan satu DP."/><Feature icon="✓" title="Status terpantau" text="Unggah bukti transfer dan pantau konfirmasi booking Anda."/><Feature icon="♧" title="Keuntungan member" text="Dapatkan diskon 10% dan akses booking hingga 14 hari ke depan."/></div></section>
   <section className="steps-section" id="cara-kerja"><div className="section-title"><span className="eyebrow">PRAKTIS DARI AWAL</span><h2>Booking dalam tiga langkah</h2></div><div className="steps-grid"><Step number="01" title="Pilih jadwal" text="Tentukan tanggal, lapangan, dan jam yang masih tersedia."/><Step number="02" title="Konfirmasi booking" text="Periksa total harga dan transfer DP sebesar 50%."/><Step number="03" title="Datang dan bermain" text="Pantau status booking, lalu selesaikan sisa pembayaran di GOR."/></div></section>
   <section className="price-section" id="harga"><div><span className="eyebrow">TARIF TRANSPARAN</span><h2>Siapkan raketmu.<br/>Kami siapkan lapangannya.</h2><p>Tarif diatur berdasarkan jam bermain dan akhir pekan. Member memperoleh potongan 10% dari sewa lapangan.</p></div><div className="price-card"><div><span>Jam reguler</span><strong>Rp60.000 <small>/ jam</small></strong></div><div><span>Peak hour & akhir pekan</span><strong>Rp90.000 <small>/ jam</small></strong></div><div><span>Membership 30 hari</span><strong>Rp150.000 <small>/ bulan</small></strong></div><button className="primary full" onClick={()=>{setAuthMode('register');setPage('login');}}>Pesan lapangan</button></div></section>
  </main><footer className="site-footer"><strong>BookPoint · GOR Smash</strong><span>Reservasi lapangan badminton yang cepat dan nyaman.</span></footer>
 </div>;

 if(!user&&page==='public-schedule')return <div className="public-site"><header className="site-header"><a className="brand" href="#" onClick={event=>{event.preventDefault();setPage('home');}}><span className="brand-icon">BP</span><span><strong>BookPoint</strong><small>GOR Smash</small></span></a><div className="toolbar"><button className="outline" onClick={()=>setPage('home')}>Beranda</button><button className="primary" onClick={()=>{setAuthMode('login');setPage('login');}}>Masuk / Daftar</button></div></header><main className="workspace"><div className="page-heading"><div><p className="eyebrow">JADWAL GOR SMASH</p><h1>Ketersediaan lapangan</h1></div><span className="date-chip">Pilih tanggal untuk melihat slot</span></div><Feedback error={error} notice={notice}/>{renderSchedule()}</main></div>;

 return <div className="app-shell">
  <header className="app-header"><a className="brand" href="#" onClick={event=>{event.preventDefault();setPage(user.role==='owner'?'reports':user.role==='admin'?'dashboard':'schedule');}}><span className="brand-icon">BP</span><span><strong>BookPoint</strong><small>GOR Smash</small></span></a><div className="header-right"><span className="user-pill">{user.nama||user.role} <i>·</i> {roleName[user.role]||user.role}</span><button className="outline" onClick={logout}>Keluar</button></div></header>
  <div className="app-layout">
   <aside className="sidebar"><div className="sidebar-label">MENU {roleName[user.role]?.toUpperCase()}</div>{navItems.map(([key,label])=>{const context=navContext(key);const contextLabel=key==='master'?'lapangan aktif':key==='verification'?'DP menunggu':key==='cancel-requests'?'permohonan menunggu':key==='members'?'data member':key==='refunds'?'pengembalian menunggu':'booking';return <button key={key} aria-current={page===key?'page':undefined} aria-label={`${label}${context===null?'':`, ${context} ${contextLabel}`}`} className={page===key?'nav-item active':'nav-item'} onClick={()=>{setPage(key);setSelected([]);setRescheduleTarget(null);}}><span className="nav-mark">{key==='dashboard'?'▦':key==='schedule'?'◷':key==='bookings'||key==='booking-history'?'▤':key==='new-booking'?'＋':key==='verification'?'✓':key==='members'?'♧':key==='refunds'?'↩':key==='cancel-requests'?'?':key==='reports'?'▥':'⚙'}</span><span className="nav-label">{label}</span>{context!==null&&<span className="nav-context" aria-hidden="true">{context}</span>}</button>})}<div className="sidebar-bottom"><span className="status-dot"></span>{user.role==='customer'?bookingsLoaded?`${bookings.length} booking tercatat`:'Memuat booking Anda…':user.role==='admin'?adminDataLoaded?`${pending.filter(payment=>payment.jenis==='dp').length} DP · ${cancelRequests.length} pembatalan menunggu`:'Memuat tugas operasional…':masterLoaded?'Akses pemilik · konfigurasi & laporan':'Memuat data master…'}</div></aside>
   <main className="workspace">
    <div className="page-heading"><div><p className="eyebrow">{user.role==='customer'?'AREA PELANGGAN':user.role==='admin'?'PANEL OPERASIONAL':'PORTAL PEMILIK'}</p><h1>{page==='dashboard'?'Dashboard admin':page==='schedule'?'Jadwal lapangan':page==='bookings'?(user.role==='customer'?'Booking saya':'Daftar booking'):page==='booking-history'?'Riwayat booking':page==='new-booking'?'Booking telepon / WhatsApp':page==='verification'?'Verifikasi pembayaran':page==='cancel-requests'?'Permohonan pembatalan':page==='members'?'Pengelolaan member':page==='refunds'?'Pengembalian DP':page==='reports'?'Laporan dan analisis':'Data master'}</h1></div><div className="date-chip">{readableDate(date)}</div></div>
    <Feedback error={error} notice={notice}/>
    {page==='dashboard'&&user.role==='admin'&&renderAdminDashboard()}
    {page==='schedule'&&renderSchedule()}
    {page==='bookings'&&(user.role==='customer'?renderCustomerBookings():renderAdminBookings())}
    {page==='booking-history'&&user.role==='owner'&&renderOwnerHistory()}
    {page==='new-booking'&&renderNewBooking()}
    {page==='verification'&&renderVerification()}
    {page==='cancel-requests'&&renderCancellationRequests()}
    {page==='members'&&renderMembers()}
    {page==='refunds'&&renderRefunds()}
    {page==='reports'&&renderReports()}
    {page==='master'&&renderMaster()}
    <footer className="app-footer">BookPoint · GOR Smash <span>Informasi booking dan pembayaran tercatat sesuai aktivitas.</span></footer>
   </main>
  </div>
  {confirmBooking&&<div className="modal-backdrop" onClick={event=>event.target===event.currentTarget&&setConfirmBooking(false)}><section className="modal"><div className="spread"><div><p className="eyebrow">KONFIRMASI</p><h2>{rescheduleTarget?'Periksa jadwal baru':'Ringkasan booking'}</h2></div><button className="icon-button" onClick={()=>setConfirmBooking(false)}>×</button></div>
  <p>{selected.length} slot pada {readableDate(date)}</p><Feedback error={error} notice={notice}/><ul className="selected-list">{selected.map((slot,index)=><li key={`${slot.courtId}-${slot.hour}-${index}`}><span>{slot.court} · {String(slot.hour).padStart(2,'0')}:00–{String(slot.hour+1).padStart(2,'0')}:00</span><strong>{money(slot.price)}</strong></li>)}</ul><div className="amount-row"><span>Total sewa</span><strong>{money(selectedTotal)}</strong></div><div className="amount-row"><span>DP 50%</span><strong>{money(selectedDeposit)}</strong></div>{user.role==='customer'&&<p className="muted">Booking menunggu verifikasi DP. Slot ditahan paling lama dua jam.</p>}{user.role==='admin'&&<p className="muted">Nama pelanggan: {manual.nama||'Belum diisi'} · DP {manual.depositMethod==='tunai'?'diterima tunai':'menunggu transfer'}.</p>}<button className="primary full" disabled={busy} onClick={createBooking}>{busy?'Menyimpan…':rescheduleTarget?'Simpan jadwal baru':'Konfirmasi dan buat booking'}</button></section></div>}
  {proof&&<div className="modal-backdrop" onClick={event=>event.target===event.currentTarget&&setProof(null)}><section className="modal proof-modal"><div className="spread"><h2>Bukti transfer</h2><button className="icon-button" onClick={()=>setProof(null)}>×</button></div><img src={proof.url} alt={`Bukti transfer ${proof.name}`}/></section></div>}
  {bookingDetail&&<div className="modal-backdrop" onClick={event=>event.target===event.currentTarget&&setBookingDetail(null)}><section className="modal detail-modal"><div className="spread"><div><p className="eyebrow">RINCIAN & AUDIT</p><h2>{bookingDetail.kode_booking}</h2></div><button className="icon-button" onClick={()=>setBookingDetail(null)}>×</button></div><p>{bookingDetail.nama} · {bookingDetail.nomor_hp}</p><Status value={bookingDetail.status_booking}/><h3>Jadwal</h3>{bookingDetail.items?.map(item=><div className="amount-row" key={item.id_detail}><span>{item.nama_lapangan} · {readableDate(item.tanggal)} · {item.jam_mulai_text}–{item.jam_selesai_text}</span><strong>{money(item.harga)}</strong></div>)}<div className="amount-row"><span>Total sewa</span><strong>{money(bookingDetail.total_harga)}</strong></div><h3>Pembayaran</h3>{bookingDetail.payments?.length?bookingDetail.payments.map(payment=><div className="list-row" key={payment.id_pembayaran}><span>{payment.jenis==='dp'?'DP':payment.jenis==='pelunasan'?'Pelunasan':'Membership'} · {statusName[payment.status]||payment.status}</span><strong>{money(payment.nominal)}</strong></div>):<p className="muted">Belum ada transaksi pembayaran.</p>}<h3>Riwayat perubahan</h3>{bookingDetail.history?.length?bookingDetail.history.map((item,index)=><div className="audit-row" key={`${item.created_at}-${index}`}><span>{new Date(String(item.created_at).replace(' ','T')).toLocaleString('id-ID')}</span><strong>{item.aktor}</strong><p>{item.keterangan||`${item.status_sebelum||'—'} → ${item.status_sesudah}`}</p></div>):<p className="muted">Belum ada riwayat.</p>}</section></div>}
 </div>;
}

function Status({value}){
 return <span className={`status status-${value||'unknown'}`}>{statusName[value]||value||'Tidak diketahui'}</span>;
}

function Countdown({deadline}){
 const [remaining,setRemaining]=useState(()=>Math.max(0,Math.floor((new Date(String(deadline).replace(' ','T')).getTime()-Date.now())/1000)));
 useEffect(()=>{
  const timer=setInterval(()=>setRemaining(Math.max(0,Math.floor((new Date(String(deadline).replace(' ','T')).getTime()-Date.now())/1000))),1000);
  return ()=>clearInterval(timer);
 },[deadline]);
 if(!remaining)return <strong>Waktu DP berakhir</strong>;
 const hours=String(Math.floor(remaining/3600)).padStart(2,'0');
 const minutes=String(Math.floor(remaining%3600/60)).padStart(2,'0');
 const seconds=String(remaining%60).padStart(2,'0');
 return <strong>{hours}:{minutes}:{seconds}</strong>;
}

function Feedback({error,notice}){
 if(!error&&!notice)return null;
 return <div className={error?'feedback error':'feedback success'} role={error?'alert':'status'}>{error||notice}</div>;
}

function Metric({label,value}){
 return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

function Feature({icon,title,text}){
 return <article className="feature-card"><span className="feature-icon">{icon}</span><h3>{title}</h3><p>{text}</p></article>;
}

function Step({number,title,text}){
 return <article className="step-card"><span>{number}</span><h3>{title}</h3><p>{text}</p></article>;
}

export default App;
