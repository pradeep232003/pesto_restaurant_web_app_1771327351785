import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Save } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { useAuth } from '../../../contexts/AuthContext';
import { WizardHeader } from '../cooling/_shared';

/**
 * /jkhive/checklists/new           — create
 * /jkhive/checklists/:id/edit      — edit / delete
 *
 * Admin-only. Form fields: title, frequency (daily/weekly/monthly), items[].
 * Items list supports add (Enter or +), remove (×), and inline edit.
 */
const ChecklistEditor = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [search] = useSearchParams();
  const isEdit = !!id;
  const { adminLocationId, locations } = useLocation2();
  const { isAdmin } = useAuth();

  const [title, setTitle] = useState('');
  const [frequency, setFrequency] = useState(search.get('frequency') || 'daily');
  const [scope, setScope] = useState('location');  // 'location' | 'global'
  const [items, setItems] = useState(['']);
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  useEffect(() => {
    if (!isEdit) return;
    api.checklistGet(id).then(d => {
      setTitle(d.title || '');
      setFrequency(d.frequency || 'daily');
      setScope(d.scope || 'location');
      setItems((d.items || []).length ? d.items : ['']);
    }).catch(err => alert('Failed to load: ' + err.message));
  }, [id, isEdit]);

  if (!isAdmin) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: '#FF3B30' }}>Admin access only.</p>
      </div>
    );
  }

  const addItem = () => setItems([...items, '']);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  const setItem = (i, v) => setItems(items.map((it, idx) => idx === i ? v : it));

  const cleanItems = items.map(s => s.trim()).filter(Boolean);

  const save = async () => {
    if (!title.trim()) { alert('Title is required'); return; }
    if (cleanItems.length === 0) { alert('Add at least one item'); return; }
    setSaving(true);
    try {
      if (isEdit) {
        await api.checklistUpdate(id, { title, frequency, items: cleanItems, scope, location_id: adminLocationId });
      } else {
        await api.checklistCreate({ location_id: adminLocationId, title, frequency, items: cleanItems, scope });
      }
      navigate('/jkhive/checklists', { replace: true });
    } catch (err) { alert('Save failed: ' + err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!isEdit) return;
    const ok = window.confirm(`Delete "${title}"?\n\nThis will permanently remove the checklist and its history. This can't be undone.`);
    if (!ok) return;
    try {
      await api.checklistDelete(id);
      navigate('/jkhive/checklists', { replace: true });
    } catch (err) { alert('Delete failed: ' + err.message); }
  };

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="checklist-editor">
      <WizardHeader title={isEdit ? 'Edit Checklist' : 'New Checklist'} locationName={locationName} dateStr={today} backTo="/jkhive/checklists" />

      <label style={labelSty}>Title</label>
      <input data-testid="cl-title"
        value={title} onChange={e => setTitle(e.target.value)}
        placeholder="e.g. Toilet Cleaning"
        style={inputSty} />

      <label style={labelSty}>Frequency</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['daily', 'weekly', 'monthly'].map(f => {
          const active = frequency === f;
          return (
            <button key={f}
              data-testid={`cl-freq-${f}`}
              onClick={() => setFrequency(f)}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 12,
                background: active ? '#1D1D1F' : '#FFFFFF',
                color: active ? '#FFFFFF' : '#1D1D1F',
                border: active ? 0 : '1px solid rgba(0,0,0,0.08)',
                fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
                textTransform: 'capitalize',
              }}>{f}</button>
          );
        })}
      </div>

      <label style={labelSty}>Use at</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
        <button data-testid="cl-scope-location"
          onClick={() => setScope('location')}
          style={{
            flex: 1, padding: '12px', borderRadius: 12,
            background: scope === 'location' ? '#1D1D1F' : '#FFFFFF',
            color: scope === 'location' ? '#FFFFFF' : '#1D1D1F',
            border: scope === 'location' ? 0 : '1px solid rgba(0,0,0,0.08)',
            fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            textAlign: 'left',
          }}>
          📍 This site only<br/>
          <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.85 }}>{locationName || 'Pick a site first'}</span>
        </button>
        <button data-testid="cl-scope-global"
          onClick={() => setScope('global')}
          style={{
            flex: 1, padding: '12px', borderRadius: 12,
            background: scope === 'global' ? '#1D1D1F' : '#FFFFFF',
            color: scope === 'global' ? '#FFFFFF' : '#1D1D1F',
            border: scope === 'global' ? 0 : '1px solid rgba(0,0,0,0.08)',
            fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            textAlign: 'left',
          }}>
          🌍 All locations<br/>
          <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.85 }}>Shared across every site</span>
        </button>
      </div>
      <p style={{ fontSize: 11, color: '#86868B', margin: '0 4px 16px' }}>
        Tip: pick "All locations" for shared routines like fire-safety walks.
        Pick "This site only" for site-specific tasks. You can always duplicate
        a global checklist later to make a site-specific copy.
      </p>

      <label style={labelSty}>Items</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input data-testid={`cl-item-${i}`}
              value={it} onChange={e => setItem(i, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && i === items.length - 1 && it.trim()) { e.preventDefault(); addItem(); } }}
              placeholder={`Item ${i + 1}`}
              style={{ ...inputSty, marginBottom: 0 }} />
            {items.length > 1 && (
              <button data-testid={`cl-remove-${i}`}
                onClick={() => removeItem(i)}
                aria-label="Remove item"
                style={{ width: 40, height: 40, borderRadius: 12, border: 0, background: 'rgba(255,59,48,0.08)', color: '#FF3B30', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={16} strokeWidth={2.4} />
              </button>
            )}
          </div>
        ))}
      </div>
      <button data-testid="cl-add-item" onClick={addItem}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '10px 14px', borderRadius: 999, background: '#FFFFFF',
          border: '1px dashed rgba(0,0,0,0.16)', color: '#1D1D1F',
          fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}>
        <Plus size={14} strokeWidth={2.4} /> Add item
      </button>

      <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button data-testid="cl-save" onClick={save} disabled={saving}
          style={{
            width: '100%', padding: '16px', borderRadius: 999, border: 0,
            background: '#1D1D1F', color: '#FFFFFF', fontSize: 16, fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontFamily: 'inherit',
          }}>
          <Save size={16} strokeWidth={2.4} />
          {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Create checklist')}
        </button>
        {isEdit && scope === 'global' && (
          <button data-testid="cl-fork" onClick={async () => {
              try {
                await api.checklistDuplicate(id, adminLocationId);
                alert(`Duplicated to ${locationName}. You can now edit it independently.`);
                navigate('/jkhive/checklists', { replace: true });
              } catch (err) { alert('Duplicate failed: ' + err.message); }
            }}
            style={{
              width: '100%', padding: '14px', borderRadius: 999,
              background: '#FFFFFF', color: '#1D1D1F',
              border: '1px solid rgba(0,0,0,0.12)', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
            🔀 Duplicate this for {locationName} only
          </button>
        )}
        {isEdit && (
          <button data-testid="cl-delete" onClick={handleDelete}
            style={{
              width: '100%', padding: '14px', borderRadius: 999,
              background: 'rgba(255,59,48,0.06)', color: '#FF3B30',
              border: '1px solid rgba(255,59,48,0.2)', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>Delete checklist</button>
        )}
      </div>
    </div>
  );
};

const labelSty = { display: 'block', fontSize: 12, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '14px 0 6px' };
const inputSty = {
  width: '100%', padding: '12px 14px', fontSize: 15,
  border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12,
  background: '#FFFFFF', color: '#1D1D1F', outline: 'none',
  fontFamily: 'Outfit, sans-serif', marginBottom: 6,
};

export default ChecklistEditor;
