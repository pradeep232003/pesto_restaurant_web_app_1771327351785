import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Search, ShoppingBag, LogIn, ChevronDown } from 'lucide-react';
import Header from '../../components/ui/Header';
import MenuGrid from './components/MenuGrid';
import Icon from '../../components/AppIcon';
import api, { resolveImageUrl } from '../../lib/api';
import { useLocation2 } from '../../contexts/LocationContext';
import { useCustomer } from '../../contexts/CustomerContext';

const ease = [0.16, 1, 0.3, 1];

const CATEGORIES = [
  { id: 'all', name: 'All' },
  { id: 'breakfast', name: 'Breakfast' },
  { id: 'lunch', name: 'Lunch' },
  { id: 'dinner', name: 'Dinner' },
  { id: 'dessert', name: 'Dessert' },
  { id: 'beverage', name: 'Beverage' },
];

const MenuCatalog = () => {
  const navigate = useNavigate();
  const { selectedLocation, setSelectedLocation, locations } = useLocation2();
  const { customer, logout: customerLogout } = useCustomer();
  const [activeCategory, setActiveCategory] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [loading, setLoading] = useState(true);
  const [cartItems, setCartItems] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [fetchError, setFetchError] = useState(null);
  const [siteStatus, setSiteStatus] = useState(null);

  const fetchMenuItems = async (locationSlug) => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await api.getMenuItems(locationSlug);
      const mapped = (data || []).map(item => ({
        id: item?.id,
        name: item?.name,
        subtitle: item?.subtitle,
        description: item?.description,
        price: parseFloat(item?.price),
        originalPrice: item?.original_price ? parseFloat(item?.original_price) : null,
        image: item?.show_image !== false ? resolveImageUrl(item?.thumbnail_url || item?.image_url) : null,
        imageAlt: item?.image_alt,
        category: item?.category,
        categories: item?.categories || [item?.category],
        dietary: item?.dietary || [],
        tags: item?.tags || [],
        featured: item?.featured,
        rating: parseFloat(item?.rating),
        reviewCount: item?.review_count,
        createdAt: item?.created_at,
      }));
      setMenuItems(mapped);
    } catch (err) {
      setFetchError(err?.message);
      setMenuItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenuItems(selectedLocation?.id);
    setActiveCategory('all');
    if (selectedLocation?.id) {
      api.getSiteStatus(selectedLocation.id).then(setSiteStatus).catch(() => setSiteStatus(null));
    }
  }, [selectedLocation]);

  useEffect(() => {
    const saved = localStorage.getItem('cartItems');
    if (saved) { try { setCartItems(JSON.parse(saved)); } catch {} }
  }, []);

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleLocationChange = (e) => {
    const loc = locations?.find(l => l?.id === e?.target?.value);
    if (loc) setSelectedLocation(loc);
  };

  const handleAddToCart = async (item) => {
    setCartItems(prev => {
      const existing = prev.find(c => c.id === item.id);
      let updated;
      if (existing) {
        updated = prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      } else {
        updated = [...prev, { id: item.id, name: item.name, price: item.price, image: item.image, quantity: 1 }];
      }
      localStorage.setItem('cartItems', JSON.stringify(updated));
      return updated;
    });
    return new Promise((resolve) => setTimeout(resolve, 300));
  };

  // Filter + sort
  let filteredItems = [...menuItems];
  if (activeCategory !== 'all') {
    filteredItems = filteredItems.filter(item =>
      item.categories?.includes(activeCategory) || item.category === activeCategory
    );
  }
  if (sortBy === 'price-low') filteredItems.sort((a, b) => a.price - b.price);
  else if (sortBy === 'price-high') filteredItems.sort((a, b) => b.price - a.price);
  else filteredItems.sort((a, b) => a.name.localeCompare(b.name));

  const categoryCounts = CATEGORIES.map(c => ({
    ...c,
    count: c.id === 'all'
      ? menuItems.length
      : menuItems.filter(i => i.categories?.includes(c.id) || i.category === c.id).length,
  }));

  return (
    <div className="min-h-screen" style={{ background: '#FBFBFD' }}>
      <Header
        cartCount={cartCount}
        onCartClick={() => navigate('/shopping-cart')}
        onAccountClick={(a) => { if (a === 'login' || a === 'register') navigate('/customer-auth'); }}
        onSearch={() => {}}
        onLogout={() => {}}
      />

      <main className="pt-16">
        {/* Hero */}
        <section className="pt-12 pb-6 md:pt-16 md:pb-8 px-6 md:px-12 text-center" style={{ background: '#FBFBFD' }}>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
            className="text-sm tracking-[0.2em] uppercase mb-3"
            style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}
          >
            {selectedLocation?.name || 'Our Menu'}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease }}
            className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight mb-3"
            style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
          >
            Our Menu.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease }}
            className="text-base md:text-lg max-w-xl mx-auto mb-5"
            style={{ color: '#86868B' }}
          >
            Fresh ingredients, family recipes, and honest cooking — all in one place.
          </motion.p>

          {/* Location + Status row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4"
          >
            {/* Location selector */}
            <div className="relative inline-flex items-center">
              <MapPin size={15} className="absolute left-4" style={{ color: '#86868B' }} />
              <select
                data-testid="location-selector"
                value={selectedLocation?.id || ''}
                onChange={handleLocationChange}
                className="appearance-none pl-9 pr-9 py-2.5 rounded-full text-sm font-medium cursor-pointer outline-none transition-colors"
                style={{
                  background: '#F5F5F7',
                  color: '#1D1D1F',
                  border: 'none',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                {locations?.map(loc => (
                  <option key={loc?.id} value={loc?.id}>{loc?.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 pointer-events-none" style={{ color: '#86868B' }} />
            </div>

            {/* Site status pill */}
            {siteStatus && (
              <div
                data-testid="site-status-banner"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium"
                style={{
                  background: siteStatus.is_open ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)',
                  color: siteStatus.is_open ? '#34C759' : '#FF3B30',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                <span className={`w-2 h-2 rounded-full ${siteStatus.is_open ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                {siteStatus.is_open ? 'Ordering Open' : 'Ordering Closed'}
              </div>
            )}

            {/* Quick actions */}
            <div className="flex items-center gap-2">
              <button
                data-testid="track-order-link"
                onClick={() => navigate('/order-status')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-medium transition-colors"
                style={{ background: '#F5F5F7', color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
                onMouseEnter={e => e.target.style.background = '#E8E8ED'}
                onMouseLeave={e => e.target.style.background = '#F5F5F7'}
              >
                <Search size={14} />
                Track Order
              </button>
              {customer ? (
                <span className="text-sm" style={{ color: '#86868B' }}>
                  Hi, {customer.name?.split(' ')[0]}
                  <button
                    onClick={customerLogout}
                    className="ml-1.5 underline transition-colors"
                    style={{ color: '#1D1D1F' }}
                  >
                    Logout
                  </button>
                </span>
              ) : (
                <button
                  data-testid="login-to-order-btn"
                  onClick={() => navigate('/customer-auth')}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-medium transition-colors"
                  style={{ background: '#1D1D1F', color: '#FFFFFF', fontFamily: 'Outfit, sans-serif' }}
                  onMouseEnter={e => e.target.style.background = '#333336'}
                  onMouseLeave={e => e.target.style.background = '#1D1D1F'}
                >
                  <LogIn size={14} />
                  Login to Order
                </button>
              )}
            </div>
          </motion.div>
        </section>

        {/* Category Tabs */}
        <section className="sticky top-16 z-30 py-4 px-6 md:px-12 backdrop-blur-xl" style={{ background: 'rgba(251,251,253,0.85)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Category pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 no-scrollbar w-full sm:w-auto">
              {categoryCounts.map(cat => (
                <button
                  key={cat.id}
                  data-testid={`category-${cat.id}`}
                  onClick={() => setActiveCategory(cat.id)}
                  className="whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 shrink-0"
                  style={{
                    background: activeCategory === cat.id ? '#1D1D1F' : 'transparent',
                    color: activeCategory === cat.id ? '#FFFFFF' : '#86868B',
                    fontFamily: 'Outfit, sans-serif',
                  }}
                >
                  {cat.name}
                  {cat.count > 0 && (
                    <span className="ml-1.5 opacity-60">{cat.count}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className="relative shrink-0">
              <select
                data-testid="sort-selector"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none pl-4 pr-8 py-2 rounded-full text-sm font-medium cursor-pointer outline-none"
                style={{
                  background: '#F5F5F7',
                  color: '#1D1D1F',
                  border: 'none',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                <option value="name">A — Z</option>
                <option value="price-low">Price: Low</option>
                <option value="price-high">Price: High</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#86868B' }} />
            </div>
          </div>
        </section>

        {/* Error */}
        {fetchError && (
          <div className="max-w-7xl mx-auto px-6 md:px-12 pt-8">
            <div className="p-4 rounded-2xl text-sm text-center" style={{ background: 'rgba(255,59,48,0.08)', color: '#FF3B30' }}>
              Failed to load menu. Please try again.
            </div>
          </div>
        )}

        {/* Menu Grid */}
        <section className="py-6 md:py-8 px-6 md:px-12">
          <div className="max-w-7xl mx-auto">
            <MenuGrid
              items={filteredItems}
              loading={loading}
              onAddToCart={handleAddToCart}
              isOrderingOpen={siteStatus?.is_open !== false}
            />
          </div>
        </section>

        {/* Floating Cart */}
        {cartCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <button
              data-testid="floating-cart-btn"
              onClick={() => navigate('/shopping-cart')}
              className="inline-flex items-center gap-3 pl-6 pr-5 py-3.5 rounded-full shadow-2xl transition-transform hover:scale-105"
              style={{
                background: '#1D1D1F',
                color: '#FFFFFF',
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              <ShoppingBag size={18} />
              <span className="text-sm font-medium">View Cart</span>
              <span
                className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
                style={{ background: 'rgba(255,255,255,0.2)' }}
              >
                {cartCount}
              </span>
            </button>
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default MenuCatalog;
