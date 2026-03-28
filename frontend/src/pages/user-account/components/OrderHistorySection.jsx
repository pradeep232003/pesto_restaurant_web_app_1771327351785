import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Image from '../../../components/AppImage';

const OrderHistorySection = ({ orders, onReorder, onViewDetails }) => {
  const [expandedOrder, setExpandedOrder] = useState(null);

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'delivered':
        return 'text-success bg-success/10';
      case 'preparing':
        return 'text-warning bg-warning/10';
      case 'on the way':
        return 'text-primary bg-primary/10';
      case 'cancelled':
        return 'text-error bg-error/10';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'delivered':
        return 'CheckCircle';
      case 'preparing':
        return 'Clock';
      case 'on the way':
        return 'Truck';
      case 'cancelled':
        return 'XCircle';
      default:
        return 'Package';
    }
  };

  const toggleOrderExpansion = (orderId) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  const formatDate = (dateString) => {
    return new Date(dateString)?.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-card rounded-lg border border-border shadow-warm p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
          <Icon name="Package" size={24} color="white" />
        </div>
        <div>
          <h2 className="text-xl font-heading font-bold text-foreground">Order History</h2>
          <p className="text-sm font-body text-muted-foreground">View and reorder your past orders</p>
        </div>
      </div>
      {orders?.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon name="Package" size={32} className="text-muted-foreground" />
          </div>
          <h3 className="text-lg font-body font-medium text-foreground mb-2">No orders yet</h3>
          <p className="text-sm font-body text-muted-foreground mb-6">
            Start exploring our delicious menu to place your first order
          </p>
          <Button
            variant="default"
            iconName="UtensilsCrossed"
            iconPosition="left"
            onClick={() => window.location.href = '/menu-catalog'}
          >
            Browse Menu
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {orders?.map((order) => (
            <div key={order?.id} className="border border-border rounded-lg overflow-hidden">
              <div className="p-4 bg-background">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-base font-body font-medium text-foreground">
                      Order #{order?.id}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-body font-medium ${getStatusColor(order?.status)}`}>
                      <Icon name={getStatusIcon(order?.status)} size={12} className="inline mr-1" />
                      {order?.status}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-body text-muted-foreground">
                      {formatDate(order?.date)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      iconName={expandedOrder === order?.id ? "ChevronUp" : "ChevronDown"}
                      onClick={() => toggleOrderExpansion(order?.id)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex -space-x-2">
                      {order?.items?.slice(0, 3)?.map((item, index) => (
                        <div key={index} className="w-10 h-10 rounded-lg border-2 border-card overflow-hidden">
                          <Image
                            src={item?.image}
                            alt={item?.imageAlt}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                      {order?.items?.length > 3 && (
                        <div className="w-10 h-10 rounded-lg border-2 border-card bg-muted flex items-center justify-center">
                          <span className="text-xs font-body font-medium text-muted-foreground">
                            +{order?.items?.length - 3}
                          </span>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-body text-muted-foreground">
                        {order?.items?.length} item{order?.items?.length !== 1 ? 's' : ''}
                      </p>
                      <p className="text-lg font-body font-bold text-foreground">
                        ${order?.total?.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {order?.status?.toLowerCase() === 'delivered' && (
                      <Button
                        variant="outline"
                        size="sm"
                        iconName="RotateCcw"
                        iconPosition="left"
                        onClick={() => onReorder(order)}
                      >
                        Reorder
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      iconName="Eye"
                      onClick={() => onViewDetails(order)}
                    >
                      Details
                    </Button>
                  </div>
                </div>
              </div>

              {/* Expanded Order Details */}
              {expandedOrder === order?.id && (
                <div className="border-t border-border p-4 bg-card">
                  <div className="space-y-3">
                    <h4 className="text-sm font-body font-medium text-foreground mb-3">Order Items</h4>
                    {order?.items?.map((item, index) => (
                      <div key={index} className="flex items-center space-x-3 py-2">
                        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                          <Image
                            src={item?.image}
                            alt={item?.imageAlt}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <h5 className="text-sm font-body font-medium text-foreground">{item?.name}</h5>
                          {item?.customizations && item?.customizations?.length > 0 && (
                            <p className="text-xs font-body text-muted-foreground">
                              {item?.customizations?.join(', ')}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-body text-muted-foreground">Qty: {item?.quantity}</p>
                          <p className="text-sm font-body font-medium text-foreground">
                            ${(item?.price * item?.quantity)?.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}

                    <div className="border-t border-border pt-3 mt-3">
                      <div className="flex justify-between items-center text-sm font-body">
                        <span className="text-muted-foreground">Subtotal:</span>
                        <span className="text-foreground">${order?.subtotal?.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm font-body">
                        <span className="text-muted-foreground">Delivery Fee:</span>
                        <span className="text-foreground">${order?.deliveryFee?.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm font-body">
                        <span className="text-muted-foreground">Tax:</span>
                        <span className="text-foreground">${order?.tax?.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-base font-body font-bold border-t border-border pt-2 mt-2">
                        <span className="text-foreground">Total:</span>
                        <span className="text-foreground">${order?.total?.toFixed(2)}</span>
                      </div>
                    </div>

                    {order?.deliveryAddress && (
                      <div className="border-t border-border pt-3 mt-3">
                        <h5 className="text-sm font-body font-medium text-foreground mb-1">Delivery Address</h5>
                        <p className="text-sm font-body text-muted-foreground">
                          {order?.deliveryAddress?.street}<br />
                          {order?.deliveryAddress?.city}, {order?.deliveryAddress?.state} {order?.deliveryAddress?.zipCode}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrderHistorySection;