import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Select from '../../../components/ui/Select';

const BrowseByCategoryWithFilters = ({ 
  categories, 
  activeCategory, 
  onCategoryChange, 
  onFiltersChange,
  className = "" 
}) => {
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [filters, setFilters] = useState({
    dietary: '',
    priceRange: '',
    sortBy: 'name'
  });

  const dietaryOptions = [
    { value: '', label: 'All Dietary Options' },
    { value: 'vegetarian', label: 'Vegetarian' },
    { value: 'vegan', label: 'Vegan' },
    { value: 'gluten-free', label: 'Gluten Free' },
    { value: 'dairy-free', label: 'Dairy Free' },
    { value: 'keto', label: 'Keto Friendly' }
  ];

  const priceRangeOptions = [
    { value: '', label: 'All Prices' },
    { value: '0-10', label: 'Under $10' },
    { value: '10-20', label: '$10 - $20' },
    { value: '20-30', label: '$20 - $30' },
    { value: '30+', label: '$30+' }
  ];

  const sortOptions = [
    { value: 'name', label: 'Name (A-Z)' },
    { value: 'price-low', label: 'Price (Low to High)' },
    { value: 'price-high', label: 'Price (High to Low)' },
    { value: 'popular', label: 'Most Popular' },
    { value: 'newest', label: 'Newest Items' }
  ];

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearAllFilters = () => {
    const clearedFilters = {
      dietary: '',
      priceRange: '',
      sortBy: 'name'
    };
    setFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  const hasActiveFilters = filters?.dietary || filters?.priceRange || filters?.sortBy !== 'name';

  return (
    <div className={`bg-card rounded-xl shadow-warm ${className}`}>
      {/* Browse by Category Section */}
      <div className="px-4 py-3">
        <h2 className="text-base font-heading font-bold text-foreground mb-3">Browse by Category</h2>
        
        {/* Category Chips */}
        <div className="flex flex-wrap gap-2">
          {categories?.map((category) => (
            <button
              key={category?.id}
              onClick={() => onCategoryChange(category?.id)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-body font-medium transition-all duration-200 hover:scale-[1.02] ${
                activeCategory === category?.id
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-muted text-foreground hover:bg-primary/10 hover:text-primary border border-transparent hover:border-primary/20'
              }`}
            >
              <Icon 
                name={category?.icon} 
                size={14} 
                color={activeCategory === category?.id ? 'currentColor' : 'var(--color-primary)'} 
              />
              <span className="whitespace-nowrap">{category?.name}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeCategory === category?.id
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-primary/10 text-primary'
              }`}>
                {category?.count}
              </span>
              
              {/* Featured indicator */}
              {category?.featured && (
                <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse ml-1"></div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border mx-4"></div>

      {/* Filters & Sort Section */}
      <div className="rounded-b-xl">
        {/* Filter Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-2">
            <Icon name="Filter" size={18} color="var(--color-primary)" />
            {hasActiveFilters && (
              <span className="bg-accent text-accent-foreground text-xs px-2 py-0.5 rounded-full font-medium">
                Active
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-xs font-body text-muted-foreground hover:text-primary transition-colors duration-200"
              >
                Clear All
              </button>
            )}
            <button
              onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
              className="md:hidden p-1 rounded-lg text-foreground hover:text-primary hover:bg-muted transition-all duration-200"
            >
              <Icon 
                name={isFiltersExpanded ? "ChevronUp" : "ChevronDown"} 
                size={18} 
                className="transition-transform duration-200"
              />
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className={`px-4 pb-3 space-y-2.5 ${isFiltersExpanded ? 'block' : 'hidden md:block'}`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {/* Dietary Preferences */}
            <Select
              label="Dietary Preferences"
              options={dietaryOptions}
              value={filters?.dietary}
              onChange={(value) => handleFilterChange('dietary', value)}
              className="w-full"
            />

            {/* Price Range */}
            <Select
              label="Price Range"
              options={priceRangeOptions}
              value={filters?.priceRange}
              onChange={(value) => handleFilterChange('priceRange', value)}
              className="w-full"
            />

            {/* Sort By */}
            <Select
              label="Sort By"
              options={sortOptions}
              value={filters?.sortBy}
              onChange={(value) => handleFilterChange('sortBy', value)}
              className="w-full"
            />
          </div>

          {/* Active Filter Tags */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-border">
              {filters?.dietary && (
                <span className="inline-flex items-center space-x-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-body">
                  <span>{dietaryOptions?.find(opt => opt?.value === filters?.dietary)?.label}</span>
                  <button
                    onClick={() => handleFilterChange('dietary', '')}
                    className="hover:bg-primary/20 rounded-full p-0.5 transition-colors duration-200"
                  >
                    <Icon name="X" size={10} />
                  </button>
                </span>
              )}
              {filters?.priceRange && (
                <span className="inline-flex items-center space-x-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-body">
                  <span>{priceRangeOptions?.find(opt => opt?.value === filters?.priceRange)?.label}</span>
                  <button
                    onClick={() => handleFilterChange('priceRange', '')}
                    className="hover:bg-primary/20 rounded-full p-0.5 transition-colors duration-200"
                  >
                    <Icon name="X" size={10} />
                  </button>
                </span>
              )}
              {filters?.sortBy !== 'name' && (
                <span className="inline-flex items-center space-x-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-body">
                  <span>Sort: {sortOptions?.find(opt => opt?.value === filters?.sortBy)?.label}</span>
                  <button
                    onClick={() => handleFilterChange('sortBy', 'name')}
                    className="hover:bg-primary/20 rounded-full p-0.5 transition-colors duration-200"
                  >
                    <Icon name="X" size={10} />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BrowseByCategoryWithFilters;