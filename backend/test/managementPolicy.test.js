import test from 'node:test';
import assert from 'node:assert/strict';
import {isValidOperatingHours} from '../src/managementPolicy.js';

const validHours=Array.from({length:7},(_,hari)=>({hari,jam_buka:'07:00',jam_tutup:'23:00'}));

test('operating hours require one valid row for every weekday',()=>{
 assert.equal(isValidOperatingHours(validHours),true);
});

test('operating hours reject duplicate and missing weekdays',()=>{
 const duplicateDays=validHours.map(row=>({...row}));
 duplicateDays[6].hari=0;
 assert.equal(isValidOperatingHours(duplicateDays),false);
});

test('operating hours reject invalid rows and ranges',()=>{
 assert.equal(isValidOperatingHours([null,...validHours.slice(1)]),false);
 assert.equal(isValidOperatingHours(validHours.map((row,index)=>index===0?{...row,jam_buka:'23:00'}:row)),false);
 assert.equal(isValidOperatingHours(validHours.slice(1)),false);
});
