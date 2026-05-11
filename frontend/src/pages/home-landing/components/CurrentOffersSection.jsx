import React from 'react';
import { motion } from 'framer-motion';

/**
 * Current Offers — short-form marketing strip on the home page.
 * Renders each active offer as a poster card. Keep the markup minimal so
 * staff can swap the image (or add more) without touching styling.
 */
const OFFERS = [
  {
    id: 'coffee-cake-5',
    image: '/offers/coffee-cake.png',
    alt: "Jolly's Kafe — Coffee + Cake for only £5",
    title: 'Coffee + Cake — £5',
    caption: 'In store every day. While stocks last.',
  },
];

const CurrentOffersSection = () => {
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
            Treat yourself — available across every Jolly's Kafe.
          </p>
        </div>

        <div className={`grid gap-6 sm:gap-8 ${
          OFFERS.length === 1
            ? 'grid-cols-1 sm:max-w-md sm:mx-auto'
            : OFFERS.length === 2
              ? 'grid-cols-1 sm:grid-cols-2 lg:max-w-4xl lg:mx-auto'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        }`}>
          {OFFERS.map((o, idx) => (
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
              <div className="overflow-hidden bg-[#1a1410]">
                <img
                  src={o.image}
                  alt={o.alt}
                  loading="lazy"
                  className="w-full h-auto object-contain transition-transform duration-500 group-hover:scale-[1.02]"
                />
              </div>
              <div className="p-5">
                <h3
                  className="text-lg font-semibold"
                  style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
                >
                  {o.title}
                </h3>
                <p
                  className="mt-1 text-sm"
                  style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}
                >
                  {o.caption}
                </p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CurrentOffersSection;
