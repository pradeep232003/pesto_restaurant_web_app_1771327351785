import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';

const isTodayIso = (iso) => (iso || '').slice(0, 10) === new Date().toISOString().slice(0, 10);

/** /jkhive/hot-cold-holding/mode — IMG_6714. Hot or Cold? */
const PickMode = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const backTo = searchParams.get('back') || '/jkhive/hot-cold-holding';
  const { adminLocationId, locations } = useLocation2();
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  // Track which modes already have an entry for today (real session OR no_holding).
  const [todayState, setTodayState] = useState({ hot: false, cold: false, hotNo: false, coldNo: false, loaded: false });
  const [busy, setBusy] = useState(null);

  const refresh = async () => {
    if (!adminLocationId) { setTodayState(s => ({ ...s, loaded: true })); return; }
    try {
      const all = await api.hotColdList(adminLocationId);
      const todays = (all || []).filter(r => isTodayIso(r.start_time || r.recorded_at));
      const hotReal  = todays.some(r => r.mode === 'hot'  && r.kind !== 'no_holding');
      const coldReal = todays.some(r => r.mode === 'cold' && r.kind !== 'no_holding');
      const hotNo    = todays.some(r => r.mode === 'hot'  && r.kind === 'no_holding');
      const coldNo   = todays.some(r => r.mode === 'cold' && r.kind === 'no_holding');
      setTodayState({ hot: hotReal, cold: coldReal, hotNo, coldNo, loaded: true });
    } catch {
      setTodayState(s => ({ ...s, loaded: true }));
    }
  };
  useEffect(() => { refresh(); /* eslint-disable-line */ }, [adminLocationId]);

  const logNoMode = async (mode) => {
    if (!adminLocationId || busy) return;
    setBusy(mode);
    try {
      await api.hotColdNoMode(adminLocationId, mode);
      await refresh();
    } catch (e) {
      alert(e?.message || 'Could not log');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="hot-cold-mode">
      <WizardHeader title="Record Hot/cold Holding" locationName={locationName} dateStr={today} backTo={backTo} />

      <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.02em', color: '#1D1D1F', margin: '24px 4px 32px', lineHeight: 1.05 }}>
        Is this item hot or cold?
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {[
          { mode: 'hot',  label: 'Hot',  emoji: '🔥' },
          { mode: 'cold', label: 'Cold', emoji: '❄️' },
        ].map(c => (
          <button key={c.mode} data-testid={`mode-${c.mode}`}
            onClick={() => navigate('/jkhive/hot-cold-holding/pick', { state: { mode: c.mode } })}
            style={{
              background: '#FFFFFF', border: '2px solid #1D1D1F', borderRadius: 22,
              padding: '40px 12px', minHeight: 220, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
              fontFamily: 'Outfit, sans-serif',
            }}>
            <span style={{ fontSize: 56, lineHeight: 1, opacity: 0.85 }}>{c.emoji}</span>
            <span style={{ fontSize: 22, fontWeight: 500, color: '#1D1D1F' }}>{c.label}</span>
          </button>
        ))}
      </div>

      {/* "No holding today" pills */}
      <div style={{ marginTop: 28 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 4px 10px' }}>
          Or, if nothing is being held today
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { mode: 'hot',  label: 'No hot holding today',  has: todayState.hot || todayState.hotNo,  flag: todayState.hotNo  },
            { mode: 'cold', label: 'No cold holding today', has: todayState.cold || todayState.coldNo, flag: todayState.coldNo },
          ].map(p => (
            <button key={p.mode} data-testid={`no-${p.mode}-today`}
              onClick={() => p.has ? null : logNoMode(p.mode)}
              disabled={p.has || busy === p.mode}
              style={{
                background: p.flag ? 'rgba(52,199,89,0.12)' : '#FFFFFF',
                border: p.flag ? '1.5px solid #34C759' : '1.5px solid #1D1D1F',
                borderRadius: 999, padding: '14px 12px',
                color: p.flag ? '#1B7A35' : (p.has ? '#86868B' : '#1D1D1F'),
                fontSize: 13, fontWeight: 600, cursor: (p.has || busy === p.mode) ? 'default' : 'pointer',
                fontFamily: 'Outfit, sans-serif', textAlign: 'center',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                opacity: (p.has && !p.flag) ? 0.55 : 1,
              }}>
              {p.flag && <Check size={14} strokeWidth={2.6} />}
              {busy === p.mode ? 'Logging…' : (p.has && !p.flag) ? `${p.label.split(' ')[1]} already logged` : p.label}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: '#86868B', textAlign: 'center', marginTop: 10 }}>
          Marks the routine as done without creating a holding session. Idempotent per day.
        </p>
      </div>
    </div>
  );
};

export default PickMode;
