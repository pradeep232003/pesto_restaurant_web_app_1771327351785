import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const OrderDetails = ({ orderData = null, onCallRestaurant = null }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!orderData) return null;

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString)?.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getDeliveryTypeLabel = () => {
    return orderData?.delivery?.type === 'delivery' ? 'Delivery' : 'Pickup';
  };

  return (
    <div className="bg-card rounded-xl shadow-warm border border-border overflow-hidden">
      {/* Header */}
      <div 
        className="p-6 cursor-pointer hover:bg-muted/50 transition-colors duration-200"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Icon name="FileText" size={24} className="text-primary" />
            <div>
              <h2 className="font-heading font-bold text-lg text-foreground">
                Order Details
              </h2>
              <p className="font-caption text-sm text-muted-foreground">
                Order {orderData?.id}
              </p>
            </div>
          </div>

          <Icon 
            name={isExpanded ? "ChevronUp" : "ChevronDown"} 
            size={20} 
            className="text-muted-foreground transition-transform duration-200" 
          />
        </div>
      </div>

      {/* Quick Info (Always Visible) */}
      <div className="px-6 pb-4 space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <Icon name="Calendar" size={16} className="text-muted-foreground" />
            <div>
              <p className="font-caption text-xs text-muted-foreground">Order Date</p>
              <p className="font-body text-sm text-foreground">
                {new Date(orderData?.orderDate)?.toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Icon name={orderData?.delivery?.type === 'delivery' ? "Truck" : "Store"} size={16} className="text-muted-foreground" />
            <div>
              <p className="font-caption text-xs text-muted-foreground">Type</p>
              <p className="font-body text-sm text-foreground">
                {getDeliveryTypeLabel()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Expandable Content */}
      <div className={`transition-all duration-300 ease-in-out ${
        isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
      } overflow-hidden`}>
        <div className="px-6 pb-6 space-y-6">
          {/* Restaurant Information */}
          <div className="border-t border-border pt-4">
            <h3 className="font-heading font-semibold text-foreground mb-3">
              Restaurant Information
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Icon name="Store" size={16} className="text-primary" />
                  <div>
                    <p className="font-body font-medium text-foreground">
                      {orderData?.restaurant?.name}
                    </p>
                    <p className="font-caption text-sm text-muted-foreground">
                      {orderData?.restaurant?.address}
                    </p>
                  </div>
                </div>
                
                {onCallRestaurant && (
                  <Button
                    onClick={onCallRestaurant}
                    variant="outline"
                    size="sm"
                    iconName="Phone"
                    iconPosition="left"
                  >
                    Call
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Timing Information */}
          <div className="border-t border-border pt-4">
            <h3 className="font-heading font-semibold text-foreground mb-3">
              Timing Information
            </h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Icon name="Clock" size={16} className="text-primary" />
                <div className="flex-1">
                  <p className="font-body text-foreground">Order Placed</p>
                  <p className="font-caption text-sm text-muted-foreground">
                    {formatDate(orderData?.orderDate)}
                  </p>
                </div>
              </div>

              {orderData?.estimatedDelivery && (
                <div className="flex items-center space-x-3">
                  <Icon name="Truck" size={16} className="text-primary" />
                  <div className="flex-1">
                    <p className="font-body text-foreground">Estimated Delivery</p>
                    <p className="font-caption text-sm text-muted-foreground">
                      {formatDate(orderData?.estimatedDelivery)}
                    </p>
                  </div>
                </div>
              )}

              {orderData?.actualDelivery && (
                <div className="flex items-center space-x-3">
                  <Icon name="CheckCircle" size={16} className="text-green-600" />
                  <div className="flex-1">
                    <p className="font-body text-foreground">Delivered At</p>
                    <p className="font-caption text-sm text-muted-foreground">
                      {formatDate(orderData?.actualDelivery)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Delivery Information */}
          {orderData?.delivery?.type === 'delivery' && orderData?.delivery?.address && (
            <div className="border-t border-border pt-4">
              <h3 className="font-heading font-semibold text-foreground mb-3">
                Delivery Address
              </h3>
              <div className="flex items-start space-x-3">
                <Icon name="MapPin" size={16} className="text-primary mt-0.5" />
                <div className="flex-1">
                  <p className="font-body text-foreground">
                    {orderData?.delivery?.address?.street}
                    {orderData?.delivery?.address?.apartment && 
                      `, ${orderData?.delivery?.address?.apartment}`
                    }
                  </p>
                  <p className="font-caption text-sm text-muted-foreground">
                    {orderData?.delivery?.address?.city}, {orderData?.delivery?.address?.state} {orderData?.delivery?.address?.zipCode}
                  </p>
                  
                  {orderData?.delivery?.address?.instructions && (
                    <div className="mt-2 p-3 bg-muted rounded-lg">
                      <p className="font-caption text-xs text-muted-foreground">
                        <strong>Delivery Instructions:</strong>
                      </p>
                      <p className="font-caption text-sm text-foreground mt-1">
                        {orderData?.delivery?.address?.instructions}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Payment Information */}
          <div className="border-t border-border pt-4">
            <h3 className="font-heading font-semibold text-foreground mb-3">
              Payment Method
            </h3>
            <div className="flex items-center space-x-3">
              <Icon name="CreditCard" size={16} className="text-primary" />
              <div>
                <p className="font-body text-foreground">
                  {orderData?.paymentMethod?.brand} •••• {orderData?.paymentMethod?.lastFour}
                </p>
                <p className="font-caption text-sm text-muted-foreground">
                  Total charged: ${orderData?.total?.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Additional Information */}
          {orderData?.specialInstructions && (
            <div className="border-t border-border pt-4">
              <h3 className="font-heading font-semibold text-foreground mb-3">
                Special Instructions
              </h3>
              <div className="flex items-start space-x-3">
                <Icon name="MessageSquare" size={16} className="text-primary mt-0.5" />
                <div className="bg-muted rounded-lg p-3 flex-1">
                  <p className="font-body text-foreground">
                    {orderData?.specialInstructions}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Order Status History */}
          <div className="border-t border-border pt-4">
            <h3 className="font-heading font-semibold text-foreground mb-3">
              Status History
            </h3>
            <div className="space-y-2">
              {orderData?.timeline?.filter(item => item?.completed)?.map((item, index) => (
                <div key={item?.status} className="flex items-center space-x-3">
                  <Icon name="CheckCircle" size={14} className="text-green-600" />
                  <div className="flex-1 flex justify-between items-center">
                    <span className="font-body text-sm text-foreground">
                      {item?.title}
                    </span>
                    {item?.timestamp && (
                      <span className="font-caption text-xs text-muted-foreground">
                        {new Date(item?.timestamp)?.toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetails;