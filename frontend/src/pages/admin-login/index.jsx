import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import Icon from '../../components/AppIcon';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const { signIn, isAuthenticated, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in as admin
  useEffect(() => {
    if (!authLoading && isAuthenticated && isAdmin) {
      navigate('/admin-menu');
    }
  }, [isAuthenticated, isAdmin, authLoading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: loginError } = await signIn(email, password);
      
      if (loginError) {
        setError(loginError.message);
        setLoading(false);
        return;
      }

      if (data?.user?.role !== 'admin') {
        setError('Access denied. Admin privileges required.');
        setLoading(false);
        return;
      }

      // Success - redirect to admin panel
      navigate('/admin-menu');
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4"
          >
            <Icon name="Shield" className="w-8 h-8 text-primary" />
          </motion.div>
          <h1 className="text-2xl font-bold text-foreground">Admin Portal</h1>
          <p className="text-muted-foreground mt-2">Sign in to manage your restaurant</p>
        </div>

        {/* Login Form */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-2xl shadow-lg border border-border p-8"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3"
              >
                <Icon name="AlertCircle" className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </motion.div>
            )}

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Icon name="Mail" className="h-5 w-5 text-muted-foreground" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@jollys.com"
                  required
                  data-testid="admin-email-input"
                  className="block w-full pl-10 pr-4 py-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Icon name="Lock" className="h-5 w-5 text-muted-foreground" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  data-testid="admin-password-input"
                  className="block w-full pl-10 pr-12 py-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <Icon
                    name={showPassword ? 'EyeOff' : 'Eye'}
                    className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors"
                  />
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              data-testid="admin-login-submit"
              className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary-foreground border-t-transparent"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <Icon name="LogIn" className="w-5 h-5" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Back to Home */}
          <div className="mt-6 text-center">
            <a
              href="/"
              className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
            >
              <Icon name="ArrowLeft" className="w-4 h-4" />
              Back to restaurant
            </a>
          </div>
        </motion.div>

        {/* Security Notice */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          <Icon name="Lock" className="w-3 h-3 inline mr-1" />
          Secure admin access only
        </p>
      </motion.div>
    </div>
  );
};

export default AdminLogin;
