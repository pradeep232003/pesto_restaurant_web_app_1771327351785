import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, User, Phone, ArrowRight } from 'lucide-react';
import Header from '../../components/ui/Header';
import { useCustomer } from '../../contexts/CustomerContext';

const ease = [0.16, 1, 0.3, 1];

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const CustomerAuth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { register, login, customer } = useCustomer();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(location.state?.error || '');
  const [success, setSuccess] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');

  if (customer) {
    navigate('/menu-catalog');
    return null;
  }

  const handleGoogleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/customer-auth';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      if (mode === 'register') {
        if (!form.name || !form.email || !form.phone) {
          setError('All fields are required');
          setLoading(false);
          return;
        }
        const data = await register(form.name, form.email, form.phone);
        setGeneratedPassword(data.password);
        setSuccess('Account created! Save your password below.');
      } else {
        if (!form.email || !form.password) {
          setError('Email and password are required');
          setLoading(false);
          return;
        }
        await login(form.email, form.password);
        navigate('/menu-catalog');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: '#FBFBFD' }}>
      <Header cartCount={0} onCartClick={() => navigate('/shopping-cart')} onAccountClick={() => {}} onSearch={() => {}} onLogout={() => {}} />

      <main className="pt-16">
        <div className="max-w-md mx-auto px-6 py-16 md:py-24">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
            className="text-center mb-10"
          >
            <h1
              className="text-3xl sm:text-4xl font-semibold tracking-tight mb-3"
              style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
            >
              {mode === 'register' ? 'Create Account.' : 'Welcome back.'}
            </h1>
            <p className="text-sm" style={{ color: '#86868B' }}>
              {mode === 'register' ? 'Sign up to place collection orders.' : 'Sign in to continue ordering.'}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease }}
          >
            {/* Google OAuth Button */}
            <button
              data-testid="google-login-btn"
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-full text-sm font-medium transition-all duration-200 mb-6"
              style={{
                background: '#FFFFFF',
                color: '#1D1D1F',
                fontFamily: 'Outfit, sans-serif',
                border: '1px solid rgba(0,0,0,0.12)',
              }}
              onMouseEnter={e => e.target.style.background = '#F5F5F7'}
              onMouseLeave={e => e.target.style.background = '#FFFFFF'}
            >
              <GoogleIcon />
              Continue with Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.08)' }} />
              <span className="text-xs" style={{ color: '#86868B' }}>or</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.08)' }} />
            </div>

            {/* Mode Toggle */}
            <div
              className="flex p-1 rounded-full mb-8"
              style={{ background: '#F5F5F7' }}
            >
              <button
                data-testid="auth-login-tab"
                onClick={() => { setMode('login'); setError(''); setSuccess(''); setGeneratedPassword(''); }}
                className="flex-1 py-2.5 rounded-full text-sm font-medium transition-all duration-200"
                style={{
                  background: mode === 'login' ? '#FFFFFF' : 'transparent',
                  color: mode === 'login' ? '#1D1D1F' : '#86868B',
                  fontFamily: 'Outfit, sans-serif',
                  boxShadow: mode === 'login' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                Login
              </button>
              <button
                data-testid="auth-register-tab"
                onClick={() => { setMode('register'); setError(''); setSuccess(''); setGeneratedPassword(''); }}
                className="flex-1 py-2.5 rounded-full text-sm font-medium transition-all duration-200"
                style={{
                  background: mode === 'register' ? '#FFFFFF' : 'transparent',
                  color: mode === 'register' ? '#1D1D1F' : '#86868B',
                  fontFamily: 'Outfit, sans-serif',
                  boxShadow: mode === 'register' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                Register
              </button>
            </div>

            {/* Error */}
            {error && (
              <div
                data-testid="auth-error"
                className="mb-6 p-4 rounded-2xl text-sm text-center"
                style={{ background: 'rgba(255,59,48,0.08)', color: '#FF3B30' }}
              >
                {error}
              </div>
            )}

            {/* Success - Show password */}
            {success && (
              <div className="mb-6 p-5 rounded-2xl text-center" style={{ background: 'rgba(52,199,89,0.08)' }}>
                <p className="text-sm font-medium mb-3" style={{ color: '#34C759' }}>{success}</p>
                {generatedPassword && (
                  <div className="p-4 rounded-xl" style={{ background: '#FFFFFF' }}>
                    <p className="text-xs mb-1.5" style={{ color: '#86868B' }}>Your password:</p>
                    <p
                      data-testid="generated-password"
                      className="text-xl font-semibold tracking-wide select-all"
                      style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
                    >
                      {generatedPassword}
                    </p>
                  </div>
                )}
                <button
                  onClick={() => navigate('/menu-catalog')}
                  className="mt-4 w-full py-3 rounded-full text-sm font-medium transition-colors"
                  style={{ background: '#1D1D1F', color: '#FFFFFF', fontFamily: 'Outfit, sans-serif' }}
                >
                  Start Ordering
                </button>
              </div>
            )}

            {/* Form */}
            {!success && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'register' && (
                  <div className="relative">
                    <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#86868B' }} />
                    <input
                      data-testid="customer-name-input"
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Full name"
                      className="w-full pl-11 pr-4 py-3.5 rounded-2xl text-sm outline-none transition-all"
                      style={{
                        background: '#F5F5F7',
                        color: '#1D1D1F',
                        border: '1px solid transparent',
                        fontFamily: 'Outfit, sans-serif',
                      }}
                      onFocus={e => e.target.style.borderColor = 'rgba(0,0,0,0.15)'}
                      onBlur={e => e.target.style.borderColor = 'transparent'}
                    />
                  </div>
                )}

                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#86868B' }} />
                  <input
                    data-testid="customer-email-input"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="Email address"
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl text-sm outline-none transition-all"
                    style={{
                      background: '#F5F5F7',
                      color: '#1D1D1F',
                      border: '1px solid transparent',
                      fontFamily: 'Outfit, sans-serif',
                    }}
                    onFocus={e => e.target.style.borderColor = 'rgba(0,0,0,0.15)'}
                    onBlur={e => e.target.style.borderColor = 'transparent'}
                  />
                </div>

                {mode === 'register' && (
                  <div className="relative">
                    <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#86868B' }} />
                    <input
                      data-testid="customer-phone-input"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="Phone number"
                      className="w-full pl-11 pr-4 py-3.5 rounded-2xl text-sm outline-none transition-all"
                      style={{
                        background: '#F5F5F7',
                        color: '#1D1D1F',
                        border: '1px solid transparent',
                        fontFamily: 'Outfit, sans-serif',
                      }}
                      onFocus={e => e.target.style.borderColor = 'rgba(0,0,0,0.15)'}
                      onBlur={e => e.target.style.borderColor = 'transparent'}
                    />
                  </div>
                )}

                {mode === 'login' && (
                  <div className="relative">
                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#86868B' }} />
                    <input
                      data-testid="customer-password-input"
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="Password"
                      className="w-full pl-11 pr-4 py-3.5 rounded-2xl text-sm outline-none transition-all"
                      style={{
                        background: '#F5F5F7',
                        color: '#1D1D1F',
                        border: '1px solid transparent',
                        fontFamily: 'Outfit, sans-serif',
                      }}
                      onFocus={e => e.target.style.borderColor = 'rgba(0,0,0,0.15)'}
                      onBlur={e => e.target.style.borderColor = 'transparent'}
                    />
                  </div>
                )}

                <button
                  data-testid="customer-auth-submit"
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full text-sm font-medium transition-all duration-200 disabled:opacity-50"
                  style={{
                    background: '#1D1D1F',
                    color: '#FFFFFF',
                    fontFamily: 'Outfit, sans-serif',
                  }}
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      {mode === 'register' ? 'Create Account' : 'Sign In'}
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Footer note */}
            <p className="text-center text-xs mt-8" style={{ color: '#86868B' }}>
              Collection orders only. No delivery available.
            </p>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default CustomerAuth;
