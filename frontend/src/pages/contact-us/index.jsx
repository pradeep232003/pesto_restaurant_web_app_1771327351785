import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, CheckCircle, AlertCircle, MapPin, Phone, Mail } from 'lucide-react';
import Header from '../../components/ui/Header';
import { useLocation2 } from '../../contexts/LocationContext';

const API_URL = import.meta.env.VITE_REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL || '';
const ease = [0.16, 1, 0.3, 1];

const generateChallenge = () => {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  return { a, b, answer: a + b };
};

const ContactUs = () => {
  const navigate = useNavigate();
  const { locations, selectedLocation } = useLocation2();
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '', location_id: '' });
  const [honeypot, setHoneypot] = useState('');
  const [challenge, setChallenge] = useState(generateChallenge);
  const [captchaInput, setCaptchaInput] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const formStartTime = useRef(Date.now());

  useEffect(() => {
    if (selectedLocation?.id) {
      setForm(f => ({ ...f, location_id: selectedLocation.id }));
    }
  }, [selectedLocation]);

  const set = (field, value) => {
    setForm(f => ({ ...f, [field]: value }));
    if (errors[field]) setErrors(e => ({ ...e, [field]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email address';
    if (!form.message.trim()) e.message = 'Message is required';
    else if (form.message.trim().length < 10) e.message = 'Please write at least 10 characters';
    if (parseInt(captchaInput) !== challenge.answer) e.captcha = 'Incorrect answer';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    setSubmitError('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          _hp: honeypot,
          _ts: Date.now() - formStartTime.current,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to send message');
      }
      setSuccess(true);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setForm({ name: '', email: '', phone: '', subject: '', message: '', location_id: selectedLocation?.id || '' });
    setHoneypot('');
    setCaptchaInput('');
    setChallenge(generateChallenge());
    setErrors({});
    setSuccess(false);
    setSubmitError('');
    formStartTime.current = Date.now();
  };

  const inputStyle = {
    background: '#F5F5F7',
    color: '#1D1D1F',
    border: '1px solid transparent',
    fontFamily: 'Outfit, sans-serif',
    borderRadius: '0.75rem',
  };

  const InputField = ({ label, value, onChange, type = 'text', error, required, ...props }) => (
    <div>
      <label className="block text-xs tracking-[0.08em] uppercase mb-2" style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}>
        {label}{required && <span style={{ color: '#FF3B30' }}> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        className="w-full px-4 py-3 text-sm outline-none transition-all duration-200"
        style={{ ...inputStyle, borderColor: error ? 'rgba(255,59,48,0.5)' : 'transparent' }}
        onFocus={e => { if (!error) e.target.style.borderColor = 'rgba(0,0,0,0.15)'; }}
        onBlur={e => { if (!error) e.target.style.borderColor = 'transparent'; }}
        {...props}
      />
      {error && <p className="text-xs mt-1" style={{ color: '#FF3B30' }}>{error}</p>}
    </div>
  );

  const activeLocations = (locations || []).filter(l => l.is_active !== false);

  return (
    <div className="min-h-screen" style={{ background: '#FBFBFD' }}>
      <Header cartCount={0} onCartClick={() => navigate('/shopping-cart')} onAccountClick={() => {}} onSearch={() => {}} onLogout={() => {}} />

      <main className="pt-16">
        {/* Hero */}
        <section className="pt-14 pb-6 md:pt-18 md:pb-8 px-6 md:px-12 text-center">
          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
            className="text-sm tracking-[0.2em] uppercase mb-3"
            style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}
          >
            Get in touch
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease }}
            className="text-4xl sm:text-5xl font-semibold tracking-tight mb-4"
            style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
          >
            Contact Us.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease }}
            className="text-base max-w-md mx-auto"
            style={{ color: '#86868B' }}
          >
            We'd love to hear from you. Send us a message and we'll get back as soon as we can.
          </motion.p>
        </section>

        <section className="px-6 md:px-12 pb-20">
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12">

            {/* Form — left */}
            <div className="lg:col-span-3">
              <AnimatePresence mode="wait">
                {success ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.4, ease }}
                    className="text-center py-16 px-6"
                    style={{ background: '#FFFFFF', borderRadius: '1.5rem', border: '1px solid rgba(0,0,0,0.06)' }}
                  >
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(52,199,89,0.1)' }}>
                      <CheckCircle size={32} style={{ color: '#34C759' }} strokeWidth={1.5} />
                    </div>
                    <h2 className="text-2xl font-semibold tracking-tight mb-3" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>
                      Message Sent.
                    </h2>
                    <p className="text-sm mb-8" style={{ color: '#86868B' }}>
                      Thank you for reaching out. We'll get back to you shortly.
                    </p>
                    <button
                      data-testid="contact-send-another-btn"
                      onClick={handleReset}
                      className="px-7 py-3.5 rounded-full text-sm font-medium tracking-wide transition-colors duration-300"
                      style={{ background: '#F5F5F7', color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#E8E8ED'}
                      onMouseLeave={e => e.currentTarget.style.background = '#F5F5F7'}
                    >
                      Send Another Message
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease }}
                    className="p-6 sm:p-8"
                    style={{ background: '#FFFFFF', borderRadius: '1.5rem', border: '1px solid rgba(0,0,0,0.06)' }}
                  >
                    <form onSubmit={handleSubmit} className="space-y-5">
                      {/* Honeypot — hidden from users */}
                      <div style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
                        <input
                          type="text"
                          name="website"
                          tabIndex={-1}
                          autoComplete="off"
                          value={honeypot}
                          onChange={e => setHoneypot(e.target.value)}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InputField label="Name" value={form.name} onChange={e => set('name', e.target.value)} error={errors.name} required />
                        <InputField label="Email" type="email" value={form.email} onChange={e => set('email', e.target.value)} error={errors.email} required />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InputField label="Phone" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="Optional" />
                        <div>
                          <label className="block text-xs tracking-[0.08em] uppercase mb-2" style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}>
                            Location
                          </label>
                          <select
                            data-testid="contact-location-select"
                            value={form.location_id}
                            onChange={e => set('location_id', e.target.value)}
                            className="w-full px-4 py-3 text-sm outline-none appearance-none cursor-pointer"
                            style={inputStyle}
                          >
                            <option value="">General Enquiry</option>
                            {activeLocations.map(loc => (
                              <option key={loc.id} value={loc.id}>{loc.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <InputField label="Subject" value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Optional" />

                      <div>
                        <label className="block text-xs tracking-[0.08em] uppercase mb-2" style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}>
                          Message <span style={{ color: '#FF3B30' }}>*</span>
                        </label>
                        <textarea
                          data-testid="contact-message-input"
                          value={form.message}
                          onChange={e => set('message', e.target.value)}
                          rows={4}
                          placeholder="How can we help you?"
                          className="w-full px-4 py-3 text-sm outline-none resize-none transition-all duration-200"
                          style={{ ...inputStyle, borderColor: errors.message ? 'rgba(255,59,48,0.5)' : 'transparent' }}
                          onFocus={e => { if (!errors.message) e.target.style.borderColor = 'rgba(0,0,0,0.15)'; }}
                          onBlur={e => { if (!errors.message) e.target.style.borderColor = 'transparent'; }}
                        />
                        {errors.message && <p className="text-xs mt-1" style={{ color: '#FF3B30' }}>{errors.message}</p>}
                      </div>

                      {/* Math captcha */}
                      <div
                        className="flex items-center gap-4 px-5 py-4"
                        style={{ background: '#F5F5F7', borderRadius: '0.75rem' }}
                      >
                        <p className="text-sm flex-shrink-0" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>
                          What is <strong>{challenge.a} + {challenge.b}</strong>?
                        </p>
                        <input
                          data-testid="contact-captcha-input"
                          type="text"
                          inputMode="numeric"
                          value={captchaInput}
                          onChange={e => { setCaptchaInput(e.target.value); if (errors.captcha) setErrors(er => ({ ...er, captcha: '' })); }}
                          placeholder="?"
                          className="w-16 px-3 py-2 text-sm text-center rounded-lg outline-none"
                          style={{ background: '#FFFFFF', color: '#1D1D1F', border: errors.captcha ? '1px solid rgba(255,59,48,0.5)' : '1px solid rgba(0,0,0,0.08)' }}
                        />
                        {errors.captcha && <p className="text-xs" style={{ color: '#FF3B30' }}>{errors.captcha}</p>}
                      </div>

                      <AnimatePresence>
                        {submitError && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                            className="flex items-center gap-3 px-5 py-4 rounded-2xl"
                            style={{ background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.12)' }}
                          >
                            <AlertCircle size={16} style={{ color: '#FF3B30' }} />
                            <p className="text-sm" style={{ color: '#FF3B30' }}>{submitError}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <button
                        data-testid="contact-submit-btn"
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3.5 rounded-full text-sm font-medium tracking-wide transition-all duration-300 disabled:opacity-60 flex items-center justify-center gap-2"
                        style={{ background: '#1D1D1F', color: '#FFFFFF', fontFamily: 'Outfit, sans-serif' }}
                        onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = '#333336'; }}
                        onMouseLeave={e => { if (!submitting) e.currentTarget.style.background = '#1D1D1F'; }}
                      >
                        {submitting ? 'Sending...' : (<><Send size={15} /> Send Message</>)}
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Sidebar — right */}
            <div className="lg:col-span-2">
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.15, ease }}
                className="sticky top-24 space-y-4"
              >
                {/* Locations list */}
                <div className="p-6" style={{ background: '#FFFFFF', borderRadius: '1.5rem', border: '1px solid rgba(0,0,0,0.06)' }}>
                  <h3 className="text-lg font-semibold tracking-tight mb-5" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>
                    Our Cafes
                  </h3>
                  <div className="space-y-4">
                    {activeLocations.map(loc => (
                      <div key={loc.id} className="pb-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                        <div className="flex items-start gap-3">
                          <MapPin size={15} className="mt-0.5 flex-shrink-0" style={{ color: '#86868B' }} />
                          <div>
                            <p className="text-sm font-medium" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>
                              {loc.name}
                            </p>
                            {loc.phone && (
                              <a
                                href={`tel:${loc.phone.replace(/\s/g, '')}`}
                                className="inline-flex items-center gap-1.5 text-xs mt-1 transition-colors hover:underline"
                                style={{ color: '#86868B' }}
                              >
                                <Phone size={10} />
                                {loc.phone}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* General email */}
                <div className="p-5 flex items-center gap-3" style={{ background: '#F5F5F7', borderRadius: '1rem' }}>
                  <Mail size={16} style={{ color: '#86868B' }} />
                  <div>
                    <p className="text-xs tracking-[0.08em] uppercase" style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}>Email</p>
                    <p className="text-sm font-medium" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>info@jollyskafe.com</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default ContactUs;
