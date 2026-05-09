import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Minus, Plus, MessageSquare, Check } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';

/**
 * /jkhive/in-service-wastage/comment — confirm qty + price + optional comment, submit.
 * Reads menu price from route state (auto-captured when item was picked); user can
 * adjust price if a partial loss (e.g. 50p of garnish on a £8.50 dish).
 */
const fmtMoney = (v) => `£${Number(v || 0).toFixed(2)}`;

const InServiceComment = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { adminLocationId, locations } = useLocation2();
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(state?.price ?? '');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  if (!state?.item_name) return <Navigate to="/jkhive/in-service-wastage/pick" replace />;

  const total = (Number(price || 0) * Number(qty || 0)) || 0;

  const submit = async () => {
    if (Number(qty) <= 0) { alert('Quantity must be at least 1'); return; }
    setSubmitting(true);
    try {
      await api.wastageRecord({
        location_id: adminLocationId,
        type: 'in_service',
        item_name: state.item_name,
        item_category: state.item_category,
        item_icon: state.item_icon || '🍽️',
        amount: Number(qty),
        unit: 'item',
        price: price === '' ? null : Number(price),
        menu_item_id: state.menu_item_id || '',
        comment,
      });
      setDone(true);
    } catch (err) {
      alert('Submit failed: ' + err.message);
    } finally { setSubmitting(false); }
  };

  if (done) {
    return (
      <div style={{ padding: '24px 12px', fontFamily: 'Outfit, sans-serif' }} data-testid="service-wastage-done">
        <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '36px 22px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', marginTop: 80 }}>
          <div style={{ width: 72, height: 72, borderRadius: 999, background: '#34C759', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Check size={36} strokeWidth={2.6} color="#fff" />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#1D1D1F', margin: '0 0 6px' }}>Wastage saved!</h2>
          <p style={{ fontSize: 14, color: '#3A3A3C', margin: '0 0 18px' }}>
            {qty}× {state.item_name} · {fmtMoney(total)} lost.
          </p>
          <button onClick={() => navigate('/jkhive/in-service-wastage', { replace: true })}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 999, border: 0,
              background: '#1D1D1F', color: '#FFFFFF', fontSize: 16, fontWeight: 600, cursor: 'pointer',
            }}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="service-wastage-comment">
      <WizardHeader title="Record Wastage" locationName={locationName} dateStr={today} onBack={() => navigate(-1)} />

      {/* Item card */}
      <div style={{
        background: '#FFFFFF', borderRadius: 18, padding: '14px 16px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: 12, marginTop: 8,
      }}>
        {state.image_url ? (
          <img src={state.image_url} alt={state.item_name}
            style={{ width: 60, height: 60, borderRadius: 12, objectFit: 'cover' }} />
        ) : (
          <div style={{ width: 60, height: 60, borderRadius: 12, background: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🍽️</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 17, fontWeight: 800, color: '#1D1D1F', margin: 0 }}>{state.item_name}</p>
          <p style={{ fontSize: 12, color: '#86868B', margin: '2px 0 0', textTransform: 'capitalize' }}>{state.item_category}</p>
        </div>
      </div>

      {/* Quantity stepper */}
      <div style={{ marginTop: 22 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
          Quantity
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFFFFF', borderRadius: 14, padding: '4px 8px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <button data-testid="service-qty-dec"
            onClick={() => setQty(q => Math.max(1, Number(q) - 1))}
            style={{ background: 'transparent', border: 0, color: '#1D1D1F', cursor: 'pointer', padding: 14 }}>
            <Minus size={22} strokeWidth={2.2} />
          </button>
          <input data-testid="service-qty-input"
            inputMode="numeric" type="number" min={1} step={1}
            value={qty} onChange={e => setQty(e.target.value)}
            style={{
              flex: 1, textAlign: 'center', fontSize: 36, fontWeight: 700, color: '#1D1D1F',
              background: 'transparent', border: 0, outline: 'none', padding: '6px 0',
              fontFamily: 'Outfit, sans-serif',
            }} />
          <button data-testid="service-qty-inc"
            onClick={() => setQty(q => Number(q) + 1)}
            style={{ background: 'transparent', border: 0, color: '#1D1D1F', cursor: 'pointer', padding: 14 }}>
            <Plus size={22} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {/* Price */}
      <div style={{ marginTop: 18 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
          Menu price (per item)
        </p>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#86868B' }}>£</span>
          <input data-testid="service-price-input"
            inputMode="decimal" type="number" step="0.01"
            value={price} onChange={e => setPrice(e.target.value)}
            placeholder="0.00"
            style={{
              width: '100%', padding: '14px 16px 14px 30px', fontSize: 16,
              border: '1px solid rgba(0,0,0,0.18)', borderRadius: 12,
              background: '#FFFFFF', color: '#1D1D1F', outline: 'none',
              fontFamily: 'Outfit, sans-serif',
            }} />
        </div>
        <p style={{ fontSize: 12, color: '#86868B', textAlign: 'right', marginTop: 6 }}>
          Total lost: <b style={{ color: '#FF3B30' }}>{fmtMoney(total)}</b>
        </p>
      </div>

      {/* Comment */}
      <div style={{ marginTop: 14 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <MessageSquare size={13} strokeWidth={2.4} /> Comment <span style={{ textTransform: 'none', fontWeight: 400, color: '#86868B' }}>(optional)</span>
        </p>
        <textarea data-testid="service-comment-input"
          value={comment} onChange={e => setComment(e.target.value.slice(0, 250))}
          rows={3}
          placeholder="Why was it wasted? (e.g. customer return, dropped, expired)"
          style={{
            width: '100%', padding: 14, fontSize: 15,
            border: '1px solid rgba(0,0,0,0.18)', borderRadius: 14,
            background: '#FFFFFF', color: '#1D1D1F', resize: 'vertical', outline: 'none',
            fontFamily: 'Outfit, sans-serif',
          }} />
        <p style={{ fontSize: 12, color: '#86868B', textAlign: 'right', marginTop: 6 }}>{comment.length}/250</p>
      </div>

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 64, zIndex: 5 }}>
        <button data-testid="service-submit-btn" onClick={submit} disabled={submitting}
          style={{
            width: '100%', padding: '20px 16px', border: 0,
            background: '#1D1D1F', color: '#FFFFFF', fontSize: 18, fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1,
            fontFamily: 'Outfit, sans-serif',
          }}>
          {submitting ? 'Submitting…' : 'Submit Record'}
        </button>
      </div>
    </div>
  );
};

export default InServiceComment;
