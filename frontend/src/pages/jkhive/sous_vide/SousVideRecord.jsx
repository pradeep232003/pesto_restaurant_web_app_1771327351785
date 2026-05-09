import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';

/** /jkhive/sous-vide/record — target/actual temp & time + comment + submit. */
const SousVideRecord = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { adminLocationId, locations } = useLocation2();
  const [targetTemp, setTargetTemp] = useState(63);
  const [targetMin, setTargetMin] = useState(60);
  const [actualTemp, setActualTemp] = useState(63);
  const [actualMin, setActualMin] = useState(60);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  if (!state?.item_name) return <Navigate to="/jkhive/sous-vide/pick" replace />;

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await api.sousVideRecord({
        location_id: adminLocationId,
        item_name: state.item_name,
        item_category: state.item_category,
        target_temp: Number(targetTemp),
        target_minutes: Number(targetMin),
        actual_temp: Number(actualTemp),
        actual_minutes: Number(actualMin),
        comment,
      });
      setDone(res);
    } catch (e) { alert('Submit failed: ' + e.message); }
    finally { setSubmitting(false); }
  };

  if (done) {
    return (
      <div style={{ padding: '24px 12px', fontFamily: 'Outfit, sans-serif' }} data-testid="sous-vide-done">
        <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '36px 22px', textAlign: 'center', marginTop: 80 }}>
          <div style={{ width: 72, height: 72, borderRadius: 999, background: done.passed ? '#34C759' : '#FF3B30', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Check size={36} strokeWidth={2.6} color="#fff" />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px' }}>{done.passed ? 'Cook OK' : 'Programme not met'}</h2>
          <p style={{ fontSize: 14, color: '#3A3A3C', margin: '0 0 18px' }}>
            {state.item_name} · {Number(done.actual_temp).toFixed(1)}°C ({done.temp_pass ? '✓' : '✗'}) · {done.actual_minutes} min ({done.time_pass ? '✓' : '✗'})
          </p>
          <button data-testid="sous-vide-done-back" onClick={() => navigate('/jkhive/sous-vide', { replace: true })}
            style={{ width: '100%', padding: '14px 16px', borderRadius: 999, border: 0, background: '#1D1D1F', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>Done</button>
        </div>
      </div>
    );
  }

  const numStyle = { width: '100%', padding: '12px 14px', fontSize: 16, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12, background: '#fff', outline: 'none', fontFamily: 'Outfit, sans-serif' };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: '#86868B', marginBottom: 4, display: 'block' };

  return (
    <div style={{ paddingBottom: 130, fontFamily: 'Outfit, sans-serif' }} data-testid="sous-vide-record">
      <WizardHeader title={state.item_name} locationName={locationName} dateStr={today} onBack={() => navigate(-1)} />

      <div style={{ textAlign: 'center', margin: '4px 0 20px' }}>
        <div style={{ fontSize: 96, lineHeight: 1 }}>🍲</div>
        <p style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 0' }}>Time / Temp Programme</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 14, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#1D1D1F' }}>Target programme</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Temp (°C)</label>
              <input data-testid="sous-vide-target-temp" type="number" inputMode="decimal" step={0.5} value={targetTemp}
                onChange={e => setTargetTemp(parseFloat(e.target.value) || 0)} style={numStyle} />
            </div>
            <div>
              <label style={labelStyle}>Minutes</label>
              <input data-testid="sous-vide-target-min" type="number" inputMode="numeric" step={1} value={targetMin}
                onChange={e => setTargetMin(parseFloat(e.target.value) || 0)} style={numStyle} />
            </div>
          </div>
        </div>
        <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 14, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#1D1D1F' }}>Actual reading</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Core temp (°C)</label>
              <input data-testid="sous-vide-actual-temp" type="number" inputMode="decimal" step={0.1} value={actualTemp}
                onChange={e => setActualTemp(parseFloat(e.target.value) || 0)} style={numStyle} />
            </div>
            <div>
              <label style={labelStyle}>Elapsed min</label>
              <input data-testid="sous-vide-actual-min" type="number" inputMode="numeric" step={1} value={actualMin}
                onChange={e => setActualMin(parseFloat(e.target.value) || 0)} style={numStyle} />
            </div>
          </div>
        </div>
        <textarea data-testid="sous-vide-comment" value={comment} onChange={e => setComment(e.target.value.slice(0, 250))} rows={3} placeholder="Comment (optional)"
          style={{ width: '100%', padding: 14, fontSize: 15, border: '1px solid rgba(0,0,0,0.18)', borderRadius: 14, background: '#fff', resize: 'vertical', outline: 'none', fontFamily: 'Outfit, sans-serif' }} />
      </div>

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 64, zIndex: 5 }}>
        <button data-testid="sous-vide-submit" onClick={submit} disabled={submitting}
          style={{ width: '100%', padding: '20px 16px', border: 0, background: '#1D1D1F', color: '#fff', fontSize: 18, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1, fontFamily: 'Outfit, sans-serif' }}>
          {submitting ? 'Submitting…' : 'Submit Sous Vide Record'}
        </button>
      </div>
    </div>
  );
};

export default SousVideRecord;
