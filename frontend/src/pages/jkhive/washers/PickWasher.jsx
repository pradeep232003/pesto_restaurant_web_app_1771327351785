import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';

/** /jkhive/washer-temps — washer picker grid (mirrors Probe Calibration). */
const PickWasher = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const backTo = searchParams.get('back') || '/jkhive/routines/more';
  const { adminLocationId, locations } = useLocation2();
  const [washers, setWashers] = useState([]);
  const [todayChecks, setTodayChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  useEffect(() => {
    if (!adminLocationId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      api.washersList(adminLocationId).catch(() => []),
      api.washerChecks(adminLocationId).catch(() => []),
    ])
      .then(([w, c]) => {
        setWashers(w || []);
        setTodayChecks((c || []).filter(x => (x.recorded_at || '').slice(0, 10) === today));
      })
      .catch(err => alert('Failed to load washers: ' + err.message))
      .finally(() => setLoading(false));
  }, [adminLocationId, today]);

  const latestForWasher = (washerId) => {
    // washerChecks comes back sorted by recorded_at desc
    return todayChecks.find(c => c.washer_id === washerId) || null;
  };

  if (!adminLocationId) {
    return (
      <div style={{ padding: 24, fontFamily: 'Outfit, sans-serif' }}>
      <WizardHeader title="Select Washer" locationName="—" dateStr={today} backTo={backTo} />
        <p style={{ color: '#FF9500' }}>Pick a location from JKHive home first.</p>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="washer-pick">
      <WizardHeader title="Select Washer" locationName={locationName} dateStr={today} backTo={backTo} />

      {loading && <p style={{ color: '#86868B', textAlign: 'center', padding: 18 }}>Loading…</p>}

      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {washers.map(w => {
            const c = latestForWasher(w.id);
            return (
            <div key={w.id} style={{ position: 'relative' }}>
              <button data-testid={`washer-${w.id}`}
                onClick={() => navigate(`/jkhive/washer-temps/${w.id}/wash`, { state: { washer: w } })}
                style={{
                  width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  padding: '4px 4px 8px', background: 'transparent', border: 0, cursor: 'pointer',
                }}>
                <span style={{ fontSize: 56, lineHeight: 1 }}>🚿</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#1D1D1F', textAlign: 'center' }}>{w.name}</span>
                {c ? (
                  <span data-testid={`washer-today-${w.id}`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 11, fontWeight: 600, color: c.passed ? '#1B7A35' : '#A35E00',
                      background: c.passed ? 'rgba(52,199,89,0.15)' : 'rgba(255,149,0,0.15)',
                      padding: '2px 8px', borderRadius: 999, fontVariantNumeric: 'tabular-nums',
                    }}>
                    {[
                      c.wash_temp != null ? `W ${Number(c.wash_temp).toFixed(0)}°` : null,
                      c.rinse_temp != null ? `R ${Number(c.rinse_temp).toFixed(0)}°` : null,
                    ].filter(Boolean).join(' · ')}
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: '#C7C7CC' }}>Not recorded</span>
                )}
              </button>
              <button data-testid={`washer-edit-${w.id}`}
                onClick={() => navigate(`/jkhive/washer-temps/${w.id}/edit`, { state: { washer: w } })}
                aria-label={`Edit ${w.name}`}
                style={{
                  position: 'absolute', top: 0, right: 14, width: 24, height: 24, borderRadius: 999,
                  background: '#1D1D1F', color: '#FFFFFF', border: 0, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, fontStyle: 'italic',
                }}>i</button>
            </div>
            );
          })}

          <button data-testid="washer-add"
            onClick={() => navigate('/jkhive/washer-temps/new')}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              padding: '4px 4px 8px', background: 'transparent', border: 0, cursor: 'pointer',
            }}>
            <span style={{
              fontSize: 56, lineHeight: 1, color: '#1D1D1F',
              width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>+</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#1D1D1F' }}>Add Washer</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default PickWasher;
