import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const OrderActions = ({ 
  orderStatus = 'order_confirmed', 
  onContactSupport = null,
  onReorder = null,
  onOrderAgain = null,
  onCallDriver = null
}) => {
  const isOrderCompleted = orderStatus === 'completed';
  const isDeliveryInProgress = orderStatus === 'out_for_delivery';
  const canModifyOrder = ['order_confirmed', 'preparing']?.includes(orderStatus);

  const getActionsByStatus = () => {
    switch (orderStatus) {
      case 'order_confirmed': case'preparing':
        return [
          {
            id: 'modify',
            label: 'Modify Order',
            icon: 'Edit3',
            variant: 'outline',
            description: 'Request changes to your order',
            disabled: !canModifyOrder,
            onClick: onContactSupport
          },
          {
            id: 'cancel',
            label: 'Cancel Order',
            icon: 'X',
            variant: 'outline',
            description: 'Cancel this order',
            onClick: onContactSupport
          }
        ];
      
      case 'ready_pickup':
        return [
          {
            id: 'directions',
            label: 'Get Directions',
            icon: 'Navigation',
            variant: 'default',
            description: 'Navigate to restaurant',
            onClick: () => {
              // In real app, would open maps with restaurant location
              alert('Opening directions to restaurant...');
            }
          }
        ];
      
      case 'out_for_delivery':
        return [
          {
            id: 'call_driver',
            label: 'Call Driver',
            icon: 'Phone',
            variant: 'default',
            description: 'Contact your delivery driver',
            onClick: onCallDriver
          },
          {
            id: 'delivery_instructions',
            label: 'Update Instructions',
            icon: 'MessageSquare',
            variant: 'outline',
            description: 'Modify delivery instructions',
            onClick: onContactSupport
          }
        ];
      
      case 'completed':
        return [
          {
            id: 'reorder',
            label: 'Reorder',
            icon: 'RotateCcw',
            variant: 'default',
            description: 'Order the same items again',
            onClick: onReorder
          },
          {
            id: 'rate',
            label: 'Rate Order',
            icon: 'Star',
            variant: 'outline',
            description: 'Share your experience',
            onClick: () => {
              // In real app, would open rating modal
              alert('Opening rating form...');
            }
          }
        ];
      
      default:
        return [];
    }
  };

  const primaryActions = getActionsByStatus();
  
  // Always available actions
  const secondaryActions = [
    {
      id: 'support',
      label: 'Contact Support',
      icon: 'MessageCircle',
      variant: 'outline',
      description: 'Get help with your order',
      onClick: onContactSupport
    },
    {
      id: 'receipt',
      label: 'View Receipt',
      icon: 'Receipt',
      variant: 'outline',
      description: 'Download order receipt',
      onClick: () => {
        // In real app, would generate/download receipt
        alert('Generating receipt...');
      }
    }
  ];

  if (isOrderCompleted && onOrderAgain) {
    secondaryActions?.unshift({
      id: 'order_again',
      label: 'Order Again',
      icon: 'Plus',
      variant: 'outline',
      description: 'Browse menu to order',
      onClick: onOrderAgain
    });
  }

  return (
    <div className="bg-card rounded-xl shadow-warm border border-border p-6">
      <div className="flex items-center space-x-3 mb-6">
        <Icon name="Settings" size={24} className="text-primary" />
        <div>
          <h2 className="font-heading font-bold text-lg text-foreground">
            Order Actions
          </h2>
          <p className="font-caption text-sm text-muted-foreground">
            Manage your order
          </p>
        </div>
      </div>

      {/* Primary Actions */}
      {primaryActions?.length > 0 && (
        <div className="space-y-3 mb-6">
          <h3 className="font-body font-semibold text-foreground text-sm">
            Quick Actions
          </h3>
          {primaryActions?.map((action) => (
            <Button
              key={action?.id}
              onClick={action?.onClick}
              variant={action?.variant}
              disabled={action?.disabled}
              fullWidth
              iconName={action?.icon}
              iconPosition="left"
              className="justify-start"
            >
              <div className="flex-1 text-left">
                <div className="font-body font-medium">{action?.label}</div>
                <div className="font-caption text-xs text-muted-foreground mt-0.5">
                  {action?.description}
                </div>
              </div>
            </Button>
          ))}
        </div>
      )}

      {/* Secondary Actions */}
      <div className="space-y-3">
        <h3 className="font-body font-semibold text-foreground text-sm">
          More Options
        </h3>
        {secondaryActions?.map((action) => (
          <Button
            key={action?.id}
            onClick={action?.onClick}
            variant={action?.variant}
            fullWidth
            iconName={action?.icon}
            iconPosition="left"
            className="justify-start"
          >
            <div className="flex-1 text-left">
              <div className="font-body font-medium">{action?.label}</div>
              <div className="font-caption text-xs text-muted-foreground mt-0.5">
                {action?.description}
              </div>
            </div>
          </Button>
        ))}
      </div>

      {/* Emergency Contact */}
      <div className="mt-6 pt-4 border-t border-border">
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Icon name="AlertTriangle" size={16} className="text-red-600 mt-0.5" />
            <div>
              <h4 className="font-body font-semibold text-red-900 dark:text-red-100 text-sm mb-1">
                Need Immediate Help?
              </h4>
              <p className="font-caption text-xs text-red-700 dark:text-red-300 mb-3">
                For urgent issues with your order, contact us directly.
              </p>
              <div className="flex items-center space-x-4">
                <Button
                  onClick={() => window.open('tel:(555)123-HELP', '_self')}
                  variant="outline"
                  size="sm"
                  iconName="Phone"
                  iconPosition="left"
                  className="border-red-200 text-red-600 hover:bg-red-50"
                >
                  Call Now
                </Button>
                <span className="font-caption text-xs text-red-600">
                  (555) 123-HELP
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Order Status Information */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between text-sm">
          <span className="font-body text-muted-foreground">Current Status:</span>
          <span className="font-body font-medium text-primary capitalize">
            {orderStatus?.replace('_', ' ')}
          </span>
        </div>
        
        {/* Status-specific messages */}
        {orderStatus === 'preparing' && (
          <p className="font-caption text-xs text-muted-foreground mt-2">
            Changes to your order may not be possible once preparation begins.
          </p>
        )}
        
        {orderStatus === 'out_for_delivery' && (
          <p className="font-caption text-xs text-muted-foreground mt-2">
            Your driver will contact you if they need assistance finding your location.
          </p>
        )}
        
        {orderStatus === 'completed' && (
          <p className="font-caption text-xs text-muted-foreground mt-2">
            Thank you for your order! We hope you enjoyed your meal.
          </p>
        )}
      </div>
    </div>
  );
};

export default OrderActions;