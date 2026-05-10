import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Check, MessageSquare } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';

/** /jkhive/food-washing/comment — IMG_6736. Optional comment + Submit Record. */
const WashingCommentSubmit = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { adminLocationId, locations } = useLocation2();
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  if (!state?.item_name || !state?.sanitiser || state?.ppm == null) {
    return <Navigate to="/jkhive/food-washing/pick" replace />;
  }

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await api.foodWashRecord({
        location_id: adminLocationId,
        item_name: state.item_name,
        item_category: state.item_category,
        item_icon: state.item_icon || '',
        sanitiser: state.sanitiser,
        ppm: state.ppm,
        comment,
      });
      setDone(res);
    } catch (e) { alert('Submit failed: ' + e.message); }
    finally { setSubmitting(false); }
  };

  if (done) {
    const unit = state.sanitiser === 'chlorine' ? 'ppm' : 'pH';
    return (
      <div style={{ padding: '24px 12px', fontFamily: 'Outfit, sans-serif' }} data-testid="washing-done">
        <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '36px 22px', textAlign: 'center', marginTop: 80 }}>
          <div style={{ width: 72, height: 72, borderRadius: 999, background: done.passed ? '#34C759' : '#FF3B30', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Check size={36} strokeWidth={2.6} color="#fff" />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px' }}>{done.passed ? 'Wash OK' : 'Out of range'}</h2>
          <p style={{ fontSize: 14, color: '#3A3A3C', margin: '0 0 18px' }}>
            {state.item_name} · {done.sanitiser} · {Number(done.ppm).toFixed(1)} {unit}
          </p>
          <button data-testid="washing-done-back" onClick={() => navigate('/jkhive/food-washing', { replace: true })}
            style={{ width: '100%', padding: '14px 16px', borderRadius: 999, border: 0, background: '#1D1D1F', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="washing-comment">
      <WizardHeader title="Chemical Food Washing" locationName={locationName} dateStr={today} onBack={() => navigate(-1)} />

      <div style={{ display: 'flex', justifyContent: 'center', margin: '60px 0 20px' }}>
        <div style={{ width: 96, height: 96, borderRadius: 24, background: 'rgba(0,122,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <MessageSquare size={56} strokeWidth={1.8} color="#0A84C9" />
        </div>
      </div>

      <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', color: '#1D1D1F', margin: '0 0 4px', textAlign: 'center' }}>
        Add a comment?
      </h2>
      <p style={{ fontSize: 14, color: '#86868B', margin: '0 0 18px', textAlign: 'center' }}>(This is optional)</p>

      <textarea data-testid="washing-comment-input"
        value={comment} onChange={e => setComment(e.target.value.slice(0, 250))} rows={3}
        style={{
          width: '100%', padding: 14, fontSize: 15,
          border: '1px solid rgba(0,0,0,0.18)', borderRadius: 14,
          background: '#FFFFFF', color: '#1D1D1F', resize: 'vertical', outline: 'none',
          fontFamily: 'Outfit, sans-serif',
        }} />
      <p style={{ fontSize: 12, color: '#86868B', textAlign: 'right', marginTop: 6 }}>{comment.length}/250</p>

      <div style={{ position: 'fixed', left: 16, right: 16, bottom: 84, zIndex: 5 }}>
        <button data-testid="washing-submit" onClick={submit} disabled={submitting}
          style={{
            width: '100%', padding: '18px 16px', border: 0, borderRadius: 999,
            background: '#1D1D1F', color: '#fff', fontSize: 17, fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1,
            fontFamily: 'Outfit, sans-serif',
            boxShadow: '0 8px 22px rgba(0,0,0,0.25)',
          }}>{submitting ? 'Submitting…' : 'Submit Record'}</button>
      </div>
    </div>
  );
};

export default WashingCommentSubmit;
