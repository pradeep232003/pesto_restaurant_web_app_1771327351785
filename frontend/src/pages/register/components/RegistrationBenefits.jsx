import React from 'react';
import Icon from '../../../components/AppIcon';

const RegistrationBenefits = () => {
  const benefits = [
    {
      id: 1,
      icon: 'ShoppingBag',
      title: 'Faster Ordering',
      description: 'Save your favorite items and delivery addresses for quick reordering'
    },
    {
      id: 2,
      icon: 'Truck',
      title: 'Order Tracking',
      description: 'Get real-time updates on your order status from kitchen to doorstep'
    },
    {
      id: 3,
      icon: 'Gift',
      title: 'Exclusive Offers',
      description: 'Access member-only deals, birthday rewards, and loyalty points'
    },
    {
      id: 4,
      icon: 'Clock',
      title: 'Order History',
      description: 'View past orders and easily reorder your favorite meals'
    },
    {
      id: 5,
      icon: 'Star',
      title: 'Personalized Experience',
      description: 'Get customized recommendations based on your preferences'
    },
    {
      id: 6,
      icon: 'Bell',
      title: 'Special Notifications',
      description: 'Be the first to know about new menu items and promotions'
    }
  ];

  return (
    <div className="bg-muted/50 rounded-xl p-6 lg:p-8">
      <div className="text-center mb-6">
        <h3 className="text-xl font-heading font-bold text-foreground mb-2">
          Why Create an Account?
        </h3>
        <p className="text-muted-foreground text-sm">
          Join thousands of satisfied customers and enjoy these exclusive benefits
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {benefits?.map((benefit) => (
          <div
            key={benefit?.id}
            className="flex items-start space-x-3 p-4 bg-card rounded-lg shadow-warm-sm hover:shadow-warm transition-all duration-200 hover:scale-102"
          >
            <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Icon name={benefit?.icon} size={20} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-body font-medium text-foreground text-sm mb-1">
                {benefit?.title}
              </h4>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {benefit?.description}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 p-4 bg-accent/10 border border-accent/20 rounded-lg">
        <div className="flex items-center space-x-2 mb-2">
          <Icon name="Zap" size={16} className="text-accent" />
          <span className="font-body font-medium text-accent text-sm">
            Limited Time Offer
          </span>
        </div>
        <p className="text-foreground text-sm">
          Sign up today and get <span className="font-bold text-accent">20% off</span> your first order!
        </p>
      </div>
    </div>
  );
};

export default RegistrationBenefits;