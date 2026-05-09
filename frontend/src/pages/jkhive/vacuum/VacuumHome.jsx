import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';

const VacuumHome = () => {
  const navigate = useNavigate();
  const { adminLocationId, locations } = useLocation2();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  const load = () => {
    if (!adminLocationId) { setLoading(false); return; }
    setLoading(true);
    api.vacuumList(adminLocationId).then(d => setRows(d || [])).finally(() => setLoading(false));
  };
  useEffect(load, [adminLocationId]);

  const remove = async (id) => {
    if (!window.confirm('Delete this vacuum-pack record?')) return;
    try { await api.vacuumDelete(id); load(); } catch (e) { alert(e.message); }
  };

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="vacuum-home">
      <WizardHeader title="Vacuum Packing" locationName={locationName} dateStr={today} backTo="/jkhive/routines/more" />

      <p style={{ fontSize: 13, color: '#86868B', marginBottom: 14 }}>
        Recommended: pack core temp ≤ 5 °C with a use-by date assigned.
      </p>

      {loading && <p style={{ color: '#86868B', textAlign: 'center', padding: 18 }}>Loading…</p>}
      {!loading && rows.length === 0 && (
        <p style={{ color: '#86868B', textAlign: 'center', padding: 24 }}>No vacuum batches recorded yet. Tap + to add one.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map(r => (
          <div key={r.id} data-testid={`vacuum-row-${r.id}`}
            style={{ background: '#FFFFFF', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <span style={{ fontSize: 28 }}>📦</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1D1D1F' }}>{r.item_name}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#86868B' }}>
                {Number(r.pack_temp).toFixed(1)} °C · UB {r.use_by_date} · {new Date(r.recorded_at).toLocaleString()}
              </p>
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
              background: r.passed ? 'rgba(52,199,89,0.15)' : 'rgba(255,59,48,0.15)',
              color: r.passed ? '#1B7A35' : '#B30015',
            }}>{r.passed ? 'OK' : 'CHECK'}</span>
            <button onClick={() => remove(r.id)} aria-label="Delete"
              style={{ background: 'transparent', border: 0, padding: 6, cursor: 'pointer' }}>
              <Trash2 size={18} color="#FF3B30" />
            </button>
          </div>
        ))}
      </div>

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 64, zIndex: 5 }}>
        <button data-testid="vacuum-add-btn"
          onClick={() => navigate('/jkhive/vacuum-packing/pick')}
          style={{
            width: '100%', padding: '20px 16px', border: 0,
            background: '#1D1D1F', color: '#FFFFFF', fontSize: 18, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontFamily: 'Outfit, sans-serif',
          }}>
          <Plus size={20} strokeWidth={2.6} /> Add Vacuum Pack
        </button>
      </div>
    </div>
  );
};

export default VacuumHome;
