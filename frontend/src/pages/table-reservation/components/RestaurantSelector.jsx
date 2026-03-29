import React from 'react';
import { MapPin, ChevronRight } from 'lucide-react';

const LocationStep = ({ locations, onSelect }) => {
  const activeLocations = locations?.filter(l => l.is_active !== false) || [];

  return (
    <div>
      <div className="text-center mb-10">
        <h2
          className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3"
          style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
        >
          Choose a cafe.
        </h2>
        <p className="text-sm" style={{ color: '#86868B' }}>
          Select the location for your reservation.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeLocations.map((loc) => (
          <button
            key={loc.id}
            data-testid={`reservation-location-${loc.id}`}
            onClick={() => onSelect(loc)}
            className="group text-left p-6 transition-all duration-300"
            style={{
              background: '#FFFFFF',
              borderRadius: '1.25rem',
              border: '1px solid rgba(0,0,0,0.06)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(0,0,0,0.15)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: '#F5F5F7' }}
              >
                <MapPin size={18} style={{ color: '#1D1D1F' }} strokeWidth={1.5} />
              </div>
              <ChevronRight
                size={16}
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 mt-2"
                style={{ color: '#86868B' }}
              />
            </div>
            <h3
              className="text-base font-medium tracking-tight mb-1"
              style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
            >
              {loc.name}
            </h3>
            {loc.address && loc.address !== loc.name && (
              <p className="text-xs leading-relaxed" style={{ color: '#86868B' }}>
                {loc.address}
              </p>
            )}
          </button>
        ))}
      </div>

      {/* Info note */}
      <div
        className="mt-8 px-6 py-5 text-center"
        style={{ background: '#F5F5F7', borderRadius: '1rem' }}
      >
        <p className="text-xs leading-relaxed" style={{ color: '#86868B' }}>
          Reservations can be made up to 30 days in advance. Large parties (8+ guests) may require a deposit.
        </p>
      </div>
    </div>
  );
};

export default LocationStep;
