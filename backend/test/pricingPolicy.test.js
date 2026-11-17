import test from 'node:test';
import assert from 'node:assert/strict';
import {slotPrice} from '../src/pricingPolicy.js';

test('weekday pricing applies the peak window from 17:00 through 21:59',()=>{
 assert.equal(slotPrice('2026-03-02',16,false),60000);
 assert.equal(slotPrice('2026-03-02',17,false),90000);
 assert.equal(slotPrice('2026-03-02',21,false),90000);
 assert.equal(slotPrice('2026-03-02',22,false),60000);
});

test('weekends use the weekend rate and members receive ten percent off',()=>{
 assert.equal(slotPrice('2026-03-07',10,false),90000);
 assert.equal(slotPrice('2026-03-07',10,true),81000);
 assert.equal(slotPrice('2026-03-02',10,true),54000);
});

test('invalid dates and hours are rejected',()=>{
 assert.throws(()=>slotPrice('2026-02-30',10,false),TypeError);
 assert.throws(()=>slotPrice('2026-03-02',24,false),TypeError);
});
