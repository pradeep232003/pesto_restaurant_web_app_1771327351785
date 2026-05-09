import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';

/** /jkhive/in-service-wastage — IMG_6702 style home, in £ instead of kg. */
const formatTime = (iso) => (iso || '').slice(11, 16);
const fmtMoney = (v) => `£${Number(v || 0).toFixed(2)}`;

const InServiceHome = () => {
  const navigate = useNavigate();
  const { adminLocationId, locations } = useLocation2();
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({ gbp_today: 0, count_today: 0, count_7d: 0 });
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  const load = async () => {
    if (!adminLocationId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [list, sum] = await Promise.all([
        api.wastageList(adminLocationId, 'in_service'),
        api.wastageSummary(adminLocationId, 'in_service'),
      ]);
      setRows(list || []);
      setStats(sum || {});
    } catch (err) {
      alert('Failed to load: ' + err.message);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [adminLocationId]); // eslint-disable-line

  const remove = async (r) => {
    if (!window.confirm(`Delete wastage record for ${r.item_name}?`)) return;
    try { await api.wastageDelete(r.id); load(); }
    catch (err) { alert('Failed to delete: ' + err.message); }
  };

  return (
    <div style={{ paddingBottom: 130, fontFamily: 'Outfit, sans-serif' }} data-testid="in-service-home">
      <WizardHeader title="In-Service Wastage" locationName={locationName} dateStr={today} backTo="/jkhive" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 4 }}>
        <StatCard label="Lost today (£)" value={fmtMoney(stats.gbp_today)} />
        <StatCard label="Records taken today" value={stats.count_today || 0} />
      </div>

      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1D1D1F', textAlign: 'center', margin: '28px 0 16px' }}>
        Recently Wasted
      </h2>

      {!adminLocationId && <p style={{ color: '#FF9500', textAlign: 'center' }}>Pick a location from JKHive home first.</p>}
      {adminLocationId && loading && <p style={{ color: '#86868B', textAlign: 'center' }}>Loading…</p>}

      {adminLocationId && !loading && rows.length === 0 && (
        <div style={{ textAlign: 'center', padding: '20px 16px' }}>
          <div style={{ fontSize: 96, lineHeight: 1, marginBottom: 12 }}>🍽️</div>
          <p style={{ fontSize: 16, color: '#1D1D1F', margin: 0 }}>
            No service wastage recorded<br/>in the last seven days.
          </p>
        </div>
      )}

      {adminLocationId && !loading && rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map(r => (
            <div key={r.id} data-testid={`service-wastage-row-${r.id}`}
              style={{
                display: 'flex', alignItems: 'stretch', background: '#FFFFFF', borderRadius: 14,
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)', overflow: 'hidden',
              }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', minWidth: 0 }}>
                <span style={{ fontSize: 28 }}>{r.item_icon || '🍽️'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#1D1D1F', margin: 0 }}>{r.item_name}</p>
                  <p style={{ fontSize: 11, color: '#86868B', margin: '2px 0 0' }}>
                    {r.amount > 1 ? `${r.amount}× · ` : ''}
                    {r.price != null ? fmtMoney(r.price) + (r.amount > 1 ? '' : ' · ') : ''}
                    {r.item_category}{formatTime(r.recorded_at) ? ` · ${formatTime(r.recorded_at)}` : ''}
                  </p>
                </div>
              </div>
              <button onClick={() => remove(r)} aria-label={`Delete ${r.item_name}`}
                style={{
                  width: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'transparent', border: 0, borderLeft: '1px solid rgba(0,0,0,0.06)',
                  cursor: 'pointer', color: '#FF3B30',
                }}>
                <Trash2 size={16} strokeWidth={2.2} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button data-testid="record-service-wastage-btn"
        onClick={() => navigate('/jkhive/in-service-wastage/pick')}
        disabled={!adminLocationId}
        style={{
          position: 'fixed', right: 16, bottom: 96, zIndex: 5,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          padding: '14px 24px', borderRadius: 999, border: 0,
          background: '#1D1D1F', color: '#FFFFFF', fontSize: 16, fontWeight: 600,
          cursor: adminLocationId ? 'pointer' : 'not-allowed', opacity: adminLocationId ? 1 : 0.5,
          fontFamily: 'Outfit, sans-serif',
          boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
        }}>
        + Record Wastage
      </button>
    </div>
  );
};

const StatCard = ({ label, value }) => (
  <div style={{ background: '#FFFFFF', borderRadius: 18, padding: '16px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', minHeight: 120 }}>
    <p style={{ fontSize: 14, fontWeight: 500, color: '#1D1D1F', margin: 0, lineHeight: 1.2 }}>{label}</p>
    <p style={{ fontSize: 32, fontWeight: 700, color: '#1D1D1F', margin: '14px 0 0', letterSpacing: '-0.02em' }}>{value}</p>
  </div>
);

export default InServiceHome;
