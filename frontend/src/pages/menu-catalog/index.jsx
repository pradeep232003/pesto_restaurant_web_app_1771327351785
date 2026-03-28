import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import BrowseByCategoryWithFilters from './components/BrowseByCategoryWithFilters';
import MenuGrid from './components/MenuGrid';
import Icon from '../../components/AppIcon';
import api from '../../lib/api';
import { useLocation2, LOCATIONS } from '../../contexts/LocationContext';
import { useCustomer } from '../../contexts/CustomerContext';

const MenuCatalog = () => {
  const navigate = useNavigate();
  const { selectedLocation, setSelectedLocation } = useLocation2();
  const { customer, logout: customerLogout } = useCustomer();
  const [activeCategory, setActiveCategory] = useState('all');
  const [filters, setFilters] = useState({
    dietary: '',
    priceRange: '',
    sortBy: 'name'
  });
  const [loading, setLoading] = useState(true);
  const [cartItems, setCartItems] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [fetchError, setFetchError] = useState(null);
  const [siteStatus, setSiteStatus] = useState(null);

  const categories = [
    { id: 'all', name: 'All Items', icon: 'Grid3X3', count: 0, featured: false },
    { id: 'breakfast', name: 'Breakfast', icon: 'Sunrise', count: 0, featured: true },
    { id: 'lunch', name: 'Lunch', icon: 'Sun', count: 0, featured: false },
    { id: 'dinner', name: 'Dinner', icon: 'Moon', count: 0, featured: false },
    { id: 'dessert', name: 'Dessert', icon: 'Cake', count: 0, featured: true },
    { id: 'beverage', name: 'Beverage', icon: 'Coffee', count: 0, featured: false },
  ];

  // Compute category counts from loaded items
  const categoriesWithCounts = categories?.map(cat => ({
    ...cat,
    count: cat?.id === 'all'
      ? menuItems?.length
      : menuItems?.filter(item =>
          item?.categories?.includes(cat?.id) || item?.category === cat?.id
        )?.length
  }));

  const fetchMenuItems = async (locationSlug) => {
    setLoading(true);
    setFetchError(null);
    try {
      // Fetch menu items from MongoDB API
      const data = await api.getMenuItems(locationSlug);

      const mapped = (data || [])?.map(item => ({
        id: item?.id,
        name: item?.name,
        subtitle: item?.subtitle,
        description: item?.description,
        price: parseFloat(item?.price),
        originalPrice: item?.original_price ? parseFloat(item?.original_price) : null,
        image: item?.show_image !== false ? item?.image_url : null,
        imageAlt: item?.image_alt,
        category: item?.category,
        categories: item?.categories || [item?.category],
        dietary: item?.dietary || [],
        tags: item?.tags || [],
        featured: item?.featured,
        rating: parseFloat(item?.rating),
        reviewCount: item?.review_count,
        prepTime: item?.prep_time,
        createdAt: item?.created_at,
      }));

      setMenuItems(mapped);
    } catch (err) {
      console.error('Error fetching menu items:', err);
      setFetchError(err?.message);
      setMenuItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenuItems(selectedLocation?.id);
    setActiveCategory('all');
    // Fetch site status
    if (selectedLocation?.id) {
      api.getSiteStatus(selectedLocation.id).then(setSiteStatus).catch(() => setSiteStatus(null));
    }
  }, [selectedLocation]);

  // Load cart from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('cartItems');
    if (saved) { try { setCartItems(JSON.parse(saved)); } catch {} }
  }, []);

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleCategoryChange = (categoryId) => {
    setActiveCategory(categoryId);
  };

  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
  };

  const handleLocationChange = (e) => {
    const loc = LOCATIONS?.find(l => l?.id === e?.target?.value);
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

  const handleCartClick = () => {
    navigate('/shopping-cart');
  };

  const handleAccountClick = (action) => {
    if (action === 'login') navigate('/customer-auth');
    if (action === 'register') navigate('/customer-auth');
    if (action === 'account') navigate('/user-account');
  };

  const selectedLocationName = selectedLocation?.name || '';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <Header
        cartCount={cartCount}
        onCartClick={handleCartClick}
        onAccountClick={handleAccountClick}
        onSearch={() => {}}
        onLogout={() => {}} />
      {/* Main Content */}
      <main className="pt-16">
        {/* Hero Section */}
        <section className="bg-primary text-primary-foreground py-6 lg:py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-2xl lg:text-4xl font-heading font-bold mb-3">
                Our Menu
              </h1>
              <p className="text-base lg:text-lg font-body opacity-90 max-w-2xl mx-auto">
                Discover our carefully crafted dishes made with the finest ingredients. From appetizers to desserts, every item tells a story of flavor and passion.
              </p>
            </div>
          </div>
        </section>

        {/* Menu Content */}
        <section className="py-8 lg:py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="space-y-8">

              {/* Location Selector */}
              <div className="bg-card rounded-xl shadow-warm px-4 py-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center space-x-2 shrink-0">
                    <Icon name="MapPin" size={20} color="var(--color-primary)" />
                    <span className="font-heading font-semibold text-foreground text-base">Select Location</span>
                  </div>
                  <div className="flex-1">
                    <select
                      value={selectedLocation?.id}
                      onChange={handleLocationChange}
                      className="w-full sm:max-w-sm px-4 py-2.5 rounded-lg border border-border bg-background text-foreground font-body text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors duration-200 cursor-pointer"
                    >
                      {LOCATIONS?.map(loc => (
                        <option key={loc?.id} value={loc?.id}>{loc?.name}</option>
                      ))}
                    </select>
                  </div>
                  {selectedLocationName && (
                    <div className="hidden sm:flex items-center space-x-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-body shrink-0">
                      <Icon name="MapPin" size={13} />
                      <span>{selectedLocationName}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Site Status & Ordering Info */}
              <div className="flex flex-wrap items-center gap-3">
                {siteStatus && (
                  <div data-testid="site-status-banner" className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-body ${
                    siteStatus.is_open ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${siteStatus.is_open ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                    <span className="font-medium">{siteStatus.is_open ? 'Online Ordering Open' : 'Online Ordering Closed'}</span>
                    {siteStatus.closes_at && siteStatus.is_open && <span className="text-xs opacity-75">until {siteStatus.closes_at}</span>}
                  </div>
                )}
                <button
                  data-testid="track-order-link"
                  onClick={() => navigate('/order-status')}
                  className="px-4 py-2.5 rounded-lg text-sm font-body font-medium bg-card border border-border text-foreground hover:bg-muted transition-all flex items-center gap-1.5"
                >
                  <Icon name="Search" size={14} />
                  Track Order
                </button>
                {customer ? (
                  <span className="text-xs text-muted-foreground font-body">
                    Hi, {customer.name?.split(' ')[0]}!
                    <button onClick={customerLogout} className="text-primary ml-1 hover:underline">Logout</button>
                  </span>
                ) : (
                  <button
                    onClick={() => navigate('/customer-auth')}
                    className="px-4 py-2.5 rounded-lg text-sm font-body font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-all flex items-center gap-1.5"
                  >
                    <Icon name="LogIn" size={14} />
                    Login to Order
                  </button>
                )}
              </div>

              {/* Error state */}
              {fetchError && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 flex items-center space-x-2">
                  <Icon name="AlertCircle" size={18} color="var(--color-destructive)" />
                  <p className="text-sm font-body text-destructive">Failed to load menu: {fetchError}</p>
                </div>
              )}

              {/* Unified Browse by Category with Filters & Sort */}
              <BrowseByCategoryWithFilters
                categories={categoriesWithCounts}
                activeCategory={activeCategory}
                onCategoryChange={handleCategoryChange}
                onFiltersChange={handleFiltersChange}
              />

              {/* Menu Grid */}
              <MenuGrid
                items={menuItems}
                loading={loading}
                onAddToCart={handleAddToCart}
                activeCategory={activeCategory}
                filters={filters} />

            </div>
          </div>
        </section>

        {/* Call to Action Section */}
        <section className="bg-muted py-12 lg:py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="bg-card rounded-2xl p-8 lg:p-12 shadow-warm">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-6">
                <Icon name="Phone" size={24} color="white" />
              </div>
              <h2 className="text-2xl lg:text-3xl font-heading font-bold text-foreground mb-4">
                Can't Find What You're Looking For?
              </h2>
              <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
                Our chefs are happy to accommodate special requests and dietary restrictions. Give us a call to discuss custom menu options or ask about today's specials.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="tel:+15551234567"
                  className="inline-flex items-center space-x-2 px-8 py-3 bg-primary text-primary-foreground rounded-lg font-body font-medium hover:bg-primary/90 transition-all duration-200 hover:scale-105">
                  <Icon name="Phone" size={18} />
                  <span>Call (555) 123-4567</span>
                </a>
                <button
                  onClick={() => navigate('/shopping-cart')}
                  className="inline-flex items-center space-x-2 px-8 py-3 bg-accent text-accent-foreground rounded-lg font-body font-medium hover:bg-accent/90 transition-all duration-200 hover:scale-105">
                  <Icon name="ShoppingCart" size={18} />
                  <span>View Cart ({cartCount})</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
      {/* Footer */}
      <footer className="bg-secondary text-secondary-foreground py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Icon name="UtensilsCrossed" size={20} color="white" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-lg">Pesto</h3>
                <p className="text-xs opacity-80 -mt-1">Restaurant</p>
              </div>
            </div>
            <div className="text-center md:text-right">
              <p className="text-sm opacity-80">
                © {new Date()?.getFullYear()} Jollys Kafe. All rights reserved.
              </p>
              <p className="text-xs opacity-60 mt-1">
                Made with ❤️ for food lovers everywhere
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MenuCatalog;