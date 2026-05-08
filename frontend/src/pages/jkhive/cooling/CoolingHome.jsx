import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Snowflake, ArrowLeft, Bell, BellOff, Trash2 } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from './_shared';
import { reconcile, ageStatus, STATUS_COLOR, STATUS_LABEL, clearForLog } from './cooling_alarms';
import { ensurePushSubscribed, pushSupported } from './webpush';

/**
 * /jkhive/cooking-cooling — list currently cooling items + Add new.
 */
const CoolingHome = () => {
  const navigate = useNavigate();
  const { adminLocationId, locations } = useLocation2();
  const [items, setItems] = useState([]);
  const [completedToday, setCompletedToday] = useState([]);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line no-unused-vars
  const [tick, setTick] = useState(0);
  const [pushState, setPushState] = useState('idle'); // idle | enabled | denied | unsupported
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  // Detect push state on mount (and after enable attempt).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!pushSupported()) { setPushState('unsupported'); return; }
    if (Notification.permission === 'denied') setPushState('denied');
    else if (Notification.permission === 'granted') setPushState('enabled');
    else setPushState('idle');
  }, []);

  const enablePush = async () => {
    const r = await ensurePushSubscribed(adminLocationId);
    if (r.ok) setPushState('enabled');
    else if (r.reason === 'denied') setPushState('denied');
    else if (r.reason === 'unsupported') setPushState('unsupported');
  };

  // Confirm-then-delete an in-progress cooling record (e.g. accidental start).
  const handleDelete = async (it, e) => {
    e.stopPropagation();
    const ok = window.confirm(`Delete "${it.item_name}"?\n\nThis will permanently remove this cooling record. This can't be undone.`);
    if (!ok) return;
    try {
      await api.coolingDelete(it.id);
      clearForLog(it.id);
      setItems(prev => prev.filter(x => x.id !== it.id));
      setCompletedToday(prev => prev.filter(x => x.id !== it.id));
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

  useEffect(() => {
    if (!adminLocationId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      api.coolingList(adminLocationId, 'cooling'),
      api.coolingList(adminLocationId, 'complete'),
    ])
      .then(([active, complete]) => {
        setItems(active || []);
        reconcile(active || []);
        // Keep only records completed today (server returns ISO strings in UTC)
        const todayLocal = new Date().toISOString().slice(0, 10);
        const filtered = (complete || []).filter(c => {
          const at = c.completed_at || c.started_at || '';
          return at.slice(0, 10) === todayLocal;
        });
        setCompletedToday(filtered);
      })
      .catch(err => alert('Failed to load: ' + err.message))
      .finally(() => setLoading(false));
    // Re-render every 50ms so the MM:SS:CS stopwatch ticks visibly.
    const t = setInterval(() => setTick(x => x + 1), 50);
    return () => clearInterval(t);
  }, [adminLocationId]);

  // Pretty elapsed time since `iso`.
  const elapsed = (iso) => {
    const ms = Date.now() - new Date(iso).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m ago`;
  };

  // Countdown text to the 90-min cooling deadline.
  // < 90 min remaining → "1h 15m left" / "12m left"
  // ≥ 90 min elapsed   → "12m overdue"
  const remaining = (iso) => {
    const elapsedMin = (Date.now() - new Date(iso).getTime()) / 60000;
    if (elapsedMin < 90) {
      const left = Math.max(0, Math.ceil(90 - elapsedMin));
      const h = Math.floor(left / 60);
      const m = left % 60;
      return { text: h > 0 ? `${h}h ${m}m left` : `${m}m left`, overdue: false };
    }
    const over = Math.floor(elapsedMin - 90);
    return { text: `${over}m overdue`, overdue: true };
  };

  // Live MM:SS:MS clock counting down from 90:00:00 since `startedAt`.
  // MS is base-60 (0-59), derived from the sub-second portion ×60 — keeps
  // every pair of the stopwatch on the same scale.
  const clockCountdown = (startedAtIso, endIso) => {
    const start = new Date(startedAtIso).getTime();
    const ref = endIso ? new Date(endIso).getTime() : Date.now();
    const totalMs = 90 * 60 * 1000;
    const elapsedMs = Math.max(0, ref - start);
    const left = Math.max(0, totalMs - elapsedMs);
    const totalSec = Math.floor(left / 1000);
    const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const ss = String(totalSec % 60).padStart(2, '0');
    const ms60 = String(Math.floor(((left % 1000) / 1000) * 60)).padStart(2, '0');
    return { text: `${mm}:${ss}:${ms60}`, overdue: left === 0 };
  };

  // Show the big empty card only when BOTH lists (in-progress + today's
  // completed) are empty — otherwise it confused users who'd just submitted.
  const showEmptyState = adminLocationId && !loading && items.length === 0 && completedToday.length === 0;

  return (
    <div style={{ paddingBottom: 100, fontFamily: 'Outfit, sans-serif' }} data-testid="cooling-home">
      <WizardHeader title="Cooking & Cooling" locationName={locationName} dateStr={today} backTo="/jkhive/routines" />

      {adminLocationId && (
        <PushPill state={pushState} onEnable={enablePush} />
      )}

      {!adminLocationId && (
        <p style={{ color: '#FF9500', padding: 18 }}>Please pick a location from JKHive home first.</p>
      )}

      {adminLocationId && loading && (
        <p style={{ color: '#86868B', padding: 18, textAlign: 'center' }}>Loading…</p>
      )}

      {showEmptyState && (
        <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '36px 22px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ width: 64, height: 64, borderRadius: 999, background: '#E0F4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <Snowflake size={32} color="#30B0C7" strokeWidth={2} />
          </div>
          <p style={{ fontSize: 17, fontWeight: 700, color: '#1D1D1F', margin: '0 0 4px' }}>Nothing cooling right now</p>
          <p style={{ fontSize: 13, color: '#86868B', margin: 0 }}>Tap the button below to start a new cooling record.</p>
        </div>
      )}

      {adminLocationId && !loading && items.length > 0 && (
        <>
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#86868B', margin: '6px 4px 8px' }}>
            Currently cooling
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map(it => {
              const status = ageStatus(it.started_at);
              const color = STATUS_COLOR[status];
              const label = STATUS_LABEL[status];
              return (
                <div
                  key={it.id}
                  data-testid={`cooling-row-${it.id}`}
                  style={{
                    display: 'flex', alignItems: 'stretch',
                    background: '#FFFFFF', borderRadius: 20,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    borderLeft: `4px solid ${color}`,
                    overflow: 'hidden',
                  }}
                >
                  <button
                    data-testid={`cooling-item-${it.id}`}
                    onClick={() => navigate(`/jkhive/cooking-cooling/${it.id}/record`)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', gap: 14, padding: '16px 12px 16px 16px',
                      background: 'transparent', border: 0, cursor: 'pointer', textAlign: 'left',
                      fontFamily: 'Outfit, sans-serif',
                    }}
                  >
                    <span style={{ fontSize: 36 }}>{categoryEmoji(it.item_category)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 16, fontWeight: 700, color: '#1D1D1F', margin: 0 }}>{it.item_name}</p>
                      <p style={{ fontSize: 12, color: '#86868B', margin: '2px 0 0' }}>
                        Started at {Number(it.start_temp_c).toFixed(1)}°C · {elapsed(it.started_at)}
                      </p>
                      {(() => {
                        const c = clockCountdown(it.started_at);
                        return (
                          <p data-testid={`cooling-countdown-${it.id}`}
                             style={{ fontSize: 14, fontWeight: 800, color: c.overdue ? '#FF3B30' : color, margin: '4px 0 0', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em' }}>
                            {c.text}
                          </p>
                        );
                      })()}
                    </div>
                    <span data-testid={`cooling-status-${status}`} style={{
                      fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 999,
                      background: color, color: '#FFFFFF', whiteSpace: 'nowrap',
                    }}>{label}</span>
                  </button>
                  <button
                    data-testid={`cooling-delete-${it.id}`}
                    onClick={(e) => handleDelete(it, e)}
                    aria-label={`Delete ${it.item_name}`}
                    style={{
                      width: 52, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'transparent', border: 0, borderLeft: '1px solid rgba(0,0,0,0.06)',
                      cursor: 'pointer', color: '#FF3B30',
                    }}
                  >
                    <Trash2 size={18} strokeWidth={2.2} />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Today's completed records — gives staff visible confirmation that
          their submitted records are actually saved against this location. */}
      {adminLocationId && !loading && completedToday.length > 0 && (
        <>
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#86868B', margin: '22px 4px 8px' }}>
            Today's records · {completedToday.length}
          </p>
          <div data-testid="cooling-history-today" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {completedToday.map(it => {
              const passed = (it.end_temp_c ?? 0) <= (it.target_temp_c ?? 8);
              const passColor = passed ? '#34C759' : '#FF3B30';
              const time = (it.completed_at || '').slice(11, 16);
              // Frozen MM:SS countdown — what was on the clock when this
              // record was submitted. Shows that it landed under the 90:00
              // limit (pass) or that they ran out of time (overdue).
              const frozen = clockCountdown(it.started_at, it.completed_at);
              return (
                <div key={it.id} data-testid={`cooling-history-${it.id}`}
                  style={{
                    display: 'flex', alignItems: 'stretch', gap: 0, padding: 0,
                    background: '#FFFFFF', borderRadius: 16,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    overflow: 'hidden',
                  }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 12px 12px 14px', minWidth: 0 }}>
                    <span style={{ fontSize: 28 }}>{categoryEmoji(it.item_category)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#1D1D1F', margin: 0 }}>{it.item_name}</p>
                      <p style={{ fontSize: 11, color: '#86868B', margin: '2px 0 0' }}>
                        Cooked {Number(it.start_temp_c).toFixed(0)}° → <b style={{ color: passColor }}>{Number(it.end_temp_c).toFixed(1)}°C</b>
                        {it.completed_by_name ? ` · by ${it.completed_by_name}` : ''}
                        {time ? ` · ${time}` : ''}
                      </p>
                      <p data-testid={`cooling-history-clock-${it.id}`}
                         style={{ fontSize: 12, fontWeight: 800, color: frozen.overdue ? '#FF3B30' : passColor, margin: '3px 0 0', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em' }}>
                        {frozen.text}
                      </p>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999,
                      background: passColor, color: '#FFFFFF', whiteSpace: 'nowrap',
                    }}>{passed ? 'PASS' : 'OVER'}</span>
                  </div>
                  <button
                    data-testid={`cooling-history-delete-${it.id}`}
                    onClick={(e) => handleDelete(it, e)}
                    aria-label={`Delete ${it.item_name}`}
                    style={{
                      width: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'transparent', border: 0, borderLeft: '1px solid rgba(0,0,0,0.06)',
                      cursor: 'pointer', color: '#FF3B30',
                    }}>
                    <Trash2 size={16} strokeWidth={2.2} />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      <button
        data-testid="add-new-cooling"
        onClick={() => navigate('/jkhive/cooking-cooling/new')}
        disabled={!adminLocationId}
        style={{
          position: 'fixed', left: 16, right: 16, bottom: 96, maxWidth: 600, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '18px 16px', borderRadius: 999, border: 0,
          background: '#1D1D1F', color: '#FFFFFF', fontSize: 17, fontWeight: 600,
          cursor: 'pointer', opacity: adminLocationId ? 1 : 0.5,
          fontFamily: 'Outfit, sans-serif',
          boxShadow: '0 6px 18px rgba(0,0,0,0.18)', zIndex: 5,
        }}
      >
        <Plus size={20} strokeWidth={2.6} />
        Add new cooling
      </button>
    </div>
  );
};

export const categoryEmoji = (cat) => {
  const map = {
    Beef: '🐄', Chicken: '🐔', Eggs: '🥚', 'Fish (other)': '🎣',
    'Flat Fish': '🐟', Game: '🦌', Lamb: '🐑', Milk: '🥛', Molluscs: '🦑',
    Pastry: '🥐', Pork: '🐷', 'Rice And Grains': '🌾', 'Round Fish': '🐠',
    Salad: '🥗', Turkey: '🦃', General: '🥘',
  };
  return map[cat] || '🥘';
};

const PushPill = ({ state, onEnable }) => {
  if (state === 'enabled') {
    return (
      <div data-testid="push-state-enabled" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999,
        background: 'rgba(52,199,89,0.12)', color: '#1F8A3F', fontSize: 12, fontWeight: 700,
        marginBottom: 10,
      }}>
        <Bell size={14} strokeWidth={2.4} /> Background alerts on
      </div>
    );
  }
  if (state === 'denied') {
    return (
      <div data-testid="push-state-denied" style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12,
        background: 'rgba(255,59,48,0.08)', color: '#A82218', fontSize: 12, fontWeight: 600,
        marginBottom: 12,
      }}>
        <BellOff size={16} strokeWidth={2.4} />
        Notifications blocked. Enable them in your browser settings to get cooling alerts when JKHive is closed.
      </div>
    );
  }
  if (state === 'unsupported') {
    return (
      <div data-testid="push-state-unsupported" style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12,
        background: 'rgba(255,149,0,0.10)', color: '#8C5400', fontSize: 12, fontWeight: 600,
        marginBottom: 12,
      }}>
        <BellOff size={16} strokeWidth={2.4} />
        On iPhone/iPad, tap Share → "Add to Home Screen" so JKHive can wake you up at 75 / 90 mins.
      </div>
    );
  }
  return (
    <button data-testid="push-enable-btn" onClick={onEnable} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999,
      background: '#1D1D1F', color: '#FFFFFF', fontSize: 12, fontWeight: 700, border: 0, cursor: 'pointer',
      marginBottom: 12, fontFamily: 'Outfit, sans-serif',
    }}>
      <Bell size={14} strokeWidth={2.6} /> Turn on background alerts
    </button>
  );
};

export default CoolingHome;
