import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, MapPin, Calendar, Clock, Users, X } from 'lucide-react';

const ease = [0.16, 1, 0.3, 1];

const ConfirmationModal = ({ restaurant, date, time, reservationData, onClose }) => {
  const formatDate = (d) =>
    d?.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const confirmationNumber = `JK-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

  return (
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
          className="w-full max-w-md max-h-[90vh] overflow-y-auto"
          style={{
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            borderRadius: '1.5rem',
            border: '1px solid rgba(255,255,255,0.5)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Close btn */}
          <div className="flex justify-end px-5 pt-5">
            <button
              data-testid="confirmation-close-btn"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
              style={{ background: 'rgba(0,0,0,0.05)' }}
            >
              <X size={16} style={{ color: '#86868B' }} />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 pb-6 text-center">
            {/* Success icon */}
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ background: 'rgba(52,199,89,0.1)' }}
            >
              <CheckCircle size={32} style={{ color: '#34C759' }} strokeWidth={1.5} />
            </div>

            <h2
              className="text-2xl font-semibold tracking-tight mb-2"
              style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
            >
              Reservation Confirmed.
            </h2>
            <p className="text-sm mb-8" style={{ color: '#86868B' }}>
              We look forward to welcoming you.
            </p>

            {/* Confirmation number */}
            <div
              className="py-4 px-5 mb-6"
              style={{ background: '#F5F5F7', borderRadius: '1rem' }}
            >
              <p className="text-xs tracking-[0.1em] uppercase mb-1" style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}>
                Confirmation
              </p>
              <p
                className="text-xl font-semibold tracking-wide"
                style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
              >
                {confirmationNumber}
              </p>
            </div>

            {/* Details */}
            <div className="space-y-3 mb-8 text-left">
              <DetailRow icon={MapPin} label={restaurant?.name} sub={restaurant?.address} />
              <DetailRow icon={Calendar} label={formatDate(date)} />
              <DetailRow icon={Clock} label={time} />
              <DetailRow icon={Users} label={`${reservationData?.guestCount || 2} guests`} />
              {reservationData?.firstName && (
                <DetailRow
                  icon={() => <div className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: '#F5F5F7', color: '#1D1D1F' }}>{reservationData.firstName.charAt(0)}</div>}
                  label={`${reservationData.firstName} ${reservationData.lastName}`}
                  sub={reservationData.email}
                />
              )}
            </div>

            {/* Notice */}
            <div
              className="px-5 py-3 mb-6 text-xs text-left leading-relaxed"
              style={{ background: 'rgba(255,149,0,0.06)', borderRadius: '0.75rem', color: '#FF9500' }}
            >
              Please arrive 10 minutes early. A confirmation email has been sent to {reservationData?.email}.
            </div>

            {/* CTA */}
            <button
              data-testid="confirmation-done-btn"
              onClick={onClose}
              className="w-full py-3.5 rounded-full text-sm font-medium tracking-wide transition-colors duration-300"
              style={{ background: '#1D1D1F', color: '#FFFFFF', fontFamily: 'Outfit, sans-serif' }}
              onMouseEnter={e => e.currentTarget.style.background = '#333336'}
              onMouseLeave={e => e.currentTarget.style.background = '#1D1D1F'}
            >
              Done
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
};

const DetailRow = ({ icon: Icon, label, sub }) => (
  <div className="flex items-center gap-3 py-2" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
    <Icon size={15} style={{ color: '#86868B' }} strokeWidth={1.5} />
    <div>
      <p className="text-sm font-medium" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>{label}</p>
      {sub && <p className="text-xs" style={{ color: '#86868B' }}>{sub}</p>}
    </div>
  </div>
);

export default ConfirmationModal;
