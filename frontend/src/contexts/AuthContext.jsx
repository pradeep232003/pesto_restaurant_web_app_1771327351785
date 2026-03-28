import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../lib/api';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // null = checking, false = not authenticated, object = authenticated
  const [loading, setLoading] = useState(true);

  // Check session on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const userData = await api.getMe();
      setUser(userData);
    } catch (error) {
      // Not authenticated or token expired
      setUser(false);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    try {
      const userData = await api.login(email, password);
      setUser(userData);
      return { data: { user: userData }, error: null };
    } catch (error) {
      return { data: null, error: { message: error.message } };
    }
  };

  const signOut = async () => {
    try {
      await api.logout();
      setUser(false);
      return { error: null };
    } catch (error) {
      // Still clear local state even if API fails
      setUser(false);
      return { error: { message: error.message } };
    }
  };

  const refreshSession = async () => {
    try {
      const userData = await api.refreshToken();
      setUser(userData);
      return { data: { user: userData }, error: null };
    } catch (error) {
      setUser(false);
      return { data: null, error: { message: error.message } };
    }
  };

  const value = {
    user,
    loading,
    signIn,
    signOut,
    refreshSession,
    checkAuth,
    isAuthenticated: !!user && user !== false,
    isAdmin: user?.role === 'admin',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
