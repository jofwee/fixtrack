import { createClient } from 'npm:@supabase/supabase-js@2.119.2';
import { allowedOrigins, apiConfig } from './config.ts';
const readEnv = (name: string) => Deno.env.get(name);
export function serverClient() { const { url, secret } = apiConfig(readEnv); return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } }); }
export function userClient(authorization: string) { const { url, publishable } = apiConfig(readEnv); return createClient(url, publishable, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } }); }
export function headers(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || ''; const allowed = allowedOrigins(readEnv);
  return { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    ...(allowed.includes(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' };
}
export function reply(req: Request, data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: headers(req) }); }
export function preflight(req: Request) { const origin = req.headers.get('origin'); if (origin && !allowedOrigins(readEnv).includes(origin)) return reply(req, { error: 'Origin not allowed.' }, 403); if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(req) }); if (req.method !== 'POST') return reply(req, { error: 'Method not allowed.' }, 405); return null; }
export async function hash(value: string) { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join(''); }
export async function body(req: Request) {
  if (!req.body) throw new Error('Invalid request.');
  const reader = req.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 4096) { await reader.cancel(); throw new Error('Invalid request.'); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
