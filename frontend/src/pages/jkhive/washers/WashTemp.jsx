import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader, TempStepper, TempGauge } from '../cooling/_shared';

/**
 * /jkhive/washer-temps/:washerId/wash
 * Wash-cycle temp: gauge 30→70°C, default 55°C, recommended ≥ 55°C.
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
      <WizardHeader title={washer.name} locationName={locationName} dateStr={today} onBack={() => navigate('/jkhive/washer-temps')} />

      <div style={{ textAlign: 'center', margin: '4px 0 8px' }}>
        <div style={{ fontSize: 96, lineHeight: 1 }}>🫧</div>
        <p style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.01em', color: '#1D1D1F', margin: '4px 0 0' }}>
          Wash Cycle Temperature
        </p>
      </div>

      <TempStepper value={temp} onChange={setTemp} />

      <TempGauge
        value={temp} min={30} max={70} ticks={[30, 40, 50, 55, 60, 70]}
        onChange={setTemp}
        color={knobColor}
      />

      <p style={{ fontSize: 14, color: '#1D1D1F', textAlign: 'center', marginTop: 18, lineHeight: 1.4 }}>
        Recommended:<br/>≥ 55°C
      </p>

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 64, zIndex: 5 }}>
        <button data-testid="washer-wash-next"
          onClick={() => navigate(`/jkhive/washer-temps/${washerId}/rinse`, { state: { washer, wash_temp: Number(temp) } })}
          style={{
            width: '100%', padding: '20px 16px', border: 0,
            background: '#1D1D1F', color: '#FFFFFF', fontSize: 18, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
          }}>Next</button>
      </div>
    </div>
  );
};

export default WashTemp;
