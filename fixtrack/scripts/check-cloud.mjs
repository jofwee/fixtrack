import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { settings } from './cloud-config.mjs';
const config = settings();
const accounts = JSON.parse(readFileSync('defense-accounts.local.txt', 'utf8'));
if (accounts.state !== 'ready' || accounts.project_url !== config.url) throw new Error('Create defense accounts for this project first.');
const client = () => createClient(config.url, config.publishable, { auth: { persistSession: false, autoRefreshToken: false } });
const staff = client(), secondDevice = client(), anonymous = client();
function unwrap({ data, error }, label) { if (error) throw new Error(`${label} failed: ${error.message}`); return data; }
async function tracking(reference, code) {
  const response = await fetch(`${config.url}/functions/v1/track-repair`, { method: 'POST', signal: AbortSignal.timeout(30000), headers: { apikey: config.publishable, 'Content-Type': 'application/json', Origin: config.appUrl }, body: JSON.stringify({ reference, code }) });
  assert.equal(response.headers.get('access-control-allow-origin'), config.appUrl, 'The Vercel origin must be allowed.');
  return { status: response.status, body: await response.json() };
}
const now = new Date();
const date = days => { const day = new Date(now); day.setUTCDate(day.getUTCDate() + days); return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(day); };
try {
  unwrap(await staff.auth.signInWithPassword(accounts.staff), 'Staff login');
  unwrap(await secondDevice.auth.signInWithPassword(accounts.admin), 'Admin login on another session');
  assert.ok((await anonymous.from('repairs').select('id')).error, 'Anonymous users must not read repairs.');
  const intake = { request_id: crypto.randomUUID(), customer_name: 'Defense Test Customer', customer_phone: '0917 555 0199', customer_email: '', device_type: 'Laptop', device: 'Defense sample laptop', issue: 'INTERNAL-DEFENSE-TEST-NOTE', public_summary: 'Battery service', original_due: date(2) };
  const issued = unwrap(await staff.rpc('create_repair', { p_shop_id: accounts.shop_id, p_input: intake }), 'Repair intake');
  const load = async (using = staff) => unwrap(await using.from('repair_workspace').select('*').eq('id', issued.id).single(), 'Read saved repair');
  let row = await load(secondDevice); assert.equal(row.stage, 'Received'); assert.equal(row.received_at.slice(0, 10), now.toISOString().slice(0, 10));
  assert.ok((await staff.rpc('create_repair', { p_shop_id: accounts.shop_id, p_input: intake })).error, 'Repeated intake must not duplicate a job.');
  assert.ok((await staff.rpc('lookup_tracking', { p_reference: issued.reference, p_code: issued.tracking_code })).error, 'Staff/browser callers cannot bypass the tracking Edge Function.');
  let publicResult = await tracking(issued.reference, issued.tracking_code); assert.equal(publicResult.status, 200); assert.equal(publicResult.body.stage, 'Received');
  for (const forbidden of ['customer_name', 'customer_phone', 'issue', 'actor_name']) assert.equal(publicResult.body[forbidden], undefined);
  assert.ok(!JSON.stringify(publicResult.body).includes('INTERNAL-DEFENSE-TEST-NOTE'));
  assert.equal((await tracking(issued.reference, '0000-0000-0000-0000-0000-0000')).status, 404);
  const change = async (action, payload = {}) => { row = await load(); unwrap(await staff.rpc('change_repair', { p_id: issued.id, p_version: row.version, p_action: action, p_payload: payload }), 'Repair update'); };
  await change('advance'); await change('advance');
  await change('delay', { date: date(3), reason: 'Waiting for a replacement battery.' });
  publicResult = await tracking(issued.reference, issued.tracking_code);
  assert.equal(publicResult.body.stage, 'Repairing'); assert.equal(publicResult.body.original_due, date(2)); assert.equal(publicResult.body.revised_due, date(3)); assert.equal(publicResult.body.ever_delayed, true);
  await change('advance'); await change('advance', { collection_verified: true });
  row = await load(secondDevice); assert.equal(row.stage, 'Claimed'); assert.ok(row.claimed_at);
  publicResult = await tracking(issued.reference, issued.tracking_code); assert.equal(publicResult.body.stage, 'Claimed');
  assert.ok(unwrap(await secondDevice.from('repair_workspace').select('id').eq('stage', 'Claimed').eq('id', issued.id), 'Repair history').length);
  // Leave a second active, fictional job so panelists can test tracking themselves.
  const active = unwrap(await staff.rpc('create_repair', { p_shop_id: accounts.shop_id, p_input: { ...intake, request_id: crypto.randomUUID(), customer_id: row.customer_id, device: 'Defense sample phone', device_type: 'Phone', public_summary: 'Charging port diagnosis', original_due: '' } }), 'Second repair intake');
  assert.notEqual(active.reference, issued.reference);
  const backup = { checked_at: new Date().toISOString(), site_url: config.appUrl, completed: issued, active, saved_record: row };
  writeFileSync('defense-check.local.txt', JSON.stringify(backup, null, 2) + '\n', { mode: 0o600 });
  console.log('Cloud checks passed: real admin/staff login, protected data, durable records across independent sessions, unique IDs, private tracking, delays, collection, and history.');
  console.log('Fictional test records remain in the demo shop. Their tracking details and a record snapshot are saved in ignored defense-check.local.txt.');
} finally {
  await Promise.allSettled([staff.auth.signOut({ scope: 'local' }), secondDevice.auth.signOut({ scope: 'local' })]);
}
