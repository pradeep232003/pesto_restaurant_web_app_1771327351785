import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';

/** /jkhive/probe-calibration — probe picker grid (IMG_6709). */
const PickProbe = () => {
  const navigate = useNavigate();
  const { adminLocationId, locations } = useLocation2();
  const [probes, setProbes] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  useEffect(() => {
    if (!adminLocationId) { setLoading(false); return; }
    setLoading(true);
    api.probesList(adminLocationId)
      .then(d => setProbes(d || []))
      .catch(err => alert('Failed to load probes: ' + err.message))
      .finally(() => setLoading(false));
  }, [adminLocationId]);

  if (!adminLocationId) {
    return (
      <div style={{ padding: 24, fontFamily: 'Outfit, sans-serif' }}>
        <WizardHeader title="Select a Probe" locationName="—" dateStr={today} backTo="/jkhive/routines/more" />
        <p style={{ color: '#FF9500' }}>Pick a location from JKHive home first.</p>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="probe-pick">
      <WizardHeader title="Select a Probe" locationName={locationName} dateStr={today} backTo="/jkhive/routines/more" />

      {loading && <p style={{ color: '#86868B', textAlign: 'center', padding: 18 }}>Loading…</p>}

      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {probes.map(p => (
            <div key={p.id} style={{ position: 'relative' }}>
              <button data-testid={`probe-${p.id}`}
                onClick={() => navigate(`/jkhive/probe-calibration/${p.id}/boiling`, { state: { probe: p } })}
                style={{
                  width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  padding: '4px 4px 8px', background: 'transparent', border: 0, cursor: 'pointer',
                }}>
                <span style={{ fontSize: 56, lineHeight: 1 }}>📟</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#1D1D1F', textAlign: 'center' }}>{p.name}</span>
              </button>
              <button data-testid={`probe-edit-${p.id}`}
                onClick={() => navigate(`/jkhive/probe-calibration/${p.id}/edit`, { state: { probe: p } })}
                aria-label={`Edit ${p.name}`}
                style={{
                  position: 'absolute', top: 0, right: 14, width: 24, height: 24, borderRadius: 999,
                  background: '#1D1D1F', color: '#FFFFFF', border: 0, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, fontStyle: 'italic',
                }}>i</button>
            </div>
          ))}

          <button data-testid="probe-add"
            onClick={() => navigate('/jkhive/probe-calibration/new')}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              padding: '4px 4px 8px', background: 'transparent', border: 0, cursor: 'pointer',
            }}>
            <span style={{
              fontSize: 56, lineHeight: 1, color: '#1D1D1F',
              width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>+</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#1D1D1F' }}>Add Probe</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default PickProbe;
