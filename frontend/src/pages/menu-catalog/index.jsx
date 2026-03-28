import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import BrowseByCategoryWithFilters from './components/BrowseByCategoryWithFilters';
import MenuGrid from './components/MenuGrid';
import Icon from '../../components/AppIcon';
import { supabase } from '../../lib/supabase';
import { useLocation2, LOCATIONS } from '../../contexts/LocationContext';

const MenuCatalog = () => {
  const navigate = useNavigate();
  const { selectedLocation, setSelectedLocation } = useLocation2();
  const [activeCategory, setActiveCategory] = useState('all');
  const [filters, setFilters] = useState({
    dietary: '',
    priceRange: '',
    sortBy: 'name'
  });
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(3);
  const [menuItems, setMenuItems] = useState([]);
  const [fetchError, setFetchError] = useState(null);

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
      // First get the location id
      const { data: locationData, error: locationError } = await supabase?.from('locations')?.select('id')?.eq('slug', locationSlug)?.single();

      if (locationError) {
        if (locationError?.code === 'PGRST116') {
          setMenuItems([]);
          setLoading(false);
          return;
        }
        throw locationError;
      }

      const { data, error } = await supabase?.from('menu_items')?.select('*')?.eq('location_id', locationData?.id)?.eq('is_available', true)?.order('name', { ascending: true });

      if (error) throw error;

      const mapped = (data || [])?.map(item => ({
        id: item?.id,
        name: item?.name,
        subtitle: item?.subtitle,
        description: item?.description,
        price: parseFloat(item?.price),
        originalPrice: item?.original_price ? parseFloat(item?.original_price) : null,
        image: item?.image_url,
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
  }, [selectedLocation]);

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
    console.log('Adding to cart:', item);
    setCartCount((prev) => prev + 1);
    return new Promise((resolve) => {
      setTimeout(resolve, 500);
    });
  };

  const handleCartClick = () => {
    navigate('/shopping-cart');
  };

  const handleAccountClick = (action) => {
    if (action === 'login') navigate('/login');
    if (action === 'register') navigate('/register');
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