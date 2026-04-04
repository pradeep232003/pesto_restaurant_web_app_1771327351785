import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const ease = [0.16, 1, 0.3, 1];

const fadeUp = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.8, ease },
};

const menuItems = [
  {
    name: 'Full English',
    desc: 'The classic. Done properly.',
    image: 'https://images.pexels.com/photos/8480750/pexels-photo-8480750.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940',
    span: 'md:col-span-4 md:row-span-2',
    height: 'h-64 md:h-full',
  },
  {
    name: 'Chicken Burger',
    desc: 'Crispy, golden, irresistible.',
    image: 'https://images.unsplash.com/photo-1760533536738-f0965fd52354?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzR8MHwxfHNlYXJjaHwxfHxjcmlzcHklMjBjaGlja2VuJTIwYnVyZ2VyJTIwZnJpZXN8ZW58MHx8fHwxNzc0NzMzNTA0fDA&ixlib=rb-4.1.0&q=85',
    span: 'md:col-span-4',
    height: 'h-64 md:h-72',
  },
  {
    name: 'Sunday Roast',
    desc: 'Every day feels like Sunday.',
    image: 'https://images.pexels.com/photos/34991330/pexels-photo-34991330.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940',
    span: 'md:col-span-4',
    height: 'h-64 md:h-72',
  },
  {
    name: 'Toasted Teacake',
    desc: 'Warm. Buttery. Perfect.',
    image: 'https://images.unsplash.com/photo-1588503823575-2744851a4b56?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODh8MHwxfHNlYXJjaHwxfHxmdWxsJTIwZW5nbGlzaCUyMGJyZWFrZmFzdCUyMHBsYXRlJTIwYmVhbnMlMjBzYXVzYWdlJTIwZWdnc3xlbnwwfHx8fDE3NzQ3MzM1MDN8MA&ixlib=rb-4.1.0&q=85',
    span: 'md:col-span-3',
    height: 'h-64',
  },
  {
    name: 'Cafe Specials',
    desc: 'Something new, every week.',
    image: 'https://images.pexels.com/photos/9061486/pexels-photo-9061486.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940',
    span: 'md:col-span-5',
    height: 'h-64',
  },
  {
    name: 'Hot Drinks',
    desc: 'Brewed to warm the soul.',
    image: 'https://images.pexels.com/photos/30428206/pexels-photo-30428206.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940',
    span: 'md:col-span-4',
    height: 'h-64',
  },
];

const MenuPreviewSection = ({ onViewMenu }) => {
  const navigate = useNavigate();

  return (
    <section className="py-16 md:py-20 px-6 md:px-12" style={{ background: '#FBFBFD' }}>
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div {...fadeUp} className="text-center mb-10 md:mb-14">
          <p
            className="text-sm tracking-[0.2em] uppercase mb-4"
            style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}
          >
            Our Menu
          </p>
          <h2
            className="text-4xl sm:text-5xl font-semibold tracking-tight mb-6"
            style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
          >
            Made with heart.<br className="hidden sm:block" /> Served with pride.
          </h2>
          <p
            className="text-base md:text-lg max-w-xl mx-auto leading-relaxed"
            style={{ color: '#86868B' }}
          >
            Every dish tells a story of fresh ingredients, family recipes, and honest cooking.
          </p>
        </motion.div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-5">
          {menuItems.map((item, i) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.7, delay: i * 0.08, ease }}
              className={`${item.span} relative group cursor-pointer overflow-hidden`}
              style={{ borderRadius: '1.5rem' }}
              onClick={onViewMenu || (() => navigate('/menu-catalog'))}
              data-testid={`menu-card-${item.name.toLowerCase().replace(/\s/g, '-')}`}
            >
              <div className={`relative ${item.height} overflow-hidden`} style={{ borderRadius: '1.5rem' }}>
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />

                {/* Glass label */}
                <div className="absolute bottom-4 left-4 right-4">
                  <div
                    className="inline-flex flex-col px-5 py-3 backdrop-blur-2xl"
                    style={{
                      background: 'rgba(255,255,255,0.75)',
                      borderRadius: '1rem',
                      border: '1px solid rgba(255,255,255,0.4)',
                    }}
                  >
                    <span
                      className="text-sm font-semibold tracking-tight"
                      style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
                    >
                      {item.name}
                    </span>
                    <span className="text-xs mt-0.5" style={{ color: '#86868B' }}>
                      {item.desc}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div {...fadeUp} className="text-center mt-10">
          <button
            data-testid="menu-view-full-btn"
            onClick={onViewMenu || (() => navigate('/menu-catalog'))}
            className="px-8 py-4 rounded-full text-sm font-medium tracking-wide transition-colors duration-300"
            style={{ background: '#F5F5F7', color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
            onMouseEnter={e => e.target.style.background = '#E8E8ED'}
            onMouseLeave={e => e.target.style.background = '#F5F5F7'}
          >
            View Full Menu
          </button>
        </motion.div>
      </div>
    </section>
  );
};

export default MenuPreviewSection;
