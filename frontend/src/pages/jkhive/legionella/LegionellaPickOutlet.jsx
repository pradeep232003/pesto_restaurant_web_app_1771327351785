import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Droplet } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';

/**
 * /jkhive/legionella/outlet — choose an outlet to test.
 *
 * No dedicated outlet registry yet — we surface the most-recent unique outlet
 * names from this location's past tests as quick-pick chips, so a weekly run
 * is just a couple of taps. Free-text input below for new outlets.
 */
const LegionellaPickOutlet = () => {
  const navigate = useNavigate();
  const { adminLocationId, locations } = useLocation2();
  const [recent, setRecent] = useState([]);
  const [name, setName] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  useEffect(() => {
    if (!adminLocationId) return;
    api.legionellaList(adminLocationId).then(rows => {
      const seen = new Set();
      const out = [];
      (rows || []).forEach(r => {
        const n = (r.location_of_test || '').trim();
        if (n && !seen.has(n.toLowerCase())) { seen.add(n.toLowerCase()); out.push(n); }
      });
      setRecent(out.slice(0, 8));
    });
  }, [adminLocationId]);

  const choose = (val) => {
    const n = val.trim();
    if (!n) return;
    navigate('/jkhive/legionella/hot', { state: { outlet: n } });
  };

  return (
    <div style={{ paddingBottom: 130, fontFamily: 'Outfit, sans-serif' }} data-testid="legionella-pick">
      <WizardHeader title="Legionella" locationName={locationName} dateStr={today} backTo="/jkhive/legionella" />

      <h2 style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.01em', color: '#1D1D1F', margin: '12px 0 18px' }}>
        Which water outlet?
      </h2>

      {recent.length > 0 && (
        <>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 10px' }}>
            Recent
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
            {recent.map((n) => (
              <button key={n} data-testid={`legionella-recent-${n}`}
                onClick={() => choose(n)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '10px 14px', borderRadius: 999,
                  background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)',
                  fontSize: 14, fontWeight: 600, color: '#1D1D1F',
                  cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
                }}>
                <Droplet size={14} color="#30B0C7" strokeWidth={2.4} /> {n}
              </button>
            ))}
          </div>
        </>
      )}

      <label style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F', marginBottom: 6, display: 'block' }}>Or enter a new outlet</label>
      <input data-testid="legionella-outlet-input"
        autoFocus value={name} onChange={e => setName(e.target.value.slice(0, 80))}
        placeholder="e.g. Kitchen hot tap, mop sink, hand basin"
        onKeyDown={(e) => { if (e.key === 'Enter') choose(name); }}
        style={{
          width: '100%', padding: '14px 16px', fontSize: 16,
          border: '1px solid rgba(0,0,0,0.1)', borderRadius: 14,
          background: '#FFFFFF', color: '#1D1D1F', outline: 'none',
          fontFamily: 'Outfit, sans-serif',
        }} />

      <div style={{ position: 'fixed', left: 16, right: 16, bottom: 84, zIndex: 5 }}>
        <button data-testid="legionella-outlet-next" onClick={() => choose(name)}
          disabled={!name.trim()}
          style={{
            width: '100%', padding: '18px 16px', border: 0, borderRadius: 999,
            background: '#1D1D1F', color: '#fff', fontSize: 17, fontWeight: 600,
            cursor: name.trim() ? 'pointer' : 'not-allowed',
            opacity: name.trim() ? 1 : 0.5,
            fontFamily: 'Outfit, sans-serif',
            boxShadow: '0 8px 22px rgba(0,0,0,0.25)',
          }}>Next</button>
      </div>
    </div>
  );
};

export default LegionellaPickOutlet;
