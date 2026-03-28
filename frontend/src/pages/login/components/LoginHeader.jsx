import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';

const LoginHeader = () => {
  const navigate = useNavigate();

  return (
    <div className="text-center space-y-6">
      {/* Logo */}
      <div className="flex justify-center">
        <button
          onClick={() => navigate('/home-landing')}
          className="flex items-center space-x-3 group"
        >
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform duration-200 shadow-warm">
            <Icon name="UtensilsCrossed" size={32} color="white" />
          </div>
          <div className="text-left">
            <h1 className="text-2xl font-heading font-bold text-primary">Pesto</h1>
            <p className="text-sm font-caption text-muted-foreground -mt-1">Restaurant</p>
          </div>
        </button>
      </div>

      {/* Welcome Message */}
      <div className="space-y-2">
        <h2 className="text-3xl font-heading font-bold text-foreground">
          Welcome Back
        </h2>
        <p className="text-lg font-body text-muted-foreground max-w-md mx-auto">
          Sign in to your account to access your order history and personalized recommendations
        </p>
      </div>

      {/* Benefits */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
        <div className="flex items-center space-x-2 text-sm font-body text-muted-foreground">
          <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center">
            <Icon name="Clock" size={16} className="text-accent" />
          </div>
          <span>Quick Reorder</span>
        </div>
        <div className="flex items-center space-x-2 text-sm font-body text-muted-foreground">
          <div className="w-8 h-8 bg-success/20 rounded-full flex items-center justify-center">
            <Icon name="Heart" size={16} className="text-success" />
          </div>
          <span>Save Favorites</span>
        </div>
        <div className="flex items-center space-x-2 text-sm font-body text-muted-foreground">
          <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
            <Icon name="Gift" size={16} className="text-primary" />
          </div>
          <span>Exclusive Offers</span>
        </div>
      </div>
    </div>
  );
};

export default LoginHeader;