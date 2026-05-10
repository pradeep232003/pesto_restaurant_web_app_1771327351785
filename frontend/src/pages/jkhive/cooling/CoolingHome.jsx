import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Snowflake, ArrowLeft, Bell, BellOff, Trash2, RefreshCw, CalendarX } from 'lucide-react';
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
  const [logging, setLogging] = useState(false);
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

  // Loader extracted so it can be re-invoked on pull-to-refresh.
  const loadData = React.useCallback(async () => {
    if (!adminLocationId) return;
    try {
      const [active, complete] = await Promise.all([
        api.coolingList(adminLocationId, 'cooling'),
        api.coolingList(adminLocationId, 'complete'),
      ]);
      setItems(active || []);
      reconcile(active || []);
      const todayLocal = new Date().toISOString().slice(0, 10);
      const filtered = (complete || []).filter(c => {
        const at = c.completed_at || c.started_at || '';
        return at.slice(0, 10) === todayLocal;
      });
      setCompletedToday(filtered);
    } catch (err) {
      alert('Failed to load: ' + err.message);
    }
  }, [adminLocationId]);

  useEffect(() => {
    if (!adminLocationId) { setLoading(false); return; }
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [adminLocationId, loadData]);

  // Independent ticker — runs the entire time the component is mounted,
  // decoupled from the data loader so it can't be torn down by unrelated
  // re-renders. Uses BOTH a 1-second setInterval AND a requestAnimationFrame
  // loop so iOS Safari / PWA can't pause it; also refreshes on visibility
  // change so backgrounded tabs catch up the moment they come forward.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let raf = 0;
    let lastSec = 0;
    const tick = () => {
      const t = Date.now();
      if (t - lastSec >= 1000) { lastSec = t; setNow(t); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const interval = setInterval(() => setNow(Date.now()), 1000);
    const onVis = () => { if (document.visibilityState === 'visible') setNow(Date.now()); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // Pull-to-refresh on touch devices: drag down ≥ 70 px while at scroll-top.
  useEffect(() => {
    let startY = 0;
    let pulling = false;
    const onTouchStart = (e) => {
      if (window.scrollY > 0) return;
      startY = e.touches[0].clientY;
      pulling = true;
    };
    const onTouchMove = (e) => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy < 0) pulling = false;
    };
    const onTouchEnd = (e) => {
      if (!pulling) return;
      const dy = (e.changedTouches[0]?.clientY || 0) - startY;
      pulling = false;
      if (dy >= 70) loadData();
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [loadData]);

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

  // Live HH:MM:SS clock counting UP from 00:00:00 since `startedAt`.
  // Counts up indefinitely — the server-side push scheduler fires the
  // 75 / 90-min alerts (see /app/backend/routes/cooking_cooling.py).
  // We turn the text red once past 90:00 so it visually flags the breach.
  // Reads `now` from state so React re-renders every second guaranteed.
  const clockCountdown = (startedAtIso, endIso) => {
    const start = new Date(startedAtIso).getTime();
    const ref = endIso ? new Date(endIso).getTime() : now;
    const elapsed = Math.max(0, Math.floor((ref - start) / 1000));
    const hh = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    const mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    const ss = String(elapsed % 60).padStart(2, '0');
    return { text: `${hh}:${mm}:${ss}`, overdue: elapsed >= 90 * 60 };
  };

  // Format a frozen elapsed duration (between two timestamps) — used for
  // already-completed records on the Today's-records list.
  const frozenClock = (startedAtIso, endIso) => {
    const start = new Date(startedAtIso).getTime();
    const ref = new Date(endIso || startedAtIso).getTime();
    const elapsed = Math.max(0, Math.floor((ref - start) / 1000));
    const hh = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    const mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    const ss = String(elapsed % 60).padStart(2, '0');
    return { text: `${hh}:${mm}:${ss}`, overdue: elapsed >= 90 * 60 };
  };

  // Show the big empty card only when BOTH lists (in-progress + today's
  // completed) are empty — otherwise it confused users who'd just submitted.
  const showEmptyState = adminLocationId && !loading && items.length === 0 && completedToday.length === 0;

  const hasNoBulkPrep = completedToday.some(it => it.kind === 'no_bulk_prep');
  const hasRealPrep = items.length > 0 || completedToday.some(it => it.kind !== 'no_bulk_prep');

  const logNoBulkPrep = async () => {
    if (hasRealPrep) {
      alert("You can't mark 'no bulk prep today' once a cooking record has been started.");
      return;
    }
    setLogging(true);
    try {
      await api.coolingNoBulkPrep(adminLocationId);
      await loadData();
    } catch (err) { alert('Failed: ' + err.message); }
    finally { setLogging(false); }
  };

  return (
    <div style={{ paddingBottom: 100, fontFamily: 'Outfit, sans-serif' }} data-testid="cooling-home">
      <WizardHeader title="Cooking & Cooling" locationName={locationName} dateStr={today} backTo="/jkhive/routines" />

      {adminLocationId && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <PushPill state={pushState} onEnable={enablePush} />
          <button data-testid="cooling-refresh-btn" onClick={loadData}
            aria-label="Refresh"
            className="hidden md:inline-flex"
            style={{
              marginLeft: 'auto', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 999, background: '#FFFFFF',
              border: '1px solid rgba(0,0,0,0.08)', color: '#1D1D1F',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
            }}>
            <RefreshCw size={14} strokeWidth={2.4} />
            Refresh
          </button>
        </div>
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
                      <LiveClock
                        startedAt={it.started_at}
                        baseColor={color}
                        testId={`cooling-countdown-${it.id}`}
                      />
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
              const frozen = frozenClock(it.started_at, it.completed_at);
              return (
                <div key={it.id} data-testid={`cooling-history-${it.id}`}
                  style={{
                    display: 'flex', alignItems: 'stretch', gap: 0, padding: 0,
                    background: '#FFFFFF', borderRadius: 16,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    overflow: 'hidden',
                  }}>
                  <button
                    data-testid={`cooling-history-open-${it.id}`}
                    onClick={() => navigate(`/jkhive/cooking-cooling/${it.id}/record`)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 12px 12px 14px',
                      minWidth: 0, background: 'transparent', border: 0, cursor: 'pointer', textAlign: 'left',
                      fontFamily: 'Outfit, sans-serif',
                    }}>
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
                  </button>
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
        disabled={!adminLocationId || hasNoBulkPrep}
        style={{
          position: 'fixed', left: 16, right: 16, bottom: 150, maxWidth: 600, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '18px 16px', borderRadius: 999, border: 0,
          background: '#1D1D1F', color: '#FFFFFF', fontSize: 17, fontWeight: 600,
          cursor: (!adminLocationId || hasNoBulkPrep) ? 'not-allowed' : 'pointer',
          opacity: (!adminLocationId || hasNoBulkPrep) ? 0.4 : 1,
          fontFamily: 'Outfit, sans-serif',
          boxShadow: '0 6px 18px rgba(0,0,0,0.18)', zIndex: 5,
        }}
      >
        <Plus size={20} strokeWidth={2.6} />
        Add new cooking
      </button>

      <button data-testid="log-no-bulk-prep"
        onClick={logNoBulkPrep}
        disabled={!adminLocationId || logging || hasNoBulkPrep || hasRealPrep}
        style={{
          position: 'fixed', left: 16, right: 16, bottom: 96, maxWidth: 600, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '14px 16px', borderRadius: 999,
          border: '1px solid rgba(0,0,0,0.12)',
          background: '#FFFFFF', color: '#1D1D1F', fontSize: 15, fontWeight: 600,
          cursor: (!adminLocationId || logging || hasNoBulkPrep || hasRealPrep) ? 'not-allowed' : 'pointer',
          opacity: (!adminLocationId || logging || hasNoBulkPrep || hasRealPrep) ? 0.5 : 1,
          fontFamily: 'Outfit, sans-serif',
          boxShadow: '0 2px 6px rgba(0,0,0,0.06)', zIndex: 5,
        }}>
        <CalendarX size={18} strokeWidth={2.4} />
        {hasNoBulkPrep ? 'No bulk prep logged ✓' : 'No bulk prep today'}
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

/**
 * Self-contained live HH:MM:SS clock component.
 *
 * Updates the DOM `textContent` directly via a `useRef` every 1 s using a
 * setInterval. Bypasses React's render cycle entirely so iOS Safari's
 * aggressive throttling of background renders cannot freeze the display.
 * Visibility API ensures the clock catches up the moment the tab is
 * brought to the foreground.
 */
const LiveClock = ({ startedAt, baseColor, testId }) => {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!ref.current || !startedAt) return;
    const start = new Date(startedAt).getTime();
    const update = () => {
      if (!ref.current) return;
      const elapsed = Math.max(0, Math.floor((Date.now() - start) / 1000));
      const hh = String(Math.floor(elapsed / 3600)).padStart(2, '0');
      const mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
      const ss = String(elapsed % 60).padStart(2, '0');
      ref.current.textContent = `${hh}:${mm}:${ss}`;
      ref.current.style.color = elapsed >= 90 * 60 ? '#FF3B30' : baseColor;
    };
    update();
    const interval = setInterval(update, 1000);
    const onVis = () => { if (document.visibilityState === 'visible') update(); };
    document.addEventListener('visibilitychange', onVis);
    // Belt-and-braces requestAnimationFrame loop — throttles itself to once
    // per second via lastSec but ensures the clock still ticks if iOS Safari
    // pauses the setInterval.
    let raf = 0;
    let lastSec = 0;
    const tick = () => {
      const t = Date.now();
      if (t - lastSec >= 1000) { lastSec = t; update(); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      clearInterval(interval);
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [startedAt, baseColor]);
  return (
    <p ref={ref} data-testid={testId}
       style={{ fontSize: 14, fontWeight: 800, color: baseColor, margin: '4px 0 0', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em' }}>
      00:00:00
    </p>
  );
};
