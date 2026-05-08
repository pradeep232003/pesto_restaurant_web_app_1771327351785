import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Search, ChevronDown, ChevronUp, Star } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';

/**
 * /jkhive/delivery-records/item — pick ingredient.
 *
 * Adds Fresh / Frozen / Dry / Prepared / Beverages section tabs (IMG_6688 spec)
 * above the alphabetised category accordion. Each catalog category carries a
 * `section` field served by /api/admin/cooking-cooling/catalog.
 *
 * For "Add another item" mode (state.itemsLogged set), navigation skips the
 * temp/comment screens and routes straight to the inventory prompt — re-using
 * the first item's temp + comment for the new delivery record.
 */
const FAV_KEY = 'jkhive.delivery.favs';
const SECTIONS = ['Fresh', 'Frozen', 'Dry', 'Prepared', 'Beverages'];

const PickItem = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
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
  const isSubsequent = Array.isArray(state?.itemsLogged) && state.itemsLogged.length > 0;

  useEffect(() => {
    if (!adminLocationId) return;
    api.coolingCatalog(adminLocationId)
      .then(d => setCatalog(d.categories || []))
      .catch(err => alert('Failed to load catalog: ' + err.message));
  }, [adminLocationId]);

  if (!state?.supplier) return <Navigate to="/jkhive/delivery-records/supplier" replace />;

  const toggleFav = (cat) => {
    const next = favs.includes(cat) ? favs.filter(c => c !== cat) : [...favs, cat];
    setFavs(next);
    localStorage.setItem(FAV_KEY, JSON.stringify(next));
  };

  // Filter by section, then sort favourites first.
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

  /**
   * On item pick: for the first item, route to /record (temperature wizard).
   * For subsequent items in the same delivery, skip /record + /comment and go
   * straight to the Add-to-Inventory prompt — inheriting the first item's temp
   * (it's saved as a delivery record on inventory-prompt mount).
   */
  const goNext = (category, itemPart, icon) => {
    const itemName = `${category} (${itemPart})`;
    const baseState = {
      supplier: state.supplier,
      itemName, category, itemIcon: icon,
      itemsLogged: state.itemsLogged || [],
      sharedTemp: state.sharedTemp,
      sharedComment: state.sharedComment,
    };
    if (isSubsequent) {
      navigate('/jkhive/delivery-records/inventory-prompt', { state: { ...baseState, autoSaveRecord: true } });
    } else {
      navigate('/jkhive/delivery-records/record', { state: baseState });
    }
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
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="delivery-pick-item">
      <WizardHeader title="Select an Ingredient" locationName={locationName} dateStr={today} backTo={isSubsequent ? '/jkhive/delivery-records/review' : '/jkhive/delivery-records/supplier'} />

      <p style={{ fontSize: 12, color: '#86868B', textAlign: 'center', margin: '0 0 12px' }}>
        Supplier: <b style={{ color: '#1D1D1F' }}>{state.supplier.name}</b>
      </p>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search size={18} strokeWidth={2.4} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#86868B' }} />
        <input data-testid="delivery-search"
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search items"
          style={{
            width: '100%', padding: '14px 16px 14px 44px', fontSize: 16,
            border: '1px solid rgba(0,0,0,0.08)', borderRadius: 14,
            background: '#FFFFFF', color: '#1D1D1F', outline: 'none',
            fontFamily: 'Outfit, sans-serif',
          }} />
      </div>

      {/* Section tabs */}
      {!searchResults && (
        <div style={{
          display: 'flex', overflowX: 'auto', gap: 18, padding: '4px 2px 14px',
          borderBottom: '1px solid rgba(0,0,0,0.06)', marginBottom: 12,
          scrollbarWidth: 'none',
        }}>
          {SECTIONS.map(s => {
            const active = s === section;
            return (
              <button key={s} data-testid={`section-tab-${s.toLowerCase()}`}
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
              data-testid={`delivery-search-${i}`}
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
              <p style={{ fontSize: 14, color: '#86868B', margin: 0 }}>
                No items in <b>{section}</b> yet. Use search above, switch tabs, or add a custom item.
              </p>
            </div>
          )}
          {ordered.map(c => {
            const isOpen = open === c.name;
            const isFav = favs.includes(c.name);
            return (
              <div key={c.name} style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 12px' }}>
                  <button onClick={() => toggleFav(c.name)} aria-label="Favourite"
                    data-testid={`delivery-fav-${c.name}`}
                    style={{ background: 'transparent', border: 0, padding: 6, cursor: 'pointer' }}>
                    <Star size={20} strokeWidth={2.4} fill={isFav ? '#FFCC00' : 'transparent'} color={isFav ? '#FFCC00' : '#86868B'} />
                  </button>
                  <button onClick={() => setOpen(isOpen ? null : c.name)}
                    data-testid={`delivery-cat-${c.name}`}
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
                          data-testid={`delivery-item-${c.name}-${itm}`}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                            padding: '10px 4px', background: 'transparent', border: 0, cursor: 'pointer',
                          }}>
                          <span style={{ fontSize: 36, lineHeight: 1 }}>{c.icon}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#1D1D1F', textAlign: 'center' }}>{c.name} ({itm})</span>
                        </button>
                      ))}
                      <button data-testid={`delivery-add-custom-${c.name}`}
                        onClick={() => { setShowCustomFor(c.name); setCustomName(''); }}
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
                        <input data-testid="delivery-custom-input"
                          autoFocus value={customName} onChange={e => setCustomName(e.target.value)}
                          placeholder={`Add to ${c.name}`}
                          style={{ flex: 1, padding: '12px 14px', fontSize: 15, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 10, outline: 'none', fontFamily: 'Outfit, sans-serif' }} />
                        <button data-testid="delivery-custom-submit"
                          onClick={() => submitCustom(c.name)}
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

export default PickItem;
