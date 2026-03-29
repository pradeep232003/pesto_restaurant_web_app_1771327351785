import React, { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../../lib/api';

const ease = [0.16, 1, 0.3, 1];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Generate 30-min slots between open and close (HH:MM 24h format)
const generateSlots = (openTime, closeTime) => {
  if (!openTime || !closeTime) return [];
  const [openH, openM] = openTime.split(':').map(Number);
  const [closeH, closeM] = closeTime.split(':').map(Number);
  const startMin = openH * 60 + openM;
  const endMin = closeH * 60 + closeM;
  const slots = [];
  for (let m = startMin; m < endMin; m += 30) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    slots.push(`${h12}:${min.toString().padStart(2, '0')} ${ampm}`);
  }
  return slots;
};

const DateTimePicker = ({ restaurant, onSelect, onBack }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [guestCount, setGuestCount] = useState(2);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [openingHours, setOpeningHours] = useState(null);
  const [dayHours, setDayHours] = useState(null);

  // Fetch opening hours for the location
  useEffect(() => {
    if (restaurant?.id) {
      api.getSiteStatus(restaurant.id).then(data => {
        setOpeningHours(data.opening_hours || {});
      }).catch(() => {});
    }
  }, [restaurant]);

  // Generate time slots based on selected date's day-of-week
  useEffect(() => {
    if (selectedDate && openingHours) {
      setLoadingSlots(true);
      setAvailableSlots([]);
      const dayIndex = selectedDate.getDay(); // 0=Sun
      const dayKey = DAY_KEYS[dayIndex];
      const hours = openingHours[dayKey];
      setDayHours(hours || null);
      const timer = setTimeout(() => {
        if (hours?.open && hours?.close) {
          setAvailableSlots(generateSlots(hours.open, hours.close));
        } else {
          setAvailableSlots([]);
        }
        setLoadingSlots(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [selectedDate, openingHours]);

  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  const isDateDisabled = (day) => {
    const d = new Date(currentYear, currentMonth, day);
    d.setHours(0, 0, 0, 0);
    return d < today;
  };

  const isDateSelected = (day) => {
    if (!selectedDate) return false;
    return selectedDate.getDate() === day && selectedDate.getMonth() === currentMonth && selectedDate.getFullYear() === currentYear;
  };

  const handleDayClick = (day) => {
    if (isDateDisabled(day)) return;
    setSelectedDate(new Date(currentYear, currentMonth, day));
    setSelectedTime(null);
  };

  const canGoPrev = () => {
    return currentMonth > today.getMonth() || currentYear > today.getFullYear();
  };

  const formatSelectedDate = () => {
    if (!selectedDate) return '';
    return selectedDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDay = getFirstDayOfMonth(currentMonth, currentYear);

  return (
    <div>
      {/* Back + location label */}
      <div className="flex items-center justify-between mb-8">
        <button
          data-testid="datetime-back-btn"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium transition-colors duration-200"
          style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}
          onMouseEnter={e => e.currentTarget.style.color = '#1D1D1F'}
          onMouseLeave={e => e.currentTarget.style.color = '#86868B'}
        >
          <ArrowLeft size={15} />
          Back
        </button>
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm"
          style={{ background: '#F5F5F7', color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
        >
          <Calendar size={14} style={{ color: '#86868B' }} />
          {restaurant?.name}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Left: Calendar */}
        <div>
          <h3
            className="text-lg font-semibold tracking-tight mb-5"
            style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
          >
            Pick a date.
          </h3>

          {/* Guest count */}
          <div className="flex items-center gap-3 mb-6">
            <span className="text-sm" style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}>Guests</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
                disabled={guestCount <= 1}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-40"
                style={{ background: '#F5F5F7', color: '#1D1D1F' }}
              >
                <span className="text-lg leading-none">−</span>
              </button>
              <span
                className="w-8 text-center text-sm font-medium"
                style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
              >
                {guestCount}
              </span>
              <button
                onClick={() => setGuestCount(Math.min(12, guestCount + 1))}
                disabled={guestCount >= 12}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-40"
                style={{ background: '#F5F5F7', color: '#1D1D1F' }}
              >
                <span className="text-lg leading-none">+</span>
              </button>
            </div>
          </div>

          {/* Calendar header */}
          <div
            className="p-5"
            style={{ background: '#FFFFFF', borderRadius: '1.25rem', border: '1px solid rgba(0,0,0,0.06)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <button
                onClick={prevMonth}
                disabled={!canGoPrev()}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-30"
                style={{ background: '#F5F5F7' }}
              >
                <ChevronLeft size={16} style={{ color: '#1D1D1F' }} />
              </button>
              <span
                className="text-sm font-semibold"
                style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
              >
                {MONTHS[currentMonth]} {currentYear}
              </span>
              <button
                onClick={nextMonth}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                style={{ background: '#F5F5F7' }}
              >
                <ChevronRight size={16} style={{ color: '#1D1D1F' }} />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAYS.map(d => (
                <div
                  key={d}
                  className="text-center text-xs font-medium py-1"
                  style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells for offset */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const disabled = isDateDisabled(day);
                const selected = isDateSelected(day);
                const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();

                return (
                  <button
                    key={day}
                    data-testid={`calendar-day-${day}`}
                    onClick={() => handleDayClick(day)}
                    disabled={disabled}
                    className="relative w-full aspect-square rounded-xl flex items-center justify-center text-sm font-medium transition-all duration-200"
                    style={{
                      background: selected ? '#1D1D1F' : 'transparent',
                      color: selected ? '#FFFFFF' : disabled ? 'rgba(0,0,0,0.15)' : '#1D1D1F',
                      fontFamily: 'Outfit, sans-serif',
                      cursor: disabled ? 'default' : 'pointer',
                    }}
                    onMouseEnter={e => { if (!disabled && !selected) e.currentTarget.style.background = '#F5F5F7'; }}
                    onMouseLeave={e => { if (!disabled && !selected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {day}
                    {isToday && !selected && (
                      <span
                        className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                        style={{ background: '#1D1D1F' }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Time slots */}
        <div>
          <h3
            className="text-lg font-semibold tracking-tight mb-5"
            style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
          >
            Pick a time.
          </h3>

          {!selectedDate ? (
            <div className="text-center py-16">
              <Calendar size={36} style={{ color: '#D1D1D6' }} className="mx-auto mb-4" strokeWidth={1.2} />
              <p className="text-sm" style={{ color: '#86868B' }}>
                Select a date to view available times.
              </p>
            </div>
          ) : loadingSlots ? (
            <div className="text-center py-16">
              <div
                className="w-8 h-8 rounded-full border-2 animate-spin mx-auto mb-4"
                style={{ borderColor: '#F5F5F7', borderTopColor: '#1D1D1F' }}
              />
              <p className="text-sm" style={{ color: '#86868B' }}>Loading times...</p>
            </div>
          ) : availableSlots.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-sm" style={{ color: '#86868B' }}>
                {dayHours === null ? 'The cafe is closed on this day. Try another date.' : 'No available times for this date.'}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs mb-4" style={{ color: '#86868B' }}>
                {formatSelectedDate()} &middot; {guestCount} {guestCount === 1 ? 'guest' : 'guests'}
                {dayHours && <span> &middot; Open {dayHours.open} — {dayHours.close}</span>}
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {availableSlots.map((time) => {
                  const isSelected = selectedTime === time;
                  return (
                    <button
                      key={time}
                      data-testid={`time-slot-${time.replace(/[\s:]/g, '-')}`}
                      onClick={() => setSelectedTime(time)}
                      className="py-3 rounded-xl text-sm font-medium transition-all duration-200"
                      style={{
                        background: isSelected ? '#1D1D1F' : '#FFFFFF',
                        color: isSelected ? '#FFFFFF' : '#1D1D1F',
                        border: isSelected ? '1px solid #1D1D1F' : '1px solid rgba(0,0,0,0.06)',
                        fontFamily: 'Outfit, sans-serif',
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = 'rgba(0,0,0,0.15)'; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)'; }}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Continue button */}
          {selectedDate && selectedTime && (
            <div className="mt-8">
              <button
                data-testid="datetime-continue-btn"
                onClick={() => onSelect(selectedDate, selectedTime)}
                className="w-full py-3.5 rounded-full text-sm font-medium tracking-wide transition-colors duration-300"
                style={{ background: '#1D1D1F', color: '#FFFFFF', fontFamily: 'Outfit, sans-serif' }}
                onMouseEnter={e => e.currentTarget.style.background = '#333336'}
                onMouseLeave={e => e.currentTarget.style.background = '#1D1D1F'}
              >
                Continue to Details
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DateTimePicker;
