import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';

const PreferencesSection = ({ preferences, onUpdatePreferences }) => {
  const [localPreferences, setLocalPreferences] = useState(preferences);
  const [hasChanges, setHasChanges] = useState(false);

  const dietaryOptions = [
    { id: 'vegetarian', label: 'Vegetarian', description: 'No meat or fish' },
    { id: 'vegan', label: 'Vegan', description: 'No animal products' },
    { id: 'glutenFree', label: 'Gluten-Free', description: 'No gluten-containing ingredients' },
    { id: 'dairyFree', label: 'Dairy-Free', description: 'No dairy products' },
    { id: 'nutFree', label: 'Nut-Free', description: 'No nuts or nut products' },
    { id: 'lowSodium', label: 'Low Sodium', description: 'Reduced salt content' }
  ];

  const notificationOptions = [
    { id: 'orderUpdates', label: 'Order Updates', description: 'Get notified about order status changes' },
    { id: 'promotions', label: 'Promotions & Deals', description: 'Receive special offers and discounts' },
    { id: 'newMenuItems', label: 'New Menu Items', description: 'Be the first to know about new dishes' },
    { id: 'emailNewsletter', label: 'Email Newsletter', description: 'Weekly newsletter with recipes and tips' },
    { id: 'smsNotifications', label: 'SMS Notifications', description: 'Text messages for urgent updates' }
  ];

  const spiceLevels = [
    { value: 'none', label: 'No Spice', description: 'Mild and gentle flavors' },
    { value: 'mild', label: 'Mild', description: 'Slightly spicy' },
    { value: 'medium', label: 'Medium', description: 'Moderately spicy' },
    { value: 'hot', label: 'Hot', description: 'Very spicy' },
    { value: 'extra-hot', label: 'Extra Hot', description: 'Extremely spicy' }
  ];

  const handleDietaryChange = (optionId, checked) => {
    const updatedDietary = checked 
      ? [...localPreferences?.dietary, optionId]
      : localPreferences?.dietary?.filter(id => id !== optionId);
    
    setLocalPreferences(prev => ({
      ...prev,
      dietary: updatedDietary
    }));
    setHasChanges(true);
  };

  const handleNotificationChange = (optionId, checked) => {
    setLocalPreferences(prev => ({
      ...prev,
      notifications: {
        ...prev?.notifications,
        [optionId]: checked
      }
    }));
    setHasChanges(true);
  };

  const handleSpiceLevelChange = (level) => {
    setLocalPreferences(prev => ({
      ...prev,
      spiceLevel: level
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onUpdatePreferences(localPreferences);
    setHasChanges(false);
  };

  const handleReset = () => {
    setLocalPreferences(preferences);
    setHasChanges(false);
  };

  return (
    <div className="bg-card rounded-lg border border-border shadow-warm p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
            <Icon name="Settings" size={24} color="white" />
          </div>
          <div>
            <h2 className="text-xl font-heading font-bold text-foreground">Preferences</h2>
            <p className="text-sm font-body text-muted-foreground">Customize your dining experience</p>
          </div>
        </div>
        {hasChanges && (
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              iconName="RotateCcw"
              iconPosition="left"
              onClick={handleReset}
            >
              Reset
            </Button>
            <Button
              variant="default"
              size="sm"
              iconName="Check"
              iconPosition="left"
              onClick={handleSave}
            >
              Save Changes
            </Button>
          </div>
        )}
      </div>
      <div className="space-y-8">
        {/* Dietary Restrictions */}
        <div>
          <h3 className="text-lg font-body font-medium text-foreground mb-4 flex items-center space-x-2">
            <Icon name="Leaf" size={20} className="text-primary" />
            <span>Dietary Restrictions</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dietaryOptions?.map((option) => (
              <div key={option?.id} className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors duration-200">
                <Checkbox
                  checked={localPreferences?.dietary?.includes(option?.id)}
                  onChange={(e) => handleDietaryChange(option?.id, e?.target?.checked)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <label className="text-sm font-body font-medium text-foreground cursor-pointer">
                    {option?.label}
                  </label>
                  <p className="text-xs font-body text-muted-foreground mt-1">
                    {option?.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Spice Level Preference */}
        <div>
          <h3 className="text-lg font-body font-medium text-foreground mb-4 flex items-center space-x-2">
            <Icon name="Flame" size={20} className="text-primary" />
            <span>Preferred Spice Level</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {spiceLevels?.map((level) => (
              <button
                key={level?.value}
                onClick={() => handleSpiceLevelChange(level?.value)}
                className={`p-3 rounded-lg border text-left transition-all duration-200 hover:shadow-warm-sm ${
                  localPreferences?.spiceLevel === level?.value
                    ? 'border-primary bg-primary/10 text-primary' :'border-border bg-background text-foreground hover:border-primary/50'
                }`}
              >
                <div className="text-sm font-body font-medium mb-1">{level?.label}</div>
                <div className="text-xs font-body text-muted-foreground">{level?.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Notification Preferences */}
        <div>
          <h3 className="text-lg font-body font-medium text-foreground mb-4 flex items-center space-x-2">
            <Icon name="Bell" size={20} className="text-primary" />
            <span>Notification Preferences</span>
          </h3>
          <div className="space-y-3">
            {notificationOptions?.map((option) => (
              <div key={option?.id} className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors duration-200">
                <Checkbox
                  checked={localPreferences?.notifications?.[option?.id] || false}
                  onChange={(e) => handleNotificationChange(option?.id, e?.target?.checked)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <label className="text-sm font-body font-medium text-foreground cursor-pointer">
                    {option?.label}
                  </label>
                  <p className="text-xs font-body text-muted-foreground mt-1">
                    {option?.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Favorite Cuisines */}
        <div>
          <h3 className="text-lg font-body font-medium text-foreground mb-4 flex items-center space-x-2">
            <Icon name="Heart" size={20} className="text-primary" />
            <span>Favorite Items</span>
          </h3>
          {localPreferences?.favoriteItems && localPreferences?.favoriteItems?.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {localPreferences?.favoriteItems?.map((item) => (
                <div key={item?.id} className="flex items-center space-x-3 p-3 rounded-lg border border-border bg-background">
                  <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                    <img
                      src={item?.image}
                      alt={item?.imageAlt}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-body font-medium text-foreground">{item?.name}</h4>
                    <p className="text-xs font-body text-muted-foreground">{item?.category}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconName="X"
                    onClick={() => {
                      const updatedFavorites = localPreferences?.favoriteItems?.filter(fav => fav?.id !== item?.id);
                      setLocalPreferences(prev => ({
                        ...prev,
                        favoriteItems: updatedFavorites
                      }));
                      setHasChanges(true);
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 border border-border rounded-lg bg-muted/20">
              <Icon name="Heart" size={32} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-body text-muted-foreground">
                No favorite items yet. Start exploring our menu to add favorites!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PreferencesSection;