import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '../../components/ui/Header';
import LoginHeader from './components/LoginHeader';
import LoginForm from './components/LoginForm';
import SocialLogin from './components/SocialLogin';
import Icon from '../../components/AppIcon';


const LoginPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Check if user is already logged in - only set user state, don't redirect automatically
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      const userData = JSON.parse(savedUser);
      setUser(userData);
      // Remove automatic redirect - let user decide to stay or go
    }

    // Store the intended destination for after login
    const from = location?.state?.from?.pathname || '/home-landing';
    if (from !== '/login') {
      localStorage.setItem('loginRedirect', from);
    }
  }, [location]); // Remove navigate dependency to prevent redirect loops

  const handleLogin = async (userData, rememberMe = false) => {
    setIsLoading(true);
    
    try {
      // Simulate login process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Store user data
      const userToStore = {
        ...userData,
        loginTime: new Date()?.toISOString(),
        rememberMe
      };
      
      localStorage.setItem('currentUser', JSON.stringify(userToStore));
      if (rememberMe) {
        localStorage.setItem('rememberUser', 'true');
      }
      
      setUser(userToStore);
      
      // Success notification could be added here
      console.log('Login successful:', userToStore);
      
      // Redirect after successful login
      const redirectTo = localStorage.getItem('loginRedirect') || '/home-landing';
      localStorage.removeItem('loginRedirect');
      navigate(redirectTo);
      
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (userData) => {
    await handleLogin(userData, false);
  };

  const handleCartClick = () => {
    // Store current page for redirect after login
    localStorage.setItem('loginRedirect', '/shopping-cart');
    // Cart functionality would be handled by parent component
  };

  const handleAccountClick = (action) => {
    if (action === 'register') {
      navigate('/register');
    } else if (action === 'login') {
      // User is already on login page, no action needed
      return;
    }
  };

  const handleLogout = () => {
    // Clear user data
    localStorage.removeItem('currentUser');
    localStorage.removeItem('rememberUser');
    localStorage.removeItem('loginRedirect');
    setUser(null);
    // Stay on login page after logout instead of redirecting
  };

  // If user is already logged in, show option to continue or logout
  const renderLoggedInState = () => (
    <div className="bg-card rounded-2xl shadow-warm-lg border border-border p-8 text-center">
      <div className="mb-6">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Icon name="User" size={32} className="text-primary" />
        </div>
        <h2 className="text-xl font-heading font-semibold text-foreground mb-2">
          Welcome back, {user?.name || 'User'}!
        </h2>
        <p className="text-sm font-body text-muted-foreground">
          You're already logged in to your account.
        </p>
      </div>
      
      <div className="space-y-3">
        <button
          onClick={() => navigate('/home-landing')}
          className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg text-sm font-body font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200"
        >
          <Icon name="Home" size={16} />
          <span>Continue to Home</span>
        </button>
        
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg text-sm font-body font-medium text-foreground hover:text-primary hover:bg-muted border border-border transition-all duration-200"
        >
          <Icon name="LogOut" size={16} />
          <span>Sign in with different account</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <Header
        cartCount={0}
        user={user}
        onCartClick={handleCartClick}
        onAccountClick={handleAccountClick}
        onLogout={handleLogout}
        onSearch={() => {}}
      />

      {/* Main Content */}
      <main className="pt-16">
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md">
            {/* Show different content based on login state */}
            {user ? (
              renderLoggedInState()
            ) : (
              <>
                {/* Login Card */}
                <div className="bg-card rounded-2xl shadow-warm-lg border border-border p-8">
                  {/* Header Section */}
                  <LoginHeader />

                  {/* Login Form */}
                  <div className="mt-8">
                    <LoginForm 
                      onLogin={handleLogin}
                      isLoading={isLoading}
                    />
                  </div>

                  {/* Social Login */}
                  <div className="mt-8">
                    <SocialLogin 
                      onSocialLogin={handleSocialLogin}
                      isLoading={isLoading}
                    />
                  </div>
                </div>

                {/* Additional Help */}
                <div className="mt-8 text-center">
                  <p className="text-sm font-body text-muted-foreground">
                    Need help? Contact us at{' '}
                    <a 
                      href="tel:+15551234567" 
                      className="text-primary hover:text-primary/80 transition-colors duration-200 font-medium"
                    >
                      (555) 123-4567
                    </a>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Background Decoration */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-64 h-64 bg-accent/5 rounded-full blur-3xl" />
      </div>
    </div>
  );
};

export default LoginPage;