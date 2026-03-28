import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import api from '../../lib/api';
import { useLocation2 } from '../../contexts/LocationContext';
import { useCustomer } from '../../contexts/CustomerContext';

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

  // Check site status
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
      setError('Please verify your email and phone before ordering.');
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

  // Order success screen
  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-background">
        <Header cartCount={0} onCartClick={() => {}} onAccountClick={() => {}} onSearch={() => {}} onLogout={() => {}} />
        <main className="pt-16">
          <div className="max-w-lg mx-auto px-4 py-16 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Icon name="CheckCircle" size={40} color="#16a34a" />
            </div>
            <h1 className="text-3xl font-heading font-bold text-foreground mb-2">Order Placed!</h1>
            <p className="text-muted-foreground mb-6">Your order has been placed successfully. Please collect it when ready.</p>
            <div className="bg-card rounded-xl shadow-warm p-6 mb-6">
              <p className="text-sm text-muted-foreground mb-1">Order Number</p>
              <p data-testid="checkout-order-number" className="text-3xl font-heading font-bold text-primary">{orderSuccess.order_number}</p>
              <p className="text-sm text-muted-foreground mt-3">Total: <span className="font-bold text-foreground">{'\u00A3'}{orderSuccess.total?.toFixed(2)}</span></p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                data-testid="track-my-order-btn"
                onClick={() => navigate('/order-status')}
                className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-body font-medium hover:bg-primary/90 transition-all"
              >
                Track My Order
              </button>
              <button
                onClick={() => navigate('/menu-catalog')}
                className="w-full py-3 border border-border text-foreground rounded-lg font-body font-medium hover:bg-muted transition-all"
              >
                Continue Browsing
              </button>
            </div>
            <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-center gap-2 justify-center">
                <Icon name="MapPin" size={14} color="#d97706" />
                <p className="text-xs text-amber-700 font-body">Collection only - no delivery available</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Empty cart
  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header cartCount={0} onCartClick={() => {}} onAccountClick={() => {}} onSearch={() => {}} onLogout={() => {}} />
        <main className="pt-16">
          <div className="max-w-lg mx-auto px-4 py-16 text-center">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="ShoppingCart" size={32} color="var(--color-muted-foreground)" />
            </div>
            <h2 className="text-xl font-heading font-bold text-foreground mb-2">Your cart is empty</h2>
            <p className="text-muted-foreground mb-6">Add some delicious items from our menu!</p>
            <Button variant="default" onClick={() => navigate('/menu-catalog')} iconName="ArrowRight" iconPosition="right">
              Browse Menu
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header cartCount={cartCount} onCartClick={() => {}} onAccountClick={() => {}} onSearch={() => {}} onLogout={() => {}} />
      <main className="pt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center space-x-3 mb-6">
            <Icon name="ShoppingCart" size={28} className="text-primary" />
            <h1 className="font-heading font-bold text-2xl text-foreground">Your Cart</h1>
            <span className="text-sm text-muted-foreground">({cartCount} items)</span>
          </div>

          {/* Site status banner */}
          {siteStatus && !siteStatus.is_open && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 flex items-center gap-2">
              <Icon name="AlertTriangle" size={16} color="#dc2626" />
              <p className="text-sm text-red-700 font-body">Ordering is currently closed for {selectedLocation?.name}. You can still browse but cannot place orders.</p>
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 mb-6 flex items-center gap-2">
              <Icon name="AlertCircle" size={16} color="var(--color-destructive)" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Items */}
            <div className="lg:col-span-2 space-y-3">
              {cartItems.map(item => (
                <div key={item.id} data-testid={`cart-item-${item.id}`} className="bg-card rounded-xl shadow-warm p-4 flex items-center gap-4">
                  {item.image && (
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted shrink-0">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-body font-semibold text-foreground text-sm truncate">{item.name}</p>
                    <p className="text-primary font-heading font-bold text-sm">{'\u00A3'}{item.price.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-primary/10 transition-all">
                      <Icon name="Minus" size={14} />
                    </button>
                    <span className="w-8 text-center font-body font-medium">{item.quantity}</span>
                    <button onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-primary/10 transition-all">
                      <Icon name="Plus" size={14} />
                    </button>
                    <button onClick={() => handleRemoveItem(item.id)} className="ml-2 p-2 text-muted-foreground hover:text-destructive transition-all">
                      <Icon name="Trash2" size={14} />
                    </button>
                  </div>
                </div>
              ))}

              {/* Special instructions */}
              <div className="bg-card rounded-xl shadow-warm p-4">
                <label className="block text-sm font-body font-semibold text-foreground mb-2">Special Instructions</label>
                <textarea
                  data-testid="special-instructions"
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="Any allergies or special requests..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground font-body text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>

              <button onClick={() => navigate('/menu-catalog')} className="text-sm text-primary font-body font-medium hover:underline">
                <Icon name="ArrowLeft" size={14} className="inline mr-1" /> Add more items
              </button>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-card rounded-xl shadow-warm p-6 sticky top-20">
                <h3 className="font-heading font-bold text-lg text-foreground mb-4">Order Summary</h3>
                <div className="space-y-2 mb-4">
                  {cartItems.map(item => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.quantity}x {item.name}</span>
                      <span className="font-body font-medium">{'\u00A3'}{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border pt-3 flex justify-between mb-6">
                  <span className="font-body font-bold text-foreground">Total</span>
                  <span className="font-heading font-bold text-primary text-xl">{'\u00A3'}{subtotal.toFixed(2)}</span>
                </div>

                {/* Collection-only notice */}
                <div className="bg-amber-50 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Icon name="MapPin" size={14} color="#d97706" />
                    <p className="text-xs text-amber-700 font-body font-medium">Collection only - no delivery</p>
                  </div>
                  {selectedLocation && <p className="text-xs text-amber-600 mt-1 ml-5">{selectedLocation.name}</p>}
                </div>

                {!customer ? (
                  <button
                    data-testid="checkout-login-btn"
                    onClick={() => navigate('/customer-auth')}
                    className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-body font-medium hover:bg-primary/90 transition-all"
                  >
                    Login to Order
                  </button>
                ) : (
                  <button
                    data-testid="place-order-btn"
                    onClick={handleCheckout}
                    disabled={isCheckoutLoading || !siteStatus?.is_open}
                    className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-body font-medium hover:bg-primary/90 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isCheckoutLoading ? 'Placing Order...' : (siteStatus?.is_open ? 'Place Collection Order' : 'Ordering Closed')}
                  </button>
                )}

                {customer && (
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Ordering as {customer.name}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ShoppingCart;
