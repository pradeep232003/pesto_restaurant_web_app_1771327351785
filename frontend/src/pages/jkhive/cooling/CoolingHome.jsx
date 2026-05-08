import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Snowflake, ArrowLeft } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from './_shared';
import { reconcile, ageStatus, STATUS_COLOR, STATUS_LABEL } from './cooling_alarms';

/**
 * /jkhive/cooking-cooling — list currently cooling items + Add new.
 */
const CoolingHome = () => {
  const navigate = useNavigate();
  const { adminLocationId, locations } = useLocation2();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line no-unused-vars
  const [tick, setTick] = useState(0);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  useEffect(() => {
    if (!adminLocationId) { setLoading(false); return; }
    setLoading(true);
    api.coolingList(adminLocationId, 'cooling')
      .then(d => { setItems(d || []); reconcile(d || []); })
      .catch(err => alert('Failed to load: ' + err.message))
      .finally(() => setLoading(false));
    // Re-render every 30s so age pills + elapsed time update live.
    const t = setInterval(() => setTick(x => x + 1), 30000);
    return () => clearInterval(t);
  }, [adminLocationId]);

  const elapsed = (iso) => {
    const ms = Date.now() - new Date(iso).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    return `${h} h ${m % 60} m ago`;
  };

  return (
    <div style={{ paddingBottom: 100, fontFamily: 'Outfit, sans-serif' }} data-testid="cooling-home">
      <WizardHeader title="Cooking & Cooling" locationName={locationName} dateStr={today} backTo="/jkhive/routines" />

      {!adminLocationId && (
        <p style={{ color: '#FF9500', padding: 18 }}>Please pick a location from JKHive home first.</p>
      )}

      {adminLocationId && loading && (
        <p style={{ color: '#86868B', padding: 18, textAlign: 'center' }}>Loading…</p>
      )}

      {adminLocationId && !loading && items.length === 0 && (
        <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '36px 22px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ width: 64, height: 64, borderRadius: 999, background: '#E0F4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <Snowflake size={32} color="#30B0C7" strokeWidth={2} />
          </div>
          <p style={{ fontSize: 17, fontWeight: 700, color: '#1D1D1F', margin: '0 0 4px' }}>Nothing cooling right now</p>
          <p style={{ fontSize: 13, color: '#86868B', margin: 0 }}>Tap the button below to start a new cooling record.</p>
        </div>
      )}

      {adminLocationId && !loading && items.length > 0 && (
        <>
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#86868B', margin: '6px 4px 8px' }}>
            Currently cooling
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map(it => {
              const status = ageStatus(it.started_at);
              const color = STATUS_COLOR[status];
              const label = STATUS_LABEL[status];
              return (
                <button
                  key={it.id}
                  data-testid={`cooling-item-${it.id}`}
                  onClick={() => navigate(`/jkhive/cooking-cooling/${it.id}/record`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '16px 16px',
                    background: '#FFFFFF', borderRadius: 20, border: 0, cursor: 'pointer', textAlign: 'left',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    borderLeft: `4px solid ${color}`,
                  }}
                >
                  <span style={{ fontSize: 36 }}>{categoryEmoji(it.item_category)}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 16, fontWeight: 700, color: '#1D1D1F', margin: 0 }}>{it.item_name}</p>
                    <p style={{ fontSize: 12, color: '#86868B', margin: '2px 0 0' }}>
                      Started at {Number(it.start_temp_c).toFixed(1)}°C · {elapsed(it.started_at)}
                    </p>
                  </div>
                  <span data-testid={`cooling-status-${status}`} style={{
                    fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 999,
                    background: color, color: '#FFFFFF', whiteSpace: 'nowrap',
                  }}>{label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <button
        data-testid="add-new-cooling"
        onClick={() => navigate('/jkhive/cooking-cooling/new')}
        disabled={!adminLocationId}
        style={{
          position: 'fixed', left: 16, right: 16, bottom: 96, maxWidth: 600, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '18px 16px', borderRadius: 999, border: 0,
          background: '#1D1D1F', color: '#FFFFFF', fontSize: 17, fontWeight: 600,
          cursor: 'pointer', opacity: adminLocationId ? 1 : 0.5,
          fontFamily: 'Outfit, sans-serif',
          boxShadow: '0 6px 18px rgba(0,0,0,0.18)', zIndex: 5,
        }}
      >
        <Plus size={20} strokeWidth={2.6} />
        Add new cooling
      </button>
    </div>
  );
};

export const categoryEmoji = (cat) => {
  const map = {
    Beef: '🐄', Chicken: '🐔', Eggs: '🥚', 'Fish (other)': '🎣',
    'Flat Fish': '🐟', Game: '🦌', Lamb: '🐑', Milk: '🥛', Molluscs: '🦑',
    Pastry: '🥐', Pork: '🐷', 'Rice And Grains': '🌾', 'Round Fish': '🐠',
    Salad: '🥗', Turkey: '🦃', General: '🥘',
  };
  return map[cat] || '🥘';
};

export default CoolingHome;
