import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';

const EditProbe = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { state } = useLocation();
  const { adminLocationId, locations } = useLocation2();
  const [name, setName] = useState(state?.probe?.name || '');
  const [info, setInfo] = useState(state?.probe?.info || '');
  const [loading, setLoading] = useState(!state?.probe);
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  useEffect(() => {
    if (state?.probe || !adminLocationId) return;
    api.probesList(adminLocationId).then(rows => {
      const p = (rows || []).find(r => r.id === id);
      if (!p) { alert('Probe not found'); navigate(-1); return; }
      setName(p.name); setInfo(p.info || '');
    }).finally(() => setLoading(false));
  }, [adminLocationId, id, state, navigate]);

  const save = async () => {
    if (!name.trim()) { alert('Probe name is required'); return; }
    setSaving(true);
    try {
      await api.probeUpdate(id, { name: name.trim(), info: info.trim() });
      navigate('/jkhive/probe-calibration');
    } catch (err) { alert('Could not save: ' + err.message); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!window.confirm(`Delete probe "${name}"?\n\nExisting calibration history will keep the name on file.`)) return;
    try { await api.probeDelete(id); navigate('/jkhive/probe-calibration'); }
    catch (err) { alert('Could not delete: ' + err.message); }
  };

  if (loading) {
    return (
      <div style={{ padding: 24, fontFamily: 'Outfit, sans-serif' }}>
        <WizardHeader title="Edit Probe" locationName={locationName} dateStr={today} backTo="/jkhive/probe-calibration" />
        <p style={{ color: '#86868B', textAlign: 'center', marginTop: 40 }}>Loading…</p>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 160, fontFamily: 'Outfit, sans-serif' }} data-testid="edit-probe">
      <WizardHeader title="Edit Probe" locationName={locationName} dateStr={today} backTo="/jkhive/probe-calibration" />

      <div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0' }}>
        <span style={{ fontSize: 96 }}>📟</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F', marginBottom: 6, display: 'block' }}>Probe name</label>
          <input data-testid="edit-probe-name-input"
            value={name} onChange={e => setName(e.target.value)}
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
          <textarea data-testid="edit-probe-info-input"
            value={info} onChange={e => setInfo(e.target.value.slice(0, 250))}
            rows={3}
            style={{
              width: '100%', padding: 14, fontSize: 15,
              border: '1px solid rgba(0,0,0,0.1)', borderRadius: 14,
              background: '#FFFFFF', color: '#1D1D1F', resize: 'vertical', outline: 'none',
              fontFamily: 'Outfit, sans-serif',
            }} />
        </div>
        <button data-testid="edit-probe-delete-btn"
          onClick={remove}
          style={{
            marginTop: 8, padding: '14px 16px', borderRadius: 14,
            border: '1px solid rgba(255,59,48,0.4)', background: 'transparent',
            color: '#FF3B30', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'Outfit, sans-serif',
          }}>Delete probe</button>
      </div>

      <div style={{ position: 'fixed', left: 16, right: 16, bottom: 84, zIndex: 5 }}>
        <button data-testid="edit-probe-save-btn" onClick={save} disabled={saving}
          style={{
            width: '100%', padding: '18px 16px', border: 0, borderRadius: 999,
            background: '#1D1D1F', color: '#FFFFFF', fontSize: 17, fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
            fontFamily: 'Outfit, sans-serif',
            boxShadow: '0 8px 22px rgba(0,0,0,0.25)',
          }}>{saving ? 'Saving…' : 'Save changes'}</button>
      </div>
    </div>
  );
};

export default EditProbe;
