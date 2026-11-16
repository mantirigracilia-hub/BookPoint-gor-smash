const DAY_SECONDS=24*60*60;

export function cancellationOutcome(secondsUntilStart,hasPaidDp){
 if(!Number.isInteger(secondsUntilStart)) throw new TypeError('Waktu menuju jadwal harus berupa detik bulat.');
 if(secondsUntilStart===DAY_SECONDS) return 'admin_review';
 if(secondsUntilStart<DAY_SECONDS&&hasPaidDp) return 'dp_forfeit';
 if(secondsUntilStart>DAY_SECONDS&&hasPaidDp) return 'manual_refund';
 return 'cancel';
}

export function canReschedule(secondsUntilStart){
 return Number.isInteger(secondsUntilStart)&&secondsUntilStart>DAY_SECONDS;
}

export function isSlotInPast(date,hour,today,currentHour){
 return date<today||(date===today&&hour<=currentHour);
}

export function isHourWithinOperatingHours(hour,openingHour,closingHour){
 return Number.isInteger(hour)&&Number.isInteger(openingHour)&&Number.isInteger(closingHour)&&
  hour>=openingHour&&hour+1<=closingHour;
}
