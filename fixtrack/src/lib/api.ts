import { createClient } from '@supabase/supabase-js';
import { DEMO_SHOP, seedCustomers, seedRepairs } from './seed';
import { nextStage, normalizeCode, shopDay, validateIntake } from './domain';
import type { Customer, Intake, Profile, Repair, Shop, TrackingResult } from './domain';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key ? createClient(url, key, { auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
export const preview = !supabase;
const STORAGE_KEY = 'fixtrack-preview-v1';
interface PreviewData { repairs: Repair[]; customers: Customer[]; shop: Shop; codes: Record<string, string> }
function localData(): PreviewData {
  try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) { const data = JSON.parse(saved); if (Array.isArray(data.repairs) && Array.isArray(data.customers)) return data; } } catch { /* Reset malformed preview data. */ }
  const repairs = seedRepairs();
  return { repairs, customers: seedCustomers(repairs), shop: DEMO_SHOP, codes: Object.fromEntries(repairs.map(r => [r.reference, 'GREEN2026'])) };
}
function save(data: PreviewData) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function check<T>(result: { data: T | null; error: { message: string } | null }): T { if (result.error) throw new Error(result.error.message); return result.data as T; }
export async function profile(): Promise<Profile | null> {
  if (!supabase) return { userId: 'preview-user', shopId: DEMO_SHOP.id, name: 'Alex Rivera', email: 'alex@example.test', role: 'owner' };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const member = check(await supabase.from('memberships').select('shop_id, role, display_name').eq('user_id', user.id).eq('active', true).maybeSingle()) as { shop_id: string; role: 'owner' | 'staff'; display_name: string } | null;
  if (!member) throw new Error('Your account does not have active shop access. Contact your shop owner.');
  return { userId: user.id, shopId: member.shop_id, name: member.display_name, email: user.email || '', role: member.role };
}
export async function loadWorkspace(shopId: string): Promise<{ repairs: Repair[]; customers: Customer[]; shop: Shop }> {
  if (!supabase) return localData();
  const [repairs, customers, shop] = await Promise.all([
    supabase.from('repair_workspace').select('*').eq('shop_id', shopId).order('received_at', { ascending: false }),
    supabase.from('customers').select('id, name, phone, email').eq('shop_id', shopId).order('name'),
    supabase.from('shops').select('id, name, phone, address').eq('id', shopId).single(),
  ]);
  return { repairs: check(repairs) as Repair[], customers: check(customers), shop: check(shop) };
}
export async function createRepair(shopId: string, input: Intake): Promise<{ id: string; reference: string; tracking_code: string }> {
  validateIntake(input);
  if (supabase) return check(await supabase.rpc('create_repair', { p_shop_id: shopId, p_input: input }));
  const data = localData();
  let customer = input.customer_id ? data.customers.find(c => c.id === input.customer_id) : undefined;
  if (!customer) { customer = { id: crypto.randomUUID(), name: input.customer_name.trim(), phone: input.customer_phone, email: input.customer_email }; data.customers.push(customer); }
  const now = new Date().toISOString(); const id = crypto.randomUUID();
  const reference = `FX-${Math.max(1048, ...data.repairs.map(r => Number(r.reference.slice(3)) || 0)) + 1}`;
  const code = [...crypto.getRandomValues(new Uint8Array(12))].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase().match(/.{4}/g)!.join('-');
  data.repairs.unshift({ id, reference, customer_id: customer.id, customer_name: customer.name, customer_phone: customer.phone, device_type: input.device_type, device: input.device, issue: input.issue, public_summary: input.public_summary, stage: 'Received', received_at: now, updated_at: now, ready_at: null, claimed_at: null, original_due: input.original_due || null, revised_due: null, ever_delayed: false, delay_reason: '', version: 1, events: [{ id: crypto.randomUUID(), kind: 'status', title: 'Received', detail: 'Device checked in at the shop.', actor_name: 'Alex Rivera', customer_visible: true, created_at: now }] });
  data.codes[reference] = normalizeCode(code); save(data);
  return { id, reference, tracking_code: code };
}
export async function changeRepair(repair: Repair, action: string, payload: Record<string, unknown> = {}) {
  if (supabase) { check(await supabase.rpc('change_repair', { p_id: repair.id, p_version: repair.version, p_action: action, p_payload: payload })); return; }
  const data = localData(); const row = data.repairs.find(r => r.id === repair.id);
  if (!row || row.version !== repair.version) throw new Error('This repair has changed. Refresh and try again.');
  const now = new Date().toISOString(); let title = ''; let detail = ''; let visible = true;
  if (action === 'advance') { const next = nextStage(row.stage); if (!next) throw new Error('This repair has already been collected.'); row.stage = next; title = next; if (next === 'Ready for Pickup') row.ready_at = now; if (next === 'Claimed') row.claimed_at = now; }
  else if (action === 'delay') {
    if (!payload.reason || !payload.date || String(payload.date) < shopDay()) throw new Error('Add a reason and a revised date of today or later.');
    if (['Ready for Pickup', 'Claimed'].includes(row.stage)) throw new Error('This repair is already finished.');
    row.ever_delayed = true; row.revised_due = String(payload.date); row.delay_reason = String(payload.reason); title = 'Completion estimate revised'; detail = `${payload.reason} Revised date: ${payload.date}.`;
  } else if (action === 'estimate') { if (row.original_due) throw new Error('Use a schedule revision to preserve the original estimate.'); if (!payload.date || String(payload.date) < shopDay()) throw new Error('Choose today or a later date.'); row.original_due = String(payload.date); title = 'Completion estimate set'; detail = String(payload.date); }
  else if (action === 'note') { if (!String(payload.text || '').trim()) throw new Error('Write a note first.'); title = payload.visible ? 'Update from the shop' : 'Internal note'; detail = String(payload.text).trim(); visible = Boolean(payload.visible); }
  else throw new Error('Unknown action.');
  row.version++; row.updated_at = now; row.events.push({ id: crypto.randomUUID(), kind: action, title, detail, customer_visible: visible, actor_name: 'Alex Rivera', created_at: now }); save(data);
}
export async function saveShop(shop: Shop) { if (supabase) { check(await supabase.rpc('update_shop', { p_shop_id: shop.id, p_name: shop.name, p_phone: shop.phone, p_address: shop.address })); return; } const data = localData(); data.shop = shop; save(data); }
export async function rotateCode(id: string): Promise<string> {
  if (supabase) return check(await supabase.rpc('rotate_tracking_code', { p_id: id }));
  const data = localData(); const row = data.repairs.find(r => r.id === id); if (!row) throw new Error('Repair not found.');
  const code = [...crypto.getRandomValues(new Uint8Array(12))].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase().match(/.{4}/g)!.join('-');
  data.codes[row.reference] = normalizeCode(code); save(data); return code;
}
export async function track(reference: string, code: string): Promise<TrackingResult> {
  if (supabase) {
    const response = await fetch(`${url}/functions/v1/track-repair`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key }, body: JSON.stringify({ reference: reference.trim().toUpperCase(), code }), cache: 'no-store' });
    const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to check this repair. Try again.'); return body;
  }
  const data = localData(); const r = data.repairs.find(r => r.reference === reference.trim().toUpperCase());
  if (!r || data.codes[r.reference] !== normalizeCode(code)) throw new Error('No matching repair found. Check your reference and private code.');
  return { reference: r.reference, device: r.device, public_summary: r.public_summary, stage: r.stage, original_due: r.original_due, revised_due: r.revised_due, ever_delayed: r.ever_delayed, delay_reason: r.delay_reason, ready_at: r.ready_at, claimed_at: r.claimed_at, updated_at: r.updated_at, shop_name: data.shop.name, shop_phone: data.shop.phone, events: r.events.filter(e => e.customer_visible).map(({ id, title, detail, created_at }) => ({ id, title, detail, created_at })) };
}
export function resetPreview() { localStorage.removeItem(STORAGE_KEY); }
