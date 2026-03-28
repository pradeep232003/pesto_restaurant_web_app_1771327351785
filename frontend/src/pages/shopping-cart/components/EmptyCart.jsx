import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

const EmptyCart = () => {
  const navigate = useNavigate();

  const handleBrowseMenu = () => {
    navigate('/menu-catalog');
  };

  return (
    <div className="text-center py-16 px-4">
      <div className="max-w-md mx-auto">
        {/* Empty Cart Icon */}
        <div className="w-24 h-24 mx-auto mb-6 bg-muted rounded-full flex items-center justify-center">
          <Icon name="ShoppingCart" size={48} className="text-muted-foreground" />
        </div>

        {/* Empty State Content */}
        <h2 className="font-heading font-bold text-2xl text-foreground mb-4">
          Your cart is empty
        </h2>
        
        <p className="font-body text-muted-foreground mb-8 leading-relaxed">
          Looks like you haven't added any delicious items to your cart yet. 
          Browse our menu and discover amazing dishes waiting for you!
        </p>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            variant="default"
            size="lg"
            fullWidth
            onClick={handleBrowseMenu}
            iconName="UtensilsCrossed"
            iconPosition="left"
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Browse Menu
          </Button>
          
          <Button
            variant="outline"
            size="lg"
            fullWidth
            onClick={() => navigate('/home-landing')}
            iconName="Home"
            iconPosition="left"
          >
            Back to Home
          </Button>
        </div>

        {/* Popular Items Suggestion */}
        <div className="mt-12 p-6 bg-accent/10 rounded-lg border border-accent/20">
          <h3 className="font-heading font-bold text-lg text-foreground mb-3">
            Popular Items
          </h3>
          <p className="font-body text-sm text-muted-foreground mb-4">
            Try our customer favorites to get started
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center space-x-3 p-3 bg-card rounded-lg border border-border">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Icon name="Beef" size={20} className="text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-body font-medium text-foreground text-sm">Classic Burger</p>
                <p className="font-body text-xs text-muted-foreground">$12.99</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 p-3 bg-card rounded-lg border border-border">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Icon name="Pizza" size={20} className="text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-body font-medium text-foreground text-sm">Margherita Pizza</p>
                <p className="font-body text-xs text-muted-foreground">$16.99</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmptyCart;