import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';

/**
 * /jkhive/in-service-wastage/pick — IMG_6703 style.
 * Tabs: Breakfast / Sandwiches / Specials / Mains / Sides / Desserts / Beverages
 * sourced from the live menu for the current location. Tap an item to log it
 * as wasted (price auto-captured from the menu).
 */
const TABS = [
  { key: 'breakfast',  label: 'Breakfast' },
  { key: 'sandwiches', label: 'Sandwiches' },
  { key: 'specials',   label: 'Specials' },
  { key: 'mains',      label: 'Mains' },
  { key: 'sides',      label: 'Sides' },
  { key: 'desserts',   label: 'Desserts' },
  { key: 'beverages',  label: 'Beverages' },
];

const fmtMoney = (v) => `£${Number(v || 0).toFixed(2)}`;

const InServicePick = () => {
  const navigate = useNavigate();
  const { adminLocationId, locations } = useLocation2();
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState('breakfast');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  useEffect(() => {
    if (!adminLocationId) return;
    setLoading(true);
    api.getMenuItems(adminLocationId)
      .then(d => setItems(d || []))
      .catch(err => alert('Failed to load menu: ' + err.message))
      .finally(() => setLoading(false));
  }, [adminLocationId]);

  // Match item if its `category` or any value in `categories` array starts with the tab key.
  const matchesTab = (it, key) => {
    const norm = (s) => (s || '').toString().toLowerCase().replace(/\s+/g, '');
    const target = norm(key);
    const c = norm(it.category);
    if (c === target || c.includes(target)) return true;
    const arr = Array.isArray(it.categories) ? it.categories : [];
    return arr.some(x => {
      const n = norm(x);
      return n === target || n.includes(target);
    });
  };

  const visible = useMemo(() => {
    let arr = items;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter(i => (i.name || '').toLowerCase().includes(q));
    } else {
      arr = arr.filter(i => matchesTab(i, tab));
    }
    return [...arr].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [items, tab, search]);

  const pick = (it) => {
    navigate('/jkhive/in-service-wastage/comment', {
      state: {
        menu_item_id: it.id,
        item_name: it.name,
        item_category: it.category || tab,
        item_icon: '🍽️',
        price: Number(it.price || 0),
        image_url: it.image_url || '',
      },
    });
  };

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="service-wastage-pick">
      <WizardHeader title="What was wasted?" locationName={locationName} dateStr={today} backTo="/jkhive/in-service-wastage" />

      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search size={18} strokeWidth={2.4} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#86868B' }} />
        <input data-testid="service-search"
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search menu"
          style={{
            width: '100%', padding: '14px 16px 14px 44px', fontSize: 16,
            border: '1px solid rgba(0,0,0,0.08)', borderRadius: 14,
            background: '#FFFFFF', color: '#1D1D1F', outline: 'none',
            fontFamily: 'Outfit, sans-serif',
          }} />
      </div>

      {!search.trim() && (
        <div style={{
          display: 'flex', overflowX: 'auto', gap: 18, padding: '4px 2px 14px',
          borderBottom: '1px solid rgba(0,0,0,0.06)', marginBottom: 12,
          scrollbarWidth: 'none',
        }}>
          {TABS.map(t => {
            const active = t.key === tab;
            return (
              <button key={t.key} data-testid={`service-tab-${t.key}`}
                onClick={() => setTab(t.key)}
                style={{
                  flex: '0 0 auto', padding: '6px 0', background: 'transparent',
                  border: 0, borderBottom: `2.5px solid ${active ? '#FF3B30' : 'transparent'}`,
                  fontSize: 15, fontWeight: active ? 800 : 500,
                  color: active ? '#1D1D1F' : '#86868B',
                  cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
                }}>{t.label}</button>
            );
          })}
        </div>
      )}

      {loading && <p style={{ color: '#86868B', textAlign: 'center', padding: 16 }}>Loading…</p>}

      {!loading && visible.length === 0 && (
        <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '28px 18px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <p style={{ fontSize: 14, color: '#86868B', margin: 0 }}>
            {search.trim() ? 'No matches in the menu.' : `No items in ${TABS.find(t => t.key === tab)?.label} for this location yet.`}
          </p>
        </div>
      )}

      {!loading && visible.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visible.map(it => (
            <button key={it.id} data-testid={`menu-item-${it.id}`}
              onClick={() => pick(it)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                background: '#FFFFFF', borderRadius: 14, border: 0, textAlign: 'left',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)', cursor: 'pointer',
              }}>
              {it.image_url ? (
                <img src={it.image_url} alt={it.name}
                  style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: 10, background: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🍽️</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#1D1D1F', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</p>
                <p style={{ fontSize: 11, color: '#86868B', margin: '2px 0 0', textTransform: 'capitalize' }}>{it.category}</p>
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#1D1D1F' }}>{fmtMoney(it.price)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default InServicePick;
