import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ClipboardX, Plus, Check, RotateCcw, Trash2, Loader2, AlertTriangle, X, Pencil, Filter, Layers, Printer } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';
import { api } from '../../lib/api';

const FONT = { fontFamily: 'Outfit, sans-serif' };
const humanise = (s) => (s || '').replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const fmtDT = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
};

// Category → colour (matches JKHive routine hues so the log threads
// visually into the rest of the app).
const CAT_HUE = {
  opening: '#FF9500',
  closing: '#5856D6',
  fridge_temp: '#30B0C7',
  freezer_temp: '#30B0C7',
  cooking_cooling: '#30B0C7',
  reheating: '#FF3B30',
  delivery: '#8E8E93',
  cleaning: '#34C759',
  checklist: '#34C759',
  probe: '#0A84C9',
  hygiene: '#AF52DE',
  waste: '#8E8E93',
  other: '#3A3A3C',
};

const CorrectiveActions = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { adminLocationId, locations } = useLocation2();

  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [statusFilter, setStatusFilter] = useState('open');
  const [catFilter, setCatFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [editor, setEditor] = useState(null);
  const [busyId, setBusyId] = useState(null);
  // Admin cross-site toggle — when ON, backend returns rows across
  // every location and the site chip appears next to each row.
  const [showAll, setShowAll] = useState(false);
  const [printing, setPrinting] = useState(false);
  const effectiveSiteId = isAdmin && showAll ? 'all' : adminLocationId;

  const colourFor = (locId) => {
    const c = (locations || []).find((l) => l.id === locId)?.color;
    return (c && c.trim()) || '#8E8E93';
  };
  const nameFor = (locId) => (locations || []).find((l) => l.id === locId)?.name || locId;

  const locName = useMemo(
    () => (locations || []).find((l) => l.id === adminLocationId)?.name || '—',
    [locations, adminLocationId],
  );

  const load = async () => {
    if (!effectiveSiteId) return;
    setLoading(true); setErr('');
    try {
      const res = await api.correctiveActionsList({ location_id: effectiveSiteId, status: statusFilter });
      setItems(res.items || []);
      setCategories(res.categories || []);
    } catch (e) {
      setErr(e.message || 'Failed to load');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [effectiveSiteId, statusFilter]);

  const handlePrint = async () => {
    if (!effectiveSiteId) return;
    setPrinting(true); setErr('');
    try {
      const url = await api.correctiveActionsPrintUrl({
        location_id: effectiveSiteId, status: statusFilter, days: 365,
      });
      const a = document.createElement('a');
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `corrective_actions_${effectiveSiteId}_${stamp}.docx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      setErr(e.message || 'Print failed');
    } finally {
      setPrinting(false);
    }
  };

  const filtered = useMemo(() => {
    if (catFilter === 'all') return items;
    return items.filter((r) => (r.category || 'other') === catFilter);
  }, [items, catFilter]);

  const openCount = items.filter((r) => r.status === 'open').length;
  const resolvedCount = items.filter((r) => r.status === 'resolved').length;

  const toggleStatus = async (row) => {
    setBusyId(row.id); setErr('');
    try {
      await api.correctiveActionsUpdate(row.id, {
        status: row.status === 'resolved' ? 'open' : 'resolved',
      });
      await load();
    } catch (e) {
      setErr(e.message || 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const removeRow = async (row) => {
    if (!window.confirm(`Delete this corrective-action entry?\n\n"${row.failure_description}"`)) return;
    setBusyId(row.id); setErr('');
    try {
      await api.correctiveActionsDelete(row.id);
      await load();
    } catch (e) {
      setErr(e.message || 'Delete failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div data-testid="corrective-actions-page" style={{ paddingBottom: 32, ...FONT }}>
      <button
        data-testid="ca-back"
        onClick={() => navigate('/jkhive/routines')}
        style={{ background: 'none', border: 0, color: '#007AFF', fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 6, padding: 0 }}
      >
        <ArrowLeft size={14} /> Routines
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.05, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 10 }}>
            <ClipboardX size={30} color="#FF3B30" /> Corrective Actions
          </h1>
          <p style={{ margin: '6px 0 16px', fontSize: 14, color: '#86868B' }}>
            Log of failed checks and the corrective action taken · <strong style={{ color: '#1D1D1F' }}>{locName}</strong>.
            {isAdmin ? ' Tap + to log a new failure.' : ' Read-only view — admins log the entries.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            data-testid="ca-print"
            onClick={handlePrint}
            disabled={printing || !effectiveSiteId}
            title="Download the log as a landscape Word document (last 12 months)"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', borderRadius: 999,
              background: printing ? '#C7C7CC' : '#FFFFFF', color: '#1D1D1F',
              border: '1px solid #ECECEF', fontSize: 13, fontWeight: 700,
              cursor: printing ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)', ...FONT,
            }}
          >
            {printing ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
            {printing ? 'Preparing…' : 'Print (.docx)'}
          </button>
          {isAdmin && (
            <button
              data-testid="ca-all-sites-toggle"
              onClick={() => setShowAll((v) => !v)}
              aria-pressed={showAll}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 16px', borderRadius: 999,
                background: showAll ? '#FF3B30' : '#FFFFFF',
                color: showAll ? '#FFFFFF' : '#1D1D1F',
                border: showAll ? '1px solid #FF3B30' : '1px solid #ECECEF',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)', ...FONT,
              }}
            >
              <Layers size={14} />
              {showAll ? 'Viewing all sites' : 'Show all sites'}
            </button>
          )}
          {isAdmin && !showAll && (
            <button
              data-testid="ca-add"
              onClick={() => setEditor({ new: true })}
              disabled={!adminLocationId}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 16px', borderRadius: 999,
                background: '#FF3B30', color: '#FFFFFF',
                border: 0, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)', ...FONT,
              }}
            >
              <Plus size={14} /> Log a failure
            </button>
          )}
        </div>
      </div>

      {/* Status segmented control */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, padding: 4, background: '#FFFFFF', borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        {[
          { key: 'open', label: `Open · ${statusFilter === 'open' ? items.length : openCount}`, colour: '#FF3B30' },
          { key: 'resolved', label: `Resolved · ${statusFilter === 'resolved' ? items.length : resolvedCount}`, colour: '#34C759' },
          { key: 'all', label: 'All', colour: '#1D1D1F' },
        ].map((opt) => (
          <button
            key={opt.key}
            data-testid={`ca-tab-${opt.key}`}
            onClick={() => setStatusFilter(opt.key)}
            style={{
              flex: 1, border: 0, padding: '8px 12px', borderRadius: 8,
              background: statusFilter === opt.key ? opt.colour : 'transparent',
              color: statusFilter === opt.key ? '#FFFFFF' : '#1D1D1F',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', ...FONT,
            }}
          >{opt.label}</button>
        ))}
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', background: '#FFFFFF', borderRadius: 12, padding: '6px 12px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <Filter size={13} color="#86868B" />
        <span style={{ fontSize: 11, color: '#86868B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Category</span>
        <select
          data-testid="ca-category-filter"
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          style={{ border: '1px solid #ECECEF', background: '#F5F5F7', borderRadius: 8, padding: '6px 8px', fontSize: 12, color: '#1D1D1F', outline: 'none', minWidth: 140, ...FONT }}
        >
          <option value="all">All ({items.length})</option>
          {categories.map((c) => {
            const count = items.filter((r) => (r.category || 'other') === c).length;
            return <option key={c} value={c}>{humanise(c)} ({count})</option>;
          })}
        </select>
      </div>

      {err && (
        <div data-testid="ca-error" style={{ background: 'rgba(255,59,48,0.10)', color: '#C0392B', padding: 12, borderRadius: 12, fontSize: 13, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={14} /> {err}
        </div>
      )}

      {loading && (
        <p style={{ textAlign: 'center', padding: 20, color: '#86868B', fontSize: 13 }}>
          <Loader2 size={14} className="animate-spin" style={{ verticalAlign: 'middle', marginRight: 6 }} /> Loading…
        </p>
      )}

      {!loading && filtered.length === 0 && (
        <div data-testid="ca-empty" style={{ background: '#FFFFFF', borderRadius: 14, padding: 28, textAlign: 'center', color: '#86868B', fontSize: 13, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          {statusFilter === 'open'
            ? 'No open corrective actions — nice work!'
            : 'No entries for this filter.'}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div data-testid="ca-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((row) => {
            const hue = CAT_HUE[row.category] || '#8E8E93';
            const isResolved = row.status === 'resolved';
            return (
              <div
                key={row.id}
                data-testid={`ca-row-${row.id}`}
                style={{
                  background: '#FFFFFF', borderRadius: 12,
                  padding: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  opacity: isResolved ? 0.75 : 1,
                  borderLeft: `4px solid ${hue}`,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                    {isAdmin && showAll && (
                      <span
                        data-testid={`ca-site-chip-${row.id}`}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: 10, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
                          color: '#1D1D1F',
                          background: `${colourFor(row.location_id)}22`,
                          border: `1px solid ${colourFor(row.location_id)}`,
                          padding: '2px 8px', borderRadius: 999,
                        }}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: 999, background: colourFor(row.location_id), display: 'inline-block' }} />
                        {nameFor(row.location_id)}
                      </span>
                    )}
                    <span style={{
                      fontSize: 10, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
                      padding: '2px 8px', borderRadius: 999,
                      background: `${hue}22`, color: hue, border: `1px solid ${hue}55`,
                    }}>{humanise(row.category)}</span>
                    {row.item && (
                      <span style={{ fontSize: 11, color: '#3A3A3C', background: '#F5F5F7', padding: '2px 8px', borderRadius: 999 }}>
                        {row.item}
                      </span>
                    )}
                    <span style={{
                      fontSize: 10, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
                      padding: '2px 8px', borderRadius: 999,
                      background: isResolved ? '#34C75922' : '#FF3B3022',
                      color: isResolved ? '#1D5A2F' : '#8A2822',
                      border: `1px solid ${isResolved ? '#34C75955' : '#FF3B3055'}`,
                    }}>{isResolved ? 'Resolved' : 'Open'}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1D1D1F', overflowWrap: 'anywhere' }}>
                    {row.failure_description}
                  </p>
                  {row.corrective_action && (
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#3A3A3C', overflowWrap: 'anywhere' }}>
                      <strong style={{ color: '#1D5A2F' }}>Action:</strong> {row.corrective_action}
                    </p>
                  )}
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#86868B' }}>
                    Logged by <strong>{row.logged_by_name || row.logged_by || 'unknown'}</strong>{row.logged_at ? ` · ${fmtDT(row.logged_at)}` : ''}
                    {isResolved && row.resolved_by_name && (
                      <> · <span style={{ color: '#1D5A2F' }}>Resolved by {row.resolved_by_name}{row.resolved_at ? ` · ${fmtDT(row.resolved_at)}` : ''}</span></>
                    )}
                  </p>
                </div>

                {isAdmin && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      data-testid={`ca-toggle-${row.id}`}
                      onClick={() => toggleStatus(row)}
                      disabled={busyId === row.id}
                      aria-label={isResolved ? 'Re-open' : 'Mark resolved'}
                      title={isResolved ? 'Re-open' : 'Mark resolved'}
                      style={{ width: 32, height: 32, borderRadius: 999, background: isResolved ? 'rgba(0,122,255,0.10)' : 'rgba(52,199,89,0.10)', color: isResolved ? '#007AFF' : '#34C759', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      {busyId === row.id ? <Loader2 size={13} className="animate-spin" /> : (isResolved ? <RotateCcw size={13} /> : <Check size={14} />)}
                    </button>
                    <button
                      data-testid={`ca-edit-${row.id}`}
                      onClick={() => setEditor({ row })}
                      disabled={busyId === row.id}
                      aria-label="Edit"
                      title="Edit"
                      style={{ width: 32, height: 32, borderRadius: 999, background: '#F5F5F7', color: '#1D1D1F', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      data-testid={`ca-delete-${row.id}`}
                      onClick={() => removeRow(row)}
                      disabled={busyId === row.id}
                      aria-label="Delete"
                      title="Delete"
                      style={{ width: 32, height: 32, borderRadius: 999, background: 'rgba(255,59,48,0.10)', color: '#FF3B30', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editor && (
        <EditorModal
          row={editor.row}
          categories={categories}
          adminLocationId={adminLocationId}
          onClose={() => setEditor(null)}
          onSaved={async () => { setEditor(null); await load(); }}
          onError={(m) => setErr(m)}
        />
      )}
    </div>
  );
};

const EditorModal = ({ row, categories, adminLocationId, onClose, onSaved, onError }) => {
  const isEdit = !!row;
  const [category, setCategory] = useState(row?.category || 'other');
  const [item, setItem] = useState(row?.item || '');
  const [failure, setFailure] = useState(row?.failure_description || '');
  const [action, setAction] = useState(row?.corrective_action || '');
  const [status, setStatus] = useState(row?.status || 'open');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!failure.trim()) { onError?.('Please describe what failed.'); return; }
    setSaving(true);
    try {
      if (isEdit) {
        await api.correctiveActionsUpdate(row.id, {
          category, item, failure_description: failure,
          corrective_action: action, status,
        });
      } else {
        await api.correctiveActionsCreate({
          location_id: adminLocationId, category, item,
          failure_description: failure, corrective_action: action, status,
        });
      }
      await onSaved();
    } catch (e) {
      onError?.(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      data-testid="ca-editor"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, ...FONT }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
      >
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #ECECEF', display: 'flex', alignItems: 'center', gap: 10 }}>
          <p style={{ margin: 0, flex: 1, fontSize: 15, fontWeight: 800, color: '#1D1D1F' }}>
            {isEdit ? 'Edit corrective action' : 'Log a failed check'}
          </p>
          <button
            data-testid="ca-editor-close"
            onClick={onClose}
            aria-label="Close"
            style={{ width: 32, height: 32, borderRadius: 999, background: '#F5F5F7', color: '#1D1D1F', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          ><X size={14} /></button>
        </div>

        <div style={{ padding: 16, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Category</label>
            <select
              data-testid="ca-editor-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={inputStyle}
            >
              {(categories.length ? categories : ['other']).map((c) => (
                <option key={c} value={c}>{humanise(c)}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Item / equipment (optional)</label>
            <input
              data-testid="ca-editor-item"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              placeholder="e.g. Under-counter fridge #2"
              maxLength={200}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>What failed? <span style={{ color: '#FF3B30' }}>*</span></label>
            <textarea
              data-testid="ca-editor-failure"
              value={failure}
              onChange={(e) => setFailure(e.target.value)}
              placeholder="Describe the failure — what was wrong, when discovered"
              rows={3}
              maxLength={1000}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
          <div>
            <label style={labelStyle}>Corrective action taken</label>
            <textarea
              data-testid="ca-editor-action"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="What was done to fix it (and prevent recurrence)"
              rows={3}
              maxLength={1000}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {['open', 'resolved'].map((s) => (
                <button
                  key={s}
                  data-testid={`ca-editor-status-${s}`}
                  onClick={() => setStatus(s)}
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: 10, border: 0,
                    background: status === s ? (s === 'open' ? '#FF3B30' : '#34C759') : '#F5F5F7',
                    color: status === s ? '#FFFFFF' : '#1D1D1F',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer', ...FONT,
                  }}
                >{humanise(s)}</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: 12, borderTop: '1px solid #ECECEF', display: 'flex', gap: 8 }}>
          <button
            data-testid="ca-editor-cancel"
            onClick={onClose}
            style={{ flex: 1, padding: '11px 16px', borderRadius: 10, border: '1px solid #ECECEF', background: '#F5F5F7', color: '#1D1D1F', fontSize: 13, fontWeight: 700, cursor: 'pointer', ...FONT }}
          >Cancel</button>
          <button
            data-testid="ca-editor-save"
            onClick={save}
            disabled={saving || !failure.trim()}
            style={{
              flex: 2, padding: '11px 16px', borderRadius: 10, border: 0,
              background: (saving || !failure.trim()) ? '#C7C7CC' : '#FF3B30',
              color: '#FFFFFF', fontSize: 13, fontWeight: 700,
              cursor: (saving || !failure.trim()) ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, ...FONT,
            }}
          >
            {saving ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : (isEdit ? 'Save changes' : 'Log failure')}
          </button>
        </div>
      </div>
    </div>
  );
};

const labelStyle = { display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#86868B', marginBottom: 4 };
const inputStyle = { width: '100%', border: '1px solid #ECECEF', background: '#F5F5F7', borderRadius: 10, padding: '10px 12px', fontSize: 14, color: '#1D1D1F', outline: 'none', boxSizing: 'border-box', fontFamily: 'Outfit, sans-serif' };

export default CorrectiveActions;
