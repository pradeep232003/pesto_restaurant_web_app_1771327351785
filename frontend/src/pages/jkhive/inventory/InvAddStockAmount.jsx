import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';
import UnitPickerSheet, { DEFAULT_UNIT_FOR } from '../deliveries/UnitPickerSheet';
import { Stepper } from '../deliveries/AddStockAmount';
import { categoryEmoji } from '../cooling/CoolingHome';

/**
 * /jkhive/inventory/add/amount — step 1 of inventory stock-take wizard.
 * Lean variant of Delivery's AddStockAmount: no supplier, no delivery_id.
 */
const InvAddStockAmount = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { adminLocationId, locations } = useLocation2();

  const initialUnit = state?.draftStock?.unit ?? DEFAULT_UNIT_FOR(state?.category) ?? '';
  const [unit, setUnit] = useState(initialUnit);
  const [amount, setAmount] = useState(state?.draftStock?.amount ?? '');
  const [price, setPrice] = useState(state?.draftStock?.price ?? '');
  const [unitOpen, setUnitOpen] = useState(false);
  const [touched, setTouched] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  if (!state?.itemName) return <Navigate to="/jkhive/inventory/pick" replace />;

  const unitErr = !unit;
  const amountErr = !amount || Number(amount) <= 0;

  const next = () => {
    setTouched(true);
    if (unitErr || amountErr) return;
    navigate('/jkhive/inventory/add/batch', {
      state: {
        ...state,
        draftStock: { unit, amount: Number(amount), price: price === '' ? null : Number(price) },
      },
    });
  };

  return (
    <div style={{ paddingBottom: 130, fontFamily: 'Outfit, sans-serif' }} data-testid="inv-add-stock-amount">
      <WizardHeader title="Add Stock" locationName={locationName} dateStr={today} onBack={() => navigate(-1)} />

      <div style={{ textAlign: 'center', margin: '4px 0 20px' }}>
        <div style={{ fontSize: 96, lineHeight: 1 }}>{state.itemIcon || categoryEmoji(state.category)}</div>
        <p style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.01em', color: '#1D1D1F', margin: '8px 0 0' }}>{state.itemName}</p>
      </div>

      <Stepper step={1} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', columnGap: 14, rowGap: 20, alignItems: 'center', marginTop: 24 }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: '#1D1D1F' }}>Unit:</span>
        <button data-testid="inv-unit-trigger"
          onClick={() => setUnitOpen(true)}
          style={{
            width: '100%', padding: '14px 16px', fontSize: 16,
            border: `1px solid ${touched && unitErr ? '#A41B1B' : 'rgba(0,0,0,0.18)'}`,
            borderRadius: 12, background: '#FFFFFF',
            color: unit ? '#1D1D1F' : '#86868B',
            textAlign: 'left', cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
          }}>
          {unit || 'Select unit'}
        </button>
        <span />
        <span style={{ fontSize: 12, color: '#A41B1B', marginTop: -14, height: touched && unitErr ? 'auto' : 0, overflow: 'hidden' }}>
          {touched && unitErr ? 'Please select a unit' : ''}
        </span>

        <span style={{ fontSize: 18, fontWeight: 600, color: '#1D1D1F' }}>Amount:</span>
        <input data-testid="inv-amount-input"
          inputMode="decimal" type="number" step="0.01"
          value={amount} onChange={e => setAmount(e.target.value)}
          placeholder="Enter amount"
          style={{
            width: '100%', padding: '14px 16px', fontSize: 16,
            border: `1px solid ${touched && amountErr ? '#A41B1B' : 'rgba(0,0,0,0.18)'}`,
            borderRadius: 12, background: '#FFFFFF', color: '#1D1D1F',
            outline: 'none', fontFamily: 'Outfit, sans-serif',
          }} />
        <span />
        <span style={{ fontSize: 12, color: '#A41B1B', marginTop: -14, height: touched && amountErr ? 'auto' : 0, overflow: 'hidden' }}>
          {touched && amountErr ? 'Enter an amount' : ''}
        </span>

        <span style={{ fontSize: 18, fontWeight: 600, color: '#1D1D1F' }}>
          Price per unit:<br/><span style={{ fontSize: 13, fontWeight: 400, color: '#86868B', fontStyle: 'italic' }}>(optional)</span>
        </span>
        <input data-testid="inv-price-input"
          inputMode="decimal" type="number" step="0.01"
          value={price} onChange={e => setPrice(e.target.value)}
          placeholder="Enter price"
          style={{
            width: '100%', padding: '14px 16px', fontSize: 16,
            border: '1px solid rgba(0,0,0,0.18)', borderRadius: 12,
            background: '#FFFFFF', color: '#1D1D1F', outline: 'none',
            fontFamily: 'Outfit, sans-serif',
          }} />
      </div>

      <div style={{ position: 'fixed', right: 16, bottom: 96, zIndex: 5 }}>
        <button data-testid="inv-amount-continue-btn" onClick={next}
          style={{
            padding: '14px 36px', borderRadius: 14, border: 0,
            background: '#1D1D1F', color: '#FFFFFF',
            fontSize: 16, fontWeight: 700, letterSpacing: '0.04em', cursor: 'pointer',
            fontFamily: 'Outfit, sans-serif', boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
          }}>
          CONTINUE
        </button>
      </div>

      <UnitPickerSheet open={unitOpen} onClose={() => setUnitOpen(false)} onPick={setUnit} />
    </div>
  );
};

export default InvAddStockAmount;
