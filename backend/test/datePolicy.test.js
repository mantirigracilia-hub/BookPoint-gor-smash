import test from 'node:test';
import assert from 'node:assert/strict';
import {isCalendarDate} from '../src/datePolicy.js';

test('calendar dates must be real ISO dates',()=>{
 assert.equal(isCalendarDate('2026-02-28'),true);
 assert.equal(isCalendarDate('2024-02-29'),true);
 assert.equal(isCalendarDate('2026-02-29'),false);
 assert.equal(isCalendarDate('2026-02-31'),false);
 assert.equal(isCalendarDate('2026-2-03'),false);
 assert.equal(isCalendarDate(null),false);
});
