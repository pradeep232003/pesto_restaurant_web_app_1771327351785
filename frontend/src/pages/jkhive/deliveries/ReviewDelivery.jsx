import React, { useMemo } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useLocation2 } from '../../../contexts/LocationContext';
import { categoryEmoji } from '../cooling/CoolingHome';

/**
 * /jkhive/delivery-records/review — IMG_6696.
 * Final summary screen showing supplier + every item recorded so far.
 * "Add another item" → PickItem (sub-flow skips temp via state.itemsLogged).
 * "Next" → home.
 */
const SUPPLIER_ICON = {
  general: '🧑‍💼', fishmonger: '🐟', butcher: '🥩', greengrocer: '🥬',
  bakery: '🥖', 'wine merchant': '🍷', 'alcohol supplier': '🍾', other: '🚚',
};

const formatDate = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
};

const ReviewDelivery = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { adminLocationId, locations } = useLocation2();
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  if (!state?.supplier || !Array.isArray(state?.itemsLogged) || state.itemsLogged.length === 0) {
    return <Navigate to="/jkhive/delivery-records" replace />;
  }

  const addAnother = () => {
    navigate('/jkhive/delivery-records/item', {
      state: {
        supplier: state.supplier,
        sharedTemp: state.sharedTemp,
        sharedComment: state.sharedComment,
        itemsLogged: state.itemsLogged,
      },
    });
  };

  const finish = () => navigate('/jkhive/delivery-records', { replace: true });

  return (
    <div style={{ paddingBottom: 200, padding: '0 4px', fontFamily: 'Outfit, sans-serif' }} data-testid="review-delivery">
      <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.01em', color: '#1D1D1F', margin: '16px 12px 6px' }}>
        Review Delivery
      </h1>
      <p style={{ fontSize: 12, color: '#86868B', margin: '0 12px 14px' }}>
        {locationName} · {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 12px 18px' }}>
        <div style={{ fontSize: 56, lineHeight: 1 }}>{SUPPLIER_ICON[state.supplier.type] || '🧑‍💼'}</div>
        <div>
          <p style={{ fontSize: 22, fontWeight: 800, color: '#1D1D1F', margin: 0 }}>{state.supplier.name}</p>
          <p style={{ fontSize: 13, color: '#86868B', textTransform: 'capitalize', margin: '2px 0 0' }}>{state.supplier.type}</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 8px' }}>
        {state.itemsLogged.map((it, i) => (
          <div key={i} data-testid={`review-item-${i}`}
            style={{
              background: '#FFFFFF', borderRadius: 16, padding: '14px 16px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 26 }}>{it.itemIcon || categoryEmoji(it.category)}</span>
              <span style={{ fontSize: 17, fontWeight: 800, color: '#1D1D1F' }}>{it.itemName}</span>
            </div>
            {it.stock ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, color: '#1D1D1F' }}>
                <tbody>
                  <Row label="Amount:" value={`${it.stock.amount} ${it.stock.unit}${it.stock.amount === 1 ? '' : 's'}`} />
                  {it.stock.price != null && <Row label="Price:" value={`£${Number(it.stock.price).toFixed(2)}`} />}
                  {it.stock.useBy && <Row label="Use by:" value={formatDate(it.stock.useBy)} />}
                  {it.stock.batchNo && <Row label="Batch No." value={it.stock.batchNo} />}
                  <Row label="Temp:" value={`${Number(it.tempC).toFixed(1)}°C`} />
                </tbody>
              </table>
            ) : (
              <p style={{ fontSize: 13, color: '#86868B', margin: 0 }}>
                Logged at <b style={{ color: '#1D1D1F' }}>{Number(it.tempC).toFixed(1)}°C</b> · not added to inventory.
              </p>
            )}
          </div>
        ))}
      </div>

      <div style={{ position: 'fixed', left: 16, right: 16, bottom: 96, maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10, zIndex: 5 }}>
        <button data-testid="review-add-another"
          onClick={addAnother}
          style={{
            width: '100%', padding: '16px', borderRadius: 14, border: '1px solid rgba(0,0,0,0.18)',
            background: 'transparent', color: '#1D1D1F', fontSize: 16, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
          }}>
          Add another item
        </button>
        <button data-testid="review-next-btn"
          onClick={finish}
          style={{
            width: '100%', padding: '16px', borderRadius: 14, border: 0,
            background: '#1D1D1F', color: '#FFFFFF', fontSize: 17, fontWeight: 600,
            cursor: 'pointer', boxShadow: '0 6px 18px rgba(0,0,0,0.18)', fontFamily: 'Outfit, sans-serif',
          }}>
          Next
        </button>
      </div>
    </div>
  );
};

const Row = ({ label, value }) => (
  <tr>
    <td style={{ padding: '2px 0', color: '#1D1D1F' }}>{label}</td>
    <td style={{ padding: '2px 0', textAlign: 'right', color: '#1D1D1F', fontWeight: 500 }}>{value}</td>
  </tr>
);

export default ReviewDelivery;
