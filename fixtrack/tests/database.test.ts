import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('PostgreSQL migration, RLS, transactional workflow and private tracking', async t => {
  const db = new PGlite();
  // PGlite runs real PostgreSQL. Supabase's auth schema and pgcrypto interface are
  // simulated here; this does not test GoTrue, Edge Runtime, SMTP or pgcrypto itself.
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema extensions;
    create table auth.users(id uuid primary key);
    create table auth.mfa_factors(user_id uuid, status text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
    grant usage on schema auth to anon, authenticated, service_role;
    create function extensions.gen_random_bytes(n integer) returns bytea language sql volatile as $$ select substring(sha256(convert_to(gen_random_uuid()::text,'UTF8')) from 1 for n) $$;
    create function extensions.digest(value text, algorithm text) returns bytea language sql immutable as $$ select sha256(convert_to(value,'UTF8')) $$;
  `);
  const directory = new URL('../supabase/migrations/', import.meta.url);
  for (const file of (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()) {
    const migration = (await readFile(new URL(file, directory), 'utf8')).replace('create extension if not exists pgcrypto with schema extensions;', '');
    await db.exec(migration);
  }
  const ownerA = '11111111-1111-4111-8111-111111111111', ownerB = '22222222-2222-4222-8222-222222222222', staffA = '33333333-3333-4333-8333-333333333333';
  await db.query('insert into auth.users(id) values ($1),($2),($3)', [ownerA, ownerB, staffA]);
  const query = async (sql: string, params: unknown[] = []) => (await db.query<Record<string, unknown>>(sql, params)).rows;
  const a = String((await query("select public.provision_owner($1,'Owner A','Shop A','09175550000','Manila') as id", [ownerA]))[0].id);
  const b = String((await query("select public.provision_owner($1,'Owner B','Shop B','09175550001','Manila') as id", [ownerB]))[0].id);
  await db.query("insert into public.memberships(shop_id,user_id,role,display_name) values($1,$2,'staff','Staff A')", [a, staffA]);
  async function asUser(user: string, aal = 'aal1') { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)", [user, JSON.stringify({ sub: user, aal })]); await db.exec('set role authenticated'); }
  const input = { request_id: '44444444-4444-4444-8444-444444444444', customer_name: 'Test customer', customer_phone: '0917 555 0000', customer_email: '', device_type: 'Laptop', device: 'Test laptop', issue: 'Internal issue details', public_summary: 'Customer-safe issue summary', original_due: '2099-12-31' };
  let created: { id: string; reference: string; tracking_code: string };
  await t.test('owner can create durable repair, customer, credential and event atomically', async () => {
    await asUser(ownerA);
    created = (await query('select public.create_repair($1,$2::jsonb) as result', [a, JSON.stringify(input)]))[0].result as typeof created;
    assert.match(created.reference, /^FX-\d+$/); assert.match(created.tracking_code, /^[A-F0-9]{4}(?:-[A-F0-9]{4}){5}$/);
    const repairs = await query('select * from public.repair_workspace'); assert.equal(repairs.length, 1); assert.equal((repairs[0].events as unknown[]).length, 1);
    await assert.rejects(query('select public.create_repair($1,$2::jsonb)', [a, JSON.stringify(input)]), /already saved/);
    assert.equal((await query('select * from public.customers')).length, 1);
  });
  await t.test('anonymous access, direct writes and privilege escalation are denied', async () => {
    await db.exec('reset role; set role anon');
    await assert.rejects(query('select * from public.repair_workspace'), /permission denied/);
    await assert.rejects(query('select public.lookup_tracking($1,$2)', [created.reference, created.tracking_code]), /permission denied/);
    await asUser(staffA);
    await assert.rejects(query("update public.repairs set stage='Claimed'"), /permission denied/);
    await assert.rejects(query("update public.memberships set role='owner'"), /permission denied/);
    await assert.rejects(query("select public.update_shop($1,'Stolen','09175550000','Manila')", [a]), /Owner access required/);
    await assert.rejects(query('select * from private.tracking_credentials'), /permission denied/);
  });
  await t.test('cross-shop reads and repair mutations are blocked', async () => {
    await asUser(ownerB);
    assert.equal((await query('select * from public.repair_workspace')).length, 0);
    assert.equal((await query('select * from public.customers')).length, 0);
    await assert.rejects(query("select public.change_repair($1,1,'advance')", [created.id]), /Access denied/);
    await assert.rejects(query('select public.create_repair($1,$2::jsonb)', [a, JSON.stringify({ ...input, request_id: crypto.randomUUID() })]), /Access denied/);
    assert.equal((await query('select * from public.shops')).length, 1);
  });
  await t.test('status events, optimistic concurrency and delay revisions preserve history', async () => {
    await asUser(staffA);
    await query("select public.change_repair($1,1,'advance')", [created.id]);
    await assert.rejects(query("select public.change_repair($1,1,'advance')", [created.id]), /has changed/);
    await assert.rejects(query("select public.change_repair($1,2,'delay',$2::jsonb)", [created.id, JSON.stringify({ date: '2099-12-31', reason: '' })]), /Explain the delay/);
    assert.equal((await query('select version from public.repairs'))[0].version, 2);
    await query("select public.change_repair($1,2,'delay',$2::jsonb)", [created.id, JSON.stringify({ date: '2100-01-03', reason: 'Waiting for replacement parts.' })]);
    const row = (await query('select original_due::text,revised_due::text,ever_delayed,version from public.repairs'))[0];
    assert.equal(row.original_due, '2099-12-31'); assert.equal(row.revised_due, '2100-01-03'); assert.equal(row.ever_delayed, true); assert.equal(row.version, 3);
    await query("select public.change_repair($1,3,'note',$2::jsonb)", [created.id, JSON.stringify({ text: 'PRIVATE-NOTE-MARKER', visible: false })]);
  });
  await t.test('tracking returns one safe projection and never internal data', async () => {
    await db.exec('reset role; set role service_role');
    const result = (await query('select public.lookup_tracking($1,$2) as result', [created.reference, created.tracking_code]))[0].result as Record<string, unknown>;
    assert.equal(result.device, 'Test laptop'); assert.equal(result.ever_delayed, true);
    assert.equal(result.customer_phone, undefined); assert.equal(result.customer_name, undefined); assert.equal(result.issue, undefined);
    assert.ok(!JSON.stringify(result).includes('PRIVATE-NOTE-MARKER')); assert.ok(!JSON.stringify(result).includes('Internal issue details'));
    assert.equal((await query('select public.lookup_tracking($1,$2) as result', [created.reference, 'WRONG']))[0].result, null);
    assert.equal((await query('select public.lookup_tracking($1,$2) as result', ['FX-9999999', created.tracking_code]))[0].result, null);
  });
  await t.test('shared request limiter counts across calls', async () => {
    for (const expected of [true, true, false, false]) assert.equal((await query("select public.consume_request_limit('test-bucket',2,300) as allowed"))[0].allowed, expected);
  });
  await t.test('replaced codes stop working and staff cannot rotate codes', async () => {
    await asUser(staffA); await assert.rejects(query('select public.rotate_tracking_code($1)', [created.id]), /Owner access required/);
    await asUser(ownerA); const newCode = (await query('select public.rotate_tracking_code($1) as code', [created.id]))[0].code;
    assert.notEqual(newCode, created.tracking_code);
    await db.exec('reset role; set role service_role'); assert.equal((await query('select public.lookup_tracking($1,$2) as result', [created.reference, created.tracking_code]))[0].result, null);
    assert.ok((await query('select public.lookup_tracking($1,$2) as result', [created.reference, newCode]))[0].result);
  });
  await t.test('deactivated staff lose database access even with an existing identity', async () => {
    await asUser(ownerA); await query('select public.set_staff_active($1,$2,false)', [a, staffA]);
    await asUser(staffA); assert.equal((await query('select * from public.repairs')).length, 0);
    await assert.rejects(query("select public.change_repair($1,4,'advance')", [created.id]), /Access denied/);
  });
  await t.test('enrolled MFA requires elevated assurance for protected data', async () => {
    await db.exec('reset role'); await db.query("insert into auth.mfa_factors(user_id,status) values($1,'verified')", [ownerA]);
    await asUser(ownerA, 'aal1'); assert.equal((await query('select * from public.repairs')).length, 0);
    await asUser(ownerA, 'aal2'); assert.equal((await query('select * from public.repairs')).length, 1);
  });
  await t.test('collection ends the workflow and keeps records read-only', async () => {
    await query("select public.change_repair($1,4,'advance')", [created.id]);
    await query("select public.change_repair($1,5,'advance')", [created.id]);
    await query("select public.change_repair($1,6,'advance','{\"collection_verified\":true}')", [created.id]);
    const repair = (await query('select stage, ready_at, claimed_at, ever_delayed from public.repairs'))[0];
    assert.equal(repair.stage, 'Claimed'); assert.ok(repair.ready_at); assert.ok(repair.claimed_at); assert.equal(repair.ever_delayed, true);
    await assert.rejects(query("select public.change_repair($1,7,'note',$2::jsonb)", [created.id, JSON.stringify({ text: 'Late edit', visible: true })]), /read-only/);
  });
  await t.test('jobs without an estimate can become ready, and collection requires explicit verification', async () => {
    const issued = (await query('select public.create_repair($1,$2::jsonb) as result', [a, JSON.stringify({ ...input, request_id: crypto.randomUUID(), original_due: '' })]))[0].result as typeof created;
    for (const version of [1, 2, 3]) await query("select public.change_repair($1,$2,'advance')", [issued.id, version]);
    const row = (await query('select stage,ever_delayed from public.repairs where id=$1', [issued.id]))[0];
    assert.equal(row.stage, 'Ready for Pickup'); assert.equal(row.ever_delayed, false);
    await assert.rejects(query("select public.change_repair($1,4,'advance')", [issued.id]), /recipient was verified/);
    await query("select public.change_repair($1,4,'advance','{\"collection_verified\":true}')", [issued.id]);
  });
  await db.close();
});
