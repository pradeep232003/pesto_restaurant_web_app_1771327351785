import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader, TempStepper, TempGauge, PrimaryAction } from './_shared';
import { categoryEmoji } from './CoolingHome';
import { requestPermission, scheduleForLog } from './cooling_alarms';
import { ensurePushSubscribed } from './webpush';

/**
 * /jkhive/cooking-cooling/start — set the cooked-food temperature, then Begin Cooling.
 * Receives { itemName, category } via router state from CoolingPickItem.
 */
const CoolingStartTemp = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { adminLocationId, locations } = useLocation2();
  const [temp, setTemp] = useState(75); // typical just-cooked temp
  const [submitting, setSubmitting] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  if (!state?.itemName) return <Navigate to="/jkhive/cooking-cooling/new" replace />;

  const submit = async () => {
    setSubmitting(true);
    try {
      // Best-effort: request notification permission and subscribe to web push
      // so the 75/90-min cooling alerts fire even when the PWA is closed /
      // device is asleep. Falls back to in-tab setTimeout as a safety net.
      await requestPermission();
      ensurePushSubscribed(adminLocationId).catch(() => {});
      const res = await api.coolingStart({
        location_id: adminLocationId,
        item_name: state.itemName,
        item_category: state.category,
        start_temp_c: temp,
        target_temp_c: 8,
      });
      scheduleForLog(res);
      // Continue straight into "Record Cooled Temp" so the wizard stays
      // linear (Begin Cooling → Record temp → Comment → Submit). Staff can
      // tap the back arrow to leave it in `cooling` status and finish later
      // from the Cooking & Cooling home screen.
      navigate(`/jkhive/cooking-cooling/${res.id}/record`, { replace: true });
    } catch (err) {
      alert('Failed to start: ' + err.message);
    } finally { setSubmitting(false); }
  };

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="cooling-start">
      <WizardHeader title="Set Current Temp" locationName={locationName} dateStr={today} backTo="/jkhive/cooking-cooling/new" />

      <div style={{ textAlign: 'center', margin: '6px 0 14px' }}>
        <div style={{ fontSize: 96, lineHeight: 1 }}>{categoryEmoji(state.category)}</div>
        <p style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em', color: '#1D1D1F', margin: '8px 0 0' }}>{state.itemName}</p>
      </div>

      <TempStepper value={temp} onChange={setTemp} />

      <TempGauge
        value={temp}
        min={0} max={100}
        ticks={[0, 25, 50, 75, 100]}
        onChange={setTemp}
        color="#FF3B30"
      />

      <p style={{ fontSize: 13, color: '#86868B', textAlign: 'center', marginTop: 26 }}>
        Recommended: cooked food should be <b style={{ color: '#1D1D1F' }}>≥ 75°C</b> before cooling.<br/>
        Aim to cool to <b style={{ color: '#1D1D1F' }}>8°C within 90 mins</b>.
      </p>

      <div style={{ position: 'fixed', left: 16, right: 16, bottom: 96, maxWidth: 600, margin: '0 auto', zIndex: 5 }}>
        <button data-testid="begin-cooling-btn" onClick={submit} disabled={submitting}
          style={{
            width: '100%', padding: '18px 16px', borderRadius: 999, border: 0,
            background: '#1D1D1F', color: '#FFFFFF', fontSize: 17, fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1,
            boxShadow: '0 6px 18px rgba(0,0,0,0.18)', fontFamily: 'Outfit, sans-serif',
          }}>
          {submitting ? 'Starting…' : 'Begin Cooling'}
        </button>
      </div>
    </div>
  );
};

export default CoolingStartTemp;
