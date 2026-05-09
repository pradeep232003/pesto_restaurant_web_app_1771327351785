import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Minus, Plus } from 'lucide-react';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';
import UnitPickerSheet, { DEFAULT_UNIT_FOR } from '../deliveries/UnitPickerSheet';

/**
 * /jkhive/in-prep-wastage/amount — IMG_6704.
 * "How much was wasted?" — big - / + stepper, Select Unit button, Save.
 */
const InPrepAmount = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { adminLocationId, locations } = useLocation2();
  const [amount, setAmount] = useState(1);
  const [unit, setUnit] = useState(DEFAULT_UNIT_FOR(state?.category) || '');
  const [unitOpen, setUnitOpen] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  if (!state?.itemName) return <Navigate to="/jkhive/in-prep-wastage/pick" replace />;

  const dec = () => setAmount(a => Math.max(0, +(Number(a) - 1).toFixed(2)));
  const inc = () => setAmount(a => +(Number(a) + 1).toFixed(2));

  const save = () => {
    if (Number(amount) <= 0) { alert('Amount must be greater than 0'); return; }
    if (!unit) { alert('Please select a unit'); return; }
    navigate('/jkhive/in-prep-wastage/comment', {
      state: { ...state, amount: Number(amount), unit },
    });
  };

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="wastage-amount">
      <WizardHeader title="How much was wasted?" locationName={locationName} dateStr={today} onBack={() => navigate(-1)} />

      <div style={{ textAlign: 'center', margin: '20px 0 12px' }}>
        <div style={{ fontSize: 96, lineHeight: 1 }}>{state.itemIcon || '🍽️'}</div>
        <p style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em', color: '#1D1D1F', margin: '12px 0 0', lineHeight: 1.05 }}>
          {state.itemName}
        </p>
        <p style={{ fontSize: 16, color: '#1D1D1F', margin: '6px 0 0' }}>
          {state.category}{state.section ? ` · ${state.section}` : ''}
        </p>
      </div>

      {/* Big stepper */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        margin: '40px 16px 14px',
      }}>
        <button data-testid="wastage-dec"
          onClick={dec}
          style={{ background: 'transparent', border: 0, color: '#1D1D1F', cursor: 'pointer', padding: 16 }}>
          <Minus size={28} strokeWidth={2} />
        </button>
        <input data-testid="wastage-amount-input"
          inputMode="decimal" type="number" step="0.01"
          value={amount} onChange={e => setAmount(e.target.value)}
          style={{
            flex: 1, textAlign: 'center', fontSize: 64, fontWeight: 700, color: '#1D1D1F',
            background: 'transparent', border: 0, borderBottom: '1px solid rgba(0,0,0,0.2)',
            outline: 'none', fontFamily: 'Outfit, sans-serif', padding: '0 8px',
            letterSpacing: '-0.02em', minWidth: 0,
          }} />
        <button data-testid="wastage-inc"
          onClick={inc}
          style={{ background: 'transparent', border: 0, color: '#1D1D1F', cursor: 'pointer', padding: 16 }}>
          <Plus size={28} strokeWidth={2} />
        </button>
      </div>

      {/* Unit selector */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32 }}>
        <button data-testid="wastage-unit-trigger"
          onClick={() => setUnitOpen(true)}
          style={{
            padding: '14px 40px', borderRadius: 12,
            border: '1px solid rgba(0,0,0,0.4)', background: 'transparent',
            color: '#1D1D1F', fontSize: 16, fontWeight: 500, cursor: 'pointer',
            fontFamily: 'Outfit, sans-serif',
          }}>
          {unit || 'Select Unit'}
        </button>
      </div>

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 64, zIndex: 5 }}>
        <button data-testid="wastage-save-btn"
          onClick={save}
          style={{
            width: '100%', padding: '20px 16px', border: 0,
            background: '#1D1D1F', color: '#FFFFFF', fontSize: 18, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
          }}>
          Save
        </button>
      </div>

      <UnitPickerSheet open={unitOpen} onClose={() => setUnitOpen(false)} onPick={setUnit} />
    </div>
  );
};

export default InPrepAmount;
