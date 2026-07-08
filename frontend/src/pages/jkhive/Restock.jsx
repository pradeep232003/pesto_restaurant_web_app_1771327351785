import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Plus, Check, RotateCcw, Trash2, MapPin, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';
import { api } from '../../lib/api';

const FONT = { fontFamily: 'Outfit, sans-serif' };
const fmtDT = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
};

/**
 * Restock — per-location shopping list of items running short.
 * - Any staff/admin can add an item and mark it done.
 * - Only admins can delete an item outright (staff should tick "done"
 *   to preserve the audit trail).
 * - Filter by "open" vs "done" via segmented control.
 */
const Restock = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { adminLocationId, locations } = useLocation2();
  const inputRef = useRef(null);

  const allSites = locations || [];
  const [siteId, setSiteId] = useState('');
  // Kick off on the currently-selected admin location, else the first site.
  useEffect(() => {
    if (siteId) return;
    if (adminLocationId) { setSiteId(adminLocationId); return; }
    if (allSites.length) setSiteId(allSites[0].id);
  }, [adminLocationId, allSites, siteId]);

  const [items, setItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState('open'); // 'open' | 'done' | 'all'
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [newItem, setNewItem] = useState('');
  const [newQty, setNewQty] = useState('');
  const [newNote, setNewNote] = useState('');
  const [adding, setAdding] = useState(false);

  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    if (!siteId) return;
    setLoading(true); setErr('');
    try {
      const res = await api.restockList({ location_id: siteId, status: statusFilter });
      setItems(res.items || []);
    } catch (e) {
      setErr(e.message || 'Failed to load');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [siteId, statusFilter]);

  const addItem = async () => {
    const item = newItem.trim();
    if (!item || !siteId) return;
    setAdding(true); setErr('');
    try {
      await api.restockCreate({
        location_id: siteId,
        item,
        quantity: newQty.trim(),
        note: newNote.trim(),
      });
      setNewItem(''); setNewQty(''); setNewNote('');
      // Snap the filter back to "open" so the manager sees what they just added.
      if (statusFilter !== 'open' && statusFilter !== 'all') setStatusFilter('open');
      else load();
      inputRef.current?.focus();
    } catch (e) {
      setErr(e.message || 'Add failed');
    } finally {
      setAdding(false);
    }
  };

  const toggleDone = async (row) => {
    setBusyId(row.id); setErr('');
    try {
      if (row.status === 'done') {
        await api.restockReopen(row.id);
      } else {
        await api.restockUpdate(row.id, { status: 'done' });
      }
      await load();
    } catch (e) {
      setErr(e.message || 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const removeItem = async (row) => {
    if (!window.confirm(`Delete "${row.item}" from the restock list? This can't be undone.`)) return;
    setBusyId(row.id); setErr('');
    try {
      await api.restockDelete(row.id);
      await load();
    } catch (e) {
      setErr(e.message || 'Delete failed');
    } finally {
      setBusyId(null);
    }
  };

  const openCount = useMemo(
    () => items.filter((r) => r.status === 'open').length,
    [items],
  );
  const doneCount = useMemo(
    () => items.filter((r) => r.status === 'done').length,
    [items],
  );

  const siteName = allSites.find((l) => l.id === siteId)?.name || siteId || '—';

  return (
    <div data-testid="restock-page" style={{ paddingBottom: 32, ...FONT }}>
      <button
        data-testid="restock-back"
        onClick={() => navigate('/jkhive')}
        style={{ background: 'none', border: 0, color: '#007AFF', fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 6, padding: 0 }}
      >
        <ArrowLeft size={14} /> Intelligence
      </button>

      <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.05, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 10 }}>
        <ShoppingCart size={30} color="#FF9500" /> Restock
      </h1>
      <p style={{ margin: '6px 0 16px', fontSize: 14, color: '#86868B' }}>
        Shopping list for items running short. Anyone can add · admins can delete.
      </p>

      {/* Site picker */}
      <div style={{ background: '#FFFFFF', borderRadius: 14, padding: 12, marginBottom: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#86868B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          <MapPin size={12} color="#FF9500" /> Site
        </label>
        <select
          data-testid="restock-site"
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          style={{ marginTop: 6, width: '100%', border: '1px solid #ECECEF', background: '#F5F5F7', borderRadius: 10, padding: '10px 12px', fontSize: 14, color: '#1D1D1F', outline: 'none', ...FONT }}
        >
          {allSites.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

      {/* Add form */}
      <div style={{ background: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <p style={{ margin: '0 0 8px', fontSize: 12, color: '#86868B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Add item
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 8 }}>
          <input
            ref={inputRef}
            data-testid="restock-new-item"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && newItem.trim()) addItem(); }}
            placeholder="What's running short? (e.g. Bread flour)"
            maxLength={200}
            style={{ border: '1px solid #ECECEF', background: '#F5F5F7', borderRadius: 10, padding: '10px 12px', fontSize: 14, color: '#1D1D1F', outline: 'none', ...FONT }}
          />
          <input
            data-testid="restock-new-qty"
            value={newQty}
            onChange={(e) => setNewQty(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && newItem.trim()) addItem(); }}
            placeholder="Qty (e.g. 2 bags)"
            maxLength={80}
            style={{ border: '1px solid #ECECEF', background: '#F5F5F7', borderRadius: 10, padding: '10px 12px', fontSize: 14, color: '#1D1D1F', outline: 'none', ...FONT }}
          />
        </div>
        <input
          data-testid="restock-new-note"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && newItem.trim()) addItem(); }}
          placeholder="Note (optional — brand / supplier / urgency)"
          maxLength={500}
          style={{ marginTop: 8, width: '100%', border: '1px solid #ECECEF', background: '#F5F5F7', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#1D1D1F', outline: 'none', boxSizing: 'border-box', ...FONT }}
        />
        <button
          data-testid="restock-add-btn"
          onClick={addItem}
          disabled={!newItem.trim() || !siteId || adding}
          style={{
            marginTop: 10, width: '100%',
            padding: '11px 16px', borderRadius: 10, border: 0,
            background: (!newItem.trim() || !siteId || adding) ? '#C7C7CC' : '#FF9500',
            color: '#FFFFFF', fontSize: 14, fontWeight: 700,
            cursor: (!newItem.trim() || !siteId || adding) ? 'not-allowed' : 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            ...FONT,
          }}
        >
          {adding ? <><Loader2 size={14} className="animate-spin" /> Adding…</> : <><Plus size={14} /> Add to list</>}
        </button>
      </div>

      {/* Status segmented control */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, padding: 4, background: '#FFFFFF', borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        {[
          { key: 'open', label: `Open · ${statusFilter === 'open' ? items.length : openCount}`, colour: '#FF9500' },
          { key: 'done', label: `Done · ${statusFilter === 'done' ? items.length : doneCount}`, colour: '#34C759' },
          { key: 'all', label: 'All', colour: '#1D1D1F' },
        ].map((opt) => (
          <button
            key={opt.key}
            data-testid={`restock-tab-${opt.key}`}
            onClick={() => setStatusFilter(opt.key)}
            style={{
              flex: 1, border: 0, padding: '8px 12px', borderRadius: 8,
              background: statusFilter === opt.key ? opt.colour : 'transparent',
              color: statusFilter === opt.key ? '#FFFFFF' : '#1D1D1F',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', ...FONT,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {err && (
        <div data-testid="restock-error" style={{ background: 'rgba(255,59,48,0.10)', color: '#C0392B', padding: 12, borderRadius: 12, fontSize: 13, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={14} /> {err}
        </div>
      )}

      {loading && (
        <p style={{ textAlign: 'center', padding: 20, color: '#86868B', fontSize: 13 }}>
          <Loader2 size={14} className="animate-spin" style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Loading…
        </p>
      )}

      {!loading && items.length === 0 && (
        <div data-testid="restock-empty" style={{ background: '#FFFFFF', borderRadius: 14, padding: 28, textAlign: 'center', color: '#86868B', fontSize: 13, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          {statusFilter === 'open'
            ? `Nothing on the ${siteName} shopping list — add something above.`
            : `No ${statusFilter} items yet for ${siteName}.`}
        </div>
      )}

      {!loading && items.length > 0 && (
        <div data-testid="restock-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((row) => (
            <div
              key={row.id}
              data-testid={`restock-row-${row.id}`}
              style={{
                background: '#FFFFFF', borderRadius: 12,
                padding: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                display: 'flex', alignItems: 'flex-start', gap: 10,
                opacity: row.status === 'done' ? 0.6 : 1,
              }}
            >
              <button
                data-testid={`restock-toggle-${row.id}`}
                onClick={() => toggleDone(row)}
                disabled={busyId === row.id}
                aria-label={row.status === 'done' ? 'Re-open item' : 'Mark item done'}
                title={row.status === 'done' ? 'Re-open' : 'Mark done'}
                style={{
                  width: 30, height: 30, minWidth: 30, borderRadius: 999,
                  border: row.status === 'done' ? 0 : '2px solid #C7C7CC',
                  background: row.status === 'done' ? '#34C759' : '#FFFFFF',
                  color: '#FFFFFF', cursor: busyId === row.id ? 'not-allowed' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {busyId === row.id
                  ? <Loader2 size={13} className="animate-spin" color={row.status === 'done' ? '#FFFFFF' : '#86868B'} />
                  : (row.status === 'done' ? <Check size={14} /> : null)}
              </button>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
                  <p style={{
                    margin: 0, fontSize: 15, fontWeight: 700, color: '#1D1D1F',
                    textDecoration: row.status === 'done' ? 'line-through' : 'none',
                    overflowWrap: 'anywhere',
                  }}>
                    {row.item}
                  </p>
                  {row.quantity && (
                    <span style={{ fontSize: 12, color: '#3A3A3C', background: '#F5F5F7', padding: '2px 8px', borderRadius: 999 }}>
                      {row.quantity}
                    </span>
                  )}
                </div>
                {row.note && (
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: '#3A3A3C', overflowWrap: 'anywhere' }}>
                    {row.note}
                  </p>
                )}
                <p style={{ margin: '4px 0 0', fontSize: 11, color: '#86868B' }}>
                  Added by <strong>{row.added_by_name || row.added_by || 'unknown'}</strong>
                  {row.added_at ? ` · ${fmtDT(row.added_at)}` : ''}
                  {row.status === 'done' && row.done_by_name && (
                    <> · <span style={{ color: '#1D5A2F' }}>Done by {row.done_by_name}{row.done_at ? ` · ${fmtDT(row.done_at)}` : ''}</span></>
                  )}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {row.status === 'done' && (
                  <button
                    data-testid={`restock-reopen-${row.id}`}
                    onClick={() => toggleDone(row)}
                    disabled={busyId === row.id}
                    aria-label="Re-open item"
                    title="Re-open"
                    style={{ width: 32, height: 32, borderRadius: 999, background: 'rgba(0,122,255,0.10)', color: '#007AFF', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <RotateCcw size={13} />
                  </button>
                )}
                {isAdmin && (
                  <button
                    data-testid={`restock-delete-${row.id}`}
                    onClick={() => removeItem(row)}
                    disabled={busyId === row.id}
                    aria-label="Delete item"
                    title="Delete (admin only)"
                    style={{ width: 32, height: 32, borderRadius: 999, background: 'rgba(255,59,48,0.10)', color: '#FF3B30', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Restock;
