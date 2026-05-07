import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, Check } from 'lucide-react';
import api from '../../lib/api';
import { useLocation2 } from '../../contexts/LocationContext';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Opening / Closing Fridge & Freezer temperature wizard.
 *
 * Walks the user through every active fridge/freezer at the current location:
 * step-per-unit gauge with +/- 0.1°C, then an optional comment, then submit.
 *
 * Recommended ranges:
 *   fridge / chiller : ≤ 5°C
 *   freezer          : ≤ -18°C
 */
const RANGES = {
  fridge:  { min: -5, max: 12, default: 5,   recLabel: '5°C or lower',   isOk: t => t <= 5 },
  chiller: { min: -5, max: 12, default: 5,   recLabel: '5°C or lower',   isOk: t => t <= 5 },
  freezer: { min: -28, max: 0, default: -18, recLabel: '-18°C or lower', isOk: t => t <= -18 },
};

const Gauge = ({ value, range, ok, onChange }) => {
  const { min, max } = range;
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const angle = -180 + pct * 180;
  const ringColor = ok ? '#34C759' : '#FF3B30';
  const ref = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);

  const computeFromPointer = React.useCallback((clientX, clientY) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + 110;
    const dx = clientX - cx;
    const dy = cy - clientY;
    let theta = Math.atan2(dy, dx);
    if (theta < 0) theta = 0;
    if (theta > Math.PI) theta = Math.PI;
    const newPct = 1 - theta / Math.PI;
    const newValue = Math.round((min + newPct * (max - min)) * 10) / 10;
    onChange(newValue);
  }, [min, max, onChange]);

  // Global pointer move/up while dragging — works even if pointer leaves gauge.
  React.useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => computeFromPointer(e.clientX, e.clientY);
    const onUp = () => setDragging(false);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, computeFromPointer]);

  const onPointerDown = (e) => {
    e.preventDefault();
    setDragging(true);
    computeFromPointer(e.clientX, e.clientY);
  };

  return (
    <div
      ref={ref}
      style={{ position: 'relative', width: 220, height: 130, margin: '0 auto', touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none' }}
      onPointerDown={onPointerDown}
    >
      <svg viewBox="0 0 200 110" width="220" height="130" style={{ overflow: 'visible', pointerEvents: 'none' }}>
        <path d="M 14 100 A 86 86 0 0 1 186 100" stroke="#E8E8ED" strokeWidth="14" strokeLinecap="round" fill="none" />
        <path
          d="M 14 100 A 86 86 0 0 1 186 100"
          stroke={ringColor}
          strokeWidth="14"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${pct * 270} 600`}
        />
      </svg>
      <div style={{
        position: 'absolute', top: 50, left: 0, right: 0,
        textAlign: 'center', fontSize: 44, fontWeight: 700, letterSpacing: '-0.02em',
        color: '#1D1D1F', fontFamily: 'Outfit, sans-serif',
        pointerEvents: 'none',
      }}>
        {value.toFixed(1)}°C
      </div>
      <div style={{
        position: 'absolute', left: '50%', top: 110,
        width: 26, height: 26, marginLeft: -13, marginTop: -13, borderRadius: 999,
        background: ringColor,
        border: '3px solid #FFFFFF',
        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
        transform: `rotate(${angle}deg) translateX(86px)`,
        transformOrigin: 'center',
        pointerEvents: 'none',
        transition: dragging ? 'none' : 'transform 0.15s ease',
      }} />
    </div>
  );
};

const StepFooter = ({ stepIdx, total }) => (
  <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16, marginBottom: 12 }}>
    {Array.from({ length: total }).map((_, i) => (
      <div key={i} style={{
        width: i === stepIdx ? 22 : 6, height: 6, borderRadius: 999,
        background: i === stepIdx ? '#1D1D1F' : (i < stepIdx ? '#1D1D1F' : '#D1D1D6'),
        opacity: i === stepIdx ? 1 : (i < stepIdx ? 0.4 : 1),
        transition: 'all 0.25s ease',
      }} />
    ))}
  </div>
);

const RoutineTempWizard = ({ period, title, backTo }) => {
  const navigate = useNavigate();
  const { adminLocationId, locations } = useLocation2();
  const { user } = useAuth();
  const [units, setUnits] = useState([]);
  const [readings, setReadings] = useState({}); // {unit_id: temp_c}
  const [comment, setComment] = useState('');
  const [stepIdx, setStepIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!adminLocationId) { setLoading(false); return; }
    setLoading(true);
    api.adminGetTempUnits(adminLocationId)
      .then(list => {
        const fridgeFreezer = (list || []).filter(u =>
          ['fridge', 'freezer', 'chiller'].includes(u.unit_type) &&
          !((u.skip_periods || []).includes(period))
        );
        setUnits(fridgeFreezer);
        // Seed readings to default per unit type
        const seed = {};
        fridgeFreezer.forEach(u => { seed[u.id] = (RANGES[u.unit_type] || RANGES.fridge).default; });
        setReadings(seed);
      })
      .catch(err => alert('Failed to load fridges: ' + err.message))
      .finally(() => setLoading(false));
  }, [adminLocationId]);

  const totalSteps = units.length + 2; // unit steps + comment + done
  const onUnitStep = stepIdx < units.length;
  const onCommentStep = stepIdx === units.length;
  const onDoneStep = stepIdx === units.length + 1;
  const currentUnit = onUnitStep ? units[stepIdx] : null;
  const currentRange = currentUnit ? (RANGES[currentUnit.unit_type] || RANGES.fridge) : null;
  const currentTemp = currentUnit ? (readings[currentUnit.id] ?? currentRange.default) : 0;

  const adjust = (delta) => {
    if (!currentUnit) return;
    const next = Math.round((currentTemp + delta) * 10) / 10;
    setReadings(r => ({ ...r, [currentUnit.id]: next }));
  };
  const setManual = (v) => {
    if (!currentUnit) return;
    const num = parseFloat(v);
    if (Number.isNaN(num)) return;
    setReadings(r => ({ ...r, [currentUnit.id]: num }));
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await api.submitRoutineTemp({
        location_id: adminLocationId,
        date: today,
        period,
        readings: units.map(u => ({
          unit_id: u.id,
          unit_name: u.name,
          unit_type: u.unit_type,
          temp_c: readings[u.id],
        })),
        comment,
      });
      setDone(true);
      setStepIdx(i => i + 1);
    } catch (err) { alert('Save failed: ' + err.message); }
    finally { setSubmitting(false); }
  };

  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);
  const font = { fontFamily: 'Outfit, sans-serif' };

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#86868B' }}>Loading…</div>;
  }
  if (!adminLocationId) {
    return <div style={{ padding: 24, color: '#FF9500' }}>Please pick a location from JKHive home first.</div>;
  }
  if (units.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <Link to={backTo} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#1D1D1F', textDecoration: 'none', marginBottom: 12, ...font }}>
          <ArrowLeft size={20} strokeWidth={2.4} style={{ color: '#007AFF' }} />
          <span style={{ fontSize: 22, fontWeight: 600 }}>{title}</span>
        </Link>
        <p style={{ color: '#86868B', ...font }}>
          No fridge/freezer units configured at <b>{locationName}</b>. An admin can add them in the Temp Log page.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 4px 12px', ...font }} data-testid={`routine-temp-${period}`}>
      <Link to={backTo} data-testid="back-to-routines" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#1D1D1F', textDecoration: 'none', marginBottom: 8 }}>
        <ArrowLeft size={20} strokeWidth={2.4} style={{ color: '#007AFF' }} />
        <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</span>
      </Link>
      <p style={{ fontSize: 12, color: '#86868B', margin: '2px 0 18px' }}>{locationName} · {today}</p>

      {onUnitStep && (
        <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '24px 18px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <p style={{ fontSize: 18, fontWeight: 600, color: '#1D1D1F', margin: 0, textAlign: 'center' }}>{currentUnit.name}</p>
          <p style={{ fontSize: 12, color: '#86868B', margin: '4px 0 16px', textAlign: 'center', textTransform: 'capitalize' }}>{currentUnit.unit_type}</p>

          <Gauge value={currentTemp} range={currentRange} ok={currentRange.isOk(currentTemp)} onChange={(v) => setReadings(r => ({ ...r, [currentUnit.id]: v }))} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, margin: '20px 0 8px' }}>
            <button data-testid="temp-minus" onClick={() => adjust(-0.1)} style={{ width: 52, height: 52, borderRadius: 999, background: '#F2F2F7', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Minus size={22} strokeWidth={2.6} style={{ color: '#1D1D1F' }} />
            </button>
            <input
              data-testid="temp-input"
              type="number" step="0.1" inputMode="text"
              value={currentTemp}
              onChange={e => setManual(e.target.value)}
              style={{ width: 110, padding: '10px 12px', textAlign: 'center', fontSize: 18, fontWeight: 600, border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, background: '#FFFFFF', color: '#1D1D1F', ...font }}
            />
            <button data-testid="temp-plus" onClick={() => adjust(0.1)} style={{ width: 52, height: 52, borderRadius: 999, background: '#F2F2F7', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={22} strokeWidth={2.6} style={{ color: '#1D1D1F' }} />
            </button>
          </div>

          <p style={{ fontSize: 12, color: '#86868B', textAlign: 'center', margin: 0 }}>
            Recommended range: <b style={{ color: '#1D1D1F' }}>{currentRange.recLabel}</b>
          </p>
          {!currentRange.isOk(currentTemp) && (
            <p style={{ fontSize: 12, color: '#FF3B30', textAlign: 'center', margin: '6px 0 0' }}>
              Out of range — please check the unit
            </p>
          )}
        </div>
      )}

      {onCommentStep && (
        <div style={{ background: '#FFFFFF', borderRadius: 24, padding: 22, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: '#1D1D1F', margin: '0 0 4px' }}>Add a comment?</h2>
          <p style={{ fontSize: 13, color: '#86868B', margin: '0 0 14px' }}>This is optional</p>
          <textarea
            data-testid="routine-temp-comment"
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="e.g. Door seal needs replacing on Fridge 2…"
            rows={5}
            style={{ width: '100%', padding: 12, fontSize: 14, border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, background: '#F8F8FA', color: '#1D1D1F', resize: 'vertical', ...font, outline: 'none' }}
          />
        </div>
      )}

      {onDoneStep && (
        <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '28px 22px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 999, background: '#34C759', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <Check size={32} strokeWidth={2.6} color="#fff" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1D1D1F', margin: '0 0 6px' }}>All done!</h2>
          <p style={{ fontSize: 14, color: '#3A3A3C', margin: '0 0 4px' }}>
            {period === 'opening' ? "Don't forget your closing routine later." : 'Closing temps recorded for today.'}
          </p>
          {user?.name && (
            <p style={{ fontSize: 12, color: '#86868B', margin: 0 }}>Submitted by {user.name}</p>
          )}
        </div>
      )}

      <StepFooter stepIdx={stepIdx} total={totalSteps} />

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
        {!onDoneStep && stepIdx > 0 && (
          <button onClick={() => setStepIdx(i => Math.max(0, i - 1))}
            style={{ flex: '0 0 90px', padding: '12px 16px', borderRadius: 14, border: '1px solid rgba(0,0,0,0.08)', background: '#FFFFFF', color: '#1D1D1F', fontSize: 14, fontWeight: 600, cursor: 'pointer', ...font }}>
            Back
          </button>
        )}
        {onUnitStep && (
          <button data-testid="next-btn" onClick={() => setStepIdx(i => i + 1)}
            style={{ flex: 1, padding: '14px 16px', borderRadius: 14, border: 0, background: '#1D1D1F', color: '#FFFFFF', fontSize: 15, fontWeight: 600, cursor: 'pointer', ...font }}>
            Next
          </button>
        )}
        {onCommentStep && (
          <button data-testid="submit-record-btn" disabled={submitting} onClick={submit}
            style={{ flex: 1, padding: '14px 16px', borderRadius: 14, border: 0, background: '#1D1D1F', color: '#FFFFFF', fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: submitting ? 0.5 : 1, ...font }}>
            {submitting ? 'Saving…' : 'Submit Record'}
          </button>
        )}
        {onDoneStep && (
          <button data-testid="back-home-btn" onClick={() => navigate(backTo)}
            style={{ flex: 1, padding: '14px 16px', borderRadius: 14, border: 0, background: '#34C759', color: '#FFFFFF', fontSize: 15, fontWeight: 600, cursor: 'pointer', ...font }}>
            {done ? 'Done' : 'Continue'}
          </button>
        )}
      </div>
    </div>
  );
};

export default RoutineTempWizard;
