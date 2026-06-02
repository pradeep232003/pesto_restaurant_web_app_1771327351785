import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, AlertTriangle, MapPin, Calendar, Pencil, Trash2 } from 'lucide-react';
import api from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';

const FONT = { fontFamily: 'Outfit, sans-serif' };

const fmtWhen = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const PickProbe = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { adminLocationId, locations } = useLocation2();
  const [tab, setTab] = useState('probes'); // 'probes' | 'history'
  const [probes, setProbes] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyScope, setHistoryScope] = useState('site'); // 'site' | 'all'
  const [filterLocId, setFilterLocId] = useState(''); // when scope='all', narrow to one site
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [editing, setEditing] = useState(null); // calibration row currently being edited
  const [editForm, setEditForm] = useState({ boiling_temp: '', iced_temp: '', comment: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  useEffect(() => {
    if (!adminLocationId) { setLoading(false); return; }
    setLoading(true);
    api.probesList(adminLocationId)
      .then(d => setProbes(d || []))
      .catch(err => alert('Failed to load probes: ' + err.message))
      .finally(() => setLoading(false));
  }, [adminLocationId]);

  const loadHistory = useCallback(async () => {
    if (!isAdmin) return;
    setHistoryLoading(true);
    try {
      const targetLoc = historyScope === 'site'
        ? adminLocationId
        : (filterLocId || undefined);
      const res = await api.probeCalibrationHistory({
        location_id: targetLoc,
        start_date: filterStart || undefined,
        end_date: filterEnd || undefined,
        limit: 500,
      });
      setHistory(res?.entries || []);
    } catch (err) {
      alert('Failed to load history: ' + err.message);
    } finally {
      setHistoryLoading(false);
    }
  }, [isAdmin, historyScope, adminLocationId, filterLocId, filterStart, filterEnd]);

  useEffect(() => { if (tab === 'history') loadHistory(); }, [tab, loadHistory]);

  const openEdit = (row) => {
    setEditing(row);
    setEditForm({
      boiling_temp: row.boiling_temp != null ? String(row.boiling_temp) : '',
      iced_temp:    row.iced_temp    != null ? String(row.iced_temp)    : '',
      comment:      row.comment || '',
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setEditSaving(true);
    try {
      await api.probeCalibrationUpdate(editing.id, {
        boiling_temp: editForm.boiling_temp === '' ? null : parseFloat(editForm.boiling_temp),
        iced_temp:    editForm.iced_temp    === '' ? null : parseFloat(editForm.iced_temp),
        comment: editForm.comment,
      });
      setEditing(null);
      await loadHistory();
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const removeRow = async (row) => {
    const ok = window.confirm(`Delete this calibration for ${row.probe_name || 'probe'} on ${fmtWhen(row.recorded_at)}?\n\nThis cannot be undone.`);
    if (!ok) return;
    setDeletingId(row.id);
    try {
      await api.probeCalibrationDelete(row.id);
      setHistory(h => h.filter(r => r.id !== row.id));
    } catch (err) {
      alert('Delete failed: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (!adminLocationId) {
    return (
      <div style={{ padding: 24, ...FONT }}>
        <WizardHeader title="Probe Calibration" locationName="—" dateStr={today} backTo="/jkhive/routines/more" />
        <p style={{ color: '#FF9500' }}>Pick a location from JKHive home first.</p>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 110, ...FONT }} data-testid="probe-pick">
      <WizardHeader title="Probe Calibration" locationName={locationName} dateStr={today} backTo="/jkhive/routines/more" />

      {/* Tabs (History only rendered for admin+) */}
      {isAdmin && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, padding: 4, background: '#F5F5F7', borderRadius: 12 }} data-testid="probe-tabs">
          {[
            { key: 'probes',  label: 'Select probe' },
            { key: 'history', label: 'History' },
          ].map(t => (
            <button key={t.key}
              data-testid={`probe-tab-${t.key}`}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 9,
                background: tab === t.key ? '#FFFFFF' : 'transparent',
                color: tab === t.key ? '#1D1D1F' : '#86868B',
                border: 0, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                boxShadow: tab === t.key ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                ...FONT,
              }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === 'probes' && (
        <>
          {loading && <p style={{ color: '#86868B', textAlign: 'center', padding: 18 }}>Loading…</p>}
          {!loading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {probes.map(p => (
                <div key={p.id} style={{ position: 'relative' }}>
                  <button data-testid={`probe-${p.id}`}
                    onClick={() => navigate(`/jkhive/probe-calibration/${p.id}/boiling`, { state: { probe: p } })}
                    style={{
                      width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                      padding: '4px 4px 8px', background: 'transparent', border: 0, cursor: 'pointer',
                    }}>
                    <span style={{ fontSize: 56, lineHeight: 1 }}>📟</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#1D1D1F', textAlign: 'center' }}>{p.name}</span>
                  </button>
                  {isAdmin && (
                    <button data-testid={`probe-edit-${p.id}`}
                      onClick={() => navigate(`/jkhive/probe-calibration/${p.id}/edit`, { state: { probe: p } })}
                      aria-label={`Edit ${p.name}`}
                      style={{
                        position: 'absolute', top: 0, right: 14, width: 24, height: 24, borderRadius: 999,
                        background: '#1D1D1F', color: '#FFFFFF', border: 0, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700, fontStyle: 'italic',
                      }}>i</button>
                  )}
                </div>
              ))}
              <button data-testid="probe-add"
                onClick={() => navigate('/jkhive/probe-calibration/new')}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  padding: '4px 4px 8px', background: 'transparent', border: 0, cursor: 'pointer',
                }}>
                <span style={{
                  fontSize: 56, lineHeight: 1, color: '#1D1D1F',
                  width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>+</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#1D1D1F' }}>Add Probe</span>
              </button>
            </div>
          )}
        </>
      )}

      {tab === 'history' && isAdmin && (
        <div data-testid="probe-history-tab">
          {/* Scope toggle: this site / all sites */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            {[
              { k: 'site', label: locationName || 'This site' },
              { k: 'all',  label: 'All sites' },
            ].map(o => (
              <button key={o.k}
                data-testid={`probe-history-scope-${o.k}`}
                onClick={() => { setHistoryScope(o.k); if (o.k === 'site') setFilterLocId(''); }}
                style={{
                  padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                  border: 0, cursor: 'pointer',
                  background: historyScope === o.k ? '#1D1D1F' : '#FFFFFF',
                  color:      historyScope === o.k ? '#FFFFFF' : '#1D1D1F',
                  boxShadow: historyScope === o.k ? 'none' : '0 0 0 1px rgba(0,0,0,0.10)',
                  ...FONT,
                }}>{o.label}</button>
            ))}
          </div>

          {/* Filters: date range + (when scope='all') location dropdown */}
          <div style={{
            background: '#FFFFFF', borderRadius: 14, padding: 12, marginBottom: 12,
            display: 'grid', gap: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }} data-testid="probe-history-filters">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>From</span>
                <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)}
                  data-testid="probe-history-start-date"
                  style={{ padding: '8px 10px', borderRadius: 9, background: '#F5F5F7', border: 0, fontSize: 13, color: '#1D1D1F', ...FONT }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>To</span>
                <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)}
                  data-testid="probe-history-end-date"
                  style={{ padding: '8px 10px', borderRadius: 9, background: '#F5F5F7', border: 0, fontSize: 13, color: '#1D1D1F', ...FONT }} />
              </label>
            </div>
            {historyScope === 'all' && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Location</span>
                <select value={filterLocId} onChange={e => setFilterLocId(e.target.value)}
                  data-testid="probe-history-location-filter"
                  style={{ padding: '8px 10px', borderRadius: 9, background: '#F5F5F7', border: 0, fontSize: 13, color: '#1D1D1F', ...FONT }}>
                  <option value="">All locations</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </label>
            )}
            {(filterStart || filterEnd || filterLocId) && (
              <button data-testid="probe-history-clear-filters"
                onClick={() => { setFilterStart(''); setFilterEnd(''); setFilterLocId(''); }}
                style={{
                  alignSelf: 'flex-end', padding: '6px 12px', borderRadius: 999, border: 0,
                  background: '#F5F5F7', color: '#1D1D1F', fontSize: 11, fontWeight: 600, cursor: 'pointer', ...FONT,
                }}>Clear filters</button>
            )}
          </div>

          {historyLoading && <p style={{ color: '#86868B', textAlign: 'center', padding: 18 }}>Loading history…</p>}

          {!historyLoading && history.length === 0 && (
            <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 28, textAlign: 'center' }}>
              <Calendar size={28} color="#C7C7CC" style={{ margin: '0 auto 8px' }} />
              <p style={{ color: '#1D1D1F', fontSize: 14, fontWeight: 600, margin: 0 }}>No calibrations found</p>
              <p style={{ color: '#86868B', fontSize: 12, margin: '4px 0 0' }}>
                Adjust the filters or scope to see more results.
              </p>
            </div>
          )}

          {!historyLoading && history.length > 0 && (
            <p style={{ fontSize: 11, color: '#86868B', marginBottom: 8, padding: '0 4px' }}>
              {history.length} {history.length === 1 ? 'record' : 'records'} · newest first
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {history.map(h => {
              const Ico = h.passed ? Check : (h.passed === false ? X : AlertTriangle);
              const bg  = h.passed ? 'rgba(52,199,89,0.10)' : (h.passed === false ? 'rgba(255,59,48,0.10)' : 'rgba(255,149,0,0.10)');
              const fg  = h.passed ? '#1B7A35' : (h.passed === false ? '#C0392B' : '#A35E00');
              return (
                <div key={h.id} data-testid={`probe-history-row-${h.id}`}
                  style={{
                    background: '#FFFFFF', borderRadius: 14, padding: 14,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    opacity: deletingId === h.id ? 0.4 : 1,
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#1D1D1F', margin: 0 }}>{h.probe_name || 'Unknown probe'}</p>
                      <p style={{ fontSize: 11, color: '#86868B', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={11} /> {h.location_name || h.location_id}
                      </p>
                    </div>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                      background: bg, color: fg,
                    }}>
                      <Ico size={12} strokeWidth={2.8} /> {h.passed ? 'PASS' : (h.passed === false ? 'FAIL' : 'INFO')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 4 }}>
                    <span style={{ fontSize: 12, color: '#3A3A3C', fontWeight: 500 }}>
                      Boil <strong>{h.boiling_temp != null ? `${Number(h.boiling_temp).toFixed(1)}°C` : '—'}</strong>
                    </span>
                    <span style={{ color: '#C7C7CC' }}>·</span>
                    <span style={{ fontSize: 12, color: '#3A3A3C', fontWeight: 500 }}>
                      Iced <strong>{h.iced_temp != null ? `${Number(h.iced_temp).toFixed(1)}°C` : '—'}</strong>
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: '#86868B', margin: '6px 0 0' }}>
                    {fmtWhen(h.recorded_at)} · By {h.recorded_by_name || h.recorded_by || '—'}
                    {h.edited_at && (
                      <span style={{ color: '#0A66CC' }}> · edited {fmtWhen(h.edited_at)}{h.edited_by_name ? ` by ${h.edited_by_name}` : ''}</span>
                    )}
                  </p>
                  {h.comment && (
                    <p style={{ fontSize: 11, color: '#A35E00', background: 'rgba(255,149,0,0.08)', padding: '6px 8px', borderRadius: 8, margin: '8px 0 0' }}>
                      ⚠ {h.comment}
                    </p>
                  )}

                  {/* Admin actions */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                    <button data-testid={`probe-history-edit-${h.id}`}
                      onClick={() => openEdit(h)}
                      disabled={deletingId === h.id}
                      style={{
                        padding: '6px 12px', borderRadius: 999, border: 0, cursor: 'pointer',
                        background: '#F5F5F7', color: '#1D1D1F',
                        fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, ...FONT,
                      }}><Pencil size={11} /> Edit</button>
                    <button data-testid={`probe-history-delete-${h.id}`}
                      onClick={() => removeRow(h)}
                      disabled={deletingId === h.id}
                      style={{
                        padding: '6px 12px', borderRadius: 999, border: 0, cursor: 'pointer',
                        background: 'rgba(255,59,48,0.08)', color: '#C0392B',
                        fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, ...FONT,
                      }}><Trash2 size={11} /> {deletingId === h.id ? 'Deleting…' : 'Delete'}</button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Edit modal */}
          {editing && (
            <div data-testid="probe-history-edit-modal"
              style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              <div onClick={() => setEditing(null)}
                style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }} />
              <div style={{
                position: 'relative', background: '#FFFFFF', width: '100%', maxWidth: 520,
                borderRadius: '24px 24px 0 0', padding: '12px 18px 24px',
                boxShadow: '0 -8px 32px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto', ...FONT,
              }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                  <span style={{ width: 36, height: 4, borderRadius: 999, background: 'rgba(0,0,0,0.18)' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                      {editing.location_name} · {fmtWhen(editing.recorded_at)}
                    </p>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1D1D1F', margin: '2px 0 0' }}>Edit calibration</h2>
                  </div>
                  <button onClick={() => setEditing(null)} aria-label="Close"
                    style={{ width: 32, height: 32, borderRadius: 999, background: '#F5F5F7', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={15} color="#1D1D1F" />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#86868B' }}>Boiling temp (°C)</span>
                    <input type="number" step="0.1" inputMode="decimal"
                      value={editForm.boiling_temp}
                      onChange={e => setEditForm(f => ({ ...f, boiling_temp: e.target.value }))}
                      data-testid="probe-edit-boiling"
                      style={{ padding: '10px 12px', borderRadius: 10, background: '#F5F5F7', border: 0, fontSize: 14, color: '#1D1D1F', ...FONT }} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#86868B' }}>Iced temp (°C)</span>
                    <input type="number" step="0.1" inputMode="decimal"
                      value={editForm.iced_temp}
                      onChange={e => setEditForm(f => ({ ...f, iced_temp: e.target.value }))}
                      data-testid="probe-edit-iced"
                      style={{ padding: '10px 12px', borderRadius: 10, background: '#F5F5F7', border: 0, fontSize: 14, color: '#1D1D1F', ...FONT }} />
                  </label>
                </div>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#86868B' }}>Comment</span>
                  <textarea rows={3}
                    value={editForm.comment}
                    onChange={e => setEditForm(f => ({ ...f, comment: e.target.value.slice(0, 250) }))}
                    data-testid="probe-edit-comment"
                    style={{ padding: '10px 12px', borderRadius: 10, background: '#F5F5F7', border: 0, fontSize: 14, color: '#1D1D1F', resize: 'vertical', outline: 'none', ...FONT }} />
                </label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setEditing(null)}
                    style={{
                      flex: 1, padding: '12px 14px', borderRadius: 999, border: '1px solid rgba(0,0,0,0.12)',
                      background: '#FFFFFF', color: '#1D1D1F', fontSize: 14, fontWeight: 600, cursor: 'pointer', ...FONT,
                    }}>Cancel</button>
                  <button onClick={saveEdit} disabled={editSaving}
                    data-testid="probe-edit-save"
                    style={{
                      flex: 2, padding: '12px 14px', borderRadius: 999, border: 0,
                      background: '#1D1D1F', color: '#FFFFFF', fontSize: 14, fontWeight: 700,
                      cursor: editSaving ? 'not-allowed' : 'pointer', opacity: editSaving ? 0.5 : 1, ...FONT,
                    }}>{editSaving ? 'Saving…' : 'Save changes'}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PickProbe;
