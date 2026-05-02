import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UtensilsCrossed, ClipboardList, ClipboardCheck, Store, Plus, Settings, ArrowUpRight, Thermometer, DollarSign, Power, Flame, Truck, Gauge, Droplet, Sparkles, Shield } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';

const STATUS_STYLES = {
  pending: { bg: 'rgba(255,204,0,0.1)', color: '#CC8800' },
  confirmed: { bg: 'rgba(0,122,255,0.1)', color: '#007AFF' },
  preparing: { bg: 'rgba(175,82,222,0.1)', color: '#AF52DE' },
  ready: { bg: 'rgba(52,199,89,0.1)', color: '#34C759' },
  collected: { bg: 'rgba(142,142,147,0.1)', color: '#8E8E93' },
  cancelled: { bg: 'rgba(255,59,48,0.1)', color: '#FF3B30' },
};

const StatCard = ({ icon: IconComp, label, value, color, to }) => (
  <Link to={to} data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`} className="group p-5 rounded-2xl transition-all duration-200 hover:-translate-y-0.5" style={{ background: '#FFFFFF' }}>
    <div className="flex items-center justify-between mb-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: color }}>
        <IconComp size={20} color="white" strokeWidth={1.5} />
      </div>
      <ArrowUpRight size={14} style={{ color: '#86868B' }} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
    </div>
    <p className="text-2xl font-semibold tracking-tight" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>{value}</p>
    <p className="text-xs mt-1" style={{ color: '#86868B' }}>{label}</p>
  </Link>
);

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isStaff, isAdmin, loading: authLoading } = useAuth();
  const { locations } = useLocation2();
  const [stats, setStats] = useState({ menuItems: 0, orders: 0, openSites: 0 });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [compliance, setCompliance] = useState(null);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isStaff)) navigate('/admin-login');
  }, [authLoading, isAuthenticated, isStaff, navigate]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [menuItems, orders, siteSettings] = await Promise.all([
          api.adminGetMenuItems().catch(() => []),
          api.adminGetOrders().catch(() => []),
          api.adminGetSiteSettings().catch(() => []),
        ]);
        setStats({ menuItems: menuItems.length, orders: orders.length, openSites: siteSettings.filter(s => s.ordering_enabled).length });
        setRecentOrders(orders.slice(0, 5));
      } catch {} finally { setLoading(false); }
    };
    if (isAuthenticated && isStaff) fetchStats();
  }, [isAuthenticated, isStaff]);

  useEffect(() => {
    const fetchCompliance = async () => {
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 6 * 864e5).toISOString().split('T')[0];
      try { setCompliance(await api.adminGetCompliance({ start_date: weekAgo, end_date: today })); }
      catch {}
    };
    if (isAdmin) fetchCompliance();
  }, [isAdmin]);

  if (authLoading || loading) return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="h-7 w-40 rounded-lg animate-pulse" style={{ background: '#E8E8ED' }} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: '#E8E8ED' }} />)}
      </div>
    </div>
  );
  if (!isAuthenticated || !isStaff) return null;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: '#86868B' }}>Here's what's happening today.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={UtensilsCrossed} label="Menu Items" value={stats.menuItems} color="#1D1D1F" to="/admin/menu" />
        <StatCard icon={ClipboardList} label="Total Orders" value={stats.orders} color="#007AFF" to="/admin/orders" />
        <StatCard icon={Store} label="Sites Open" value={`${stats.openSites}/${locations.length}`} color="#FF9500" to="/admin/site-settings" />
      </div>

      {/* Compliance widget (admin+ only) */}
      {isAdmin && compliance && (
        <Link to="/admin/compliance" data-testid="compliance-widget" className="block p-5 rounded-2xl transition-all hover:-translate-y-0.5" style={{ background: '#FFFFFF' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#1D1D1F' }}>
                <Shield size={18} color="white" strokeWidth={1.8} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>Food Safety Compliance</p>
                <p className="text-[11px]" style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}>Last 7 days · EHO-ready</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-semibold" data-testid="compliance-widget-pct" style={{ color: compliance.overall_pct >= 90 ? '#34C759' : compliance.overall_pct >= 60 ? '#FF9500' : '#FF3B30', fontFamily: 'Outfit, sans-serif' }}>{compliance.overall_pct}%</p>
              <p className="text-[11px]" style={{ color: '#86868B' }}>Overall</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {compliance.sites.slice(0, 5).map(s => (
              <div key={s.location_id} className="px-3 py-2 rounded-lg flex items-center justify-between" style={{ background: '#F5F5F7' }}>
                <span className="text-[11px] font-medium truncate mr-2" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>{s.location_name}</span>
                <span className="text-[11px] font-semibold shrink-0" style={{ color: s.compliance_pct >= 90 ? '#34C759' : s.compliance_pct >= 60 ? '#FF9500' : '#FF3B30', fontFamily: 'Outfit, sans-serif' }}>{s.compliance_pct}%</span>
              </div>
            ))}
          </div>
        </Link>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="/admin/daily-sales" data-testid="quick-daily-sales" className="group flex items-center gap-4 p-5 rounded-2xl transition-all duration-200 hover:-translate-y-0.5" style={{ background: '#FFFFFF' }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#34C759' }}>
            <DollarSign size={22} color="white" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>Daily Sales</p>
            <p className="text-xs" style={{ color: '#86868B' }}>Record today's sales</p>
          </div>
        </Link>
        <Link to="/admin/temp-monitor" data-testid="quick-temp-log" className="group flex items-center gap-4 p-5 rounded-2xl transition-all duration-200 hover:-translate-y-0.5" style={{ background: '#FFFFFF' }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#007AFF' }}>
            <Thermometer size={22} color="white" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>Temp Log</p>
            <p className="text-xs" style={{ color: '#86868B' }}>Record temperatures</p>
          </div>
        </Link>
        <Link to="/admin/daily-checks" data-testid="quick-daily-checks" className="group flex items-center gap-4 p-5 rounded-2xl transition-all duration-200 hover:-translate-y-0.5" style={{ background: '#FFFFFF' }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#FF9500' }}>
            <ClipboardCheck size={22} color="white" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>Daily Checks</p>
            <p className="text-xs" style={{ color: '#86868B' }}>Opening checklist</p>
          </div>
        </Link>
        <Link to="/admin/kitchen-closedown" data-testid="quick-kitchen-closedown" className="group flex items-center gap-4 p-5 rounded-2xl transition-all duration-200 hover:-translate-y-0.5" style={{ background: '#FFFFFF' }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#5856D6' }}>
            <Power size={22} color="white" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>Closedown</p>
            <p className="text-xs" style={{ color: '#86868B' }}>End-of-day checks</p>
          </div>
        </Link>
        <Link to="/admin/cooked-temp" data-testid="quick-cooked-temp" className="group flex items-center gap-4 p-5 rounded-2xl transition-all duration-200 hover:-translate-y-0.5" style={{ background: '#FFFFFF' }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#FF3B30' }}>
            <Flame size={22} color="white" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>Cook Temp</p>
            <p className="text-xs" style={{ color: '#86868B' }}>Food ≥ 75°C</p>
          </div>
        </Link>
        <Link to="/admin/delivery-records" data-testid="quick-deliveries" className="group flex items-center gap-4 p-5 rounded-2xl transition-all duration-200 hover:-translate-y-0.5" style={{ background: '#FFFFFF' }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#30B0C7' }}>
            <Truck size={22} color="white" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>Deliveries</p>
            <p className="text-xs" style={{ color: '#86868B' }}>Log incoming stock</p>
          </div>
        </Link>
        <Link to="/admin/probe-calibration" data-testid="quick-probe-cal" className="group flex items-center gap-4 p-5 rounded-2xl transition-all duration-200 hover:-translate-y-0.5" style={{ background: '#FFFFFF' }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#AF52DE' }}>
            <Gauge size={22} color="white" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>Probe Cal.</p>
            <p className="text-xs" style={{ color: '#86868B' }}>Thermometer test</p>
          </div>
        </Link>
        <Link to="/admin/legionella" data-testid="quick-legionella" className="group flex items-center gap-4 p-5 rounded-2xl transition-all duration-200 hover:-translate-y-0.5" style={{ background: '#FFFFFF' }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#00C7BE' }}>
            <Droplet size={22} color="white" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>Legionella</p>
            <p className="text-xs" style={{ color: '#86868B' }}>Weekly water test</p>
          </div>
        </Link>
        <Link to="/admin/daily-cleaning" data-testid="quick-daily-cleaning" className="group flex items-center gap-4 p-5 rounded-2xl transition-all duration-200 hover:-translate-y-0.5" style={{ background: '#FFFFFF' }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#5AC8FA' }}>
            <Sparkles size={22} color="white" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>Daily Clean</p>
            <p className="text-xs" style={{ color: '#86868B' }}>Cleaning schedule</p>
          </div>
        </Link>
        <Link to="/admin/weekly-cleaning" data-testid="quick-weekly-cleaning" className="group flex items-center gap-4 p-5 rounded-2xl transition-all duration-200 hover:-translate-y-0.5" style={{ background: '#FFFFFF' }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#BF5AF2' }}>
            <Sparkles size={22} color="white" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>Weekly Deep</p>
            <p className="text-xs" style={{ color: '#86868B' }}>Deep clean tasks</p>
          </div>
        </Link>
      </div>

      {/* Recent Orders */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF' }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
          <h2 className="text-base font-semibold tracking-tight" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>Recent Orders</h2>
          <Link to="/admin/orders" className="text-xs font-medium" style={{ color: '#007AFF' }}>View all</Link>
        </div>
        {recentOrders.length === 0 ? (
          <div className="p-10 text-center">
            <ClipboardList size={32} className="mx-auto mb-3" style={{ color: '#D1D1D6' }} strokeWidth={1.5} />
            <p className="text-sm" style={{ color: '#86868B' }}>No orders yet</p>
          </div>
        ) : (
          <div>
            {recentOrders.map((order, i) => {
              const s = STATUS_STYLES[order.status] || STATUS_STYLES.pending;
              return (
                <div key={order.id} className="px-5 py-3 flex items-center justify-between gap-3 transition-colors hover:bg-black/[0.02]" style={{ borderTop: i > 0 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-semibold tracking-tight shrink-0" style={{ color: '#007AFF', fontFamily: 'Outfit, sans-serif' }}>{order.order_number}</span>
                    <span className="text-sm truncate hidden sm:inline" style={{ color: '#86868B' }}>{order.customer_name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>{'\u00A3'}{order.total?.toFixed(2)}</span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: s.bg, color: s.color }}>
                      {order.status?.charAt(0).toUpperCase() + order.status?.slice(1)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { to: '/admin/menu', icon: Plus, label: 'Add Menu Item', desc: 'Create a new dish', color: '#1D1D1F' },
          { to: '/admin/site-settings', icon: Settings, label: 'Site Settings', desc: 'Hours & ordering', color: '#FF9500' },
        ].map(a => (
          <Link key={a.to} to={a.to} className="p-5 rounded-2xl transition-all duration-200 group hover:-translate-y-0.5" style={{ background: '#FFFFFF' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-all" style={{ background: `${a.color}10` }}>
                <a.icon size={20} style={{ color: a.color }} strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>{a.label}</p>
                <p className="text-xs" style={{ color: '#86868B' }}>{a.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;
