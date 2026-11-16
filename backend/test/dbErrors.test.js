import test from 'node:test';
import assert from 'node:assert/strict';
import {DATABASE_UNAVAILABLE_MESSAGE,isDatabaseUnavailable} from '../src/dbErrors.js';

test('database connection failures are identified for actionable API errors',()=>{
 for(const code of ['ECONNREFUSED','ER_ACCESS_DENIED_ERROR','ER_BAD_DB_ERROR','PROTOCOL_CONNECTION_LOST']){
  assert.equal(isDatabaseUnavailable({code}),true);
 }
 assert.equal(isDatabaseUnavailable({code:'ER_DUP_ENTRY'}),false);
 assert.match(DATABASE_UNAVAILABLE_MESSAGE,/MySQL berjalan/);
});
