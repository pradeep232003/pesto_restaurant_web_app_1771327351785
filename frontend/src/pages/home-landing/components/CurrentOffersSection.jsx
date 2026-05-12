import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import api, { resolveImageUrl } from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';

/**
 * Current Offers — marketing strip on the home page.
 * Reads from /api/offers (admin-managed via /admin/offers).
 * The backend already filters by active + date range; we just pass the
 * selected cafe so location-restricted offers can be hidden too.
 */
const CurrentOffersSection = () => {
  const { selectedCafeLocation } = useLocation2();
  const [offers, setOffers] = useState([]);

  useEffect(() => {
    api.listOffers(selectedCafeLocation?.id)
      .then(rows => setOffers(rows || []))
      .catch(() => setOffers([]));
  }, [selectedCafeLocation?.id]);

  if (offers.length === 0) return null;

  return (
    <section
      data-testid="current-offers-section"
      className="py-14 sm:py-20"
      style={{ background: '#FBF9F5' }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-12">
          <p
            className="text-xs sm:text-sm font-semibold tracking-[0.18em] uppercase mb-2"
            style={{ color: '#8B1E3F' }}
          >
            On now
          </p>
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight"
            style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
          >
            Current Offers
          </h2>
          <p
            className="mt-3 text-sm sm:text-base"
            style={{ color: '#5A5A5F', fontFamily: 'Outfit, sans-serif' }}
          >
            Treat yourself — handpicked specials at your local Jolly's Kafe.
          </p>
        </div>

        <div className={`grid gap-6 sm:gap-8 ${
          offers.length === 1
            ? 'grid-cols-1 sm:max-w-md sm:mx-auto'
            : offers.length === 2
              ? 'grid-cols-1 sm:grid-cols-2 lg:max-w-4xl lg:mx-auto'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        }`}>
          {offers.map((o, idx) => {
            const src = o.image_url?.startsWith('/api/')
              ? resolveImageUrl(o.image_url)
              : o.image_url;
            return (
            <motion.article
              key={o.id}
              data-testid={`offer-card-${o.id}`}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.55, delay: idx * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="group relative overflow-hidden rounded-3xl shadow-sm hover:shadow-xl transition-shadow duration-300"
              style={{ background: '#FFFFFF' }}
            >
              {src && (
                <div className="overflow-hidden bg-[#1a1410]">
                  <img
                    src={src}
                    alt={o.title}
                    loading="lazy"
                    className="w-full h-auto object-contain transition-transform duration-500 group-hover:scale-[1.02]"
                  />
                </div>
              )}
              <div className="p-5">
                <h3
                  className="text-lg font-semibold"
                  style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
                >
                  {o.title}
                </h3>
                {o.caption && (
                  <p
                    className="mt-1 text-sm"
                    style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}
                  >
                    {o.caption}
                  </p>
                )}
              </div>
            </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default CurrentOffersSection;
