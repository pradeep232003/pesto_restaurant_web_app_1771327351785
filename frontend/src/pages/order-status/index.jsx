import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, AlertCircle, ClipboardList, CheckCircle, ChefHat, Package, ShoppingBag, MapPin, ArrowLeft } from 'lucide-react';
import Header from '../../components/ui/Header';
import api from '../../lib/api';

const ease = [0.16, 1, 0.3, 1];

const STATUS_STEPS = [
  { key: 'pending', label: 'Order Placed', icon: ClipboardList },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle },
  { key: 'preparing', label: 'Preparing', icon: ChefHat },
  { key: 'ready', label: 'Ready for Collection', icon: Package },
  { key: 'collected', label: 'Collected', icon: ShoppingBag },
];

const formatPrice = (price) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(price);

const OrderStatus = () => {
  const navigate = useNavigate();
  const [orderNumber, setOrderNumber] = useState('');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTrack = async (e) => {
    e?.preventDefault();
    if (!orderNumber.trim()) return;
    setLoading(true);
    setError('');
    setOrder(null);
    try {
      const data = await api.trackOrder(orderNumber.trim());
      setOrder(data);
    } catch (err) {
      setError(err.message || 'Order not found');
    } finally {
      setLoading(false);
    }
  };

  const currentStepIndex = order ? STATUS_STEPS.findIndex(s => s.key === order.status) : -1;
  const isCancelled = order?.status === 'cancelled';

  return (
    <div className="min-h-screen" style={{ background: '#FBFBFD' }}>
      <Header cartCount={0} onCartClick={() => navigate('/shopping-cart')} onAccountClick={() => {}} onSearch={() => {}} onLogout={() => {}} />

      <main className="pt-16">
        {/* Hero */}
        <section className="pt-14 pb-6 md:pt-18 md:pb-8 px-6 md:px-12 text-center">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
            className="text-sm tracking-[0.2em] uppercase mb-3"
            style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}
          >
            Order tracking
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease }}
            className="text-4xl sm:text-5xl font-semibold tracking-tight mb-4"
            style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
          >
            Track Your Order.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease }}
            className="text-base max-w-md mx-auto"
            style={{ color: '#86868B' }}
          >
            Enter your order number to see real-time status.
          </motion.p>
        </section>

        {/* Search */}
        <section className="px-6 md:px-12 pb-6">
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25, ease }}
            onSubmit={handleTrack}
            className="max-w-lg mx-auto flex gap-3"
          >
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#86868B' }} />
              <input
                data-testid="order-number-input"
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
                placeholder="e.g. JK-A1B2C3"
                className="w-full pl-11 pr-4 py-3.5 rounded-xl text-sm font-mono outline-none transition-all duration-200"
                style={{
                  background: '#FFFFFF',
                  color: '#1D1D1F',
                  border: '1px solid rgba(0,0,0,0.08)',
                  fontFamily: 'Outfit, monospace',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(0,0,0,0.2)'}
                onBlur={e => e.target.style.borderColor = 'rgba(0,0,0,0.08)'}
              />
            </div>
            <button
              data-testid="track-order-btn"
              type="submit"
              disabled={loading}
              className="px-7 py-3.5 rounded-xl text-sm font-medium tracking-wide transition-all duration-300 disabled:opacity-50"
              style={{ background: '#1D1D1F', color: '#FFFFFF', fontFamily: 'Outfit, sans-serif' }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#333336'; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#1D1D1F'; }}
            >
              {loading ? 'Tracking...' : 'Track'}
            </button>
          </motion.form>
        </section>

        {/* Error */}
        <div className="max-w-lg mx-auto px-6 md:px-12">
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

        {/* Order Result */}
        <section className="px-6 md:px-12 pb-20">
          <AnimatePresence>
            {order && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease }}
                className="max-w-lg mx-auto"
              >
                {/* Order Card */}
                <div
                  className="overflow-hidden"
                  style={{ background: '#FFFFFF', borderRadius: '1.5rem', border: '1px solid rgba(0,0,0,0.06)' }}
                >
                  {/* Header */}
                  <div className="px-6 py-5" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs tracking-[0.1em] uppercase mb-1" style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}>
                          Order Number
                        </p>
                        <p
                          data-testid="order-number-display"
                          className="text-2xl font-semibold tracking-tight"
                          style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
                        >
                          {order.order_number}
                        </p>
                      </div>
                      {isCancelled ? (
                        <span
                          className="px-4 py-1.5 rounded-full text-xs font-medium"
                          style={{ background: 'rgba(255,59,48,0.08)', color: '#FF3B30', fontFamily: 'Outfit, sans-serif' }}
                        >
                          Cancelled
                        </span>
                      ) : (
                        <span
                          className="px-4 py-1.5 rounded-full text-xs font-medium"
                          style={{
                            background: order.status === 'ready' ? 'rgba(52,199,89,0.1)' :
                              order.status === 'collected' ? 'rgba(0,122,255,0.1)' : 'rgba(255,149,0,0.1)',
                            color: order.status === 'ready' ? '#34C759' :
                              order.status === 'collected' ? '#007AFF' : '#FF9500',
                            fontFamily: 'Outfit, sans-serif',
                          }}
                        >
                          {STATUS_STEPS.find(s => s.key === order.status)?.label || order.status}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status Timeline */}
                  {!isCancelled && (
                    <div className="px-6 py-6">
                      <div className="space-y-0">
                        {STATUS_STEPS.map((step, i) => {
                          const StepIcon = step.icon;
                          const isActive = i <= currentStepIndex;
                          const isCurrent = i === currentStepIndex;
                          return (
                            <div key={step.key} className="flex items-start gap-4">
                              <div className="flex flex-col items-center">
                                <div
                                  className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300"
                                  style={{
                                    background: isCurrent ? '#1D1D1F' : isActive ? '#1D1D1F' : '#F5F5F7',
                                    color: isActive ? '#FFFFFF' : '#86868B',
                                    boxShadow: isCurrent ? '0 0 0 4px rgba(29,29,31,0.12)' : 'none',
                                  }}
                                >
                                  <StepIcon size={16} strokeWidth={1.8} />
                                </div>
                                {i < STATUS_STEPS.length - 1 && (
                                  <div
                                    className="w-0.5 h-7 transition-colors duration-300"
                                    style={{ background: isActive ? '#1D1D1F' : 'rgba(0,0,0,0.08)' }}
                                  />
                                )}
                              </div>
                              <div className="pt-1.5">
                                <p
                                  className="text-sm font-medium"
                                  style={{
                                    color: isActive ? '#1D1D1F' : '#86868B',
                                    fontFamily: 'Outfit, sans-serif',
                                  }}
                                >
                                  {step.label}
                                </p>
                                {isCurrent && order.status === 'ready' && (
                                  <p className="text-xs mt-0.5" style={{ color: '#34C759' }}>
                                    Your order is ready! Please collect it now.
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Order Items */}
                  <div className="px-6 py-5" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                    <p
                      className="text-xs tracking-[0.1em] uppercase mb-4"
                      style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}
                    >
                      Items
                    </p>
                    <div className="space-y-3">
                      {order.items?.map((item, i) => (
                        <div key={i} className="flex justify-between items-center">
                          <span className="text-sm" style={{ color: '#86868B' }}>
                            {item.quantity}x {item.name}
                          </span>
                          <span
                            className="text-sm font-medium"
                            style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
                          >
                            {formatPrice(item.price * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div
                      className="mt-4 pt-4 flex justify-between items-center"
                      style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}
                    >
                      <span
                        className="text-sm font-semibold"
                        style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
                      >
                        Total
                      </span>
                      <span
                        className="text-xl font-semibold tracking-tight"
                        style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
                      >
                        {formatPrice(order.total)}
                      </span>
                    </div>
                  </div>

                  {/* Collection Note */}
                  <div
                    className="px-6 py-3.5 flex items-center gap-2.5"
                    style={{ background: 'rgba(255,149,0,0.05)', borderTop: '1px solid rgba(255,149,0,0.1)' }}
                  >
                    <MapPin size={13} style={{ color: '#FF9500' }} />
                    <p className="text-xs" style={{ color: '#FF9500', fontFamily: 'Outfit, sans-serif' }}>
                      Collection only — no delivery available
                    </p>
                  </div>
                </div>

                {/* Back to menu */}
                <div className="mt-6 text-center">
                  <button
                    onClick={() => navigate('/menu-catalog')}
                    className="inline-flex items-center gap-2 text-sm font-medium transition-colors duration-200"
                    style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#1D1D1F'}
                    onMouseLeave={e => e.currentTarget.style.color = '#86868B'}
                  >
                    <ArrowLeft size={15} />
                    Back to Menu
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>
    </div>
  );
};

export default OrderStatus;
