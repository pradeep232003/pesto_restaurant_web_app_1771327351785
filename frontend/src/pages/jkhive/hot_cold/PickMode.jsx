import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';

/** /jkhive/hot-cold-holding/mode — IMG_6714. Hot or Cold? */
const PickMode = () => {
  const navigate = useNavigate();
  const { adminLocationId, locations } = useLocation2();
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="hot-cold-mode">
      <WizardHeader title="Record Hot/cold Holding" locationName={locationName} dateStr={today} backTo="/jkhive/hot-cold-holding" />

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
    </div>
  );
};

export default PickMode;
