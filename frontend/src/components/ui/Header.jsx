import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from '../AppIcon';
import Button from './Button';
import { useLocation2 } from '../../contexts/LocationContext';

const CAFE_DETAILS = {
  'timperley-altrincham': {
    address: '12 Grove Lane, Timperley, Altrincham WA15 6PQ',
    phone: '0161 928 4567',
    hours: 'Mon–Sat: 8am–9pm | Sun: 9am–8pm',
    description: 'Our cosy Timperley café nestled in the heart of Altrincham, serving freshly brewed coffee and homemade bakes.',
  },
  'howe-bridge-atherton': {
    address: '45 Leigh Road, Howe Bridge, Atherton M46 0PB',
    phone: '01942 876 543',
    hours: 'Mon–Sat: 8am–8pm | Sun: 9am–7pm',
    description: 'A warm community hub in Atherton offering seasonal menus and locally sourced ingredients.',
  },
  'chaddesden-derby': {
    address: '78 Nottingham Road, Chaddesden, Derby DE21 6GF',
    phone: '01332 654 321',
    hours: 'Mon–Sat: 8am–9pm | Sun: 9am–8pm',
    description: 'Derby\'s favourite brunch spot with a relaxed atmosphere and an ever-changing specials board.',
  },
  'oakmere-handforth': {
    address: '3 Wilmslow Road, Oakmere, Handforth SK9 3HT',
    phone: '01625 543 210',
    hours: 'Mon–Sat: 7:30am–9pm | Sun: 9am–8pm',
    description: 'A bright and airy café in Handforth, perfect for morning coffees and leisurely lunches.',
  },
  'willowmere-middlewich': {
    address: '22 Kinderton Street, Willowmere, Middlewich CW10 0JE',
    phone: '01606 789 012',
    hours: 'Mon–Sat: 8am–8pm | Sun: 9am–7pm',
    description: 'Our newest location in Middlewich, bringing Jollys Kafe\'s signature warmth to Cheshire.',
  },
};

const Header = ({ cartCount = 0, user = null, onCartClick, onAccountClick, onLogout, onSearch, onMenuClick }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const [isCafesDropdownOpen, setIsCafesDropdownOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedLocation, setSelectedLocation, locations, selectedCafeLocation, setSelectedCafeLocation } = useLocation2();

  const RESERVATION_LOCATIONS = ['oakmere-handforth', 'willowmere-middlewich'];
  const isHomePage = location?.pathname === '/home-landing' || location?.pathname === '/';
  const showReservations = RESERVATION_LOCATIONS?.includes(selectedLocation?.id);

  const navigationItems = [
    { label: 'Home', path: '/home-landing', icon: 'Home' },
    { label: 'Menu', path: '/menu-catalog', icon: 'UtensilsCrossed' },
    { label: 'Reservations', path: '/table-reservation', icon: 'Calendar' },
    { label: 'Admin', path: '/admin-menu', icon: 'Settings' },
    { label: 'Cart', path: '/shopping-cart', icon: 'ShoppingCart', badge: cartCount > 0 ? cartCount : null },
  ];

  const isActivePath = (path) => {
    return location?.pathname === path;
  };

  const handleNavigation = (path) => {
    if (path === '/menu-catalog' && onMenuClick && !selectedCafeLocation) {
      onMenuClick();
      setIsMobileMenuOpen(false);
      return;
    }
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  const handleCartClick = () => {
    if (onCartClick) {
      onCartClick();
    } else {
      navigate('/shopping-cart');
    }
    setIsMobileMenuOpen(false);
  };

  const handleSignIn = () => {
    navigate('/customer-auth', { state: { tab: 'login' } });
    setIsMobileMenuOpen(false);
  };

  const handleSignUp = () => {
    navigate('/customer-auth', { state: { tab: 'register' } });
    setIsMobileMenuOpen(false);
  };

  const handleUserProfileClick = () => {
    if (onAccountClick) {
      onAccountClick('account');
    } else {
      navigate('/user-account');
    }
    setIsUserDropdownOpen(false);
    setIsMobileMenuOpen(false);
  };

  const handleLogoutClick = () => {
    if (onLogout) {
      onLogout();
    }
    setIsUserDropdownOpen(false);
    setIsMobileMenuOpen(false);
  };

  // Select a cafe location: update global location, store selection, close dropdown immediately
  const handleCafeSelect = (loc) => {
    setSelectedLocation(loc);
    setSelectedCafeLocation(loc);
    setIsCafesDropdownOpen(false);
  };

  // Clear the cafe selection
  const handleCafeClear = () => {
    setSelectedCafeLocation(null);
    setIsCafesDropdownOpen(false);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event?.target?.closest('.mobile-menu') && !event?.target?.closest('.mobile-menu-button')) {
        setIsMobileMenuOpen(false);
      }
      if (!event?.target?.closest('.user-dropdown') && !event?.target?.closest('.user-profile-button')) {
        setIsUserDropdownOpen(false);
      }
      if (!event?.target?.closest('.cafes-dropdown') && !event?.target?.closest('.cafes-dropdown-button')) {
        setIsCafesDropdownOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-warm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <button
              onClick={() => handleNavigation('/home-landing')}
              className="flex items-center space-x-2 group"
            >
              <img
                src="/assets/images/logo-2-1774630354696.png"
                alt="Jollys Kafe logo"
                loading="eager"
                decoding="sync"
                fetchpriority="high"
                width="40"
                height="40"
                className="h-10 w-auto object-contain group-hover:scale-105 transition-transform duration-200"
              />
              <span className="text-xl font-heading font-bold text-primary">Jollys Kafe</span>
            </button>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            {navigationItems?.slice(0, 2)?.map((item) => (
              <button
                key={item?.path}
                onClick={() => handleNavigation(item?.path)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-body font-medium transition-all duration-200 hover:bg-muted hover:scale-102 ${
                  isActivePath(item?.path)
                    ? 'text-primary bg-primary/10' : 'text-foreground hover:text-primary'
                }`}
              >
                <Icon name={item?.icon} size={18} />
                <span>{item?.label}</span>
              </button>
            ))}

            {/* Reservations - only for reservation-enabled locations */}
            {selectedLocation?.reservation_enabled && (
              <button
                onClick={() => handleNavigation('/table-reservation')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-body font-medium transition-all duration-200 hover:bg-muted hover:scale-102 ${
                  isActivePath('/table-reservation')
                    ? 'text-primary bg-primary/10' : 'text-foreground hover:text-primary'
                }`}
              >
                <Icon name="Calendar" size={18} />
                <span>Reservations</span>
              </button>
            )}

            {/* Cafes Button / Selected Location Label */}
            <div className="relative flex items-center space-x-2">
              <button
                onClick={() => setIsCafesDropdownOpen(!isCafesDropdownOpen)}
                className="cafes-dropdown-button flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-body font-medium transition-all duration-200 border text-foreground hover:text-primary hover:bg-muted border-border"
              >
                <Icon name="Coffee" size={16} />
                <span>Cafes</span>
                <Icon name="ChevronDown" size={14} className={`transition-transform duration-200 ${isCafesDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {isCafesDropdownOpen && (
                <div className="cafes-dropdown absolute left-0 top-full mt-2 w-56 bg-card border border-border rounded-lg shadow-warm-lg overflow-hidden z-50">
                  {locations?.map((loc) => (
                    <button
                      key={loc?.id}
                      onClick={() => handleCafeSelect(loc)}
                      className={`w-full flex items-center space-x-3 px-4 py-2.5 text-sm font-body text-left transition-colors duration-200 hover:bg-muted ${
                        selectedCafeLocation?.id === loc?.id ? 'text-primary bg-primary/10 font-medium' : 'text-foreground'
                      }`}
                    >
                      <Icon name="MapPin" size={14} className={selectedCafeLocation?.id === loc?.id ? 'text-primary' : 'text-muted-foreground'} />
                      <span>{loc?.name}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedCafeLocation && (
                <div className="flex items-center space-x-1">
                  <span className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-body font-medium text-primary bg-primary/10 border border-primary/30">
                    <Icon name="MapPin" size={16} className="text-primary flex-shrink-0" />
                    <span className="max-w-[140px] truncate">{selectedCafeLocation?.name}</span>
                  </span>
                  <button
                    onClick={handleCafeClear}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
                    title="Clear location"
                  >
                    <Icon name="X" size={14} />
                  </button>
                </div>
              )}
            </div>

          </nav>

          {/* Desktop Right Section */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Cart Button */}
            <button
              onClick={handleCartClick}
              className={`relative flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-body font-medium transition-all duration-200 hover:bg-muted hover:scale-102 ${
                isActivePath('/shopping-cart')
                  ? 'text-primary bg-primary/10' : 'text-foreground hover:text-primary'
              }`}
            >
              <Icon name="ShoppingCart" size={18} />
              <span>Cart</span>
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-scale-in">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </button>

            {/* Conditional Rendering: User Profile or Auth Buttons */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                  className="user-profile-button flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-body font-medium text-foreground hover:text-primary hover:bg-muted transition-all duration-200"
                >
                  {user?.avatar ? (
                    <img
                      src={user?.avatar}
                      alt={user?.avatarAlt || `Profile picture of ${user?.name || user?.email}`}
                      className="w-8 h-8 rounded-full object-cover border border-border"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                      {user?.name ? user?.name?.charAt(0)?.toUpperCase() : user?.email?.charAt(0)?.toUpperCase()}
                    </div>
                  )}
                  <div className="text-left">
                    <p className="text-sm font-medium">{user?.name || 'User'}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                  <Icon name="ChevronDown" size={16} className={`transition-transform duration-200 ${isUserDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {isUserDropdownOpen && (
                  <div className="user-dropdown absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-lg shadow-warm-lg overflow-hidden z-50">
                    <div className="p-3 border-b border-border">
                      <div className="flex items-center space-x-3">
                        {user?.avatar ? (
                          <img
                            src={user?.avatar}
                            alt={user?.avatarAlt || `Profile picture of ${user?.name || user?.email}`}
                            className="w-10 h-10 rounded-full object-cover border border-border"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                            {user?.name ? user?.name?.charAt(0)?.toUpperCase() : user?.email?.charAt(0)?.toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-foreground">{user?.name || 'User'}</p>
                          <p className="text-xs text-muted-foreground">{user?.email}</p>
                        </div>
                      </div>
                    </div>
                    <div className="py-2">
                      <button
                        onClick={handleUserProfileClick}
                        className="w-full flex items-center space-x-3 px-4 py-2 text-sm font-body text-foreground hover:bg-muted transition-colors duration-200"
                      >
                        <Icon name="User" size={16} />
                        <span>My Account</span>
                      </button>
                      <button
                        onClick={() => { navigate('/order-status'); setIsUserDropdownOpen(false); }}
                        className="w-full flex items-center space-x-3 px-4 py-2 text-sm font-body text-foreground hover:bg-muted transition-colors duration-200"
                      >
                        <Icon name="Package" size={16} />
                        <span>Order Tracking</span>
                      </button>
                      <button
                        onClick={() => { navigate('/table-reservation'); setIsUserDropdownOpen(false); }}
                        className="w-full flex items-center space-x-3 px-4 py-2 text-sm font-body text-foreground hover:bg-muted transition-colors duration-200"
                      >
                        <Icon name="Calendar" size={16} />
                        <span>My Reservations</span>
                      </button>
                      <hr className="my-2 border-border" />
                      <button
                        onClick={handleLogoutClick}
                        className="w-full flex items-center space-x-3 px-4 py-2 text-sm font-body text-error hover:bg-error/10 transition-colors duration-200"
                      >
                        <Icon name="LogOut" size={16} />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button
                  onClick={handleSignIn}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-body font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200"
                >
                  <Icon name="LogIn" size={16} />
                  <span>Sign In</span>
                </button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center space-x-3">
            <button
              onClick={handleCartClick}
              className="relative p-2 rounded-lg text-foreground hover:text-primary hover:bg-muted transition-all duration-200"
            >
              <Icon name="ShoppingCart" size={20} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-scale-in">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setIsMobileMenuOpen(!isMobileMenuOpen); }}
              className="mobile-menu-button p-2 rounded-lg text-foreground hover:text-primary hover:bg-muted transition-all duration-200"
            >
              <Icon name={isMobileMenuOpen ? 'X' : 'Menu'} size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 top-16 bg-black/50 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Mobile Menu Drawer */}
      <div className={`mobile-menu fixed top-16 right-0 h-full w-80 max-w-[90vw] bg-card border-l border-border shadow-warm-xl z-50 transform transition-transform duration-300 md:hidden ${
        isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="p-6">
          {/* Mobile Navigation Items */}
          <nav className="space-y-2">
            {navigationItems?.slice(0, 2)?.map((item) => (
              <button
                key={item?.path}
                onClick={() => handleNavigation(item?.path)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left font-body font-medium transition-all duration-200 hover:bg-muted ${
                  isActivePath(item?.path)
                    ? 'text-primary bg-primary/10' : 'text-foreground hover:text-primary'
                }`}
              >
                <Icon name={item?.icon} size={20} />
                <span>{item?.label}</span>
              </button>
            ))}

            {/* Mobile Reservations - only for reservation-enabled locations */}
            {selectedLocation?.reservation_enabled && (
              <button
                onClick={() => handleNavigation('/table-reservation')}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left font-body font-medium transition-all duration-200 hover:bg-muted ${
                  isActivePath('/table-reservation')
                    ? 'text-primary bg-primary/10' : 'text-foreground hover:text-primary'
                }`}
              >
                <Icon name="Calendar" size={20} />
                <span>Reservations</span>
              </button>
            )}

            {/* Mobile Cafes — dropdown or selected label */}
            <div className="relative">
              <button
                onClick={() => setIsCafesDropdownOpen(!isCafesDropdownOpen)}
                className="cafes-dropdown-button w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left font-body font-medium transition-all duration-200 text-foreground hover:text-primary hover:bg-muted"
              >
                <Icon name="Coffee" size={20} />
                <span className="flex-1">Cafes</span>
                <Icon name="ChevronDown" size={16} className={`transition-transform duration-200 ${isCafesDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {selectedCafeLocation && (
                <div className="flex items-center mt-1 mx-1">
                  <span className="flex-1 flex items-center space-x-2 px-4 py-2.5 rounded-lg font-body text-sm font-medium text-primary bg-primary/10">
                    <Icon name="MapPin" size={16} className="text-primary flex-shrink-0" />
                    <span className="truncate">{selectedCafeLocation?.name}</span>
                  </span>
                  <button
                    onClick={handleCafeClear}
                    className="p-2 ml-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
                  >
                    <Icon name="X" size={16} />
                  </button>
                </div>
              )}
              {isCafesDropdownOpen && (
                <div className="cafes-dropdown mt-1 w-full bg-card border border-border rounded-lg shadow-warm-lg overflow-hidden max-h-48 overflow-y-auto">
                  {locations?.map((loc) => (
                    <button
                      key={loc?.id}
                      onClick={() => handleCafeSelect(loc)}
                      className={`w-full flex items-center space-x-3 px-4 py-3 text-sm font-body text-left transition-colors duration-200 hover:bg-muted ${
                        selectedCafeLocation?.id === loc?.id ? 'text-primary bg-primary/10 font-medium' : 'text-foreground'
                      }`}
                    >
                      <Icon name="MapPin" size={16} className={selectedCafeLocation?.id === loc?.id ? 'text-primary' : 'text-muted-foreground'} />
                      <span>{loc?.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </nav>

          {/* Mobile Auth/User Section */}
          <div className="mt-8 pt-6 border-t border-border">
            {user ? (
              <>
                <h3 className="text-sm font-body font-medium text-muted-foreground mb-3">Account</h3>
                <div className="mb-4 p-4 bg-muted rounded-lg">
                  <div className="flex items-center space-x-3">
                    {user?.avatar ? (
                      <img
                        src={user?.avatar}
                        alt={user?.avatarAlt || `Profile picture of ${user?.name || user?.email}`}
                        className="w-12 h-12 rounded-full object-cover border border-border"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold">
                        {user?.name ? user?.name?.charAt(0)?.toUpperCase() : user?.email?.charAt(0)?.toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-foreground">{user?.name || 'User'}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={handleUserProfileClick}
                    className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left font-body font-medium text-foreground hover:text-primary hover:bg-muted transition-all duration-200"
                  >
                    <Icon name="User" size={20} />
                    <span>My Account</span>
                  </button>
                  <button
                    onClick={() => { navigate('/order-status'); setIsMobileMenuOpen(false); }}
                    className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left font-body font-medium text-foreground hover:text-primary hover:bg-muted transition-all duration-200"
                  >
                    <Icon name="Package" size={20} />
                    <span>Order Tracking</span>
                  </button>
                  <button
                    onClick={() => { navigate('/table-reservation'); setIsMobileMenuOpen(false); }}
                    className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left font-body font-medium text-foreground hover:text-primary hover:bg-muted transition-all duration-200"
                  >
                    <Icon name="Calendar" size={20} />
                    <span>My Reservations</span>
                  </button>
                  <button
                    onClick={handleLogoutClick}
                    className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left font-body font-medium text-error hover:bg-error/10 transition-all duration-200"
                  >
                    <Icon name="LogOut" size={20} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-sm font-body font-medium text-muted-foreground mb-3">Account</h3>
                <div className="space-y-2">
                  <button
                    onClick={handleSignIn}
                    className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left font-body font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200"
                  >
                    <Icon name="LogIn" size={20} />
                    <span>Sign In</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Contact Info */}
          <div className="mt-8 pt-6 border-t border-border space-y-3">
            <a
              href={selectedCafeLocation?.phone ? `tel:${selectedCafeLocation.phone.replace(/\s/g, '')}` : 'tel:01618833707'}
              className="flex items-center space-x-3 text-sm font-body text-muted-foreground hover:text-foreground transition-colors"
            >
              <Icon name="Phone" size={16} />
              <span>Call us: {selectedCafeLocation?.phone || '0161 883 3707'}</span>
            </a>
            <button
              onClick={() => { navigate('/contact-us'); setIsMobileMenuOpen(false); }}
              className="flex items-center space-x-3 text-sm font-body text-muted-foreground hover:text-foreground transition-colors"
            >
              <Icon name="Mail" size={16} />
              <span>Contact Us</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;