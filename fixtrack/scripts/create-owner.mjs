import { createClient } from '@supabase/supabase-js';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.');
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const rl = createInterface({ input: stdin, output: stdout });
try {
  const name = (await rl.question('Owner full name: ')).trim();
  const email = (await rl.question('Owner email: ')).trim();
  const shop = (await rl.question('Shop name: ')).trim();
  const phone = (await rl.question('Shop phone: ')).trim();
  const address = (await rl.question('Shop address: ')).trim();
  if (!name || !shop || !phone || !address || !email.includes('@')) throw new Error('Complete every field.');
  // No default/shared password. The invite goes to local Mailpit in local development.
  const { data, error } = await db.auth.admin.inviteUserByEmail(email, { redirectTo: 'http://127.0.0.1:5173/auth/reset' });
  if (error || !data.user) throw new Error(error?.message || 'Owner invitation failed.');
  const { error: provisionError } = await db.rpc('provision_owner', { p_user_id: data.user.id, p_name: name, p_shop_name: shop, p_phone: phone, p_address: address });
  if (provisionError) { await db.auth.admin.deleteUser(data.user.id); throw new Error('Owner provisioning failed: ' + provisionError.message); }
  console.log('Owner invitation created. Open local Mailpit at http://127.0.0.1:54324 and follow the password setup link.');
} finally { rl.close(); }
