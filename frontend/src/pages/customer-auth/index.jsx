import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Icon from '../../components/AppIcon';
import { useCustomer } from '../../contexts/CustomerContext';

const CustomerAuth = () => {
  const navigate = useNavigate();
  const { register, login, customer } = useCustomer();
  const [mode, setMode] = useState('register');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');

  if (customer) {
    navigate('/menu-catalog');
    return null;
  }

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
        setSuccess(`Account created! Your password is shown below. Save it to log in later.`);
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
    <div className="min-h-screen bg-background">
      <Header cartCount={0} onCartClick={() => navigate('/shopping-cart')} onAccountClick={() => {}} onSearch={() => {}} onLogout={() => {}} />
      <main className="pt-16">
        <div className="max-w-md mx-auto px-4 py-12">
          <div className="bg-card rounded-2xl shadow-warm p-8">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Icon name="User" size={24} color="var(--color-primary)" />
              </div>
              <h1 className="text-2xl font-heading font-bold text-foreground">
                {mode === 'register' ? 'Create Account' : 'Welcome Back'}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {mode === 'register' ? 'Register to place collection orders' : 'Log in to your account'}
              </p>
            </div>

            {/* Mode Toggle */}
            <div className="flex bg-muted rounded-lg p-1 mb-6">
              <button
                data-testid="auth-register-tab"
                onClick={() => { setMode('register'); setError(''); setSuccess(''); setGeneratedPassword(''); }}
                className={`flex-1 py-2 rounded-md text-sm font-body font-medium transition-all ${mode === 'register' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}
              >
                Register
              </button>
              <button
                data-testid="auth-login-tab"
                onClick={() => { setMode('login'); setError(''); setSuccess(''); setGeneratedPassword(''); }}
                className={`flex-1 py-2 rounded-md text-sm font-body font-medium transition-all ${mode === 'login' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}
              >
                Login
              </button>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 mb-4 flex items-center gap-2">
                <Icon name="AlertCircle" size={16} color="var(--color-destructive)" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4">
                <p className="text-sm text-green-700 font-medium">{success}</p>
                {generatedPassword && (
                  <div className="mt-2 bg-white rounded-md p-3 border border-green-300">
                    <p className="text-xs text-muted-foreground mb-1">Your password (save this!):</p>
                    <p data-testid="generated-password" className="font-mono text-lg font-bold text-foreground select-all">{generatedPassword}</p>
                  </div>
                )}
                <button
                  onClick={() => navigate('/menu-catalog')}
                  className="mt-3 w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-body font-medium text-sm hover:bg-primary/90 transition-all"
                >
                  Start Ordering
                </button>
              </div>
            )}

            {!success && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'register' && (
                  <div>
                    <label className="block text-sm font-body font-semibold text-foreground mb-1.5">Full Name</label>
                    <input
                      data-testid="customer-name-input"
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="John Doe"
                      className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground font-body text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-body font-semibold text-foreground mb-1.5">Email</label>
                  <input
                    data-testid="customer-email-input"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="you@example.com"
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground font-body text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>

                {mode === 'register' && (
                  <div>
                    <label className="block text-sm font-body font-semibold text-foreground mb-1.5">Phone Number</label>
                    <input
                      data-testid="customer-phone-input"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="+44 7123 456789"
                      className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground font-body text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>
                )}

                {mode === 'login' && (
                  <div>
                    <label className="block text-sm font-body font-semibold text-foreground mb-1.5">Password</label>
                    <input
                      data-testid="customer-password-input"
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="Your password"
                      className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground font-body text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>
                )}

                <button
                  data-testid="customer-auth-submit"
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-body font-medium text-sm hover:bg-primary/90 transition-all disabled:opacity-60"
                >
                  {loading ? 'Please wait...' : (mode === 'register' ? 'Create Account' : 'Login')}
                </button>
              </form>
            )}

            <p className="text-center text-xs text-muted-foreground mt-4">
              Collection orders only. No delivery available.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CustomerAuth;
