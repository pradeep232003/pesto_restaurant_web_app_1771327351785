import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { X, Phone } from 'lucide-react';
import { useLocation2 } from '../../../contexts/LocationContext';

const ease = [0.16, 1, 0.3, 1];

const PolicyModal = ({ title, content, onClose }) => (
  <>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70]"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    />
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ duration: 0.3, ease }}
      className="fixed inset-0 z-[71] flex items-center justify-center px-5"
    >
      <div
        className="w-full max-w-lg max-h-[80vh] overflow-y-auto"
        style={{
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(40px)',
          borderRadius: '1.5rem',
          border: '1px solid rgba(255,255,255,0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <h2 className="text-lg font-semibold tracking-tight" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>
            {title}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.05)' }}>
            <X size={16} style={{ color: '#86868B' }} />
          </button>
        </div>
        <div className="px-6 py-5 text-sm leading-relaxed" style={{ color: '#424245', fontFamily: 'Outfit, sans-serif' }}>
          {content}
        </div>
      </div>
    </motion.div>
  </>
);

const privacyContent = (
  <div className="space-y-4">
    <p>At Jolly's Kafe, we are committed to protecting your privacy and personal data. This policy outlines how we collect, use, and safeguard your information.</p>
    <h3 className="font-semibold" style={{ color: '#1D1D1F' }}>Information We Collect</h3>
    <p>We collect information you provide when creating an account, placing orders, or making reservations — including your name, email address, phone number, and order history.</p>
    <h3 className="font-semibold" style={{ color: '#1D1D1F' }}>How We Use Your Data</h3>
    <p>Your data is used to process orders, manage reservations, send order confirmations, and improve our services. We do not sell your personal information to third parties.</p>
    <h3 className="font-semibold" style={{ color: '#1D1D1F' }}>Data Security</h3>
    <p>We implement industry-standard security measures to protect your data, including encrypted connections and secure password storage.</p>
    <h3 className="font-semibold" style={{ color: '#1D1D1F' }}>Contact</h3>
    <p>For any privacy-related queries, please contact us at any of our cafe locations.</p>
    <p className="text-xs" style={{ color: '#86868B' }}>Last updated: March 2026</p>
  </div>
);

const termsContent = (
  <div className="space-y-4">
    <p>By using the Jolly's Kafe website and services, you agree to the following terms and conditions.</p>
    <h3 className="font-semibold" style={{ color: '#1D1D1F' }}>Orders & Collection</h3>
    <p>All online orders are for collection only. Orders must be collected from the selected cafe location. We reserve the right to cancel orders if items become unavailable.</p>
    <h3 className="font-semibold" style={{ color: '#1D1D1F' }}>Reservations</h3>
    <p>Reservations are held for 15 minutes past the booked time. Cancellations must be made at least 2 hours in advance. Large parties of 8 or more may require a deposit.</p>
    <h3 className="font-semibold" style={{ color: '#1D1D1F' }}>Prepaid Wallets</h3>
    <p>Resident prepaid wallet balances are non-refundable and can only be used at eligible Jolly's Kafe locations. Wallet balances do not expire.</p>
    <h3 className="font-semibold" style={{ color: '#1D1D1F' }}>Pricing</h3>
    <p>Menu prices may vary by location and are subject to change. Resident pricing is available only at wallet-enabled locations with a valid resident account.</p>
    <p className="text-xs" style={{ color: '#86868B' }}>Last updated: March 2026</p>
  </div>
);

const cookiesContent = (
  <div className="space-y-4">
    <p>Jolly's Kafe uses cookies and similar technologies to provide and improve our services.</p>
    <h3 className="font-semibold" style={{ color: '#1D1D1F' }}>Essential Cookies</h3>
    <p>These cookies are required for the website to function properly, including authentication, cart management, and location preferences. They cannot be disabled.</p>
    <h3 className="font-semibold" style={{ color: '#1D1D1F' }}>Functional Cookies</h3>
    <p>These remember your preferences such as selected cafe location, improving your browsing experience across visits.</p>
    <h3 className="font-semibold" style={{ color: '#1D1D1F' }}>Managing Cookies</h3>
    <p>You can manage cookie preferences through your browser settings. Disabling essential cookies may affect website functionality.</p>
    <p className="text-xs" style={{ color: '#86868B' }}>Last updated: March 2026</p>
  </div>
);

const FooterSection = ({ onOrderOnline, onViewMenu }) => {
  const navigate = useNavigate();
  const { locations } = useLocation2();
  const [activeModal, setActiveModal] = useState(null);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState(null); // 'loading' | 'success' | 'error'
  const [newsletterMsg, setNewsletterMsg] = useState('');

  const API_BASE = import.meta.env.VITE_API_URL ||
    (typeof window !== 'undefined' && window.location.hostname === 'www.jollyskafe.com'
      ? 'https://jollys-kafe-backend-production.up.railway.app' : '');

  const handleSubscribe = async () => {
    if (!newsletterEmail || !newsletterEmail.includes('@')) {
      setNewsletterStatus('error');
      setNewsletterMsg('Please enter a valid email.');
      return;
    }
    setNewsletterStatus('loading');
    try {
      const res = await fetch(`${API_BASE}/api/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newsletterEmail }),
      });
      const data = await res.json();
      if (data.success) {
        setNewsletterStatus('success');
        setNewsletterMsg(data.message);
        setNewsletterEmail('');
      } else {
        setNewsletterStatus('error');
        setNewsletterMsg(data.detail || 'Something went wrong.');
      }
    } catch {
      setNewsletterStatus('error');
      setNewsletterMsg('Could not connect. Please try again.');
    }
  };

  const exploreLinks = [
    { label: 'Menu', action: onViewMenu || (() => navigate('/menu-catalog')) },
    { label: 'Order Online', action: onOrderOnline || (() => navigate('/menu-catalog')) },
    { label: 'Track Order', action: () => navigate('/order-status') },
    { label: 'Contact Us', action: () => navigate('/contact-us') },
  ];

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
          {newsletterStatus === 'success' ? (
            <p className="text-sm font-medium" style={{ color: '#34C759' }}>{newsletterMsg}</p>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <input
                  data-testid="newsletter-email-input"
                  type="email"
                  placeholder="you@email.com"
                  value={newsletterEmail}
                  onChange={e => { setNewsletterEmail(e.target.value); setNewsletterStatus(null); }}
                  onKeyDown={e => e.key === 'Enter' && handleSubscribe()}
                  className="flex-1 px-5 py-3.5 rounded-full text-sm outline-none"
                  style={{ background: '#FFFFFF', color: '#1D1D1F', border: 'none' }}
                />
                <button
                  data-testid="newsletter-subscribe-btn"
                  onClick={handleSubscribe}
                  disabled={newsletterStatus === 'loading'}
                  className="px-7 py-3.5 rounded-full text-sm font-medium tracking-wide transition-colors duration-300"
                  style={{ background: '#1D1D1F', color: '#FFFFFF', fontFamily: 'Outfit, sans-serif', opacity: newsletterStatus === 'loading' ? 0.6 : 1 }}
                  onMouseEnter={e => e.target.style.background = '#333336'}
                  onMouseLeave={e => e.target.style.background = '#1D1D1F'}
                >
                  {newsletterStatus === 'loading' ? 'Subscribing...' : 'Subscribe'}
                </button>
              </div>
              {newsletterStatus === 'error' && (
                <p className="text-xs mt-3" style={{ color: '#FF3B30' }}>{newsletterMsg}</p>
              )}
            </>
          )}
        </motion.div>
      </section>

      {/* Footer Links */}
      <div className="px-6 md:px-12 py-16 md:py-20" style={{ background: '#FBFBFD', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-16">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <img src="/assets/images/logo-2-1774630354696.png" alt="Jollys Kafe" className="h-10 w-auto" />
                <span className="text-lg font-semibold tracking-tight" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>
                  Jolly's Kafe
                </span>
              </div>
              <p className="text-sm leading-relaxed max-w-xs" style={{ color: '#86868B' }}>
                Family-run cafes serving traditional English food across Manchester, Cheshire &amp; Derby.
              </p>
            </div>

            {/* Explore */}
            <div>
              <h4 className="text-xs font-medium tracking-[0.15em] uppercase mb-4" style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}>
                Explore
              </h4>
              <ul className="space-y-2.5">
                {exploreLinks.map(item => (
                  <li key={item.label}>
                    <button
                      onClick={item.action}
                      className="text-sm transition-colors duration-200 hover:underline"
                      style={{ color: '#1D1D1F' }}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Locations with phone */}
            <div>
              <h4 className="text-xs font-medium tracking-[0.15em] uppercase mb-4" style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}>
                Locations
              </h4>
              <ul className="space-y-3">
                {(locations || []).filter(l => l.is_active !== false).map(loc => (
                  <li key={loc.id}>
                    <span className="text-sm block" style={{ color: '#1D1D1F' }}>{loc.name}</span>
                    {loc.phone && (
                      <a
                        href={`tel:${loc.phone.replace(/\s/g, '')}`}
                        className="inline-flex items-center gap-1 text-xs mt-0.5 transition-colors duration-200 hover:underline"
                        style={{ color: '#86868B' }}
                      >
                        <Phone size={10} />
                        {loc.phone}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Connect */}
            <div>
              <h4 className="text-xs font-medium tracking-[0.15em] uppercase mb-4" style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}>
                Connect
              </h4>
              <ul className="space-y-2.5">
                <li><a href="https://www.facebook.com/jollyskaf/?locale=en_GB" target="_blank" rel="noopener noreferrer" className="text-sm transition-colors duration-200 hover:underline" style={{ color: '#1D1D1F' }}>Facebook</a></li>
                <li><a href="https://www.instagram.com/jollyskafe/" target="_blank" rel="noopener noreferrer" className="text-sm transition-colors duration-200 hover:underline" style={{ color: '#1D1D1F' }}>Instagram</a></li>
                <li><a href="https://x.com/jollyskafe" target="_blank" rel="noopener noreferrer" className="text-sm transition-colors duration-200 hover:underline" style={{ color: '#1D1D1F' }}>Twitter</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-8" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <p className="text-xs" style={{ color: '#86868B' }}>
              &copy; 2018 Jolly's Kafe. All rights reserved. Developed by JPTECK LTD.
            </p>
            <div className="flex gap-6">
              <button onClick={() => setActiveModal('privacy')} className="text-xs transition-colors duration-200 hover:underline" style={{ color: '#86868B' }}>Privacy</button>
              <button onClick={() => setActiveModal('terms')} className="text-xs transition-colors duration-200 hover:underline" style={{ color: '#86868B' }}>Terms</button>
              <button onClick={() => setActiveModal('cookies')} className="text-xs transition-colors duration-200 hover:underline" style={{ color: '#86868B' }}>Cookies</button>
            </div>
          </div>
        </div>
      </div>

      {/* Policy Modals */}
      <AnimatePresence>
        {activeModal === 'privacy' && <PolicyModal title="Privacy Policy" content={privacyContent} onClose={() => setActiveModal(null)} />}
        {activeModal === 'terms' && <PolicyModal title="Terms & Conditions" content={termsContent} onClose={() => setActiveModal(null)} />}
        {activeModal === 'cookies' && <PolicyModal title="Cookie Policy" content={cookiesContent} onClose={() => setActiveModal(null)} />}
      </AnimatePresence>
    </footer>
  );
};

export default FooterSection;
