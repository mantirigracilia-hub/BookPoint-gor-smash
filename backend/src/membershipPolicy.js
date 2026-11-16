function isDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
 const parsed=new Date(`${value}T00:00:00Z`);
 return !Number.isNaN(parsed.valueOf())&&parsed.toISOString().slice(0,10)===value;
}

export function membershipStatus(start,end,today){
 if(!isDate(start)||!isDate(end)||!isDate(today)) throw new TypeError('Tanggal membership harus berformat YYYY-MM-DD.');
 if(start>end) throw new RangeError('Tanggal mulai membership tidak boleh setelah tanggal berakhir.');
 if(today<start) return 'akan_datang';
 if(today>end) return 'berakhir';
 return 'aktif';
}
