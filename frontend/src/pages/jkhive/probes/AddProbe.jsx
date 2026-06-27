import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';

/** /jkhive/probe-calibration/new — create a new probe. */
const AddProbe = () => {
  const navigate = useNavigate();
  const { adminLocationId, locations } = useLocation2();
  const [name, setName] = useState('');
  const [info, setInfo] = useState('');
  const [saving, setSaving] = useState(false);
  const [existingNames, setExistingNames] = useState([]); // lowercased names already at this site
  const [error, setError] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  // Pre-load existing probes so we can flag duplicates *before* hitting the API.
  React.useEffect(() => {
    if (!adminLocationId) return;
    api.probesList(adminLocationId)
      .then(list => setExistingNames((list || []).map(p => (p.name || '').trim().toLowerCase())))
      .catch(() => {});
  }, [adminLocationId]);

  const trimmed = name.trim();
  const duplicate = trimmed && existingNames.includes(trimmed.toLowerCase());

  const save = async () => {
    if (!trimmed) { setError('Probe name is required'); return; }
    if (duplicate) { setError(`A probe named "${trimmed}" already exists at ${locationName || 'this location'}`); return; }
    setSaving(true);
    setError('');
    try {
      const created = await api.probeAdd({ location_id: adminLocationId, name: trimmed, info: info.trim() });
      navigate(`/jkhive/probe-calibration/${created.id}/boiling`, { replace: true, state: { probe: created } });
    } catch (err) {
      // The backend returns 409 with a friendly message — surface it inline
      // rather than as an alert so the input keeps focus.
      setError(err.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ paddingBottom: 130, fontFamily: 'Outfit, sans-serif' }} data-testid="add-probe">
      <WizardHeader title="Add Probe" locationName={locationName} dateStr={today} backTo="/jkhive/probe-calibration" />

      <div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0' }}>
        <span style={{ fontSize: 96 }}>📟</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F', marginBottom: 6, display: 'block' }}>Probe name</label>
          <input data-testid="probe-name-input"
            autoFocus value={name}
            onChange={e => { setName(e.target.value); if (error) setError(''); }}
            placeholder="e.g. probe1, kitchen probe"
            style={{
              width: '100%', padding: '14px 16px', fontSize: 16,
              border: `1px solid ${duplicate ? '#FF3B30' : 'rgba(0,0,0,0.1)'}`, borderRadius: 14,
              background: '#FFFFFF', color: '#1D1D1F', outline: 'none',
              fontFamily: 'Outfit, sans-serif',
            }} />
          {(duplicate || error) && (
            <p data-testid="probe-name-error" style={{ margin: '6px 2px 0', fontSize: 12, color: '#C0392B' }}>
              {error || `A probe named "${trimmed}" already exists at ${locationName || 'this location'}`}
            </p>
          )}
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F', marginBottom: 6, display: 'block' }}>
            Notes <span style={{ color: '#86868B', fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea data-testid="probe-info-input"
            value={info} onChange={e => setInfo(e.target.value.slice(0, 250))}
            rows={3} placeholder="Model, serial, location…"
            style={{
              width: '100%', padding: 14, fontSize: 15,
              border: '1px solid rgba(0,0,0,0.1)', borderRadius: 14,
              background: '#FFFFFF', color: '#1D1D1F', resize: 'vertical', outline: 'none',
              fontFamily: 'Outfit, sans-serif',
            }} />
        </div>
      </div>

      <div style={{ position: 'fixed', left: 16, right: 16, bottom: 84, zIndex: 5 }}>
        <button data-testid="probe-save-btn" onClick={save} disabled={saving || duplicate || !trimmed}
          style={{
            width: '100%', padding: '18px 16px', border: 0, borderRadius: 999,
            background: '#1D1D1F', color: '#FFFFFF', fontSize: 17, fontWeight: 600,
            cursor: (saving || duplicate || !trimmed) ? 'not-allowed' : 'pointer',
            opacity: (saving || duplicate || !trimmed) ? 0.5 : 1,
            fontFamily: 'Outfit, sans-serif',
            boxShadow: '0 8px 22px rgba(0,0,0,0.25)',
          }}>
          {saving ? 'Saving…' : 'Save & Calibrate'}
        </button>
      </div>
    </div>
  );
};

export default AddProbe;
