import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { settings } from './cloud-config.mjs';

const config = settings(process.env, { management: true });
if (process.argv.includes('--check')) { console.log('Cloud setup fields are complete. No remote changes made.'); process.exit(0); }
const require = createRequire(import.meta.url);
const packagePath = require.resolve('supabase/package.json');
const manifest = JSON.parse(readFileSync(packagePath, 'utf8'));
const cliPath = resolve(dirname(packagePath), typeof manifest.bin === 'string' ? manifest.bin : manifest.bin.supabase);
async function cli(args) {
  const status = await new Promise((done, fail) => { const child = spawn(process.execPath, [cliPath, ...args], { stdio: 'inherit', env: { ...process.env, SUPABASE_ACCESS_TOKEN: config.token, SUPABASE_DB_PASSWORD: process.env.SUPABASE_DB_PASSWORD } }); child.on('error', fail); child.on('exit', done); });
  if (status !== 0) throw new Error('Supabase command failed: ' + args.slice(0, 2).join(' '));
}
async function management(path, options = {}) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${config.ref}/${path}`, { ...options, signal: AbortSignal.timeout(30000), headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' } });
  if (!response.ok) throw new Error(`Supabase management request failed (HTTP ${response.status}). Check token scopes and project permissions.`);
  const body = await response.text();
  return body.trim() ? JSON.parse(body) : null;
}
console.log(`Preparing Supabase project ${config.ref} for ${config.appUrl}.`);
await cli(['link', '--project-ref', config.ref]);
await cli(['db', 'push', '--linked', '--skip-vault', '--dry-run']);
await cli(['db', 'push', '--linked', '--skip-vault', '--yes']);
// Never print the auth config response: it can contain provider secrets.
const current = await management('config/auth');
const redirects = new Set([...(current.uri_allow_list || '').split(',').filter(Boolean), ...config.origins.map(origin => `${origin}/auth/reset`)]);
await management('config/auth', { method: 'PATCH', body: JSON.stringify({ site_url: config.appUrl, uri_allow_list: [...redirects].join(','), disable_signup: true, external_anonymous_users_enabled: false, password_min_length: 12, jwt_exp: 900, mfa_totp_enroll_enabled: true, mfa_totp_verify_enabled: true }) });
await management('secrets', { method: 'POST', body: JSON.stringify([{ name: 'APP_URL', value: config.appUrl }, { name: 'ALLOWED_ORIGINS', value: config.origins.join(',') }]) });
for (const name of ['track-repair', 'invite-staff']) await cli(['functions', 'deploy', name, '--project-ref', config.ref, '--use-api', '--no-verify-jwt']);
const auth = await management('config/auth');
if (!auth.disable_signup || auth.site_url !== config.appUrl || !auth.mfa_totp_enroll_enabled || !auth.mfa_totp_verify_enabled) throw new Error('Auth settings could not be verified.');
console.log('Cloud database, restricted Auth settings, allowed origins, and Edge Functions are configured. Next: create defense accounts and run the cloud workflow check.');
