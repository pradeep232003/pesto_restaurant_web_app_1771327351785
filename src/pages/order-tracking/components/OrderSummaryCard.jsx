import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import AppImage from '../../../components/AppImage';

const OrderSummaryCard = ({ items = [], total = 0, specialInstructions = null }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const subtotal = items?.reduce((sum, item) => sum + (item?.price * item?.quantity), 0);
  const tax = subtotal * 0.08; // 8% tax
  const deliveryFee = 3.99;

  return (
    <div className="bg-card rounded-xl shadow-warm border border-border overflow-hidden">
      {/* Header */}
      <div 
        className="p-6 cursor-pointer hover:bg-muted/50 transition-colors duration-200"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Icon name="Receipt" size={24} className="text-primary" />
            <div>
              <h2 className="font-heading font-bold text-lg text-foreground">
                Order Summary
              </h2>
              <p className="font-caption text-sm text-muted-foreground">
                {items?.length} item{items?.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="text-right">
              <p className="font-heading font-bold text-lg text-foreground">
                ${total?.toFixed(2)}
              </p>
              <p className="font-caption text-xs text-muted-foreground">
                Total
              </p>
            </div>
            <Icon 
              name={isExpanded ? "ChevronUp" : "ChevronDown"} 
              size={20} 
              className="text-muted-foreground transition-transform duration-200" 
            />
          </div>
        </div>
      </div>

      {/* Expandable Content */}
      <div className={`transition-all duration-300 ease-in-out ${
        isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
      } overflow-hidden`}>
        <div className="px-6 pb-6 space-y-4">
          {/* Items List */}
          <div className="space-y-4">
            {items?.map((item) => (
              <div key={item?.id} className="flex items-start space-x-4 p-4 bg-muted/30 rounded-lg">
                {/* Item Image */}
                <div className="flex-shrink-0">
                  <AppImage
                    src={item?.image}
                    alt={item?.imageAlt}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                </div>

                {/* Item Details */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-body font-semibold text-foreground mb-1">
                    {item?.name}
                  </h3>
                  
                  {/* Customizations */}
                  {item?.customizations && item?.customizations?.length > 0 && (
                    <div className="mb-2">
                      <p className="font-caption text-xs text-muted-foreground mb-1">
                        Customizations:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {item?.customizations?.map((customization, index) => (
                          <span
                            key={index}
                            className="inline-block px-2 py-1 bg-primary/10 text-primary text-xs font-caption rounded-md"
                          >
                            {customization}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quantity and Price */}
                  <div className="flex items-center justify-between">
                    <span className="font-caption text-sm text-muted-foreground">
                      Qty: {item?.quantity}
                    </span>
                    <span className="font-body font-medium text-foreground">
                      ${(item?.price * item?.quantity)?.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Order Breakdown */}
          <div className="border-t border-border pt-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-body text-muted-foreground">Subtotal</span>
              <span className="font-body text-foreground">${subtotal?.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="font-body text-muted-foreground">Delivery Fee</span>
              <span className="font-body text-foreground">${deliveryFee?.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="font-body text-muted-foreground">Tax</span>
              <span className="font-body text-foreground">${tax?.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <span className="font-heading font-bold text-foreground">Total</span>
              <span className="font-heading font-bold text-lg text-primary">
                ${total?.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Special Instructions */}
          {specialInstructions && (
            <div className="border-t border-border pt-4">
              <div className="flex items-start space-x-3">
                <Icon name="MessageSquare" size={16} className="text-primary mt-0.5" />
                <div>
                  <p className="font-body font-medium text-foreground mb-1">
                    Special Instructions
                  </p>
                  <p className="font-caption text-sm text-muted-foreground">
                    {specialInstructions}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderSummaryCard;