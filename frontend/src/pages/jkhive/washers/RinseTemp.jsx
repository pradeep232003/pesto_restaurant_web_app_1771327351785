import React, { useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation, Navigate } from 'react-router-dom';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader, TempStepper, TempGauge } from '../cooling/_shared';

/**
 * /jkhive/washer-temps/:washerId/rinse — IMG_6721.
 * Rinse-cycle temp: gauge 70 → 90 °C with ticks 70/74/78/82/86/90.
 * Pass when value ≥ 81 °C. Carries the wash reading forward via route state.
 */
const RinseTemp = () => {
  const navigate = useNavigate();
  const { washerId } = useParams();
  const { state } = useLocation();
  const { adminLocationId, locations } = useLocation2();
  const [temp, setTemp] = useState(85);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  if (!state?.washer || state?.wash_temp == null) {
    return <Navigate to={`/jkhive/washer-temps/${washerId}/wash`} replace />;
  }

  const inRange = temp >= 81;
  const knobColor = inRange ? '#34C759' : '#FF3B30';

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="washer-rinse">
      <WizardHeader title="Record Washer Temperatures" locationName={locationName} dateStr={today} onBack={() => navigate(-1)} />

      <h2 style={{
        fontSize: 38, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.02em',
        color: '#1D1D1F', margin: '12px 16px 28px',
      }}>
        Temperature during rinse cycle:
      </h2>

      <TempStepper value={temp} onChange={setTemp} />

      <TempGauge
        value={temp} min={70} max={90} ticks={[70, 74, 78, 82, 86, 90]}
        onChange={setTemp}
        color={knobColor}
      />

      <p style={{ fontSize: 14, color: '#1D1D1F', textAlign: 'center', marginTop: 18, lineHeight: 1.4 }}>
        Recommended range:<br/>81°C or higher
      </p>

      <div style={{ position: 'fixed', left: 16, right: 16, bottom: 84, zIndex: 5 }}>
        <button data-testid="washer-rinse-next"
          onClick={() => navigate(`/jkhive/washer-temps/${washerId}/comment`, {
            state: { washer: state.washer, wash_temp: state.wash_temp, rinse_temp: Number(temp) },
          })}
          style={{
            width: '100%', padding: '18px 16px', border: 0, borderRadius: 999,
            background: '#1D1D1F', color: '#FFFFFF', fontSize: 17, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
            boxShadow: '0 8px 22px rgba(0,0,0,0.25)',
          }}>Next</button>
      </div>
    </div>
  );
};

export default RinseTemp;
