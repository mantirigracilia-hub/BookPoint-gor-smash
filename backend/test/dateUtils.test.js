import test from 'node:test';
import assert from 'node:assert/strict';
import {isValidDate} from '../src/dateUtils.js';

test('isValidDate menerima tanggal kalender yang benar, termasuk 29 Februari tahun kabisat',()=>{
 assert.equal(isValidDate('2026-02-28'),true);
 assert.equal(isValidDate('2028-02-29'),true);
});

test('isValidDate menolak tanggal yang tidak ada di kalender (sebelumnya lolos di laporan)',()=>{
 assert.equal(isValidDate('2026-02-30'),false);
 assert.equal(isValidDate('2026-04-31'),false);
 assert.equal(isValidDate('2027-02-29'),false);
 assert.equal(isValidDate('2026-13-01'),false);
});

test('isValidDate menolak format dan tipe yang salah',()=>{
 assert.equal(isValidDate('2026-2-3'),false);
 assert.equal(isValidDate('17-11-2026'),false);
 assert.equal(isValidDate(undefined),false);
 assert.equal(isValidDate(20261117),false);
});
