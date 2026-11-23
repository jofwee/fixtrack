import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, CircleCheck } from 'lucide-react';
import * as api from './lib/api';
import type { Customer, Profile, Repair, Shop } from './lib/domain';
import { ErrorMessage, Spinner } from './components/ui';
interface Workspace { user: Profile; repairs: Repair[]; customers: Customer[]; shop: Shop; refresh: () => Promise<void>; notify: (text: string) => void }
const Context = createContext<Workspace | null>(null);
export function useWorkspace() { const context = useContext(Context); if (!context) throw new Error('Workspace is unavailable.'); return context; }
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null); const [data, setData] = useState<Awaited<ReturnType<typeof api.loadWorkspace>> | null>(null); const [error, setError] = useState(''); const [toast, setToast] = useState('');
  const navigate = useNavigate();
  const refresh = useCallback(async () => { if (!user) return; const result = await api.loadWorkspace(user.shopId); setData(result); }, [user]);
  useEffect(() => { let live = true; api.profile().then(async p => { if (!live) return; if (!p) { navigate('/login', { replace: true }); return; } setUser(p); const result = await api.loadWorkspace(p.shopId); if (live) setData(result); }).catch(e => { if (live) setError(e.message); });
    const { data: subscription } = api.supabase?.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') navigate('/login', { replace: true }); }) || {};
    return () => { live = false; subscription?.subscription.unsubscribe(); };
  }, [navigate]);
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(''), 5500); return () => clearTimeout(timer); } }, [toast]);
  useEffect(() => {
    if (!api.supabase) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => { clearTimeout(timer); timer = setTimeout(() => { void api.supabase!.auth.signOut({ scope: 'local' }); }, 30 * 60 * 1000); };
    const events = ['pointerdown', 'keydown', 'touchstart']; events.forEach(event => window.addEventListener(event, reset, { passive: true })); reset();
    return () => { clearTimeout(timer); events.forEach(event => window.removeEventListener(event, reset)); };
  }, []);
  useEffect(() => { const handler = () => { refresh().catch(() => {}); }; window.addEventListener('focus', handler); return () => window.removeEventListener('focus', handler); }, [refresh]);
  if (error) return <div className="standalone-error"><ErrorMessage message={error}/><button className="button" onClick={() => window.location.reload()}>Try again</button><button className="button secondary" onClick={async () => { await api.supabase?.auth.signOut(); navigate('/login'); }}>Back to sign in</button></div>;
  if (!user || !data) return <Spinner/>;
  return <Context.Provider value={{ user, ...data, refresh, notify: setToast }}>{children}{toast && <div className="toast" role="status"><CircleCheck size={20}/><span>{toast}</span><button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={17}/></button></div>}</Context.Provider>;
}
