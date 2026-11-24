export interface BrowserConfig { mode: 'connected' | 'preview' | 'invalid'; url: string; key: string; error: string }
export function browserConfig(rawUrl: string | undefined, rawKey: string | undefined, development: boolean): BrowserConfig {
  const url = rawUrl?.trim() || ''; const key = rawKey?.trim() || '';
  const invalid = (error: string): BrowserConfig => ({ mode: 'invalid', url: '', key: '', error });
  if (!url && !key) return development ? { mode: 'preview', url: '', key: '', error: '' } : invalid('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Vercel, then redeploy.');
  if (!url || !key) return invalid('Both VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are required. Sample access is disabled while Supabase setup is incomplete.');
  let parsed: URL;
  try { parsed = new URL(url); } catch { return invalid('VITE_SUPABASE_URL must be a valid Supabase project URL.'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if ((parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') return invalid('Use an HTTPS Supabase project URL without a path, credentials, or query string.');
  if (key.startsWith('sb_secret_')) return invalid('A secret key was placed in a public VITE_ variable. Remove it immediately, rotate that key, and use a publishable key instead.');
  if (!key.startsWith('sb_publishable_')) {
    try { const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); if (payload.role !== 'anon') return invalid('Only a publishable key or legacy anon key may be used in the browser.'); }
    catch { return invalid('VITE_SUPABASE_PUBLISHABLE_KEY must be a publishable key or legacy anon key.'); }
  }
  return { mode: 'connected', url: parsed.origin, key, error: '' };
}
