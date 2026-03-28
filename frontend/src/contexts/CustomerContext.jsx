import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../lib/api';

const CustomerContext = createContext(null);

export const CustomerProvider = ({ children }) => {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('customer_token'));

  const fetchMe = useCallback(async () => {
    const currentToken = localStorage.getItem('customer_token');
    if (!currentToken) { setLoading(false); return; }
    try {
      const data = await api.customerGetMe(currentToken);
      setCustomer(data);
      setToken(currentToken);
    } catch {
      setCustomer(null);
      setToken(null);
      localStorage.removeItem('customer_token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // CRITICAL: If returning from OAuth callback, skip the /me check.
    // AuthCallback will exchange the session_id and establish the session first.
    if (window.location.hash?.includes('session_id=')) {
      setLoading(false);
      return;
    }
    fetchMe();
  }, [fetchMe]);

  const register = async (name, email, phone) => {
    const data = await api.customerRegister(name, email, phone);
    // JWT is no longer issued at registration - only after email verification
    return data;
  };

  const login = async (email, password) => {
    const data = await api.customerLogin(email, password);
    if (data.token) {
      setToken(data.token);
      localStorage.setItem('customer_token', data.token);
    }
    setCustomer(data.customer);
    return data;
  };

  const logout = async () => {
    try { await api.customerLogout(); } catch {}
    setCustomer(null);
    setToken(null);
    localStorage.removeItem('customer_token');
  };

  const isVerified = customer?.email_verified && customer?.phone_verified;

  return (
    <CustomerContext.Provider value={{ customer, token, loading, isVerified, register, login, logout, fetchMe }}>
      {children}
    </CustomerContext.Provider>
  );
};

export const useCustomer = () => {
  const ctx = useContext(CustomerContext);
  if (!ctx) throw new Error('useCustomer must be used within CustomerProvider');
  return ctx;
};
