import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import AppImage from '../../../components/AppImage';

const DeliveryTracking = ({ 
  driver = null, 
  trackingLocation = null, 
  deliveryAddress = null,
  onCallDriver = null 
}) => {
  const [mapUrl, setMapUrl] = useState('');
  const [estimatedDistance, setEstimatedDistance] = useState('0.8 miles');
  const [estimatedTime, setEstimatedTime] = useState('8 minutes');

  useEffect(() => {
    // Generate a mock map URL (in real app, would use Google Maps API)
    if (trackingLocation) {
      const { lat, lng } = trackingLocation;
      // Using a static map service for demo (replace with actual mapping service)
      const mockMapUrl = `https://images.unsplash.com/photo-1524661135-423995f22d0b?w=600&h=300&fit=crop&crop=center`;
      setMapUrl(mockMapUrl);
    }

    // Simulate real-time updates
    const interval = setInterval(() => {
      // Randomly update estimated time (simulate movement)
      const times = ['5 minutes', '6 minutes', '7 minutes', '8 minutes', '9 minutes'];
      const distances = ['0.6 miles', '0.7 miles', '0.8 miles', '0.9 miles'];
      
      setEstimatedTime(times?.[Math.floor(Math.random() * times?.length)]);
      setEstimatedDistance(distances?.[Math.floor(Math.random() * distances?.length)]);
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [trackingLocation]);

  if (!driver || !trackingLocation) {
    return null;
  }

  return (
    <div className="bg-card rounded-xl shadow-warm border border-border overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Icon name="MapPin" size={24} className="text-primary" />
            <div>
              <h2 className="font-heading font-bold text-lg text-foreground">
                Live Tracking
              </h2>
              <p className="font-caption text-sm text-muted-foreground">
                Your order is on the way!
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="font-caption text-xs text-green-600 font-medium">
              Live
            </span>
          </div>
        </div>

        {/* Estimated Arrival */}
        <div className="bg-primary/10 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Icon name="Clock" size={20} className="text-primary" />
              <div>
                <p className="font-body font-semibold text-foreground">
                  Estimated Arrival
                </p>
                <p className="font-caption text-sm text-muted-foreground">
                  {estimatedDistance} away
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-heading font-bold text-xl text-primary">
                {estimatedTime}
              </p>
              <p className="font-caption text-xs text-muted-foreground">
                remaining
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Map Section */}
      <div className="relative h-48 bg-muted">
        {mapUrl ? (
          <AppImage
            src={mapUrl}
            alt="Delivery tracking map showing driver location and route"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Icon name="Map" size={48} className="text-muted-foreground mb-2 mx-auto" />
              <p className="font-body text-muted-foreground">Loading map...</p>
            </div>
          </div>
        )}
        
        {/* Map Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent">
          {/* Current Location Marker */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="relative">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg animate-bounce">
                <Icon name="Truck" size={16} color="white" />
              </div>
              {/* Pulse Animation */}
              <div className="absolute inset-0 bg-primary rounded-full animate-ping opacity-75"></div>
            </div>
          </div>
          
          {/* Location Info */}
          <div className="absolute bottom-4 left-4 right-4">
            <div className="bg-white/90 dark:bg-black/90 backdrop-blur-sm rounded-lg p-3">
              <p className="font-body font-medium text-foreground text-sm">
                Current Location:
              </p>
              <p className="font-caption text-xs text-muted-foreground">
                {trackingLocation?.address || '5th Avenue & 42nd St'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Driver Information */}
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Driver Photo */}
            <div className="relative">
              <AppImage
                src={driver?.photo}
                alt={driver?.photoAlt}
                className="w-12 h-12 rounded-full object-cover"
              />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
            </div>

            {/* Driver Details */}
            <div>
              <p className="font-body font-semibold text-foreground">
                {driver?.name}
              </p>
              <div className="flex items-center space-x-2">
                <Icon name="Star" size={12} className="text-yellow-500" />
                <span className="font-caption text-xs text-muted-foreground">
                  {driver?.rating} • {driver?.vehicleType}
                </span>
              </div>
            </div>
          </div>

          {/* Call Driver Button */}
          {onCallDriver && (
            <Button
              onClick={onCallDriver}
              variant="outline"
              size="sm"
              iconName="Phone"
              iconPosition="left"
              className="flex-shrink-0"
            >
              Call
            </Button>
          )}
        </div>

        {/* Delivery Address */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-start space-x-3">
            <Icon name="Home" size={16} className="text-primary mt-0.5" />
            <div className="flex-1">
              <p className="font-body font-medium text-foreground mb-1">
                Delivery Address
              </p>
              <p className="font-caption text-sm text-muted-foreground">
                {deliveryAddress?.street}
                {deliveryAddress?.apartment && `, ${deliveryAddress?.apartment}`}
              </p>
              <p className="font-caption text-sm text-muted-foreground">
                {deliveryAddress?.city}, {deliveryAddress?.state} {deliveryAddress?.zipCode}
              </p>
              
              {/* Special Instructions */}
              {deliveryAddress?.instructions && (
                <div className="mt-2 p-2 bg-muted rounded-md">
                  <p className="font-caption text-xs text-muted-foreground">
                    <strong>Instructions:</strong> {deliveryAddress?.instructions}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeliveryTracking;