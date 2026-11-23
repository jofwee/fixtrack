import { createClient } from 'npm:@supabase/supabase-js@2.119.2';
export function serverClient() { return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } }); }
const allowed = (Deno.env.get('ALLOWED_ORIGINS') || 'http://127.0.0.1:5173,http://localhost:5173').split(',').map(s => s.trim());
export function headers(req: Request) { const origin = req.headers.get('origin') || ''; return { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0], 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' }; }
export function reply(req: Request, data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: headers(req) }); }
export function preflight(req: Request) { if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(req) }); if (req.method !== 'POST') return reply(req, { error: 'Method not allowed.' }, 405); const origin = req.headers.get('origin'); if (origin && !allowed.includes(origin)) return reply(req, { error: 'Origin not allowed.' }, 403); return null; }
export async function hash(value: string) { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join(''); }
export async function body(req: Request) {
  if (!req.body) throw new Error('Invalid request.');
  const reader = req.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 4096) { await reader.cancel(); throw new Error('Invalid request.'); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
