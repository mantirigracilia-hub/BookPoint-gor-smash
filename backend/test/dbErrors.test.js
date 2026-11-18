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

import {errorDetail,publicMessage} from '../src/dbErrors.js';

test('publicMessage meneruskan pesan bisnis tetapi menyembunyikan error SQL',()=>{
 assert.equal(publicMessage(new Error('Pilih minimal satu slot.')),'Pilih minimal satu slot.');
 const sqlError=Object.assign(new Error("Unknown column 'x' in 'field list'"),{code:'ER_BAD_FIELD_ERROR',errno:1054,sqlState:'42S22'});
 assert.doesNotMatch(publicMessage(sqlError),/Unknown column/);
 const down=Object.assign(new Error('connect ECONNREFUSED'),{code:'ECONNREFUSED',errno:-111});
 assert.equal(publicMessage(down),DATABASE_UNAVAILABLE_MESSAGE);
});

test('errorDetail disembunyikan saat production',()=>{
 const previous=process.env.NODE_ENV;
 try{
  process.env.NODE_ENV='production';
  assert.equal(errorDetail(new Error('rahasia')),undefined);
  process.env.NODE_ENV='development';
  assert.equal(errorDetail(new Error('info')),'info');
 }finally{
  if(previous===undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV=previous;
 }
});
