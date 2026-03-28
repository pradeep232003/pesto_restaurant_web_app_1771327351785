import React, { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        setUserProfile(userData);
      } catch (e) {
        console.error('Error parsing saved user:', e);
      }
    }
    setLoading(false);
  }, []);

  // Auth methods using localStorage for demo
  const signIn = async (email, password) => {
    try {
      // Demo authentication - in production, this would call a backend API
      const userData = {
        id: `user_${Date.now()}`,
        email,
        name: email.split('@')[0],
        loginTime: new Date().toISOString()
      };
      
      localStorage.setItem('currentUser', JSON.stringify(userData));
      setUser(userData);
      setUserProfile(userData);
      
      return { data: { user: userData }, error: null };
    } catch (error) {
      return { error: { message: 'Login failed. Please try again.' } };
    }
  }

  const signOut = async () => {
    try {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('rememberUser');
      setUser(null);
      setUserProfile(null);
      return { error: null };
    } catch (error) {
      return { error: { message: 'Logout failed. Please try again.' } };
    }
  }

  const updateProfile = async (updates) => {
    if (!user) return { error: { message: 'No user logged in' } }
    
    try {
      const updatedUser = { ...user, ...updates };
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setUserProfile(updatedUser);
      return { data: updatedUser, error: null };
    } catch (error) {
      return { error: { message: 'Profile update failed.' } };
    }
  }

  const value = {
    user,
    userProfile,
    loading,
    profileLoading,
    signIn,
    signOut,
    updateProfile,
    isAuthenticated: !!user
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
