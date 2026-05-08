import React from 'react';

/**
 * IMG_6694 — Bottom-sheet unit picker grouped by Mass / Volume / Other / Gastro.
 * Renders as an overlay; calls onPick(unit) and dismisses via onClose.
 */
export const UNIT_GROUPS = [
  { name: 'Mass',    units: ['mg', 'g', 'kg', 'oz', 'lb'] },
  { name: 'Volume',  units: ['tsp', 'tbsp', 'ml', 'l', 'fl. oz', 'cup', 'pint', 'quart', 'gallon'] },
  { name: 'Other',   units: ['count', 'pack', 'box', 'tray', 'portion', 'bottle'] },
  { name: 'Gastro',  units: ['GN 1/1', 'GN 1/2', 'GN 1/4', 'GN 2/1', 'GN 1/3', 'GN 2/3', 'GN 2/4', 'GN 1/6', 'GN 1/9'] },
];

/** Map common categories → sensible default unit (2a). */
export const DEFAULT_UNIT_FOR = (category) => {
  const c = (category || '').toLowerCase();
  if (['beef', 'chicken', 'lamb', 'pork', 'turkey', 'game', 'fish (other)', 'flat fish', 'round fish', 'molluscs'].includes(c)) return 'kg';
  if (c === 'milk') return 'l';
  if (c === 'eggs') return 'count';
  if (c === 'rice and grains' || c === 'pastry') return 'kg';
  if (c === 'salad' || c === 'general') return 'kg';
  return null;
};

const UnitPickerSheet = ({ open, onClose, onPick }) => {
  if (!open) return null;
  return (
    <div data-testid="unit-picker-overlay"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        zIndex: 50, display: 'flex', alignItems: 'flex-end',
        fontFamily: 'Outfit, sans-serif',
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 600, margin: '0 auto',
          background: '#F2F2EA', borderTopLeftRadius: 28, borderTopRightRadius: 28,
          padding: '24px 18px 32px', maxHeight: '85vh', overflowY: 'auto',
        }}>
        {UNIT_GROUPS.map(g => (
          <div key={g.name} style={{ marginBottom: 22 }}>
            <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 700, color: '#1D1D1F' }}>{g.name}</div>
            <div style={{ height: 1, background: 'rgba(0,0,0,0.08)', margin: '6px 0 14px' }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
              {g.units.map(u => (
                <button key={u} data-testid={`unit-${u}`}
                  onClick={() => { onPick(u); onClose(); }}
                  style={{
                    padding: '10px 18px', minWidth: 64,
                    border: '1px solid rgba(0,0,0,0.4)', borderRadius: 12,
                    background: 'transparent', color: '#1D1D1F',
                    fontSize: 15, fontWeight: 500, cursor: 'pointer',
                    fontFamily: 'Outfit, sans-serif',
                  }}>{u}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UnitPickerSheet;
