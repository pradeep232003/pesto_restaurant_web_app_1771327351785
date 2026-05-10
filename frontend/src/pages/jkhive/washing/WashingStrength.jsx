import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader, TempStepper, TempGauge } from '../cooling/_shared';

/**
 * /jkhive/food-washing/strength — IMG_6734 / IMG_6735.
 * Chemical-specific strength gauge:
 *   • chlorine: range 100–200 ppm, default 150, pass when 50–200 (always green here).
 *   • acid:     range 0–3 pH,    default 2.0, pass when 0.5–3.0.
 */
const WashingStrength = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { adminLocationId, locations } = useLocation2();
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  const isChlorine = state?.sanitiser === 'chlorine';
  const cfg = isChlorine
    ? { min: 100, max: 200, ticks: [100, 120, 140, 160, 180, 200], suffix: 'ppm', step: 1, pass: (v) => v >= 50 && v <= 200, q: 'What is the strength of the chlorine?', defaultV: 150 }
    : { min: 0,   max: 3,   ticks: [0, 0.6, 1.2, 1.8, 2.4, 3],     suffix: 'pH',  step: 0.1, pass: (v) => v >= 0.5 && v <= 3.0, q: 'What is the strength of the acid?',  defaultV: 2.0 };

  const [val, setVal] = useState(cfg.defaultV);

  if (!state?.item_name || !state?.sanitiser) {
    return <Navigate to="/jkhive/food-washing/pick" replace />;
  }

  const inRange = cfg.pass(val);
  const knobColor = inRange ? '#34C759' : '#FF3B30';

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="washing-strength">
      <WizardHeader title="Chemical Food Washing" locationName={locationName} dateStr={today} onBack={() => navigate(-1)} />

      <h2 style={{
        fontSize: 38, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.02em',
        color: '#1D1D1F', margin: '12px 16px 32px',
      }}>{cfg.q}</h2>

      <TempStepper
        value={val}
        onChange={(v) => setVal(Math.round(v / cfg.step) * cfg.step)}
        suffix={cfg.suffix}
      />

      <TempGauge
        value={val} min={cfg.min} max={cfg.max} ticks={cfg.ticks}
        onChange={(v) => setVal(Math.round(v / cfg.step) * cfg.step)}
        color={knobColor}
        tickSuffix=""
      />

      <div style={{ position: 'fixed', left: 16, right: 16, bottom: 84, zIndex: 5 }}>
        <button data-testid="washing-strength-next"
          onClick={() => navigate('/jkhive/food-washing/comment', { state: { ...state, ppm: Number(val) } })}
          style={{
            width: '100%', padding: '18px 16px', border: 0, borderRadius: 999,
            background: '#1D1D1F', color: '#fff', fontSize: 17, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
            boxShadow: '0 8px 22px rgba(0,0,0,0.25)',
          }}>Next</button>
      </div>
    </div>
  );
};

export default WashingStrength;
