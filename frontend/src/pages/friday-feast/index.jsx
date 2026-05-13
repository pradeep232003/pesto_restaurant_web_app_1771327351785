import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, MapPin, Clock, ShoppingBag, AlertCircle } from 'lucide-react';
import Header from '../../components/ui/Header';
import api, { resolveImageUrl } from '../../lib/api';
import { useLocation2 } from '../../contexts/LocationContext';

const font = { fontFamily: 'Outfit, sans-serif' };

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
};

const FridayFeast = () => {
  const navigate = useNavigate();
  const { selectedCafeLocation, locations, setSelectedCafeLocation } = useLocation2();
  const [menu, setMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('bundle'); // 'bundle' | 'single'
  const [picks, setPicks] = useState({ starter: null, main: null, dessert: null });
  const [step, setStep] = useState('browse'); // browse | details | submitting
  const [details, setDetails] = useState({ name: '', phone: '', email: '', notes: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    const id = selectedCafeLocation?.id;
    setLoading(true);
    api.getFridayMenu(id)
      .then(m => setMenu(m))
      .catch(() => setMenu(null))
      .finally(() => setLoading(false));
  }, [selectedCafeLocation?.id]);

  useEffect(() => {
    // Default to bundle if available, else single
    if (menu && !menu.bundle_enabled) setMode('single');
  }, [menu]);

  const allowedCoursesForSingle = ['starter', 'main', 'dessert'];

  const cartReady = useMemo(() => {
    if (!menu) return false;
    if (mode === 'bundle') return picks.starter && picks.main && picks.dessert;
    return !!(picks.starter || picks.main || picks.dessert);
  }, [menu, mode, picks]);

  const total = useMemo(() => {
    if (!menu || !cartReady) return 0;
    if (mode === 'bundle') return Number(menu.bundle_price || 0);
    const k = ['starter', 'main', 'dessert'].find(c => picks[c]);
    return Number(picks[k]?.price || 0);
  }, [menu, mode, picks, cartReady]);

  const pickItem = (course, item) => {
    if (item.sold_out) return;
    if (mode === 'single') {
      // single-mode picks: clear others
      setPicks({ starter: null, main: null, dessert: null, [course]: item });
    } else {
      setPicks(p => ({ ...p, [course]: p[course]?.id === item.id ? null : item }));
    }
  };

  const goToDetails = () => {
    setError('');
    if (!selectedCafeLocation) { setError('Please choose your cafe first.'); return; }
    if (!menu.window_open) { setError('Orders for this Friday have closed.'); return; }
    if (!cartReady) { setError(mode === 'bundle' ? 'Pick one starter, one main and one dessert.' : 'Pick one course.'); return; }
    setStep('details');
  };

  const submit = async () => {
    if (!details.name.trim() || !details.phone.trim()) {
      setError('Name and phone are required so we can confirm pickup.');
      return;
    }
    setStep('submitting'); setError('');
    try {
      const lines = mode === 'bundle'
        ? [
            { item_id: picks.starter.id, course: 'starter' },
            { item_id: picks.main.id, course: 'main' },
            { item_id: picks.dessert.id, course: 'dessert' },
          ]
        : (() => {
            const k = allowedCoursesForSingle.find(c => picks[c]);
            return [{ item_id: picks[k].id, course: k }];
          })();
      const { url } = await api.fridayCheckout({
        menu_id: menu.id,
        location_id: selectedCafeLocation.id,
        bundle: mode === 'bundle',
        lines,
        customer_name: details.name.trim(),
        customer_phone: details.phone.trim(),
        customer_email: details.email.trim(),
        notes: details.notes.trim(),
        origin_url: window.location.origin,
      });
      window.location.href = url; // Redirect to Stripe
    } catch (err) {
      setError(err.message);
      setStep('details');
    }
  };

  return (
    <div className="min-h-screen" style={{ background: '#FBFBFD', ...font }}>
      <Header onLogout={() => {}} />
      <main className="pt-16">
        <section className="py-12 sm:py-20" style={{ background: 'linear-gradient(180deg, #1a1410 0%, #2a1d18 100%)' }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center" style={{ color: '#fff' }}>
            <p className="text-xs sm:text-sm font-semibold tracking-[0.18em] uppercase mb-2" style={{ color: '#D4AF37' }}>
              Friday only · Pre-order Sun–Wed
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight">Friday Feast</h1>
            {menu && (
              <p className="mt-3 text-base sm:text-lg" style={{ color: 'rgba(255,255,255,0.85)' }}>
                {fmtDate(menu.week_friday)} · pickup {menu.pickup_time || '3pm'}
                {selectedCafeLocation ? ` at ${selectedCafeLocation.name}` : ''}
              </p>
            )}
          </div>
        </section>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
          {!selectedCafeLocation && (
            <div className="text-center py-12">
              <MapPin size={32} className="mx-auto mb-3" style={{ color: '#86868B' }} />
              <p className="text-base font-medium mb-1" style={{ color: '#1D1D1F' }}>Choose your cafe to see this week's feast</p>
              <p className="text-sm mb-4" style={{ color: '#86868B' }}>Friday Feast is rolling out at participating sites.</p>
              <div className="flex flex-wrap justify-center gap-2">
                {locations.map(l => (
                  <button key={l.id} onClick={() => setSelectedCafeLocation(l)}
                    data-testid={`pick-loc-${l.id}`}
                    className="px-4 py-2 rounded-full text-sm font-medium active:scale-95"
                    style={{ background: '#1D1D1F', color: '#fff' }}>{l.name}</button>
                ))}
              </div>
            </div>
          )}

          {selectedCafeLocation && loading && (
            <p className="text-center py-12" style={{ color: '#86868B' }}>Loading this week's menu…</p>
          )}

          {selectedCafeLocation && !loading && !menu && (
            <div className="text-center py-12">
              <ShoppingBag size={32} className="mx-auto mb-3" style={{ color: '#86868B' }} />
              <p className="text-base font-medium mb-1" style={{ color: '#1D1D1F' }}>
                {selectedCafeLocation.name} isn't running Friday Feast this week.
              </p>
              <p className="text-sm" style={{ color: '#86868B' }}>Check back next week, or try a different cafe.</p>
            </div>
          )}

          {selectedCafeLocation && !loading && menu && step === 'browse' && (
            <>
              {/* Mode toggle */}
              {menu.bundle_enabled && menu.bundle_price ? (
                <div className="flex items-center justify-center gap-2 mb-8">
                  <ModeBtn active={mode === 'bundle'} onClick={() => { setMode('bundle'); setPicks({ starter: null, main: null, dessert: null }); }}
                    label={`3-course bundle · £${Number(menu.bundle_price).toFixed(2)}`} testid="mode-bundle" />
                  <ModeBtn active={mode === 'single'} onClick={() => { setMode('single'); setPicks({ starter: null, main: null, dessert: null }); }}
                    label="Just one course" testid="mode-single" />
                </div>
              ) : (
                <p className="text-center text-sm mb-6" style={{ color: '#86868B' }}>Pick any one course this week.</p>
              )}

              {!menu.window_open && (
                <div className="mb-6 p-3 rounded-xl text-sm flex items-center gap-2"
                  style={{ background: 'rgba(255,149,0,0.12)', color: '#A35E00' }}>
                  <AlertCircle size={18} /> Orders for this Friday have closed. Back next week!
                </div>
              )}

              {['starters', 'mains', 'desserts'].map(courseKey => {
                const course = courseKey.slice(0, -1); // 'starter' etc.
                return (
                  <CourseSection key={courseKey} title={courseKey.charAt(0).toUpperCase() + courseKey.slice(1)}
                    items={menu[courseKey] || []}
                    selectedId={picks[course]?.id}
                    onPick={(it) => pickItem(course, it)}
                    mode={mode} />
                );
              })}

              {error && (
                <div className="my-4 p-3 rounded-xl text-sm" style={{ background: 'rgba(255,59,48,0.1)', color: '#B5170E' }}>{error}</div>
              )}

              {/* Sticky cart */}
              {cartReady && menu.window_open && (
                <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                  className="fixed bottom-4 left-4 right-4 max-w-2xl mx-auto rounded-2xl p-4 flex items-center gap-3"
                  style={{ background: '#1D1D1F', color: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.6)' }}>Total</p>
                    <p className="text-xl font-semibold">£{total.toFixed(2)}</p>
                  </div>
                  <button data-testid="checkout-btn" onClick={goToDetails}
                    className="px-5 py-3 rounded-full text-sm font-semibold active:scale-95"
                    style={{ background: '#fff', color: '#1D1D1F' }}>
                    Continue →
                  </button>
                </motion.div>
              )}
            </>
          )}

          {selectedCafeLocation && step === 'details' && menu && (
            <div className="max-w-md mx-auto py-6">
              <h2 className="text-2xl font-semibold mb-1" style={{ color: '#1D1D1F' }}>Almost there</h2>
              <p className="text-sm mb-6" style={{ color: '#86868B' }}>We'll WhatsApp / text you the pickup details.</p>

              <Input testid="customer-name" label="Your name" value={details.name}
                onChange={v => setDetails(d => ({ ...d, name: v }))} placeholder="First & last name" />
              <Input testid="customer-phone" label="Mobile" type="tel" value={details.phone}
                onChange={v => setDetails(d => ({ ...d, phone: v }))} placeholder="07…" />
              <Input testid="customer-email" label="Email (optional)" type="email" value={details.email}
                onChange={v => setDetails(d => ({ ...d, email: v }))} placeholder="" />
              <Input testid="customer-notes" label="Allergies / notes (optional)" value={details.notes}
                onChange={v => setDetails(d => ({ ...d, notes: v }))} placeholder="e.g. gluten-free" />

              <div className="my-4 p-3 rounded-xl text-sm" style={{ background: '#F8F8FA' }}>
                <p className="font-semibold mb-1" style={{ color: '#1D1D1F' }}>
                  £{total.toFixed(2)} · {selectedCafeLocation.name} · {fmtDate(menu.week_friday)} {menu.pickup_time || '3pm'}
                </p>
                <p className="text-xs" style={{ color: '#86868B' }}>You'll pay now with card via Stripe — fully refundable until {menu.order_window_end?.slice(0, 10) || 'Wed'}.</p>
              </div>

              {error && (
                <div className="mb-3 p-2.5 rounded-lg text-sm" style={{ background: 'rgba(255,59,48,0.1)', color: '#B5170E' }}>{error}</div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStep('browse')} data-testid="back-to-browse"
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold active:scale-95"
                  style={{ background: '#F2F2F7', color: '#1D1D1F' }}>Back</button>
                <button onClick={submit} data-testid="pay-now-btn"
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-white active:scale-95"
                  style={{ background: '#1D1D1F' }}>Pay £{total.toFixed(2)} →</button>
              </div>
            </div>
          )}

          {step === 'submitting' && (
            <p className="text-center py-12" style={{ color: '#86868B' }}>Redirecting to secure payment…</p>
          )}
        </div>
      </main>
    </div>
  );
};

const ModeBtn = ({ active, onClick, label, testid }) => (
  <button data-testid={testid} onClick={onClick}
    className="px-4 py-2 rounded-full text-sm font-semibold active:scale-95"
    style={{ background: active ? '#1D1D1F' : '#F2F2F7', color: active ? '#fff' : '#1D1D1F' }}>
    {label}
  </button>
);

const Input = ({ label, value, onChange, type = 'text', placeholder, testid }) => (
  <div className="mb-3">
    <label className="block text-xs font-semibold mb-1.5"
      style={{ color: '#3A3A3C', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</label>
    <input data-testid={testid} type={type} value={value}
      onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: '100%', padding: '11px 13px', borderRadius: 12, background: '#F8F8FA',
        border: '1px solid rgba(0,0,0,0.06)', fontSize: 14, fontFamily: 'Outfit, sans-serif', color: '#1D1D1F', outline: 'none' }} />
  </div>
);

const CourseSection = ({ title, items, selectedId, onPick, mode }) => {
  if (!items || items.length === 0) return null;
  return (
    <section className="mb-10">
      <h3 className="text-xl font-semibold mb-4" style={{ color: '#1D1D1F' }}>{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(it => {
          const isSelected = selectedId === it.id;
          const soldOut = it.sold_out;
          return (
            <button key={it.id} data-testid={`item-${it.id}`}
              onClick={() => onPick(it)} disabled={soldOut}
              className="text-left rounded-2xl overflow-hidden transition-all active:scale-[0.98] relative"
              style={{
                background: '#FFFFFF', cursor: soldOut ? 'not-allowed' : 'pointer',
                opacity: soldOut ? 0.5 : 1,
                outline: isSelected ? '3px solid #1D1D1F' : '1px solid rgba(0,0,0,0.06)',
                outlineOffset: isSelected ? -3 : -1,
              }}>
              {it.image_url && (
                <div className="aspect-[4/3] overflow-hidden bg-[#1a1410]">
                  <img src={it.image_url.startsWith('/api/') ? resolveImageUrl(it.image_url) : it.image_url}
                    alt={it.name} loading="lazy" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold" style={{ color: '#1D1D1F' }}>{it.name}</p>
                    {it.description && <p className="text-sm mt-0.5" style={{ color: '#86868B' }}>{it.description}</p>}
                  </div>
                  {isSelected && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#1D1D1F' }}>
                      <Check size={14} strokeWidth={3} color="#fff" />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  {mode === 'single' && (
                    <span className="text-base font-semibold" style={{ color: '#1D1D1F' }}>£{Number(it.price).toFixed(2)}</span>
                  )}
                  {soldOut ? (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(142,142,147,0.15)', color: '#3A3A3C' }}>SOLD OUT</span>
                  ) : it.remaining !== null && it.remaining <= 5 ? (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,149,0,0.15)', color: '#A35E00' }}>
                      Only {it.remaining} left
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default FridayFeast;
