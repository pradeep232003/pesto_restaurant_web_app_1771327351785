import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Icon from '../../components/AppIcon';
import api from '../../lib/api';

const STATUS_STEPS = [
  { key: 'pending', label: 'Order Placed', icon: 'ClipboardList' },
  { key: 'confirmed', label: 'Confirmed', icon: 'CheckCircle' },
  { key: 'preparing', label: 'Preparing', icon: 'ChefHat' },
  { key: 'ready', label: 'Ready for Collection', icon: 'Package' },
  { key: 'collected', label: 'Collected', icon: 'ShoppingBag' },
];

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
    <div className="min-h-screen bg-background">
      <Header cartCount={0} onCartClick={() => navigate('/shopping-cart')} onAccountClick={() => {}} onSearch={() => {}} onLogout={() => {}} />
      <main className="pt-16">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-heading font-bold text-foreground">Track Your Order</h1>
            <p className="text-muted-foreground mt-2 font-body">Enter your order number to check the status</p>
          </div>

          {/* Search */}
          <form onSubmit={handleTrack} className="flex gap-3 mb-8">
            <input
              data-testid="order-number-input"
              type="text"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
              placeholder="e.g. JK-A1B2C3"
              className="flex-1 px-4 py-3 rounded-lg border border-border bg-card text-foreground font-mono text-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            <button
              data-testid="track-order-btn"
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-body font-medium hover:bg-primary/90 transition-all disabled:opacity-60"
            >
              {loading ? 'Tracking...' : 'Track'}
            </button>
          </form>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 mb-6 flex items-center gap-2">
              <Icon name="AlertCircle" size={16} color="var(--color-destructive)" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {order && (
            <div className="bg-card rounded-2xl shadow-warm overflow-hidden">
              {/* Order Header */}
              <div className="bg-primary/5 border-b border-border px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-body">Order Number</p>
                    <p data-testid="order-number-display" className="text-xl font-heading font-bold text-primary">{order.order_number}</p>
                  </div>
                  {isCancelled ? (
                    <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-body font-medium">Cancelled</span>
                  ) : (
                    <span className={`px-3 py-1 rounded-full text-sm font-body font-medium ${
                      order.status === 'ready' ? 'bg-green-100 text-green-700 animate-pulse' :
                      order.status === 'collected' ? 'bg-blue-100 text-blue-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
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
                      const isActive = i <= currentStepIndex;
                      const isCurrent = i === currentStepIndex;
                      return (
                        <div key={step.key} className="flex items-start gap-4">
                          <div className="flex flex-col items-center">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                              isCurrent ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' :
                              isActive ? 'bg-primary text-primary-foreground' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              <Icon name={step.icon} size={18} />
                            </div>
                            {i < STATUS_STEPS.length - 1 && (
                              <div className={`w-0.5 h-8 ${isActive ? 'bg-primary' : 'bg-muted'}`}></div>
                            )}
                          </div>
                          <div className="pt-2">
                            <p className={`text-sm font-body font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {step.label}
                            </p>
                            {isCurrent && order.status === 'ready' && (
                              <p className="text-xs text-green-600 font-body mt-0.5">Your order is ready! Please collect it now.</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Order Items */}
              <div className="border-t border-border px-6 py-4">
                <p className="text-sm font-body font-semibold text-foreground mb-3">Order Items</p>
                <div className="space-y-2">
                  {order.items?.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.quantity}x {item.name}</span>
                      <span className="font-body font-medium text-foreground">{'\u00A3'}{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-border flex justify-between">
                  <span className="font-body font-semibold text-foreground">Total</span>
                  <span className="font-heading font-bold text-primary text-lg">{'\u00A3'}{order.total?.toFixed(2)}</span>
                </div>
              </div>

              {/* Collection Note */}
              <div className="bg-amber-50 border-t border-amber-200 px-6 py-3">
                <div className="flex items-center gap-2">
                  <Icon name="MapPin" size={14} color="#d97706" />
                  <p className="text-xs text-amber-700 font-body">Collection only - no delivery available</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default OrderStatus;
