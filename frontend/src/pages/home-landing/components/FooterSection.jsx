import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const ease = [0.16, 1, 0.3, 1];

const FooterSection = () => {
  const navigate = useNavigate();
  const year = new Date().getFullYear();

  const links = {
    Explore: [
      { label: 'Menu', path: '/menu-catalog' },
      { label: 'Order Online', path: '/menu-catalog' },
      { label: 'Reservations', path: '/table-reservation' },
      { label: 'Track Order', path: '/order-tracking' },
    ],
    Locations: [
      { label: 'Timperley, Altrincham' },
      { label: 'Howe Bridge, Atherton' },
      { label: 'Chaddesden, Derby' },
      { label: 'Oakmere, Handforth' },
      { label: 'Willowmere, Middlewich' },
    ],
    Connect: [
      { label: 'Facebook', url: '#' },
      { label: 'Instagram', url: '#' },
      { label: 'Twitter', url: '#' },
    ],
  };

  return (
    <footer>
      {/* Newsletter */}
      <section className="py-16 md:py-20 px-6 md:px-12" style={{ background: '#FBFBFD' }}>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease }}
          className="max-w-2xl mx-auto text-center p-10 md:p-14"
          style={{ background: '#F5F5F7', borderRadius: '2rem' }}
        >
          <h3
            className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4"
            style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
          >
            Stay in the loop.
          </h3>
          <p className="text-sm mb-8" style={{ color: '#86868B' }}>
            New dishes, seasonal specials, and exclusive offers — straight to your inbox.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              data-testid="newsletter-email-input"
              type="email"
              placeholder="you@email.com"
              className="flex-1 px-5 py-3.5 rounded-full text-sm outline-none"
              style={{
                background: '#FFFFFF',
                color: '#1D1D1F',
                border: 'none',
              }}
            />
            <button
              data-testid="newsletter-subscribe-btn"
              className="px-7 py-3.5 rounded-full text-sm font-medium tracking-wide transition-colors duration-300"
              style={{ background: '#1D1D1F', color: '#FFFFFF', fontFamily: 'Outfit, sans-serif' }}
              onMouseEnter={e => e.target.style.background = '#333336'}
              onMouseLeave={e => e.target.style.background = '#1D1D1F'}
            >
              Subscribe
            </button>
          </div>
        </motion.div>
      </section>

      {/* Footer Links */}
      <div className="px-6 md:px-12 py-16 md:py-20" style={{ background: '#FBFBFD', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-16">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <img
                  src="/assets/images/logo-2-1774630354696.png"
                  alt="Jollys Kafe"
                  className="h-10 w-auto"
                />
                <span
                  className="text-lg font-semibold tracking-tight"
                  style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
                >
                  Jolly's Kafe
                </span>
              </div>
              <p className="text-sm leading-relaxed max-w-xs" style={{ color: '#86868B' }}>
                Family-run cafes serving traditional English food across Manchester, Cheshire &amp; Derby.
              </p>
            </div>

            {/* Link Columns */}
            {Object.entries(links).map(([title, items]) => (
              <div key={title}>
                <h4
                  className="text-xs font-medium tracking-[0.15em] uppercase mb-4"
                  style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}
                >
                  {title}
                </h4>
                <ul className="space-y-2.5">
                  {items.map((item) => (
                    <li key={item.label}>
                      {item.path ? (
                        <button
                          onClick={() => navigate(item.path)}
                          className="text-sm transition-colors duration-200 hover:underline"
                          style={{ color: '#1D1D1F' }}
                        >
                          {item.label}
                        </button>
                      ) : (
                        <span className="text-sm" style={{ color: '#86868B' }}>
                          {item.label}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom Bar */}
          <div
            className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-8"
            style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}
          >
            <p className="text-xs" style={{ color: '#86868B' }}>
              &copy; {year} Jolly's Kafe. All rights reserved.
            </p>
            <div className="flex gap-6">
              <a href="#" className="text-xs transition-colors duration-200 hover:underline" style={{ color: '#86868B' }}>Privacy</a>
              <a href="#" className="text-xs transition-colors duration-200 hover:underline" style={{ color: '#86868B' }}>Terms</a>
              <a href="#" className="text-xs transition-colors duration-200 hover:underline" style={{ color: '#86868B' }}>Cookies</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default FooterSection;
