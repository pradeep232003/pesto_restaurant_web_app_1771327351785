import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';

/**
 * /jkhive/delivery-records/inventory-prompt — IMG_6692.
 * "Delivery recorded! Would you like to add this item to inventory?"
 *
 * On mount: if state.autoSaveRecord, persist the delivery record (using the
 * shared temp/comment for subsequent items in the same delivery cycle).
 * Skip → go to ReviewDelivery (this item, no stock).
 * Add  → go to AddStockAmount.
 */
const AskAddInventory = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { adminLocationId, locations } = useLocation2();
  const [savedItem, setSavedItem] = useState(null);
  const [error, setError] = useState('');
  const saved = useRef(false);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  useEffect(() => {
    if (saved.current) return;
    saved.current = true;
    if (!state?.autoSaveRecord) {
      // Caller already saved (legacy) — no-op.
      setSavedItem({
        itemName: state?.itemName, category: state?.category, itemIcon: state?.itemIcon,
        deliveryRecordId: state?.deliveryRecordId,
      });
      return;
    }
    // Persist the delivery record now.
    api.deliveriesRecord({
      location_id: adminLocationId,
      supplier_id: state.supplier.id,
      item_name: state.itemName,
      item_category: state.category,
      temp_c: state.sharedTemp,
      comment: state.sharedComment || '',
    }).then(rec => {
      setSavedItem({
        itemName: state.itemName, category: state.category, itemIcon: state.itemIcon,
        deliveryRecordId: rec.id,
      });
    }).catch(err => {
      setError('Submit failed: ' + err.message);
      saved.current = false;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!state?.itemName || !state?.supplier || state?.sharedTemp == null) {
    return <Navigate to="/jkhive/delivery-records/supplier" replace />;
  }

  const skip = () => {
    const newItem = {
      itemName: state.itemName,
      category: state.category,
      itemIcon: state.itemIcon,
      tempC: state.sharedTemp,
      comment: state.sharedComment || '',
      deliveryRecordId: savedItem?.deliveryRecordId,
      stock: null,
    };
    navigate('/jkhive/delivery-records/review', {
      state: {
        supplier: state.supplier,
        sharedTemp: state.sharedTemp,
        sharedComment: state.sharedComment,
        itemsLogged: [...(state.itemsLogged || []), newItem],
      },
    });
  };

  const addStock = () => {
    navigate('/jkhive/delivery-records/add-stock/amount', {
      state: {
        ...state,
        deliveryRecordId: savedItem?.deliveryRecordId,
      },
    });
  };

  return (
    <div style={{ paddingBottom: 200, fontFamily: 'Outfit, sans-serif' }} data-testid="ask-add-inventory">
      <WizardHeader title="Record New Delivery" locationName={locationName} dateStr={today} onBack={() => navigate(-1)} />

      <div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0 28px' }}>
        <div style={{ fontSize: 120, lineHeight: 1 }}>🎉</div>
      </div>

      <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.01em', color: '#1D1D1F', margin: '0 18px 0', lineHeight: 1.2 }}>
        Delivery recorded!<br/>Would you like to add this item to <b>inventory?</b>
      </h2>

      {error && <p style={{ marginTop: 16, color: '#FF3B30', textAlign: 'center' }}>{error}</p>}
      {!error && !savedItem && <p style={{ marginTop: 16, color: '#86868B', textAlign: 'center' }}>Saving record…</p>}

      <div style={{ position: 'fixed', left: 16, right: 16, bottom: 96, maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10, zIndex: 5 }}>
        <button data-testid="inv-skip-btn" onClick={skip} disabled={!savedItem}
          style={{
            width: '100%', padding: '16px 16px', borderRadius: 14, border: '1px solid rgba(0,0,0,0.18)',
            background: 'transparent', color: '#1D1D1F', fontSize: 16, fontWeight: 500,
            cursor: savedItem ? 'pointer' : 'not-allowed', opacity: savedItem ? 1 : 0.5,
            fontFamily: 'Outfit, sans-serif',
          }}>Skip</button>
        <button data-testid="inv-add-btn" onClick={addStock} disabled={!savedItem}
          style={{
            width: '100%', padding: '16px 16px', borderRadius: 14, border: 0,
            background: '#1D1D1F', color: '#FFFFFF', fontSize: 17, fontWeight: 600,
            cursor: savedItem ? 'pointer' : 'not-allowed', opacity: savedItem ? 1 : 0.5,
            boxShadow: '0 6px 18px rgba(0,0,0,0.18)', fontFamily: 'Outfit, sans-serif',
          }}>Add</button>
      </div>
    </div>
  );
};

export default AskAddInventory;
