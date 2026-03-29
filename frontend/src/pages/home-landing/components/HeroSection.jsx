import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useLocation2 } from '../../../contexts/LocationContext';

const ease = [0.16, 1, 0.3, 1];

const HeroSection = ({ onViewMenu, onOrderNow }) => {
  const navigate = useNavigate();
  const { selectedLocation } = useLocation2();

  return (
    <section className="relative" style={{ background: '#FBFBFD' }}>
      {/* Text Content */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 pt-12 pb-8 md:pt-16 md:pb-10 text-center">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="text-sm md:text-base tracking-[0.2em] uppercase mb-6"
          style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}
        >
          Family-run since day one
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease }}
          className="text-5xl sm:text-6xl lg:text-8xl font-semibold tracking-tighter leading-[0.95] mb-8"
          style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
        >
          Jolly's Kafe.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease }}
          className="text-xl sm:text-2xl lg:text-3xl font-light max-w-3xl mx-auto mb-4 leading-snug"
          style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
        >
          Our passion is in our food.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease }}
          className="text-base md:text-lg max-w-2xl mx-auto mb-12 leading-relaxed"
          style={{ color: '#86868B' }}
        >
          Traditional English food crafted with care across five locations in Manchester, Cheshire &amp; Derby.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <button
            data-testid="hero-view-menu-btn"
            onClick={onViewMenu || (() => navigate('/menu-catalog'))}
            className="px-8 py-4 rounded-full text-sm font-medium tracking-wide transition-colors duration-300"
            style={{ background: '#1D1D1F', color: '#FFFFFF', fontFamily: 'Outfit, sans-serif' }}
            onMouseEnter={e => e.target.style.background = '#333336'}
            onMouseLeave={e => e.target.style.background = '#1D1D1F'}
          >
            View Menu
          </button>
          <button
            data-testid="hero-order-online-btn"
            onClick={onOrderNow}
            className="px-8 py-4 rounded-full text-sm font-medium tracking-wide transition-colors duration-300"
            style={{ background: '#F5F5F7', color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
            onMouseEnter={e => e.target.style.background = '#E8E8ED'}
            onMouseLeave={e => e.target.style.background = '#F5F5F7'}
          >
            Order Online
          </button>
          {selectedLocation?.reservation_enabled && (
            <button
              data-testid="hero-reservations-btn"
              onClick={() => navigate('/table-reservation')}
              className="sm:hidden px-8 py-4 rounded-full text-sm font-medium tracking-wide transition-colors duration-300"
              style={{ background: '#F5F5F7', color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
              onMouseEnter={e => e.target.style.background = '#E8E8ED'}
              onMouseLeave={e => e.target.style.background = '#F5F5F7'}
            >
              Reservations
            </button>
          )}
        </motion.div>
      </div>

      {/* Hero Image */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 pb-4">
        <motion.div
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.3, ease }}
          className="relative overflow-hidden"
          style={{ borderRadius: '2rem' }}
        >
          <img
            src="/assets/images/bg-menu-2-1774637132793.jpg"
            alt="Jolly's Kafe food spread featuring classic English breakfast dishes"
            className="w-full h-[40vh] sm:h-[50vh] md:h-[60vh] lg:h-[70vh] object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
