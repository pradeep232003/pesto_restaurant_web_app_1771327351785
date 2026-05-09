import React, { useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation, Navigate } from 'react-router-dom';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader, TempStepper, TempGauge } from '../cooling/_shared';

/**
 * /jkhive/washer-temps/:washerId/rinse
 * Rinse-cycle temp: gauge 65→95°C, default 82°C, recommended ≥ 82°C.
 * Carries the wash reading forward via route state.
 */
const RinseTemp = () => {
  const navigate = useNavigate();
  const { washerId } = useParams();
  const { state } = useLocation();
  const { adminLocationId, locations } = useLocation2();
  const [temp, setTemp] = useState(82);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  if (!state?.washer || state?.wash_temp == null) {
    return <Navigate to={`/jkhive/washer-temps/${washerId}/wash`} replace />;
  }

  const inRange = temp >= 82;
  const knobColor = inRange ? '#34C759' : '#FF3B30';

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="washer-rinse">
      <WizardHeader title={state.washer.name} locationName={locationName} dateStr={today} onBack={() => navigate(-1)} />

      <div style={{ textAlign: 'center', margin: '4px 0 8px' }}>
        <div style={{ fontSize: 96, lineHeight: 1 }}>♨️</div>
        <p style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.01em', color: '#1D1D1F', margin: '4px 0 0' }}>
          Rinse Cycle Temperature
        </p>
      </div>

      <TempStepper value={temp} onChange={setTemp} />

      <TempGauge
        value={temp} min={65} max={95} ticks={[65, 71, 77, 82, 87, 95]}
        onChange={setTemp}
        color={knobColor}
      />

      <p style={{ fontSize: 14, color: '#1D1D1F', textAlign: 'center', marginTop: 18, lineHeight: 1.4 }}>
        Recommended:<br/>≥ 82°C
      </p>

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 64, zIndex: 5 }}>
        <button data-testid="washer-rinse-next"
          onClick={() => navigate(`/jkhive/washer-temps/${washerId}/comment`, {
            state: { washer: state.washer, wash_temp: state.wash_temp, rinse_temp: Number(temp) },
          })}
          style={{
            width: '100%', padding: '20px 16px', border: 0,
            background: '#1D1D1F', color: '#FFFFFF', fontSize: 18, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
          }}>Next</button>
      </div>
    </div>
  );
};

export default RinseTemp;
