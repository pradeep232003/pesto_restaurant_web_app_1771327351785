import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';

const fmtHHMMSS = (totalSec) => {
  const s = Math.max(0, totalSec);
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${ss}`;
};

const fmtClock = (iso) => {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch { return ''; }
};

/**
 * Active session card with live ticking timer.
 *
 * Mutates the timer node directly via useRef.current.textContent so iOS Safari
 * can keep the counter alive without re-rendering the card every second
 * (matches the Hot/Cold Holding pattern).
 */
const SessionCard = ({ s, onComplete, onDelete }) => {
  const ref = useRef(null);
  useEffect(() => {
    const start = new Date(s.start_time || s.recorded_at).getTime();
    const tick = () => {
      const sec = Math.max(0, Math.floor((Date.now() - start) / 1000));
      const txt = fmtHHMMSS(sec);
      if (ref.current) ref.current.textContent = txt;
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [s.start_time, s.recorded_at]);

  const tempColor = s.temp_pass ? '#1D1D1F' : '#FF3B30';
  const intended = fmtHHMMSS(((s.duration_hours || 0) * 60 + (s.duration_minutes || 0)) * 60);
  const cookedLabel = s.raw_or_cooked === 'pre-cooked' ? 'Pre-Cooked' : 'Raw';

  const Row = ({ label, value, valueColor }) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 8 }}>
      <span style={{ flex: '0 0 50%', fontSize: 15, color: '#1D1D1F', textAlign: 'right' }}>{label}</span>
      <span style={{ flex: 1, fontSize: 22, fontWeight: 600, color: valueColor || '#1D1D1F', fontFeatureSettings: '"tnum"' }}>{value}</span>
    </div>
  );

  return (
    <div data-testid={`sous-vide-session-${s.id}`}
      style={{ background: '#FFFFFF', borderRadius: 22, padding: '18px 18px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <span style={{ fontSize: 40, lineHeight: 1 }}>{s.item_icon || '🍲'}</span>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#1D1D1F' }}>
          {s.item_name} — {cookedLabel}
        </p>
      </div>

      <Row label="Items in batch:" value={s.batch_count} />
      <Row label="Initial water temperature:" value={`${Number(s.bath_temp).toFixed(1)}°C`} valueColor={tempColor} />
      <Row label="Start time:" value={fmtClock(s.start_time || s.recorded_at)} />
      <Row label="Intended duration:" value={intended} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 8 }}>
        <span style={{ flex: '0 0 50%', fontSize: 15, color: '#1D1D1F', textAlign: 'right' }}>Current duration:</span>
        <span ref={ref} data-testid={`sous-vide-timer-${s.id}`}
          style={{ flex: 1, fontSize: 22, fontWeight: 600, color: '#1D1D1F', fontFeatureSettings: '"tnum"' }}>00:00:00</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 14, marginTop: 14 }}>
        <button data-testid={`sous-vide-delete-${s.id}`} onClick={() => onDelete(s.id)} aria-label="Delete"
          style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: 4 }}>
          <Trash2 size={18} color="#FF3B30" />
        </button>
        <button data-testid={`sous-vide-complete-${s.id}`} onClick={() => onComplete(s.id)}
          style={{ background: 'transparent', border: 0, fontSize: 14, fontWeight: 700, color: '#1D1D1F', letterSpacing: '0.04em', cursor: 'pointer' }}>
          COMPLETE
        </button>
      </div>
    </div>
  );
};

const SousVideHome = () => {
  const navigate = useNavigate();
  const { adminLocationId, locations } = useLocation2();
  const [active, setActive] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  const load = () => {
    if (!adminLocationId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      api.sousVideList(adminLocationId, 'active').catch(() => []),
      api.sousVideList(adminLocationId, 'complete').catch(() => []),
    ]).then(([a, c]) => {
      setActive(a || []);
      setHistory(c || []);
    }).finally(() => setLoading(false));
  };
  useEffect(load, [adminLocationId]);

  const remove = async (id) => {
    if (!window.confirm('Delete this sous-vide record?')) return;
    try { await api.sousVideDelete(id); load(); } catch (e) { alert(e.message); }
  };

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="sous-vide-home">
      <WizardHeader title="Sous Vide" locationName={locationName} dateStr={today} backTo="/jkhive/routines/more" />

      {loading && <p style={{ color: '#86868B', textAlign: 'center', padding: 18 }}>Loading…</p>}

      {!loading && active.length === 0 && history.length === 0 && (
        <p style={{ color: '#86868B', textAlign: 'center', padding: 24 }}>
          No sous-vide cooks yet. Tap “Add record” to start one.
        </p>
      )}

      {/* Active sessions — large cards with live timers */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {active.map(s => (
          <SessionCard key={s.id} s={s}
            onComplete={(id) => navigate(`/jkhive/sous-vide/${id}/complete`)}
            onDelete={remove} />
        ))}
      </div>

      {/* Completed history — compact rows */}
      {history.length > 0 && (
        <>
          <p style={{ marginTop: 20, marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Recently completed
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {history.map(r => (
              <div key={r.id} data-testid={`sous-vide-row-${r.id}`}
                style={{ background: '#FFFFFF', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <span style={{ fontSize: 28 }}>{r.item_icon || '🍲'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1D1D1F' }}>{r.item_name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#86868B' }}>
                    {r.raw_or_cooked} · ×{r.batch_count} · core {Number(r.final_core_temp ?? r.bath_temp).toFixed(1)}°C · {r.served_or_cooled || '—'} · {new Date(r.completed_at || r.recorded_at).toLocaleString()}
                  </p>
                </div>
                <button onClick={() => remove(r.id)} aria-label="Delete"
                  style={{ background: 'transparent', border: 0, padding: 6, cursor: 'pointer' }}>
                  <Trash2 size={18} color="#FF3B30" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Bottom-right pill "+ Add record" */}
      <div style={{ position: 'fixed', right: 16, bottom: 80, zIndex: 5 }}>
        <button data-testid="sous-vide-add-btn"
          onClick={() => navigate('/jkhive/sous-vide/pick')}
          style={{
            padding: '14px 22px', borderRadius: 999, border: 0,
            background: '#1D1D1F', color: '#FFFFFF', fontSize: 16, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            fontFamily: 'Outfit, sans-serif',
            boxShadow: '0 8px 22px rgba(0,0,0,0.25)',
          }}>
          <Plus size={18} strokeWidth={2.6} /> Add record
        </button>
      </div>
    </div>
  );
};

export default SousVideHome;
