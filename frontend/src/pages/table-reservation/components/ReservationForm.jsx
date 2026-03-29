import React, { useState } from 'react';
import { ArrowLeft, MapPin, Calendar, Clock, Users } from 'lucide-react';

const ReservationForm = ({ restaurant, date, time, onSubmit, onBack, loading }) => {
  const [form, setForm] = useState({
    guestCount: 2,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    specialRequests: '',
    seatingPreference: 'no-preference',
  });
  const [errors, setErrors] = useState({});

  const formatDate = (d) =>
    d?.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const set = (field, value) => {
    setForm(p => ({ ...p, [field]: value }));
    if (errors[field]) setErrors(p => ({ ...p, [field]: '' }));
  };

  const handlePhoneChange = (value) => {
    const cleaned = value.replace(/\D/g, '');
    let formatted = cleaned;
    if (cleaned.length >= 6) formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    else if (cleaned.length >= 3) formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    set('phone', formatted);
  };

  const validate = () => {
    const e = {};
    if (!form.firstName.trim()) e.firstName = 'Required';
    if (!form.lastName.trim()) e.lastName = 'Required';
    if (!form.email.trim()) e.email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    if (!form.phone.trim()) e.phone = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (ev) => {
    ev.preventDefault();
    if (validate()) onSubmit(form);
  };

  const inputStyle = {
    background: '#F5F5F7',
    color: '#1D1D1F',
    border: '1px solid transparent',
    fontFamily: 'Outfit, sans-serif',
    borderRadius: '0.75rem',
  };

  const InputField = ({ label, value, onChange, type = 'text', placeholder, error, ...props }) => (
    <div>
      <label
        className="block text-xs tracking-[0.08em] uppercase mb-2"
        style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-4 py-3 text-sm outline-none transition-all duration-200"
        style={{
          ...inputStyle,
          borderColor: error ? 'rgba(255,59,48,0.5)' : 'transparent',
        }}
        onFocus={e => { if (!error) e.target.style.borderColor = 'rgba(0,0,0,0.15)'; }}
        onBlur={e => { if (!error) e.target.style.borderColor = 'transparent'; }}
        {...props}
      />
      {error && <p className="text-xs mt-1" style={{ color: '#FF3B30' }}>{error}</p>}
    </div>
  );

  return (
    <div>
      {/* Back */}
      <div className="flex items-center justify-between mb-8">
        <button
          data-testid="form-back-btn"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium transition-colors duration-200"
          style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}
          onMouseEnter={e => e.currentTarget.style.color = '#1D1D1F'}
          onMouseLeave={e => e.currentTarget.style.color = '#86868B'}
        >
          <ArrowLeft size={15} />
          Back
        </button>
      </div>

      {/* Summary strip */}
      <div
        className="flex flex-wrap items-center gap-4 sm:gap-6 px-6 py-4 mb-8"
        style={{ background: '#F5F5F7', borderRadius: '1rem' }}
      >
        <div className="flex items-center gap-2">
          <MapPin size={14} style={{ color: '#86868B' }} />
          <span className="text-sm font-medium" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>
            {restaurant?.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={14} style={{ color: '#86868B' }} />
          <span className="text-sm" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>
            {formatDate(date)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Clock size={14} style={{ color: '#86868B' }} />
          <span className="text-sm" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>{time}</span>
        </div>
      </div>

      {/* Form */}
      <div
        className="p-6 sm:p-8"
        style={{ background: '#FFFFFF', borderRadius: '1.5rem', border: '1px solid rgba(0,0,0,0.06)' }}
      >
        <h3
          className="text-lg font-semibold tracking-tight mb-6"
          style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
        >
          Your details.
        </h3>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Guest count */}
          <div className="flex items-center gap-4">
            <label
              className="text-xs tracking-[0.08em] uppercase"
              style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}
            >
              Party size
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => set('guestCount', Math.max(1, form.guestCount - 1))}
                disabled={form.guestCount <= 1}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-40"
                style={{ background: '#F5F5F7', color: '#1D1D1F' }}
              >
                <span className="text-lg leading-none">−</span>
              </button>
              <span
                className="w-8 text-center text-sm font-medium"
                style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
              >
                {form.guestCount}
              </span>
              <button
                type="button"
                onClick={() => set('guestCount', Math.min(12, form.guestCount + 1))}
                disabled={form.guestCount >= 12}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-40"
                style={{ background: '#F5F5F7', color: '#1D1D1F' }}
              >
                <span className="text-lg leading-none">+</span>
              </button>
            </div>
          </div>

          {/* Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label="First name"
              value={form.firstName}
              onChange={e => set('firstName', e.target.value)}
              error={errors.firstName}
            />
            <InputField
              label="Last name"
              value={form.lastName}
              onChange={e => set('lastName', e.target.value)}
              error={errors.lastName}
            />
          </div>

          {/* Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label="Email"
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              error={errors.email}
            />
            <InputField
              label="Phone"
              type="tel"
              value={form.phone}
              onChange={e => handlePhoneChange(e.target.value)}
              placeholder="(555) 123-4567"
              error={errors.phone}
            />
          </div>

          {/* Seating */}
          <div>
            <label
              className="block text-xs tracking-[0.08em] uppercase mb-2"
              style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}
            >
              Seating preference
            </label>
            <select
              value={form.seatingPreference}
              onChange={e => set('seatingPreference', e.target.value)}
              className="w-full px-4 py-3 text-sm outline-none appearance-none cursor-pointer"
              style={inputStyle}
            >
              <option value="no-preference">No Preference</option>
              <option value="indoor">Indoor</option>
              <option value="outdoor">Outdoor</option>
              <option value="window">Window Seat</option>
              <option value="booth">Booth</option>
            </select>
          </div>

          {/* Special requests */}
          <div>
            <label
              className="block text-xs tracking-[0.08em] uppercase mb-2"
              style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}
            >
              Special requests
            </label>
            <textarea
              value={form.specialRequests}
              onChange={e => set('specialRequests', e.target.value)}
              rows={3}
              placeholder="Allergies, celebrations, dietary needs..."
              className="w-full px-4 py-3 text-sm outline-none resize-none transition-all duration-200"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'rgba(0,0,0,0.15)'}
              onBlur={e => e.target.style.borderColor = 'transparent'}
            />
          </div>

          {/* Policy */}
          <div
            className="px-5 py-4 text-xs leading-relaxed"
            style={{ background: '#F5F5F7', borderRadius: '0.75rem', color: '#86868B' }}
          >
            Reservations are held for 15 minutes. Cancellations must be made at least 2 hours in advance.
          </div>

          {/* Submit */}
          <button
            data-testid="confirm-reservation-btn"
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-full text-sm font-medium tracking-wide transition-all duration-300 disabled:opacity-60"
            style={{ background: '#1D1D1F', color: '#FFFFFF', fontFamily: 'Outfit, sans-serif' }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#333336'; }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#1D1D1F'; }}
          >
            {loading ? 'Confirming...' : 'Confirm Reservation'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ReservationForm;
