import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';
import { Stepper } from '../deliveries/AddStockAmount';
import { categoryEmoji } from '../cooling/CoolingHome';

/**
 * /jkhive/inventory/add/batch — step 2: optional batch + use-by, then save.
 * Shows green confirmation, with options to "Add another item" (back to picker)
 * or "Done" (back to inventory home).
 */
const InvAddStockBatch = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { adminLocationId, locations } = useLocation2();
  const [batchNo, setBatchNo] = useState('');
  const [useBy, setUseBy] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  if (!state?.itemName || !state?.draftStock?.unit) {
    return <Navigate to="/jkhive/inventory/pick" replace />;
  }

  const submit = async () => {
    setSaving(true);
    try {
      await api.inventoryAddStock({
        location_id: adminLocationId,
        item_name: state.itemName,
        item_category: state.category,
        item_icon: state.itemIcon,
        unit: state.draftStock.unit,
        amount: state.draftStock.amount,
        price_per_unit: state.draftStock.price,
        batch_no: batchNo,
        use_by: useBy,
      });
      setDone(true);
    } catch (err) {
      alert('Could not save: ' + err.message);
    } finally { setSaving(false); }
  };

  if (done) {
    return (
      <div style={{ padding: '24px 12px', fontFamily: 'Outfit, sans-serif' }} data-testid="inv-add-done">
        <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '36px 22px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', marginTop: 80 }}>
          <div style={{ width: 72, height: 72, borderRadius: 999, background: '#34C759', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Check size={36} strokeWidth={2.6} color="#fff" />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#1D1D1F', margin: '0 0 6px' }}>Stock added!</h2>
          <p style={{ fontSize: 14, color: '#3A3A3C', margin: '0 0 18px' }}>
            {state.draftStock.amount} {state.draftStock.unit} of {state.itemName} added to {locationName}.
          </p>
          <button data-testid="inv-add-another"
            onClick={() => navigate('/jkhive/inventory/pick', { replace: true })}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 999, border: '1px solid rgba(0,0,0,0.18)',
              background: 'transparent', color: '#1D1D1F', fontSize: 16, fontWeight: 600, cursor: 'pointer',
              marginBottom: 8,
            }}>Add another item</button>
          <button data-testid="inv-add-finish"
            onClick={() => navigate('/jkhive/inventory', { replace: true })}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 999, border: 0,
              background: '#1D1D1F', color: '#FFFFFF', fontSize: 16, fontWeight: 600, cursor: 'pointer',
            }}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 130, fontFamily: 'Outfit, sans-serif' }} data-testid="inv-add-stock-batch">
      <WizardHeader title="Add Stock" locationName={locationName} dateStr={today} onBack={() => navigate(-1)} />

      <div style={{ textAlign: 'center', margin: '4px 0 20px' }}>
        <div style={{ fontSize: 96, lineHeight: 1 }}>{state.itemIcon || categoryEmoji(state.category)}</div>
        <p style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.01em', color: '#1D1D1F', margin: '8px 0 0' }}>{state.itemName}</p>
      </div>

      <Stepper step={2} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', columnGap: 14, rowGap: 20, alignItems: 'center', marginTop: 28 }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: '#1D1D1F' }}>
          Batch No.<br/><span style={{ fontSize: 13, fontWeight: 400, color: '#86868B', fontStyle: 'italic' }}>(optional)</span>
        </span>
        <input data-testid="inv-batch-no-input"
          value={batchNo} onChange={e => setBatchNo(e.target.value)}
          placeholder="Batch No."
          style={{
            width: '100%', padding: '14px 16px', fontSize: 16,
            border: '1px solid rgba(0,0,0,0.18)', borderRadius: 12,
            background: '#FFFFFF', color: '#1D1D1F', outline: 'none',
            fontFamily: 'Outfit, sans-serif',
          }} />

        <span style={{ fontSize: 18, fontWeight: 600, color: '#1D1D1F' }}>
          Use by date:<br/><span style={{ fontSize: 13, fontWeight: 400, color: '#86868B', fontStyle: 'italic' }}>(optional)</span>
        </span>
        <input data-testid="inv-use-by-input"
          type="date" value={useBy} onChange={e => setUseBy(e.target.value)}
          style={{
            width: '100%', padding: '14px 16px', fontSize: 16,
            border: '1px solid rgba(0,0,0,0.18)', borderRadius: 12,
            background: '#FFFFFF', color: useBy ? '#1D1D1F' : '#86868B', outline: 'none',
            fontFamily: 'Outfit, sans-serif',
          }} />
      </div>

      <div style={{ position: 'fixed', right: 16, bottom: 96, display: 'flex', alignItems: 'center', gap: 18, zIndex: 5 }}>
        <button data-testid="inv-batch-back-btn"
          onClick={() => navigate(-1)}
          style={{
            background: 'transparent', border: 0, color: '#86868B',
            fontSize: 15, fontWeight: 600, letterSpacing: '0.05em', cursor: 'pointer',
            fontFamily: 'Outfit, sans-serif',
          }}>
          BACK
        </button>
        <button data-testid="inv-batch-save-btn"
          onClick={submit} disabled={saving}
          style={{
            padding: '14px 36px', borderRadius: 14, border: 0,
            background: '#1D1D1F', color: '#FFFFFF',
            fontSize: 16, fontWeight: 700, letterSpacing: '0.04em',
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
            fontFamily: 'Outfit, sans-serif', boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
          }}>
          {saving ? 'Saving…' : 'SAVE'}
        </button>
      </div>
    </div>
  );
};

export default InvAddStockBatch;
