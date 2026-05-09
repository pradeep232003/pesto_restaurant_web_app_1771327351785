import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, Navigate } from 'react-router-dom';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader, TempStepper, TempGauge } from '../cooling/_shared';
import { categoryEmoji } from '../cooling/CoolingHome';

/**
 * /jkhive/hot-cold-holding/:id/check — interim 2hr / 4hr / 6hr check.
 * Auto-suggests the next pending label. Same gauge config as RecordHolding.
 */
const NextCheckLabel = (recorded = []) => {
  for (const l of ['2hr', '4hr', '6hr']) if (!recorded.includes(l)) return l;
  return '6hr';
};

const HoldingCheck = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { state } = useLocation();
  const { adminLocationId, locations } = useLocation2();
  const [session, setSession] = useState(state?.session || null);
  const [label, setLabel] = useState('2hr');
  const [temp, setTemp] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  useEffect(() => {
    if (session) {
      const isHot = session.mode === 'hot';
      setTemp(isHot ? 75 : 5);
      setLabel(NextCheckLabel((session.checks || []).map(c => c.label)));
      return;
    }
    if (!adminLocationId) return;
    api.hotColdList(adminLocationId, 'active').then(rows => {
      const s = (rows || []).find(r => r.id === id);
      if (!s) { alert('Session not found'); navigate('/jkhive/hot-cold-holding'); return; }
      setSession(s);
      const isHot = s.mode === 'hot';
      setTemp(isHot ? 75 : 5);
      setLabel(NextCheckLabel((s.checks || []).map(c => c.label)));
    });
  }, [adminLocationId, id, session, navigate]);

  if (!session) return null;
  if (session.status !== 'active') return <Navigate to="/jkhive/hot-cold-holding" replace />;

  const isHot = session.mode === 'hot';
  const inRange = isHot ? temp >= 63 : temp <= 8;
  const knobColor = inRange ? '#34C759' : '#FF3B30';
  const min = isHot ? 55 : 0;
  const max = isHot ? 100 : 25;
  const ticks = isHot ? [55, 64, 73, 82, 91, 100] : [0, 5, 10, 15, 20, 25];

  const submit = async () => {
    setSubmitting(true);
    try {
      await api.hotColdCheck(id, { label, temp: Number(temp) });
      navigate('/jkhive/hot-cold-holding', { replace: true });
    } catch (err) { alert('Failed: ' + err.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="hot-cold-check">
      <WizardHeader title={`${label} Check`} locationName={locationName} dateStr={today} onBack={() => navigate(-1)} />

      <div style={{ textAlign: 'center', margin: '4px 0 6px' }}>
        <div style={{ fontSize: 96, lineHeight: 1 }}>{session.item_icon || categoryEmoji(session.item_category)}</div>
        <p style={{ fontSize: 22, fontWeight: 800, color: '#1D1D1F', margin: '6px 0 0' }}>{session.item_name}</p>
        <p style={{ fontSize: 12, color: '#86868B', margin: '4px 0 0', textTransform: 'capitalize' }}>{session.mode} Holding</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, margin: '12px 0 4px' }}>
        {['2hr', '4hr', '6hr'].map(l => {
          const recorded = (session.checks || []).some(c => c.label === l);
          const sel = label === l;
          return (
            <button key={l} disabled={recorded}
              onClick={() => setLabel(l)}
              style={{
                padding: '8px 18px', borderRadius: 999,
                border: sel ? '0' : '1px solid rgba(0,0,0,0.18)',
                background: sel ? '#1D1D1F' : '#FFFFFF',
                color: sel ? '#FFFFFF' : recorded ? '#86868B' : '#1D1D1F',
                fontSize: 14, fontWeight: 600,
                cursor: recorded ? 'not-allowed' : 'pointer',
                fontFamily: 'Outfit, sans-serif', opacity: recorded ? 0.5 : 1,
              }}>{l}{recorded ? ' ✓' : ''}</button>
          );
        })}
      </div>

      <TempStepper value={temp} onChange={setTemp} />
      <TempGauge value={temp} min={min} max={max} ticks={ticks} onChange={setTemp} color={knobColor} />

      <p style={{ fontSize: 14, color: '#1D1D1F', textAlign: 'center', marginTop: 18, lineHeight: 1.4 }}>
        Recommended range:<br/>{isHot ? '63°C or higher' : '8°C or lower'}
      </p>

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 64, zIndex: 5 }}>
        <button data-testid="hot-cold-check-submit" onClick={submit} disabled={submitting}
          style={{
            width: '100%', padding: '20px 16px', border: 0,
            background: '#1D1D1F', color: '#FFFFFF', fontSize: 18, fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1,
            fontFamily: 'Outfit, sans-serif',
          }}>
          {submitting ? 'Submitting…' : `Submit ${label} Check`}
        </button>
      </div>
    </div>
  );
};

export default HoldingCheck;
