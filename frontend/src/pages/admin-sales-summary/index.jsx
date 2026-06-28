import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import {
  BarChart3, MapPin, Clock, Filter, PoundSterling, ChevronDown, ArrowLeft, TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';

/** ISO week label "YYYY-Www" for a date string (YYYY-MM-DD). */
const isoWeek = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const w = Math.ceil((((t - yearStart) / 86400000) + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(w).padStart(2, '0')}`;
};

/** Aggregate the daily timeseries returned by the API into the chosen
 *  granularity. Returns an array of { bucket, sales, cash, entries } sorted
 *  chronologically — ready for Recharts to consume. */
const rollUp = (series, granularity) => {
  if (!series?.length) return [];
  if (granularity === 'daily') return series.map(r => ({ bucket: r.date, ...r }));
  const acc = new Map();
  for (const row of series) {
    let key;
    if (granularity === 'weekly')      key = isoWeek(row.date);
    else if (granularity === 'monthly') key = row.date.slice(0, 7);            // YYYY-MM
    else                                key = row.date.slice(0, 4);            // YYYY
    if (!acc.has(key)) acc.set(key, { bucket: key, sales: 0, cash: 0, entries: 0, labour_hours: 0, labour_cost: 0 });
    const s = acc.get(key);
    s.sales += row.sales;
    s.cash += row.cash;
    s.entries += row.entries;
    s.labour_hours += (row.labour_hours || 0);
    s.labour_cost += (row.labour_cost || 0);
  }
  return Array.from(acc.values())
    .map(r => ({
      ...r,
      sales: +r.sales.toFixed(2),
      cash: +r.cash.toFixed(2),
      labour_hours: +r.labour_hours.toFixed(2),
      labour_cost: +r.labour_cost.toFixed(2),
    }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket));
};

const fmtMoney = (v) => `£${(v ?? 0).toFixed(2)}`;
const fmtBucket = (key, granularity) => {
  if (granularity === 'yearly')  return key;
  if (granularity === 'monthly') {
    const d = new Date(`${key}-01T00:00:00Z`);
    return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
  }
  if (granularity === 'weekly') return key.replace('-W', ' wk ');
  // daily
  const d = new Date(`${key}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

const AdminSalesSummary = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, loading: authLoading } = useAuth();
  const { locations } = useLocation2();
  const routerLocation = useLocation();
  const isJkhive = routerLocation.pathname.startsWith('/jkhive');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [expandedStaff, setExpandedStaff] = useState(null);

  // Default to current month
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const today = now.toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [locationFilter, setLocationFilter] = useState(''); // '' = All sites
  const [granularity, setGranularity] = useState('daily');  // 'daily' | 'weekly' | 'monthly' | 'yearly'
  // Independent granularity for the Labour % chart so managers can compare
  // a daily labour view against a weekly/monthly Sales Trend.
  const [labourGranularity, setLabourGranularity] = useState('daily');

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) navigate('/admin-login');
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.adminGetSalesSummary({
        start_date: startDate,
        end_date: endDate,
        location_id: locationFilter || undefined,
      });
      setData(d);
    } catch (err) {
      console.error('Failed to load summary:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, locationFilter]);

  // Auto-refetch when filters change (date inputs apply via the button so the
  // user doesn't get whiplash mid-typing, but location/granularity are instant).
  // Initial load + auto-refetch when the location filter changes. Date
  // changes still require the Apply button so the user isn't surprised by a
  // refetch every keystroke.
  useEffect(() => {
    if (isAuthenticated && isAdmin) fetchSummary();
  }, [isAuthenticated, isAdmin, locationFilter]);

  const getLocationName = (locId) => locations.find(l => l.id === locId)?.name || locId;

  const chartData = useMemo(() => rollUp(data?.timeseries || [], granularity), [data, granularity]);
  const labourTrendData = useMemo(() => {
    const rolled = rollUp(data?.timeseries || [], labourGranularity);
    return rolled
      .map(r => ({
        ...r,
        pct: r.sales > 0 ? +((r.labour_cost / r.sales) * 100).toFixed(2) : 0,
      }))
      // Drop buckets with no labour cost AND no sales to avoid a flat zero line.
      .filter(r => r.labour_cost > 0 || r.sales > 0);
  }, [data, labourGranularity]);
  const labourOverallPct = useMemo(() => {
    const totalCost = labourTrendData.reduce((a, r) => a + r.labour_cost, 0);
    const totalRev = labourTrendData.reduce((a, r) => a + r.sales, 0);
    return totalRev > 0 ? (totalCost / totalRev) * 100 : 0;
  }, [labourTrendData]);
  // Friendly average per bucket — handy summary tile.
  const avgPerBucket = chartData.length ? (chartData.reduce((s, r) => s + r.sales, 0) / chartData.length) : 0;
  const peak = chartData.reduce((best, r) => (r.sales > (best?.sales || 0) ? r : best), null);

  if (authLoading) {
    return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>;
  }

  const font = { fontFamily: 'Outfit, sans-serif' };
  const cardStyle = { background: '#FFFFFF', borderRadius: '16px' };

  return (
    <div className={isJkhive ? 'px-4 sm:px-6 lg:px-8 pt-2 pb-4 max-w-5xl mx-auto' : 'p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto'} data-testid="admin-sales-summary-page">
      {/* Header */}
      {isJkhive ? (
        <Link
          to="/jkhive/manager"
          data-testid="back-to-jkhive"
          className="inline-flex items-center gap-1.5 -ml-1 px-1 py-1 mb-1 rounded-lg active:scale-95"
          style={{ color: '#1D1D1F', ...font }}
        >
          <ArrowLeft size={20} strokeWidth={2.4} style={{ color: '#007AFF' }} />
          <span className="text-xl sm:text-2xl font-semibold tracking-tight">Sales Summary</span>
        </Link>
      ) : (
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: '#1D1D1F', ...font }}>Sales Summary</h1>
      )}
      <div className="mb-5">
        <p className="text-xs sm:text-sm mt-1" style={{ color: '#86868B' }}>Overview of sales, cash, and staff hours</p>
      </div>

      {/* Filters: date range + location + apply */}
      <div className="flex flex-wrap gap-3 items-end mb-4">
        <div className="flex-1 min-w-[130px]">
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#86868B', ...font }}>From</label>
          <input data-testid="summary-start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm border-0 outline-none"
            style={{ background: '#FFFFFF', color: '#1D1D1F', ...font, boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }} />
        </div>
        <div className="flex-1 min-w-[130px]">
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#86868B', ...font }}>To</label>
          <input data-testid="summary-end-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm border-0 outline-none"
            style={{ background: '#FFFFFF', color: '#1D1D1F', ...font, boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }} />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#86868B', ...font }}>Location</label>
          <select data-testid="summary-location-filter" value={locationFilter} onChange={e => setLocationFilter(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm border-0 outline-none"
            style={{ background: '#FFFFFF', color: '#1D1D1F', ...font, boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }}>
            <option value="">All sites</option>
            {locations.filter(l => l.is_active !== false).map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
        <button data-testid="summary-apply-btn" onClick={fetchSummary}
          className="px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-1.5 active:scale-[0.98] transition-all"
          style={{ background: '#1D1D1F', color: '#FFFFFF', ...font }}>
          <Filter size={14} /> Apply
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>
      ) : !data ? (
        <div className="text-center py-16 rounded-2xl" style={cardStyle}>
          <BarChart3 size={32} className="mx-auto mb-3" style={{ color: '#C7C7CC' }} />
          <p className="text-sm" style={{ color: '#86868B', ...font }}>No data available.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Top cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 sm:p-5" style={cardStyle}>
              <PoundSterling size={18} className="mb-2" style={{ color: '#34C759' }} />
              <p className="text-xl sm:text-2xl font-bold" style={{ color: '#1D1D1F', ...font }}>{fmtMoney(data.total_sales)}</p>
              <p className="text-xs mt-0.5" style={{ color: '#86868B' }}>Total Sales</p>
            </div>
            <div className="p-4 sm:p-5" style={cardStyle}>
              <PoundSterling size={18} className="mb-2" style={{ color: '#007AFF' }} />
              <p className="text-xl sm:text-2xl font-bold" style={{ color: '#1D1D1F', ...font }}>{fmtMoney(data.total_cash)}</p>
              <p className="text-xs mt-0.5" style={{ color: '#86868B' }}>Total Cash</p>
            </div>
            <div className="p-4 sm:p-5" style={cardStyle}>
              <TrendingUp size={18} className="mb-2" style={{ color: '#FF9500' }} />
              <p className="text-xl sm:text-2xl font-bold" style={{ color: '#1D1D1F', ...font }}>{fmtMoney(avgPerBucket)}</p>
              <p className="text-xs mt-0.5" style={{ color: '#86868B' }}>Avg per {granularity === 'daily' ? 'day' : granularity.slice(0, -2)}</p>
            </div>
            <div className="p-4 sm:p-5" style={cardStyle}>
              <BarChart3 size={18} className="mb-2" style={{ color: '#AF52DE' }} />
              <p className="text-xl sm:text-2xl font-bold" style={{ color: '#1D1D1F', ...font }}>{data.total_entries}</p>
              <p className="text-xs mt-0.5" style={{ color: '#86868B' }}>Days Recorded</p>
            </div>
          </div>

          {/* Sales chart */}
          <div className="p-4 sm:p-5" style={cardStyle} data-testid="summary-chart">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2 flex-1" style={{ color: '#1D1D1F', ...font }}>
                <TrendingUp size={16} /> Sales Trend
                {peak && (
                  <span className="text-[11px] font-normal ml-2" style={{ color: '#86868B' }}>
                    · Peak {fmtBucket(peak.bucket, granularity)} {fmtMoney(peak.sales)}
                  </span>
                )}
              </h3>
              <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#F5F5F7' }} data-testid="summary-granularity">
                {[['daily', 'D'], ['weekly', 'W'], ['monthly', 'M'], ['yearly', 'Y']].map(([k, l]) => (
                  <button key={k}
                    data-testid={`summary-granularity-${k}`}
                    onClick={() => setGranularity(k)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: granularity === k ? '#FFFFFF' : 'transparent',
                      color: granularity === k ? '#1D1D1F' : '#86868B',
                      boxShadow: granularity === k ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                      ...font,
                    }}
                  >{l}</button>
                ))}
              </div>
            </div>
            {chartData.length === 0 ? (
              <p className="text-sm py-8 text-center" style={{ color: '#86868B', ...font }}>No sales in this range.</p>
            ) : (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  {granularity === 'daily' ? (
                    <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#34C759" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#34C759" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#007AFF" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#007AFF" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F3" vertical={false} />
                      <XAxis dataKey="bucket" tickFormatter={k => fmtBucket(k, granularity)} tick={{ fontSize: 11, fill: '#86868B' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#86868B' }} axisLine={false} tickLine={false} tickFormatter={v => `£${v}`} />
                      <Tooltip
                        labelFormatter={k => fmtBucket(k, granularity)}
                        formatter={(v) => fmtMoney(v)}
                        contentStyle={{ borderRadius: 12, border: '1px solid #E5E5EA', fontFamily: 'Outfit, sans-serif' }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'Outfit, sans-serif' }} />
                      <Area type="monotone" dataKey="sales" name="Sales" stroke="#34C759" strokeWidth={2} fill="url(#salesGrad)" />
                      <Area type="monotone" dataKey="cash"  name="Cash"  stroke="#007AFF" strokeWidth={2} fill="url(#cashGrad)" />
                    </AreaChart>
                  ) : (
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F3" vertical={false} />
                      <XAxis dataKey="bucket" tickFormatter={k => fmtBucket(k, granularity)} tick={{ fontSize: 11, fill: '#86868B' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#86868B' }} axisLine={false} tickLine={false} tickFormatter={v => `£${v}`} />
                      <Tooltip
                        labelFormatter={k => fmtBucket(k, granularity)}
                        formatter={(v) => fmtMoney(v)}
                        contentStyle={{ borderRadius: 12, border: '1px solid #E5E5EA', fontFamily: 'Outfit, sans-serif' }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'Outfit, sans-serif' }} />
                      <Bar dataKey="sales" name="Sales" fill="#34C759" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="cash"  name="Cash"  fill="#007AFF" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Sales by Location — only when "All sites" is active. */}
          {!locationFilter && (
            <div className="p-4 sm:p-5" style={cardStyle}>
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '#1D1D1F', ...font }}>
                <MapPin size={16} /> Sales by Location
              </h3>
              {Object.keys(data.by_location).length === 0 ? (
                <p className="text-sm py-4 text-center" style={{ color: '#86868B' }}>No location data</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(data.by_location)
                    .sort((a, b) => b[1].sales - a[1].sales)
                    .map(([locId, loc]) => {
                      const pct = data.total_sales > 0 ? (loc.sales / data.total_sales) * 100 : 0;
                      return (
                        <div key={locId} data-testid={`loc-row-${locId}`}>
                          <div className="flex items-center justify-between mb-1.5">
                            <button
                              data-testid={`loc-drilldown-${locId}`}
                              onClick={() => setLocationFilter(locId)}
                              className="text-sm font-medium truncate mr-2 text-left hover:underline"
                              style={{ color: '#1D1D1F', ...font, background: 'transparent', border: 0, padding: 0, cursor: 'pointer' }}
                            >{getLocationName(locId)}</button>
                            <p className="text-sm font-semibold shrink-0" style={{ color: '#1D1D1F', ...font }}>{fmtMoney(loc.sales)}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '#F5F5F7' }}>
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: '#34C759' }} />
                            </div>
                            <span className="text-[11px] shrink-0 w-10 text-right" style={{ color: '#86868B' }}>{pct.toFixed(0)}%</span>
                          </div>
                          <div className="flex gap-4 mt-1">
                            <span className="text-[11px]" style={{ color: '#86868B' }}>Cash: {fmtMoney(loc.cash)}</span>
                            <span className="text-[11px]" style={{ color: '#86868B' }}>{loc.days} day{loc.days !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* Labour % by Revenue — manager-level trend chart. Independent
              granularity toggle mirrors the Sales Trend pattern so managers
              can flip between Daily/Weekly/Monthly/Yearly without affecting
              the Sales Trend card above. Card hides when no labour cost has
              been logged in the date range (e.g. staff lack hourly_rate). */}
          {labourTrendData.some(r => r.labour_cost > 0) && (
            <div className="p-4 sm:p-5" data-testid="labour-by-location-card" style={cardStyle}>
              <div className="flex items-center justify-between mb-3 gap-2">
                <h3 className="text-sm font-semibold flex items-center gap-2 flex-wrap" style={{ color: '#1D1D1F', ...font }}>
                  <TrendingUp size={16} /> Labour % by Revenue
                  <span className="text-[11px] font-medium" style={{ color: labourOverallPct <= 28 ? '#1F8A3E' : labourOverallPct <= 35 ? '#A35E00' : '#C0392B', ...font }}>
                    · Overall {labourOverallPct.toFixed(1)}%
                  </span>
                </h3>
                <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#F5F5F7' }} data-testid="labour-granularity">
                  {['daily', 'weekly', 'monthly', 'yearly'].map(k => (
                    <button
                      key={k}
                      data-testid={`labour-granularity-${k}`}
                      onClick={() => setLabourGranularity(k)}
                      className="px-2 py-1 text-[11px] font-medium rounded-lg transition-all"
                      style={{
                        background: labourGranularity === k ? '#FFFFFF' : 'transparent',
                        color: labourGranularity === k ? '#1D1D1F' : '#86868B',
                        boxShadow: labourGranularity === k ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                        border: 0, cursor: 'pointer', ...font,
                      }}
                    >{k[0].toUpperCase() + k.slice(1)}</button>
                  ))}
                </div>
              </div>
              {labourTrendData.length === 0 ? (
                <p className="text-sm py-6 text-center" style={{ color: '#86868B', ...font }}>No labour data in this range</p>
              ) : (
                <div style={{ width: '100%', height: 240 }}>
                  <ResponsiveContainer>
                    <AreaChart data={labourTrendData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="labourPctFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#AF52DE" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#AF52DE" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                      <XAxis
                        dataKey="bucket"
                        tick={{ fontSize: 11, fill: '#86868B' }}
                        axisLine={false} tickLine={false}
                        tickFormatter={(v) => fmtBucket(v, labourGranularity)}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#86868B' }}
                        axisLine={false} tickLine={false}
                        tickFormatter={(v) => `${v.toFixed(0)}%`}
                        domain={[0, (dataMax) => Math.max(40, Math.ceil((dataMax + 5) / 5) * 5)]}
                      />
                      <Tooltip
                        cursor={{ stroke: 'rgba(0,0,0,0.08)' }}
                        contentStyle={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 12, fontSize: 12 }}
                        labelFormatter={(v) => fmtBucket(v, labourGranularity)}
                        formatter={(value, _name, ctx) => {
                          const row = ctx.payload;
                          return [`${value.toFixed(1)}%  ·  ${fmtMoney(row.labour_cost)} on ${fmtMoney(row.sales)}`, 'Labour %'];
                        }}
                      />
                      {/* Industry thresholds — visualised as horizontal guides. */}
                      <ReferenceLine y={28} stroke="#34C759" strokeDasharray="4 4" />
                      <ReferenceLine y={35} stroke="#FF3B30" strokeDasharray="4 4" />
                      <Area
                        type="monotone"
                        dataKey="pct"
                        stroke="#AF52DE"
                        strokeWidth={2}
                        fill="url(#labourPctFill)"
                        dot={{ r: 3, fill: '#AF52DE' }}
                        activeDot={{ r: 5 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
              <p className="text-[11px] mt-1" style={{ color: '#86868B', ...font }}>
                Guideline: under 30% is healthy. Green dashed line = 28%, red dashed line = 35%.
              </p>
            </div>
          )}

          {/* Staff Hours */}
          <div className="p-4 sm:p-5" style={cardStyle}>
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '#1D1D1F', ...font }}>
              <Clock size={16} /> Total Hours by Staff
            </h3>
            {data.staff_hours.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: '#86868B' }}>No staff hours recorded</p>
            ) : (
              <div className="space-y-1">
                {data.staff_hours.map((s, i) => {
                  const maxHrs = data.staff_hours[0]?.total_hours || 1;
                  const pct = (s.total_hours / maxHrs) * 100;
                  const isOpen = expandedStaff === s.name;
                  return (
                    <div key={s.name} data-testid={`staff-row-${i}`}>
                      <button
                        onClick={() => setExpandedStaff(isOpen ? null : s.name)}
                        className="w-full flex items-center gap-3 py-2.5 px-1 rounded-lg transition-colors active:bg-gray-50"
                      >
                        <p className="text-sm font-medium w-24 sm:w-32 truncate shrink-0 text-left" style={{ color: '#1D1D1F', ...font }}>{s.name}</p>
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '#F5F5F7' }}>
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: '#007AFF' }} />
                        </div>
                        <div className="text-right shrink-0 w-16">
                          <p className="text-sm font-semibold" style={{ color: '#1D1D1F', ...font }}>{s.total_hours}h</p>
                          <p className="text-[10px]" style={{ color: '#86868B' }}>{s.shifts} shift{s.shifts !== 1 ? 's' : ''}</p>
                        </div>
                        <ChevronDown size={14} className="shrink-0" style={{ color: '#86868B', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                      </button>

                      {isOpen && s.daily?.length > 0 && (
                        <div className="ml-1 mr-1 mb-2 mt-1 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.04)' }}>
                          <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2" style={{ background: '#F5F5F7' }}>
                            <span className="text-[11px] font-medium" style={{ color: '#86868B' }}>Date / Location</span>
                            <span className="text-[11px] font-medium text-right w-20" style={{ color: '#86868B' }}>Time</span>
                            <span className="text-[11px] font-medium text-right w-12" style={{ color: '#86868B' }}>Hrs</span>
                          </div>
                          {s.daily.map((d, di) => (
                            <div key={di} className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2.5 items-center" style={{ borderTop: di > 0 ? '1px solid rgba(0,0,0,0.04)' : 'none', background: '#FFFFFF' }}>
                              <div className="min-w-0">
                                <p className="text-xs font-medium" style={{ color: '#1D1D1F', ...font }}>{d.date}</p>
                                <p className="text-[11px] truncate" style={{ color: '#86868B' }}>{getLocationName(d.location_id)}</p>
                              </div>
                              <p className="text-xs text-right w-20" style={{ color: '#3A3A3C', ...font }}>{d.start_time} – {d.end_time}</p>
                              <p className="text-xs font-semibold text-right w-12" style={{ color: '#1D1D1F', ...font }}>{d.hours}h</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSalesSummary;
