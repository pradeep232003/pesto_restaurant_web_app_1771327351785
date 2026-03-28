import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import CartItem from './components/CartItem';
import OrderSummary from './components/OrderSummary';
import EmptyCart from './components/EmptyCart';
import PromoCodeSection from './components/PromoCodeSection';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import { useLocation2 } from '../../contexts/LocationContext';

const ShoppingCart = () => {
  const navigate = useNavigate();
  const { selectedLocation } = useLocation2();
  const [cartItems, setCartItems] = useState([]);
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  // Mock cart data
  const mockCartItems = [
  {
    id: 1,
    name: "Classic Beef Burger",
    price: 12.99,
    quantity: 2,
    image: "https://images.unsplash.com/photo-1585508718415-6d83666de492",
    imageAlt: "Juicy beef burger with lettuce, tomato, and cheese on sesame bun",
    customizations: ["Extra cheese", "No onions"],
    specialRequests: "Medium rare patty"
  },
  {
    id: 2,
    name: "Margherita Pizza",
    price: 16.99,
    quantity: 1,
    image: "https://images.unsplash.com/photo-1703784022146-b72677752ce5",
    imageAlt: "Traditional margherita pizza with fresh basil, mozzarella, and tomato sauce",
    customizations: ["Thin crust"],
    specialRequests: null
  },
  {
    id: 3,
    name: "Caesar Salad",
    price: 9.99,
    quantity: 1,
    image: "https://images.unsplash.com/photo-1598268013060-1f5baade2fc0",
    imageAlt: "Fresh caesar salad with romaine lettuce, croutons, and parmesan cheese",
    customizations: ["Extra dressing", "Add chicken"],
    specialRequests: "Dressing on the side"
  }];


  // Available promo codes
  const availablePromoCodes = {
    'SAVE10': { code: 'SAVE10', discount: 0.10, description: '10% off your order', minOrder: 20 },
    'FIRST20': { code: 'FIRST20', discount: 0.20, description: '20% off first order', minOrder: 25 },
    'WELCOME15': { code: 'WELCOME15', discount: 0.15, description: '15% off welcome offer', minOrder: 15 }
  };

  useEffect(() => {
    // Load cart items from localStorage or use mock data
    const savedCart = localStorage.getItem('cartItems');
    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart));
      } catch (error) {
        setCartItems(mockCartItems);
      }
    } else {
      setCartItems(mockCartItems);
    }

    // Load applied promo
    const savedPromo = localStorage.getItem('appliedPromo');
    if (savedPromo) {
      try {
        setAppliedPromo(JSON.parse(savedPromo));
      } catch (error) {
        setAppliedPromo(null);
      }
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('cartItems', JSON.stringify(cartItems));
  }, [cartItems]);

  // Save promo to localStorage whenever it changes
  useEffect(() => {
    if (appliedPromo) {
      localStorage.setItem('appliedPromo', JSON.stringify(appliedPromo));
    } else {
      localStorage.removeItem('appliedPromo');
    }
  }, [appliedPromo]);

  const handleUpdateQuantity = (itemId, newQuantity) => {
    setCartItems((prevItems) =>
    prevItems?.map((item) =>
    item?.id === itemId ? { ...item, quantity: newQuantity } : item
    )
    );
  };

  const handleRemoveItem = (itemId) => {
    setCartItems((prevItems) => prevItems?.filter((item) => item?.id !== itemId));
  };

  const handleModifyItem = (itemId) => {
    // Navigate to menu with item modification
    navigate(`/menu-catalog?modify=${itemId}`);
  };

  const handleApplyPromo = async (promoCode) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const promo = availablePromoCodes[promoCode];
        const currentSubtotal = cartItems?.reduce((sum, item) => sum + item?.price * item?.quantity, 0);
        if (promo && currentSubtotal >= promo.minOrder) {
          setAppliedPromo(promo);
          resolve({ success: true });
        } else if (promo) {
          resolve({
            success: false,
            message: `Minimum order of ${promo.minOrder} required`
          });
        } else {
          resolve({
            success: false,
            message: 'Invalid promo code'
          });
        }
      }, 1000);
    });
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
  };

  const handleCheckout = async () => {
    setIsCheckoutLoading(true);

    // Simulate checkout process
    setTimeout(() => {
      setIsCheckoutLoading(false);
      // Navigate to checkout page (would be implemented)
      alert('Proceeding to checkout...\nThis would navigate to the payment page.');
    }, 2000);
  };

  // Calculate totals
  const subtotal = cartItems?.reduce((sum, item) => sum + item?.price * item?.quantity, 0);
  const discountAmount = appliedPromo ? subtotal * appliedPromo?.discount : 0;
  const discountedSubtotal = subtotal - discountAmount;
  const tax = discountedSubtotal * 0.08; // 8% tax
  const deliveryFee = discountedSubtotal >= 30 ? 0 : 3.99; // Free delivery over $30
  const total = discountedSubtotal + tax + deliveryFee;

  const cartCount = cartItems?.reduce((sum, item) => sum + item?.quantity, 0);

  if (cartItems?.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header
          cartCount={0}
          onCartClick={() => {}}
          onAccountClick={() => {}}
          onSearch={() => {}}
          onLogout={() => {}} />

        <main className="pt-16">
          <EmptyCart />
        </main>
      </div>);

  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        cartCount={cartCount}
        onCartClick={() => {}}
        onAccountClick={() => {}}
        onSearch={() => {}}
        onLogout={() => {}} />

      <main className="pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-2">
              <Icon name="ShoppingCart" size={28} className="text-primary" />
              <h1 className="font-heading font-bold text-3xl text-foreground">
                Shopping Cart
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <p className="font-body text-muted-foreground">
                Review your order and proceed to checkout
              </p>
              {selectedLocation && (
                <div className="flex items-center space-x-1.5 text-sm font-body text-primary bg-primary/10 rounded-full px-3 py-1">
                  <Icon name="MapPin" size={13} />
                  <span>{selectedLocation?.name}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items Section */}
            <div className="lg:col-span-2 space-y-6">
              {/* Cart Items Header */}
              <div className="flex items-center justify-between">
                <h2 className="font-heading font-bold text-xl text-foreground">
                  Your Items ({cartCount})
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/menu-catalog')}
                  iconName="Plus"
                  iconPosition="left"
                  iconSize={14}>

                  Add More Items
                </Button>
              </div>

              {/* Cart Items List */}
              <div className="space-y-4">
                {cartItems?.map((item) =>
                <CartItem
                  key={item?.id}
                  item={item}
                  onUpdateQuantity={handleUpdateQuantity}
                  onRemove={handleRemoveItem}
                  onModify={handleModifyItem} />

                )}
              </div>

              {/* Promo Code Section */}
              <PromoCodeSection
                onApplyPromo={handleApplyPromo}
                appliedPromo={appliedPromo}
                onRemovePromo={handleRemovePromo} />


              {/* Continue Shopping */}
              <div className="pt-6 border-t border-border">
                <Button
                  variant="outline"
                  onClick={() => navigate('/menu-catalog')}
                  iconName="ArrowLeft"
                  iconPosition="left">

                  Continue Shopping
                </Button>
              </div>
            </div>

            {/* Order Summary Section */}
            <div className="lg:col-span-1">
              <OrderSummary
                subtotal={subtotal}
                tax={tax}
                deliveryFee={deliveryFee}
                discount={discountAmount}
                total={total}
                onCheckout={handleCheckout}
                isLoading={isCheckoutLoading}
                promoCode={appliedPromo?.code} />

            </div>
          </div>

          {/* Mobile Checkout Button */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 shadow-warm-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="font-body text-muted-foreground">Total:</span>
              <span className="font-heading font-bold text-xl text-primary">
                ${total?.toFixed(2)}
              </span>
            </div>
            <Button
              variant="default"
              size="lg"
              fullWidth
              loading={isCheckoutLoading}
              onClick={handleCheckout}
              iconName="CreditCard"
              iconPosition="left"
              className="bg-primary hover:bg-primary/90 text-primary-foreground">

              Proceed to Checkout
            </Button>
          </div>

          {/* Mobile Spacing */}
          <div className="lg:hidden h-24"></div>
        </div>
      </main>
    </div>);

};

export default ShoppingCart;