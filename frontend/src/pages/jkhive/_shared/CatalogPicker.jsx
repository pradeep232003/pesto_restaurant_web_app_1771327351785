import React, { useEffect, useMemo, useState } from 'react';
import { Search, ChevronDown, ChevronUp, Star } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';

/**
 * Shared catalog picker used by specialist routines (Acidity, Vacuum,
 * Washing, Sous Vide). Reuses the cooking-cooling catalog endpoint so the
 * Fresh / Frozen / Dry / Prepared / Beverages list stays in sync everywhere.
 *
 * Props:
 *   title       — wizard header title
 *   backTo      — back chevron destination
 *   favKey      — localStorage key for favourite categories
 *   testid      — root data-testid prefix
 *   onPick({ category, item })   — called when staff taps an item tile
 */
export const SpecialistCatalogPicker = ({ title, backTo, favKey, testid = 'catalog-pick', onPick }) => {
  const { adminLocationId, locations } = useLocation2();
  const [catalog, setCatalog] = useState([]);
  const [open, setOpen] = useState(null);
  const [search, setSearch] = useState('');
  const [favs, setFavs] = useState(() => {
    try { return JSON.parse(localStorage.getItem(favKey)) || []; } catch { return []; }
  });

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
    localStorage.setItem(favKey, JSON.stringify(next));
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
    catalog.forEach(c => {
      c.items.forEach(item => {
        if (item.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)) {
          out.push({ category: c.name, item, icon: c.icon });
        }
      });
    });
    return out;
  }, [catalog, search]);

  if (!adminLocationId) {
    return (
      <div style={{ padding: 24, fontFamily: 'Outfit, sans-serif' }}>
        <WizardHeader title={title} locationName="—" dateStr={today} backTo={backTo} />
        <p style={{ color: '#FF9500' }}>Pick a location from JKHive home first.</p>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid={testid}>
      <WizardHeader title={title} locationName={locationName} dateStr={today} backTo={backTo} />

      <div style={{ position: 'relative', marginBottom: 14 }}>
        <Search size={18} strokeWidth={2.4} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#86868B' }} />
        <input
          data-testid={`${testid}-search`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search ingredients"
          style={{
            width: '100%', padding: '14px 16px 14px 44px', fontSize: 16,
            border: '1px solid rgba(0,0,0,0.08)', borderRadius: 14,
            background: '#FFFFFF', color: '#1D1D1F', outline: 'none',
            fontFamily: 'Outfit, sans-serif',
          }}
        />
      </div>

      {searchResults && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {searchResults.length === 0 && <p style={{ color: '#86868B', textAlign: 'center', padding: 16 }}>No matches.</p>}
          {searchResults.map((r, i) => (
            <button key={i} onClick={() => onPick({ category: r.category, item: r.item, icon: r.icon })}
              data-testid={`${testid}-search-${i}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                background: '#FFFFFF', borderRadius: 14, border: 0, cursor: 'pointer', textAlign: 'left',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}>
              <span style={{ fontSize: 24 }}>{r.icon}</span>
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
                  <button onClick={() => toggleFav(c.name)} aria-label="Favourite" data-testid={`${testid}-fav-${c.name}`}
                    style={{ background: 'transparent', border: 0, padding: 6, cursor: 'pointer' }}>
                    <Star size={20} strokeWidth={2.4} fill={isFav ? '#FFCC00' : 'transparent'} color={isFav ? '#FFCC00' : '#86868B'} />
                  </button>
                  <button onClick={() => setOpen(isOpen ? null : c.name)} data-testid={`${testid}-cat-${c.name}`}
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
                        <button key={itm} onClick={() => onPick({ category: c.name, item: itm, icon: c.icon })}
                          data-testid={`${testid}-item-${c.name}-${itm}`}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                            padding: '10px 4px', background: 'transparent', border: 0, cursor: 'pointer',
                          }}>
                          <span style={{ fontSize: 36, lineHeight: 1 }}>{c.icon}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#1D1D1F', textAlign: 'center' }}>{c.name} ({itm})</span>
                        </button>
                      ))}
                    </div>
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

export default SpecialistCatalogPicker;
