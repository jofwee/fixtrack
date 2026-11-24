import { test } from 'node:test';
import assert from 'node:assert/strict';
import { browserConfig } from '../src/lib/config.ts';
import { allowedOrigins, apiConfig, appOrigin } from '../supabase/functions/_shared/config.ts';
const url = 'https://abcdefghijklmnopqrst.supabase.co';
test('production never opens a sample workspace when keys are absent or incomplete', () => {
  assert.equal(browserConfig(undefined, undefined, false).mode, 'invalid');
  assert.equal(browserConfig(undefined, undefined, true).mode, 'preview');
  assert.equal(browserConfig(url, '', true).mode, 'invalid');
  assert.equal(browserConfig(url, 'sb_publishable_example', false).mode, 'connected');
});
test('privileged keys cannot be accepted by browser configuration', () => {
  assert.equal(browserConfig(url, 'sb_secret_example', false).mode, 'invalid');
  const jwt = `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ role: 'service_role' }))}.signature`;
  assert.equal(browserConfig(url, jwt, false).mode, 'invalid');
  const anon = `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ role: 'anon' }))}.signature`;
  assert.equal(browserConfig(url, anon, false).mode, 'connected');
  assert.equal(browserConfig(url + '/auth/v1', anon, false).mode, 'invalid');
});
test('Edge functions accept new injected key dictionaries and legacy local keys', () => {
  const modern: Record<string, string> = { SUPABASE_URL: url, SUPABASE_SECRET_KEYS: '{"default":"server-key"}', SUPABASE_PUBLISHABLE_KEYS: '{"default":"public-key"}' };
  assert.deepEqual(apiConfig(name => modern[name]), { url, secret: 'server-key', publishable: 'public-key' });
  const legacy: Record<string, string> = { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: 'legacy-secret', SUPABASE_ANON_KEY: 'legacy-public' };
  assert.equal(apiConfig(name => legacy[name]).secret, 'legacy-secret');
  assert.throws(() => apiConfig(() => undefined), /incomplete/);
});
test('hosted functions fail closed for missing, wildcard or unapproved origins', () => {
  const values: Record<string, string> = { SUPABASE_URL: url, APP_URL: 'https://fixtrack-example.vercel.app', ALLOWED_ORIGINS: 'https://other.vercel.app,https://*.vercel.app,http://127.0.0.1:5173' };
  assert.deepEqual(allowedOrigins(name => values[name]), ['https://fixtrack-example.vercel.app', 'https://other.vercel.app', 'http://127.0.0.1:5173']);
  assert.throws(() => appOrigin(name => name === 'SUPABASE_URL' ? url : undefined), /APP_URL/);
  assert.deepEqual(allowedOrigins(name => name === 'SUPABASE_URL' ? url : undefined), []);
});
