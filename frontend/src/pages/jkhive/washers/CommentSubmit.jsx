import React, { useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation, Navigate } from 'react-router-dom';
import { MessageSquare, Check } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';

/** /jkhive/washer-temps/:washerId/comment — submit washer record. */
const CommentSubmit = () => {
  const navigate = useNavigate();
  const { washerId } = useParams();
  const { state } = useLocation();
  const { adminLocationId, locations } = useLocation2();
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  if (!state?.washer || state?.wash_temp == null || state?.rinse_temp == null) {
    return <Navigate to={`/jkhive/washer-temps/${washerId}/wash`} replace />;
  }

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await api.washerRecord({
        location_id: adminLocationId,
        washer_id: washerId,
        wash_temp: state.wash_temp,
        rinse_temp: state.rinse_temp,
        comment,
      });
      setDone(res);
    } catch (err) { alert('Submit failed: ' + err.message); }
    finally { setSubmitting(false); }
  };

  if (done) {
    const pass = done.passed;
    return (
      <div style={{ padding: '24px 12px', fontFamily: 'Outfit, sans-serif' }} data-testid="washer-done">
        <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '36px 22px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', marginTop: 80 }}>
          <div style={{ width: 72, height: 72, borderRadius: 999, background: pass ? '#34C759' : '#FF3B30', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Check size={36} strokeWidth={2.6} color="#fff" />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#1D1D1F', margin: '0 0 6px' }}>
            {pass ? 'Washer passed!' : 'Record saved'}
          </h2>
          <p style={{ fontSize: 14, color: '#3A3A3C', margin: '0 0 18px' }}>
            {state.washer.name} · Wash {Number(state.wash_temp).toFixed(1)}°C ({done.wash_pass ? '✓' : '✗'}) · Rinse {Number(state.rinse_temp).toFixed(1)}°C ({done.rinse_pass ? '✓' : '✗'})
          </p>
          {!pass && (
            <p style={{ fontSize: 13, color: '#FF3B30', margin: '0 0 18px' }}>
              Below safe range. Service the unit before next cycle (wash ≥ 55°C, rinse ≥ 82°C).
            </p>
          )}
          <button data-testid="washer-done-back"
            onClick={() => navigate('/jkhive/washer-temps', { replace: true })}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 999, border: 0,
              background: '#1D1D1F', color: '#FFFFFF', fontSize: 16, fontWeight: 600, cursor: 'pointer',
            }}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="washer-comment">
      <WizardHeader title={state.washer.name} locationName={locationName} dateStr={today} onBack={() => navigate(-1)} />

      <div style={{ display: 'flex', justifyContent: 'center', margin: '60px 0 24px' }}>
        <div style={{ width: 96, height: 96, borderRadius: 24, background: 'rgba(0,122,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <MessageSquare size={56} strokeWidth={1.8} color="#0A84C9" />
        </div>
      </div>

      <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', color: '#1D1D1F', margin: '0 0 4px', textAlign: 'center' }}>
        Add a comment?
      </h2>
      <p style={{ fontSize: 14, color: '#86868B', margin: '0 0 18px', textAlign: 'center' }}>(This is optional)</p>

      <textarea data-testid="washer-comment-input"
        value={comment} onChange={e => setComment(e.target.value.slice(0, 250))}
        rows={4}
        style={{
          width: '100%', padding: 14, fontSize: 15,
          border: '1px solid rgba(0,0,0,0.18)', borderRadius: 14,
          background: '#FFFFFF', color: '#1D1D1F', resize: 'vertical', outline: 'none',
          fontFamily: 'Outfit, sans-serif',
        }} />
      <p style={{ fontSize: 12, color: '#86868B', textAlign: 'right', marginTop: 6 }}>{comment.length}/250</p>

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 64, zIndex: 5 }}>
        <button data-testid="washer-submit-btn" onClick={submit} disabled={submitting}
          style={{
            width: '100%', padding: '20px 16px', border: 0,
            background: '#1D1D1F', color: '#FFFFFF', fontSize: 18, fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1,
            fontFamily: 'Outfit, sans-serif',
          }}>{submitting ? 'Submitting…' : 'Submit Record'}</button>
      </div>
    </div>
  );
};

export default CommentSubmit;
