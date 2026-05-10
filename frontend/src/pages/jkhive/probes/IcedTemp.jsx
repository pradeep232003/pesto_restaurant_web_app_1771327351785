import React, { useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation, Navigate } from 'react-router-dom';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader, TempStepper, TempGauge } from '../cooling/_shared';

/**
 * /jkhive/probe-calibration/:probeId/iced — IMG_6711.
 * Iced-water test: gauge -10→10°C, default 0°C, recommended 0°C ± 1°C.
 * Carries the boiling reading forward via route state.
 */
const IcedTemp = () => {
  const navigate = useNavigate();
  const { probeId } = useParams();
  const { state } = useLocation();
  const { adminLocationId, locations } = useLocation2();
  const [temp, setTemp] = useState(0);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  if (!state?.probe || state?.boiling_temp == null) {
    return <Navigate to={`/jkhive/probe-calibration/${probeId}/boiling`} replace />;
  }

  const inRange = Math.abs(temp - 0) <= 1;
  const knobColor = inRange ? '#34C759' : '#FF3B30';

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="probe-iced">
      <WizardHeader title={state.probe.name} locationName={locationName} dateStr={today} onBack={() => navigate(-1)} />

      <div style={{ textAlign: 'center', margin: '4px 0 8px' }}>
        <div style={{ fontSize: 96, lineHeight: 1 }}>❄️</div>
        <p style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.01em', color: '#1D1D1F', margin: '4px 0 0' }}>
          Iced Water Temperature
        </p>
      </div>

      <TempStepper value={temp} onChange={setTemp} />

      <TempGauge
        value={temp} min={-10} max={10} ticks={[-10, -6, -2, 2, 6, 10]}
        onChange={setTemp}
        color={knobColor}
      />

      <p style={{ fontSize: 14, color: '#1D1D1F', textAlign: 'center', marginTop: 18, lineHeight: 1.4 }}>
        Recommended range:<br/>0°C (+/- 1°C)
      </p>

      <div style={{ position: 'fixed', left: 16, right: 16, bottom: 84, zIndex: 5 }}>
        <button data-testid="probe-iced-next"
          onClick={() => navigate(`/jkhive/probe-calibration/${probeId}/comment`, {
            state: { probe: state.probe, boiling_temp: state.boiling_temp, iced_temp: Number(temp) },
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

export default IcedTemp;
