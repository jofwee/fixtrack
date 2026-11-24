import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { settings } from '../scripts/cloud-config.mjs';
const base = { VITE_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', APP_URL: 'https://fixtrack-example.vercel.app' };
test('cloud setup reports missing fields without leaking provided values', () => {
  assert.throws(() => settings(base, { management: true }), /SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD/);
  assert.throws(() => settings(base, { admin: true }), /SUPABASE_SECRET_KEY/);
  const result = settings({ ...base, SUPABASE_ACCESS_TOKEN: 'private-token', SUPABASE_DB_PASSWORD: 'private-password' }, { management: true });
  assert.equal(result.ref, 'abcdefghijklmnopqrst'); assert.equal(result.appUrl, base.APP_URL);
});
test('cloud setup rejects wildcard origins and privileged browser keys', () => {
  assert.throws(() => settings({ ...base, ALLOWED_ORIGINS: 'https://*.vercel.app' }), /exact HTTPS/);
  assert.throws(() => settings({ ...base, APP_URL: 'https://*.vercel.app' }), /exact HTTPS/);
  const jwt = `header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`;
  assert.throws(() => settings({ ...base, VITE_SUPABASE_PUBLISHABLE_KEY: jwt }), /publishable key or legacy anon key/);
});
test('build preflight blocks a private key before Vite can publish a bundle', () => {
  const fakeKey = 'sb_secret_test';
  const result = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/check-public-env.mjs'], {
    cwd: new URL('../', import.meta.url), encoding: 'utf8',
    env: { ...process.env, VITE_SUPABASE_URL: base.VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY: fakeKey },
  });
  assert.equal(result.status, 1); assert.match(result.stderr, /secret key was placed/); assert.ok(!result.stderr.includes(fakeKey));
});
