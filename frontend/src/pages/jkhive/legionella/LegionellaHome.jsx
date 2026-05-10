import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Droplet } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';

/** /jkhive/legionella — recent weekly water tests + Add Record pill. */
const LegionellaHome = () => {
  const navigate = useNavigate();
  const { adminLocationId, locations } = useLocation2();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  const load = () => {
    if (!adminLocationId) { setLoading(false); return; }
    setLoading(true);
    api.legionellaList(adminLocationId)
      .then(d => setRows((d || []).slice(0, 30)))
      .finally(() => setLoading(false));
  };
  useEffect(load, [adminLocationId]);

  const remove = async (id) => {
    if (!window.confirm('Delete this Legionella test record?')) return;
    try { await api.legionellaDelete(id); load(); } catch (e) { alert(e.message); }
  };

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="legionella-home">
      <WizardHeader title="Legionella" locationName={locationName} dateStr={today} backTo="/jkhive/routines/more" />

      <p style={{ fontSize: 13, color: '#86868B', marginBottom: 14 }}>
        Weekly water test. Pass: hot ≥ 50 °C, cold ≤ 20 °C.
      </p>

      {loading && <p style={{ color: '#86868B', textAlign: 'center', padding: 18 }}>Loading…</p>}
      {!loading && rows.length === 0 && (
        <p style={{ color: '#86868B', textAlign: 'center', padding: 24 }}>No Legionella tests yet. Tap “Add record” to log this week.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map(r => (
          <div key={r.id} data-testid={`legionella-row-${r.id}`}
            style={{ background: '#FFFFFF', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(48,176,199,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Droplet size={22} color="#30B0C7" strokeWidth={2.4} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1D1D1F' }}>{r.location_of_test}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#86868B' }}>
                {r.date} · hot {r.hot_water_temp != null ? `${Number(r.hot_water_temp).toFixed(1)}°C` : '—'} · cold {r.cold_water_temp != null ? `${Number(r.cold_water_temp).toFixed(1)}°C` : '—'}
              </p>
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
              background: r.passed ? 'rgba(52,199,89,0.15)' : 'rgba(255,59,48,0.15)',
              color: r.passed ? '#1B7A35' : '#B30015',
            }}>{r.passed ? 'PASS' : 'FAIL'}</span>
            <button onClick={() => remove(r.id)} aria-label="Delete"
              style={{ background: 'transparent', border: 0, padding: 6, cursor: 'pointer' }}>
              <Trash2 size={18} color="#FF3B30" />
            </button>
          </div>
        ))}
      </div>

      <div style={{ position: 'fixed', right: 16, bottom: 80, zIndex: 5 }}>
        <button data-testid="legionella-add-btn"
          onClick={() => navigate('/jkhive/legionella/outlet')}
          style={{
            padding: '14px 22px', borderRadius: 999, border: 0,
            background: '#1D1D1F', color: '#FFFFFF', fontSize: 16, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            fontFamily: 'Outfit, sans-serif',
            boxShadow: '0 8px 22px rgba(0,0,0,0.25)',
          }}>
          <Plus size={18} strokeWidth={2.6} /> Add record
        </button>
      </div>
    </div>
  );
};

export default LegionellaHome;
