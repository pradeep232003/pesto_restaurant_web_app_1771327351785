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
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  const save = async () => {
    if (!name.trim()) { alert('Probe name is required'); return; }
    setSaving(true);
    try {
      const created = await api.probeAdd({ location_id: adminLocationId, name: name.trim(), info: info.trim() });
      navigate(`/jkhive/probe-calibration/${created.id}/boiling`, { replace: true, state: { probe: created } });
    } catch (err) { alert('Could not save: ' + err.message); }
    finally { setSaving(false); }
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
            autoFocus value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. probe1, kitchen probe"
            style={{
              width: '100%', padding: '14px 16px', fontSize: 16,
              border: '1px solid rgba(0,0,0,0.1)', borderRadius: 14,
              background: '#FFFFFF', color: '#1D1D1F', outline: 'none',
              fontFamily: 'Outfit, sans-serif',
            }} />
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

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 64, zIndex: 5 }}>
        <button data-testid="probe-save-btn" onClick={save} disabled={saving}
          style={{
            width: '100%', padding: '20px 16px', border: 0,
            background: '#1D1D1F', color: '#FFFFFF', fontSize: 18, fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
            fontFamily: 'Outfit, sans-serif',
          }}>
          {saving ? 'Saving…' : 'Save & Calibrate'}
        </button>
      </div>
    </div>
  );
};

export default AddProbe;
