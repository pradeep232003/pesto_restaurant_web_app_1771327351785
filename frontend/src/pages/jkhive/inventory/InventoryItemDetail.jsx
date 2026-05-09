import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Trash2, Plus } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';
import { categoryEmoji } from '../cooling/CoolingHome';

/**
 * /jkhive/inventory/item/:id — show all batches FIFO; allow per-batch delete.
 * "Add stock" routes back through the picker pre-selected to this item.
 */
const formatDate = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
};

const InventoryItemDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { adminLocationId, locations } = useLocation2();
  const [item, setItem] = useState(null);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  const load = async () => {
    if (!adminLocationId) return;
    setLoading(true);
    try {
      const [inv, bat] = await Promise.all([
        api.inventoryList(adminLocationId),
        api.inventoryBatches(adminLocationId, { item_id: id, limit: 200 }),
      ]);
      setItem((inv || []).find(i => i.id === id));
      setBatches(bat || []);
    } catch (err) {
      alert('Failed to load: ' + err.message);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [adminLocationId, id]); // eslint-disable-line

  const removeBatch = async (b) => {
    if (!window.confirm(`Remove batch of ${b.amount} ${b.unit}?\n\nThis will decrement the rolling stock total.`)) return;
    try {
      await api.inventoryBatchDelete(b.id);
      load();
    } catch (err) { alert('Failed to delete: ' + err.message); }
  };

  if (!adminLocationId) {
    return (
      <div style={{ padding: 24, fontFamily: 'Outfit, sans-serif' }}>
        <WizardHeader title="Item" locationName="—" dateStr={today} backTo="/jkhive/inventory" />
        <p style={{ color: '#FF9500' }}>Pick a location from JKHive home first.</p>
      </div>
    );
  }

  if (loading || !item) {
    return (
      <div style={{ padding: 24, fontFamily: 'Outfit, sans-serif' }}>
        <WizardHeader title="Item" locationName={locationName} dateStr={today} backTo="/jkhive/inventory" />
        <p style={{ color: '#86868B', textAlign: 'center', marginTop: 40 }}>{loading ? 'Loading…' : 'Item not found.'}</p>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 130, fontFamily: 'Outfit, sans-serif' }} data-testid="inventory-item-detail">
      <WizardHeader title="Stock detail" locationName={locationName} dateStr={today} backTo="/jkhive/inventory" />

      <div style={{ background: '#FFFFFF', borderRadius: 20, padding: '20px 18px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', marginBottom: 14 }}>
        <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 6 }}>{item.item_icon || categoryEmoji(item.item_category)}</div>
        <p style={{ fontSize: 22, fontWeight: 800, color: '#1D1D1F', margin: 0 }}>{item.item_name}</p>
        <p style={{ fontSize: 32, fontWeight: 800, color: '#1D1D1F', margin: '8px 0 0', letterSpacing: '-0.02em' }}>
          {Number(item.current_amount).toFixed(item.unit === 'count' ? 0 : 2)} <span style={{ fontSize: 18, fontWeight: 500, color: '#86868B' }}>{item.unit}</span>
        </p>
        <p style={{ fontSize: 12, color: '#86868B', margin: '4px 0 0' }}>across {batches.length} batch{batches.length === 1 ? '' : 'es'}</p>
      </div>

      <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#86868B', margin: '6px 4px 8px' }}>
        Batches · FIFO (use earliest first)
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {batches.map(b => (
          <div key={b.id} data-testid={`inv-batch-${b.id}`}
            style={{
              display: 'flex', alignItems: 'stretch', background: '#FFFFFF', borderRadius: 14,
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)', overflow: 'hidden',
            }}>
            <div style={{ flex: 1, padding: '12px 14px', minWidth: 0 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#1D1D1F', margin: 0 }}>
                {Number(b.amount).toFixed(b.unit === 'count' ? 0 : 2)} {b.unit}
                {b.price_per_unit != null ? ` · £${Number(b.price_per_unit).toFixed(2)}/${b.unit}` : ''}
              </p>
              <p style={{ fontSize: 11, color: '#86868B', margin: '2px 0 0' }}>
                {b.batch_no ? `Batch ${b.batch_no} · ` : ''}
                {b.use_by ? `Use by ${formatDate(b.use_by)}` : 'No use-by'}
                {b.supplier_name ? ` · ${b.supplier_name}` : ''}
              </p>
            </div>
            <button data-testid={`inv-batch-delete-${b.id}`}
              onClick={() => removeBatch(b)}
              aria-label="Remove batch"
              style={{
                width: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', border: 0, borderLeft: '1px solid rgba(0,0,0,0.06)',
                cursor: 'pointer', color: '#FF3B30',
              }}>
              <Trash2 size={16} strokeWidth={2.2} />
            </button>
          </div>
        ))}
      </div>

      <button data-testid="inv-detail-add-stock"
        onClick={() => navigate('/jkhive/inventory/add/amount', {
          state: { itemName: item.item_name, category: item.item_category, itemIcon: item.item_icon },
        })}
        style={{
          position: 'fixed', left: 16, right: 16, bottom: 96, maxWidth: 600, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '16px', borderRadius: 999, border: 0,
          background: '#1D1D1F', color: '#FFFFFF', fontSize: 17, fontWeight: 600,
          cursor: 'pointer', boxShadow: '0 6px 18px rgba(0,0,0,0.18)', fontFamily: 'Outfit, sans-serif',
        }}>
        <Plus size={20} strokeWidth={2.6} /> Add more stock
      </button>
    </div>
  );
};

export default InventoryItemDetail;
