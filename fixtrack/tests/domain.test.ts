import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextStage, normalizeCode, schedule, shopDay, validateIntake } from '../src/lib/domain.ts';
test('Manila deadlines respect the whole local calendar day', () => {
  assert.equal(shopDay(new Date('2026-11-23T16:30:00Z')), '2026-11-24');
  assert.equal(schedule({ stage: 'Repairing', original_due: '2026-11-24', revised_due: null, ever_delayed: false }, '2026-11-24'), 'On schedule');
  assert.equal(schedule({ stage: 'Repairing', original_due: '2026-11-24', revised_due: null, ever_delayed: false }, '2026-11-25'), 'Overdue');
});
test('missing and revised deadlines never erase a previous delay', () => {
  assert.equal(schedule({ stage: 'Received', original_due: null, revised_due: null, ever_delayed: false }), 'Not set');
  const repair = { stage: 'Repairing' as const, original_due: '2026-11-20', revised_due: '2026-11-26', ever_delayed: true };
  assert.equal(schedule(repair, '2026-11-24'), 'Revised schedule');
  assert.equal(schedule(repair, '2026-11-27'), 'Overdue');
  assert.equal(repair.ever_delayed, true);
});
test('waiting for pickup does not continue accumulating repair lateness', () => {
  assert.equal(schedule({ stage: 'Ready for Pickup', original_due: '2020-01-01', revised_due: null, ever_delayed: true }), 'Ready for pickup');
  assert.equal(nextStage('Ready for Pickup'), 'Claimed'); assert.equal(nextStage('Claimed'), null);
});
test('private codes tolerate grouping and intake rejects missing private/public summaries', () => {
  assert.equal(normalizeCode('abcd-1234 ef56'), 'ABCD1234EF56');
  assert.throws(() => validateIntake({ customer_name: 'Test', customer_phone: '0917 555 0000', customer_email: '', device_type: 'Laptop', device: 'Test laptop', issue: 'Not charging', public_summary: '', original_due: '' }), /required/);
});
