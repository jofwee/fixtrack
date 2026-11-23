import { createClient } from 'npm:@supabase/supabase-js@2.119.2';
import { body, preflight, reply, serverClient } from '../_shared/http.ts';
Deno.serve(async req => {
  const early = preflight(req); if (early) return early;
  try {
    const authorization = req.headers.get('authorization') || '';
    if (!authorization.startsWith('Bearer ')) return reply(req, { error: 'Sign in first.' }, 401);
    const db = serverClient();
    const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: { user }, error: authError } = await caller.auth.getUser();
    if (authError || !user) return reply(req, { error: 'Sign in first.' }, 401);
    const input = await body(req);
    if (typeof input.shop_id !== 'string' || typeof input.email !== 'string' || typeof input.name !== 'string' || input.name.trim().length < 1 || input.name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) || input.email.length > 254) return reply(req, { error: 'Enter a name and valid email address.' }, 400);
    // RLS performs the active membership and MFA assurance checks.
    const { data: shop } = await caller.from('shops').select('id').eq('id', input.shop_id).maybeSingle();
    const { data: member } = await caller.from('memberships').select('role,active').eq('shop_id', input.shop_id).eq('user_id', user.id).maybeSingle();
    if (!shop || member?.role !== 'owner' || !member.active) return reply(req, { error: 'Owner access required.' }, 403);
    const { data: allowed, error: limitError } = await db.rpc('consume_request_limit', { p_bucket: `invite:${user.id}`, p_limit: 10, p_window_seconds: 3600 });
    if (limitError || !allowed) return reply(req, { error: 'Invitation limit reached. Try again later.' }, 429);
    const appUrl = Deno.env.get('APP_URL') || 'http://127.0.0.1:5173';
    const { data, error } = await db.auth.admin.inviteUserByEmail(input.email.trim().toLowerCase(), { redirectTo: `${appUrl}/auth/reset` });
    if (error || !data.user) return reply(req, { error: 'Unable to invite this address. It may already have an account.' }, 400);
    const { error: membershipError } = await db.rpc('record_staff_invite', { p_actor: user.id, p_shop_id: input.shop_id, p_user_id: data.user.id, p_name: input.name.trim() });
    if (membershipError) { await db.auth.admin.deleteUser(data.user.id); return reply(req, { error: 'Unable to finish the invitation. Please try again.' }, 400); }
    return reply(req, { success: true });
  } catch { return reply(req, { error: 'Unable to process invitation.' }, 400); }
});
