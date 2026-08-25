import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, MapPin, AlertTriangle, CheckCircle2, Loader2, History } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';

const FONT = { fontFamily: 'Outfit, sans-serif' };

const fmtTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  });
};

const fmtHours = (h) => {
  const n = Number(h) || 0;
  const hh = Math.floor(n);
  const mm = Math.round((n - hh) * 60);
  return `${hh}h ${String(mm).padStart(2, '0')}m`;
};

// Reads GPS once. Resolves with {latitude, longitude, accuracy} or
// {error: "denied"|"unavailable"|"timeout"} so callers can decide.
const readGPS = () => new Promise((resolve) => {
  if (!('geolocation' in navigator)) return resolve({ error: 'unavailable' });
  navigator.geolocation.getCurrentPosition(
    (pos) => resolve({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy_m: pos.coords.accuracy,
    }),
    (err) => {
      const code = err?.code;
      const map = { 1: 'denied', 2: 'unavailable', 3: 'timeout' };
      resolve({ error: map[code] || 'unavailable' });
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
  );
});

const ClockInOut = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading, isAdmin } = useAuth();
  const { adminLocationId, locations } = useLocation2();

  const [status, setStatus] = useState({ clocked_in: false, event: null });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // Admin-only History tab: browse every clock event across staff.
  const [tab, setTab] = useState('recent'); // 'recent' | 'history'
  const [adminEvents, setAdminEvents] = useState([]);
  const [adminStaff, setAdminStaff] = useState([]);
  const [adminFilters, setAdminFilters] = useState({ staff: 'all', location: 'all', days: 30 });
  const [adminLoading, setAdminLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/admin-login');
  }, [authLoading, isAuthenticated, navigate]);

  const refresh = async () => {
    try {
      const [s, h] = await Promise.all([
        api.getClockStatus(),
        api.getMyClockHistory(20),
      ]);
      setStatus(s || { clocked_in: false, event: null });
      setHistory(Array.isArray(h) ? h : []);
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); }, []);

  // Admin: load the staff dropdown once when the History tab is opened
  // and re-run the events query whenever a filter changes. Kept as
  // a separate hook from the "Recent" personal history so staff-only
  // users never pay for the aggregate query.
  useEffect(() => {
    if (!isAdmin || tab !== 'history') return;
    if (adminStaff.length === 0) {
      api.adminGetClockStaff().then((res) => setAdminStaff(res?.items || [])).catch(() => {});
    }
  }, [isAdmin, tab, adminStaff.length]);

  useEffect(() => {
    if (!isAdmin || tab !== 'history') return;
    let cancelled = false;
    setAdminLoading(true);
    const target = adminStaff.find(s => s.account_email === adminFilters.staff);
    api.adminGetClockEvents({
      locationId: adminFilters.location === 'all' ? undefined : adminFilters.location,
      accountEmail: adminFilters.staff === 'all' ? undefined : adminFilters.staff,
      days: adminFilters.days,
      limit: 500,
    })
      .then((rows) => { if (!cancelled) setAdminEvents(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (!cancelled) setAdminEvents([]); })
      .finally(() => { if (!cancelled) setAdminLoading(false); });
    void target;
    return () => { cancelled = true; };
  }, [isAdmin, tab, adminFilters, adminStaff]);

  // For clock-in we use the picked JKHive location; for clock-out we use
  // whichever location the open event was tied to so staff can't "drift"
  // their site mid-shift.
  const activeLocation = useMemo(() => {
    if (status.clocked_in && status.event?.location_id) {
      return locations.find(l => l.id === status.event.location_id) || null;
    }
    return locations.find(l => l.id === adminLocationId) || null;
  }, [status, locations, adminLocationId]);

  const doClockIn = async () => {
    setError(''); setInfo('');
    if (!adminLocationId) { setError('Pick a site at the top before clocking in.'); return; }
    setBusy(true);
    try {
      const gps = await readGPS();
      const payload = {
        location_id: adminLocationId,
        latitude: gps.latitude ?? null,
        longitude: gps.longitude ?? null,
        accuracy_m: gps.accuracy_m ?? null,
        gps_error: gps.error || null,
      };
      const res = await api.clockIn(payload);
      if (res.event && !res.event.verified) {
        setInfo('Clocked in — but GPS was unavailable so this entry is flagged for admin review.');
      } else {
        setInfo('Clocked in.');
      }
      await refresh();
    } catch (e) {
      setError(e.message || 'Clock in failed');
    } finally {
      setBusy(false);
    }
  };

  const doClockOut = async () => {
    setError(''); setInfo('');
    setBusy(true);
    try {
      const gps = await readGPS();
      const payload = {
        location_id: status.event?.location_id || adminLocationId,
        latitude: gps.latitude ?? null,
        longitude: gps.longitude ?? null,
        accuracy_m: gps.accuracy_m ?? null,
        gps_error: gps.error || null,
      };
      const res = await api.clockOut(payload);
      setInfo(`Clocked out — ${fmtHours(res.hours)}`);
      await refresh();
    } catch (e) {
      setError(e.message || 'Clock out failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="clock-page" style={{ ...FONT, paddingBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <button
          data-testid="clock-back"
          onClick={() => navigate('/jkhive/workforce')}
          style={{ background: 'none', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: '#007AFF', ...FONT }}
        >
          <ArrowLeft size={16} /> Back
        </button>
      </div>

      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1D1D1F', margin: '0 0 4px' }}>Clock In / Out</h1>
      <p style={{ fontSize: 13, color: '#86868B', margin: '0 0 16px' }}>
        Geo-verified time tracking. Your location is checked against the site you&apos;re assigned to.
      </p>

      {/* Site is picked in the JKHive header switcher — no need for
          a second picker here. `adminLocationId` from LocationContext
          drives everything below. */}

      {/* Big status card */}
      <div
        data-testid="clock-status-card"
        style={{
          background: status.clocked_in
            ? 'linear-gradient(135deg, #34C759 0%, #30B0C7 100%)'
            : 'linear-gradient(135deg, #1D1D1F 0%, #3A3A3C 100%)',
          color: '#FFFFFF', borderRadius: 24, padding: 22,
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Clock size={18} />
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', opacity: 0.85 }}>
            {status.clocked_in ? 'On the clock' : 'Off the clock'}
          </span>
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          {status.clocked_in
            ? (status.event?.location_name || 'Working')
            : (activeLocation?.name || 'Pick a site to start')}
        </div>
        {status.clocked_in && status.event?.created_at && (
          <div style={{ marginTop: 4, fontSize: 13, opacity: 0.9 }}>
            Since {fmtTime(status.event.created_at)}
          </div>
        )}
        {!status.clocked_in && activeLocation && (
          <div style={{ marginTop: 4, fontSize: 13, opacity: 0.85, display: 'flex', alignItems: 'center', gap: 4 }}>
            <MapPin size={12} /> {activeLocation.address || activeLocation.name}
          </div>
        )}

        <button
          data-testid={status.clocked_in ? 'clock-out-btn' : 'clock-in-btn'}
          disabled={busy || loading || (!status.clocked_in && !adminLocationId)}
          onClick={status.clocked_in ? doClockOut : doClockIn}
          style={{
            marginTop: 18, width: '100%', padding: '14px 18px', borderRadius: 16, border: 0,
            background: '#FFFFFF', color: '#1D1D1F', fontSize: 16, fontWeight: 700,
            cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, ...FONT,
          }}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Clock size={16} />}
          {status.clocked_in ? 'Clock Out' : 'Clock In'}
        </button>
      </div>

      {error && (
        <div data-testid="clock-error" style={{
          marginTop: 12, background: 'rgba(255,59,48,0.08)', borderRadius: 12, padding: '10px 12px',
          color: '#C0392B', fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 8, ...FONT,
        }}>
          <AlertTriangle size={14} style={{ marginTop: 2 }} />
          <span>{error}</span>
        </div>
      )}
      {info && !error && (
        <div data-testid="clock-info" style={{
          marginTop: 12, background: 'rgba(52,199,89,0.10)', borderRadius: 12, padding: '10px 12px',
          color: '#1F7A3A', fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 8, ...FONT,
        }}>
          <CheckCircle2 size={14} style={{ marginTop: 2 }} />
          <span>{info}</span>
        </div>
      )}

      {/* History section — tabs for admin, single Recent list for staff */}
      <div style={{ marginTop: 24 }}>
        {isAdmin ? (
          <div
            data-testid="clock-history-tabs"
            style={{ display: 'inline-flex', gap: 4, padding: 3, borderRadius: 999, background: '#F5F5F7', marginBottom: 12, ...FONT }}
          >
            {[
              { id: 'recent', label: 'My activity' },
              { id: 'history', label: 'History (all staff)' },
            ].map(t => (
              <button
                key={t.id}
                data-testid={`clock-history-tab-${t.id}`}
                onClick={() => setTab(t.id)}
                style={{
                  padding: '6px 12px', borderRadius: 999, border: 0,
                  background: tab === t.id ? '#1D1D1F' : 'transparent',
                  color: tab === t.id ? '#FFFFFF' : '#3A3A3C',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}
              >{t.label}</button>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <History size={14} color="#86868B" />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#86868B' }}>
              Recent
            </span>
          </div>
        )}

        {tab === 'recent' && (
          loading && history.length === 0 ? (
            <div style={{ color: '#86868B', fontSize: 13 }}>Loading…</div>
          ) : history.length === 0 ? (
            <div data-testid="clock-history-empty" style={{ color: '#86868B', fontSize: 13 }}>No events yet.</div>
          ) : (
            <div data-testid="clock-history" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.map(evt => <ClockEventRow key={evt.id} evt={evt} />)}
            </div>
          )
        )}

        {tab === 'history' && isAdmin && (
          <>
            {/* Admin filters row */}
            <div
              data-testid="clock-history-filters"
              style={{
                background: '#FFFFFF', borderRadius: 14, padding: 12, marginBottom: 10,
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: 8,
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              <div>
                <label style={filterLabel}>Staff</label>
                <select
                  data-testid="clock-history-staff"
                  value={adminFilters.staff}
                  onChange={(e) => setAdminFilters(f => ({ ...f, staff: e.target.value }))}
                  style={filterInput}
                >
                  <option value="all">All staff ({adminStaff.length})</option>
                  {adminStaff.map(s => (
                    <option key={s.account_email} value={s.account_email}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={filterLabel}>Site</label>
                <select
                  data-testid="clock-history-location"
                  value={adminFilters.location}
                  onChange={(e) => setAdminFilters(f => ({ ...f, location: e.target.value }))}
                  style={filterInput}
                >
                  <option value="all">All sites</option>
                  {(locations || []).map(l => (
                    <option key={l.id} value={l.id}>{l.name || l.id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={filterLabel}>Window</label>
                <select
                  data-testid="clock-history-days"
                  value={adminFilters.days}
                  onChange={(e) => setAdminFilters(f => ({ ...f, days: Number(e.target.value) }))}
                  style={filterInput}
                >
                  <option value={7}>Last 7 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                  <option value={365}>Last year</option>
                </select>
              </div>
            </div>
            {adminLoading ? (
              <div style={{ color: '#86868B', fontSize: 13 }}>Loading…</div>
            ) : adminEvents.length === 0 ? (
              <div data-testid="clock-history-admin-empty" style={{ color: '#86868B', fontSize: 13 }}>
                No clock events for these filters.
              </div>
            ) : (
              <div data-testid="clock-history-admin" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {adminEvents.map(evt => <ClockEventRow key={evt.id} evt={evt} showUser />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const filterLabel = { fontSize: 10, color: '#86868B', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700, display: 'block', marginBottom: 4, ...FONT };
const filterInput = { width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid #E5E5EA', fontSize: 12, background: '#FFFFFF', color: '#1D1D1F', boxSizing: 'border-box', minWidth: 0, ...FONT };

/**
 * Single clock-event row. Reused by both the personal "Recent" list
 * and the admin History tab; `showUser` toggles the staff-name line
 * so admins can see who the event belongs to.
 */
const ClockEventRow = ({ evt, showUser = false }) => (
  <div
    style={{
      background: '#FFFFFF', borderRadius: 14, padding: '10px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    }}
  >
    <div style={{
      width: 36, height: 36, borderRadius: 12,
      background: evt.type === 'in' ? 'rgba(52,199,89,0.12)' : 'rgba(255,149,0,0.12)',
      color: evt.type === 'in' ? '#34C759' : '#FF9500',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 800, letterSpacing: '0.04em',
    }}>{evt.type === 'in' ? 'IN' : 'OUT'}</div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F' }}>
        {showUser ? (evt.user_name || evt.account_email || 'Unknown') : (evt.location_name || 'Site')}
      </div>
      <div style={{ fontSize: 11, color: '#86868B' }}>
        {showUser && evt.location_name ? `${evt.location_name} · ` : ''}
        {fmtTime(evt.created_at)}
        {evt.hours != null && evt.type === 'out' ? ` · ${fmtHours(evt.hours)}` : ''}
        {evt.distance_m != null ? ` · ${Math.round(evt.distance_m)}m` : ''}
      </div>
    </div>
    {!evt.verified && (
      <span style={{
        fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 999,
        background: 'rgba(255,149,0,0.12)', color: '#FF9500', letterSpacing: '0.04em',
      }}>UNVERIFIED</span>
    )}
  </div>
);

export default ClockInOut;
