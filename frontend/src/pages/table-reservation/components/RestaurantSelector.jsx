import React from 'react';
import Icon from '../../../components/AppIcon';

const RestaurantSelector = ({ restaurants, onSelect }) => {
  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-2xl lg:text-3xl font-heading font-bold text-foreground mb-2">
          Choose Your Location
        </h2>
        <p className="text-muted-foreground">
          Select from our six beautiful Jollys Kafe locations
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 gap-6">
        {restaurants?.map((restaurant) => (
          <div
            key={restaurant?.id}
            className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-warm-lg transition-all duration-300 cursor-pointer group"
            onClick={() => onSelect?.(restaurant)}
          >
            {/* Restaurant Image */}
            <div className="relative h-48 overflow-hidden">
              <img
                src={restaurant?.image}
                alt={restaurant?.imageAlt}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black bg-opacity-20 group-hover:bg-opacity-10 transition-opacity duration-300" />
              <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1">
                <span className="text-sm font-body font-medium text-foreground">
                  {restaurant?.capacity} seats
                </span>
              </div>
            </div>

            {/* Restaurant Info */}
            <div className="p-6">
              <h3 className="text-xl font-heading font-bold text-foreground mb-2">
                {restaurant?.name}
              </h3>
              
              <div className="space-y-3 mb-4">
                <div className="flex items-start space-x-2">
                  <Icon name="MapPin" size={16} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    {restaurant?.address}
                  </p>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Icon name="Clock" size={16} className="text-muted-foreground flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    {restaurant?.hours}
                  </p>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Icon name="Phone" size={16} className="text-muted-foreground flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    {restaurant?.phone}
                  </p>
                </div>
              </div>

              {/* Features */}
              <div className="mb-4">
                <div className="flex flex-wrap gap-2">
                  {restaurant?.features?.map((feature) => (
                    <span
                      key={feature}
                      className="inline-flex items-center px-2.5 py-1 bg-muted rounded-full text-xs font-body font-medium text-muted-foreground"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>

              {/* Select Button */}
              <button className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-body font-medium hover:bg-primary/90 transition-all duration-200 group-hover:scale-[1.02] flex items-center justify-center space-x-2">
                <span>Select This Location</span>
                <Icon name="ArrowRight" size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Additional Info */}
      <div className="mt-8 p-6 bg-muted rounded-xl">
        <div className="flex items-start space-x-3">
          <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center flex-shrink-0">
            <Icon name="Info" size={20} color="#4C1D0A" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-foreground mb-2">
              Reservation Information
            </h3>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>• Reservations can be made up to 30 days in advance</p>
              <p>• Large parties (8+ guests) may require a deposit</p>
              <p>• Cancellations must be made at least 2 hours in advance</p>
              <p>• Special dietary requirements can be noted in your reservation</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RestaurantSelector;