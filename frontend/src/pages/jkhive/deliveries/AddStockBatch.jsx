import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';
import { Stepper } from './AddStockAmount';
import { categoryEmoji } from '../cooling/CoolingHome';

/**
 * /jkhive/delivery-records/add-stock/batch — IMG_6695.
 * Step 2 of 2 — Batch No. (optional), Use-by date (optional). BACK / CONTINUE.
 * On CONTINUE: persists the inventory batch and routes to ReviewDelivery.
 */
const AddStockBatch = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { adminLocationId, locations } = useLocation2();
  const [batchNo, setBatchNo] = useState(state?.draftStock?.batchNo || '');
  const [useBy, setUseBy] = useState(state?.draftStock?.useBy || '');
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  if (!state?.itemName || !state?.supplier || !state?.draftStock?.unit) {
    return <Navigate to="/jkhive/delivery-records/supplier" replace />;
  }

  const submit = async () => {
    setSaving(true);
    try {
      const res = await api.inventoryAddStock({
        location_id: adminLocationId,
        item_name: state.itemName,
        item_category: state.category,
        item_icon: state.itemIcon,
        unit: state.draftStock.unit,
        amount: state.draftStock.amount,
        price_per_unit: state.draftStock.price,
        batch_no: batchNo,
        use_by: useBy,
        supplier_id: state.supplier.id,
        supplier_name: state.supplier.name,
        delivery_id: state.deliveryRecordId || '',
      });
      const newItem = {
        itemName: state.itemName,
        category: state.category,
        itemIcon: state.itemIcon,
        tempC: state.sharedTemp,
        comment: state.sharedComment || '',
        deliveryRecordId: state.deliveryRecordId,
        stock: {
          unit: state.draftStock.unit,
          amount: state.draftStock.amount,
          price: state.draftStock.price,
          batchNo,
          useBy,
          batchId: res?.batch?.id,
        },
      };
      navigate('/jkhive/delivery-records/review', {
        state: {
          supplier: state.supplier,
          sharedTemp: state.sharedTemp,
          sharedComment: state.sharedComment,
          itemsLogged: [...(state.itemsLogged || []), newItem],
        },
      });
    } catch (err) {
      alert('Could not save: ' + err.message);
    } finally { setSaving(false); }
  };

  return (
    <div style={{ paddingBottom: 130, fontFamily: 'Outfit, sans-serif' }} data-testid="add-stock-batch">
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
        <input data-testid="batch-no-input"
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
        <input data-testid="use-by-input"
          type="date" value={useBy} onChange={e => setUseBy(e.target.value)}
          placeholder="Select date"
          style={{
            width: '100%', padding: '14px 16px', fontSize: 16,
            border: '1px solid rgba(0,0,0,0.18)', borderRadius: 12,
            background: '#FFFFFF', color: useBy ? '#1D1D1F' : '#86868B', outline: 'none',
            fontFamily: 'Outfit, sans-serif',
          }} />
      </div>

      <div style={{ position: 'fixed', right: 16, bottom: 96, display: 'flex', alignItems: 'center', gap: 18, zIndex: 5 }}>
        <button data-testid="batch-back-btn"
          onClick={() => navigate(-1)}
          style={{
            background: 'transparent', border: 0, color: '#86868B',
            fontSize: 15, fontWeight: 600, letterSpacing: '0.05em', cursor: 'pointer',
            fontFamily: 'Outfit, sans-serif',
          }}>
          BACK
        </button>
        <button data-testid="batch-continue-btn"
          onClick={submit} disabled={saving}
          style={{
            padding: '14px 36px', borderRadius: 14, border: 0,
            background: '#1D1D1F', color: '#FFFFFF',
            fontSize: 16, fontWeight: 700, letterSpacing: '0.04em',
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
            fontFamily: 'Outfit, sans-serif', boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
          }}>
          {saving ? 'Saving…' : 'CONTINUE'}
        </button>
      </div>
    </div>
  );
};

export default AddStockBatch;
