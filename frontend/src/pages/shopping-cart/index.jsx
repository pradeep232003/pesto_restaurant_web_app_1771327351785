import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Minus, Plus, Trash2, ArrowLeft, MapPin, CheckCircle, AlertTriangle, AlertCircle, ChevronRight } from 'lucide-react';
import Header from '../../components/ui/Header';
import api from '../../lib/api';
import { useLocation2 } from '../../contexts/LocationContext';
import { useCustomer } from '../../contexts/CustomerContext';

const ease = [0.16, 1, 0.3, 1];

const formatPrice = (price) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(price);

const ShoppingCart = () => {
  const navigate = useNavigate();
  const { selectedLocation } = useLocation2();
  const { customer, token, isVerified } = useCustomer();
  const [cartItems, setCartItems] = useState([]);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [siteStatus, setSiteStatus] = useState(null);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('cartItems');
    if (saved) {
      try { setCartItems(JSON.parse(saved)); } catch { setCartItems([]); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('cartItems', JSON.stringify(cartItems));
  }, [cartItems]);

  useEffect(() => {
    if (selectedLocation?.id) {
      api.getSiteStatus(selectedLocation.id).then(setSiteStatus).catch(() => {});
    }
  }, [selectedLocation]);

  const handleUpdateQuantity = (itemId, newQty) => {
    if (newQty < 1) return;
    setCartItems(prev => prev.map(item => item.id === itemId ? { ...item, quantity: newQty } : item));
  };

  const handleRemoveItem = (itemId) => {
    setCartItems(prev => prev.filter(item => item.id !== itemId));
  };

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = async () => {
    if (!customer) {
      navigate('/customer-auth');
      return;
    }
    if (!isVerified) {
      setError('Please verify your email before ordering.');
      return;
    }
    if (!siteStatus?.is_open) {
      setError('Sorry, ordering is currently closed for this location.');
      return;
    }

    setIsCheckoutLoading(true);
    setError('');
    try {
      const orderData = {
        location_id: selectedLocation?.id,
        items: cartItems.map(item => ({
          menu_item_id: item.id?.toString(),
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        special_instructions: specialInstructions || null,
      };
      const result = await api.createOrder(orderData, token);
      setOrderSuccess(result.order);
      setCartItems([]);
      localStorage.removeItem('cartItems');
    } catch (err) {
      setError(err.message || 'Failed to place order');
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  // --- ORDER SUCCESS ---
  if (orderSuccess) {
    return (
      <div className="min-h-screen" style={{ background: '#FBFBFD' }}>
        <Header cartCount={0} onCartClick={() => {}} onAccountClick={() => {}} onSearch={() => {}} onLogout={() => {}} />
        <main className="pt-16">
          <div className="max-w-lg mx-auto px-6 py-20 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease }}
            >
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8"
                style={{ background: 'rgba(52,199,89,0.1)' }}
              >
                <CheckCircle size={40} style={{ color: '#34C759' }} strokeWidth={1.5} />
              </div>
              <h1
                className="text-3xl sm:text-4xl font-semibold tracking-tight mb-3"
                style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
              >
                Order Placed.
              </h1>
              <p className="text-base mb-10" style={{ color: '#86868B' }}>
                Your order has been placed successfully. Please collect it when ready.
              </p>

              <div
                className="p-8 mb-8"
                style={{ background: '#FFFFFF', borderRadius: '1.5rem', border: '1px solid rgba(0,0,0,0.06)' }}
              >
                <p className="text-xs tracking-[0.15em] uppercase mb-2" style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}>
                  Order Number
                </p>
                <p
                  data-testid="checkout-order-number"
                  className="text-4xl font-semibold tracking-tight mb-3"
                  style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
                >
                  {orderSuccess.order_number}
                </p>
                <p className="text-sm" style={{ color: '#86868B' }}>
                  Total: <span style={{ color: '#1D1D1F', fontWeight: 600 }}>{formatPrice(orderSuccess.total)}</span>
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  data-testid="track-my-order-btn"
                  onClick={() => navigate('/order-status')}
                  className="w-full py-3.5 rounded-full text-sm font-medium tracking-wide transition-colors duration-300"
                  style={{ background: '#1D1D1F', color: '#FFFFFF', fontFamily: 'Outfit, sans-serif' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#333336'}
                  onMouseLeave={e => e.currentTarget.style.background = '#1D1D1F'}
                >
                  Track My Order
                </button>
                <button
                  onClick={() => navigate('/menu-catalog')}
                  className="w-full py-3.5 rounded-full text-sm font-medium tracking-wide transition-colors duration-300"
                  style={{ background: '#F5F5F7', color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#E8E8ED'}
                  onMouseLeave={e => e.currentTarget.style.background = '#F5F5F7'}
                >
                  Continue Browsing
                </button>
              </div>

              <div
                className="mt-8 inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs"
                style={{ background: 'rgba(255,149,0,0.08)', color: '#FF9500', fontFamily: 'Outfit, sans-serif' }}
              >
                <MapPin size={13} />
                Collection only — no delivery available
              </div>
            </motion.div>
          </div>
        </main>
      </div>
    );
  }

  // --- EMPTY CART ---
  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen" style={{ background: '#FBFBFD' }}>
        <Header cartCount={0} onCartClick={() => {}} onAccountClick={() => {}} onSearch={() => {}} onLogout={() => {}} />
        <main className="pt-16">
          <div className="max-w-lg mx-auto px-6 py-20 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease }}
            >
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8"
                style={{ background: '#F5F5F7' }}
              >
                <ShoppingBag size={32} style={{ color: '#86868B' }} strokeWidth={1.5} />
              </div>
              <h2
                className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3"
                style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
              >
                Your bag is empty.
              </h2>
              <p className="text-base mb-10" style={{ color: '#86868B' }}>
                Add some delicious items from our menu.
              </p>
              <button
                data-testid="browse-menu-btn"
                onClick={() => navigate('/menu-catalog')}
                className="px-8 py-3.5 rounded-full text-sm font-medium tracking-wide transition-colors duration-300"
                style={{ background: '#1D1D1F', color: '#FFFFFF', fontFamily: 'Outfit, sans-serif' }}
                onMouseEnter={e => e.currentTarget.style.background = '#333336'}
                onMouseLeave={e => e.currentTarget.style.background = '#1D1D1F'}
              >
                Browse Menu
              </button>
            </motion.div>
          </div>
        </main>
      </div>
    );
  }

  // --- CART WITH ITEMS ---
  return (
    <div className="min-h-screen" style={{ background: '#FBFBFD' }}>
      <Header cartCount={cartCount} onCartClick={() => {}} onAccountClick={() => {}} onSearch={() => {}} onLogout={() => {}} />

      <main className="pt-16">
        {/* Page header */}
        <section className="pt-16 pb-8 md:pt-20 md:pb-10 px-6 md:px-12 text-center" style={{ background: '#FBFBFD' }}>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
            className="text-sm tracking-[0.2em] uppercase mb-4"
            style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}
          >
            {cartCount} {cartCount === 1 ? 'item' : 'items'} in your bag
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease }}
            className="text-4xl sm:text-5xl font-semibold tracking-tight"
            style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
          >
            Your Bag.
          </motion.h1>
        </section>

        {/* Banners */}
        <div className="max-w-5xl mx-auto px-6 md:px-12">
          {siteStatus && !siteStatus.is_open && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 px-5 py-4 mb-4 rounded-2xl"
              style={{ background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.12)' }}
            >
              <AlertTriangle size={16} style={{ color: '#FF3B30' }} />
              <p className="text-sm" style={{ color: '#FF3B30', fontFamily: 'Outfit, sans-serif' }}>
                Ordering is currently closed for {selectedLocation?.name}.
              </p>
            </motion.div>
          )}

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-3 px-5 py-4 mb-4 rounded-2xl"
                style={{ background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.12)' }}
              >
                <AlertCircle size={16} style={{ color: '#FF3B30' }} />
                <p className="text-sm" style={{ color: '#FF3B30' }}>{error}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Cart content */}
        <section className="pb-16 px-6 md:px-12">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12">

              {/* Cart items — left column */}
              <div className="lg:col-span-3">
                <div className="space-y-3">
                  {cartItems.map((item, i) => (
                    <motion.div
                      key={item.id}
                      data-testid={`cart-item-${item.id}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: i * 0.05, ease }}
                      className="p-4 sm:p-5"
                      style={{
                        background: '#FFFFFF',
                        borderRadius: '1.25rem',
                        border: '1px solid rgba(0,0,0,0.06)',
                      }}
                    >
                      <div className="flex items-center gap-4">
                        {/* Thumbnail */}
                        {item.image && (
                          <div
                            className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 overflow-hidden"
                            style={{ borderRadius: '0.75rem', background: '#F5F5F7' }}
                          >
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          </div>
                        )}

                        {/* Info + controls row */}
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm font-medium tracking-tight mb-1"
                            style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
                          >
                            {item.name}
                          </p>
                          <p
                            className="text-sm font-semibold tracking-tight mb-3"
                            style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
                          >
                            {formatPrice(item.price)}
                          </p>

                          {/* Quantity + remove inline */}
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                              <button
                                data-testid={`qty-minus-${item.id}`}
                                onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200"
                                style={{ background: '#F5F5F7' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#E8E8ED'}
                                onMouseLeave={e => e.currentTarget.style.background = '#F5F5F7'}
                              >
                                <Minus size={14} style={{ color: '#1D1D1F' }} />
                              </button>
                              <span
                                className="w-8 text-center text-sm font-medium"
                                style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
                              >
                                {item.quantity}
                              </span>
                              <button
                                data-testid={`qty-plus-${item.id}`}
                                onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200"
                                style={{ background: '#F5F5F7' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#E8E8ED'}
                                onMouseLeave={e => e.currentTarget.style.background = '#F5F5F7'}
                              >
                                <Plus size={14} style={{ color: '#1D1D1F' }} />
                              </button>
                            </div>
                            <button
                              data-testid={`remove-item-${item.id}`}
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-2 rounded-full transition-colors duration-200"
                              style={{ color: '#86868B' }}
                              onMouseEnter={e => e.currentTarget.style.color = '#FF3B30'}
                              onMouseLeave={e => e.currentTarget.style.color = '#86868B'}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Special instructions */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2, ease }}
                  className="mt-4 p-5"
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '1.25rem',
                    border: '1px solid rgba(0,0,0,0.06)',
                  }}
                >
                  <label
                    className="block text-xs tracking-[0.1em] uppercase mb-3"
                    style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}
                  >
                    Special Instructions
                  </label>
                  <textarea
                    data-testid="special-instructions"
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    placeholder="Any allergies or special requests..."
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none transition-all duration-200"
                    style={{
                      background: '#F5F5F7',
                      color: '#1D1D1F',
                      border: '1px solid transparent',
                      fontFamily: 'Outfit, sans-serif',
                    }}
                    onFocus={e => e.target.style.borderColor = 'rgba(0,0,0,0.15)'}
                    onBlur={e => e.target.style.borderColor = 'transparent'}
                  />
                </motion.div>

                {/* Back to menu */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.3, ease }}
                  className="mt-5"
                >
                  <button
                    data-testid="add-more-items-btn"
                    onClick={() => navigate('/menu-catalog')}
                    className="inline-flex items-center gap-2 text-sm font-medium transition-colors duration-200"
                    style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#1D1D1F'}
                    onMouseLeave={e => e.currentTarget.style.color = '#86868B'}
                  >
                    <ArrowLeft size={15} />
                    Add more items
                  </button>
                </motion.div>
              </div>

              {/* Order summary — right column */}
              <div className="lg:col-span-2">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.15, ease }}
                  className="sticky top-24 p-6"
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '1.5rem',
                    border: '1px solid rgba(0,0,0,0.06)',
                  }}
                >
                  <h3
                    className="text-lg font-semibold tracking-tight mb-5"
                    style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
                  >
                    Summary
                  </h3>

                  {/* Line items */}
                  <div className="space-y-3 mb-5">
                    {cartItems.map(item => (
                      <div key={item.id} className="flex justify-between items-center">
                        <span className="text-sm truncate pr-3" style={{ color: '#86868B' }}>
                          {item.quantity}x {item.name}
                        </span>
                        <span
                          className="text-sm font-medium shrink-0"
                          style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
                        >
                          {formatPrice(item.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div
                    className="flex justify-between items-center py-4 mb-6"
                    style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}
                  >
                    <span
                      className="text-sm font-semibold"
                      style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
                    >
                      Total
                    </span>
                    <span
                      className="text-2xl font-semibold tracking-tight"
                      style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
                    >
                      {formatPrice(subtotal)}
                    </span>
                  </div>

                  {/* Collection notice */}
                  <div
                    className="flex items-center gap-2.5 px-4 py-3 rounded-xl mb-5"
                    style={{ background: 'rgba(255,149,0,0.06)' }}
                  >
                    <MapPin size={14} style={{ color: '#FF9500' }} />
                    <div>
                      <p className="text-xs font-medium" style={{ color: '#FF9500', fontFamily: 'Outfit, sans-serif' }}>
                        Collection only
                      </p>
                      {selectedLocation && (
                        <p className="text-xs mt-0.5" style={{ color: '#C77700' }}>
                          {selectedLocation.name}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* CTA */}
                  {!customer ? (
                    <button
                      data-testid="checkout-login-btn"
                      onClick={() => navigate('/customer-auth')}
                      className="w-full py-3.5 rounded-full text-sm font-medium tracking-wide transition-colors duration-300 flex items-center justify-center gap-2"
                      style={{ background: '#1D1D1F', color: '#FFFFFF', fontFamily: 'Outfit, sans-serif' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#333336'}
                      onMouseLeave={e => e.currentTarget.style.background = '#1D1D1F'}
                    >
                      Login to Order
                      <ChevronRight size={15} />
                    </button>
                  ) : (
                    <button
                      data-testid="place-order-btn"
                      onClick={handleCheckout}
                      disabled={isCheckoutLoading || !siteStatus?.is_open}
                      className="w-full py-3.5 rounded-full text-sm font-medium tracking-wide transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: (isCheckoutLoading || !siteStatus?.is_open) ? '#86868B' : '#1D1D1F',
                        color: '#FFFFFF',
                        fontFamily: 'Outfit, sans-serif',
                      }}
                      onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = '#333336'; }}
                      onMouseLeave={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = '#1D1D1F'; }}
                    >
                      {isCheckoutLoading ? 'Placing Order...' : (siteStatus?.is_open ? 'Place Collection Order' : 'Ordering Closed')}
                    </button>
                  )}

                  {customer && (
                    <p className="text-xs text-center mt-3" style={{ color: '#86868B' }}>
                      Ordering as {customer.name || customer.email}
                    </p>
                  )}
                </motion.div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default ShoppingCart;
