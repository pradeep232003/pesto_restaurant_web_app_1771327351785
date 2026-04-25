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
    setLoading(true);
    try {
      const userData = await api.getMe();
      setUser(userData);
      return true;
    } catch (error) {
      // Access token might be expired - try refreshing with stored refresh token
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const userData = await api.refreshToken(refreshToken);
          if (userData.access_token) {
            localStorage.setItem('access_token', userData.access_token);
          }
          setUser(userData);
          return true;
        } catch {
          // Refresh also failed, clear tokens
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        }
      }
      setUser(false);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    try {
      const userData = await api.login(email, password);
      // Store tokens for mobile browsers that block cross-origin cookies
      if (userData.access_token) {
        localStorage.setItem('access_token', userData.access_token);
      }
      if (userData.refresh_token) {
        localStorage.setItem('refresh_token', userData.refresh_token);
      }
      setUser(userData);
      return { data: { user: userData }, error: null };
    } catch (error) {
      return { data: null, error: { message: error.message } };
    }
  };

  const signOut = async () => {
    try {
      await api.logout();
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setUser(false);
      return { error: null };
    } catch (error) {
      // Still clear local state even if API fails
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setUser(false);
      return { error: { message: error.message } };
    }
  };

  const refreshSession = async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      const userData = await api.refreshToken(refreshToken);
      // Store new access token
      if (userData.access_token) {
        localStorage.setItem('access_token', userData.access_token);
      }
      setUser(userData);
      return { data: { user: userData }, error: null };
    } catch (error) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
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
    isAdmin: user?.role === 'admin' || user?.role === 'super_admin',
    isSuperAdmin: user?.role === 'super_admin',
    isStaff: user?.role === 'staff' || user?.role === 'admin' || user?.role === 'super_admin',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
