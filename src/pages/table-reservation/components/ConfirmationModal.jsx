import React from 'react';
import Icon from '../../../components/AppIcon';

const ConfirmationModal = ({ restaurant, date, time, reservationData, onClose }) => {
  const formatDate = (date) => {
    return date?.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const generateConfirmationNumber = () => {
    return `PST-${Math.random()?.toString(36)?.substr(2, 9)?.toUpperCase()}`;
  };

  const confirmationNumber = generateConfirmationNumber();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-2xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-warm-xl">
        {/* Success Icon */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-success rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon name="Check" size={24} color="white" />
          </div>
          <h2 className="text-2xl font-heading font-bold text-foreground mb-2">
            Reservation Confirmed!
          </h2>
          <p className="text-muted-foreground">
            We're excited to welcome you to Pesto
          </p>
        </div>

        {/* Confirmation Details */}
        <div className="space-y-4 mb-6">
          <div className="p-4 bg-muted rounded-lg">
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-1">Confirmation Number</div>
              <div className="text-lg font-heading font-bold text-foreground font-mono">
                {confirmationNumber}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Restaurant</span>
              <span className="font-medium text-foreground">{restaurant?.name}</span>
            </div>
            
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium text-foreground">{formatDate(date)}</span>
            </div>
            
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Time</span>
              <span className="font-medium text-foreground">{time}</span>
            </div>
            
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Party Size</span>
              <span className="font-medium text-foreground">
                {reservationData?.guestCount} {reservationData?.guestCount === 1 ? 'Guest' : 'Guests'}
              </span>
            </div>
            
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium text-foreground">
                {reservationData?.firstName} {reservationData?.lastName}
              </span>
            </div>
            
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Contact</span>
              <div className="text-right">
                <div className="font-medium text-foreground">{reservationData?.email}</div>
                <div className="text-sm text-muted-foreground">{reservationData?.phone}</div>
              </div>
            </div>
            
            {reservationData?.seatingPreference && reservationData?.seatingPreference !== 'no-preference' && (
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Seating</span>
                <span className="font-medium text-foreground">
                  {reservationData?.seatingPreference?.replace('-', ' ')?.replace(/\b\w/g, l => l?.toUpperCase())}
                </span>
              </div>
            )}
            
            {reservationData?.specialRequests && (
              <div className="py-2">
                <div className="text-muted-foreground mb-1">Special Requests</div>
                <div className="text-sm text-foreground bg-muted p-3 rounded-lg">
                  {reservationData?.specialRequests}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Next Steps */}
        <div className="p-4 bg-accent/10 rounded-lg mb-6">
          <h3 className="font-heading font-bold text-foreground mb-3">What's Next?</h3>
          <div className="space-y-2 text-sm text-foreground">
            <div className="flex items-center space-x-2">
              <Icon name="Mail" size={14} className="text-accent flex-shrink-0" />
              <span>Confirmation email sent to {reservationData?.email}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Icon name="MessageSquare" size={14} className="text-accent flex-shrink-0" />
              <span>SMS reminder sent to {reservationData?.phone}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Icon name="Clock" size={14} className="text-accent flex-shrink-0" />
              <span>Please arrive 10 minutes early</span>
            </div>
          </div>
        </div>

        {/* Restaurant Contact */}
        <div className="p-4 bg-muted rounded-lg mb-6">
          <h3 className="font-heading font-bold text-foreground mb-2">Restaurant Contact</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center space-x-2">
              <Icon name="MapPin" size={14} className="text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">{restaurant?.address}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Icon name="Phone" size={14} className="text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">{restaurant?.phone}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href={`tel:${restaurant?.phone}`}
            className="flex-1 bg-muted text-foreground px-4 py-3 rounded-lg font-body font-medium hover:bg-muted/80 transition-all duration-200 text-center flex items-center justify-center space-x-2"
          >
            <Icon name="Phone" size={16} />
            <span>Call Restaurant</span>
          </a>
          
          <button
            onClick={onClose}
            className="flex-1 bg-primary text-primary-foreground px-4 py-3 rounded-lg font-body font-medium hover:bg-primary/90 transition-all duration-200 flex items-center justify-center space-x-2"
          >
            <Icon name="X" size={16} />
            <span>Close</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;