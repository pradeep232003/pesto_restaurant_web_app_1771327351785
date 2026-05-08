import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';

/** /jkhive/delivery-records/supplier — pick supplier or add new. */
const TYPE_EMOJI = {
  general: '📦', fishmonger: '🐟', butcher: '🥩', greengrocer: '🥬',
  bakery: '🥖', 'wine merchant': '🍷', 'alcohol supplier': '🍾', other: '🚚',
};

const PickSupplier = () => {
  const navigate = useNavigate();
  const { adminLocationId, locations } = useLocation2();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  const load = () => {
    if (!adminLocationId) { setLoading(false); return; }
    setLoading(true);
    api.deliveriesSuppliersList(adminLocationId)
      .then(d => setSuppliers(d || []))
      .catch(err => alert('Failed to load suppliers: ' + err.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, [adminLocationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (s, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete supplier "${s.name}"?\n\nExisting delivery records will keep the name on file.`)) return;
    try {
      await api.deliveriesSupplierDelete(s.id);
      setSuppliers(prev => prev.filter(x => x.id !== s.id));
    } catch (err) { alert('Failed to delete: ' + err.message); }
  };

  const choose = (s) => {
    navigate('/jkhive/delivery-records/item', { state: { supplier: s } });
  };

  if (!adminLocationId) {
    return (
      <div style={{ padding: 24, fontFamily: 'Outfit, sans-serif' }}>
        <WizardHeader title="Select Supplier" locationName="—" dateStr={today} backTo="/jkhive/delivery-records" />
        <p style={{ color: '#FF9500' }}>Pick a location from JKHive home first.</p>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="pick-supplier">
      <WizardHeader title="Select Supplier" locationName={locationName} dateStr={today} backTo="/jkhive/delivery-records" />

      {loading && <p style={{ color: '#86868B', padding: 18, textAlign: 'center' }}>Loading…</p>}

      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {suppliers.map(s => (
            <button key={s.id} data-testid={`supplier-${s.id}`}
              onClick={() => choose(s)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '14px 6px', background: '#FFFFFF', border: 0, cursor: 'pointer',
                borderRadius: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', position: 'relative',
              }}>
              <span style={{ fontSize: 36, lineHeight: 1 }}>{TYPE_EMOJI[s.type] || '📦'}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#1D1D1F', textAlign: 'center', lineHeight: 1.2 }}>{s.name}</span>
              <span data-testid={`supplier-delete-${s.id}`}
                onClick={(e) => handleDelete(s, e)}
                style={{
                  position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 999,
                  background: 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#FF3B30',
                }}>
                <Trash2 size={11} strokeWidth={2.4} />
              </span>
            </button>
          ))}

          <button data-testid="add-supplier"
            onClick={() => navigate('/jkhive/delivery-records/supplier/new')}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              padding: '14px 6px', background: '#FFFFFF', border: '1.5px dashed rgba(0,0,0,0.18)', cursor: 'pointer',
              borderRadius: 16,
            }}>
            <span style={{
              fontSize: 32, fontWeight: 700, lineHeight: 1, width: 44, height: 44,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1D1D1F',
            }}>＋</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1D1D1F' }}>Add Supplier</span>
          </button>
        </div>
      )}

      {!loading && suppliers.length === 0 && (
        <p style={{ marginTop: 18, fontSize: 13, color: '#86868B', textAlign: 'center' }}>
          No suppliers yet. Tap <b>Add Supplier</b> to create one.
        </p>
      )}
    </div>
  );
};

export default PickSupplier;
