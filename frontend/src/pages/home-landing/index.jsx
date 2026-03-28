import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import HeroSection from './components/HeroSection';
import MenuPreviewSection from './components/MenuPreviewSection';
import WhyChooseUsSection from './components/WhyChooseUsSection';
import TestimonialsSection from './components/TestimonialsSection';
import FooterSection from './components/FooterSection';

const HomeLanding = () => {
  const navigate = useNavigate();
  const [cartCount, setCartCount] = useState(0);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const mockUser = localStorage.getItem('currentUser');
    if (mockUser) setUser(JSON.parse(mockUser));
    const mockCartCount = localStorage.getItem('cartCount');
    if (mockCartCount) setCartCount(parseInt(mockCartCount, 10));
  }, []);

  const handleOrderNow = () => navigate('/menu-catalog');
  const handleCartClick = () => navigate('/shopping-cart');

  const handleAccountClick = (action) => {
    switch (action) {
      case 'login': navigate('/login'); break;
      case 'register': navigate('/register'); break;
      case 'account': navigate('/user-account'); break;
      case 'logout':
        localStorage.removeItem('currentUser');
        setUser(null);
        break;
      default: break;
    }
  };

  const handleSearch = (searchTerm) => {
    navigate('/menu-catalog', { state: { searchQuery: searchTerm } });
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    setUser(null);
  };

  return (
    <div className="min-h-screen" style={{ background: '#FBFBFD' }}>
      <Header
        cartCount={cartCount}
        user={user}
        onCartClick={handleCartClick}
        onAccountClick={handleAccountClick}
        onSearch={handleSearch}
        onLogout={handleLogout}
      />

      <main className="pt-16">
        <HeroSection onOrderNow={handleOrderNow} />
        <MenuPreviewSection />
        <WhyChooseUsSection />
        <TestimonialsSection />
        <FooterSection />
      </main>
    </div>
  );
};

export default HomeLanding;
