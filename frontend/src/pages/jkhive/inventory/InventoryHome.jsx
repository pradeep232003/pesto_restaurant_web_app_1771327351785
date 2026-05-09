import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Package, AlertCircle } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';
import { categoryEmoji } from '../cooling/CoolingHome';

/**
 * /jkhive/inventory — landing screen.
 * Lists items currently in stock for this location, with current_amount + unit.
 * "+ Add Stock" routes through the shared PickItem in inventory mode.
 */
const formatDate = (iso) => {
  if (!iso) return null;
  try {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  } catch { return iso; }
};

const InventoryHome = () => {
  const navigate = useNavigate();
  const { adminLocationId, locations } = useLocation2();
  const [items, setItems] = useState([]);
  const [batchesByItem, setBatchesByItem] = useState({});
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  const load = async () => {
    if (!adminLocationId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [inv, bat] = await Promise.all([
        api.inventoryList(adminLocationId),
        api.inventoryBatches(adminLocationId, { limit: 500 }),
      ]);
      const byItem = {};
      (bat || []).forEach(b => {
        if (!byItem[b.item_id]) byItem[b.item_id] = [];
        byItem[b.item_id].push(b);
      });
      setItems(inv || []);
      setBatchesByItem(byItem);
    } catch (err) {
      alert('Failed to load: ' + err.message);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [adminLocationId]); // eslint-disable-line

  // Earliest use_by per item is FIFO-driven from the (already use_by ASC sorted) batches list.
  const itemMeta = (it) => {
    const bs = batchesByItem[it.id] || [];
    const earliest = bs.find(b => b.use_by);
    let urgency = null;
    if (earliest?.use_by) {
      const days = Math.floor((new Date(earliest.use_by + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);
      if (days < 0) urgency = 'expired';
      else if (days <= 2) urgency = 'soon';
    }
    return { earliest: earliest?.use_by, urgency, batchCount: bs.length };
  };

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="inventory-home">
      <WizardHeader title="Inventory" locationName={locationName} dateStr={today} backTo="/jkhive" />

      {!adminLocationId && (
        <p style={{ color: '#FF9500', padding: 18 }}>Please pick a location from JKHive home first.</p>
      )}
      {adminLocationId && loading && (
        <p style={{ color: '#86868B', padding: 18, textAlign: 'center' }}>Loading…</p>
      )}

      {adminLocationId && !loading && items.length === 0 && (
        <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '36px 22px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ width: 64, height: 64, borderRadius: 999, background: 'rgba(255,45,85,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <Package size={32} color="#FF2D55" strokeWidth={2} />
          </div>
          <p style={{ fontSize: 17, fontWeight: 700, color: '#1D1D1F', margin: '0 0 4px' }}>No stock yet</p>
          <p style={{ fontSize: 13, color: '#86868B', margin: 0 }}>Tap the button below to add your first item.</p>
        </div>
      )}

      {adminLocationId && !loading && items.length > 0 && (
        <>
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#86868B', margin: '6px 4px 8px' }}>
            {items.length} item{items.length === 1 ? '' : 's'} in stock
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map(it => {
              const meta = itemMeta(it);
              const tone = meta.urgency === 'expired' ? '#FF3B30' : meta.urgency === 'soon' ? '#FF9500' : '#34C759';
              return (
                <button key={it.id} data-testid={`inventory-row-${it.id}`}
                  onClick={() => navigate(`/jkhive/inventory/item/${it.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                    background: '#FFFFFF', borderRadius: 16, border: 0, textAlign: 'left',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)', cursor: 'pointer',
                    borderLeft: `4px solid ${tone}`,
                  }}>
                  <span style={{ fontSize: 28 }}>{it.item_icon || categoryEmoji(it.item_category)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#1D1D1F', margin: 0 }}>{it.item_name}</p>
                    <p style={{ fontSize: 11, color: '#86868B', margin: '2px 0 0' }}>
                      {Number(it.current_amount).toFixed(it.unit === 'count' ? 0 : 2)} {it.unit}
                      {meta.batchCount > 1 ? ` · ${meta.batchCount} batches` : ''}
                      {meta.earliest ? ` · use by ${formatDate(meta.earliest)}` : ''}
                    </p>
                  </div>
                  {meta.urgency && (
                    <span style={{
                      fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999,
                      background: tone, color: '#FFFFFF', whiteSpace: 'nowrap',
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}>
                      <AlertCircle size={10} strokeWidth={2.6} />
                      {meta.urgency === 'expired' ? 'EXPIRED' : 'USE SOON'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      <button data-testid="add-stock-btn"
        onClick={() => navigate('/jkhive/inventory/pick')}
        disabled={!adminLocationId}
        style={{
          position: 'fixed', left: 16, right: 16, bottom: 96, maxWidth: 600, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '18px 16px', borderRadius: 999, border: 0,
          background: '#1D1D1F', color: '#FFFFFF', fontSize: 17, fontWeight: 600,
          cursor: 'pointer', opacity: adminLocationId ? 1 : 0.5,
          fontFamily: 'Outfit, sans-serif',
          boxShadow: '0 6px 18px rgba(0,0,0,0.18)', zIndex: 5,
        }}>
        <Plus size={20} strokeWidth={2.6} /> Add stock
      </button>
    </div>
  );
};

export default InventoryHome;
