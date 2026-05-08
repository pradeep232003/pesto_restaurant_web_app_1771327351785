import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';

/**
 * /jkhive/delivery-records/comment — optional 250-char comment.
 * Submitting routes to the AskAddInventory screen (which will save the
 * delivery record on mount). The temp + comment are stashed in route state
 * so subsequent items in the same delivery inherit them (1b workflow).
 */
const CommentSubmit = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { adminLocationId, locations } = useLocation2();
  const [comment, setComment] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  if (!state?.itemName || state?.temp == null || !state?.supplier) {
    return <Navigate to="/jkhive/delivery-records/supplier" replace />;
  }

  const next = () => {
    navigate('/jkhive/delivery-records/inventory-prompt', {
      state: {
        ...state,
        comment,
        sharedTemp: state.temp,
        sharedComment: comment,
        autoSaveRecord: true,
      },
    });
  };

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="delivery-comment">
      <WizardHeader title="Record New Delivery" locationName={locationName} dateStr={today} backTo="/jkhive/delivery-records/record" />

      <div style={{ display: 'flex', justifyContent: 'center', margin: '40px 0 20px' }}>
        <div style={{ width: 96, height: 96, borderRadius: 24, background: 'rgba(0,122,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <MessageSquare size={56} strokeWidth={1.8} color="#0A84C9" />
        </div>
      </div>

      <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', color: '#1D1D1F', margin: '0 0 4px', textAlign: 'center' }}>
        Add a comment?
      </h2>
      <p style={{ fontSize: 14, color: '#86868B', margin: '0 0 18px', textAlign: 'center' }}>(This is optional)</p>

      <textarea data-testid="delivery-comment-input"
        value={comment} onChange={e => setComment(e.target.value.slice(0, 250))}
        rows={5}
        placeholder="Quality / packaging / damage notes…"
        style={{
          width: '100%', padding: 14, fontSize: 15,
          border: '1px solid rgba(0,0,0,0.12)', borderRadius: 14,
          background: '#FFFFFF', color: '#1D1D1F', resize: 'vertical', outline: 'none',
          fontFamily: 'Outfit, sans-serif',
        }} />
      <p style={{ fontSize: 12, color: '#86868B', textAlign: 'right', marginTop: 6 }}>{comment.length}/250</p>

      <div style={{ position: 'fixed', left: 16, right: 16, bottom: 96, maxWidth: 600, margin: '0 auto', zIndex: 5 }}>
        <button data-testid="delivery-submit-btn" onClick={next}
          style={{
            width: '100%', padding: '18px 16px', borderRadius: 999, border: 0,
            background: '#1D1D1F', color: '#FFFFFF', fontSize: 17, fontWeight: 600,
            cursor: 'pointer', boxShadow: '0 6px 18px rgba(0,0,0,0.18)', fontFamily: 'Outfit, sans-serif',
          }}>
          Submit Record
        </button>
      </div>
    </div>
  );
};

export default CommentSubmit;
