import React, { useMemo } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';

/** /jkhive/food-washing/chemical — IMG_6733. Chooser between Chlorine / Acid Wash. */
const WashingChemical = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { adminLocationId, locations } = useLocation2();
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  if (!state?.item_name) return <Navigate to="/jkhive/food-washing/pick" replace />;

  const Card = ({ id, title, sub }) => (
    <button data-testid={`washing-chemical-${id}`}
      onClick={() => navigate('/jkhive/food-washing/strength', { state: { ...state, sanitiser: id } })}
      style={{
        flex: 1, height: 220, borderRadius: 18, background: '#FFFFFF',
        border: '2.5px solid #1D1D1F', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-end',
        padding: 22, gap: 4,
        fontFamily: 'Outfit, sans-serif',
      }}>
      <span style={{ fontSize: 22, fontWeight: 600, color: '#1D1D1F', textAlign: 'left', lineHeight: 1.15 }}>{title}</span>
      <span style={{ fontSize: 18, fontWeight: 500, color: '#1D1D1F' }}>{sub}</span>
    </button>
  );

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="washing-chemical">
      <WizardHeader title="Chemical Food Washing" locationName={locationName} dateStr={today} onBack={() => navigate(-1)} />

      <h2 style={{
        fontSize: 38, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.02em',
        color: '#1D1D1F', margin: '32px 0 60px',
      }}>
        What kind of chemical are you using?
      </h2>

      <div style={{ display: 'flex', gap: 14 }}>
        <Card id="chlorine" title="Chlorine" sub="(ppm)" />
        <Card id="acid" title="Acid Wash" sub="(pH)" />
      </div>
    </div>
  );
};

export default WashingChemical;
