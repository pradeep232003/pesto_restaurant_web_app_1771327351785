import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, LogOut, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  staff: 'Staff',
  customer: 'Customer',
};

const Profile = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const initials = (user?.name || user?.email || 'U')
    .split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase() || 'U';
  const displayName = user?.name || user?.email || 'User';
  const roleLabel = ROLE_LABELS[user?.role] || (user?.role ? user.role : 'User');

  const handleSignOut = async () => {
    if (!window.confirm('Sign out of JKHive?')) return;
    try { localStorage.removeItem('jkhive_last_route'); } catch { /* noop */ }
    await signOut();
    navigate('/admin-login');
  };

  return (
    <div data-testid="jkhive-profile" style={{ paddingBottom: 32 }}>
      {/* Back button */}
      <button
        data-testid="profile-back"
        onClick={() => navigate(-1)}
        style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: -8, padding: '4px 8px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: '#007AFF', background: 'transparent', border: 0, cursor: 'pointer', marginBottom: 12 }}
      >
        <ArrowLeft size={16} strokeWidth={2.4} /> Back
      </button>

      {/* Profile card */}
      <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '32px 20px 28px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <div style={{ width: 96, height: 96, borderRadius: 999, background: '#1D1D1F', color: '#FFFFFF', fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
          {initials}
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: '#1D1D1F', margin: '0 0 6px' }}>
          {displayName}
        </h2>
        <p style={{ fontSize: 15, color: '#3A3A3C', margin: '0 0 4px' }}>
          {roleLabel} at Jolly's Kafe
        </p>
        {user?.email && (
          <p style={{ fontSize: 13, color: '#86868B', margin: '0 0 4px', wordBreak: 'break-all' }}>
            {user.email}
          </p>
        )}
        <p style={{ fontSize: 13, color: '#86868B', margin: 0 }}>
          Signed in with {user?.email || '—'}
        </p>
      </div>

      {/* Action list */}
      <div style={{ marginTop: 20, background: '#FFFFFF', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <Link
          to="/admin/profile"
          data-testid="profile-my-account"
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', textDecoration: 'none', color: '#1D1D1F', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}
        >
          <div style={{ width: 30, height: 30, borderRadius: 8, background: '#F2F2F7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={16} strokeWidth={2} style={{ color: '#3A3A3C' }} />
          </div>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 500 }}>My Account</span>
          <ChevronRight size={16} strokeWidth={2.2} style={{ color: '#C7C7CC' }} />
        </Link>

        <button
          data-testid="profile-logout"
          onClick={handleSignOut}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', width: '100%', background: 'transparent', border: 0, cursor: 'pointer', textAlign: 'left' }}
        >
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,59,48,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LogOut size={16} strokeWidth={2} style={{ color: '#FF3B30' }} />
          </div>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: '#FF3B30' }}>Log out</span>
        </button>
      </div>
    </div>
  );
};

export default Profile;
