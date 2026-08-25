import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, BookOpen } from 'lucide-react';
import api, { resolveImageUrl } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';
import MenuItemSpecViewer from '../admin-menu/components/MenuItemSpecViewer';

const FONT = { fontFamily: 'Outfit, sans-serif' };

/**
 * Staff-facing, read-only recipe library. Lives at /jkhive/recipes and
 * is linked from the Workforce → Learn section. Reuses the existing
 * `MenuItemSpecViewer` so the exact same spec (photos, video, allergen
 * callouts, prep steps, plating notes, ingredients) is shown as in
 * `/jkhive/menu` — but without any edit / delete controls.
 */
const Recipes = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isStaff, loading: authLoading } = useAuth();
  const { adminLocationId, locations } = useLocation2();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isStaff)) navigate('/admin-login');
  }, [authLoading, isAuthenticated, isStaff, navigate]);

  useEffect(() => {
    if (!adminLocationId) { setItems([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError('');
    // Staff also have access to the admin menu list (the existing
    // `/jkhive/menu` reuses the same page), so pulling the admin list
    // here means every item has the `spec` sub-doc already inlined.
    api.adminGetMenuItems(adminLocationId)
      .then((data) => { if (!cancelled) setItems(Array.isArray(data) ? data : []); })
      .catch(e => { if (!cancelled) setError(e.message || 'Failed to load'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [adminLocationId]);

  const openSpec = (it) => setSelected(it);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter(it =>
      (it.name || '').toLowerCase().includes(term)
      || (it.subtitle || '').toLowerCase().includes(term)
      || (it.category || '').toLowerCase().includes(term)
    );
  }, [items, q]);

  const currentLoc = locations.find(l => l.id === adminLocationId);

  return (
    <div className="pb-24" data-testid="jkhive-recipes" style={FONT}>
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => navigate('/jkhive/workforce')}
          data-testid="recipes-back"
          className="inline-flex items-center gap-1 text-[13px]"
          style={{ color: '#007AFF' }}
        >
          <ArrowLeft size={14} /> Back
        </button>
      </div>
      <h1 className="text-[28px] font-bold tracking-tight" style={{ color: '#1D1D1F' }}>Recipes & Specs</h1>
      <p className="text-[13px] mt-1 mb-4" style={{ color: '#86868B' }}>
        {currentLoc ? `${currentLoc.name} · read-only kitchen workflow` : 'Pick a site to view its dishes.'}
      </p>

      {/* Search */}
      <div className="relative mb-4" style={{ maxWidth: 420 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: 12, color: '#86868B' }} />
        <input
          data-testid="recipes-search"
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search dish, category…"
          className="w-full py-2.5 rounded-xl text-sm border-0 outline-none"
          style={{ paddingLeft: 34, paddingRight: 12, background: '#FFFFFF', color: '#1D1D1F', boxShadow: '0 0 0 1px rgba(0,0,0,0.06)', ...FONT }}
        />
      </div>

      {error && <div className="text-sm text-red-600 mb-3">{error}</div>}

      {loading ? (
        <div className="text-center py-16" style={{ color: '#86868B' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ background: '#FFFFFF', color: '#86868B' }}>
          <BookOpen size={26} className="mx-auto mb-2" />
          <p className="text-sm">No dishes {q ? `match “${q}”` : 'available at this site yet'}.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="recipes-grid">
          {filtered.map(it => (
            <button
              key={it.id}
              data-testid={`recipes-card-${it.id}`}
              onClick={() => openSpec(it)}
              className="text-left rounded-2xl overflow-hidden active:scale-[0.99] transition"
              style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
            >
              <div className="aspect-square bg-muted/40 relative">
                {(it.thumbnail_url || it.image_url) ? (
                  <img
                    src={resolveImageUrl(it.thumbnail_url || it.image_url)}
                    alt={it.image_alt || it.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <BookOpen size={22} />
                  </div>
                )}
                {it?.spec?.video_url && (
                  <span
                    className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(0,0,0,0.6)', color: '#FFFFFF' }}
                  >VIDEO</span>
                )}
              </div>
              <div className="p-3">
                <p className="text-[13px] font-semibold truncate" style={{ color: '#1D1D1F' }}>{it.name}</p>
                {it.subtitle && (
                  <p className="text-[11px] truncate" style={{ color: '#86868B' }}>{it.subtitle}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <MenuItemSpecViewer item={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
};

export default Recipes;
