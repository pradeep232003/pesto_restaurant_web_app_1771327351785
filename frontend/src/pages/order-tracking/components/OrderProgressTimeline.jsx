import React from 'react';
import Icon from '../../../components/AppIcon';

const OrderProgressTimeline = ({ timeline = [], currentStatus = 'order_confirmed' }) => {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'order_confirmed':
        return 'CheckCircle';
      case 'preparing':
        return 'ChefHat';
      case 'ready_pickup':
        return 'Package';
      case 'out_for_delivery':
        return 'Truck';
      case 'completed':
        return 'CheckCircle2';
      default:
        return 'Clock';
    }
  };

  const getTimelineItemClass = (item) => {
    if (item?.completed && item?.active) {
      return {
        container: 'bg-primary/10 border-primary',
        icon: 'bg-primary text-primary-foreground',
        title: 'text-primary',
        description: 'text-primary/80',
        line: 'bg-primary'
      };
    } else if (item?.completed) {
      return {
        container: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
        icon: 'bg-green-600 text-white',
        title: 'text-green-900 dark:text-green-100',
        description: 'text-green-700 dark:text-green-300',
        line: 'bg-green-600'
      };
    } else {
      return {
        container: 'bg-muted border-border',
        icon: 'bg-muted-foreground/20 text-muted-foreground',
        title: 'text-muted-foreground',
        description: 'text-muted-foreground/70',
        line: 'bg-muted-foreground/20'
      };
    }
  };

  return (
    <div className="bg-card rounded-xl shadow-warm border border-border p-6">
      <div className="flex items-center space-x-3 mb-6">
        <Icon name="Clock" size={24} className="text-primary" />
        <h2 className="font-heading font-bold text-xl text-foreground">
          Order Progress
        </h2>
      </div>
      {/* Mobile Timeline (Vertical) */}
      <div className="md:hidden space-y-4">
        {timeline?.map((item, index) => {
          const styles = getTimelineItemClass(item);
          const isLast = index === timeline?.length - 1;

          return (
            <div key={item?.status} className="relative">
              <div className={`rounded-lg border p-4 transition-all duration-300 ${styles?.container}`}>
                <div className="flex items-start space-x-4">
                  <div className={`rounded-full p-2 transition-all duration-300 ${styles?.icon}`}>
                    <Icon name={getStatusIcon(item?.status)} size={20} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-body font-semibold transition-colors duration-300 ${styles?.title}`}>
                      {item?.title}
                    </h3>
                    <p className={`font-caption text-sm mt-1 transition-colors duration-300 ${styles?.description}`}>
                      {item?.description}
                    </p>
                    {item?.timestamp && (
                      <p className="font-caption text-xs text-muted-foreground mt-2">
                        {new Date(item.timestamp)?.toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </p>
                    )}
                  </div>

                  {item?.completed && (
                    <div className="flex-shrink-0">
                      <Icon name="Check" size={16} className="text-green-600" />
                    </div>
                  )}
                </div>
              </div>
              {/* Connecting Line */}
              {!isLast && (
                <div className="flex justify-start ml-6 mt-2 mb-2">
                  <div className={`w-0.5 h-6 transition-colors duration-300 ${styles?.line}`}></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Desktop Timeline (Horizontal) */}
      <div className="hidden md:block">
        <div className="relative">
          {/* Progress Line */}
          <div className="absolute top-6 left-0 right-0 h-1 bg-muted rounded-full">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${(timeline?.filter(item => item?.completed)?.length / timeline?.length) * 100}%`
              }}
            ></div>
          </div>

          {/* Timeline Items */}
          <div className="relative flex justify-between">
            {timeline?.map((item, index) => {
              const styles = getTimelineItemClass(item);

              return (
                <div key={item?.status} className="flex flex-col items-center text-center max-w-[140px]">
                  {/* Icon Circle */}
                  <div className={`relative z-10 rounded-full p-3 transition-all duration-300 ${styles?.icon} mb-4`}>
                    <Icon name={getStatusIcon(item?.status)} size={20} />
                  </div>
                  {/* Content */}
                  <div className="space-y-2">
                    <h3 className={`font-body font-semibold text-sm transition-colors duration-300 ${styles?.title}`}>
                      {item?.title}
                    </h3>
                    <p className={`font-caption text-xs transition-colors duration-300 ${styles?.description}`}>
                      {item?.description}
                    </p>
                    {item?.timestamp && (
                      <p className="font-caption text-xs text-muted-foreground">
                        {new Date(item.timestamp)?.toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </p>
                    )}
                  </div>
                  {/* Active Indicator */}
                  {item?.active && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-pulse"></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* Current Status Summary */}
      <div className="mt-6 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
            <span className="font-body text-foreground">
              Current Status: <span className="font-semibold text-primary">
                {timeline?.find(item => item?.active)?.title || 'Processing'}
              </span>
            </span>
          </div>
          
          <div className="text-right">
            <p className="font-caption text-xs text-muted-foreground">
              Last Updated: {new Date()?.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderProgressTimeline;