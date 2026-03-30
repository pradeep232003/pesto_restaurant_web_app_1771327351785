import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import HeroSection from './components/HeroSection';
import MenuPreviewSection from './components/MenuPreviewSection';
import WhyChooseUsSection from './components/WhyChooseUsSection';
import GoogleReviewsSection from './components/GoogleReviewsSection';
import FooterSection from './components/FooterSection';
import LocationPickerModal from '../../components/LocationPickerModal';
import { useLocation2 } from '../../contexts/LocationContext';
import { useCustomer } from '../../contexts/CustomerContext';

const HomeLanding = () => {
  const navigate = useNavigate();
  const { locations, selectedCafeLocation, setSelectedLocation, setSelectedCafeLocation } = useLocation2();
  const { customer } = useCustomer();
  const [cartCount, setCartCount] = useState(0);
  const [user, setUser] = useState(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [pendingOrderRedirect, setPendingOrderRedirect] = useState(false);

  useEffect(() => {
    const mockUser = localStorage.getItem('currentUser');
    if (mockUser) setUser(JSON.parse(mockUser));
    const mockCartCount = localStorage.getItem('cartCount');
    if (mockCartCount) setCartCount(parseInt(mockCartCount, 10));
  }, []);

  const handleViewMenu = () => {
    if (!selectedCafeLocation) {
      setShowLocationPicker(true);
    } else {
      navigate('/menu-catalog');
    }
  };

  const handleOrderOnline = () => {
    if (!customer) {
      navigate('/customer-auth');
      return;
    }
    if (!selectedCafeLocation) {
      setPendingOrderRedirect(true);
      setShowLocationPicker(true);
    } else {
      navigate('/menu-catalog');
    }
  };

  const handleLocationSelect = (loc) => {
    setSelectedLocation(loc);
    setSelectedCafeLocation(loc);
    setShowLocationPicker(false);
    setPendingOrderRedirect(false);
    navigate('/menu-catalog');
  };

  const handleCartClick = () => navigate('/shopping-cart');
  const handleSearch = (searchTerm) => navigate('/menu-catalog', { state: { searchQuery: searchTerm } });
  const handleLogout = () => { localStorage.removeItem('currentUser'); setUser(null); };

  return (
    <div className="min-h-screen" style={{ background: '#FBFBFD' }}>
      <Header
        cartCount={cartCount}
        user={user}
        onCartClick={handleCartClick}
        onAccountClick={() => {}}
        onSearch={handleSearch}
        onLogout={handleLogout}
        onMenuClick={() => setShowLocationPicker(true)}
      />

      <main className="pt-16">
        <HeroSection onViewMenu={handleViewMenu} onOrderNow={handleOrderOnline} />
        <MenuPreviewSection />
        <WhyChooseUsSection />
        <GoogleReviewsSection />
        <FooterSection onOrderOnline={handleOrderOnline} />
      </main>

      <LocationPickerModal
        open={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        locations={locations}
        onSelect={handleLocationSelect}
      />
    </div>
  );
};

export default HomeLanding;
