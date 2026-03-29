import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight, ChefHat } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const ease = [0.16, 1, 0.3, 1];

const AdminLogin = () => {
  const navigate = useNavigate();
  const { signIn, isAuthenticated, isAdmin, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && isAuthenticated && isAdmin) navigate('/admin');
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/admin');
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#FBFBFD' }}>
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#1D1D1F', borderTopColor: 'transparent' }} />
    </div>
  );

  return (
    <div className="min-h-screen flex items-start pt-16 sm:items-center sm:pt-0 justify-center px-6" style={{ background: '#FBFBFD' }}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: '#1D1D1F' }}>
            <ChefHat size={28} color="white" strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-2" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>
            Admin.
          </h1>
          <p className="text-sm" style={{ color: '#86868B' }}>Sign in to manage your restaurant.</p>
        </div>

        {error && (
          <div data-testid="admin-login-error" className="mb-6 p-4 rounded-2xl text-sm text-center" style={{ background: 'rgba(255,59,48,0.08)', color: '#FF3B30' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#86868B' }} />
            <input
              data-testid="admin-email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full pl-11 pr-4 py-3.5 rounded-2xl text-sm outline-none transition-all"
              style={{ background: '#F5F5F7', color: '#1D1D1F', border: '1px solid transparent', fontFamily: 'Outfit, sans-serif' }}
              onFocus={e => e.target.style.borderColor = 'rgba(0,0,0,0.15)'}
              onBlur={e => e.target.style.borderColor = 'transparent'}
              autoFocus
            />
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#86868B' }} />
            <input
              data-testid="admin-password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full pl-11 pr-4 py-3.5 rounded-2xl text-sm outline-none transition-all"
              style={{ background: '#F5F5F7', color: '#1D1D1F', border: '1px solid transparent', fontFamily: 'Outfit, sans-serif' }}
              onFocus={e => e.target.style.borderColor = 'rgba(0,0,0,0.15)'}
              onBlur={e => e.target.style.borderColor = 'transparent'}
            />
          </div>
          <button
            data-testid="admin-login-submit"
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full text-sm font-medium transition-all duration-200 disabled:opacity-50"
            style={{ background: '#1D1D1F', color: '#FFFFFF', fontFamily: 'Outfit, sans-serif' }}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>Sign In<ArrowRight size={16} /></>
            )}
          </button>
        </form>

        <p className="text-center text-xs mt-8" style={{ color: '#86868B' }}>
          <button onClick={() => navigate('/')} className="underline transition-colors" style={{ color: '#86868B' }}>Back to site</button>
        </p>
      </motion.div>
    </div>
  );
};

export default AdminLogin;
