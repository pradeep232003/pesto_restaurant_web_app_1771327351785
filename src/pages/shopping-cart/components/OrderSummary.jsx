import React from 'react';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

const OrderSummary = ({ 
  subtotal, 
  tax, 
  deliveryFee, 
  discount, 
  total, 
  onCheckout, 
  isLoading = false,
  promoCode = null 
}) => {
  return (
    <div className="bg-card border border-border rounded-lg p-6 shadow-warm sticky top-20">
      <h2 className="font-heading font-bold text-xl text-foreground mb-6">
        Order Summary
      </h2>
      <div className="space-y-4">
        {/* Subtotal */}
        <div className="flex justify-between items-center">
          <span className="font-body text-foreground">Subtotal</span>
          <span className="font-body font-medium text-foreground">
            ${subtotal?.toFixed(2)}
          </span>
        </div>

        {/* Discount */}
        {discount > 0 && (
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <span className="font-body text-foreground">Discount</span>
              {promoCode && (
                <span className="bg-accent text-accent-foreground px-2 py-1 rounded text-xs font-body font-medium">
                  {promoCode}
                </span>
              )}
            </div>
            <span className="font-body font-medium text-success">
              -${discount?.toFixed(2)}
            </span>
          </div>
        )}

        {/* Tax */}
        <div className="flex justify-between items-center">
          <span className="font-body text-foreground">Tax</span>
          <span className="font-body font-medium text-foreground">
            ${tax?.toFixed(2)}
          </span>
        </div>

        {/* Delivery Fee */}
        <div className="flex justify-between items-center">
          <span className="font-body text-foreground">Delivery Fee</span>
          <span className="font-body font-medium text-foreground">
            {deliveryFee === 0 ? 'FREE' : `$${deliveryFee?.toFixed(2)}`}
          </span>
        </div>

        {/* Divider */}
        <div className="border-t border-border pt-4">
          <div className="flex justify-between items-center">
            <span className="font-heading font-bold text-lg text-foreground">Total</span>
            <span className="font-heading font-bold text-xl text-primary">
              ${total?.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
      {/* Checkout Button */}
      <div className="mt-6">
        <Button
          variant="default"
          size="lg"
          fullWidth
          loading={isLoading}
          onClick={onCheckout}
          iconName="CreditCard"
          iconPosition="left"
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          Proceed to Checkout
        </Button>
      </div>
      {/* Additional Info */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Icon name="Clock" size={14} />
          <span>Estimated delivery: 25-35 minutes</span>
        </div>
        
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Icon name="Shield" size={14} />
          <span>Secure checkout with SSL encryption</span>
        </div>
      </div>
    </div>
  );
};

export default OrderSummary;