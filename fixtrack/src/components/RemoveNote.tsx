import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useWorkspace } from '../context';
import { removeNote } from '../lib/api';
import type { Repair, RepairEvent } from '../lib/domain';
import { ErrorMessage, Modal, Timeline } from './ui';
export function RepairActivity({ repair }: { repair: Repair }) {
  const { user, refresh, notify } = useWorkspace();
  const [selected, setSelected] = useState<RepairEvent | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function confirm() {
    if (!selected || busy) return;
    setBusy(true); setError('');
    try { await removeNote(repair, selected.id); setSelected(null); await refresh(); notify('Note removed.'); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <><Timeline events={repair.events} staff noteAction={user.role === 'owner' ? event => <button className="remove-note-button" onClick={() => { setSelected(event); setError(''); }}><Trash2 size={13}/>Remove note</button> : undefined}/>
    {selected && <Modal title="Remove this note?" onClose={() => { if (!busy) setSelected(null); }}><div className="modal-body">
      {error && <ErrorMessage message={error}/>}
      <p>This note will be removed from the repair timeline{selected.customer_visible ? ' and customer tracking' : ''}. A private administrative audit copy will be retained.</p>
      <blockquote className="remove-note-preview">{selected.detail}</blockquote>
      <p>Status changes and completion schedule history will stay intact.</p>
    </div><div className="modal-footer"><button className="button secondary" disabled={busy} onClick={() => setSelected(null)}>Cancel</button><button className="button" disabled={busy} onClick={confirm}>{busy ? 'Removing…' : 'Remove note'}</button></div></Modal>}
  </>;
}
