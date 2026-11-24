import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { settings, adminClient } from './cloud-config.mjs';
const config = settings(process.env, { admin: true });
const path = 'defense-accounts.local.txt';
if (existsSync(path)) throw new Error('defense-accounts.local.txt already exists. Preserve those credentials; this script will not overwrite accounts or reset passwords.');
const accounts = {
  site_url: config.appUrl, project_url: config.url, shop_id: null, state: 'preparing',
  admin: { email: process.env.DEFENSE_ADMIN_EMAIL?.trim() || 'admin@fixtrack.test', password: randomBytes(18).toString('base64url') + 'aA1!', id: null },
  staff: { email: process.env.DEFENSE_STAFF_EMAIL?.trim() || 'staff@fixtrack.test', password: randomBytes(18).toString('base64url') + 'aA1!', id: null },
};
for (const account of [accounts.admin, accounts.staff]) if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email)) throw new Error('Use valid defense account email addresses.');
if (accounts.admin.email.toLowerCase() === accounts.staff.email.toLowerCase()) throw new Error('Admin and staff emails must be different.');
const db = adminClient(config);
for (let page = 1; ; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw new Error('Unable to check existing accounts. Check the server-only secret key.');
  if (data.users.some(u => [accounts.admin.email, accounts.staff.email].some(email => email.toLowerCase() === u.email?.toLowerCase()))) throw new Error('A requested defense email already exists. Choose different DEFENSE_ADMIN_EMAIL / DEFENSE_STAFF_EMAIL values. Existing accounts were not changed.');
  if (data.users.length < 1000) break;
}
const save = () => writeFileSync(path, JSON.stringify(accounts, null, 2) + '\n', { mode: 0o600 });
writeFileSync(path, JSON.stringify(accounts, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
try {
  const { data: owner, error: ownerError } = await db.auth.admin.createUser({ email: accounts.admin.email, password: accounts.admin.password, email_confirm: true });
  if (ownerError || !owner.user) throw new Error('Unable to create the owner account.');
  accounts.admin.id = owner.user.id; save();
  const { data: shopId, error: shopError } = await db.rpc('provision_owner', { p_user_id: owner.user.id, p_name: 'Defense Admin', p_shop_name: 'FixTrack Demo Shop', p_phone: '0917 555 0100', p_address: 'Las Piñas City, Metro Manila' });
  if (shopError) { await db.auth.admin.deleteUser(owner.user.id); accounts.admin.id = null; save(); throw new Error('Unable to provision the shop. Apply database migrations first.'); }
  accounts.shop_id = shopId; save();
  const { data: staff, error: staffError } = await db.auth.admin.createUser({ email: accounts.staff.email, password: accounts.staff.password, email_confirm: true });
  if (staffError || !staff.user) throw new Error('Owner is ready, but staff creation failed. The saved credential file records the completed steps.');
  accounts.staff.id = staff.user.id; save();
  const { error: membershipError } = await db.rpc('record_staff_invite', { p_actor: owner.user.id, p_shop_id: shopId, p_user_id: staff.user.id, p_name: 'Defense Staff' });
  if (membershipError) { await db.auth.admin.deleteUser(staff.user.id); accounts.staff.id = null; save(); throw new Error('Owner is ready, but staff access could not be assigned.'); }
  accounts.state = 'ready'; save();
  console.log('Real Supabase admin and staff accounts are ready. Their generated passwords are saved only in ignored defense-accounts.local.txt. Do not upload that file.');
  console.log('These are defense-only accounts. The default .test addresses cannot receive recovery email; use real DEFENSE_ADMIN_EMAIL / DEFENSE_STAFF_EMAIL values if email delivery is part of the demonstration.');
} catch (error) { accounts.state = 'incomplete'; save(); throw error; }
