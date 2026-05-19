import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Flame, Trash2, CalendarX, Check } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';
import { categoryEmoji } from '../cooling/CoolingHome';

/**
 * /jkhive/reheating — landing screen.
 * Lists today's reheat records + sticky Add new button + "No reheating today".
 */
const ReheatingHome = () => {
  const navigate = useNavigate();
  const { adminLocationId, locations } = useLocation2();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  const load = () => {
    if (!adminLocationId) { setLoading(false); return; }
    setLoading(true);
    api.reheatingList(adminLocationId)
      .then(d => {
        const t = today;
        setItems((d || []).filter(r => (r.recorded_at || '').slice(0, 10) === t));
      })
      .catch(err => alert('Failed to load: ' + err.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, [adminLocationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasNoReheating = items.some(it => it.kind === 'no_reheating');
  const hasRealReheating = items.some(it => it.kind !== 'no_reheating');

  const logNoReheating = async () => {
    if (hasRealReheating) {
      alert("You can't mark 'no reheating today' once a reheat record has been logged.");
      return;
    }
    setLogging(true);
    try {
      await api.reheatingNoReheating(adminLocationId);
      load();
    } catch (err) { alert('Failed: ' + err.message); }
    finally { setLogging(false); }
  };

  const handleDelete = async (it, e) => {
    e.stopPropagation();
    const ok = window.confirm(`Delete "${it.item_name}"?\n\nThis will permanently remove this reheat record. This can't be undone.`);
    if (!ok) return;
    try {
      await api.reheatingDelete(it.id);
      setItems(prev => prev.filter(x => x.id !== it.id));
    } catch (err) { alert('Failed to delete: ' + err.message); }
  };

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="reheating-home">
      <WizardHeader title="Reheating" locationName={locationName} dateStr={today} backTo="/jkhive/routines" />

      {!adminLocationId && (
        <p style={{ color: '#FF9500', padding: 18 }}>Please pick a location from JKHive home first.</p>
      )}
      {adminLocationId && loading && (
        <p style={{ color: '#86868B', padding: 18, textAlign: 'center' }}>Loading…</p>
      )}

      {adminLocationId && !loading && items.length === 0 && (
        <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '36px 22px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ width: 64, height: 64, borderRadius: 999, background: 'rgba(255,59,48,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <Flame size={32} color="#FF3B30" strokeWidth={2} />
          </div>
          <p style={{ fontSize: 17, fontWeight: 700, color: '#1D1D1F', margin: '0 0 4px' }}>No reheats today</p>
          <p style={{ fontSize: 13, color: '#86868B', margin: 0 }}>Tap the button below to record a new reheating temperature.</p>
        </div>
      )}

      {adminLocationId && !loading && items.length > 0 && (
        <>
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#86868B', margin: '6px 4px 8px' }}>
            Today's records · {items.length}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map(it => {
              if (it.kind === 'no_reheating') {
                return (
                  <div key={it.id} data-testid={`reheating-no-${it.id}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                      background: '#FFFFFF', borderRadius: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 999, background: 'rgba(52,199,89,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Check size={16} strokeWidth={2.8} color="#1B7A35" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#1D1D1F', margin: 0 }}>No reheating today</p>
                      <p style={{ fontSize: 11, color: '#86868B', margin: '2px 0 0' }}>
                        Logged{it.recorded_by_name ? ` by ${it.recorded_by_name}` : ''}
                        {(it.recorded_at || '').slice(11, 16) ? ` · ${it.recorded_at.slice(11, 16)}` : ''}
                      </p>
                    </div>
                    <button data-testid={`reheating-delete-${it.id}`}
                      onClick={(e) => handleDelete(it, e)} aria-label="Undo no reheating"
                      style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'transparent', border: 0, cursor: 'pointer', color: '#FF3B30' }}>
                      <Trash2 size={16} strokeWidth={2.2} />
                    </button>
                  </div>
                );
              }
              const passColor = it.passed ? '#34C759' : '#FF3B30';
              const time = (it.recorded_at || '').slice(11, 16);
              return (
                <div key={it.id} data-testid={`reheating-row-${it.id}`}
                  style={{
                    display: 'flex', alignItems: 'stretch', background: '#FFFFFF', borderRadius: 16,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)', overflow: 'hidden',
                    borderLeft: `4px solid ${passColor}`,
                  }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 12px 12px 14px', minWidth: 0 }}>
                    <span style={{ fontSize: 28 }}>{categoryEmoji(it.item_category)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#1D1D1F', margin: 0 }}>{it.item_name}</p>
                      <p style={{ fontSize: 11, color: '#86868B', margin: '2px 0 0' }}>
                        Reheated to <b style={{ color: passColor }}>{Number(it.temp_c).toFixed(1)}°C</b>
                        {it.recorded_by_name ? ` · by ${it.recorded_by_name}` : ''}
                        {time ? ` · ${time}` : ''}
                      </p>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999,
                      background: passColor, color: '#FFFFFF', whiteSpace: 'nowrap',
                    }}>{it.passed ? 'PASS' : 'UNDER'}</span>
                  </div>
                  <button data-testid={`reheating-delete-${it.id}`}
                    onClick={(e) => handleDelete(it, e)}
                    aria-label={`Delete ${it.item_name}`}
                    style={{
                      width: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'transparent', border: 0, borderLeft: '1px solid rgba(0,0,0,0.06)',
                      cursor: 'pointer', color: '#FF3B30',
                    }}>
                    <Trash2 size={16} strokeWidth={2.2} />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      <button data-testid="add-new-reheating"
        onClick={() => navigate('/jkhive/reheating/new')}
        disabled={!adminLocationId || hasNoReheating}
        style={{
          position: 'fixed', left: 16, right: 16, bottom: 150, maxWidth: 600, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '18px 16px', borderRadius: 999, border: 0,
          background: '#1D1D1F', color: '#FFFFFF', fontSize: 17, fontWeight: 600,
          cursor: (!adminLocationId || hasNoReheating) ? 'not-allowed' : 'pointer',
          opacity: (!adminLocationId || hasNoReheating) ? 0.4 : 1,
          fontFamily: 'Outfit, sans-serif',
          boxShadow: '0 6px 18px rgba(0,0,0,0.18)', zIndex: 5,
        }}>
        <Plus size={20} strokeWidth={2.6} /> Add new reheat
      </button>

      <button data-testid="log-no-reheating"
        onClick={logNoReheating}
        disabled={!adminLocationId || logging || hasNoReheating || hasRealReheating}
        style={{
          position: 'fixed', left: 16, right: 16, bottom: 96, maxWidth: 600, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '14px 16px', borderRadius: 999,
          border: '1px solid rgba(0,0,0,0.12)',
          background: '#FFFFFF', color: '#1D1D1F', fontSize: 15, fontWeight: 600,
          cursor: (!adminLocationId || logging || hasNoReheating || hasRealReheating) ? 'not-allowed' : 'pointer',
          opacity: (!adminLocationId || logging || hasNoReheating || hasRealReheating) ? 0.5 : 1,
          fontFamily: 'Outfit, sans-serif',
          boxShadow: '0 2px 6px rgba(0,0,0,0.06)', zIndex: 5,
        }}>
        <CalendarX size={18} strokeWidth={2.4} />
        {hasNoReheating ? 'No reheating logged ✓' : 'No reheating today'}
      </button>
    </div>
  );
};

export default ReheatingHome;
