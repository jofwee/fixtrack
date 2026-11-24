type ReadEnv = (name: string) => string | undefined;
function namedKey(read: ReadEnv, name: string): string {
  try { const value = JSON.parse(read(name) || '{}'); return typeof value.default === 'string' ? value.default : ''; } catch { return ''; }
}
export function apiConfig(read: ReadEnv) {
  const url = read('SUPABASE_URL')?.trim();
  const secret = namedKey(read, 'SUPABASE_SECRET_KEYS') || read('SUPABASE_SECRET_KEY') || read('SUPABASE_SERVICE_ROLE_KEY');
  const publishable = namedKey(read, 'SUPABASE_PUBLISHABLE_KEYS') || read('SUPABASE_PUBLISHABLE_KEY') || read('SUPABASE_ANON_KEY');
  if (!url || !secret || !publishable) throw new Error('Function API settings are incomplete.');
  return { url, secret, publishable };
}
export function appOrigin(read: ReadEnv): string {
  const raw = read('APP_URL')?.trim();
  if (!raw) {
    const backend = read('SUPABASE_URL') || '';
    if (/^http:\/\/(?:127\.0\.0\.1|localhost|kong)(?::\d+)?\/?$/.test(backend)) return 'http://127.0.0.1:5173';
    throw new Error('Set APP_URL to the deployed website origin.');
  }
  const parsed = new URL(raw);
  const local = ['localhost', '127.0.0.1'].includes(parsed.hostname);
  if (parsed.hostname.includes('*') || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/' || (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:'))) throw new Error('APP_URL must be an exact HTTPS origin.');
  return parsed.origin;
}
export function allowedOrigins(read: ReadEnv): string[] {
  let primary: string;
  try { primary = appOrigin(read); } catch { return []; }
  const origins = [primary];
  for (const value of (read('ALLOWED_ORIGINS') || '').split(',').map(s => s.trim()).filter(Boolean)) {
    try { const parsed = new URL(value); if (!parsed.hostname.includes('*') && parsed.origin === value && (parsed.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(parsed.hostname))) origins.push(value); } catch { /* Reject invalid or wildcard origins. */ }
  }
  return [...new Set(origins)];
}
