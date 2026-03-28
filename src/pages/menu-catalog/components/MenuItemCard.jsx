import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';
import Button from '../../../components/ui/Button';

const MenuItemCard = ({ item, onAddToCart, className = "" }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleAddToCart = async () => {
    setIsLoading(true);
    try {
      await onAddToCart(item);
      // Simulate API call delay
      setTimeout(() => {
        setIsLoading(false);
      }, 800);
    } catch (error) {
      setIsLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    })?.format(price);
  };

  return (
    <div className={`group bg-card rounded-xl overflow-hidden shadow-warm hover:shadow-warm-lg transition-all duration-300 hover:-translate-y-1 ${className}`}>
      {/* Image Container */}
      <div className="relative overflow-hidden bg-muted">
        <div className="aspect-[4/3] relative">
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
            </div>
          )}
          <Image
            src={item?.image}
            alt={item?.imageAlt}
            className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-110 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setImageLoaded(true)}
            loading="lazy"
          />
          
          {/* Featured Badge */}
          {item?.featured && (
            <div className="absolute top-3 left-3">
              <div className="bg-accent text-accent-foreground px-2 py-1 rounded-full text-xs font-body font-medium flex items-center space-x-1">
                <Icon name="Star" size={12} />
                <span>Featured</span>
              </div>
            </div>
          )}

          {/* Dietary Badges */}
          {item?.dietary && item?.dietary?.length > 0 && (
            <div className="absolute top-3 right-3 flex flex-col space-y-1">
              {item?.dietary?.slice(0, 2)?.map((diet) => (
                <div
                  key={diet}
                  className="bg-success text-success-foreground px-2 py-1 rounded-full text-xs font-body font-medium"
                >
                  {diet === 'vegetarian' && '🌱'}
                  {diet === 'vegan' && '🌿'}
                  {diet === 'gluten-free' && 'GF'}
                  {diet === 'dairy-free' && 'DF'}
                  {diet === 'keto' && 'K'}
                </div>
              ))}
            </div>
          )}

          {/* Quick Add Overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <Button
              variant="default"
              size="sm"
              iconName="Plus"
              iconPosition="left"
              loading={isLoading}
              onClick={handleAddToCart}
              className="transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300"
            >
              Quick Add
            </Button>
          </div>
        </div>
      </div>
      {/* Content */}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-body font-medium text-foreground text-lg truncate group-hover:text-primary transition-colors duration-200">
              {item?.name}
            </h3>
            {item?.subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{item?.subtitle}</p>
            )}
          </div>
          <div className="flex items-center space-x-1 ml-2">
            <span className="text-xl font-heading font-bold text-primary">
              {formatPrice(item?.price)}
            </span>
            {item?.originalPrice && item?.originalPrice > item?.price && (
              <span className="text-sm text-muted-foreground line-through">
                {formatPrice(item?.originalPrice)}
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {item?.description}
        </p>

        {/* Rating & Reviews */}
        {item?.rating && (
          <div className="flex items-center space-x-2 mb-4">
            <div className="flex items-center space-x-1">
              {[...Array(5)]?.map((_, i) => (
                <Icon
                  key={i}
                  name="Star"
                  size={14}
                  color={i < Math.floor(item?.rating) ? 'var(--color-accent)' : 'var(--color-muted-foreground)'}
                  className={i < Math.floor(item?.rating) ? 'fill-current' : ''}
                />
              ))}
            </div>
            <span className="text-sm text-muted-foreground">
              {item?.rating} ({item?.reviewCount} reviews)
            </span>
          </div>
        )}

        {/* Tags */}
        {item?.tags && item?.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {item?.tags?.slice(0, 3)?.map((tag) => (
              <span
                key={tag}
                className="bg-muted text-muted-foreground px-2 py-1 rounded-full text-xs font-body"
              >
                {tag}
              </span>
            ))}
            {item?.tags?.length > 3 && (
              <span className="text-xs text-muted-foreground px-2 py-1">
                +{item?.tags?.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <Button
            variant="default"
            size="sm"
            iconName="ShoppingCart"
            iconPosition="left"
            loading={isLoading}
            onClick={handleAddToCart}
            fullWidth
          >
            Add to Cart
          </Button>
          <Button
            variant="outline"
            size="sm"
            iconName="Heart"
            className="flex-shrink-0"
          >
          </Button>
        </div>

        {/* Preparation Time */}
        {item?.prepTime && (
          <div className="flex items-center space-x-1 mt-3 pt-3 border-t border-border">
            <Icon name="Clock" size={14} color="var(--color-muted-foreground)" />
            <span className="text-xs text-muted-foreground">
              Ready in {item?.prepTime} mins
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MenuItemCard;