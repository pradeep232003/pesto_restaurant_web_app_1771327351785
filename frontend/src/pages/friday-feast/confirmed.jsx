import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, Clock, MapPin, ShoppingBag, AlertCircle } from 'lucide-react';
import Header from '../../components/ui/Header';
import api from '../../lib/api';

const font = { fontFamily: 'Outfit, sans-serif' };
const MAX_POLLS = 10;
const POLL_INTERVAL = 2000;

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
};

const FridayFeastConfirmed = () => {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const [state, setState] = useState({ status: 'polling', order: null, error: '' });

  useEffect(() => {
    if (!sessionId) { setState({ status: 'error', error: 'Missing session id', order: null }); return; }
    let cancelled = false;
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      try {
        const res = await api.fridayCheckoutStatus(sessionId);
        if (cancelled) return;
        if (res.payment_status === 'paid') {
          setState({ status: 'paid', order: res.order, error: '' });
          return;
        }
        if (res.status === 'expired' || res.payment_status === 'unpaid') {
          setState({ status: 'expired', order: res.order, error: '' });
          return;
        }
        if (attempts >= MAX_POLLS) {
          setState({ status: 'timeout', order: res.order, error: '' });
          return;
        }
        setTimeout(tick, POLL_INTERVAL);
      } catch (err) {
        if (cancelled) return;
        setState({ status: 'error', error: err.message, order: null });
      }
    };
    tick();
    return () => { cancelled = true; };
  }, [sessionId]);

  return (
    <div className="min-h-screen" style={{ background: '#FBFBFD', ...font }}>
      <Header onLogout={() => {}} />
      <main className="pt-16 max-w-xl mx-auto px-4 sm:px-6 py-12">
        {state.status === 'polling' && (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full border-4 border-[#1D1D1F] border-t-transparent animate-spin mx-auto mb-4" />
            <p className="text-base font-medium" style={{ color: '#1D1D1F' }}>Confirming your order…</p>
            <p className="text-sm mt-1" style={{ color: '#86868B' }}>This usually takes a couple of seconds.</p>
          </div>
        )}

        {state.status === 'paid' && state.order && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(52,199,89,0.15)' }}>
              <CheckCircle2 size={36} color="#1B7A35" strokeWidth={2.4} />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight mb-1" style={{ color: '#1D1D1F' }}>Order confirmed</h1>
            <p className="text-sm mb-6" style={{ color: '#86868B' }}>
              We've sent a confirmation to {state.order.customer_phone}. Save this page or screenshot it.
            </p>
            <div className="p-5 rounded-2xl text-left mb-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#86868B' }}>Collection code</p>
              <p className="text-4xl font-bold tracking-wider mb-4" style={{ color: '#1D1D1F' }} data-testid="collection-code">
                {state.order.collection_code}
              </p>
              <Row icon={MapPin} label="Cafe" value={state.order.location_id?.split('-').map(s => s[0].toUpperCase() + s.slice(1)).join(' ')} />
              <Row icon={Clock} label="Pickup" value={`${fmtDate(state.order.week_friday)}`} />
              <Row icon={ShoppingBag} label="Order" value={state.order.bundle ? '3-course bundle' : `${state.order.lines?.[0]?.course || 'à la carte'}`} />
              <Row icon={CheckCircle2} label="Paid" value={`£${Number(state.order.amount).toFixed(2)}`} />
            </div>
            <p className="text-xs" style={{ color: '#86868B' }}>Show your collection code at the counter on Friday.</p>
            <Link to="/" data-testid="back-home"
              className="inline-block mt-6 px-5 py-3 rounded-full text-sm font-semibold active:scale-95"
              style={{ background: '#1D1D1F', color: '#fff' }}>
              Back to home
            </Link>
          </div>
        )}

        {(state.status === 'timeout' || state.status === 'expired' || state.status === 'error') && (
          <div className="text-center py-12">
            <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(255,149,0,0.15)' }}>
              <AlertCircle size={28} color="#A35E00" />
            </div>
            <h1 className="text-2xl font-semibold mb-2" style={{ color: '#1D1D1F' }}>
              {state.status === 'expired' ? 'Payment expired' : state.status === 'timeout' ? "We're still confirming…" : 'Something went wrong'}
            </h1>
            <p className="text-sm mb-4" style={{ color: '#86868B' }}>
              {state.status === 'timeout'
                ? 'It can occasionally take a minute. Refresh to check again, or call your cafe.'
                : state.error || 'Please try again or contact the cafe.'}
            </p>
            <Link to="/friday-feast" data-testid="try-again"
              className="inline-block px-5 py-3 rounded-full text-sm font-semibold active:scale-95"
              style={{ background: '#1D1D1F', color: '#fff' }}>
              Back to Friday Feast
            </Link>
          </div>
        )}
      </main>
    </div>
  );
};

const Row = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3 py-1.5">
    <Icon size={16} style={{ color: '#86868B' }} />
    <span className="text-xs uppercase tracking-wider flex-shrink-0" style={{ color: '#86868B' }}>{label}</span>
    <span className="ml-auto text-sm font-semibold" style={{ color: '#1D1D1F' }}>{value || '—'}</span>
  </div>
);

export default FridayFeastConfirmed;
