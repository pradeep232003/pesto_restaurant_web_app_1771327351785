import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Star, Zap, Puzzle, Trash2, HelpCircle, TrendingUp } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';

const FONT = { fontFamily: 'Outfit, sans-serif' };

const QUADRANTS = [
  {
    key: 'star',
    label: 'Stars',
    emoji: '⭐',
    icon: Star,
    color: '#34C759',
    tint: 'rgba(52,199,89,0.10)',
    tagline: 'High profit + High popularity',
    action: 'Feature prominently. Maintain strict quality. Promote heavily.',
  },
  {
    key: 'plow_horse',
    label: 'Plow Horses',
    emoji: '🐎',
    icon: Zap,
    color: '#FF9500',
    tint: 'rgba(255,149,0,0.10)',
    tagline: 'Low profit + High popularity',
    action: 'Raise price slightly, tune portion, or find cheaper ingredients.',
  },
  {
    key: 'puzzle',
    label: 'Puzzles',
    emoji: '🧩',
    icon: Puzzle,
    color: '#5856D6',
    tint: 'rgba(88,86,214,0.10)',
    tagline: 'High profit + Low popularity',
    action: 'Rename it, reposition on the menu, or have servers upsell.',
  },
  {
    key: 'dog',
    label: 'Dogs',
    emoji: '🐕',
    icon: Trash2,
    color: '#FF3B30',
    tint: 'rgba(255,59,48,0.10)',
    tagline: 'Low profit + Low popularity',
    action: 'Remove from the menu. Takes up space, makes no money.',
  },
];

const PRESETS = [
  { id: 7, label: '7d' },
  { id: 30, label: '30d' },
  { id: 90, label: '90d' },
  { id: 365, label: '1y' },
];

const fmtGBP = (n) => `£${Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtUnits = (n) => Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });

/** Small chip inside a quadrant card — one row per item. */
const ItemRow = ({ item }) => (
  <div
    data-testid={`me-item-${item.id}`}
    style={{
      display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8,
      padding: '7px 10px', borderRadius: 8, background: '#FFFFFF',
      fontSize: 12, alignItems: 'center', ...FONT,
    }}
  >
    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1D1D1F', fontWeight: 600 }}>
      {item.name || '—'}
    </span>
    <span style={{ color: '#86868B', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
      {fmtUnits(item.units)} sold
    </span>
    <span style={{ color: '#1D1D1F', fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
      {fmtGBP(item.margin)}
    </span>
  </div>
);

const QuadrantCard = ({ meta, items }) => {
  const Icon = meta.icon;
  return (
    <div
      data-testid={`me-quadrant-${meta.key}`}
      style={{
        background: meta.tint, borderRadius: 16, padding: 14,
        display: 'flex', flexDirection: 'column', gap: 10, minHeight: 260,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 20 }} aria-hidden>{meta.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.01em' }}>
            {meta.label}
          </div>
          <div style={{ fontSize: 11, color: '#86868B', marginTop: 1 }}>{meta.tagline}</div>
        </div>
        <div style={{
          padding: '4px 10px', borderRadius: 999, background: meta.color, color: '#FFFFFF',
          fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <Icon size={12} /> {items.length}
        </div>
      </div>
      <div style={{
        background: 'rgba(255,255,255,0.5)', borderRadius: 10, padding: 8,
        border: `1px dashed ${meta.color}55`, fontSize: 11, color: '#3A3A3C',
      }}>
        <strong style={{ color: meta.color }}>Action:</strong> {meta.action}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 340, overflowY: 'auto' }}>
        {items.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: '#86868B', fontSize: 12 }}>No items in this quadrant.</div>
        ) : (
          items.map(it => <ItemRow key={it.id} item={it} />)
        )}
      </div>
    </div>
  );
};

const MenuEngineering = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAuth();
  const { adminLocationId, locations } = useLocation2();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!authLoading && !isAdmin) navigate('/jkhive');
  }, [authLoading, isAdmin, navigate]);

  useEffect(() => {
    if (!adminLocationId) return;
    let cancelled = false;
    (async () => {
      setLoading(true); setErr('');
      try {
        const res = await api.biMenuEngineering({ location_id: adminLocationId, days });
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setErr(e.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [adminLocationId, days]);

  // Bucket items by quadrant.
  const byQuadrant = useMemo(() => {
    const out = { star: [], plow_horse: [], puzzle: [], dog: [], uncategorised: [] };
    for (const it of (data?.items || [])) {
      (out[it.quadrant] || out.uncategorised).push(it);
    }
    // Within a quadrant, sort by revenue desc so the top earners land first.
    for (const k of Object.keys(out)) out[k].sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
    return out;
  }, [data]);

  const locName = locations.find(l => l.id === adminLocationId)?.name || 'All sites';
  const b = data?.benchmarks;

  return (
    <div data-testid="menu-engineering-page" style={{ paddingBottom: 24, ...FONT }}>
      <button
        data-testid="me-back"
        onClick={() => navigate('/jkhive/manager')}
        style={{ background: 'none', border: 0, color: '#007AFF', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginBottom: 12, ...FONT }}
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1D1D1F', margin: 0, letterSpacing: '-0.02em' }}>
            Menu Engineering
          </h1>
          <p style={{ fontSize: 13, color: '#86868B', margin: '2px 0 0' }}>
            Kasavana & Smith 2×2 · {locName} · last {days} days
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {PRESETS.map(p => (
            <button
              key={p.id}
              data-testid={`me-preset-${p.id}`}
              onClick={() => setDays(p.id)}
              style={{
                padding: '6px 12px', borderRadius: 999,
                border: `1px solid ${days === p.id ? '#1D1D1F' : '#E5E5EA'}`,
                background: days === p.id ? '#1D1D1F' : '#FFFFFF',
                color: days === p.id ? '#FFFFFF' : '#1D1D1F',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', ...FONT,
              }}
            >{p.label}</button>
          ))}
        </div>
      </div>

      {/* Benchmarks summary */}
      {b && (
        <div data-testid="me-benchmarks" style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10,
          marginTop: 14, marginBottom: 14,
        }}>
          <StatTile label="Total items on menu" value={fmtUnits(b.total_menu_items)} icon={<HelpCircle size={12} />} />
          <StatTile label="Classified" value={fmtUnits(b.eligible_items)} icon={<TrendingUp size={12} />} sub="sold + priced" />
          <StatTile label="Avg units / item" value={fmtUnits(b.mean_units)} sub="popularity line" />
          <StatTile label="Avg margin / item" value={fmtGBP(b.mean_margin)} sub="profitability line" />
        </div>
      )}

      {err && (
        <div data-testid="me-error" style={{ background: 'rgba(255,59,48,0.10)', color: '#C0392B', padding: '10px 12px', borderRadius: 10, fontSize: 12, marginBottom: 10 }}>
          {err}
        </div>
      )}

      {loading && !data ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#86868B' }}>
          <Loader2 size={20} className="animate-spin" style={{ display: 'inline-block' }} /> Loading…
        </div>
      ) : (
        <>
          {/* 2×2 quadrant grid */}
          <div data-testid="me-grid" style={{
            display: 'grid', gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          }}>
            {QUADRANTS.map(meta => (
              <QuadrantCard key={meta.key} meta={meta} items={byQuadrant[meta.key] || []} />
            ))}
          </div>

          {/* Uncategorised bin */}
          {byQuadrant.uncategorised.length > 0 && (
            <div data-testid="me-uncategorised" style={{ marginTop: 14, background: '#F8F8FA', borderRadius: 14, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <HelpCircle size={13} color="#86868B" />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#3A3A3C' }}>
                  Needs setup — {byQuadrant.uncategorised.length} items
                </span>
              </div>
              <p style={{ fontSize: 11, color: '#86868B', margin: '0 0 8px' }}>
                Items without a recipe (no food cost) or with no sales in the period. Complete the recipe in Menu Manager to include them here.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                {byQuadrant.uncategorised.slice(0, 60).map(it => (
                  <div key={it.id} style={{ padding: '5px 8px', borderRadius: 6, background: '#FFFFFF', fontSize: 11, color: '#3A3A3C', display: 'flex', justifyContent: 'space-between', gap: 6, ...FONT }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>
                    <span style={{ color: '#86868B', fontSize: 10 }}>{it.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const StatTile = ({ label, value, sub, icon }) => (
  <div style={{ background: '#FFFFFF', borderRadius: 12, padding: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {icon} {label}
    </div>
    <div style={{ fontSize: 20, fontWeight: 800, color: '#1D1D1F', marginTop: 2, letterSpacing: '-0.02em' }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: '#86868B', marginTop: 1 }}>{sub}</div>}
  </div>
);

export default MenuEngineering;
