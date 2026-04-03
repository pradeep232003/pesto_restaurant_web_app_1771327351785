import React, { useState } from 'react';
import { Plus } from 'lucide-react';

const MenuItemCard = ({ item, onAddToCart, isOrderingOpen = true }) => {
  const [adding, setAdding] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const handleAdd = async () => {
    setAdding(true);
    try {
      await onAddToCart(item);
    } finally {
      setTimeout(() => setAdding(false), 600);
    }
  };

  const formatPrice = (price) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(price);

  return (
    <div
      data-testid={`menu-item-${item.id}`}
      className="group cursor-pointer transition-transform duration-300 hover:-translate-y-1"
      style={{ borderRadius: '1.5rem', background: '#FFFFFF' }}
    >
      {/* Image */}
      {item.image && (
        <div className="relative overflow-hidden" style={{ borderRadius: '1.5rem 1.5rem 0 0' }}>
          <div className="aspect-[4/3] relative">
            {!imgLoaded && (
              <div className="absolute inset-0 animate-pulse" style={{ background: '#F5F5F7' }} />
            )}
            <img
              src={item.image}
              alt={item.imageAlt || item.name}
              className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-105 ${
                imgLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setImgLoaded(true)}
              loading="lazy"
            />

            {/* Hover overlay with Quick Add */}
            {isOrderingOpen && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
              <button
                onClick={(e) => { e.stopPropagation(); handleAdd(); }}
                className="opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 px-5 py-2.5 rounded-full text-sm font-medium backdrop-blur-xl"
                style={{
                  background: 'rgba(255,255,255,0.85)',
                  color: '#1D1D1F',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                {adding ? 'Added' : 'Quick Add'}
              </button>
            </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3
            className="text-base font-medium tracking-tight leading-snug"
            style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
          >
            {item.name}
          </h3>
          <span
            className="text-base font-semibold tracking-tight shrink-0"
            style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
          >
            {formatPrice(item.price)}
          </span>
        </div>

        {item.description && (
          <p
            className="text-sm leading-relaxed line-clamp-2 mb-4"
            style={{ color: '#86868B' }}
          >
            {item.description}
          </p>
        )}

        {/* Tags */}
        {item.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {item.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-0.5 rounded-full text-xs"
                style={{ background: '#F5F5F7', color: '#86868B' }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Bottom row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {item.dietary?.length > 0 && (
              <span className="text-xs" style={{ color: '#86868B' }}>
                {item.dietary.map(d => d === 'vegetarian' ? 'V' : d === 'vegan' ? 'VG' : d === 'gluten-free' ? 'GF' : d.charAt(0).toUpperCase()).join(' · ')}
              </span>
            )}
          </div>

          {isOrderingOpen && (
          <button
            data-testid={`add-to-cart-${item.id}`}
            onClick={handleAdd}
            disabled={adding}
            className="flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200"
            style={{
              background: adding ? '#34C759' : '#F5F5F7',
              color: adding ? '#FFFFFF' : '#1D1D1F',
            }}
          >
            <Plus size={18} className={`transition-transform duration-200 ${adding ? 'rotate-45' : ''}`} />
          </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MenuItemCard;
