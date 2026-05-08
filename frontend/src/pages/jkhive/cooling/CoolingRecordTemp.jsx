import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader, TempStepper, TempGauge } from './_shared';
import { categoryEmoji } from './CoolingHome';

/**
 * /jkhive/cooking-cooling/:id/record — record the cooled temperature (IMG_6674).
 * Reads the existing log to know item + target. Defaults to 5°C (in-range).
 */
const CoolingRecordTemp = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { adminLocationId, locations } = useLocation2();
  const [log, setLog] = useState(null);
  const [temp, setTemp] = useState(5);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  useEffect(() => {
    api.coolingGet(id).then(d => {
      setLog(d);
      // If a temp was already submitted, pre-fill it so the user can review
      // / edit. Otherwise default to 5°C.
      setTemp(d?.end_temp_c != null ? d.end_temp_c : 5);
    })
      .catch(err => alert('Failed to load: ' + err.message));
  }, [id]);

  if (!log) return <p style={{ padding: 24, color: '#86868B', textAlign: 'center' }}>Loading…</p>;

  const inRange = temp <= (log.target_temp_c ?? 8);

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="cooling-record">
      <WizardHeader title="Record Cooled Temperature" locationName={locationName} dateStr={today} backTo="/jkhive/cooking-cooling" />

      <div style={{ textAlign: 'center', margin: '6px 0 14px' }}>
        <div style={{ fontSize: 96, lineHeight: 1 }}>{categoryEmoji(log.item_category)}</div>
        <p style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em', color: '#1D1D1F', margin: '8px 0 0' }}>{log.item_name}</p>
      </div>

      <TempStepper value={temp} onChange={setTemp} />

      <TempGauge
        value={temp}
        min={0} max={30}
        ticks={[0, 6, 12, 18, 24, 30]}
        onChange={setTemp}
        color="#007AFF"
      />

      <p style={{ fontSize: 13, color: '#86868B', textAlign: 'center', marginTop: 26 }}>
        Recommended range:<br/>
        <b style={{ color: inRange ? '#34C759' : '#FF3B30' }}>
          Cooled to {log.target_temp_c ?? 8}°C or lower within 90 mins
        </b>
      </p>

      <div style={{ position: 'fixed', left: 16, right: 16, bottom: 96, maxWidth: 600, margin: '0 auto', zIndex: 5 }}>
        <button data-testid="next-comment-btn"
          onClick={() => navigate(`/jkhive/cooking-cooling/${id}/comment`, { state: { temp } })}
          style={{
            width: '100%', padding: '18px 16px', borderRadius: 999, border: 0,
            background: '#1D1D1F', color: '#FFFFFF', fontSize: 17, fontWeight: 600,
            cursor: 'pointer', boxShadow: '0 6px 18px rgba(0,0,0,0.18)', fontFamily: 'Outfit, sans-serif',
          }}>Next</button>
      </div>
    </div>
  );
};

export default CoolingRecordTemp;
