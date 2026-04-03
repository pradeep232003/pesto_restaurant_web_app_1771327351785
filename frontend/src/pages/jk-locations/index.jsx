import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import { useLocation2 } from '../../contexts/LocationContext';

const ease = [0.16, 1, 0.3, 1];

const JKLocations = () => {
  const { locations, setSelectedLocation, setSelectedCafeLocation, loading } = useLocation2();
  const navigate = useNavigate();

  const handleSelectLocation = (loc) => {
    setSelectedLocation(loc);
    setSelectedCafeLocation(loc);
    navigate('/menu-catalog');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FBFBFD' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#1D1D1F', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#FBFBFD' }}>
      <div className="max-w-3xl mx-auto px-6 py-16 sm:py-24">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="text-center mb-12"
        >
          <img
            src="/assets/images/logo-2-1774630354696.png"
            alt="Jolly's Kafe"
            className="h-16 mx-auto mb-6"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <h1
            className="text-3xl sm:text-4xl font-semibold tracking-tight mb-3"
            style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
          >
            Our Locations
          </h1>
          <p
            className="text-base"
            style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}
          >
            Select a cafe to view the menu
          </p>
        </motion.div>

        {/* Location Cards */}
        <div className="flex flex-col gap-3">
          {locations.map((loc, i) => (
            <motion.button
              key={loc.id}
              data-testid={`location-card-${loc.id}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.06, ease }}
              onClick={() => handleSelectLocation(loc)}
              className="w-full flex items-center gap-4 p-5 rounded-2xl text-left transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
              style={{
                background: '#FFFFFF',
                border: '1px solid #E8E8ED',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#F5F5F7';
                e.currentTarget.style.borderColor = '#1D1D1F';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#FFFFFF';
                e.currentTarget.style.borderColor = '#E8E8ED';
              }}
            >
              <div
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: '#F5F5F7' }}
              >
                <MapPin size={18} style={{ color: '#1D1D1F' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-base font-medium truncate"
                  style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
                >
                  {loc.name}
                </p>
                {loc.address && loc.address !== loc.name && (
                  <p
                    className="text-sm truncate mt-0.5"
                    style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}
                  >
                    {loc.address}
                  </p>
                )}
              </div>
              <div
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: '#F5F5F7' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1D1D1F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default JKLocations;
