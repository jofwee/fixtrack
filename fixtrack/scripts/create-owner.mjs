import { settings, adminClient } from './cloud-config.mjs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
const config = settings(process.env, { admin: true });
const db = adminClient(config);
const rl = createInterface({ input: stdin, output: stdout });
try {
  const name = (await rl.question('Owner full name: ')).trim();
  const email = (await rl.question('Owner email: ')).trim();
  const shop = (await rl.question('Shop name: ')).trim();
  const phone = (await rl.question('Shop phone: ')).trim();
  const address = (await rl.question('Shop address: ')).trim();
  if (!name || !shop || !phone || !address || !email.includes('@')) throw new Error('Complete every field.');
  const { data, error } = await db.auth.admin.inviteUserByEmail(email, { redirectTo: `${config.appUrl}/auth/reset` });
  if (error || !data.user) throw new Error(error?.message || 'Owner invitation failed.');
  const { error: provisionError } = await db.rpc('provision_owner', { p_user_id: data.user.id, p_name: name, p_shop_name: shop, p_phone: phone, p_address: address });
  if (provisionError) throw new Error('Owner provisioning failed. The Auth identity was preserved for administrator review: ' + provisionError.message);
  console.log('Owner invitation created. Follow the email link to set a password. For a local Supabase stack, view the email in Mailpit at http://127.0.0.1:54324.');
} finally { rl.close(); }
