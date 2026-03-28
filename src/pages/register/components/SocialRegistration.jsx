import React, { useState } from 'react';

import Icon from '../../../components/AppIcon';

const SocialRegistration = ({ onSocialRegister }) => {
  const [isLoading, setIsLoading] = useState({
    google: false,
    facebook: false,
    apple: false
  });

  const handleSocialRegister = async (provider) => {
    setIsLoading(prev => ({ ...prev, [provider]: true }));

    try {
      // Simulate social registration API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock successful social registration
      const mockUser = {
        id: Date.now(),
        name: provider === 'google' ? 'John Smith' : 
              provider === 'facebook' ? 'Sarah Johnson' : 'Mike Wilson',
        email: provider === 'google' ? 'john.smith@gmail.com' : 
               provider === 'facebook' ? 'sarah.johnson@facebook.com' : 'mike.wilson@icloud.com',
        provider: provider,
        avatar: `https://randomuser.me/api/portraits/${provider === 'facebook' ? 'women' : 'men'}/${Math.floor(Math.random() * 50) + 1}.jpg`,
        avatarAlt: `Professional headshot of ${provider === 'facebook' ? 'woman' : 'man'} with friendly smile`,
        createdAt: new Date()?.toISOString()
      };

      if (onSocialRegister) {
        onSocialRegister(mockUser, provider);
      }
    } catch (error) {
      console.error(`${provider} registration failed:`, error);
    } finally {
      setIsLoading(prev => ({ ...prev, [provider]: false }));
    }
  };

  const socialProviders = [
    {
      id: 'google',
      name: 'Google',
      icon: 'Chrome',
      bgColor: 'bg-white hover:bg-gray-50',
      textColor: 'text-gray-700',
      borderColor: 'border-gray-300'
    },
    {
      id: 'facebook',
      name: 'Facebook',
      icon: 'Facebook',
      bgColor: 'bg-blue-600 hover:bg-blue-700',
      textColor: 'text-white',
      borderColor: 'border-blue-600'
    },
    {
      id: 'apple',
      name: 'Apple',
      icon: 'Apple',
      bgColor: 'bg-black hover:bg-gray-900',
      textColor: 'text-white',
      borderColor: 'border-black'
    }
  ];

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-card text-muted-foreground font-medium">
            Or continue with
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {socialProviders?.map((provider) => (
          <button
            key={provider?.id}
            onClick={() => handleSocialRegister(provider?.id)}
            disabled={isLoading?.[provider?.id]}
            className={`
              flex items-center justify-center space-x-2 px-4 py-3 rounded-lg border transition-all duration-200
              ${provider?.bgColor} ${provider?.textColor} ${provider?.borderColor}
              disabled:opacity-50 disabled:cursor-not-allowed
              hover:scale-102 hover:shadow-warm-sm
              focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2
            `}
          >
            {isLoading?.[provider?.id] ? (
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Icon name={provider?.icon} size={20} />
            )}
            <span className="font-medium text-sm hidden sm:block">
              {provider?.name}
            </span>
            <span className="font-medium text-sm sm:hidden">
              {isLoading?.[provider?.id] ? 'Connecting...' : provider?.name}
            </span>
          </button>
        ))}
      </div>
      <div className="text-center">
        <p className="text-xs text-muted-foreground leading-relaxed">
          By continuing with social registration, you agree to our{' '}
          <button className="text-primary hover:text-primary/80 transition-colors duration-200">
            Terms of Service
          </button>{' '}
          and{' '}
          <button className="text-primary hover:text-primary/80 transition-colors duration-200">
            Privacy Policy
          </button>
        </p>
      </div>
    </div>
  );
};

export default SocialRegistration;