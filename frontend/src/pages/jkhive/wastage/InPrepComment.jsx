import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { MessageSquare, Check } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';

/** /jkhive/in-prep-wastage/comment — IMG_6705. Optional 250-char comment + Submit. */
const InPrepComment = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { adminLocationId, locations } = useLocation2();
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  if (!state?.itemName || state?.amount == null || !state?.unit) {
    return <Navigate to="/jkhive/in-prep-wastage/pick" replace />;
  }

  const submit = async () => {
    setSubmitting(true);
    try {
      await api.wastageRecord({
        location_id: adminLocationId,
        type: 'in_prep',
        item_name: state.itemName,
        item_category: state.category,
        item_icon: state.itemIcon,
        amount: state.amount,
        unit: state.unit,
        comment,
      });
      setDone(true);
    } catch (err) {
      alert('Submit failed: ' + err.message);
    } finally { setSubmitting(false); }
  };

  if (done) {
    return (
      <div style={{ padding: '24px 12px', fontFamily: 'Outfit, sans-serif' }} data-testid="wastage-done">
        <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '36px 22px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', marginTop: 80 }}>
          <div style={{ width: 72, height: 72, borderRadius: 999, background: '#34C759', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Check size={36} strokeWidth={2.6} color="#fff" />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#1D1D1F', margin: '0 0 6px' }}>Wastage saved!</h2>
          <p style={{ fontSize: 14, color: '#3A3A3C', margin: '0 0 18px' }}>
            {state.amount} {state.unit} of {state.itemName} logged.
          </p>
          <button data-testid="wastage-done-back"
            onClick={() => navigate('/jkhive/in-prep-wastage', { replace: true })}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 999, border: 0,
              background: '#1D1D1F', color: '#FFFFFF', fontSize: 16, fontWeight: 600, cursor: 'pointer',
            }}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="wastage-comment">
      <WizardHeader title="Add Comment" locationName={locationName} dateStr={today} onBack={() => navigate(-1)} />

      <div style={{ display: 'flex', justifyContent: 'center', margin: '60px 0 24px' }}>
        <div style={{ width: 96, height: 96, borderRadius: 24, background: 'rgba(0,122,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <MessageSquare size={56} strokeWidth={1.8} color="#0A84C9" />
        </div>
      </div>

      <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', color: '#1D1D1F', margin: '0 0 4px', textAlign: 'center' }}>
        Add a comment?
      </h2>
      <p style={{ fontSize: 14, color: '#86868B', margin: '0 0 18px', textAlign: 'center' }}>(This is optional)</p>

      <textarea data-testid="wastage-comment-input"
        value={comment} onChange={e => setComment(e.target.value.slice(0, 250))}
        rows={4}
        placeholder="Why was it wasted?"
        style={{
          width: '100%', padding: 14, fontSize: 15,
          border: '1px solid rgba(0,0,0,0.18)', borderRadius: 14,
          background: '#FFFFFF', color: '#1D1D1F', resize: 'vertical', outline: 'none',
          fontFamily: 'Outfit, sans-serif',
        }} />
      <p style={{ fontSize: 12, color: '#86868B', textAlign: 'right', marginTop: 6 }}>{comment.length}/250</p>

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 64, zIndex: 5 }}>
        <button data-testid="wastage-submit-btn" onClick={submit} disabled={submitting}
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

export default InPrepComment;
