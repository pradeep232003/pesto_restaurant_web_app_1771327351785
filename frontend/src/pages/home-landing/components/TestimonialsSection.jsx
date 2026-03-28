import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ease = [0.16, 1, 0.3, 1];

const testimonials = [
  {
    text: '"The best Full English in Manchester. No competition."',
    name: 'Sarah J.',
    role: 'Local Resident',
  },
  {
    text: '"Family run, and you can taste it. Genuine, honest food."',
    name: 'Michael R.',
    role: 'Food Blogger',
  },
  {
    text: '"We order from Jolly\'s every week. The kids love it."',
    name: 'Emily C.',
    role: 'Oakmere Resident',
  },
  {
    text: '"As a chef myself, I respect what they do here. Outstanding."',
    name: 'David T.',
    role: 'Chef',
  },
];

const TestimonialsSection = () => {
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => {
    setCurrent((p) => (p + 1) % testimonials.length);
  }, []);

  useEffect(() => {
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next]);

  return (
    <section className="py-24 md:py-36 px-6 md:px-12" style={{ background: '#FBFBFD' }}>
      <div className="max-w-4xl mx-auto text-center">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease }}
          className="text-sm tracking-[0.2em] uppercase mb-12"
          style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}
        >
          What our customers say
        </motion.p>

        <div className="relative min-h-[220px] sm:min-h-[200px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, ease }}
            >
              <blockquote
                className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight leading-tight mb-8"
                style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
              >
                {testimonials[current].text}
              </blockquote>
              <p className="text-sm" style={{ color: '#86868B' }}>
                <span className="font-medium" style={{ color: '#1D1D1F' }}>
                  {testimonials[current].name}
                </span>
                {' '}&mdash; {testimonials[current].role}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 mt-12">
          {testimonials.map((_, i) => (
            <button
              key={i}
              data-testid={`testimonial-dot-${i}`}
              onClick={() => setCurrent(i)}
              className="w-2 h-2 rounded-full transition-all duration-300"
              style={{
                background: i === current ? '#1D1D1F' : 'rgba(0,0,0,0.15)',
                transform: i === current ? 'scale(1.4)' : 'scale(1)',
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
