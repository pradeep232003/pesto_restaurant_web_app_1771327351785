import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, AlertTriangle, MapPin, Calendar } from 'lucide-react';
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
      const res = await api.probeCalibrationHistory({
        location_id: historyScope === 'site' ? adminLocationId : undefined,
        limit: 500,
      });
      setHistory(res?.entries || []);
    } catch (err) {
      alert('Failed to load history: ' + err.message);
    } finally {
      setHistoryLoading(false);
    }
  }, [isAdmin, historyScope, adminLocationId]);

  useEffect(() => { if (tab === 'history') loadHistory(); }, [tab, loadHistory]);

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
                  <button data-testid={`probe-edit-${p.id}`}
                    onClick={() => navigate(`/jkhive/probe-calibration/${p.id}/edit`, { state: { probe: p } })}
                    aria-label={`Edit ${p.name}`}
                    style={{
                      position: 'absolute', top: 0, right: 14, width: 24, height: 24, borderRadius: 999,
                      background: '#1D1D1F', color: '#FFFFFF', border: 0, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, fontStyle: 'italic',
                    }}>i</button>
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
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {[
              { k: 'site', label: locationName || 'This site' },
              { k: 'all',  label: 'All sites' },
            ].map(o => (
              <button key={o.k}
                data-testid={`probe-history-scope-${o.k}`}
                onClick={() => setHistoryScope(o.k)}
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

          {historyLoading && <p style={{ color: '#86868B', textAlign: 'center', padding: 18 }}>Loading history…</p>}

          {!historyLoading && history.length === 0 && (
            <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 28, textAlign: 'center' }}>
              <Calendar size={28} color="#C7C7CC" style={{ margin: '0 auto 8px' }} />
              <p style={{ color: '#1D1D1F', fontSize: 14, fontWeight: 600, margin: 0 }}>No calibrations yet</p>
              <p style={{ color: '#86868B', fontSize: 12, margin: '4px 0 0' }}>
                Records appear here once a probe has been calibrated.
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
                  </p>
                  {h.comment && (
                    <p style={{ fontSize: 11, color: '#A35E00', background: 'rgba(255,149,0,0.08)', padding: '6px 8px', borderRadius: 8, margin: '8px 0 0' }}>
                      ⚠ {h.comment}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default PickProbe;
