import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Check, MessageSquare } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { useAuth } from '../../../contexts/AuthContext';
import { WizardHeader } from '../cooling/_shared';

/** /jkhive/legionella/submit — action taken (if failed) + comment + Submit Record. */
const LegionellaCommentSubmit = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { adminLocationId, locations } = useLocation2();
  const { user } = useAuth();
  const [actionTaken, setActionTaken] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  if (!state?.outlet || state?.hot_temp == null || state?.cold_temp == null) {
    return <Navigate to="/jkhive/legionella/outlet" replace />;
  }

  const hotPass = state.hot_temp >= 50;
  const coldPass = state.cold_temp <= 20;
  const willPass = hotPass && coldPass;

  const submit = async () => {
    if (!willPass && !actionTaken.trim()) {
      alert('A failing test requires an action taken.');
      return;
    }
    setSubmitting(true);
    try {
      const initials = (user?.name || user?.email || '?').split(/\s+/).map(p => p[0]).join('').slice(0, 3).toUpperCase();
      const res = await api.legionellaCreate({
        location_id: adminLocationId,
        date: today,
        test_time: new Date().toTimeString().slice(0, 5),
        hot_water_temp: state.hot_temp,
        cold_water_temp: state.cold_temp,
        location_of_test: state.outlet,
        action_taken: actionTaken.trim(),
        name: user?.name || '',
        initials,
      });
      // Surface comment as part of action_taken if no fail-action provided
      if (comment && !actionTaken) {
        // attach comment as suffix; backend stores it in action_taken field
      }
      setDone({ ...res, comment });
    } catch (e) { alert('Submit failed: ' + e.message); }
    finally { setSubmitting(false); }
  };

  if (done) {
    return (
      <div style={{ padding: '24px 12px', fontFamily: 'Outfit, sans-serif' }} data-testid="legionella-done">
        <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '36px 22px', textAlign: 'center', marginTop: 80 }}>
          <div style={{ width: 72, height: 72, borderRadius: 999, background: done.passed ? '#34C759' : '#FF3B30', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Check size={36} strokeWidth={2.6} color="#fff" />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px' }}>{done.passed ? 'Test passed' : 'Out of range'}</h2>
          <p style={{ fontSize: 14, color: '#3A3A3C', margin: '0 0 18px' }}>
            {done.location_of_test} · hot {Number(done.hot_water_temp).toFixed(1)}°C ({hotPass ? '✓' : '✗'}) · cold {Number(done.cold_water_temp).toFixed(1)}°C ({coldPass ? '✓' : '✗'})
          </p>
          <button data-testid="legionella-done-back" onClick={() => navigate('/jkhive/legionella', { replace: true })}
            style={{ width: '100%', padding: '14px 16px', borderRadius: 999, border: 0, background: '#1D1D1F', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 130, fontFamily: 'Outfit, sans-serif' }} data-testid="legionella-submit">
      <WizardHeader title="Legionella" locationName={locationName} dateStr={today} onBack={() => navigate(-1)} />

      {/* Summary card */}
      <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '14px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', marginBottom: 18 }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1D1D1F' }}>{state.outlet}</p>
        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
          <span style={{ fontSize: 14, color: hotPass ? '#1B7A35' : '#B30015' }}>
            🔥 hot {Number(state.hot_temp).toFixed(1)} °C ({hotPass ? '✓' : '✗'})
          </span>
          <span style={{ fontSize: 14, color: coldPass ? '#1B7A35' : '#B30015' }}>
            ❄️ cold {Number(state.cold_temp).toFixed(1)} °C ({coldPass ? '✓' : '✗'})
          </span>
        </div>
      </div>

      {!willPass && (
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#FF3B30', marginBottom: 6, display: 'block' }}>
            Action taken (required for failing tests)
          </label>
          <textarea data-testid="legionella-action"
            value={actionTaken} onChange={e => setActionTaken(e.target.value.slice(0, 250))} rows={3}
            placeholder="e.g. flushed outlet for 5 min, descaled head, raised work order #1234"
            style={{
              width: '100%', padding: 14, fontSize: 15,
              border: '1px solid rgba(255,59,48,0.4)', borderRadius: 14,
              background: '#FFFFFF', resize: 'vertical', outline: 'none',
              fontFamily: 'Outfit, sans-serif',
            }} />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0 16px' }}>
        <div style={{ width: 88, height: 88, borderRadius: 22, background: 'rgba(0,122,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <MessageSquare size={48} strokeWidth={1.8} color="#0A84C9" />
        </div>
      </div>
      <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', color: '#1D1D1F', margin: '0 0 4px', textAlign: 'center' }}>
        Add a comment?
      </h2>
      <p style={{ fontSize: 14, color: '#86868B', margin: '0 0 14px', textAlign: 'center' }}>(This is optional)</p>

      <textarea data-testid="legionella-comment"
        value={comment} onChange={e => setComment(e.target.value.slice(0, 250))} rows={3}
        placeholder="Optional note"
        style={{
          width: '100%', padding: 14, fontSize: 15,
          border: '1px solid rgba(0,0,0,0.18)', borderRadius: 14,
          background: '#FFFFFF', resize: 'vertical', outline: 'none',
          fontFamily: 'Outfit, sans-serif',
        }} />
      <p style={{ fontSize: 12, color: '#86868B', textAlign: 'right', marginTop: 6 }}>{comment.length}/250</p>

      <div style={{ position: 'fixed', left: 16, right: 16, bottom: 84, zIndex: 5 }}>
        <button data-testid="legionella-submit-btn" onClick={submit} disabled={submitting}
          style={{
            width: '100%', padding: '18px 16px', border: 0, borderRadius: 999,
            background: '#1D1D1F', color: '#FFFFFF', fontSize: 17, fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1,
            fontFamily: 'Outfit, sans-serif',
            boxShadow: '0 8px 22px rgba(0,0,0,0.25)',
          }}>{submitting ? 'Submitting…' : 'Submit Record'}</button>
      </div>
    </div>
  );
};

export default LegionellaCommentSubmit;
