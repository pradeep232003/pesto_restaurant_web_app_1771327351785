import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Search, ChevronDown, ChevronUp, Star } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';

/**
 * /jkhive/delivery-records/item — pick ingredient (reuses cooking-cooling catalog).
 * Mirrors CookedPickItem; on select, navigates to record-temp screen.
 */
const FAV_KEY = 'jkhive.delivery.favs';

const PickItem = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { adminLocationId, locations } = useLocation2();
  const [catalog, setCatalog] = useState([]);
  const [open, setOpen] = useState(null);
  const [search, setSearch] = useState('');
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

  if (!state?.supplier) return <Navigate to="/jkhive/delivery-records/supplier" replace />;

  const toggleFav = (cat) => {
    const next = favs.includes(cat) ? favs.filter(c => c !== cat) : [...favs, cat];
    setFavs(next);
    localStorage.setItem(FAV_KEY, JSON.stringify(next));
  };

  const ordered = useMemo(() => {
    const arr = [...catalog];
    arr.sort((a, b) => {
      const af = favs.includes(a.name) ? 0 : 1;
      const bf = favs.includes(b.name) ? 0 : 1;
      if (af !== bf) return af - bf;
      return a.name.localeCompare(b.name);
    });
    return arr;
  }, [catalog, favs]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.trim().toLowerCase();
    const out = [];
    catalog.forEach(c => c.items.forEach(item => {
      if (item.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)) {
        out.push({ category: c.name, item });
      }
    }));
    return out;
  }, [catalog, search]);

  const goRecord = (category, itemPart) => {
    navigate('/jkhive/delivery-records/record', {
      state: { supplier: state.supplier, itemName: `${category} (${itemPart})`, category },
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
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="delivery-pick-item">
      <WizardHeader title="Select an Ingredient" locationName={locationName} dateStr={today} backTo="/jkhive/delivery-records/supplier" />

      <p style={{ fontSize: 12, color: '#86868B', textAlign: 'center', margin: '0 0 12px' }}>
        Supplier: <b style={{ color: '#1D1D1F' }}>{state.supplier.name}</b>
      </p>

      <div style={{ position: 'relative', marginBottom: 14 }}>
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

      {searchResults && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {searchResults.length === 0 && <p style={{ color: '#86868B', textAlign: 'center', padding: 16 }}>No matches.</p>}
          {searchResults.map((r, i) => (
            <button key={i} onClick={() => goRecord(r.category, r.item)}
              data-testid={`delivery-search-${i}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                background: '#FFFFFF', borderRadius: 14, border: 0, cursor: 'pointer', textAlign: 'left',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#1D1D1F', margin: 0 }}>{r.category} ({r.item})</p>
            </button>
          ))}
        </div>
      )}

      {!searchResults && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                        <button key={itm} onClick={() => goRecord(c.name, itm)}
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
