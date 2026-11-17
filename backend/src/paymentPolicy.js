export const MAX_RUPIAH=9_999_999_999;

// [REQ-10] Validate whole-rupiah values against DECIMAL(12,2) storage.
export function isValidRupiahAmount(value){
 return Number.isSafeInteger(value)&&value>0&&value<=MAX_RUPIAH;
}

// [REQ-14] [REQ-15] Prevent settlement when no positive balance remains.
export function outstandingBalance(total,paid){
 if(!Number.isSafeInteger(total)||total<=0||total>MAX_RUPIAH||
    !Number.isSafeInteger(paid)||paid<0||paid>MAX_RUPIAH){
  throw new TypeError('Nominal pembayaran tidak valid.');
 }
 return Math.max(0,total-paid);
}

// [REQ-10] A verified payment covering the booking total closes the balance.
export function bookingStatusForPaidTotal(total,paid){
 return outstandingBalance(total,paid)===0?'lunas':'terkonfirmasi';
}
