import { dayOffset } from './domain';
import type { Customer, Repair, Stage } from './domain';
export const DEMO_SHOP = { id: 'preview-shop', name: 'CPE Electronic Repair Shop', phone: '0917 555 0100', address: 'Las Piñas City, Metro Manila' };
const rows: [string, string, string, string, string, Stage, number][] = [
  ['Maria Santos', 'Laptop', 'MacBook Air M2', 'Battery replacement', 'Battery service and testing', 'Repairing', 1],
  ['Gabriel Cruz', 'Phone', 'iPhone 13', 'Cracked display', 'Display replacement', 'Ready for Pickup', 0],
  ['Andrea Reyes', 'Laptop', 'ASUS VivoBook 15', 'Unexpected shutdowns', 'Diagnosis of power issue', 'Diagnosing', -1],
  ['Joaquin Lim', 'Phone', 'Samsung Galaxy S23', 'Charging port issue', 'Charging port service', 'Repairing', 0],
  ['Sofia Garcia', 'Tablet', 'iPad Air 5', 'Touchscreen unresponsive', 'Touchscreen assessment', 'Received', 3],
  ['Miguel Torres', 'Desktop', 'Custom desktop PC', 'No display output', 'Display output diagnosis', 'Diagnosing', 2],
  ['Isabella Tan', 'Laptop', 'Lenovo ThinkPad T14', 'Keyboard replacement', 'Keyboard replacement', 'Repairing', -2],
  ['Lucas Mendoza', 'Phone', 'Google Pixel 8', 'Battery drains quickly', 'Battery testing', 'Ready for Pickup', -1],
  ['Camille Ramos', 'Laptop', 'Acer Aspire 5', 'Slow performance', 'Performance assessment', 'Received', 4],
  ['Daniel Flores', 'Tablet', 'Samsung Galaxy Tab S9', 'Screen flickering', 'Display assessment', 'Diagnosing', 2],
  ['Chloe Villanueva', 'Phone', 'iPhone 12 mini', 'Speaker not working', 'Speaker service', 'Received', 5],
  ['Rafael Aquino', 'Laptop', 'Dell Inspiron 14', 'Fan noise', 'Cooling system service', 'Claimed', -3],
];
export function seedRepairs(): Repair[] {
  return rows.map(([name, type, device, issue, summary, stage, due], i) => {
    const received = `${dayOffset(-i % 5 - 2)}T02:30:00Z`;
    const updated = new Date(Date.now() - i * 35 * 60000).toISOString();
    const events = [{ id: `event-${i}-0`, kind: 'status', title: 'Received', detail: 'Device checked in at the shop.', created_at: received, actor_name: 'Alex Rivera', customer_visible: true }];
    const stages: Stage[] = ['Received', 'Diagnosing', 'Repairing', 'Ready for Pickup', 'Claimed'];
    stages.slice(1, stages.indexOf(stage) + 1).forEach((s, n) => events.push({ id: `event-${i}-${n + 1}`, kind: 'status', title: s, detail: s === 'Ready for Pickup' ? 'Your device is ready. Please contact the shop to arrange collection.' : '', created_at: updated, actor_name: 'Alex Rivera', customer_visible: true }));
    return { id: `preview-${i}`, reference: `FX-${1048 - i}`, customer_id: `customer-${i}`, customer_name: name, customer_phone: `0917 555 ${String(1200 + i)}`, device_type: type, device, issue, public_summary: summary, stage, received_at: received, updated_at: updated, ready_at: ['Ready for Pickup', 'Claimed'].includes(stage) ? updated : null, claimed_at: stage === 'Claimed' ? updated : null, original_due: dayOffset(due), revised_due: null, ever_delayed: i === 6, delay_reason: i === 6 ? 'Waiting for a replacement keyboard from our supplier.' : '', version: 1, events };
  });
}
export function seedCustomers(repairs: Repair[]): Customer[] { return repairs.map(r => ({ id: r.customer_id, name: r.customer_name, phone: r.customer_phone, email: '' })); }
