import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';

const SANITISERS = [
  { id: 'chlorine',  label: 'Chlorine',  hint: '50–200 ppm' },
  { id: 'peracetic', label: 'Peracetic', hint: '80–120 ppm' },
  { id: 'other',     label: 'Other',     hint: 'Manager-approved' },
];

/** /jkhive/food-washing/record — sanitiser + ppm + contact time + comment + submit. */
const WashingRecord = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { adminLocationId, locations } = useLocation2();
  const [sanitiser, setSanitiser] = useState('chlorine');
  const [ppm, setPpm] = useState(100);
  const [minutes, setMinutes] = useState(2);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  if (!state?.item_name) return <Navigate to="/jkhive/food-washing/pick" replace />;

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await api.foodWashRecord({
        location_id: adminLocationId,
        item_name: state.item_name,
        item_category: state.item_category,
        sanitiser,
        ppm: Number(ppm),
        contact_minutes: Number(minutes),
        comment,
      });
      setDone(res);
    } catch (e) { alert('Submit failed: ' + e.message); }
    finally { setSubmitting(false); }
  };

  if (done) {
    return (
      <div style={{ padding: '24px 12px', fontFamily: 'Outfit, sans-serif' }} data-testid="washing-done">
        <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '36px 22px', textAlign: 'center', marginTop: 80 }}>
          <div style={{ width: 72, height: 72, borderRadius: 999, background: done.passed ? '#34C759' : '#FF3B30', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Check size={36} strokeWidth={2.6} color="#fff" />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px' }}>{done.passed ? 'Wash OK' : 'Out of range'}</h2>
          <p style={{ fontSize: 14, color: '#3A3A3C', margin: '0 0 18px' }}>
            {state.item_name} · {done.ppm} ppm ({done.ppm_pass ? '✓' : '✗'}) · {done.contact_minutes} min ({done.time_pass ? '✓' : '✗'})
          </p>
          <button data-testid="washing-done-back" onClick={() => navigate('/jkhive/food-washing', { replace: true })}
            style={{ width: '100%', padding: '14px 16px', borderRadius: 999, border: 0, background: '#1D1D1F', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>Done</button>
        </div>
      </div>
    );
  }

  const numStyle = { width: '100%', padding: '14px 16px', fontSize: 16, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 14, background: '#fff', outline: 'none', fontFamily: 'Outfit, sans-serif' };

  return (
    <div style={{ paddingBottom: 130, fontFamily: 'Outfit, sans-serif' }} data-testid="washing-record">
      <WizardHeader title={state.item_name} locationName={locationName} dateStr={today} onBack={() => navigate(-1)} />

      <div style={{ textAlign: 'center', margin: '4px 0 20px' }}>
        <div style={{ fontSize: 96, lineHeight: 1 }}>🧼</div>
        <p style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 0' }}>Sanitise & Wash</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {SANITISERS.map(s => {
          const active = sanitiser === s.id;
          return (
            <button key={s.id} data-testid={`washing-sanitiser-${s.id}`} onClick={() => setSanitiser(s.id)}
              style={{
                flex: 1, padding: '14px 8px', borderRadius: 14, cursor: 'pointer',
                border: active ? '2px solid #1D1D1F' : '1px solid rgba(0,0,0,0.1)',
                background: active ? '#1D1D1F' : '#FFFFFF',
                color: active ? '#FFFFFF' : '#1D1D1F',
                fontFamily: 'Outfit, sans-serif',
              }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{s.label}</div>
              <div style={{ fontSize: 11, opacity: active ? 0.8 : 0.6, marginTop: 2 }}>{s.hint}</div>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F', marginBottom: 6, display: 'block' }}>Sanitiser strength (ppm)</label>
          <input data-testid="washing-ppm" type="number" inputMode="numeric" min={0} step={5} value={ppm}
            onChange={e => setPpm(Math.max(0, parseFloat(e.target.value) || 0))} style={numStyle} />
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F', marginBottom: 6, display: 'block' }}>Contact time (minutes)</label>
          <input data-testid="washing-minutes" type="number" inputMode="numeric" min={0} step={0.5} value={minutes}
            onChange={e => setMinutes(Math.max(0, parseFloat(e.target.value) || 0))} style={numStyle} />
        </div>
        <textarea data-testid="washing-comment" value={comment} onChange={e => setComment(e.target.value.slice(0, 250))} rows={3} placeholder="Comment (optional)"
          style={{ width: '100%', padding: 14, fontSize: 15, border: '1px solid rgba(0,0,0,0.18)', borderRadius: 14, background: '#fff', resize: 'vertical', outline: 'none', fontFamily: 'Outfit, sans-serif' }} />
      </div>

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 64, zIndex: 5 }}>
        <button data-testid="washing-submit" onClick={submit} disabled={submitting}
          style={{ width: '100%', padding: '20px 16px', border: 0, background: '#1D1D1F', color: '#fff', fontSize: 18, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1, fontFamily: 'Outfit, sans-serif' }}>
          {submitting ? 'Submitting…' : 'Submit Wash Record'}
        </button>
      </div>
    </div>
  );
};

export default WashingRecord;
