import test from 'node:test';
import assert from 'node:assert/strict';
import {membershipStatus} from '../src/membershipPolicy.js';

test('membership status follows its inclusive date range, including future periods',()=>{
 assert.equal(membershipStatus('2026-12-17','2027-01-15','2026-11-17'),'akan_datang');
 assert.equal(membershipStatus('2026-11-17','2026-12-16','2026-11-17'),'aktif');
 assert.equal(membershipStatus('2026-10-19','2026-11-17','2026-11-17'),'aktif');
 assert.equal(membershipStatus('2026-10-18','2026-11-16','2026-11-17'),'berakhir');
});

test('membership status rejects invalid or inverted dates',()=>{
 assert.throws(()=>membershipStatus('2026-02-30','2026-03-01','2026-02-28'),TypeError);
 assert.throws(()=>membershipStatus('2026-03-02','2026-03-01','2026-03-01'),RangeError);
});
