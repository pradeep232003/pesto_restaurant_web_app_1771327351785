import React from 'react';
import { Outlet, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Brain, ClipboardCheck, Users, Settings2, MapPin, X, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';
import { installSwMessageBridge } from './cooling/webpush';

const ALL_TABS = [
  { to: '/jkhive',           label: 'Intelligence', icon: Brain,          adminOnly: false },
  { to: '/jkhive/routines',  label: 'Routines',     icon: ClipboardCheck, adminOnly: false },
  { to: '/jkhive/workforce', label: 'Workforce',    icon: Users,          adminOnly: false },
  { to: '/jkhive/manager',   label: 'Manager',      icon: Settings2,      adminOnly: true },
];

const FooterTab = ({ tab, isActive }) => (
  <Link
    to={tab.to}
    data-testid={`jkhive-tab-${tab.label.toLowerCase()}`}
    style={{ textDecoration: 'none' }}
  >
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 4, padding: '8px 4px', borderRadius: 12,
      background: isActive ? 'rgba(0,122,255,0.08)' : 'transparent',
      transition: 'all 0.15s ease',
    }}>
      <tab.icon size={24} strokeWidth={isActive ? 2.4 : 1.9} style={{ color: isActive ? '#007AFF' : '#3A3A3C' }} />
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '-0.01em', color: isActive ? '#007AFF' : '#3A3A3C' }}>
        {tab.label}
      </span>
    </div>
  </Link>
);

const JKHiveLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, isAdmin, loading } = useAuth();
  const { adminLocationId, setAdminLocationId, locations } = useLocation2();
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const initial = (user?.name || user?.email || 'U').charAt(0).toUpperCase();
  const currentLoc = locations.find(l => l.id === adminLocationId);
  const locShort = currentLoc?.name ? currentLoc.name.split(',')[0] : 'Pick site';

  const TABS = React.useMemo(
    () => ALL_TABS.filter(t => !t.adminOnly || isAdmin),
    [isAdmin],
  );

  // Notification taps fired from /cooling-sw.js post a {type:'jkhive-nav', url}
  // message to the foreground tab. Route inside the SPA on receive.
  React.useEffect(() => installSwMessageBridge(navigate), [navigate]);

  // Auto-open picker if no location selected and user has access to ≥ 1 site.
  React.useEffect(() => {
    if (!loading && isAuthenticated && !adminLocationId && locations.length > 0) {
      setPickerOpen(true);
    }
  }, [loading, isAuthenticated, adminLocationId, locations.length]);

  const isTabActive = (to) => {
    if (to === '/jkhive') return location.pathname === '/jkhive' || location.pathname === '/jkhive/';
    return location.pathname === to || location.pathname.startsWith(to + '/');
  };

  // Wider pages opt into a desktop-friendly max width. Shift Mgmt's
  // RotaCloud-style grid + the BI dashboard + the Sales Summary charts
  // all benefit from the room on laptops; mobile is unaffected because
  // the value is just a max — narrow screens still fill the width.
  const WIDE_ROUTES = ['/jkhive/shifts', '/jkhive/bi', '/jkhive/sales-summary', '/jkhive/compliance', '/jkhive/inspection', '/jkhive/documents', '/jkhive/menu', '/jkhive/invoices'];
  const isWide = WIDE_ROUTES.some(r => location.pathname === r || location.pathname.startsWith(r + '/'));
  const contentMax = isWide ? '1280px' : '768px';

  React.useEffect(() => {
    if (!loading && !isAuthenticated) navigate('/admin-login?return=/jkhive');
  }, [loading, isAuthenticated, navigate]);

  // Remember the user's current JKHive route so future logins resume here
  // (cleared on explicit logout).
  React.useEffect(() => {
    try { localStorage.setItem('jkhive_last_route', location.pathname + location.search); } catch { /* noop */ }
  }, [location.pathname, location.search]);

  return (
    <div style={{ minHeight: '100vh', background: '#F2F2F7', fontFamily: 'Outfit, -apple-system, BlinkMacSystemFont, sans-serif' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(242,242,247,0.92)', backdropFilter: 'saturate(180%) blur(16px)', WebkitBackdropFilter: 'saturate(180%) blur(16px)', borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
        <div style={{ maxWidth: contentMax, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <button
            data-testid="jkhive-location-pill"
            onClick={() => setPickerOpen(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '6px 10px', borderRadius: 999,
              background: adminLocationId ? '#FFFFFF' : '#FFE5B4',
              border: '1px solid rgba(0,0,0,0.08)',
              color: '#1D1D1F', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontFamily: 'inherit',
            }}>
            <MapPin size={14} strokeWidth={2.4} style={{ color: adminLocationId ? '#0A84C9' : '#FF9500' }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{locShort}</span>
          </button>
          <h1 style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em', color: '#1D1D1F', margin: 0 }}>JKHive</h1>
          <button
            data-testid="jkhive-user-avatar"
            onClick={() => navigate('/jkhive/profile')}
            style={{ width: 36, height: 36, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 600, background: '#1D1D1F', border: 0, cursor: 'pointer', padding: 0 }}
          >
            {initial}
          </button>
        </div>
      </header>

      {pickerOpen && (
        <LocationPickerSheet
          locations={locations}
          currentId={adminLocationId}
          onPick={(id) => { setAdminLocationId(id); setPickerOpen(false); }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      <main style={{ maxWidth: contentMax, margin: '0 auto', padding: '8px 20px 140px 20px' }}>
        <Outlet />
      </main>

      <nav
        data-testid="jkhive-footer-nav"
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 9999,
          background: '#FFFFFF',
          borderTop: '1px solid rgba(0,0,0,0.10)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ maxWidth: '768px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', padding: '6px 4px', paddingBottom: 'calc(6px + env(safe-area-inset-bottom))' }}>
          {TABS.map(t => <FooterTab key={t.to} tab={t} isActive={isTabActive(t.to)} />)}
        </div>
      </nav>
    </div>
  );
};

export default JKHiveLayout;

const LocationPickerSheet = ({ locations, currentId, onPick, onClose }) => (
  <div
    data-testid="jkhive-location-sheet"
    style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    onClick={onClose}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: '100%', maxWidth: 460, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        background: '#FFFFFF', borderRadius: 22,
        boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
        fontFamily: 'inherit', overflow: 'hidden',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 18px 8px' }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em', color: '#1D1D1F', margin: 0 }}>Pick a location</h2>
        <button onClick={onClose} aria-label="Close"
          style={{ background: 'transparent', border: 0, padding: 6, cursor: 'pointer', color: '#86868B' }}>
          <X size={22} strokeWidth={2.4} />
        </button>
      </div>
      <p style={{ fontSize: 13, color: '#86868B', margin: '0 18px 14px' }}>
        All routines and records you submit will be filed against this site.
      </p>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {locations.map(l => {
          const active = l.id === currentId;
          return (
            <button key={l.id}
              data-testid={`jkhive-loc-${l.id}`}
              onClick={() => onPick(l.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                background: active ? 'rgba(0,122,255,0.08)' : '#F8F8FA',
                border: active ? '1.5px solid #0A84C9' : '1px solid rgba(0,0,0,0.06)',
                borderRadius: 14, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                flexShrink: 0,
              }}>
              <MapPin size={20} strokeWidth={2.2} style={{ color: active ? '#0A84C9' : '#86868B' }} />
              <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#1D1D1F' }}>{l.name}</span>
              {active && <Check size={18} strokeWidth={2.6} color="#0A84C9" />}
            </button>
          );
        })}
      </div>
    </div>
  </div>
);
