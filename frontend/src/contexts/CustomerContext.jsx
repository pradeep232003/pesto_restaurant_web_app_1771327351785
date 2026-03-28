import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../lib/api';

const CustomerContext = createContext(null);

export const CustomerProvider = ({ children }) => {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('customer_token'));

  const fetchMe = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const data = await api.customerGetMe(token);
      setCustomer(data);
    } catch {
      setCustomer(null);
      setToken(null);
      localStorage.removeItem('customer_token');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  const register = async (name, email, phone) => {
    const data = await api.customerRegister(name, email, phone);
    if (data.token) {
      setToken(data.token);
      localStorage.setItem('customer_token', data.token);
    }
    await fetchMe();
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
