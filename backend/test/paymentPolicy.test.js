import test from 'node:test';
import assert from 'node:assert/strict';
import {bookingStatusForPaidTotal,isValidRupiahAmount,outstandingBalance} from '../src/paymentPolicy.js';

test('rupiah amounts must be positive whole values within the database range',()=>{
 assert.equal(isValidRupiahAmount(1),true);
 assert.equal(isValidRupiahAmount(9999999999),true);
 assert.equal(isValidRupiahAmount(0),false);
 assert.equal(isValidRupiahAmount(1.5),false);
 assert.equal(isValidRupiahAmount(10000000000),false);
});

test('settlement requires a real outstanding balance and reflects full payment',()=>{
 assert.equal(outstandingBalance(120000,60000),60000);
 assert.equal(outstandingBalance(120000,150000),0);
 assert.equal(bookingStatusForPaidTotal(120000,60000),'terkonfirmasi');
 assert.equal(bookingStatusForPaidTotal(120000,120000),'lunas');
 assert.throws(()=>outstandingBalance(0,0),TypeError);
});
