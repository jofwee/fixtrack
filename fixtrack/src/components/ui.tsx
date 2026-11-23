import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Check, CheckCheck, Laptop, Monitor, Smartphone, Tablet, X, AlertCircle, LoaderCircle } from 'lucide-react';
import { STAGES, dateLabel } from '../lib/domain';
import type { RepairEvent, Stage } from '../lib/domain';
export function Brand({ light = false }: { light?: boolean }) { return <span className={`brand ${light ? 'light' : ''}`}><span className="brand-symbol"><CheckCheck size={25} strokeWidth={2.7}/></span><span>fixtrack<span className="brand-period">.</span></span></span>; }
export function DeviceIcon({ type, size = 20 }: { type: string; size?: number }) { const Icon = type === 'Phone' ? Smartphone : type === 'Tablet' ? Tablet : type === 'Desktop' ? Monitor : Laptop; return <Icon size={size} strokeWidth={1.7}/>; }
export function Status({ stage }: { stage: Stage }) { return <span className={`status status-${STAGES.indexOf(stage)}`}><span/>{stage}</span>; }
export function Spinner() { return <div className="loading"><LoaderCircle className="spin"/><span>Loading your workspace…</span></div>; }
export function Empty({ title = 'Nothing here just yet', text, action }: { title?: string; text: string; action?: ReactNode }) { return <div className="empty-state"><span className="empty-icon"><CheckCheck size={27}/></span><h3>{title}</h3><p>{text}</p>{action}</div>; }
export function ErrorMessage({ message }: { message: string }) { return <div className="error-message" role="alert"><AlertCircle size={18}/><span>{message}</span></div>; }
export function PageTitle({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: ReactNode }) { return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1><p>{description}</p></div>{action && <div className="heading-actions">{action}</div>}</div>; }
export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current!; const previous = document.activeElement as HTMLElement; d.showModal(); const oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { d.close(); document.body.style.overflow = oldOverflow; previous?.focus(); }; }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'wide' : ''}`} aria-labelledby="modal-title" onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}><div className="modal-header"><h2 id="modal-title">{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20}/></button></div>{children}</dialog>;
}
export function Timeline({ events, staff = false }: { events: Pick<RepairEvent, 'id' | 'title' | 'detail' | 'created_at'>[] | RepairEvent[]; staff?: boolean }) { return <ol className="event-timeline">{[...events].reverse().map((e, i) => <li key={e.id}><span className={`event-marker ${i === 0 ? 'latest' : ''}`}><Check size={13}/></span><div><div className="event-heading"><strong>{e.title}</strong><time dateTime={e.created_at}>{dateLabel(e.created_at)} · {dateLabel(e.created_at, { hour: 'numeric', minute: '2-digit' })}</time></div>{e.detail && <p>{e.detail}</p>}{staff && 'actor_name' in e && <small>{String(e.actor_name)}{!e.customer_visible && <span className="internal-label">Staff only</span>}</small>}</div></li>)}</ol>; }
