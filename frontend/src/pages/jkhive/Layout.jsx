import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Brain, ClipboardCheck, Users, Settings2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

// Apple-style bottom tab bar (glass blur, SF-feel)
const TABS = [
  { to: '/jkhive',           label: 'Intelligence', icon: Brain,          end: true },
  { to: '/jkhive/routines',  label: 'Routines',     icon: ClipboardCheck },
  { to: '/jkhive/workforce', label: 'Workforce',    icon: Users },
  { to: '/jkhive/manager',   label: 'Manager',      icon: Settings2 },
];

const JKHiveLayout = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading } = useAuth();
  const initial = (user?.name || user?.email || 'U').charAt(0).toUpperCase();

  React.useEffect(() => {
    if (!loading && !isAuthenticated) navigate('/admin-login?return=/jkhive');
  }, [loading, isAuthenticated, navigate]);

  return (
    <div className="min-h-screen pb-24" style={{ background: '#F2F2F7', fontFamily: 'Outfit, -apple-system, BlinkMacSystemFont, sans-serif' }}>
      {/* Top bar */}
      <header className="sticky top-0 z-30 backdrop-blur-2xl" style={{ background: 'rgba(242,242,247,0.78)', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/admin')} className="flex items-center gap-1 -ml-1 px-2 py-1 rounded-lg text-[13px] font-medium active:scale-95" style={{ color: '#007AFF' }}>
            <ArrowLeft size={15} strokeWidth={2.2} /> Admin
          </button>
          <h1 className="text-[17px] font-semibold tracking-tight" style={{ color: '#1D1D1F' }}>JKHive</h1>
          <div data-testid="jkhive-user-avatar" className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold" style={{ background: '#1D1D1F' }}>
            {initial}
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-3xl mx-auto px-5 sm:px-6 pt-6">
        <Outlet />
      </main>

      {/* Bottom tab bar (Apple-style glass) */}
      <nav className="fixed bottom-0 inset-x-0 z-30 backdrop-blur-2xl" style={{ background: 'rgba(255,255,255,0.78)', borderTop: '0.5px solid rgba(0,0,0,0.06)' }}>
        <div className="max-w-3xl mx-auto px-2 py-2 grid grid-cols-4">
          {TABS.map(t => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              data-testid={`jkhive-tab-${t.label.toLowerCase()}`}
              className="flex flex-col items-center justify-center gap-1 py-2 rounded-2xl transition-all active:scale-95"
            >
              {({ isActive }) => (
                <>
                  <t.icon size={22} strokeWidth={isActive ? 2.4 : 1.8} style={{ color: isActive ? '#007AFF' : '#8E8E93' }} />
                  <span className="text-[10px] font-medium tracking-tight" style={{ color: isActive ? '#007AFF' : '#8E8E93' }}>{t.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
        <div style={{ height: 'env(safe-area-inset-bottom)' }} />
      </nav>
    </div>
  );
};

export default JKHiveLayout;
