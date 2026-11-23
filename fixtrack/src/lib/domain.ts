export const STAGES = ['Received', 'Diagnosing', 'Repairing', 'Ready for Pickup', 'Claimed'] as const;
export type Stage = typeof STAGES[number];
export type Role = 'owner' | 'staff';
export interface Profile { userId: string; shopId: string; name: string; email: string; role: Role }
export interface Shop { id: string; name: string; phone: string; address: string }
export interface Customer { id: string; name: string; phone: string; email: string }
export interface RepairEvent { id: string; kind: string; title: string; detail: string; created_at: string; actor_name: string; customer_visible: boolean }
export interface Repair { id: string; reference: string; customer_id: string; customer_name: string; customer_phone: string; device_type: string; device: string; issue: string; public_summary: string; stage: Stage; received_at: string; updated_at: string; ready_at: string | null; claimed_at: string | null; original_due: string | null; revised_due: string | null; ever_delayed: boolean; delay_reason: string; version: number; events: RepairEvent[] }
export interface Intake { request_id?: string; customer_name: string; customer_phone: string; customer_email: string; customer_id?: string; device_type: string; device: string; issue: string; public_summary: string; original_due: string }
export interface TrackingResult { reference: string; device: string; public_summary: string; stage: Stage; original_due: string | null; revised_due: string | null; ever_delayed: boolean; delay_reason: string; ready_at: string | null; claimed_at: string | null; updated_at: string; shop_name: string; shop_phone: string; events: Pick<RepairEvent, 'id' | 'title' | 'detail' | 'created_at'>[] }
export function shopDay(date = new Date()): string { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); }
export function dayOffset(days: number): string { const date = new Date(); date.setUTCDate(date.getUTCDate() + days); return shopDay(date); }
export function schedule(repair: Pick<Repair, 'stage' | 'original_due' | 'revised_due' | 'ever_delayed'>, today = shopDay()) {
  if (repair.stage === 'Claimed') return 'Collected';
  if (repair.stage === 'Ready for Pickup') return 'Ready for pickup';
  const due = repair.revised_due || repair.original_due;
  if (!due) return 'Not set';
  if (due < today) return 'Overdue';
  return repair.ever_delayed ? 'Revised schedule' : 'On schedule';
}
export function dateLabel(value: string | null, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', ...options }).format(new Date(value.length === 10 ? `${value}T04:00:00Z` : value));
}
export function initials(name: string) { return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(); }
export function nextStage(stage: Stage): Stage | null { return STAGES[STAGES.indexOf(stage) + 1] || null; }
export function normalizeCode(code: string) { return code.replace(/[-\s]/g, '').toUpperCase(); }
export function validateIntake(input: Intake) {
  if (!input.customer_name.trim() || !input.customer_phone.trim() || !input.device.trim() || !input.issue.trim() || !input.public_summary.trim()) throw new Error('Please complete all required fields.');
  if (input.customer_name.length > 120 || input.device.length > 160 || input.issue.length > 2000 || input.public_summary.length > 400) throw new Error('One or more fields are too long.');
  if (!/^[+\d()\s-]{7,24}$/.test(input.customer_phone)) throw new Error('Enter a valid contact number.');
  if (input.original_due && input.original_due < shopDay()) throw new Error('The estimated completion date cannot be in the past.');
}
