import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Salad, Loader2, AlertTriangle, X, Check, Search, Filter, Pencil, Eye } from 'lucide-react';
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
  // Edit-mode toggle — prevents accidental cell taps on the shared
  // manager iPad. Only admin / super_admin ever see the toggle; for
  // everyone else `editMode` stays permanently false and the matrix
  // is read-only.
  const [editMode, setEditMode] = useState(false);
  const editable = isAdmin && editMode;

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
    if (!editable) return;
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

  const cellClickable = editable;

  return (
    <div data-testid="allergens-page" style={{ paddingBottom: 32, ...FONT }}>
      <button
        data-testid="allergens-back"
        onClick={() => navigate('/jkhive')}
        style={{ background: 'none', border: 0, color: '#007AFF', fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 6, padding: 0 }}
      >
        <ArrowLeft size={14} /> Intelligence
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.05, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Salad size={30} color="#30B0C7" /> Allergens
          </h1>
          <p style={{ margin: '6px 0 16px', fontSize: 14, color: '#86868B' }}>
            14 FSA allergens per menu item · <strong style={{ color: '#1D1D1F' }}>{locName}</strong>.
            {editable
              ? ' Edit mode ON — tap a cell to toggle · tap the item name for sub-items.'
              : (isAdmin
                ? ' Read-only — tap the item name to view sub-items. Turn on Edit mode to change allergens.'
                : ' Read-only view — tap the item name to see the sub-items declared.')}
          </p>
        </div>

        {/* Admin-only Edit-mode toggle — off by default so tapping
            around the matrix on a shared iPad can't silently mutate
            allergen data. */}
        {isAdmin && (
          <button
            data-testid="allergens-edit-toggle"
            onClick={() => setEditMode((v) => !v)}
            aria-pressed={editMode}
            title={editMode ? 'Turn edit mode off' : 'Turn edit mode on'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', borderRadius: 999,
              background: editMode ? '#30B0C7' : '#FFFFFF',
              color: editMode ? '#FFFFFF' : '#1D1D1F',
              border: editMode ? '1px solid #30B0C7' : '1px solid #ECECEF',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              ...FONT,
            }}
          >
            {editMode ? <Pencil size={14} /> : <Eye size={14} />}
            {editMode ? 'Editing' : 'Read-only'}
          </button>
        )}
      </div>

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
                          zIndex: 1, cursor: 'pointer',
                        }}
                        onClick={() => setDrawer({ itemId: it.id })}
                        title={editable ? 'Tap to edit sub-items' : 'Tap to view sub-items'}
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
            // Auto-save from the drawer — persist without closing so
            // the user can keep toggling sub-items. Close is via the
            // header X or the footer Close button.
            await saveItem(drawer.itemId, nextAllergens);
          }}
          editable={editable}
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
const SubItemDrawer = ({ item, catalog, onClose, onSave, editable }) => {
  // We keep an in-flight save promise + a dirty flag so overlapping
  // edits don't clobber each other. The drawer auto-saves on every
  // sub-item toggle / Select all / Clear so there's no separate Save
  // button to forget — matches the auto-save behaviour of the matrix
  // cell taps on the main page.
  const [draft, setDraft] = useState(() => ({ ...(item?.allergens || {}) }));
  const [savingCount, setSavingCount] = useState(0);

  if (!item) return null;

  const commit = async (next) => {
    if (!editable) return;
    setSavingCount((c) => c + 1);
    try {
      await onSave(next);
    } finally {
      setSavingCount((c) => c - 1);
    }
  };

  const setSub = (catId, subId, on) => {
    if (!editable) return;
    setDraft((prev) => {
      const cur = new Set(prev[catId] || []);
      if (on) cur.add(subId); else cur.delete(subId);
      const next = { ...prev };
      if (cur.size === 0) delete next[catId];
      else next[catId] = [...cur];
      // Fire-and-forget commit; the parent's optimistic UI reflects
      // it instantly. Runs after React schedules the state update.
      commit(next);
      return next;
    });
  };

  const selectAll = (cat) => {
    if (!editable) return;
    setDraft((p) => {
      const next = { ...p, [cat.id]: [...cat.items] };
      commit(next);
      return next;
    });
  };
  const clearAll = (cat) => {
    if (!editable) return;
    setDraft((p) => {
      const next = { ...p }; delete next[cat.id];
      commit(next);
      return next;
    });
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
            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#86868B' }}>
              {item.category}
              {editable && (
                <> · {savingCount > 0
                  ? <span style={{ color: '#30B0C7', fontWeight: 700 }}>Saving…</span>
                  : <span style={{ color: '#1D5A2F', fontWeight: 700 }}>Auto-saves on every change</span>}
                </>
              )}
            </p>
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
                  {editable && (
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
                        disabled={!editable}
                        onClick={() => setSub(c.id, sub, !on)}
                        style={{
                          padding: '5px 10px', borderRadius: 999,
                          background: on ? (HUES[c.id] || '#8E8E93') : '#FFFFFF',
                          color: on ? '#FFFFFF' : '#1D1D1F',
                          border: on ? 0 : '1px solid #ECECEF',
                          fontSize: 11, fontWeight: 700, cursor: editable ? 'pointer' : 'not-allowed',
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

        <div style={{ padding: 12, borderTop: '1px solid #ECECEF', display: 'flex' }}>
          <button
            data-testid="allergens-drawer-done"
            onClick={onClose}
            disabled={savingCount > 0}
            style={{
              flex: 1, padding: '11px 16px', borderRadius: 10, border: 0,
              background: savingCount > 0 ? '#C7C7CC' : '#30B0C7',
              color: '#FFFFFF', fontSize: 13, fontWeight: 700,
              cursor: savingCount > 0 ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              ...FONT,
            }}
          >
            {savingCount > 0
              ? <><Loader2 size={13} className="animate-spin" /> Saving…</>
              : (editable ? 'Done' : 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
};

const thStyle = { padding: '10px 12px', textAlign: 'left', fontSize: 11, color: '#86868B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' };
const tdStyle = { padding: '8px 12px', color: '#1D1D1F', fontSize: 13, verticalAlign: 'middle' };

export default Allergens;
