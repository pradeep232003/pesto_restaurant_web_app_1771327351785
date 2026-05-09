import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader, TempStepper, TempGauge } from '../cooling/_shared';

/**
 * /jkhive/probe-calibration/:probeId/boiling — IMG_6710.
 * Boiling-water test: gauge 90→110°C, default 100°C, recommended 100°C ± 1°C.
 * Header shows the probe name; back chevron returns to picker.
 */
const BoilingTemp = () => {
  const navigate = useNavigate();
  const { probeId } = useParams();
  const { state } = useLocation();
  const { adminLocationId, locations } = useLocation2();
  const [probe, setProbe] = useState(state?.probe || null);
  const [temp, setTemp] = useState(100);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  useEffect(() => {
    if (probe || !adminLocationId) return;
    api.probesList(adminLocationId).then(rows => {
      const p = (rows || []).find(r => r.id === probeId);
      if (!p) { alert('Probe not found'); navigate('/jkhive/probe-calibration'); return; }
      setProbe(p);
    });
  }, [adminLocationId, probe, probeId, navigate]);

  if (!probe) return null;
  const inRange = Math.abs(temp - 100) <= 1;
  const knobColor = inRange ? '#34C759' : '#FF3B30';

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="probe-boiling">
      <WizardHeader title={probe.name} locationName={locationName} dateStr={today} onBack={() => navigate('/jkhive/probe-calibration')} />

      <div style={{ textAlign: 'center', margin: '4px 0 8px' }}>
        <div style={{ fontSize: 96, lineHeight: 1 }}>🌡️</div>
        <p style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.01em', color: '#1D1D1F', margin: '4px 0 0' }}>
          Boiling Water Temperature
        </p>
      </div>

      <TempStepper value={temp} onChange={setTemp} />

      <TempGauge
        value={temp} min={90} max={110} ticks={[90, 94, 98, 102, 106, 110]}
        onChange={setTemp}
        color={knobColor}
      />

      <p style={{ fontSize: 14, color: '#1D1D1F', textAlign: 'center', marginTop: 18, lineHeight: 1.4 }}>
        Recommended range:<br/>100°C (+/- 1°C)
      </p>

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 64, zIndex: 5 }}>
        <button data-testid="probe-boiling-next"
          onClick={() => navigate(`/jkhive/probe-calibration/${probeId}/iced`, { state: { probe, boiling_temp: Number(temp) } })}
          style={{
            width: '100%', padding: '20px 16px', border: 0,
            background: '#1D1D1F', color: '#FFFFFF', fontSize: 18, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
          }}>Next</button>
      </div>
    </div>
  );
};

export default BoilingTemp;
