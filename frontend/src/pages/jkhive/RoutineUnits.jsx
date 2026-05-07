import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Snowflake } from 'lucide-react';
import api from '../../lib/api';
import { useLocation2 } from '../../contexts/LocationContext';

const PERIOD_LABELS = { opening: 'Opening', closing: 'Closing' };

/**
 * Routine Units settings — for each fridge/freezer/chiller at the current
 * location, admins toggle whether it appears in the Opening Routine and the
 * Closing Routine wizard.
 *
 * e.g. a Display Chiller is normally turned off at closing → toggle Closing OFF
 * and it will be skipped in /jkhive/closing/fridge-temp.
 */
const RoutineUnits = () => {
  const { adminLocationId, locations } = useLocation2();
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    if (!adminLocationId) { setLoading(false); return; }
    setLoading(true);
    api.adminGetTempUnits(adminLocationId)
      .then(list => {
        setUnits((list || []).filter(u => ['fridge', 'freezer', 'chiller'].includes(u.unit_type)));
      })
      .catch(err => alert('Failed to load: ' + err.message))
      .finally(() => setLoading(false));
  }, [adminLocationId]);

  const togglePeriod = async (unit, period) => {
    const skip = unit.skip_periods || [];
    const next = skip.includes(period) ? skip.filter(p => p !== period) : [...skip, period];
    setSavingId(unit.id);
    try {
      const updated = await api.adminUpdateTempUnit(unit.id, { skip_periods: next });
      setUnits(us => us.map(u => u.id === unit.id ? { ...u, ...updated } : u));
    } catch (err) { alert('Save failed: ' + err.message); }
    finally { setSavingId(null); }
  };

  const locName = locations.find(l => l.id === adminLocationId)?.name || '';
  const font = { fontFamily: 'Outfit, sans-serif' };

  return (
    <div style={{ paddingBottom: 24, ...font }} data-testid="jkhive-routine-units">
      <Link to="/jkhive/manager" data-testid="back-to-jkhive"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#1D1D1F', textDecoration: 'none', marginBottom: 6 }}>
        <ArrowLeft size={20} strokeWidth={2.4} style={{ color: '#007AFF' }} />
        <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>Routine Units</span>
      </Link>
      <p style={{ fontSize: 13, color: '#86868B', margin: '4px 0 16px' }}>
        Choose which fridges/freezers appear in each routine. {locName && (<span>Location: <b style={{ color: '#1D1D1F' }}>{locName}</b></span>)}
      </p>

      {!adminLocationId && (
        <div style={{ padding: 18, background: 'rgba(255,149,0,0.08)', borderRadius: 14, color: '#86868B', fontSize: 14 }}>
          Please pick a location from JKHive home first.
        </div>
      )}

      {loading && adminLocationId && (
        <div style={{ padding: 24, textAlign: 'center', color: '#86868B' }}>Loading…</div>
      )}

      {!loading && adminLocationId && units.length === 0 && (
        <div style={{ padding: 18, background: '#FFFFFF', borderRadius: 14, color: '#86868B', fontSize: 14 }}>
          No fridges or freezers are configured at this location yet.
        </div>
      )}

      {units.map(u => {
        const skip = u.skip_periods || [];
        return (
          <div key={u.id} data-testid={`routine-unit-${u.id}`}
               style={{ background: '#FFFFFF', borderRadius: 16, padding: '14px 16px', marginBottom: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F2F2F7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Snowflake size={18} strokeWidth={2} style={{ color: '#3A3A3C' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#1D1D1F', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</p>
              <p style={{ fontSize: 11, color: '#86868B', margin: '2px 0 0', textTransform: 'capitalize' }}>{u.unit_type}</p>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['opening', 'closing'].map(p => {
                const included = !skip.includes(p);
                return (
                  <button
                    key={p}
                    data-testid={`toggle-${u.id}-${p}`}
                    onClick={() => togglePeriod(u, p)}
                    disabled={savingId === u.id}
                    style={{
                      padding: '6px 10px', borderRadius: 999, border: 0, cursor: 'pointer',
                      fontSize: 11, fontWeight: 600, ...font,
                      background: included ? 'rgba(0,122,255,0.10)' : '#F2F2F7',
                      color: included ? '#007AFF' : '#86868B',
                      opacity: savingId === u.id ? 0.5 : 1,
                    }}
                  >
                    {included ? '✓ ' : ''}{PERIOD_LABELS[p]}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RoutineUnits;
