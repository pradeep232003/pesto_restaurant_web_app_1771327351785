import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader, TempStepper, TempGauge } from '../cooling/_shared';
import WheelPicker from '../_shared/WheelPicker';

const MIN_PRE = 63;
const MIN_RAW = 54;

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const BATCH_OPTS = range(1, 99);
const HOUR_OPTS = range(0, 24);
const MIN_OPTS = range(0, 59);

/**
 * /jkhive/sous-vide/record — 4-step wizard:
 *   1. Raw or Pre-cooked?         (IMG_6739)
 *   2. How many items in batch?   (IMG_6740)
 *   3. Water bath temperature     (IMG_6741)
 *   4. How long in the bath?      (IMG_6742) → "Start sous vide"
 */
const SousVideRecord = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { adminLocationId, locations } = useLocation2();
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  const [step, setStep] = useState(1);
  const [rawOrCooked, setRawOrCooked] = useState(null);     // 'raw' | 'pre-cooked'
  const [batchCount, setBatchCount] = useState(1);
  const [bathTemp, setBathTemp] = useState(63);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);

  if (!state?.item_name) return <Navigate to="/jkhive/sous-vide/pick" replace />;

  const minTemp = rawOrCooked === 'pre-cooked' ? MIN_PRE : MIN_RAW;
  const tempInRange = bathTemp >= minTemp;
  const knobColor = tempInRange ? '#34C759' : '#FF3B30';

  const back = () => (step === 1 ? navigate(-1) : setStep(step - 1));

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await api.sousVideRecord({
        location_id: adminLocationId,
        item_name: state.item_name,
        item_category: state.item_category,
        raw_or_cooked: rawOrCooked,
        batch_count: Number(batchCount),
        bath_temp: Number(bathTemp),
        duration_hours: Number(hours),
        duration_minutes: Number(minutes),
      });
      setDone(res);
    } catch (e) { alert('Submit failed: ' + e.message); }
    finally { setSubmitting(false); }
  };

  if (done) {
    const totalMin = done.duration_total_minutes;
    const h = Math.floor(totalMin / 60), m = totalMin % 60;
    return (
      <div style={{ padding: '24px 12px', fontFamily: 'Outfit, sans-serif' }} data-testid="sous-vide-done">
        <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '36px 22px', textAlign: 'center', marginTop: 80 }}>
          <div style={{ width: 72, height: 72, borderRadius: 999, background: done.passed ? '#34C759' : '#FF3B30', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Check size={36} strokeWidth={2.6} color="#fff" />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px' }}>
            {done.passed ? 'Sous vide started' : 'Bath below safe temp'}
          </h2>
          <p style={{ fontSize: 14, color: '#3A3A3C', margin: '0 0 18px' }}>
            {state.item_name} · {done.raw_or_cooked} · ×{done.batch_count}<br/>
            {Number(done.bath_temp).toFixed(1)} °C ({done.temp_pass ? '✓' : '✗ min ' + done.min_temp + '°C'}) · {h}h {m}m
          </p>
          <button data-testid="sous-vide-done-back" onClick={() => navigate('/jkhive/sous-vide', { replace: true })}
            style={{ width: '100%', padding: '14px 16px', borderRadius: 999, border: 0, background: '#1D1D1F', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>Done</button>
        </div>
      </div>
    );
  }

  // ---------- Step 1 — Raw or pre-cooked? ----------
  if (step === 1) {
    const Card = ({ id, label }) => (
      <button data-testid={`sous-vide-rc-${id}`}
        onClick={() => { setRawOrCooked(id); setBathTemp(id === 'pre-cooked' ? MIN_PRE : MIN_RAW); setStep(2); }}
        style={{
          flex: 1, height: 200, borderRadius: 18, background: '#FFFFFF',
          border: '2.5px solid #1D1D1F', cursor: 'pointer',
          display: 'flex', alignItems: 'flex-end', padding: 18,
          fontSize: 22, fontWeight: 600, color: '#1D1D1F',
          fontFamily: 'Outfit, sans-serif',
        }}>{label}</button>
    );
    return (
      <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="sous-vide-step1">
        <WizardHeader title="Sous Vide" locationName={locationName} dateStr={today} onBack={back} />
        <h2 style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.01em', color: '#1D1D1F', margin: '32px 0 60px' }}>
          Is this item raw or pre-cooked?
        </h2>
        <div style={{ display: 'flex', gap: 14 }}>
          <Card id="pre-cooked" label="Pre-cooked" />
          <Card id="raw" label="Raw" />
        </div>
      </div>
    );
  }

  // ---------- Step 2 — Batch count ----------
  if (step === 2) {
    return (
      <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="sous-vide-step2">
        <WizardHeader title="Sous Vide" locationName={locationName} dateStr={today} onBack={back} />
        <h2 style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.01em', color: '#1D1D1F', margin: '32px 0 24px' }}>
          How many items are in this batch?
        </h2>
        <div style={{ marginTop: 40 }}>
          <WheelPicker testId="sous-vide-batch" options={BATCH_OPTS} value={batchCount} onChange={setBatchCount} />
        </div>
        <div style={{ position: 'fixed', left: 16, right: 16, bottom: 84, zIndex: 5 }}>
          <button data-testid="sous-vide-batch-next" onClick={() => setStep(3)}
            style={{ width: '100%', padding: '18px 16px', border: 0, borderRadius: 999, background: '#1D1D1F', color: '#fff', fontSize: 17, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', boxShadow: '0 8px 22px rgba(0,0,0,0.25)' }}>Next</button>
        </div>
      </div>
    );
  }

  // ---------- Step 3 — Water bath temperature ----------
  if (step === 3) {
    const cookedLabel = rawOrCooked === 'pre-cooked' ? 'Pre-Cooked' : 'Raw';
    return (
      <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="sous-vide-step3">
        <WizardHeader title="Sous Vide" locationName={locationName} dateStr={today} onBack={back} />
        <div style={{ textAlign: 'center', margin: '12px 0 8px' }}>
          <h2 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.01em', color: '#1D1D1F', margin: 0 }}>
            Water bath temperature:
          </h2>
          <p style={{ fontSize: 22, fontWeight: 600, color: '#1D1D1F', margin: '6px 0 0' }}>
            {cookedLabel}<br/>{state.item_name}
          </p>
          <div style={{ fontSize: 64, lineHeight: 1, marginTop: 8 }}>{state.item_icon || '🍲'}</div>
        </div>

        <TempStepper value={bathTemp} onChange={(v) => setBathTemp(Math.round(v * 10) / 10)} />

        <TempGauge
          value={bathTemp} min={45} max={100}
          ticks={[45, 56, 67, 78, 89, 100]}
          onChange={(v) => setBathTemp(Math.round(v * 10) / 10)}
          color={knobColor}
        />

        <p style={{ fontSize: 14, color: '#1D1D1F', textAlign: 'center', marginTop: 18, lineHeight: 1.4 }}>
          Recommended: ≥ {minTemp} °C ({cookedLabel.toLowerCase()})
        </p>

        <div style={{ position: 'fixed', left: 16, right: 16, bottom: 84, zIndex: 5 }}>
          <button data-testid="sous-vide-temp-next" onClick={() => setStep(4)}
            style={{ width: '100%', padding: '18px 16px', border: 0, borderRadius: 999, background: '#1D1D1F', color: '#fff', fontSize: 17, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', boxShadow: '0 8px 22px rgba(0,0,0,0.25)' }}>Next</button>
        </div>
      </div>
    );
  }

  // ---------- Step 4 — Duration ----------
  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="sous-vide-step4">
      <WizardHeader title="Sous Vide" locationName={locationName} dateStr={today} onBack={back} />
      <h2 style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.01em', color: '#1D1D1F', margin: '32px 0 12px' }}>
        How long will this item be in the water bath for?
      </h2>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: 8, marginTop: 24, position: 'relative' }}>
        <div style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
          <WheelPicker testId="sous-vide-hours" options={HOUR_OPTS} value={hours} onChange={setHours} />
        </div>
        <div style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
          <WheelPicker testId="sous-vide-minutes" options={MIN_OPTS} value={minutes} onChange={setMinutes} />
        </div>
        {/* Centre row labels */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', display: 'flex', justifyContent: 'space-around', pointerEvents: 'none' }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <span style={{ fontSize: 20, fontWeight: 600, color: '#86868B', marginLeft: 50 }}>hours</span>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <span style={{ fontSize: 20, fontWeight: 600, color: '#86868B', marginLeft: 50 }}>min.</span>
          </div>
        </div>
      </div>

      <div style={{ position: 'fixed', left: 16, right: 16, bottom: 84, zIndex: 5 }}>
        <button data-testid="sous-vide-submit"
          onClick={submit}
          disabled={submitting || (hours === 0 && minutes === 0)}
          style={{
            width: '100%', padding: '18px 16px', border: 0, borderRadius: 999,
            background: '#1D1D1F', color: '#fff', fontSize: 17, fontWeight: 600,
            cursor: (submitting || (hours === 0 && minutes === 0)) ? 'not-allowed' : 'pointer',
            opacity: (submitting || (hours === 0 && minutes === 0)) ? 0.5 : 1,
            fontFamily: 'Outfit, sans-serif',
            boxShadow: '0 8px 22px rgba(0,0,0,0.25)',
          }}>
          {submitting ? 'Starting…' : 'Start sous vide'}
        </button>
      </div>
    </div>
  );
};

export default SousVideRecord;
