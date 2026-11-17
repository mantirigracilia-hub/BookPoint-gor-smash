import {isCalendarDate} from './datePolicy.js';

// [REQ-08] [BR-02] Harga per jam mengikuti tarif SRS dan diskon member 10%.
export function slotPrice(date,hour,isMember){
 if(!isCalendarDate(date)||!Number.isInteger(hour)||hour<0||hour>=24) throw new TypeError('Tanggal atau jam tarif tidak valid.');
 const parsed=new Date(`${date}T00:00:00Z`);
 const day=parsed.getUTCDay();
 const weekend=day===0||day===6;
 const base=weekend||hour>=17&&hour<22?90000:60000;
 return Math.round(base*(isMember?0.9:1));
}
