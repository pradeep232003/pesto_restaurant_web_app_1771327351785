import React, { useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation, Navigate } from 'react-router-dom';
import { MessageSquare, Check, AlertTriangle } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';

const RINSE_MIN_C = 82;
const WASH_MIN_C  = 55;

/** /jkhive/washer-temps/:washerId/comment — submit washer record.
 *
 *  HACCP guard: when either recorded temp falls below the safe threshold
 *  (wash < 55°C  OR  rinse < 82°C) we REQUIRE the operator to write a
 *  comment of ≥ 3 characters so we have an audit-trail note explaining the
 *  out-of-range reading (e.g. "machine cold-started, ran a 2nd cycle").
 */
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

  // Allow either-or-both: only redirect away if BOTH temps are missing.
  if (!state?.washer || (state?.wash_temp == null && state?.rinse_temp == null)) {
    return <Navigate to={`/jkhive/washer-temps/${washerId}/wash`} replace />;
  }

  const washBelow  = state.wash_temp  != null && Number(state.wash_temp)  < WASH_MIN_C;
  const rinseBelow = state.rinse_temp != null && Number(state.rinse_temp) < RINSE_MIN_C;
  const commentRequired = washBelow || rinseBelow;
  const commentTrimmed = comment.trim();
  const submitBlocked  = commentRequired && commentTrimmed.length < 3;

  const submit = async () => {
    if (submitBlocked) return;
    setSubmitting(true);
    try {
      const res = await api.washerRecord({
        location_id: adminLocationId,
        washer_id: washerId,
        wash_temp: state.wash_temp,
        rinse_temp: state.rinse_temp,
        comment: commentTrimmed,
      });
      setDone(res);
    } catch (err) { alert('Submit failed: ' + err.message); }
    finally { setSubmitting(false); }
  };

  if (done) {
    const pass = done.passed;
    const wash = state.wash_temp;
    const rinse = state.rinse_temp;
    const parts = [];
    if (wash != null) parts.push(`Wash ${Number(wash).toFixed(1)}°C (${done.wash_pass ? '✓' : '✗'})`);
    if (rinse != null) parts.push(`Rinse ${Number(rinse).toFixed(1)}°C (${done.rinse_pass ? '✓' : '✗'})`);
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
            {state.washer.name} · {parts.join(' · ')}
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
      <WizardHeader title="Record Washer Temperatures" locationName={locationName} dateStr={today} onBack={() => navigate(-1)} />

      <div style={{ display: 'flex', justifyContent: 'center', margin: '60px 0 24px' }}>
        <div style={{ width: 96, height: 96, borderRadius: 24, background: commentRequired ? 'rgba(255,59,48,0.10)' : 'rgba(0,122,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {commentRequired
            ? <AlertTriangle size={56} strokeWidth={1.8} color="#FF3B30" />
            : <MessageSquare size={56} strokeWidth={1.8} color="#0A84C9" />}
        </div>
      </div>

      <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', color: '#1D1D1F', margin: '0 0 4px', textAlign: 'center' }}>
        {commentRequired ? 'Comment required' : 'Add a comment?'}
      </h2>
      <p style={{ fontSize: 14, color: commentRequired ? '#A82218' : '#86868B', margin: '0 0 18px', textAlign: 'center' }}>
        {commentRequired ? 'Reading below safe range — please explain' : '(This is optional)'}
      </p>

      {commentRequired && (
        <div data-testid="washer-comment-required-banner"
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px',
            background: 'rgba(255,59,48,0.08)', borderRadius: 14, marginBottom: 14,
            border: '1px solid rgba(255,59,48,0.18)',
          }}>
          <AlertTriangle size={16} strokeWidth={2.4} color="#A82218" style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ fontSize: 13, color: '#1D1D1F', lineHeight: 1.4 }}>
            {washBelow && (
              <p style={{ margin: '0 0 4px' }}>
                Wash recorded at <b>{Number(state.wash_temp).toFixed(1)}°C</b> (below {WASH_MIN_C}°C minimum).
              </p>
            )}
            {rinseBelow && (
              <p style={{ margin: 0 }}>
                Rinse recorded at <b>{Number(state.rinse_temp).toFixed(1)}°C</b> (below {RINSE_MIN_C}°C minimum).
              </p>
            )}
            <p style={{ margin: '6px 0 0', color: '#86868B', fontSize: 12 }}>
              For the EHO audit trail, please note what happened (e.g. cold start, re-ran cycle, engineer called).
            </p>
          </div>
        </div>
      )}

      <textarea data-testid="washer-comment-input"
        value={comment} onChange={e => setComment(e.target.value.slice(0, 250))}
        rows={4}
        placeholder={commentRequired ? 'e.g. Machine cold-started, ran 2nd cycle — temps now OK' : ''}
        style={{
          width: '100%', padding: 14, fontSize: 15,
          border: `1px solid ${commentRequired && submitBlocked ? 'rgba(255,59,48,0.5)' : 'rgba(0,0,0,0.18)'}`,
          borderRadius: 14, background: '#FFFFFF', color: '#1D1D1F', resize: 'vertical', outline: 'none',
          fontFamily: 'Outfit, sans-serif',
        }} />
      <p style={{ fontSize: 12, color: '#86868B', textAlign: 'right', marginTop: 6 }}>
        {commentRequired && submitBlocked && (
          <span data-testid="washer-comment-min-hint" style={{ color: '#FF3B30', marginRight: 8 }}>
            min 3 characters required
          </span>
        )}
        {comment.length}/250
      </p>

      <div style={{ position: 'fixed', left: 16, right: 16, bottom: 84, zIndex: 5 }}>
        <button data-testid="washer-submit-btn" onClick={submit} disabled={submitting || submitBlocked}
          style={{
            width: '100%', padding: '18px 16px', border: 0, borderRadius: 999,
            background: '#1D1D1F', color: '#FFFFFF', fontSize: 17, fontWeight: 600,
            cursor: (submitting || submitBlocked) ? 'not-allowed' : 'pointer',
            opacity: (submitting || submitBlocked) ? 0.4 : 1,
            fontFamily: 'Outfit, sans-serif',
            boxShadow: '0 8px 22px rgba(0,0,0,0.25)',
          }}>
          {submitting ? 'Submitting…' : submitBlocked ? 'Add a comment to continue' : 'Submit Record'}
        </button>
      </div>
    </div>
  );
};

export default CommentSubmit;
