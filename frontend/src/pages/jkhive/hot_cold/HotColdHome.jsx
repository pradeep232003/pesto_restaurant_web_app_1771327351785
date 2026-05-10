import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Trash2, CheckCircle2 } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';
import { categoryEmoji } from '../cooling/CoolingHome';

/** /jkhive/hot-cold-holding — list active sessions (IMG_6713 / IMG_6717). */
const HotColdHome = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const backTo = searchParams.get('back') || '/jkhive/routines/more';
  const { adminLocationId, locations } = useLocation2();
  const [rows, setRows] = useState([]);
  const [completedToday, setCompletedToday] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  const load = async () => {
    if (!adminLocationId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [active, complete] = await Promise.all([
        api.hotColdList(adminLocationId, 'active'),
        api.hotColdList(adminLocationId, 'complete'),
      ]);
      setRows(active || []);
      setCompletedToday((complete || []).filter(s => (s.start_time || '').slice(0, 10) === today));
    } catch (err) { alert('Failed to load: ' + err.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [adminLocationId]); // eslint-disable-line

  const completeNow = async (s) => {
    const ok = window.confirm(`Mark ${s.item_name} (${s.mode}) holding as complete?`);
    if (!ok) return;
    try { await api.hotColdComplete(s.id, {}); load(); }
    catch (err) { alert('Could not complete: ' + err.message); }
  };

  const remove = async (s) => {
    if (!window.confirm(`Delete this ${s.mode} holding session?`)) return;
    try { await api.hotColdDelete(s.id); load(); }
    catch (err) { alert('Failed: ' + err.message); }
  };

  return (
    <div style={{ paddingBottom: 130, fontFamily: 'Outfit, sans-serif' }} data-testid="hot-cold-home">
      <WizardHeader title="Currently Hot/Cold Holding" locationName={locationName} dateStr={today} backTo={backTo} />

      {!adminLocationId && <p style={{ color: '#FF9500', textAlign: 'center', padding: 18 }}>Pick a location from JKHive home first.</p>}
      {adminLocationId && loading && <p style={{ color: '#86868B', textAlign: 'center', padding: 18 }}>Loading…</p>}

      {adminLocationId && !loading && rows.length === 0 && completedToday.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 16px 0' }}>
          <div style={{ fontSize: 96, lineHeight: 1, marginBottom: 18 }}>🛋️</div>
          <p style={{ fontSize: 16, color: '#1D1D1F', margin: 0, lineHeight: 1.4 }}>
            There are no items currently in hot/cold holding.<br/>
            Use the button below to add a new one!
          </p>
        </div>
      )}

      {adminLocationId && !loading && rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map(s => <SessionCard key={s.id} s={s} onComplete={() => completeNow(s)} onDelete={() => remove(s)} onAddCheck={() => navigate(`/jkhive/hot-cold-holding/${s.id}/check`, { state: { session: s } })} />)}
        </div>
      )}

      {adminLocationId && !loading && completedToday.length > 0 && (
        <div style={{ marginTop: rows.length > 0 ? 24 : 8 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 4px 8px' }}>
            Completed today
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {completedToday.map(s => <CompletedRow key={s.id} s={s} />)}
          </div>
        </div>
      )}

      <button data-testid="new-hot-cold"
        onClick={() => navigate('/jkhive/hot-cold-holding/mode')}
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
        + New record
      </button>
    </div>
  );
};

const SessionCard = ({ s, onComplete, onDelete, onAddCheck }) => {
  const [elapsed, setElapsed] = useState('00:00:00');
  const ref = useRef(null);

  useEffect(() => {
    const start = new Date(s.start_time).getTime();
    const tick = () => {
      const sec = Math.max(0, Math.floor((Date.now() - start) / 1000));
      const h = String(Math.floor(sec / 3600)).padStart(2, '0');
      const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
      const ss = String(sec % 60).padStart(2, '0');
      const txt = `${h}:${m}:${ss}`;
      if (ref.current) ref.current.textContent = txt;
      else setElapsed(txt);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [s.start_time]);

  const tone = s.mode === 'hot' ? '#FF3B30' : '#0A84C9';
  const checks = ['2hr', '4hr', '6hr'];
  const recordedLabels = (s.checks || []).map(c => c.label);

  return (
    <div style={{ background: '#FFFFFF', borderRadius: 18, padding: '14px 14px 12px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }} data-testid={`session-${s.id}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <span style={{ fontSize: 38 }}>{s.item_icon || (s.mode === 'hot' ? '🌡️' : '❄️')}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#1D1D1F', margin: 0 }}>{s.item_name}</p>
          <p style={{ fontSize: 12, color: '#86868B', margin: '2px 0 0', textTransform: 'capitalize' }}>{s.mode} Holding</p>
        </div>
        <button onClick={onDelete} aria-label="Delete"
          style={{ background: 'transparent', border: 0, padding: 6, cursor: 'pointer', color: '#FF3B30' }}>
          <Trash2 size={16} strokeWidth={2.2} />
        </button>
      </div>

      {/* Time slot row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, marginTop: 4 }}>
        <SlotCell active label="Start" temp={s.start_temp} pass={s.start_pass} />
        {checks.map(label => {
          const c = (s.checks || []).find(x => x.label === label);
          return <SlotCell key={label} label={label} temp={c?.temp} pass={c?.passed}
            disabled={recordedLabels.includes(label)}
            onClick={() => !c && onAddCheck(label)} />;
        })}
      </div>

      <div style={{ marginTop: 14, textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: '#1D1D1F', margin: 0 }}>Elapsed time:</p>
        <p ref={ref} style={{ fontSize: 32, fontWeight: 600, color: '#1D1D1F', margin: '4px 0 0', fontVariantNumeric: 'tabular-nums' }}>{elapsed}</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
        <button data-testid={`complete-${s.id}`} onClick={onComplete}
          style={{
            background: 'transparent', border: 0, color: '#1D1D1F',
            fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', cursor: 'pointer',
            fontFamily: 'Outfit, sans-serif', padding: '6px 4px',
          }}>
          COMPLETE
        </button>
      </div>
    </div>
  );
};

const SlotCell = ({ label, temp, pass, active, disabled, onClick }) => {
  const tone = pass === false ? '#FF3B30' : pass === true ? '#34C759' : '#1D1D1F';
  const has = temp != null;
  return (
    <button
      onClick={onClick}
      disabled={!onClick || disabled}
      style={{
        background: 'transparent', border: 0, padding: '4px 0', cursor: onClick && !disabled ? 'pointer' : 'default',
        textAlign: 'center', fontFamily: 'Outfit, sans-serif',
      }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: '#1D1D1F', borderBottom: `1.5px solid ${active ? '#1D1D1F' : 'rgba(0,0,0,0.4)'}`, paddingBottom: 2 }}>{label}</span>
      <p style={{ fontSize: 13, color: tone, margin: '4px 0 0', fontWeight: 600 }}>
        {has ? `${Number(temp).toFixed(1)}°C` : '—'}
      </p>
    </button>
  );
};

const CompletedRow = ({ s }) => {
  const start = s.start_time ? new Date(s.start_time) : null;
  const end = s.end_time ? new Date(s.end_time) : null;
  const fmt = (d) => d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
  return (
    <div data-testid={`completed-${s.id}`}
      style={{ background: '#FFFFFF', borderRadius: 14, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', opacity: 0.85 }}>
      <span style={{ fontSize: 24 }}>{s.item_icon || (s.mode === 'hot' ? '🌡️' : '❄️')}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#1D1D1F', margin: 0 }}>{s.item_name}</p>
        <p style={{ fontSize: 11, color: '#86868B', margin: '2px 0 0', textTransform: 'capitalize' }}>
          {s.mode} · {fmt(start)} – {fmt(end)}
        </p>
      </div>
      <CheckCircle2 size={18} color="#34C759" strokeWidth={2.4} />
    </div>
  );
};

export default HotColdHome;
