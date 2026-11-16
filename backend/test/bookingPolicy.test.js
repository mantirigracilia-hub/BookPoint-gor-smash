import test from 'node:test';
import assert from 'node:assert/strict';
import {canReschedule,cancellationOutcome} from '../src/bookingPolicy.js';

test('cancellation exactly 24 hours before start waits for admin',()=>{
 assert.equal(cancellationOutcome(86400,false),'admin_review');
 assert.equal(cancellationOutcome(86400,true),'admin_review');
});

test('cancellation less than 24 hours forfeits an accepted DP',()=>{
 assert.equal(cancellationOutcome(86399,true),'dp_forfeit');
 assert.equal(cancellationOutcome(86399,false),'cancel');
});

test('cancellation more than 24 hours records a manual refund for accepted DP',()=>{
 assert.equal(cancellationOutcome(86401,true),'manual_refund');
 assert.equal(cancellationOutcome(86401,false),'cancel');
});

test('rescheduling is allowed only when more than 24 hours remain',()=>{
 assert.equal(canReschedule(86400),false);
 assert.equal(canReschedule(86401),true);
 assert.equal(canReschedule(86399),false);
});
