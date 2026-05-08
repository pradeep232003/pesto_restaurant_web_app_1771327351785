import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';

/** /jkhive/delivery-records/supplier/new — create a new supplier. */
const TYPES = ['general', 'fishmonger', 'butcher', 'greengrocer', 'bakery', 'wine merchant', 'alcohol supplier', 'other'];

const AddSupplier = () => {
  const navigate = useNavigate();
  const { adminLocationId, locations } = useLocation2();
  const [name, setName] = useState('');
  const [type, setType] = useState('general');
  const [info, setInfo] = useState('');
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  const save = async () => {
    if (!name.trim()) { alert('Supplier name is required'); return; }
    setSaving(true);
    try {
      const created = await api.deliveriesSupplierAdd({
        location_id: adminLocationId, name: name.trim(), type, info: info.trim(),
      });
      navigate('/jkhive/delivery-records/item', { state: { supplier: created } });
    } catch (err) {
      alert('Could not save: ' + err.message);
    } finally { setSaving(false); }
  };

  return (
    <div style={{ paddingBottom: 120, fontFamily: 'Outfit, sans-serif' }} data-testid="add-supplier-screen">
      <WizardHeader title="Add New Supplier" locationName={locationName} dateStr={today} backTo="/jkhive/delivery-records/supplier" />

      <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0 24px' }}>
        <div style={{
          width: 120, height: 120, borderRadius: 24,
          background: 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Truck size={64} strokeWidth={1.6} color="#1D1D1F" />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F', marginBottom: 6, display: 'block' }}>
            Supplier name
          </label>
          <input data-testid="supplier-name-input"
            value={name} onChange={e => setName(e.target.value)} autoFocus
            placeholder="e.g. Fresh Direct"
            style={{
              width: '100%', padding: '14px 16px', fontSize: 16,
              border: '1px solid rgba(0,0,0,0.1)', borderRadius: 14,
              background: '#FFFFFF', color: '#1D1D1F', outline: 'none',
              fontFamily: 'Outfit, sans-serif',
            }} />
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F', marginBottom: 6, display: 'block' }}>
            Supplier type
          </label>
          <div style={{ position: 'relative' }}>
            <select data-testid="supplier-type-select"
              value={type} onChange={e => setType(e.target.value)}
              style={{
                width: '100%', padding: '14px 40px 14px 16px', fontSize: 16,
                border: '1px solid rgba(0,0,0,0.1)', borderRadius: 14,
                background: '#FFFFFF', color: '#1D1D1F', outline: 'none',
                fontFamily: 'Outfit, sans-serif', appearance: 'none',
              }}>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#86868B' }}>▾</span>
          </div>
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F', marginBottom: 6, display: 'block' }}>
            Additional information <span style={{ color: '#86868B', fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea data-testid="supplier-info-input"
            value={info} onChange={e => setInfo(e.target.value.slice(0, 250))}
            rows={3}
            placeholder="Phone, account number, contact name…"
            style={{
              width: '100%', padding: 14, fontSize: 15,
              border: '1px solid rgba(0,0,0,0.1)', borderRadius: 14,
              background: '#FFFFFF', color: '#1D1D1F', resize: 'vertical', outline: 'none',
              fontFamily: 'Outfit, sans-serif',
            }} />
        </div>
      </div>

      <div style={{ position: 'fixed', left: 16, right: 16, bottom: 96, maxWidth: 600, margin: '0 auto', zIndex: 5 }}>
        <button data-testid="supplier-save-btn" onClick={save} disabled={saving}
          style={{
            width: '100%', padding: '18px 16px', borderRadius: 999, border: 0,
            background: '#1D1D1F', color: '#FFFFFF', fontSize: 17, fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
            boxShadow: '0 6px 18px rgba(0,0,0,0.18)', fontFamily: 'Outfit, sans-serif',
          }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
};

export default AddSupplier;
