import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '../../components/ui/Header';
import HeroSection from './components/HeroSection';
import SpecialDealsSection from './components/SpecialDealsSection';
import MenuPreviewSection from './components/MenuPreviewSection';
import WhyChooseUsSection from './components/WhyChooseUsSection';
import TestimonialsSection from './components/TestimonialsSection';
import FooterSection from './components/FooterSection';

const HomeLanding = () => {
  const navigate = useNavigate();
  const [cartCount, setCartCount] = useState(0);
  const [user, setUser] = useState(null);

  // Mock user data - in real app this would come from auth context
  useEffect(() => {
    // Simulate checking for logged in user
    const mockUser = localStorage.getItem('currentUser');
    if (mockUser) {
      setUser(JSON.parse(mockUser));
    }

    // Simulate cart count from localStorage
    const mockCartCount = localStorage.getItem('cartCount');
    if (mockCartCount) {
      setCartCount(parseInt(mockCartCount, 10));
    }
  }, []);

  const handleOrderNow = () => {
    navigate('/menu-catalog');
  };

  const handleViewDeal = (deal) => {
    if (deal === 'all') {
      navigate('/menu-catalog', { state: { showDeals: true } });
    } else {
      navigate('/menu-catalog', { state: { selectedDeal: deal } });
    }
  };

  const handleCartClick = () => {
    navigate('/shopping-cart');
  };

  const handleAccountClick = (action) => {
    switch (action) {
      case 'login': navigate('/login');
        break;
      case 'register': navigate('/register');
        break;
      case 'account': navigate('/user-account');
        break;
      case 'logout': localStorage.removeItem('currentUser');
        setUser(null);
        break;
      default:
        break;
    }
  };

  const handleSearch = (searchTerm) => {
    navigate('/menu-catalog', { state: { searchQuery: searchTerm } });
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    setUser(null);
  };

  const handleMakeReservation = () => {
    navigate('/table-reservation');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <Header
        cartCount={cartCount}
        user={user}
        onCartClick={handleCartClick}
        onAccountClick={handleAccountClick}
        onSearch={handleSearch}
        onLogout={handleLogout}
      />
      {/* Page Content */}
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="pt-16"
      >
        {/* Hero Section */}
        <HeroSection 
          onOrderNow={handleOrderNow}
          onMakeReservation={handleMakeReservation}
        />

        {/* Special Deals Section */}
        <SpecialDealsSection onViewDeal={handleViewDeal} />

        {/* Menu Preview Section */}
        <MenuPreviewSection />

        {/* Why Choose Us Section */}
        <WhyChooseUsSection />

        {/* Testimonials Section */}
        <TestimonialsSection />

        {/* Footer Section */}
        <FooterSection />
      </motion.main>
      {/* Scroll to Top Button */}
      <motion.button
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-8 right-8 w-12 h-12 bg-primary text-primary-foreground rounded-full shadow-warm-lg hover:shadow-warm-xl transition-all duration-300 flex items-center justify-center z-40"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m18 15-6-6-6 6" />
        </svg>
      </motion.button>
    </div>
  );
};

export default HomeLanding;