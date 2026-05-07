import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Snowflake, ListChecks } from 'lucide-react';
import { Tile } from './Tile';

const OpeningRoutine = () => {
  const navigate = useNavigate();
  return (
    <div style={{ paddingBottom: 24, fontFamily: 'Outfit, sans-serif' }} data-testid="jkhive-opening-routine">
      <Link to="/jkhive/routines" data-testid="back-to-routines"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#1D1D1F', textDecoration: 'none', marginBottom: 6 }}>
        <ArrowLeft size={20} strokeWidth={2.4} style={{ color: '#007AFF' }} />
        <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>Opening Routine</span>
      </Link>
      <p style={{ fontSize: 13, color: '#86868B', margin: '4px 0 16px' }}>
        Complete both before service begins.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Tile testId="tile-opening-fridge-temp" to="/jkhive/opening/fridge-temp"
              icon={Snowflake} color="#007AFF" title="Fridge / Freezer Temp"
              subtitle="Record opening temps" />
        <Tile testId="tile-opening-checklist" to="/jkhive/daily-checks"
              icon={ListChecks} color="#FF9500" title="Opening Checklist"
              subtitle="Pre-service checks" />
      </div>
    </div>
  );
};

export default OpeningRoutine;
