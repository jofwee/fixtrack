import { createClient } from '@supabase/supabase-js';
export function settings(env = process.env, { management = false, admin = false } = {}) {
  const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'APP_URL'];
  if (management) required.push('SUPABASE_ACCESS_TOKEN', 'SUPABASE_DB_PASSWORD');
  const missing = required.filter(name => !env[name]?.trim());
  if (admin && !(env.SUPABASE_SECRET_KEY?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim())) missing.push('SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)');
  if (missing.length) throw new Error('Fill these fields in .env.local: ' + missing.join(', '));
  const url = new URL(env.VITE_SUPABASE_URL.trim()); const app = new URL(env.APP_URL.trim());
  const local = ['localhost', '127.0.0.1'].includes(app.hostname);
  if (url.hostname.includes('*') || url.username || url.password || url.search || url.hash || url.pathname !== '/' || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw new Error('Use a plain HTTPS Supabase project URL.');
  if (app.hostname.includes('*') || app.username || app.password || app.search || app.hash || app.pathname !== '/' || (app.protocol !== 'https:' && !(local && app.protocol === 'http:'))) throw new Error('APP_URL must be an exact HTTPS website origin.');
  const ref = env.SUPABASE_PROJECT_REF?.trim() || url.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/)?.[1];
  if (management && (!ref || !/^[a-z0-9]{20}$/.test(ref))) throw new Error('Set a valid Supabase project URL or SUPABASE_PROJECT_REF.');
  const publishable = env.VITE_SUPABASE_PUBLISHABLE_KEY.trim();
  if (publishable.startsWith('sb_secret_')) throw new Error('A secret key cannot be used as VITE_SUPABASE_PUBLISHABLE_KEY.');
  if (!publishable.startsWith('sb_publishable_')) {
    let role; try { role = JSON.parse(Buffer.from(publishable.split('.')[1], 'base64url').toString('utf8')).role; } catch { /* Rejected below. */ }
    if (role !== 'anon') throw new Error('Use a publishable key or legacy anon key in VITE_SUPABASE_PUBLISHABLE_KEY.');
  }
  const extraOrigins = (env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
  for (const origin of extraOrigins) { const parsed = new URL(origin); if (parsed.hostname.includes('*') || parsed.origin !== origin || (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(parsed.hostname))) throw new Error('ALLOWED_ORIGINS must contain exact HTTPS origins or local development origins.'); }
  return { url: url.origin, publishable, secret: env.SUPABASE_SECRET_KEY?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim(), appUrl: app.origin, ref, origins: [...new Set([app.origin, ...extraOrigins])], token: env.SUPABASE_ACCESS_TOKEN?.trim() };
}
export function adminClient(config) { return createClient(config.url, config.secret, { auth: { persistSession: false, autoRefreshToken: false } }); }
