import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Snowflake, ListChecks } from 'lucide-react';
import { Tile } from './Tile';

const ClosingRoutine = () => {
  return (
    <div style={{ paddingBottom: 24, fontFamily: 'Outfit, sans-serif' }} data-testid="jkhive-closing-routine">
      <Link to="/jkhive/routines" data-testid="back-to-routines"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#1D1D1F', textDecoration: 'none', marginBottom: 6 }}>
        <ArrowLeft size={20} strokeWidth={2.4} style={{ color: '#007AFF' }} />
        <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>Closing Routine</span>
      </Link>
      <p style={{ fontSize: 13, color: '#86868B', margin: '4px 0 16px' }}>
        Complete at the end of every service.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Tile testId="tile-closing-fridge-temp" to="/jkhive/closing/fridge-temp"
              icon={Snowflake} color="#5856D6" title="Fridge / Freezer Temp"
              subtitle="Record closing temps" />
        <Tile testId="tile-closing-checklist" to="/jkhive/kitchen-closedown"
              icon={ListChecks} color="#FF3B30" title="Closing Checklist"
              subtitle="End-of-day checks" />
      </div>
    </div>
  );
};

export default ClosingRoutine;
