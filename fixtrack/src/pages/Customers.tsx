import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Phone, Wrench } from 'lucide-react';
import { useWorkspace } from '../context';
import { initials } from '../lib/domain';
import { Empty, PageTitle } from '../components/ui';
export function Customers() { const { customers, repairs } = useWorkspace(); const [query, setQuery] = useState(''); const filtered = customers.filter(c => `${c.name} ${c.phone}`.toLowerCase().includes(query.toLowerCase()));
  return <><PageTitle eyebrow="THE PEOPLE BEHIND THE DEVICES" title="Customers" description="A familiar face. A full repair history."/><div className="customer-toolbar"><label className="search-field"><Search size={18}/><input aria-label="Search customers" placeholder="Search customers by name or number…" value={query} onChange={e => setQuery(e.target.value)}/></label><span>{filtered.length} customers</span></div><div className="customer-grid">{filtered.map(c => { const jobs = repairs.filter(r => r.customer_id === c.id); return <article className="panel customer-card" key={c.id}><div className="customer-card-top"><span className="avatar customer-avatar">{initials(c.name)}</span><span className="customer-job-count">{jobs.length} repair{jobs.length !== 1 ? 's' : ''}</span></div><h2>{c.name}</h2><a className="customer-phone" href={`tel:${c.phone.replace(/[^+\d]/g, '')}`}><Phone size={14}/>{c.phone}</a>{c.email && <p>{c.email}</p>}<div className="customer-repairs">{jobs.slice(0, 2).map(r => <Link key={r.id} to={`/app/repairs/${r.id}`}><Wrench size={14}/><span>{r.device}<small>{r.reference} · {r.stage}</small></span></Link>)}</div></article>; })}</div>{!filtered.length && <Empty title="No customers found" text="Customers are added when you check in a repair."/>}</>;
}
