import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';

const DateTimePicker = ({ restaurant, onSelect, onBack }) => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [guestCount, setGuestCount] = useState(2);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loading, setLoading] = useState(false);

  // Generate next 30 days
  const generateDates = () => {
    const dates = [];
    const today = new Date();
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date?.setDate(today?.getDate() + i);
      dates?.push(date);
    }
    
    return dates;
  };

  const dates = generateDates();

  // Mock time slots
  const timeSlots = [
    '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM',
    '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM',
    '5:00 PM', '5:30 PM', '6:00 PM', '6:30 PM',
    '7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM',
    '9:00 PM', '9:30 PM'
  ];

  // Simulate loading available slots when date changes
  useEffect(() => {
    if (selectedDate) {
      setLoading(true);
      setAvailableSlots([]);
      
      setTimeout(() => {
        // Mock availability - some slots might be unavailable
        const availableToday = timeSlots?.filter(() => Math.random() > 0.3);
        setAvailableSlots(availableToday);
        setLoading(false);
      }, 1000);
    }
  }, [selectedDate]);

  const formatDate = (date) => {
    return date?.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const isDateDisabled = (date) => {
    const today = new Date();
    today?.setHours(0, 0, 0, 0);
    return date < today;
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setSelectedTime(null);
  };

  const handleTimeSelect = (time) => {
    setSelectedTime(time);
  };

  const handleContinue = () => {
    if (selectedDate && selectedTime) {
      onSelect?.(selectedDate, selectedTime);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors duration-200"
        >
          <Icon name="ArrowLeft" size={16} />
          <span className="font-body">Back to Locations</span>
        </button>
        
        <div className="text-center">
          <h2 className="text-xl lg:text-2xl font-heading font-bold text-foreground">
            {restaurant?.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {restaurant?.address}
          </p>
        </div>
        
        <div /> {/* Spacer for centering */}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Guest Count & Date Selection */}
        <div>
          <h3 className="text-lg font-heading font-bold text-foreground mb-4">
            Select Date & Party Size
          </h3>

          {/* Guest Count */}
          <div className="mb-6">
            <label className="block text-sm font-body font-medium text-foreground mb-2">
              Number of Guests
            </label>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
                disabled={guestCount <= 1}
                className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icon name="Minus" size={16} />
              </button>
              <span className="text-lg font-body font-medium text-foreground min-w-[3rem] text-center">
                {guestCount}
              </span>
              <button
                onClick={() => setGuestCount(Math.min(12, guestCount + 1))}
                disabled={guestCount >= 12}
                className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icon name="Plus" size={16} />
              </button>
            </div>
          </div>

          {/* Date Grid */}
          <div>
            <label className="block text-sm font-body font-medium text-foreground mb-3">
              Available Dates
            </label>
            <div className="grid grid-cols-7 gap-2 mb-4">
              {dates?.slice(0, 21)?.map((date) => {
                const isSelected = selectedDate?.toDateString() === date?.toDateString();
                const isDisabled = isDateDisabled(date);
                
                return (
                  <button
                    key={date?.toISOString()}
                    onClick={() => !isDisabled && handleDateSelect(date)}
                    disabled={isDisabled}
                    className={`p-2 rounded-lg text-sm font-body font-medium transition-all duration-200 ${
                      isSelected
                        ? 'bg-primary text-primary-foreground shadow-warm'
                        : isDisabled
                        ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
                        : 'bg-card hover:bg-muted border border-border hover:shadow-warm-sm'
                    }`}
                  >
                    <div className="text-xs opacity-70">
                      {formatDate(date)?.split(' ')?.[0]}
                    </div>
                    <div className="text-sm">
                      {date?.getDate()}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Time Selection */}
        <div>
          <h3 className="text-lg font-heading font-bold text-foreground mb-4">
            Available Times
          </h3>

          {!selectedDate ? (
            <div className="text-center py-12 text-muted-foreground">
              <Icon name="Calendar" size={48} className="mx-auto mb-4 opacity-50" />
              <p className="font-body">
                Please select a date to view available times
              </p>
            </div>
          ) : loading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-muted-foreground font-body">
                Loading available times...
              </p>
            </div>
          ) : (
            <div>
              <div className="text-sm text-muted-foreground mb-3">
                {formatDate(selectedDate)} • {guestCount} {guestCount === 1 ? 'guest' : 'guests'}
              </div>
              <div className="grid grid-cols-3 gap-2 max-h-80 overflow-y-auto">
                {availableSlots?.map((time) => {
                  const isSelected = selectedTime === time;
                  
                  return (
                    <button
                      key={time}
                      onClick={() => handleTimeSelect(time)}
                      className={`p-3 rounded-lg text-sm font-body font-medium transition-all duration-200 ${
                        isSelected
                          ? 'bg-primary text-primary-foreground shadow-warm'
                          : 'bg-card hover:bg-muted border border-border hover:shadow-warm-sm'
                      }`}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>
              
              {availableSlots?.length === 0 && !loading && (
                <div className="text-center py-8 text-muted-foreground">
                  <Icon name="XCircle" size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="font-body text-sm">
                    No available times for this date
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Continue Button */}
      {selectedDate && selectedTime && (
        <div className="mt-8 pt-6 border-t border-border">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Selected:</span>{' '}
              {formatDate(selectedDate)} at {selectedTime} for {guestCount} {guestCount === 1 ? 'guest' : 'guests'}
            </div>
            
            <button
              onClick={handleContinue}
              className="bg-primary text-primary-foreground px-8 py-3 rounded-lg font-body font-medium hover:bg-primary/90 transition-all duration-200 hover:scale-105 flex items-center space-x-2"
            >
              <span>Continue to Details</span>
              <Icon name="ArrowRight" size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateTimePicker;