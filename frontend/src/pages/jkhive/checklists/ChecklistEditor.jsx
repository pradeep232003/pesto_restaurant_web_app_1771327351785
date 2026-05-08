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
  // Items are objects: { text: string, sites: string[] }.
  // Empty `sites` means "all sites".
  const [items, setItems] = useState([{ text: '', sites: [] }]);
  const [editingSitesIdx, setEditingSitesIdx] = useState(null);
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  useEffect(() => {
    if (!isEdit) return;
    api.checklistGet(id).then(d => {
      setTitle(d.title || '');
      setFrequency(d.frequency || 'daily');
      setScope(d.scope || 'location');
      // Editor always shows ALL items (incl. ones scoped to other sites).
      const raw = d.items_all || d.items || [];
      const normalized = raw.map(it => typeof it === 'string'
        ? { text: it, sites: [] }
        : { text: it.text || '', sites: it.sites || [] });
      setItems(normalized.length ? normalized : [{ text: '', sites: [] }]);
    }).catch(err => alert('Failed to load: ' + err.message));
  }, [id, isEdit]);

  if (!isAdmin) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: '#FF3B30' }}>Admin access only.</p>
      </div>
    );
  }

  const addItem = () => setItems([...items, { text: '', sites: [] }]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  const setItemText = (i, v) => setItems(items.map((it, idx) => idx === i ? { ...it, text: v } : it));
  const toggleItemSite = (i, siteId) => setItems(items.map((it, idx) => {
    if (idx !== i) return it;
    const has = (it.sites || []).includes(siteId);
    const next = has ? it.sites.filter(s => s !== siteId) : [...(it.sites || []), siteId];
    return { ...it, sites: next };
  }));
  const setItemAllSites = (i) => setItems(items.map((it, idx) => idx === i ? { ...it, sites: [] } : it));

  const cleanItems = items
    .map(it => ({ text: (it.text || '').trim(), sites: it.sites || [] }))
    .filter(it => it.text);

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
      <p style={{ fontSize: 11, color: '#86868B', margin: '0 4px 8px' }}>
        Tap the site pill on each item to limit it to specific sites. "🌍 All sites" is the default.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
        {items.map((it, i) => {
          const isAllSites = !(it.sites && it.sites.length);
          const sitesLabel = isAllSites
            ? '🌍 All sites'
            : `📍 ${it.sites.length} site${it.sites.length > 1 ? 's' : ''}`;
          const editingSites = editingSitesIdx === i;
          return (
            <div key={i} style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, padding: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input data-testid={`cl-item-${i}`}
                  value={it.text} onChange={e => setItemText(i, e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && i === items.length - 1 && it.text.trim()) { e.preventDefault(); addItem(); } }}
                  placeholder={`Item ${i + 1}`}
                  style={{ ...inputSty, marginBottom: 0, border: 0, padding: '8px 10px' }} />
                {items.length > 1 && (
                  <button data-testid={`cl-remove-${i}`}
                    onClick={() => removeItem(i)}
                    aria-label="Remove item"
                    style={{ width: 36, height: 36, borderRadius: 10, border: 0, background: 'rgba(255,59,48,0.08)', color: '#FF3B30', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Trash2 size={14} strokeWidth={2.4} />
                  </button>
                )}
              </div>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <button data-testid={`cl-item-sites-${i}`}
                  onClick={() => setEditingSitesIdx(editingSites ? null : i)}
                  style={{
                    fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                    background: isAllSites ? 'rgba(0,122,255,0.10)' : 'rgba(255,149,0,0.12)',
                    color: isAllSites ? '#0A84C9' : '#8C5400',
                    border: 0, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  {sitesLabel} {editingSites ? '▲' : '▼'}
                </button>
                {!isAllSites && (
                  <span style={{ fontSize: 10, color: '#86868B' }}>
                    {it.sites.map(s => locations.find(l => l.id === s)?.name?.split(',')[0] || s).join(' · ')}
                  </span>
                )}
              </div>
              {editingSites && (
                <div style={{ marginTop: 10, padding: 10, background: '#F8F8FA', borderRadius: 10 }}>
                  <button onClick={() => setItemAllSites(i)}
                    data-testid={`cl-item-allsites-${i}`}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 8,
                      background: isAllSites ? '#0A84C9' : '#FFFFFF',
                      color: isAllSites ? '#FFFFFF' : '#1D1D1F',
                      border: isAllSites ? 0 : '1px solid rgba(0,0,0,0.08)',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                      marginBottom: 6,
                    }}>🌍 All sites</button>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {locations.map(loc => {
                      const on = (it.sites || []).includes(loc.id);
                      return (
                        <button key={loc.id}
                          data-testid={`cl-item-site-${i}-${loc.id}`}
                          onClick={() => toggleItemSite(i, loc.id)}
                          style={{
                            padding: '8px 10px', borderRadius: 8,
                            background: on ? '#34C759' : '#FFFFFF',
                            color: on ? '#FFFFFF' : '#1D1D1F',
                            border: on ? 0 : '1px solid rgba(0,0,0,0.08)',
                            fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                            textAlign: 'left',
                          }}>
                          {on ? '✓ ' : ''}{(loc.name || '').split(',')[0]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
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
