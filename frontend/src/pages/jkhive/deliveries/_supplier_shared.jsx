import React from 'react';

/** Reusable sites multiselect with a Global toggle. Used in Add/Edit Supplier. */
export const SitesPicker = ({ locations, sites, onChange }) => {
  const isGlobal = (sites || []).length === 0;
  const toggle = (id) => {
    const next = sites.includes(id) ? sites.filter(s => s !== id) : [...sites, id];
    onChange(next);
  };
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F', marginBottom: 6, display: 'block' }}>
        Available at
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button type="button" data-testid="sites-global"
          onClick={() => onChange([])}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px', borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: 'pointer',
            background: isGlobal ? '#1D1D1F' : '#FFFFFF',
            color: isGlobal ? '#FFFFFF' : '#1D1D1F',
            border: '1px solid rgba(0,0,0,0.1)', textAlign: 'left',
            fontFamily: 'Outfit, sans-serif',
          }}>
          <span>🌐 All locations (global)</span>
          {isGlobal && <span>✓</span>}
        </button>
        {!isGlobal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 2px' }}>
            <p style={{ fontSize: 12, color: '#86868B', margin: '4px 0' }}>
              Or pick specific sites:
            </p>
          </div>
        )}
        {(locations || []).map(l => {
          const sel = sites.includes(l.id);
          return (
            <button key={l.id} type="button" data-testid={`sites-${l.id}`}
              onClick={() => toggle(l.id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: 'pointer',
                background: sel ? 'rgba(0,122,255,0.08)' : '#FFFFFF',
                color: '#1D1D1F',
                border: `1px solid ${sel ? '#0A84C9' : 'rgba(0,0,0,0.1)'}`,
                textAlign: 'left', fontFamily: 'Outfit, sans-serif',
              }}>
              <span>{l.name}</span>
              {sel && <span style={{ color: '#0A84C9', fontWeight: 700 }}>✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};
