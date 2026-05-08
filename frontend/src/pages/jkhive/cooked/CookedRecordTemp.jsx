import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader, TempStepper, TempGauge } from '../cooling/_shared';
import { categoryEmoji } from '../cooling/CoolingHome';

/**
 * /jkhive/cooked-temp/record — set the cooked-food core temperature, then Next.
 * UK FSA target: ≥ 75°C core temp (or equivalent — e.g. 70°C for 2 min).
 */
const CookedRecordTemp = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { adminLocationId, locations } = useLocation2();
  const [temp, setTemp] = useState(82);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  if (!state?.itemName) return <Navigate to="/jkhive/cooked-temp/new" replace />;

  const passed = temp >= 75;

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="cooked-record">
      <WizardHeader title="Record Cooked Temperature" locationName={locationName} dateStr={today} backTo="/jkhive/cooked-temp/new" />

      <div style={{ textAlign: 'center', margin: '6px 0 14px' }}>
        <div style={{ fontSize: 96, lineHeight: 1 }}>{categoryEmoji(state.category)}</div>
        <p style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em', color: '#1D1D1F', margin: '8px 0 0' }}>{state.itemName}</p>
      </div>

      <TempStepper value={temp} onChange={setTemp} />

      <TempGauge value={temp} min={0} max={100} ticks={[0, 25, 50, 75, 100]}
        onChange={setTemp}
        color={passed ? '#34C759' : '#FF3B30'} />

      <p style={{ fontSize: 13, color: '#86868B', textAlign: 'center', marginTop: 26 }}>
        Recommended:<br/>
        <b style={{ color: passed ? '#34C759' : '#FF3B30' }}>
          Core temperature ≥ 75°C (or equivalent: 70°C for 2 min)
        </b>
      </p>

      <div style={{ position: 'fixed', left: 16, right: 16, bottom: 96, maxWidth: 600, margin: '0 auto', zIndex: 5 }}>
        <button data-testid="cooked-next-btn"
          onClick={() => navigate('/jkhive/cooked-temp/comment', { state: { ...state, temp } })}
          style={{
            width: '100%', padding: '18px 16px', borderRadius: 999, border: 0,
            background: '#1D1D1F', color: '#FFFFFF', fontSize: 17, fontWeight: 600,
            cursor: 'pointer', boxShadow: '0 6px 18px rgba(0,0,0,0.18)', fontFamily: 'Outfit, sans-serif',
          }}>Next</button>
      </div>
    </div>
  );
};

export default CookedRecordTemp;
