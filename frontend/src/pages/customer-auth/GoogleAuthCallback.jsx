import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { useCustomer } from '../../contexts/CustomerContext';

const GoogleAuthCallback = () => {
  const navigate = useNavigate();
  const { fetchMe } = useCustomer();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash;
    const match = hash.match(/session_id=([^&]+)/);
    if (!match) {
      navigate('/customer-auth', { replace: true });
      return;
    }

    const sessionId = match[1];

    // Clear stale admin tokens to prevent flash
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');

    (async () => {
      try {
        const data = await api.customerGoogleSession(sessionId);
        if (data.token) {
          localStorage.setItem('customer_token', data.token);
        }
        await fetchMe();
        // Clean the hash and go to menu
        window.history.replaceState(null, '', '/menu-catalog');
        navigate('/menu-catalog', { replace: true });
      } catch (err) {
        console.error('Google auth error:', err);
        navigate('/customer-auth', { replace: true, state: { error: 'Google login failed. Please try again.' } });
      }
    })();
  }, [navigate, fetchMe]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#FBFBFD' }}>
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: '#1D1D1F', borderTopColor: 'transparent' }} />
        <p className="text-sm" style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}>
          Signing you in...
        </p>
      </div>
    </div>
  );
};

export default GoogleAuthCallback;
