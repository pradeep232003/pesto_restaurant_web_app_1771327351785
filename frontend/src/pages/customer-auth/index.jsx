import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Phone, ArrowRight, ShieldCheck } from 'lucide-react';
import Header from '../../components/ui/Header';
import { useCustomer } from '../../contexts/CustomerContext';
import api from '../../lib/api';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '484513340394-hcr42qplgekd9fu0qnqnshfu2mjp76rn.apps.googleusercontent.com';

const ease = [0.16, 1, 0.3, 1];

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

// Google login button that handles OAuth popup directly without useGoogleLogin hook
const GoogleLoginBtn = ({ onSuccess, onError }) => {
  if (!GOOGLE_CLIENT_ID) return null;

  const handleClick = () => {
    const width = 500, height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const redirectUri = window.location.origin;
    const scope = 'openid email profile';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}&prompt=select_account`;

    const popup = window.open(authUrl, 'google-login', `width=${width},height=${height},left=${left},top=${top}`);

    const interval = setInterval(() => {
      try {
        if (!popup || popup.closed) {
          clearInterval(interval);
          return;
        }
        if (popup.location.href.includes('access_token=')) {
          const hash = popup.location.hash.substring(1);
          const params = new URLSearchParams(hash);
          const accessToken = params.get('access_token');
          popup.close();
          clearInterval(interval);
          if (accessToken) {
            onSuccess({ access_token: accessToken });
          } else {
            onError?.();
          }
        }
      } catch {
        // Cross-origin - popup still on Google domain, keep waiting
      }
    }, 500);
  };

  return (
    <button
      data-testid="google-login-btn"
      onClick={handleClick}
      className="w-full flex items-center justify-center gap-3 py-3.5 rounded-full text-sm font-medium transition-all duration-200 mb-6"
      style={{ background: '#FFFFFF', color: '#1D1D1F', fontFamily: 'Outfit, sans-serif', border: '1px solid rgba(0,0,0,0.12)' }}
      onMouseEnter={e => e.currentTarget.style.background = '#F5F5F7'}
      onMouseLeave={e => e.currentTarget.style.background = '#FFFFFF'}
    >
      <GoogleIcon />
      Continue with Google
    </button>
  );
};

const CustomerAuth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { customer, fetchMe } = useCustomer();
  const [mode, setMode] = useState(location.state?.tab || 'login');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(location.state?.error || '');
  const [generatedPassword, setGeneratedPassword] = useState('');

  // Verification step state
  const [verifyStep, setVerifyStep] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    if (location.state?.tab) setMode(location.state.tab);
  }, [location.state]);

  useEffect(() => {
    if (customer && !verifyStep && !generatedPassword) navigate('/menu-catalog');
  }, [customer, verifyStep, generatedPassword, navigate]);

  if (customer && !verifyStep && !generatedPassword) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'register') {
        if (!form.name || !form.email || !form.phone) {
          setError('All fields are required');
          setLoading(false);
          return;
        }
        const data = await api.customerRegister(form.name, form.email, form.phone);
        setGeneratedPassword(data.password);
        setCustomerId(data.customer_id);
        setEmailSent(data.email_sent);
        setDevCode(data.verification_code || '');
        setVerifyStep(true);
      } else {
        if (!form.email || !form.password) {
          setError('Email and password are required');
          setLoading(false);
          return;
        }
        const data = await api.customerLogin(form.email, form.password);
        if (data.token) localStorage.setItem('customer_token', data.token);
        await fetchMe();
        navigate('/menu-catalog');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.customerVerify(customerId, otpCode);
      if (data.token) localStorage.setItem('customer_token', data.token);
      await fetchMe();
      navigate('/menu-catalog');
    } catch (err) {
      setError(err.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: '#FBFBFD' }}>
      <Header cartCount={0} onCartClick={() => navigate('/shopping-cart')} onAccountClick={() => {}} onSearch={() => {}} onLogout={() => {}} />

      <main className="pt-16">
        <div className="max-w-md mx-auto px-6 py-16 md:py-24">
          <AnimatePresence mode="wait">
            {verifyStep ? (
              /* ===== VERIFICATION STEP ===== */
              <motion.div
                key="verify"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.4, ease }}
              >
                <div className="text-center mb-8">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: '#F5F5F7' }}>
                    <ShieldCheck size={28} style={{ color: '#1D1D1F' }} />
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-3" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>
                    Verify Email.
                  </h1>
                  <p className="text-sm" style={{ color: '#86868B' }}>
                    {emailSent
                      ? `We sent a 6-digit code to ${form.email}`
                      : 'Enter the verification code below to activate your account.'}
                  </p>
                </div>

                {/* Show password */}
                <div className="p-5 rounded-2xl mb-6 text-center" style={{ background: '#F5F5F7' }}>
                  <p className="text-xs mb-1.5" style={{ color: '#86868B' }}>Your password (save this)</p>
                  <p data-testid="generated-password" className="text-xl font-semibold tracking-wide select-all" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>
                    {generatedPassword}
                  </p>
                </div>

                {/* Dev fallback code */}
                {devCode && (
                  <div className="p-4 rounded-2xl mb-6 text-center" style={{ background: 'rgba(52,199,89,0.08)' }}>
                    <p className="text-xs mb-1" style={{ color: '#34C759' }}>Verification code (email not configured)</p>
                    <p data-testid="dev-verification-code" className="text-2xl font-bold tracking-widest select-all" style={{ color: '#34C759', fontFamily: 'Outfit, sans-serif' }}>
                      {devCode}
                    </p>
                  </div>
                )}

                {error && (
                  <div data-testid="auth-error" className="mb-6 p-4 rounded-2xl text-sm text-center" style={{ background: 'rgba(255,59,48,0.08)', color: '#FF3B30' }}>
                    {error}
                  </div>
                )}

                <form onSubmit={handleVerify} className="space-y-4">
                  <div className="relative">
                    <ShieldCheck size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#86868B' }} />
                    <input
                      data-testid="verification-code-input"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="6-digit code"
                      className="w-full pl-11 pr-4 py-3.5 rounded-2xl text-sm outline-none text-center tracking-[0.5em] font-semibold"
                      style={{ background: '#F5F5F7', color: '#1D1D1F', border: '1px solid transparent', fontFamily: 'Outfit, sans-serif', fontSize: '1.25rem' }}
                      onFocus={e => e.target.style.borderColor = 'rgba(0,0,0,0.15)'}
                      onBlur={e => e.target.style.borderColor = 'transparent'}
                      autoFocus
                    />
                  </div>

                  <button
                    data-testid="verify-submit-btn"
                    type="submit"
                    disabled={loading || otpCode.length < 6}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full text-sm font-medium transition-all duration-200 disabled:opacity-50"
                    style={{ background: '#1D1D1F', color: '#FFFFFF', fontFamily: 'Outfit, sans-serif' }}
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>Verify & Continue<ArrowRight size={16} /></>
                    )}
                  </button>
                </form>
              </motion.div>
            ) : (
              /* ===== LOGIN / REGISTER ===== */
              <motion.div
                key="auth"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5, ease }}
              >
                <div className="text-center mb-10">
                  <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-3" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>
                    {mode === 'register' ? 'Create Account.' : 'Welcome back.'}
                  </h1>
                  <p className="text-sm" style={{ color: '#86868B' }}>
                    {mode === 'register' ? 'Sign up to place collection orders.' : 'Sign in to continue ordering.'}
                  </p>
                </div>

                {/* Google OAuth */}
                <GoogleLoginBtn
                  onSuccess={async (tokenResponse) => {
                    setLoading(true);
                    setError('');
                    try {
                      const data = await api.customerGoogleLogin(tokenResponse.access_token);
                      if (data.token) {
                        localStorage.setItem('customer_token', data.token);
                      }
                      await fetchMe();
                      navigate('/menu-catalog', { replace: true });
                    } catch (err) {
                      setError('Google login failed. Please try again.');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  onError={() => setError('Google login was cancelled.')}
                />

                {/* Divider - only show if Google login is available */}
                {GOOGLE_CLIENT_ID && (
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.08)' }} />
                    <span className="text-xs" style={{ color: '#86868B' }}>or</span>
                    <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.08)' }} />
                  </div>
                )}

                {/* Toggle */}
                <div className="flex p-1 rounded-full mb-8" style={{ background: '#F5F5F7' }}>
                  {['login', 'register'].map(tab => (
                    <button
                      key={tab}
                      data-testid={`auth-${tab}-tab`}
                      onClick={() => { setMode(tab); setError(''); }}
                      className="flex-1 py-2.5 rounded-full text-sm font-medium transition-all duration-200"
                      style={{
                        background: mode === tab ? '#FFFFFF' : 'transparent',
                        color: mode === tab ? '#1D1D1F' : '#86868B',
                        fontFamily: 'Outfit, sans-serif',
                        boxShadow: mode === tab ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      }}
                    >
                      {tab === 'login' ? 'Login' : 'Register'}
                    </button>
                  ))}
                </div>

                {error && (
                  <div data-testid="auth-error" className="mb-6 p-4 rounded-2xl text-sm text-center" style={{ background: 'rgba(255,59,48,0.08)', color: '#FF3B30' }}>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {mode === 'register' && (
                    <InputField icon={User} testId="customer-name-input" type="text" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Full name" />
                  )}
                  <InputField icon={Mail} testId="customer-email-input" type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="Email address" />
                  {mode === 'register' && (
                    <InputField icon={Phone} testId="customer-phone-input" type="tel" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="Phone number" />
                  )}
                  {mode === 'login' && (
                    <InputField icon={Lock} testId="customer-password-input" type="password" value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} placeholder="Password" />
                  )}

                  <button
                    data-testid="customer-auth-submit"
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full text-sm font-medium transition-all duration-200 disabled:opacity-50"
                    style={{ background: '#1D1D1F', color: '#FFFFFF', fontFamily: 'Outfit, sans-serif' }}
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>{mode === 'register' ? 'Create Account' : 'Sign In'}<ArrowRight size={16} /></>
                    )}
                  </button>
                </form>

                <p className="text-center text-xs mt-8" style={{ color: '#86868B' }}>Collection orders only. No delivery available.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

const InputField = ({ icon: IconComp, testId, type, value, onChange, placeholder }) => (
  <div className="relative">
    <IconComp size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#86868B' }} />
    <input
      data-testid={testId}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full pl-11 pr-4 py-3.5 rounded-2xl text-sm outline-none transition-all"
      style={{ background: '#F5F5F7', color: '#1D1D1F', border: '1px solid transparent', fontFamily: 'Outfit, sans-serif' }}
      onFocus={e => e.target.style.borderColor = 'rgba(0,0,0,0.15)'}
      onBlur={e => e.target.style.borderColor = 'transparent'}
    />
  </div>
);

export default CustomerAuth;
