import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader, TempStepper, TempGauge } from '../cooling/_shared';

/** /jkhive/legionella/hot — hot water temp gauge, pass ≥ 50 °C. */
const LegionellaHotTemp = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { adminLocationId, locations } = useLocation2();
  const [temp, setTemp] = useState(50);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  if (!state?.outlet) return <Navigate to="/jkhive/legionella/outlet" replace />;

  const inRange = temp >= 50;
  const knobColor = inRange ? '#34C759' : '#FF3B30';

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="legionella-hot">
      <WizardHeader title="Legionella" locationName={locationName} dateStr={today} onBack={() => navigate(-1)} />

      <div style={{ textAlign: 'center', margin: '4px 0 8px' }}>
        <div style={{ fontSize: 96, lineHeight: 1 }}>🔥</div>
        <p style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em', color: '#1D1D1F', margin: '4px 0 0' }}>
          Hot water temperature
        </p>
        <p style={{ fontSize: 14, color: '#86868B', margin: '4px 0 0' }}>{state.outlet}</p>
      </div>

      <TempStepper value={temp} onChange={(v) => setTemp(Math.round(v * 10) / 10)} />
      <TempGauge value={temp} min={20} max={80} ticks={[20, 35, 50, 65, 80]} onChange={(v) => setTemp(Math.round(v * 10) / 10)} color={knobColor} />

      <p style={{ fontSize: 14, color: '#1D1D1F', textAlign: 'center', marginTop: 18, lineHeight: 1.4 }}>
        Recommended: ≥ 50 °C within 1 min of running.
      </p>

      <div style={{ position: 'fixed', left: 16, right: 16, bottom: 84, zIndex: 5 }}>
        <button data-testid="legionella-hot-next"
          onClick={() => navigate('/jkhive/legionella/cold', { state: { outlet: state.outlet, hot_temp: Number(temp) } })}
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

export default LegionellaHotTemp;
