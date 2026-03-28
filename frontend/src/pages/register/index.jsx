import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import RegistrationForm from './components/RegistrationForm';
import SocialRegistration from './components/SocialRegistration';
import RegistrationBenefits from './components/RegistrationBenefits';
import Icon from '../../components/AppIcon';
import Image from '../../components/AppImage';

const Register = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [cartCount, setCartCount] = useState(3);

  // Check for any pre-filled data from navigation state
  const preFilledEmail = location?.state?.email || '';
  const redirectMessage = location?.state?.message || '';

  useEffect(() => {
    // Scroll to top on page load
    window.scrollTo(0, 0);

    // Check if user is already logged in
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      const userData = JSON.parse(savedUser);
      setUser(userData);
      // Redirect logged-in users to home
      navigate('/home-landing');
    }
  }, [navigate]);

  const handleRegister = (userData) => {
    setUser(userData);
    console.log('User registered:', userData);

    // Store user data
    const userToStore = {
      ...userData,
      id: Date.now(),
      registrationDate: new Date()?.toISOString(),
      avatar: "https://images.unsplash.com/photo-1681398836231-d0b89bd571d6",
      avatarAlt: 'Profile picture placeholder showing default avatar icon'
    };

    localStorage.setItem('currentUser', JSON.stringify(userToStore));

    // Redirect to intended destination
    const redirectTo = localStorage.getItem('loginRedirect') || '/home-landing';
    localStorage.removeItem('loginRedirect');
    navigate(redirectTo);
  };

  const handleSocialRegister = (userData, provider) => {
    setUser(userData);
    console.log(`User registered via ${provider}:`, userData);

    // Store user data
    const userToStore = {
      ...userData,
      id: Date.now(),
      registrationDate: new Date()?.toISOString(),
      avatar: "https://images.unsplash.com/photo-1681398836231-d0b89bd571d6",
      avatarAlt: 'Profile picture placeholder showing default avatar icon'
    };

    localStorage.setItem('currentUser', JSON.stringify(userToStore));

    // Redirect to intended destination
    const redirectTo = localStorage.getItem('loginRedirect') || '/home-landing';
    localStorage.removeItem('loginRedirect');
    navigate(redirectTo);
  };

  const handleCartClick = () => {
    // Store current page for redirect after login
    localStorage.setItem('loginRedirect', '/shopping-cart');
    console.log('Cart clicked');
  };

  const handleAccountClick = (action) => {
    console.log('Account action:', action);
    if (action === 'login') {
      navigate('/login');
    }
  };

  const handleLogout = () => {
    // Clear user data
    localStorage.removeItem('currentUser');
    localStorage.removeItem('loginRedirect');
    setUser(null);
    navigate('/register');
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        cartCount={cartCount}
        user={user}
        onSearch={() => console.log('Search clicked')}
        onCartClick={handleCartClick}
        onAccountClick={handleAccountClick}
        onLogout={handleLogout} />

      {/* Main Content */}
      <main className="pt-16">
        {/* Hero Section */}
        <section className="bg-primary text-primary-foreground py-12 lg:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-primary-foreground/10 rounded-full flex items-center justify-center">
                  <Icon name="UserPlus" size={32} className="text-primary-foreground" />
                </div>
              </div>
              <h1 className="text-3xl lg:text-4xl font-heading font-bold mb-4">
                Join the Pesto Family
              </h1>
              <p className="text-lg text-primary-foreground/90 max-w-2xl mx-auto">
                Create your account to unlock exclusive benefits, faster ordering, and personalized dining experiences
              </p>
            </div>
          </div>
        </section>

        {/* Registration Section */}
        <section className="py-12 lg:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
              {/* Registration Form */}
              <div className="order-2 lg:order-1">
                <div className="bg-card rounded-xl shadow-warm-lg p-6 lg:p-8">
                  <div className="mb-8">
                    <h2 className="text-2xl font-heading font-bold text-foreground mb-2">
                      Create Your Account
                    </h2>
                    <p className="text-muted-foreground">
                      Fill in your details below to get started with your personalized dining experience
                    </p>
                  </div>

                  {redirectMessage &&
                  <div className="mb-6 p-4 bg-success/10 border border-success/20 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Icon name="CheckCircle" size={16} className="text-success" />
                        <p className="text-success text-sm font-medium">{redirectMessage}</p>
                      </div>
                    </div>
                  }

                  {/* Social Registration */}
                  <SocialRegistration onSocialRegister={handleSocialRegister} />

                  {/* Registration Form */}
                  <RegistrationForm
                    onRegister={handleRegister}
                    preFilledEmail={preFilledEmail} />

                </div>
              </div>

              {/* Benefits Section */}
              <div className="order-1 lg:order-2">
                <RegistrationBenefits />

                {/* Featured Image */}
                <div className="mt-8 relative overflow-hidden rounded-xl">
                  <Image
                    src="https://images.unsplash.com/photo-1502133625-c629efee648b"
                    alt="Modern restaurant interior with warm lighting, wooden tables, and customers enjoying meals in cozy atmosphere"
                    className="w-full h-64 lg:h-80 object-cover" />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6">
                    <h3 className="text-white text-xl font-heading font-bold mb-2">
                      Experience Jollys Kafe
                    </h3>
                    <p className="text-white/90 text-sm">
                      Join our community of food lovers and discover why we're the neighborhood's favorite dining destination
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Indicators */}
        <section className="py-12 bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h3 className="text-xl font-heading font-bold text-foreground mb-2">
                Trusted by Food Lovers
              </h3>
              <p className="text-muted-foreground">
                Join thousands of satisfied customers who trust Pesto with their dining experience
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Icon name="Shield" size={24} className="text-success" />
                </div>
                <h4 className="font-body font-medium text-foreground text-sm mb-1">
                  Secure & Safe
                </h4>
                <p className="text-muted-foreground text-xs">
                  Your data is protected with industry-standard encryption
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Icon name="Users" size={24} className="text-primary" />
                </div>
                <h4 className="font-body font-medium text-foreground text-sm mb-1">
                  10,000+ Members
                </h4>
                <p className="text-muted-foreground text-xs">
                  Growing community of satisfied customers
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Icon name="Award" size={24} className="text-accent" />
                </div>
                <h4 className="font-body font-medium text-foreground text-sm mb-1">
                  Award Winning
                </h4>
                <p className="text-muted-foreground text-xs">
                  Recognized for excellence in food and service
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Icon name="Clock" size={24} className="text-success" />
                </div>
                <h4 className="font-body font-medium text-foreground text-sm mb-1">
                  Quick Service
                </h4>
                <p className="text-muted-foreground text-xs">
                  Fast registration and immediate access
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      {/* Footer */}
      <footer className="bg-secondary text-secondary-foreground py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex justify-center items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Icon name="UtensilsCrossed" size={20} color="white" />
              </div>
              <span className="text-lg font-heading font-bold">Jollys Kafe</span>
            </div>
            <p className="text-secondary-foreground/80 text-sm mb-4">
              Creating memorable dining experiences since 2020
            </p>
            <div className="flex justify-center items-center space-x-6 text-sm">
              <button className="hover:text-primary transition-colors duration-200">
                Terms of Service
              </button>
              <button className="hover:text-primary transition-colors duration-200">
                Privacy Policy
              </button>
              <button className="hover:text-primary transition-colors duration-200">
                Contact Us
              </button>
            </div>
            <div className="mt-6 pt-6 border-t border-secondary-foreground/20">
              <p className="text-secondary-foreground/60 text-xs">
                © {new Date()?.getFullYear()} Jollys Kafe. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>);

};

export default Register;