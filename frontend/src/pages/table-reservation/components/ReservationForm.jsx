import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import Select from '../../../components/ui/Select';

const ReservationForm = ({ restaurant, date, time, onSubmit, onBack, loading }) => {
  const [formData, setFormData] = useState({
    guestCount: 2,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    specialRequests: '',
    seatingPreference: 'no-preference',
    accessibilityNeeds: false
  });
  const [errors, setErrors] = useState({});

  const formatDate = (date) => {
    return date?.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData?.firstName?.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData?.lastName?.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!formData?.email?.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/?.test(formData?.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData?.phone?.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\(\d{3}\)\s\d{3}-\d{4}$/?.test(formData?.phone)) {
      newErrors.phone = 'Please enter a valid phone number (XXX) XXX-XXXX';
    }

    setErrors(newErrors);
    return Object.keys(newErrors)?.length === 0;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors?.[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handlePhoneChange = (value) => {
    // Auto-format phone number
    const cleaned = value?.replace(/\D/g, '');
    let formatted = cleaned;
    
    if (cleaned?.length >= 6) {
      formatted = `(${cleaned?.slice(0, 3)}) ${cleaned?.slice(3, 6)}-${cleaned?.slice(6, 10)}`;
    } else if (cleaned?.length >= 3) {
      formatted = `(${cleaned?.slice(0, 3)}) ${cleaned?.slice(3)}`;
    }
    
    handleInputChange('phone', formatted);
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    
    if (validateForm()) {
      onSubmit?.(formData);
    }
  };

  const seatingOptions = [
    { value: 'no-preference', label: 'No Preference' },
    { value: 'indoor', label: 'Indoor Seating' },
    { value: 'outdoor', label: 'Outdoor Seating' },
    { value: 'window', label: 'Window Seat' },
    { value: 'booth', label: 'Booth Seating' },
    { value: 'bar', label: 'Bar Seating' }
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors duration-200"
        >
          <Icon name="ArrowLeft" size={16} />
          <span className="font-body">Back to Date & Time</span>
        </button>
        
        <div className="text-center">
          <h2 className="text-xl lg:text-2xl font-heading font-bold text-foreground">
            Reservation Details
          </h2>
        </div>
        
        <div /> {/* Spacer for centering */}
      </div>
      {/* Reservation Summary */}
      <div className="bg-muted rounded-xl p-6 mb-8">
        <h3 className="font-heading font-bold text-foreground mb-4">
          Your Reservation
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <Icon name="MapPin" size={16} className="text-muted-foreground flex-shrink-0" />
            <div>
              <div className="font-medium text-foreground">{restaurant?.name}</div>
              <div className="text-muted-foreground text-xs">{restaurant?.address}</div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Icon name="Calendar" size={16} className="text-muted-foreground flex-shrink-0" />
            <div>
              <div className="font-medium text-foreground">{formatDate(date)}</div>
              <div className="text-muted-foreground text-xs">Date</div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Icon name="Clock" size={16} className="text-muted-foreground flex-shrink-0" />
            <div>
              <div className="font-medium text-foreground">{time}</div>
              <div className="text-muted-foreground text-xs">Time</div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Icon name="Users" size={16} className="text-muted-foreground flex-shrink-0" />
            <div>
              <div className="font-medium text-foreground">{formData?.guestCount} {formData?.guestCount === 1 ? 'Guest' : 'Guests'}</div>
              <div className="text-muted-foreground text-xs">Party Size</div>
            </div>
          </div>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Guest Count */}
        <div>
          <label className="block text-sm font-body font-medium text-foreground mb-2">
            Party Size
          </label>
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={() => handleInputChange('guestCount', Math.max(1, formData?.guestCount - 1))}
              disabled={formData?.guestCount <= 1}
              className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon name="Minus" size={16} />
            </button>
            <span className="text-lg font-body font-medium text-foreground min-w-[3rem] text-center">
              {formData?.guestCount}
            </span>
            <button
              type="button"
              onClick={() => handleInputChange('guestCount', Math.min(12, formData?.guestCount + 1))}
              disabled={formData?.guestCount >= 12}
              className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon name="Plus" size={16} />
            </button>
            <span className="text-sm text-muted-foreground ml-4">
              Maximum 12 guests per reservation
            </span>
          </div>
        </div>

        {/* Contact Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Input
              label="First Name"
              type="text"
              value={formData?.firstName}
              onChange={(e) => handleInputChange('firstName', e?.target?.value)}
              error={errors?.firstName}
              required
            />
          </div>
          <div>
            <Input
              label="Last Name"
              type="text"
              value={formData?.lastName}
              onChange={(e) => handleInputChange('lastName', e?.target?.value)}
              error={errors?.lastName}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Input
              label="Email Address"
              type="email"
              value={formData?.email}
              onChange={(e) => handleInputChange('email', e?.target?.value)}
              error={errors?.email}
              required
            />
          </div>
          <div>
            <Input
              label="Phone Number"
              type="tel"
              value={formData?.phone}
              onChange={(e) => handlePhoneChange(e?.target?.value)}
              error={errors?.phone}
              placeholder="(555) 123-4567"
              required
            />
          </div>
        </div>

        {/* Seating Preference */}
        <div>
          <Select
            label="Seating Preference"
            value={formData?.seatingPreference}
            onChange={(e) => handleInputChange('seatingPreference', e?.target?.value)}
            options={seatingOptions}
          />
        </div>

        {/* Accessibility Needs */}
        <div>
          <Checkbox
            id="accessibility"
            checked={formData?.accessibilityNeeds}
            onChange={(checked) => handleInputChange('accessibilityNeeds', checked)}
            label="I have accessibility requirements"
            description="We'll ensure your table accommodates any accessibility needs"
          />
        </div>

        {/* Special Requests */}
        <div>
          <label className="block text-sm font-body font-medium text-foreground mb-2">
            Special Requests
          </label>
          <textarea
            value={formData?.specialRequests}
            onChange={(e) => handleInputChange('specialRequests', e?.target?.value)}
            rows={4}
            placeholder="Let us know about any dietary restrictions, allergies, special occasions, or other requests..."
            className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-ring focus:border-ring transition-colors duration-200"
          />
        </div>

        {/* Terms Notice */}
        <div className="p-4 bg-muted rounded-lg">
          <div className="flex items-start space-x-3">
            <Icon name="Info" size={16} className="text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="mb-2">
                <strong className="text-foreground">Reservation Policy:</strong>
              </p>
              <ul className="space-y-1 text-xs">
                <li>• Reservations are held for 15 minutes past the scheduled time</li>
                <li>• Large parties may require a credit card to hold the reservation</li>
                <li>• Cancellations must be made at least 2 hours in advance</li>
                <li>• We'll send a confirmation email with your reservation details</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-6 border-t border-border">
          <Button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto sm:min-w-[200px] bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {loading ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                <span>Confirming...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <span>Confirm Reservation</span>
                <Icon name="Check" size={16} />
              </div>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ReservationForm;