import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader, TempStepper, TempGauge } from '../cooling/_shared';

/**
 * /jkhive/washer-temps/:washerId/wash — IMG_6720.
 * Wash-cycle temp: gauge 45 → 90 °C with ticks 45/54/63/72/81/90.
 * Pass when value ≥ 55 °C; below that the active arc and knob render red.
 */
const WashTemp = () => {
  const navigate = useNavigate();
  const { washerId } = useParams();
  const { state } = useLocation();
  const { adminLocationId, locations } = useLocation2();
  const [washer, setWasher] = useState(state?.washer || null);
  const [temp, setTemp] = useState(55);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  useEffect(() => {
    if (washer || !adminLocationId) return;
    api.washersList(adminLocationId).then(rows => {
      const w = (rows || []).find(r => r.id === washerId);
      if (!w) { alert('Washer not found'); navigate('/jkhive/washer-temps'); return; }
      setWasher(w);
    });
  }, [adminLocationId, washer, washerId, navigate]);

  if (!washer) return null;
  const inRange = temp >= 55;
  const knobColor = inRange ? '#34C759' : '#FF3B30';

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="washer-wash">
      <WizardHeader title="Record Washer Temperatures" locationName={locationName} dateStr={today} onBack={() => navigate('/jkhive/washer-temps')} />

      <h2 style={{
        fontSize: 38, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.02em',
        color: '#1D1D1F', margin: '12px 16px 28px',
      }}>
        Temperature during wash cycle:
      </h2>

      <TempStepper value={temp} onChange={setTemp} />

      <TempGauge
        value={temp} min={45} max={90} ticks={[45, 54, 63, 72, 81, 90]}
        onChange={setTemp}
        color={knobColor}
      />

      <p style={{ fontSize: 14, color: '#1D1D1F', textAlign: 'center', marginTop: 18, lineHeight: 1.4 }}>
        Recommended range:<br/>55°C or higher
      </p>

      <div style={{ position: 'fixed', left: 16, right: 16, bottom: 84, zIndex: 5 }}>
        <button data-testid="washer-wash-next"
          onClick={() => navigate(`/jkhive/washer-temps/${washerId}/rinse`, { state: { washer, wash_temp: Number(temp) } })}
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

export default WashTemp;
