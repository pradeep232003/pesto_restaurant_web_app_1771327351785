import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader, TempStepper, TempGauge } from '../cooling/_shared';
import { categoryEmoji } from '../cooling/CoolingHome';

/**
 * /jkhive/delivery-records/record — set the goods-in temperature, then Next.
 * UK FSA: chilled food ≤ 8°C; frozen food ≤ -18°C.
 * Gauge spans -25°C to +15°C, default 5°C (matches IMG_6689).
 */
const RecordTemp = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { adminLocationId, locations } = useLocation2();
  const [temp, setTemp] = useState(5);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  if (!state?.itemName || !state?.supplier) return <Navigate to="/jkhive/delivery-records/supplier" replace />;

  const chilledOk = temp <= 8 && temp > -18;
  const frozenOk = temp <= -18;
  const passes = chilledOk || frozenOk;
  const knobColor = passes ? '#34C759' : '#FF3B30';

  const Tick = ({ ok, children }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, color: ok ? '#34C759' : '#86868B' }}>
      {ok ? <Check size={14} strokeWidth={2.6} color="#34C759" /> : <span style={{ width: 14 }} />}
      {children}
    </span>
  );

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="delivery-record">
      <WizardHeader title="Record New Delivery" locationName={locationName} dateStr={today} backTo="/jkhive/delivery-records/item" />

      <div style={{ textAlign: 'center', margin: '6px 0 14px' }}>
        <div style={{ fontSize: 96, lineHeight: 1 }}>{categoryEmoji(state.category)}</div>
        <p style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em', color: '#1D1D1F', margin: '8px 0 0' }}>{state.itemName}</p>
        <p style={{ fontSize: 12, color: '#86868B', margin: '4px 0 0' }}>from <b style={{ color: '#1D1D1F' }}>{state.supplier.name}</b></p>
      </div>

      <TempStepper value={temp} onChange={setTemp} />

      <TempGauge
        value={temp} min={-25} max={15} ticks={[-25, -17, -9, -1, 7, 15]}
        onChange={setTemp}
        color={knobColor}
      />

      <div style={{ marginTop: 26, padding: '14px 16px', background: '#FFFFFF', borderRadius: 14, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#86868B', margin: '0 0 8px' }}>
          Recommended range
        </p>
        <p style={{ fontSize: 14, margin: '4px 0' }}>
          <Tick ok={chilledOk}>Chilled food: 8°C or lower</Tick>
        </p>
        <p style={{ fontSize: 14, margin: '4px 0' }}>
          <Tick ok={frozenOk}>Frozen food: -18°C or lower</Tick>
        </p>
      </div>

      <div style={{ position: 'fixed', left: 16, right: 16, bottom: 96, maxWidth: 600, margin: '0 auto', zIndex: 5 }}>
        <button data-testid="delivery-next-btn"
          onClick={() => navigate('/jkhive/delivery-records/comment', { state: { ...state, temp } })}
          style={{
            width: '100%', padding: '18px 16px', borderRadius: 999, border: 0,
            background: '#1D1D1F', color: '#FFFFFF', fontSize: 17, fontWeight: 600,
            cursor: 'pointer', boxShadow: '0 6px 18px rgba(0,0,0,0.18)', fontFamily: 'Outfit, sans-serif',
          }}>Next</button>
      </div>
    </div>
  );
};

export default RecordTemp;
