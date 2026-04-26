import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, MapPin, Clock, Filter, PoundSterling, ChevronDown } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';

const AdminSalesSummary = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, loading: authLoading } = useAuth();
  const { locations } = useLocation2();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [expandedStaff, setExpandedStaff] = useState(null);

  // Default to current month
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const today = now.toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) navigate('/admin-login');
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) fetchSummary();
  }, [isAuthenticated, isAdmin]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const d = await api.adminGetSalesSummary({ start_date: startDate, end_date: endDate });
      setData(d);
    } catch (err) {
      console.error('Failed to load summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const getLocationName = (locId) => locations.find(l => l.id === locId)?.name || locId;

  if (authLoading) {
    return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>;
  }

  const font = { fontFamily: 'Outfit, sans-serif' };
  const cardStyle = { background: '#FFFFFF', borderRadius: '16px' };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto" data-testid="admin-sales-summary-page">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: '#1D1D1F', ...font }}>Sales Summary</h1>
        <p className="text-xs sm:text-sm mt-1" style={{ color: '#86868B' }}>Overview of sales, cash, and staff hours</p>
      </div>

      {/* Date Filter */}
      <div className="flex flex-wrap gap-3 items-end mb-6">
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-4 sm:p-5" style={cardStyle}>
              <PoundSterling size={18} className="mb-2" style={{ color: '#34C759' }} />
              <p className="text-xl sm:text-2xl font-bold" style={{ color: '#1D1D1F', ...font }}>{'\u00A3'}{data.total_sales.toFixed(2)}</p>
              <p className="text-xs mt-0.5" style={{ color: '#86868B' }}>Total Sales</p>
            </div>
            <div className="p-4 sm:p-5" style={cardStyle}>
              <PoundSterling size={18} className="mb-2" style={{ color: '#007AFF' }} />
              <p className="text-xl sm:text-2xl font-bold" style={{ color: '#1D1D1F', ...font }}>{'\u00A3'}{data.total_cash.toFixed(2)}</p>
              <p className="text-xs mt-0.5" style={{ color: '#86868B' }}>Total Cash</p>
            </div>
            <div className="p-4 sm:p-5 col-span-2 sm:col-span-1" style={cardStyle}>
              <BarChart3 size={18} className="mb-2" style={{ color: '#AF52DE' }} />
              <p className="text-xl sm:text-2xl font-bold" style={{ color: '#1D1D1F', ...font }}>{data.total_entries}</p>
              <p className="text-xs mt-0.5" style={{ color: '#86868B' }}>Days Recorded</p>
            </div>
          </div>

          {/* Sales by Location */}
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
                          <p className="text-sm font-medium truncate mr-2" style={{ color: '#1D1D1F', ...font }}>{getLocationName(locId)}</p>
                          <p className="text-sm font-semibold shrink-0" style={{ color: '#1D1D1F', ...font }}>{'\u00A3'}{loc.sales.toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '#F5F5F7' }}>
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: '#34C759' }} />
                          </div>
                          <span className="text-[11px] shrink-0 w-10 text-right" style={{ color: '#86868B' }}>{pct.toFixed(0)}%</span>
                        </div>
                        <div className="flex gap-4 mt-1">
                          <span className="text-[11px]" style={{ color: '#86868B' }}>Cash: {'\u00A3'}{loc.cash.toFixed(2)}</span>
                          <span className="text-[11px]" style={{ color: '#86868B' }}>{loc.days} day{loc.days !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

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
                          {/* Header */}
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
