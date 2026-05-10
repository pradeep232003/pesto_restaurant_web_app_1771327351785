import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader, TempStepper, TempGauge } from '../cooling/_shared';

/**
 * /jkhive/acidity/record — IMG_6724.
 * pH gauge 0 → 14 with ticks 0/2.8/5.6/8.4/11.2/14, default 7.0, step 0.1.
 * Pass when pH ≤ 4.6 (FSA acidified-foods rule). Header is the routine
 * label "Record Food Acidity"; body shows item icon + name.
 */
const AcidityRecord = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { adminLocationId, locations } = useLocation2();
  const [ph, setPh] = useState(7.0);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  if (!state?.item_name) return <Navigate to="/jkhive/acidity/pick" replace />;

  const inRange = ph <= 4.6;
  const knobColor = inRange ? '#34C759' : '#FF3B30';

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="acidity-record">
      <WizardHeader title="Record Food Acidity" locationName={locationName} dateStr={today} onBack={() => navigate(-1)} />

      <div style={{ textAlign: 'center', margin: '12px 0 8px' }}>
        <div style={{ fontSize: 110, lineHeight: 1 }}>{state.item_icon || '🧪'}</div>
        <p style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.01em', color: '#1D1D1F', margin: '8px 0 18px' }}>
          {state.item_name}
        </p>
      </div>

      <TempStepper value={ph} onChange={(v) => setPh(Math.round(v * 10) / 10)} suffix="pH" />

      <TempGauge
        value={ph} min={0} max={14} ticks={[0, 2.8, 5.6, 8.4, 11.2, 14]}
        onChange={(v) => setPh(Math.round(v * 10) / 10)}
        color={knobColor}
        tickSuffix=""
      />

      <div style={{ position: 'fixed', left: 16, right: 16, bottom: 84, zIndex: 5 }}>
        <button data-testid="acidity-next"
          onClick={() => navigate('/jkhive/acidity/comment', { state: { ...state, ph_value: Number(ph) } })}
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

export default AcidityRecord;
