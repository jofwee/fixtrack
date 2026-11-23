import { body, hash, preflight, reply, serverClient } from '../_shared/http.ts';
Deno.serve(async req => {
  const early = preflight(req); if (early) return early;
  const db = serverClient();
  try {
    const input = await body(req);
    if (typeof input.reference !== 'string' || typeof input.code !== 'string' || !/^FX-\d{1,15}$/i.test(input.reference.trim()) || !/^[a-f0-9\s-]{24,60}$/i.test(input.code)) return reply(req, { error: 'No matching repair found. Check your reference and private code.' }, 404);
    const reference = input.reference.trim().toUpperCase();
    // Use the edge gateway's proxy-added last address. Configure trusted ingress
    // before deployment; a caller-controlled first X-Forwarded-For value is ignored.
    const ip = req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || 'local';
    const [source, target] = await Promise.all([
      db.rpc('consume_request_limit', { p_bucket: `track-ip:${await hash(ip)}`, p_limit: 30, p_window_seconds: 300 }),
      db.rpc('consume_request_limit', { p_bucket: `track-ref:${await hash(reference)}`, p_limit: 15, p_window_seconds: 300 }),
    ]);
    if (source.error || target.error) return reply(req, { error: 'Tracking is temporarily unavailable. Try again shortly.' }, 503);
    if (!source.data || !target.data) return reply(req, { error: 'Too many attempts. Please wait five minutes before trying again.' }, 429);
    const { data, error } = await db.rpc('lookup_tracking', { p_reference: reference, p_code: input.code });
    if (error) return reply(req, { error: 'Tracking is temporarily unavailable. Try again shortly.' }, 503);
    if (!data) return reply(req, { error: 'No matching repair found. Check your reference and private code.' }, 404);
    return reply(req, data);
  } catch { return reply(req, { error: 'Invalid tracking request.' }, 400); }
});
