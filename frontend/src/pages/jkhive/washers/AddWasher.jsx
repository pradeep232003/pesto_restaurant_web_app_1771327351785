import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';

/** /jkhive/washer-temps/new — create a new washer. */
const AddWasher = () => {
  const navigate = useNavigate();
  const { adminLocationId, locations } = useLocation2();
  const [name, setName] = useState('');
  const [info, setInfo] = useState('');
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  const save = async () => {
    if (!name.trim()) { alert('Washer name is required'); return; }
    setSaving(true);
    try {
      const created = await api.washerAdd({ location_id: adminLocationId, name: name.trim(), info: info.trim() });
      navigate(`/jkhive/washer-temps/${created.id}/wash`, { replace: true, state: { washer: created } });
    } catch (err) { alert('Could not save: ' + err.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ paddingBottom: 130, fontFamily: 'Outfit, sans-serif' }} data-testid="add-washer">
      <WizardHeader title="Add Washer" locationName={locationName} dateStr={today} backTo="/jkhive/washer-temps" />

      <div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0' }}>
        <span style={{ fontSize: 96 }}>🚿</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F', marginBottom: 6, display: 'block' }}>Washer name</label>
          <input data-testid="washer-name-input"
            autoFocus value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Dishwasher 1, Glasswasher"
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
          <textarea data-testid="washer-info-input"
            value={info} onChange={e => setInfo(e.target.value.slice(0, 250))}
            rows={3} placeholder="Make/model, location in kitchen…"
            style={{
              width: '100%', padding: 14, fontSize: 15,
              border: '1px solid rgba(0,0,0,0.1)', borderRadius: 14,
              background: '#FFFFFF', color: '#1D1D1F', resize: 'vertical', outline: 'none',
              fontFamily: 'Outfit, sans-serif',
            }} />
        </div>
      </div>

      <div style={{ position: 'fixed', left: 16, right: 16, bottom: 84, zIndex: 5 }}>
        <button data-testid="washer-save-btn" onClick={save} disabled={saving}
          style={{
            width: '100%', padding: '18px 16px', border: 0, borderRadius: 999,
            background: '#1D1D1F', color: '#FFFFFF', fontSize: 17, fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
            fontFamily: 'Outfit, sans-serif',
            boxShadow: '0 8px 22px rgba(0,0,0,0.25)',
          }}>
          {saving ? 'Saving…' : 'Save & Record'}
        </button>
      </div>
    </div>
  );
};

export default AddWasher;
