import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Calendar, Check } from 'lucide-react';
import Header from '../../components/ui/Header';
import LocationStep from './components/RestaurantSelector';
import DateTimePicker from './components/DateTimePicker';
import ReservationForm from './components/ReservationForm';
import ConfirmationModal from './components/ConfirmationModal';
import { useLocation2 } from '../../contexts/LocationContext';

const ease = [0.16, 1, 0.3, 1];

const steps = [
  { num: 1, label: 'Location' },
  { num: 2, label: 'Date & Time' },
  { num: 3, label: 'Details' },
];

const TableReservation = () => {
  const navigate = useNavigate();
  const { locations, selectedLocation } = useLocation2();
  const [currentStep, setCurrentStep] = useState(selectedLocation ? 2 : 1);
  const [selectedRestaurant, setSelectedRestaurant] = useState(selectedLocation || null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [reservationData, setReservationData] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRestaurantSelect = (loc) => {
    setSelectedRestaurant(loc);
    setCurrentStep(2);
  };

  const handleDateTimeSelect = (date, time) => {
    setSelectedDate(date);
    setSelectedTime(time);
    setCurrentStep(3);
  };

  const handleReservationSubmit = async (formData) => {
    setLoading(true);
    setReservationData(formData);
    await new Promise((r) => setTimeout(r, 1500));
    setLoading(false);
    setShowConfirmation(true);
  };

  const handleConfirmationClose = () => {
    setShowConfirmation(false);
    setCurrentStep(1);
    setSelectedRestaurant(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setReservationData(null);
  };

  return (
    <div className="min-h-screen" style={{ background: '#FBFBFD' }}>
      <Header
        onCartClick={() => navigate('/shopping-cart')}
        onAccountClick={() => {}}
        onSearch={() => {}}
        onLogout={() => {}}
      />

      <main className="pt-16">
        {/* Hero */}
        <section className="pt-16 pb-6 md:pt-20 md:pb-8 px-6 md:px-12 text-center">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
            className="text-sm tracking-[0.2em] uppercase mb-4"
            style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}
          >
            Book a table
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease }}
            className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight mb-5"
            style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
          >
            Reservations.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease }}
            className="text-base md:text-lg max-w-xl mx-auto"
            style={{ color: '#86868B' }}
          >
            Choose your preferred cafe, date and time for an unforgettable meal.
          </motion.p>
        </section>

        {/* Step indicator */}
        <section className="pb-8 px-6 md:px-12">
          <div className="max-w-xl mx-auto flex items-center justify-center gap-2 sm:gap-4">
            {steps.map((s, i) => {
              const isActive = currentStep === s.num;
              const isDone = currentStep > s.num;
              return (
                <React.Fragment key={s.num}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300"
                      style={{
                        background: isDone ? '#1D1D1F' : isActive ? '#1D1D1F' : '#F5F5F7',
                        color: isDone || isActive ? '#FFFFFF' : '#86868B',
                        fontFamily: 'Outfit, sans-serif',
                      }}
                    >
                      {isDone ? <Check size={14} /> : s.num}
                    </div>
                    <span
                      className="text-sm font-medium hidden sm:inline"
                      style={{
                        color: isActive ? '#1D1D1F' : '#86868B',
                        fontFamily: 'Outfit, sans-serif',
                      }}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className="w-10 sm:w-16 h-px"
                      style={{ background: currentStep > s.num ? '#1D1D1F' : 'rgba(0,0,0,0.1)' }}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </section>

        {/* Step content */}
        <section className="pb-20 px-6 md:px-12">
          <div className="max-w-5xl mx-auto">
            <AnimatePresence mode="wait">
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.4, ease }}
                >
                  <LocationStep
                    locations={locations}
                    onSelect={handleRestaurantSelect}
                  />
                </motion.div>
              )}
              {currentStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.4, ease }}
                >
                  <DateTimePicker
                    restaurant={selectedRestaurant}
                    onSelect={handleDateTimeSelect}
                    onBack={() => setCurrentStep(1)}
                  />
                </motion.div>
              )}
              {currentStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.4, ease }}
                >
                  <ReservationForm
                    restaurant={selectedRestaurant}
                    date={selectedDate}
                    time={selectedTime}
                    onSubmit={handleReservationSubmit}
                    onBack={() => setCurrentStep(2)}
                    loading={loading}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmation && (
          <ConfirmationModal
            restaurant={selectedRestaurant}
            date={selectedDate}
            time={selectedTime}
            reservationData={reservationData}
            onClose={handleConfirmationClose}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default TableReservation;
