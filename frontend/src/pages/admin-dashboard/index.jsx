import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UtensilsCrossed, ClipboardList, Users, Store, Plus, UserPlus, Settings, ArrowUpRight, Thermometer, DollarSign } from 'lucide-react';
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
  const { isAuthenticated, isStaff, loading: authLoading } = useAuth();
  const { locations } = useLocation2();
  const [stats, setStats] = useState({ menuItems: 0, orders: 0, residents: 0, openSites: 0 });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isStaff)) navigate('/admin-login');
  }, [authLoading, isAuthenticated, isStaff, navigate]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [menuItems, orders, residents, siteSettings] = await Promise.all([
          api.adminGetMenuItems().catch(() => []),
          api.adminGetOrders().catch(() => []),
          api.adminGetResidents().catch(() => []),
          api.adminGetSiteSettings().catch(() => []),
        ]);
        setStats({ menuItems: menuItems.length, orders: orders.length, residents: residents.length, openSites: siteSettings.filter(s => s.ordering_enabled).length });
        setRecentOrders(orders.slice(0, 5));
      } catch {} finally { setLoading(false); }
    };
    if (isAuthenticated && isStaff) fetchStats();
  }, [isAuthenticated, isStaff]);

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={UtensilsCrossed} label="Menu Items" value={stats.menuItems} color="#1D1D1F" to="/admin/menu" />
        <StatCard icon={ClipboardList} label="Total Orders" value={stats.orders} color="#007AFF" to="/admin/orders" />
        <StatCard icon={Users} label="Residents" value={stats.residents} color="#34C759" to="/admin/residents" />
        <StatCard icon={Store} label="Sites Open" value={`${stats.openSites}/${locations.length}`} color="#FF9500" to="/admin/site-settings" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { to: '/admin/menu', icon: Plus, label: 'Add Menu Item', desc: 'Create a new dish', color: '#1D1D1F' },
          { to: '/admin/residents', icon: UserPlus, label: 'Add Resident', desc: 'Register new resident', color: '#34C759' },
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
