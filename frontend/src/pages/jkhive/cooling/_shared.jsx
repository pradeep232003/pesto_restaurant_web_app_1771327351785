import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * Shared sticky header for JKHive Cooking & Cooling wizard.
 * Shows a back chevron, the page title, and a small location · date strip
 * underneath so staff working across sites cannot mistake which kitchen
 * they're recording against.
 */
export const WizardHeader = ({ title, locationName, dateStr, backTo, onBack }) => {
  const navigate = useNavigate();
  const handleBack = (e) => {
    if (onBack) { e.preventDefault(); onBack(); }
    else if (!backTo) { e.preventDefault(); navigate(-1); }
  };
  const Back = backTo
    ? <Link to={backTo} onClick={handleBack} data-testid="wizard-back" style={{ color: '#1D1D1F' }} aria-label="Back"><ArrowLeft size={26} strokeWidth={2.6} /></Link>
    : <button onClick={handleBack} data-testid="wizard-back" aria-label="Back" style={{ background: 'transparent', border: 0, padding: 0, color: '#1D1D1F', cursor: 'pointer' }}><ArrowLeft size={26} strokeWidth={2.6} /></button>;
  return (
    <div style={{ paddingTop: 4, paddingBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        {Back}
        <h1 style={{ flex: 1, textAlign: 'center', margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em', color: '#1D1D1F' }}>
          {title}
        </h1>
        <span style={{ width: 26 }} />
      </div>
      <p style={{ marginTop: 6, fontSize: 12, color: '#86868B', textAlign: 'center' }}>
        <b style={{ color: '#1D1D1F', fontWeight: 600 }}>{locationName || '—'}</b>
        {' · '}{dateStr}
      </p>
    </div>
  );
};

/**
 * Apple-style horizontal half-circle thermometer gauge with tick marks
 * (0°, 6°, 12°, 18°, 24°, 30° by default) and a draggable knob.
 * Matches IMG_6674.
 */
export const TempGauge = ({ value, min, max, ticks, onChange, color = '#007AFF' }) => {
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const angle = -180 + pct * 180;
  const ref = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);

  const compute = React.useCallback((cx, cy) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ox = rect.left + rect.width / 2;
    const oy = rect.top + 130;
    const dx = cx - ox;
    const dy = oy - cy;
    let theta = Math.atan2(dy, dx);
    if (theta < 0) theta = 0;
    if (theta > Math.PI) theta = Math.PI;
    const newPct = 1 - theta / Math.PI;
    const newValue = Math.round((min + newPct * (max - min)) * 10) / 10;
    onChange(newValue);
  }, [min, max, onChange]);

  React.useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => compute(e.clientX, e.clientY);
    const onUp = () => setDragging(false);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, compute]);

  const onPointerDown = (e) => { e.preventDefault(); setDragging(true); compute(e.clientX, e.clientY); };

  // Tick label positions
  const tickList = ticks || [];

  return (
    <div ref={ref} style={{
      position: 'relative', width: 280, height: 160, margin: '0 auto',
      touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none',
    }} onPointerDown={onPointerDown}>
      <svg viewBox="0 0 240 130" width="280" height="160" style={{ overflow: 'visible', pointerEvents: 'none' }}>
        {/* Track */}
        <path d="M 14 120 A 106 106 0 0 1 226 120" stroke="#E8E8ED" strokeWidth="18" strokeLinecap="round" fill="none" />
        {/* Active arc */}
        <path d="M 14 120 A 106 106 0 0 1 226 120" stroke={color} strokeWidth="18" strokeLinecap="round" fill="none" strokeDasharray={`${pct * 333} 800`} />
        {/* Tick marks */}
        {Array.from({ length: 25 }).map((_, i) => {
          const a = Math.PI - (i / 24) * Math.PI;
          const r1 = 90, r2 = 80;
          const x1 = 120 + Math.cos(a) * r1, y1 = 120 - Math.sin(a) * r1;
          const x2 = 120 + Math.cos(a) * r2, y2 = 120 - Math.sin(a) * r2;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#86868B" strokeWidth="1" />;
        })}
      </svg>

      {/* Tick labels (positioned absolute) */}
      {tickList.map((t) => {
        const tickPct = (t - min) / (max - min);
        const a = Math.PI - tickPct * Math.PI;
        const r = 64;
        const left = (140 / 240) * 280 + Math.cos(a) * (r * 280 / 240) - 16;
        const top  = 120 * (160 / 130) - Math.sin(a) * (r * 160 / 130) - 8;
        const isCurrent = Math.abs(t - value) < 0.5;
        return (
          <span key={t} style={{
            position: 'absolute', left, top, width: 32, textAlign: 'center',
            fontSize: 13, fontWeight: 600, color: isCurrent ? color : '#1D1D1F',
            fontFamily: 'Outfit, sans-serif', pointerEvents: 'none',
          }}>{t}°</span>
        );
      })}

      {/* Knob */}
      <div style={{
        position: 'absolute', left: '50%', top: 130,
        width: 32, height: 32, marginLeft: -16, marginTop: -16, borderRadius: 999,
        background: color, border: '4px solid #FFFFFF',
        boxShadow: '0 2px 8px rgba(0,0,0,0.20)',
        transform: `rotate(${angle}deg) translateX(106px)`,
        transformOrigin: 'center',
        pointerEvents: 'none',
        transition: dragging ? 'none' : 'transform 0.15s ease',
      }} />
    </div>
  );
};

/** Plus / minus pill row with a wide white temp display in the middle. */
export const TempStepper = ({ value, onChange, step = 0.1, suffix = '°C' }) => {
  const setVal = (v) => onChange(Math.round(v * 10) / 10);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, margin: '8px 0 24px' }}>
      <button data-testid="temp-minus" onClick={() => setVal(value - step)} style={pillBtn}><span style={{ fontSize: 28, fontWeight: 600, color: '#1D1D1F', lineHeight: 1 }}>−</span></button>
      <div style={{
        flex: 1, maxWidth: 200, height: 64, borderRadius: 16, background: '#FFFFFF',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
      }}>
        <input
          data-testid="temp-input"
          type="number" step="0.1" inputMode="text"
          value={value}
          onChange={(e) => { const n = parseFloat(e.target.value); if (!Number.isNaN(n)) setVal(n); }}
          style={{
            width: 110, border: 0, outline: 'none', textAlign: 'right',
            fontSize: 32, fontWeight: 700, color: '#1D1D1F',
            background: 'transparent', fontFamily: 'Outfit, sans-serif',
          }}
        />
        <span style={{ fontSize: 14, fontWeight: 600, color: '#86868B' }}>{suffix}</span>
      </div>
      <button data-testid="temp-plus" onClick={() => setVal(value + step)} style={pillBtn}><span style={{ fontSize: 28, fontWeight: 600, color: '#1D1D1F', lineHeight: 1 }}>+</span></button>
    </div>
  );
};

const pillBtn = {
  width: 64, height: 64, borderRadius: 16, background: '#FFFFFF', border: 0,
  boxShadow: '0 1px 2px rgba(0,0,0,0.04)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

/** Big rounded black bottom action button. */
export const PrimaryAction = ({ children, onClick, disabled, testId }) => (
  <button
    data-testid={testId}
    onClick={onClick}
    disabled={disabled}
    style={{
      position: 'sticky', bottom: 86, left: 0, right: 0,
      width: '100%', padding: '18px 16px', borderRadius: 999, border: 0,
      background: '#1D1D1F', color: '#FFFFFF', fontSize: 17, fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
      fontFamily: 'Outfit, sans-serif',
      boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
    }}
  >{children}</button>
);
