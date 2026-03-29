import React from 'react';
import { motion } from 'framer-motion';
import MenuItemCard from './MenuItemCard';
import { Search } from 'lucide-react';

const ease = [0.16, 1, 0.3, 1];

const MenuGrid = ({ items, loading = false, onAddToCart, isOrderingOpen = true }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="animate-pulse" style={{ borderRadius: '1.5rem', background: '#F5F5F7' }}>
            <div className="aspect-[4/3]" style={{ borderRadius: '1.5rem 1.5rem 0 0', background: '#E8E8ED' }} />
            <div className="p-5 space-y-3">
              <div className="h-4 rounded-full w-2/3" style={{ background: '#E8E8ED' }} />
              <div className="h-3 rounded-full w-full" style={{ background: '#E8E8ED' }} />
              <div className="h-10 rounded-full w-1/3 mt-4" style={{ background: '#E8E8ED' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-24">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ background: '#F5F5F7' }}
        >
          <Search size={24} style={{ color: '#86868B' }} />
        </div>
        <h3
          className="text-xl font-semibold tracking-tight mb-2"
          style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
        >
          No items found
        </h3>
        <p className="text-sm max-w-sm mx-auto" style={{ color: '#86868B' }}>
          Try selecting a different category or location.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Count */}
      <div className="flex items-center justify-between mb-8">
        <p className="text-sm" style={{ color: '#86868B' }}>
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
        {items.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: Math.min(i * 0.05, 0.3), ease }}
          >
            <MenuItemCard item={item} onAddToCart={onAddToCart} isOrderingOpen={isOrderingOpen} />
          </motion.div>
        ))}
      </div>
    </>
  );
};

export default MenuGrid;
