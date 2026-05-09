import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader, TempStepper, TempGauge } from '../cooling/_shared';
import { categoryEmoji } from '../cooling/CoolingHome';

/**
 * /jkhive/hot-cold-holding/record — IMG_6716.
 * Hot:  gauge 55→100°C (default 75°C), recommended ≥ 63°C → red below.
 * Cold: gauge 0→25°C  (default 5°C),  recommended ≤ 8°C  → red above.
 * On Begin: creates an active session and routes back to home.
 */
const RecordHolding = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { adminLocationId, locations } = useLocation2();
  const isHot = state?.mode === 'hot';
  const [temp, setTemp] = useState(isHot ? 75 : 5);
  const [submitting, setSubmitting] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  if (!state?.mode || !state?.itemName) {
    return <Navigate to="/jkhive/hot-cold-holding/mode" replace />;
  }

  const inRange = isHot ? temp >= 63 : temp <= 8;
  const knobColor = inRange ? '#34C759' : '#FF3B30';
  const min = isHot ? 55 : 0;
  const max = isHot ? 100 : 25;
  const ticks = isHot ? [55, 64, 73, 82, 91, 100] : [0, 5, 10, 15, 20, 25];

  const begin = async () => {
    setSubmitting(true);
    try {
      await api.hotColdStart({
        location_id: adminLocationId,
        mode: state.mode,
        item_name: state.itemName,
        item_category: state.category,
        item_icon: state.itemIcon,
        start_temp: Number(temp),
      });
      navigate('/jkhive/hot-cold-holding', { replace: true });
    } catch (err) {
      alert('Could not start: ' + err.message);
    } finally { setSubmitting(false); }
  };

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="hot-cold-record">
      <WizardHeader title={`Record ${isHot ? 'Hot' : 'Cold'} Holding`} locationName={locationName} dateStr={today} onBack={() => navigate(-1)} />

      <div style={{ textAlign: 'center', margin: '4px 0 6px' }}>
        <div style={{ fontSize: 96, lineHeight: 1 }}>{state.itemIcon || categoryEmoji(state.category)}</div>
        <p style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em', color: '#1D1D1F', margin: '6px 0 0' }}>{state.itemName}</p>
      </div>

      <TempStepper value={temp} onChange={setTemp} />

      <TempGauge value={temp} min={min} max={max} ticks={ticks} onChange={setTemp} color={knobColor} />

      <p style={{ fontSize: 14, color: '#1D1D1F', textAlign: 'center', marginTop: 18, lineHeight: 1.4 }}>
        Recommended range:<br/>
        {isHot ? '63°C or higher' : '8°C or lower'}
      </p>

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 64, zIndex: 5 }}>
        <button data-testid="begin-holding" onClick={begin} disabled={submitting}
          style={{
            width: '100%', padding: '20px 16px', border: 0,
            background: '#1D1D1F', color: '#FFFFFF', fontSize: 18, fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1,
            fontFamily: 'Outfit, sans-serif',
          }}>
          {submitting ? 'Starting…' : `Begin ${isHot ? 'hot' : 'cold'} holding`}
        </button>
      </div>
    </div>
  );
};

export default RecordHolding;
