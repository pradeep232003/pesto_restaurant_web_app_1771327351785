import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader, TempStepper, TempGauge } from '../cooling/_shared';

/** /jkhive/vacuum-packing/record — pack temp + use-by date + comment + submit. */
const VacuumRecord = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { adminLocationId, locations } = useLocation2();
  const [packTemp, setPackTemp] = useState(3.0);
  const today = new Date().toISOString().slice(0, 10);
  const [useBy, setUseBy] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 5); return d.toISOString().slice(0, 10);
  });
  const [batchLabel, setBatchLabel] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  if (!state?.item_name) return <Navigate to="/jkhive/vacuum-packing/pick" replace />;

  const inRange = packTemp <= 5;
  const knobColor = inRange ? '#34C759' : '#FF3B30';

  const submit = async () => {
    if (!useBy) { alert('Use-by date is required'); return; }
    setSubmitting(true);
    try {
      const res = await api.vacuumRecord({
        location_id: adminLocationId,
        item_name: state.item_name,
        item_category: state.item_category,
        pack_temp: Number(packTemp),
        use_by_date: useBy,
        batch_label: batchLabel,
        comment,
      });
      setDone(res);
    } catch (e) { alert('Submit failed: ' + e.message); }
    finally { setSubmitting(false); }
  };

  if (done) {
    return (
      <div style={{ padding: '24px 12px', fontFamily: 'Outfit, sans-serif' }} data-testid="vacuum-done">
        <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '36px 22px', textAlign: 'center', marginTop: 80 }}>
          <div style={{ width: 72, height: 72, borderRadius: 999, background: done.passed ? '#34C759' : '#FF3B30', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Check size={36} strokeWidth={2.6} color="#fff" />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px' }}>{done.passed ? 'Pack OK' : 'Out of range'}</h2>
          <p style={{ fontSize: 14, color: '#3A3A3C', margin: '0 0 18px' }}>
            {state.item_name} · {Number(done.pack_temp).toFixed(1)} °C ({done.temp_pass ? '✓' : '✗'}) · use by {done.use_by_date}
          </p>
          <button data-testid="vacuum-done-back" onClick={() => navigate('/jkhive/vacuum-packing', { replace: true })}
            style={{ width: '100%', padding: '14px 16px', borderRadius: 999, border: 0, background: '#1D1D1F', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 130, fontFamily: 'Outfit, sans-serif' }} data-testid="vacuum-record">
      <WizardHeader title={state.item_name} locationName={locationName} dateStr={today} onBack={() => navigate(-1)} />

      <div style={{ textAlign: 'center', margin: '4px 0 8px' }}>
        <div style={{ fontSize: 96, lineHeight: 1 }}>📦</div>
        <p style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 0' }}>Core Temp at Pack</p>
      </div>

      <TempStepper value={packTemp} onChange={(v) => setPackTemp(Math.round(v * 10) / 10)} />
      <TempGauge value={packTemp} min={-5} max={15} ticks={[-5, 0, 5, 10, 15]} onChange={(v) => setPackTemp(Math.round(v * 10) / 10)} color={knobColor} />
      <p style={{ fontSize: 14, textAlign: 'center', marginTop: 18, lineHeight: 1.4 }}>Recommended: ≤ 5 °C</p>

      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F', marginBottom: 6, display: 'block' }}>Use-by date</label>
          <input type="date" data-testid="vacuum-useby" value={useBy} min={today} onChange={e => setUseBy(e.target.value)}
            style={{ width: '100%', padding: '14px 16px', fontSize: 16, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 14, background: '#fff', outline: 'none', fontFamily: 'Outfit, sans-serif' }} />
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F', marginBottom: 6, display: 'block' }}>
            Batch label <span style={{ color: '#86868B', fontWeight: 400 }}>(optional)</span>
          </label>
          <input data-testid="vacuum-batch" value={batchLabel} onChange={e => setBatchLabel(e.target.value.slice(0, 40))} placeholder="e.g. VB-12-MAY"
            style={{ width: '100%', padding: '14px 16px', fontSize: 16, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 14, background: '#fff', outline: 'none', fontFamily: 'Outfit, sans-serif' }} />
        </div>
        <textarea data-testid="vacuum-comment" value={comment} onChange={e => setComment(e.target.value.slice(0, 250))} rows={3} placeholder="Comment (optional)"
          style={{ width: '100%', padding: 14, fontSize: 15, border: '1px solid rgba(0,0,0,0.18)', borderRadius: 14, background: '#fff', resize: 'vertical', outline: 'none', fontFamily: 'Outfit, sans-serif' }} />
      </div>

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 64, zIndex: 5 }}>
        <button data-testid="vacuum-submit" onClick={submit} disabled={submitting}
          style={{ width: '100%', padding: '20px 16px', border: 0, background: '#1D1D1F', color: '#fff', fontSize: 18, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1, fontFamily: 'Outfit, sans-serif' }}>
          {submitting ? 'Submitting…' : 'Submit Vacuum Pack'}
        </button>
      </div>
    </div>
  );
};

export default VacuumRecord;
