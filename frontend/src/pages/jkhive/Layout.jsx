import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Brain, ClipboardCheck, Users, Settings2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const TABS = [
  { to: '/jkhive',           label: 'Intelligence', icon: Brain },
  { to: '/jkhive/routines',  label: 'Routines',     icon: ClipboardCheck },
  { to: '/jkhive/workforce', label: 'Workforce',    icon: Users },
  { to: '/jkhive/manager',   label: 'Manager',      icon: Settings2 },
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
  const { user, isAuthenticated, loading } = useAuth();
  const initial = (user?.name || user?.email || 'U').charAt(0).toUpperCase();

  const isTabActive = (to) => {
    if (to === '/jkhive') return location.pathname === '/jkhive' || location.pathname === '/jkhive/';
    return location.pathname === to || location.pathname.startsWith(to + '/');
  };

  React.useEffect(() => {
    if (!loading && !isAuthenticated) navigate('/admin-login?return=/jkhive');
  }, [loading, isAuthenticated, navigate]);

  return (
    <div style={{ minHeight: '100vh', background: '#F2F2F7', fontFamily: 'Outfit, -apple-system, BlinkMacSystemFont, sans-serif' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(242,242,247,0.92)', backdropFilter: 'saturate(180%) blur(16px)', WebkitBackdropFilter: 'saturate(180%) blur(16px)', borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
        <div style={{ maxWidth: '768px', margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => navigate('/admin')} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: '#007AFF', background: 'transparent', border: 0, cursor: 'pointer' }}>
            <ArrowLeft size={15} strokeWidth={2.2} /> Admin
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

      <main style={{ maxWidth: '768px', margin: '0 auto', padding: '24px 20px 140px 20px' }}>
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
