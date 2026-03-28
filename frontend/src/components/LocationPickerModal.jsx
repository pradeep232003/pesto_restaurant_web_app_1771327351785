import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, X } from 'lucide-react';

const ease = [0.16, 1, 0.3, 1];

const LocationPickerModal = ({ open, onClose, locations, onSelect }) => {
  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60]"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.3, ease }}
            className="fixed inset-0 z-[61] flex items-center justify-center px-5"
          >
            <div
              className="w-full max-w-md overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', borderRadius: '1.5rem', border: '1px solid rgba(255,255,255,0.5)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 pt-6 pb-4 flex items-center justify-between">
                <div>
                  <h2
                    className="text-xl font-semibold tracking-tight"
                    style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
                  >
                    Choose a location.
                  </h2>
                  <p className="text-sm mt-1" style={{ color: '#86868B' }}>
                    Select a cafe to view its menu.
                  </p>
                </div>
                <button
                  data-testid="location-modal-close"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                  style={{ background: 'rgba(0,0,0,0.05)' }}
                >
                  <X size={16} style={{ color: '#86868B' }} />
                </button>
              </div>

              {/* Locations */}
              <div className="px-4 pb-5 space-y-1.5">
                {locations?.filter(l => l.is_active !== false)?.map((loc) => (
                  <button
                    key={loc.id}
                    data-testid={`location-pick-${loc.id}`}
                    onClick={() => onSelect(loc)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all duration-200 group"
                    style={{ background: 'transparent' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all"
                      style={{ background: 'rgba(0,0,0,0.04)' }}
                    >
                      <MapPin size={18} style={{ color: '#1D1D1F' }} strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
                      >
                        {loc.name}
                      </p>
                      {loc.address && loc.address !== loc.name && (
                        <p className="text-xs truncate" style={{ color: '#86868B' }}>
                          {loc.address}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default LocationPickerModal;
