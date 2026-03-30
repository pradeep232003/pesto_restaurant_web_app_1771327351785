import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star } from 'lucide-react';
import api from '../../../lib/api';

const ease = [0.16, 1, 0.3, 1];

const StarRating = ({ rating }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map(i => (
      <Star
        key={i}
        size={14}
        fill={i <= rating ? '#F59E0B' : 'none'}
        stroke={i <= rating ? '#F59E0B' : '#D1D5DB'}
        strokeWidth={1.5}
      />
    ))}
  </div>
);

const GoogleReviewsSection = () => {
  const [reviews, setReviews] = useState([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const data = await api.getGoogleReviews();
        setReviews(data);
      } catch {
        // Silently fail - section just won't show
      } finally {
        setLoading(false);
      }
    };
    fetchReviews();
  }, []);

  const next = useCallback(() => {
    if (reviews.length > 0) {
      setCurrent(p => (p + 1) % reviews.length);
    }
  }, [reviews.length]);

  useEffect(() => {
    if (reviews.length <= 1) return;
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [next, reviews.length]);

  // Don't render section if no reviews or still loading
  if (loading || reviews.length === 0) return null;

  const review = reviews[current];

  return (
    <section data-testid="google-reviews-section" className="py-16 md:py-24 px-6 md:px-12" style={{ background: '#FBFBFD' }}>
      <div className="max-w-4xl mx-auto text-center">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease }}
          className="text-sm tracking-[0.2em] uppercase mb-2"
          style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}
        >
          Google Reviews
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1, ease }}
          className="text-xs mb-10"
          style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}
        >
          What our customers are saying
        </motion.p>

        <div className="relative min-h-[280px] sm:min-h-[240px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, ease }}
              className="w-full"
            >
              {/* Stars */}
              <div className="flex justify-center mb-6">
                <StarRating rating={review.rating} />
              </div>

              {/* Review text */}
              <blockquote
                className="text-xl sm:text-2xl lg:text-3xl font-medium tracking-tight leading-relaxed mb-8 max-w-3xl mx-auto"
                style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
              >
                "{review.text}"
              </blockquote>

              {/* Author */}
              <div className="flex items-center justify-center gap-3">
                {review.profile_photo_url && (
                  <img
                    src={review.profile_photo_url}
                    alt={review.author_name}
                    className="w-8 h-8 rounded-full object-cover"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
                <div className="text-sm" style={{ color: '#86868B' }}>
                  <span className="font-medium" style={{ color: '#1D1D1F' }}>
                    {review.author_name}
                  </span>
                  {' '}&mdash;{' '}
                  <span style={{ color: '#86868B' }}>
                    {review.location_name}
                  </span>
                  {review.relative_time && (
                    <span className="block text-xs mt-0.5" style={{ color: '#AEAEB2' }}>
                      {review.relative_time}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dots */}
        {reviews.length > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            {reviews.map((_, i) => (
              <button
                key={i}
                data-testid={`review-dot-${i}`}
                onClick={() => setCurrent(i)}
                className="w-2 h-2 rounded-full transition-all duration-300"
                style={{
                  background: i === current ? '#1D1D1F' : 'rgba(0,0,0,0.15)',
                  transform: i === current ? 'scale(1.4)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default GoogleReviewsSection;
