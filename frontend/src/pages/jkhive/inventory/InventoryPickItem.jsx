import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronDown, ChevronUp, Star } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';

/**
 * /jkhive/inventory/pick — pick an ingredient to add to inventory.
 * Mirrors the Delivery PickItem (Fresh / Frozen / Dry / Prepared / Beverages tabs)
 * but routes directly to the Add Stock wizard (no supplier, no temp record).
 */
const FAV_KEY = 'jkhive.inventory.favs';
const SECTIONS = ['Fresh', 'Frozen', 'Dry', 'Prepared', 'Beverages'];

const InventoryPickItem = () => {
  const navigate = useNavigate();
  const { adminLocationId, locations } = useLocation2();
  const [catalog, setCatalog] = useState([]);
  const [open, setOpen] = useState(null);
  const [search, setSearch] = useState('');
  const [section, setSection] = useState('Fresh');
  const [favs, setFavs] = useState(() => {
    try { return JSON.parse(localStorage.getItem(FAV_KEY)) || []; } catch { return []; }
  });
  const [showCustomFor, setShowCustomFor] = useState(null);
  const [customName, setCustomName] = useState('');

  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  useEffect(() => {
    if (!adminLocationId) return;
    api.coolingCatalog(adminLocationId)
      .then(d => setCatalog(d.categories || []))
      .catch(err => alert('Failed to load catalog: ' + err.message));
  }, [adminLocationId]);

  const toggleFav = (cat) => {
    const next = favs.includes(cat) ? favs.filter(c => c !== cat) : [...favs, cat];
    setFavs(next);
    localStorage.setItem(FAV_KEY, JSON.stringify(next));
  };

  const ordered = useMemo(() => {
    const arr = catalog.filter(c => (c.section || 'Fresh') === section);
    arr.sort((a, b) => {
      const af = favs.includes(a.name) ? 0 : 1;
      const bf = favs.includes(b.name) ? 0 : 1;
      if (af !== bf) return af - bf;
      return a.name.localeCompare(b.name);
    });
    return arr;
  }, [catalog, favs, section]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.trim().toLowerCase();
    const out = [];
    catalog.forEach(c => c.items.forEach(item => {
      if (item.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)) {
        out.push({ category: c.name, section: c.section, item, icon: c.icon });
      }
    }));
    return out;
  }, [catalog, search]);

  const goNext = (category, itemPart, icon) => {
    navigate('/jkhive/inventory/add/amount', {
      state: {
        mode: 'inventory',
        itemName: `${category} (${itemPart})`,
        category,
        itemIcon: icon,
      },
    });
  };

  const submitCustom = async (cat) => {
    const name = customName.trim();
    if (!name) return;
    try {
      await api.coolingAddCustomItem({ location_id: adminLocationId, category: cat, name });
      const fresh = await api.coolingCatalog(adminLocationId);
      setCatalog(fresh.categories || []);
      setShowCustomFor(null); setCustomName('');
    } catch (err) { alert('Could not add: ' + err.message); }
  };

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="inventory-pick-item">
      <WizardHeader title="Select an Ingredient" locationName={locationName} dateStr={today} backTo="/jkhive/inventory" />

      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search size={18} strokeWidth={2.4} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#86868B' }} />
        <input data-testid="inventory-search"
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search items"
          style={{
            width: '100%', padding: '14px 16px 14px 44px', fontSize: 16,
            border: '1px solid rgba(0,0,0,0.08)', borderRadius: 14,
            background: '#FFFFFF', color: '#1D1D1F', outline: 'none',
            fontFamily: 'Outfit, sans-serif',
          }} />
      </div>

      {!searchResults && (
        <div style={{
          display: 'flex', overflowX: 'auto', gap: 18, padding: '4px 2px 14px',
          borderBottom: '1px solid rgba(0,0,0,0.06)', marginBottom: 12,
          scrollbarWidth: 'none',
        }}>
          {SECTIONS.map(s => {
            const active = s === section;
            return (
              <button key={s} data-testid={`inv-section-${s.toLowerCase()}`}
                onClick={() => { setSection(s); setOpen(null); }}
                style={{
                  flex: '0 0 auto', padding: '6px 0', background: 'transparent',
                  border: 0, borderBottom: `2.5px solid ${active ? '#FF3B30' : 'transparent'}`,
                  fontSize: 15, fontWeight: active ? 800 : 500,
                  color: active ? '#1D1D1F' : '#86868B',
                  cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
                }}>{s}</button>
            );
          })}
        </div>
      )}

      {searchResults && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {searchResults.length === 0 && <p style={{ color: '#86868B', textAlign: 'center', padding: 16 }}>No matches.</p>}
          {searchResults.map((r, i) => (
            <button key={i} onClick={() => goNext(r.category, r.item, r.icon)}
              data-testid={`inv-search-${i}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                background: '#FFFFFF', borderRadius: 14, border: 0, cursor: 'pointer', textAlign: 'left',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}>
              <span style={{ fontSize: 24 }}>{r.icon}</span>
              <p style={{ flex: 1, fontSize: 15, fontWeight: 600, color: '#1D1D1F', margin: 0 }}>{r.category} ({r.item})</p>
              <span style={{ fontSize: 10, color: '#86868B', textTransform: 'uppercase' }}>{r.section}</span>
            </button>
          ))}
        </div>
      )}

      {!searchResults && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ordered.length === 0 && (
            <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '28px 18px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <p style={{ fontSize: 14, color: '#86868B', margin: 0 }}>No items in <b>{section}</b> yet.</p>
            </div>
          )}
          {ordered.map(c => {
            const isOpen = open === c.name;
            const isFav = favs.includes(c.name);
            return (
              <div key={c.name} style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 12px' }}>
                  <button onClick={() => toggleFav(c.name)} aria-label="Favourite"
                    style={{ background: 'transparent', border: 0, padding: 6, cursor: 'pointer' }}>
                    <Star size={20} strokeWidth={2.4} fill={isFav ? '#FFCC00' : 'transparent'} color={isFav ? '#FFCC00' : '#86868B'} />
                  </button>
                  <button onClick={() => setOpen(isOpen ? null : c.name)}
                    style={{ flex: 1, background: 'transparent', border: 0, padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
                    <span style={{ fontSize: 28, lineHeight: 1 }}>{c.icon}</span>
                    <span style={{ flex: 1, fontSize: 17, fontWeight: 700, color: '#1D1D1F' }}>{c.name}</span>
                    {isOpen ? <ChevronUp size={20} strokeWidth={2.4} color="#86868B" /> : <ChevronDown size={20} strokeWidth={2.4} color="#86868B" />}
                  </button>
                </div>
                {isOpen && (
                  <div style={{ padding: '4px 12px 16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                      {c.items.map(itm => (
                        <button key={itm} onClick={() => goNext(c.name, itm, c.icon)}
                          data-testid={`inv-item-${c.name}-${itm}`}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                            padding: '10px 4px', background: 'transparent', border: 0, cursor: 'pointer',
                          }}>
                          <span style={{ fontSize: 36, lineHeight: 1 }}>{c.icon}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#1D1D1F', textAlign: 'center' }}>{c.name} ({itm})</span>
                        </button>
                      ))}
                      <button onClick={() => { setShowCustomFor(c.name); setCustomName(''); }}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                          padding: '10px 4px', background: 'transparent', border: 0, cursor: 'pointer',
                        }}>
                        <span style={{
                          fontSize: 32, fontWeight: 700, lineHeight: 1, width: 44, height: 44,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1D1D1F',
                        }}>＋</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#1D1D1F' }}>Add Custom</span>
                      </button>
                    </div>
                    {showCustomFor === c.name && (
                      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                        <input autoFocus value={customName} onChange={e => setCustomName(e.target.value)}
                          placeholder={`Add to ${c.name}`}
                          style={{ flex: 1, padding: '12px 14px', fontSize: 15, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 10, outline: 'none', fontFamily: 'Outfit, sans-serif' }} />
                        <button onClick={() => submitCustom(c.name)}
                          style={{ padding: '12px 16px', borderRadius: 10, border: 0, background: '#1D1D1F', color: '#FFFFFF', fontWeight: 700, cursor: 'pointer' }}>Add</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default InventoryPickItem;
