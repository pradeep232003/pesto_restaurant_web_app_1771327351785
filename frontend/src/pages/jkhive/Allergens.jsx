import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Salad, Loader2, AlertTriangle, X, Check, Search, Filter } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';
import { api } from '../../lib/api';

const FONT = { fontFamily: 'Outfit, sans-serif' };

// Distinct-enough colour per allergen so the matrix reads at a glance.
const HUES = {
  gluten: '#B8860B',
  crustaceans: '#E76F51',
  eggs: '#F4A261',
  fish: '#2A9D8F',
  peanuts: '#8B4513',
  soybeans: '#6A994E',
  milk: '#4C86A8',
  tree_nuts: '#8E44AD',
  celery: '#57A773',
  mustard: '#E9C46A',
  sesame: '#D2691E',
  sulphites: '#FF5A5F',
  lupin: '#9F86C0',
  molluscs: '#264653',
};

// Short label for the compact matrix column header — the full label
// still shows on hover (title attribute).
const SHORT_LABEL = {
  gluten: 'Gluten',
  crustaceans: 'Crust.',
  eggs: 'Eggs',
  fish: 'Fish',
  peanuts: 'Peanut',
  soybeans: 'Soy',
  milk: 'Milk',
  tree_nuts: 'Nuts',
  celery: 'Celery',
  mustard: 'Mustard',
  sesame: 'Sesame',
  sulphites: 'Sulph.',
  lupin: 'Lupin',
  molluscs: 'Molluscs',
};

const humanise = (s) => (s || '').replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const Allergens = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { adminLocationId, locations } = useLocation2();

  const [catalog, setCatalog] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [drawer, setDrawer] = useState(null); // { itemId }
  const [savingIds, setSavingIds] = useState(new Set());

  const locName = useMemo(
    () => (locations || []).find((l) => l.id === adminLocationId)?.name || '—',
    [locations, adminLocationId],
  );

  // Catalog is regulatory — only need to load once.
  useEffect(() => {
    (async () => {
      try {
        const c = await api.allergensCatalog();
        setCatalog(c.catalog || []);
      } catch (e) {
        setErr(e.message || 'Failed to load catalog');
      }
    })();
  }, []);

  const load = async () => {
    if (!adminLocationId) return;
    setLoading(true); setErr('');
    try {
      const res = await api.allergensMatrix(adminLocationId);
      setItems(res.items || []);
    } catch (e) {
      setErr(e.message || 'Failed to load matrix');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [adminLocationId]);

  const filteredItems = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((it) =>
      (it.name || '').toLowerCase().includes(s) ||
      (it.category || '').toLowerCase().includes(s),
    );
  }, [items, q]);

  const saveItem = async (itemId, newAllergens) => {
    setSavingIds((prev) => new Set(prev).add(itemId));
    // Optimistic update
    setItems((prev) => prev.map((r) => (r.id === itemId ? { ...r, allergens: newAllergens } : r)));
    try {
      const res = await api.allergensSetItem(itemId, newAllergens);
      // Overlay the server-sanitised result (in case anything was dropped)
      setItems((prev) => prev.map((r) => (r.id === itemId ? { ...r, allergens: res.allergens || {} } : r)));
    } catch (e) {
      setErr(e.message || 'Save failed');
      await load(); // Roll back to server state
    } finally {
      setSavingIds((prev) => {
        const n = new Set(prev); n.delete(itemId); return n;
      });
    }
  };

  const toggleCategory = async (item, catId) => {
    if (!isAdmin) return;
    const current = { ...(item.allergens || {}) };
    if (current[catId]) {
      delete current[catId];
    } else {
      // Default to selecting ALL sub-items in that category so the
      // baseline is safe (over-declaring is better than under). The
      // manager can then trim in the detail drawer.
      const cat = catalog.find((c) => c.id === catId);
      current[catId] = cat ? [...cat.items] : [];
    }
    await saveItem(item.id, current);
  };

  const cellClickable = isAdmin;

  return (
    <div data-testid="allergens-page" style={{ paddingBottom: 32, ...FONT }}>
      <button
        data-testid="allergens-back"
        onClick={() => navigate('/jkhive')}
        style={{ background: 'none', border: 0, color: '#007AFF', fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 6, padding: 0 }}
      >
        <ArrowLeft size={14} /> Intelligence
      </button>

      <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.05, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Salad size={30} color="#30B0C7" /> Allergens
      </h1>
      <p style={{ margin: '6px 0 16px', fontSize: 14, color: '#86868B' }}>
        14 FSA allergens per menu item · <strong style={{ color: '#1D1D1F' }}>{locName}</strong>.
        {isAdmin ? ' Tap a cell to toggle · tap the item name for sub-items.' : ' Read-only view — ask a manager to edit.'}
      </p>

      {/* Search */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', background: '#FFFFFF', borderRadius: 12, padding: '4px 12px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <Search size={14} color="#86868B" />
        <input
          data-testid="allergens-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search item or category…"
          style={{ flex: 1, border: 0, background: 'transparent', padding: '10px 0', fontSize: 13, color: '#1D1D1F', outline: 'none', ...FONT }}
        />
        {q && (
          <button
            data-testid="allergens-search-clear"
            onClick={() => setQ('')}
            style={{ background: 'none', border: 0, color: '#86868B', cursor: 'pointer', fontSize: 12 }}
          >Clear</button>
        )}
        <Filter size={13} color="#86868B" />
        <span style={{ fontSize: 11, color: '#86868B' }}>{filteredItems.length} of {items.length}</span>
      </div>

      {err && (
        <div data-testid="allergens-error" style={{ background: 'rgba(255,59,48,0.10)', color: '#C0392B', padding: 12, borderRadius: 12, fontSize: 13, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={14} /> {err}
        </div>
      )}

      {loading && (
        <p style={{ textAlign: 'center', padding: 20, color: '#86868B', fontSize: 13 }}>
          <Loader2 size={14} className="animate-spin" style={{ verticalAlign: 'middle', marginRight: 6 }} /> Loading matrix…
        </p>
      )}

      {!loading && filteredItems.length === 0 && (
        <div data-testid="allergens-empty" style={{ background: '#FFFFFF', borderRadius: 14, padding: 28, textAlign: 'center', color: '#86868B', fontSize: 13, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          No menu items for this site yet — add items from the Menu manager first.
        </div>
      )}

      {/* Matrix */}
      {!loading && filteredItems.length > 0 && (
        <div style={{ background: '#FFFFFF', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table data-testid="allergens-matrix" style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900, fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F5F5F7' }}>
                  <th style={{ ...thStyle, position: 'sticky', left: 0, background: '#F5F5F7', minWidth: 220, zIndex: 2 }}>
                    Item · Category
                  </th>
                  {catalog.map((c) => (
                    <th
                      key={c.id}
                      title={`${c.label}\n(${c.items.map(humanise).join(', ')})`}
                      style={{
                        ...thStyle, textAlign: 'center', minWidth: 62,
                        borderTop: `3px solid ${HUES[c.id] || '#8E8E93'}`,
                      }}
                    >
                      {SHORT_LABEL[c.id] || c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((it) => {
                  const rowSaving = savingIds.has(it.id);
                  return (
                    <tr
                      key={it.id}
                      data-testid={`allergens-row-${it.id}`}
                      style={{ borderTop: '1px solid #F0F0F2', background: rowSaving ? '#FFFAE6' : 'transparent' }}
                    >
                      <td
                        style={{
                          ...tdStyle, position: 'sticky', left: 0,
                          background: rowSaving ? '#FFFAE6' : '#FFFFFF',
                          zIndex: 1, cursor: cellClickable ? 'pointer' : 'default',
                        }}
                        onClick={() => cellClickable && setDrawer({ itemId: it.id })}
                      >
                        <div style={{ fontWeight: 700, color: '#1D1D1F' }}>
                          {it.name}
                          {rowSaving && <Loader2 size={11} className="animate-spin" style={{ verticalAlign: 'middle', marginLeft: 6 }} />}
                        </div>
                        <div style={{ fontSize: 11, color: '#86868B' }}>{it.category}</div>
                      </td>
                      {catalog.map((c) => {
                        const selected = it.allergens?.[c.id] || null;
                        const isAll = selected && selected.length === c.items.length;
                        const isPartial = selected && selected.length > 0 && !isAll;
                        return (
                          <td
                            key={c.id}
                            data-testid={`allergens-cell-${it.id}-${c.id}`}
                            onClick={() => cellClickable && !rowSaving && toggleCategory(it, c.id)}
                            title={`${it.name} · ${c.label}${selected ? `\nPresent: ${selected.map(humanise).join(', ')}` : ''}${cellClickable ? '\n(tap to toggle · tap item name for sub-items)' : ''}`}
                            style={{
                              ...tdStyle, textAlign: 'center',
                              padding: 4,
                              cursor: cellClickable && !rowSaving ? 'pointer' : 'default',
                              background: selected ? `${HUES[c.id] || '#8E8E93'}${isAll ? '55' : '22'}` : 'transparent',
                            }}
                          >
                            <div style={{
                              width: 26, height: 26, borderRadius: 6,
                              margin: '0 auto',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              background: selected ? (HUES[c.id] || '#8E8E93') : 'transparent',
                              color: '#FFFFFF',
                              border: selected ? 0 : '1.5px solid #E5E5EA',
                              fontSize: 11, fontWeight: 700,
                            }}>
                              {isAll ? <Check size={14} /> : (isPartial ? String(selected.length) : '')}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '10px 14px', fontSize: 11, color: '#86868B', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderTop: '1px solid #F0F0F2' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: '#8E8E9355' }} /> All sub-items
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: '#8E8E9322', border: '1px solid #8E8E93' }} /> Some sub-items (number)
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, border: '1.5px solid #E5E5EA' }} /> None declared
            </span>
          </div>
        </div>
      )}

      {drawer && (
        <SubItemDrawer
          item={items.find((i) => i.id === drawer.itemId)}
          catalog={catalog}
          onClose={() => setDrawer(null)}
          onSave={async (nextAllergens) => {
            await saveItem(drawer.itemId, nextAllergens);
            setDrawer(null);
          }}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
};

/**
 * Slide-in drawer for a single item — full sub-item control across
 * all 14 allergen categories. Managers use this to be precise about
 * what's actually present (e.g. wheat vs. spelt).
 */
const SubItemDrawer = ({ item, catalog, onClose, onSave, isAdmin }) => {
  const [draft, setDraft] = useState(() => ({ ...(item?.allergens || {}) }));
  const [saving, setSaving] = useState(false);

  if (!item) return null;

  const setSub = (catId, subId, on) => {
    setDraft((prev) => {
      const cur = new Set(prev[catId] || []);
      if (on) cur.add(subId); else cur.delete(subId);
      const next = { ...prev };
      if (cur.size === 0) delete next[catId];
      else next[catId] = [...cur];
      return next;
    });
  };

  const selectAll = (cat) => setDraft((p) => ({ ...p, [cat.id]: [...cat.items] }));
  const clearAll = (cat) => setDraft((p) => {
    const n = { ...p }; delete n[cat.id]; return n;
  });

  const save = async () => {
    if (!isAdmin) { onClose(); return; }
    setSaving(true);
    try { await onSave(draft); } finally { setSaving(false); }
  };

  return (
    <div
      data-testid="allergens-drawer"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        zIndex: 200, display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end',
        ...FONT,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF', width: '100%', maxWidth: 560,
          display: 'flex', flexDirection: 'column',
          boxShadow: '-20px 0 60px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #ECECEF', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#1D1D1F' }}>{item.name}</p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#86868B' }}>{item.category}</p>
          </div>
          <button
            data-testid="allergens-drawer-close"
            onClick={onClose}
            aria-label="Close"
            style={{ width: 32, height: 32, borderRadius: 999, background: '#F5F5F7', color: '#1D1D1F', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          ><X size={14} /></button>
        </div>

        <div style={{ padding: 14, overflowY: 'auto', flex: 1 }}>
          {catalog.map((c) => {
            const selected = new Set(draft[c.id] || []);
            return (
              <section key={c.id} style={{ marginBottom: 16, padding: 12, background: '#F5F5F7', borderRadius: 12, borderLeft: `4px solid ${HUES[c.id] || '#8E8E93'}` }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#1D1D1F' }}>{c.label}</p>
                  {isAdmin && (
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button
                        data-testid={`allergens-drawer-all-${c.id}`}
                        onClick={() => selectAll(c)}
                        style={{ background: 'none', border: 0, color: '#007AFF', fontSize: 11, cursor: 'pointer' }}
                      >Select all</button>
                      <button
                        data-testid={`allergens-drawer-clear-${c.id}`}
                        onClick={() => clearAll(c)}
                        style={{ background: 'none', border: 0, color: '#86868B', fontSize: 11, cursor: 'pointer' }}
                      >Clear</button>
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {c.items.map((sub) => {
                    const on = selected.has(sub);
                    return (
                      <button
                        key={sub}
                        data-testid={`allergens-drawer-sub-${c.id}-${sub}`}
                        disabled={!isAdmin}
                        onClick={() => setSub(c.id, sub, !on)}
                        style={{
                          padding: '5px 10px', borderRadius: 999,
                          background: on ? (HUES[c.id] || '#8E8E93') : '#FFFFFF',
                          color: on ? '#FFFFFF' : '#1D1D1F',
                          border: on ? 0 : '1px solid #ECECEF',
                          fontSize: 11, fontWeight: 700, cursor: isAdmin ? 'pointer' : 'not-allowed',
                          ...FONT,
                        }}
                      >
                        {humanise(sub)}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {isAdmin && (
          <div style={{ padding: 12, borderTop: '1px solid #ECECEF', display: 'flex', gap: 8 }}>
            <button
              data-testid="allergens-drawer-cancel"
              onClick={onClose}
              style={{ flex: 1, padding: '11px 16px', borderRadius: 10, border: '1px solid #ECECEF', background: '#F5F5F7', color: '#1D1D1F', fontSize: 13, fontWeight: 700, cursor: 'pointer', ...FONT }}
            >Cancel</button>
            <button
              data-testid="allergens-drawer-save"
              onClick={save}
              disabled={saving}
              style={{ flex: 2, padding: '11px 16px', borderRadius: 10, border: 0, background: saving ? '#C7C7CC' : '#30B0C7', color: '#FFFFFF', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, ...FONT }}
            >
              {saving ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : 'Save allergens'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const thStyle = { padding: '10px 12px', textAlign: 'left', fontSize: 11, color: '#86868B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' };
const tdStyle = { padding: '8px 12px', color: '#1D1D1F', fontSize: 13, verticalAlign: 'middle' };

export default Allergens;
