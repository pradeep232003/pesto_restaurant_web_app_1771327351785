import React from 'react';
import { motion } from 'framer-motion';
import { ChefHat, Leaf, Clock, Heart } from 'lucide-react';

const ease = [0.16, 1, 0.3, 1];

const features = [
  {
    icon: ChefHat,
    title: 'Expert Chefs',
    desc: 'Years of culinary craft behind every plate. Our chefs bring passion, precision and tradition to your table.',
  },
  {
    icon: Leaf,
    title: 'Fresh Ingredients',
    desc: 'Locally sourced, seasonally selected. Only the finest produce makes it into our kitchen.',
  },
  {
    icon: Clock,
    title: 'Fast Service',
    desc: 'Quality without the wait. Fresh food, prepared with care, and served when you need it.',
  },
  {
    icon: Heart,
    title: 'Made with Love',
    desc: 'Family recipes passed down through generations. Every meal carries the warmth of home.',
  },
];

const WhyChooseUsSection = () => {
  return (
    <section className="py-16 md:py-24 px-6 md:px-12" style={{ background: '#FFFFFF' }}>
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease }}
          className="text-center mb-12 md:mb-16"
        >
          <h2
            className="text-4xl sm:text-5xl font-semibold tracking-tight mb-6"
            style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
          >
            Why Jolly's?
          </h2>
          <p
            className="text-base md:text-lg max-w-lg mx-auto leading-relaxed"
            style={{ color: '#86868B' }}
          >
            Simple things, done exceptionally well.
          </p>
        </motion.div>

        {/* Features Grid - no cards, just floating icons + text */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-16 md:gap-12">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.7, delay: i * 0.1, ease }}
              className="text-center"
            >
              <f.icon
                size={40}
                strokeWidth={1.2}
                className="mx-auto mb-6"
                style={{ color: '#1D1D1F' }}
              />
              <h3
                className="text-xl font-medium tracking-tight mb-3"
                style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
              >
                {f.title}
              </h3>
              <p
                className="text-sm leading-relaxed max-w-xs mx-auto"
                style={{ color: '#86868B' }}
              >
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.8, delay: 0.2, ease }}
          className="mt-16 md:mt-20 pt-12 flex flex-wrap justify-center gap-12 md:gap-20"
          style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}
        >
          {[
            { num: '5', label: 'Locations' },
            { num: '50+', label: 'Menu Items' },
            { num: '10K+', label: 'Happy Customers' },
            { num: '5\u2605', label: 'Average Rating' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p
                className="text-4xl sm:text-5xl font-semibold tracking-tight"
                style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
              >
                {s.num}
              </p>
              <p className="text-sm mt-2" style={{ color: '#86868B' }}>
                {s.label}
              </p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default WhyChooseUsSection;
