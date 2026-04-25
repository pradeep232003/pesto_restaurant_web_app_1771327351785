import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { useCustomer } from '../../contexts/CustomerContext';

const GoogleAccessTokenCallback = () => {
  const navigate = useNavigate();
  const { fetchMe } = useCustomer();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');

    if (!accessToken) {
      navigate('/', { replace: true });
      return;
    }

    (async () => {
      try {
        const data = await api.customerGoogleLogin(accessToken);
        if (data.token) {
          localStorage.setItem('customer_token', data.token);
        }
        await fetchMe();
        window.history.replaceState(null, '', '/');
        navigate('/', { replace: true });
      } catch (err) {
        console.error('Google auth redirect error:', err);
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

export default GoogleAccessTokenCallback;
