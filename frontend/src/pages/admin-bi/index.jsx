import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { TrendingUp, ArrowLeft, Users, DollarSign, ChefHat, Activity, AlertTriangle, RefreshCcw, ChevronDown, ChevronRight } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';

const font = { fontFamily: 'Outfit, sans-serif' };

const fmtGBP = (n) => `£${Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysAgoISO = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

const PRESETS = [
  { id: '7', label: 'Last 7 days', days: 7 },
  { id: '30', label: 'Last 30 days', days: 30 },
  { id: '90', label: 'Last 90 days', days: 90 },
  { id: 'mtd', label: 'Month to date', days: null, mtd: true },
];

const KpiCard = ({ icon: IconComp, label, value, sub, color, accent, testid }) => (
  <div data-testid={testid} className="p-5 rounded-2xl" style={{ background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
    <div className="flex items-center justify-between mb-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: color }}>
        <IconComp size={18} color="white" strokeWidth={1.6} />
      </div>
      {accent && (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: accent.bg, color: accent.color, ...font }}>{accent.label}</span>
      )}
    </div>
    <p className="text-2xl font-semibold tracking-tight" style={{ color: '#1D1D1F', ...font }}>{value}</p>
    <p className="text-xs mt-1" style={{ color: '#86868B', ...font }}>{label}</p>
    {sub && <p className="text-[11px] mt-1.5" style={{ color: '#86868B', ...font }}>{sub}</p>}
  </div>
);

const labourBand = (pct) => {
  if (pct === 0) return { bg: 'rgba(142,142,147,0.12)', color: '#8E8E93', label: 'no data' };
  if (pct <= 30) return { bg: 'rgba(52,199,89,0.12)', color: '#1F8C42', label: 'healthy' };
  if (pct <= 40) return { bg: 'rgba(255,204,0,0.18)', color: '#9A6A00', label: 'watch' };
  return { bg: 'rgba(255,59,48,0.12)', color: '#C0392B', label: 'high' };
};

const foodBand = (pct) => {
  if (pct === 0) return { bg: 'rgba(142,142,147,0.12)', color: '#8E8E93', label: 'no recipes' };
  if (pct <= 25) return { bg: 'rgba(52,199,89,0.12)', color: '#1F8C42', label: 'healthy' };
  if (pct <= 35) return { bg: 'rgba(255,204,0,0.18)', color: '#9A6A00', label: 'watch' };
  return { bg: 'rgba(255,59,48,0.12)', color: '#C0392B', label: 'high' };
};

const AdminBI = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isSuperAdmin, loading: authLoading } = useAuth();
  const { locations } = useLocation2();
  const [preset, setPreset] = useState('30');
  const [startDate, setStartDate] = useState(daysAgoISO(29));
  const [endDate, setEndDate] = useState(todayISO());
  const [locationId, setLocationId] = useState('');
  const [data, setData] = useState(null);
  const [menuCost, setMenuCost] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [expandedLoc, setExpandedLoc] = useState(null);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isSuperAdmin)) {
      navigate(isAuthenticated ? '/admin' : '/admin-login');
    }
  }, [authLoading, isAuthenticated, isSuperAdmin, navigate]);

  const applyPreset = (id) => {
    setPreset(id);
    const p = PRESETS.find(x => x.id === id);
    if (!p) return;
    if (p.mtd) {
      const d = new Date(); d.setDate(1);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(todayISO());
    } else {
      setStartDate(daysAgoISO(p.days - 1));
      setEndDate(todayISO());
    }
  };

  const fetch = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const [bi, mc] = await Promise.all([
        api.adminBIOverview({ start_date: startDate, end_date: endDate, location_id: locationId || undefined }),
        api.adminBIMenuCost(locationId ? { location_id: locationId } : {}),
      ]);
      setData(bi);
      setMenuCost(mc?.items || []);
    } catch (e) {
      setErr(e?.message || 'Failed to load BI data');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, locationId]);

  useEffect(() => { if (isSuperAdmin) fetch(); }, [fetch, isSuperAdmin]);

  if (authLoading || !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
      </div>
    );
  }

  const kpi = data?.kpi || {};
  const byLoc = data?.by_location || [];
  const lband = labourBand(kpi.labour_pct || 0);
  const fband = foodBand(kpi.food_cost_pct || 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto" data-testid="admin-bi-page" style={{ background: '#F5F5F7', minHeight: '100vh' }}>
      <Link to="/admin" data-testid="bi-back-link" className="inline-flex items-center gap-1.5 text-xs font-medium mb-3 active:scale-95" style={{ color: '#007AFF', ...font }}>
        <ArrowLeft size={13} /> Dashboard
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: '#1D1D1F' }}>
            <TrendingUp size={20} color="white" strokeWidth={1.6} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: '#1D1D1F', ...font }}>Business Intelligence</h1>
            <p className="text-xs sm:text-sm" style={{ color: '#86868B', ...font }}>Labour %, Food Cost %, Margin · super admin only</p>
          </div>
        </div>
        <button
          data-testid="bi-refresh-btn"
          onClick={fetch}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold active:scale-95 disabled:opacity-50"
          style={{ background: '#FFFFFF', color: '#1D1D1F', boxShadow: '0 0 0 1px rgba(0,0,0,0.08)', ...font }}
        >
          <RefreshCcw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl p-4 mb-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map(p => (
            <button
              key={p.id}
              data-testid={`bi-preset-${p.id}`}
              onClick={() => applyPreset(p.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold active:scale-95 transition-colors`}
              style={preset === p.id
                ? { background: '#1D1D1F', color: '#FFFFFF', ...font }
                : { background: '#F5F5F7', color: '#1D1D1F', ...font }}
            >
              {p.label}
            </button>
          ))}
          <div className="h-5 w-px mx-2" style={{ background: 'rgba(0,0,0,0.08)' }} />
          <div className="flex items-center gap-1.5">
            <label className="text-[11px]" style={{ color: '#86868B', ...font }}>From</label>
            <input
              data-testid="bi-start-date"
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPreset(''); }}
              className="px-2 py-1.5 rounded-lg text-xs"
              style={{ background: '#F5F5F7', color: '#1D1D1F', ...font, border: 'none' }}
            />
            <label className="text-[11px] ml-1" style={{ color: '#86868B', ...font }}>To</label>
            <input
              data-testid="bi-end-date"
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPreset(''); }}
              className="px-2 py-1.5 rounded-lg text-xs"
              style={{ background: '#F5F5F7', color: '#1D1D1F', ...font, border: 'none' }}
            />
          </div>
          <div className="h-5 w-px mx-2" style={{ background: 'rgba(0,0,0,0.08)' }} />
          <select
            data-testid="bi-location-filter"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs"
            style={{ background: '#F5F5F7', color: '#1D1D1F', ...font, border: 'none' }}
          >
            <option value="">All locations</option>
            {locations?.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      </div>

      {err && (
        <div className="rounded-2xl p-4 mb-5 flex items-start gap-2" style={{ background: 'rgba(255,59,48,0.08)' }}>
          <AlertTriangle size={16} color="#C0392B" />
          <p className="text-xs" style={{ color: '#C0392B', ...font }}>{err}</p>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard
          testid="kpi-revenue"
          icon={DollarSign}
          label="Revenue"
          value={fmtGBP(kpi.total_revenue)}
          sub={`${kpi.entries || 0} sales entries · ${data?.period?.days || 0}d`}
          color="#34C759"
        />
        <KpiCard
          testid="kpi-labour"
          icon={Users}
          label="Labour"
          value={fmtGBP(kpi.total_labour)}
          sub={`${(kpi.total_hours || 0).toFixed(1)} hrs total`}
          color="#007AFF"
          accent={{ ...lband, label: `${kpi.labour_pct || 0}% · ${lband.label}` }}
        />
        <KpiCard
          testid="kpi-food-cost"
          icon={ChefHat}
          label="Est. Food Cost"
          value={fmtGBP(kpi.est_food_cost)}
          sub={`Based on linked recipes`}
          color="#FF9500"
          accent={{ ...fband, label: `${kpi.food_cost_pct || 0}% · ${fband.label}` }}
        />
        <KpiCard
          testid="kpi-margin"
          icon={Activity}
          label="Gross Margin"
          value={fmtGBP(kpi.gross_margin)}
          sub={`${kpi.gross_margin_pct || 0}% of revenue`}
          color="#AF52DE"
        />
      </div>

      {/* Per-location table */}
      <div className="rounded-2xl mb-5 overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: '#1D1D1F', ...font }}>By location</h2>
            <p className="text-[11px]" style={{ color: '#86868B', ...font }}>Sorted by revenue. Click a row for staff breakdown.</p>
          </div>
        </div>
        {loading ? (
          <div className="p-10 text-center">
            <div className="inline-block w-5 h-5 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
          </div>
        ) : byLoc.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm" style={{ color: '#86868B', ...font }}>No sales entries in this period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: 900 }}>
              <thead style={{ background: '#F5F5F7' }}>
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Location</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Revenue</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Hours</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Labour £</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Labour %</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Food %</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Margin</th>
                </tr>
              </thead>
              <tbody>
                {byLoc.map(loc => {
                  const lb = labourBand(loc.labour_pct);
                  const fb = foodBand(loc.food_cost_pct);
                  const isExpanded = expandedLoc === loc.location_id;
                  return (
                    <React.Fragment key={loc.location_id}>
                      <tr
                        data-testid={`bi-loc-row-${loc.location_id}`}
                        onClick={() => setExpandedLoc(isExpanded ? null : loc.location_id)}
                        style={{ borderTop: '1px solid rgba(0,0,0,0.04)', cursor: 'pointer' }}
                        className="hover:bg-gray-50"
                      >
                        <td className="px-4 py-3 text-sm font-medium" style={{ color: '#1D1D1F', ...font }}>
                          <div className="flex items-center gap-1.5">
                            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            <span>{loc.location_name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: '#F5F5F7', color: '#86868B' }}>{loc.days}d</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-mono" style={{ color: '#1D1D1F', ...font }}>{fmtGBP(loc.revenue)}</td>
                        <td className="px-4 py-3 text-sm text-right font-mono" style={{ color: '#1D1D1F', ...font }}>{loc.hours.toFixed(1)}</td>
                        <td className="px-4 py-3 text-sm text-right font-mono" style={{ color: '#1D1D1F', ...font }}>{fmtGBP(loc.labour)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: lb.bg, color: lb.color, ...font }}>
                            {loc.labour_pct}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: fb.bg, color: fb.color, ...font }}>
                            {loc.food_cost_pct}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-mono font-semibold" style={{ color: loc.gross_margin >= 0 ? '#1F8C42' : '#C0392B', ...font }}>
                          {fmtGBP(loc.gross_margin)}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr style={{ background: '#FAFAFA' }}>
                          <td colSpan={7} className="px-4 py-3">
                            <div className="text-[11px] font-semibold mb-2" style={{ color: '#86868B', ...font }}>
                              Staff breakdown · {loc.staff_breakdown.length} people · Coverage {loc.menu_coverage.items_with_recipe}/{loc.menu_coverage.total_items} menu items have recipes
                            </div>
                            {loc.staff_breakdown.length === 0 ? (
                              <p className="text-xs italic" style={{ color: '#86868B' }}>No staff hours recorded.</p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {loc.staff_breakdown.map(sb => (
                                  <div key={sb.name} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: '#FFFFFF' }}>
                                    <div>
                                      <div className="text-xs font-medium" style={{ color: '#1D1D1F', ...font }}>{sb.name}</div>
                                      <div className="text-[10px]" style={{ color: '#86868B', ...font }}>
                                        {sb.hours.toFixed(1)}h{sb.rate > 0 ? ` · £${sb.rate.toFixed(2)}/h` : ' · no rate set'}
                                      </div>
                                    </div>
                                    <div className="text-xs font-mono font-semibold" style={{ color: sb.cost > 0 ? '#1D1D1F' : '#FF9500', ...font }}>
                                      {sb.cost > 0 ? fmtGBP(sb.cost) : '—'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Menu cost breakdown */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <button
          data-testid="bi-menu-toggle"
          onClick={() => setShowMenu(s => !s)}
          className="w-full px-5 py-4 flex items-center justify-between active:bg-gray-50"
          style={{ borderBottom: showMenu ? '1px solid rgba(0,0,0,0.06)' : 'none' }}
        >
          <div className="text-left">
            <h2 className="text-sm font-semibold" style={{ color: '#1D1D1F', ...font }}>Menu cost breakdown</h2>
            <p className="text-[11px]" style={{ color: '#86868B', ...font }}>{menuCost.filter(x => x.has_recipe).length} of {menuCost.length} items have a recipe</p>
          </div>
          {showMenu ? <ChevronDown size={14} style={{ color: '#86868B' }} /> : <ChevronRight size={14} style={{ color: '#86868B' }} />}
        </button>
        {showMenu && (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: 760 }}>
              <thead style={{ background: '#F5F5F7' }}>
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Item</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Category</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Price</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Recipe £</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Food %</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Margin</th>
                </tr>
              </thead>
              <tbody>
                {menuCost.slice(0, 50).map(m => {
                  const fb = m.has_recipe ? foodBand(m.food_cost_pct) : { bg: '#F5F5F7', color: '#8E8E93', label: 'no recipe' };
                  return (
                    <tr key={m.id} data-testid={`bi-menu-row-${m.id}`} style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                      <td className="px-4 py-2.5 text-sm font-medium" style={{ color: '#1D1D1F', ...font }}>{m.name}</td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: '#86868B', ...font }}>{m.category}</td>
                      <td className="px-4 py-2.5 text-sm text-right font-mono" style={{ color: '#1D1D1F', ...font }}>{fmtGBP(m.price)}</td>
                      <td className="px-4 py-2.5 text-sm text-right font-mono" style={{ color: m.has_recipe ? '#1D1D1F' : '#C7C7CC', ...font }}>
                        {m.has_recipe ? fmtGBP(m.recipe_cost) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: fb.bg, color: fb.color, ...font }}>
                          {m.has_recipe ? `${m.food_cost_pct}%` : 'no recipe'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-right font-mono font-semibold" style={{ color: m.has_recipe ? (m.margin >= 0 ? '#1F8C42' : '#C0392B') : '#C7C7CC', ...font }}>
                        {m.has_recipe ? fmtGBP(m.margin) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {menuCost.length > 50 && (
              <p className="px-4 py-3 text-[11px] text-center" style={{ color: '#86868B', ...font }}>
                Showing top 50 of {menuCost.length} items. Use the location filter to narrow down.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Hint banner */}
      <div className="mt-5 p-4 rounded-2xl flex items-start gap-2" style={{ background: 'rgba(0,122,255,0.06)' }}>
        <Activity size={14} color="#007AFF" className="mt-0.5" />
        <div className="text-[11px]" style={{ color: '#1D1D1F', ...font }}>
          <strong>How this is calculated</strong> · Revenue from Daily Sales totals · Labour from staff hours × per-staff hourly rate (set in <Link to="/admin/staff" className="underline" style={{ color: '#007AFF' }}>Staff Table</Link>) · Food Cost from recipe ingredients on each menu item (set in <Link to="/admin-menu" className="underline" style={{ color: '#007AFF' }}>Menu Management</Link>). Items without a recipe contribute £0 to estimated food cost.
        </div>
      </div>
    </div>
  );
};

export default AdminBI;
