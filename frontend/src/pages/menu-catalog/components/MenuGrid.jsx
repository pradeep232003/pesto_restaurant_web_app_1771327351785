import React, { useState, useEffect } from 'react';
import MenuItemCard from './MenuItemCard';
import Icon from '../../../components/AppIcon';

const MenuGrid = ({ 
  items, 
  loading = false, 
  onAddToCart, 
  activeCategory,
  filters,
  className = "" 
}) => {
  const [filteredItems, setFilteredItems] = useState(items);
  const [displayCount, setDisplayCount] = useState(12);

  // Filter and sort items
  useEffect(() => {
    let filtered = [...items];

    // Filter by category
    if (activeCategory && activeCategory !== 'all') {
      filtered = filtered?.filter(item =>
        item?.categories?.includes(activeCategory) || item?.category === activeCategory
      );
    }

    // Filter by dietary preferences
    if (filters?.dietary) {
      filtered = filtered?.filter(item => 
        item?.dietary && item?.dietary?.includes(filters?.dietary)
      );
    }

    // Filter by price range
    if (filters?.priceRange) {
      const [min, max] = filters?.priceRange?.split('-')?.map(p => 
        p === '+' ? Infinity : parseFloat(p)
      );
      filtered = filtered?.filter(item => {
        if (max === undefined) return item?.price >= min;
        return item?.price >= min && item?.price <= max;
      });
    }

    // Sort items
    if (filters?.sortBy) {
      switch (filters?.sortBy) {
        case 'price-low':
          filtered?.sort((a, b) => a?.price - b?.price);
          break;
        case 'price-high':
          filtered?.sort((a, b) => b?.price - a?.price);
          break;
        case 'popular':
          filtered?.sort((a, b) => (b?.rating || 0) - (a?.rating || 0));
          break;
        case 'newest':
          filtered?.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
          break;
        case 'name':
        default:
          filtered?.sort((a, b) => a?.name?.localeCompare(b?.name));
          break;
      }
    }

    setFilteredItems(filtered);
    setDisplayCount(12); // Reset display count when filters change
  }, [items, activeCategory, filters]);

  const handleLoadMore = () => {
    setDisplayCount(prev => prev + 12);
  };

  const displayedItems = filteredItems?.slice(0, displayCount);
  const hasMore = displayCount < filteredItems?.length;

  if (loading) {
    return (
      <div className={`${className}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)]?.map((_, index) => (
            <div key={index} className="bg-card rounded-xl overflow-hidden shadow-warm animate-pulse">
              <div className="aspect-[4/3] bg-muted"></div>
              <div className="p-4 space-y-3">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-full"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
                <div className="h-8 bg-muted rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (filteredItems?.length === 0) {
    return (
      <div className={`${className}`}>
        <div className="text-center py-16">
          <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
            <Icon name="Search" size={32} color="var(--color-muted-foreground)" />
          </div>
          <h3 className="text-xl font-heading font-bold text-foreground mb-2">
            No items found
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            We couldn't find any menu items matching your current filters. Try adjusting your search criteria.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => window.location?.reload()}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-body font-medium hover:bg-primary/90 transition-colors duration-200"
            >
              Reset Filters
            </button>
            <button
              onClick={() => window.history?.back()}
              className="px-6 py-2 bg-muted text-foreground rounded-lg font-body font-medium hover:bg-muted/80 transition-colors duration-200"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      {/* Results Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-heading font-bold text-foreground">
            Menu Items
          </h2>
          <span className="bg-muted text-muted-foreground px-3 py-1 rounded-full text-sm font-body">
            {filteredItems?.length} items
          </span>
        </div>
        
        {filteredItems?.length > 0 && (
          <div className="text-sm text-muted-foreground">
            Showing {displayedItems?.length} of {filteredItems?.length}
          </div>
        )}
      </div>
      {/* Menu Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
        {displayedItems?.map((item, index) => (
          <MenuItemCard
            key={item?.id}
            item={item}
            onAddToCart={onAddToCart}
            className={`animate-fade-in-up`}
            style={{ animationDelay: `${index * 0.1}s` }}
          />
        ))}
      </div>
      {/* Load More Button */}
      {hasMore && (
        <div className="text-center">
          <button
            onClick={handleLoadMore}
            className="inline-flex items-center space-x-2 px-8 py-3 bg-primary text-primary-foreground rounded-lg font-body font-medium hover:bg-primary/90 transition-all duration-200 hover:scale-105"
          >
            <span>Load More Items</span>
            <Icon name="ChevronDown" size={16} />
          </button>
        </div>
      )}
      {/* Featured Items Indicator */}
      {filteredItems?.some(item => item?.featured) && (
        <div className="mt-8 p-4 bg-accent/10 border border-accent/20 rounded-lg">
          <div className="flex items-center space-x-2">
            <Icon name="Star" size={16} color="var(--color-accent)" />
            <span className="text-sm font-body text-accent-foreground">
              ⭐ Featured items are highlighted with a star badge
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuGrid;