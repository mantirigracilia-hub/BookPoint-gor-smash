const HOUR_PATTERN=/^([01]\d|2[0-3]):00$/;

export function isValidOperatingHours(hours){
 if(!Array.isArray(hours)||hours.length!==7) return false;
 const days=new Set();
 for(const row of hours){
  if(!row||typeof row!=='object') return false;
  const day=Number(row.hari);
  if(!Number.isInteger(day)||day<0||day>6||days.has(day)) return false;
  if(typeof row.jam_buka!=='string'||typeof row.jam_tutup!=='string'||
   !HOUR_PATTERN.test(row.jam_buka)||!HOUR_PATTERN.test(row.jam_tutup)||row.jam_buka>=row.jam_tutup) return false;
  days.add(day);
 }
 return days.size===7;
}
