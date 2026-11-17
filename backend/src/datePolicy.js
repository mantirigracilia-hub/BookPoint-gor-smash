// [REQ-02] [REQ-07] [REQ-17] [REQ-18] Reuse strict calendar-date validation across booking and reports.
export function isCalendarDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
 const date=new Date(`${value}T00:00:00Z`);
 return !Number.isNaN(date.valueOf())&&date.toISOString().slice(0,10)===value;
}
