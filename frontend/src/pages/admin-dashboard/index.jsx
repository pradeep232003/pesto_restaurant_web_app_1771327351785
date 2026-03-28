import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { LOCATIONS } from '../../contexts/LocationContext';

const StatCard = ({ icon, label, value, color, to }) => (
  <Link to={to} data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`} className="bg-card rounded-xl shadow-warm p-5 hover:shadow-lg transition-all duration-200 group">
    <div className="flex items-center justify-between mb-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon name={icon} size={20} color="white" />
      </div>
      <Icon name="ArrowUpRight" size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
    </div>
    <p className="text-2xl font-heading font-bold text-foreground">{value}</p>
    <p className="text-xs text-muted-foreground font-body mt-1">{label}</p>
  </Link>
);

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({ menuItems: 0, orders: 0, residents: 0, openSites: 0 });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) navigate('/admin-login');
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [menuItems, orders, residents, siteSettings] = await Promise.all([
          api.adminGetMenuItems().catch(() => []),
          api.adminGetOrders().catch(() => []),
          api.adminGetResidents().catch(() => []),
          api.adminGetSiteSettings().catch(() => []),
        ]);
        const openSites = siteSettings.filter(s => s.ordering_enabled).length;
        setStats({
          menuItems: menuItems.length,
          orders: orders.length,
          residents: residents.length,
          openSites,
        });
        setRecentOrders(orders.slice(0, 5));
      } catch {} finally {
        setLoading(false);
      }
    };
    if (isAuthenticated && isAdmin) fetchStats();
  }, [isAuthenticated, isAdmin]);

  if (authLoading || loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) return null;

  const STATUS_COLORS = {
    pending: 'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-blue-100 text-blue-700',
    preparing: 'bg-purple-100 text-purple-700',
    ready: 'bg-green-100 text-green-700',
    collected: 'bg-gray-100 text-gray-600',
    cancelled: 'bg-red-100 text-red-600',
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Welcome back. Here's an overview of your restaurant.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="UtensilsCrossed" label="Menu Items" value={stats.menuItems} color="bg-primary" to="/admin/menu" />
        <StatCard icon="ClipboardList" label="Total Orders" value={stats.orders} color="bg-blue-500" to="/admin/orders" />
        <StatCard icon="Users" label="Residents" value={stats.residents} color="bg-emerald-500" to="/admin/residents" />
        <StatCard icon="Store" label="Sites Open" value={`${stats.openSites}/${LOCATIONS.length}`} color="bg-amber-500" to="/admin/site-settings" />
      </div>

      {/* Recent Orders */}
      <div className="bg-card rounded-xl shadow-warm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-heading font-bold text-foreground">Recent Orders</h2>
          <Link to="/admin/orders" className="text-xs text-primary font-body font-medium hover:underline">View all</Link>
        </div>
        {recentOrders.length === 0 ? (
          <div className="p-8 text-center">
            <Icon name="ClipboardList" size={32} color="var(--color-muted-foreground)" className="mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No orders yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recentOrders.map(order => (
              <div key={order.id} className="px-6 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-4">
                  <span className="font-mono font-bold text-sm text-primary">{order.order_number}</span>
                  <span className="text-sm text-muted-foreground">{order.customer_name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-heading font-bold text-sm">{'\u00A3'}{order.total?.toFixed(2)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-body font-medium ${STATUS_COLORS[order.status] || 'bg-muted'}`}>
                    {order.status?.charAt(0).toUpperCase() + order.status?.slice(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/admin/menu" className="bg-card rounded-xl shadow-warm p-5 hover:shadow-lg transition-all group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Icon name="Plus" size={20} color="var(--color-primary)" />
            </div>
            <div>
              <p className="font-body font-semibold text-sm text-foreground">Add Menu Item</p>
              <p className="text-xs text-muted-foreground">Create a new dish</p>
            </div>
          </div>
        </Link>
        <Link to="/admin/residents" className="bg-card rounded-xl shadow-warm p-5 hover:shadow-lg transition-all group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
              <Icon name="UserPlus" size={20} color="#10b981" />
            </div>
            <div>
              <p className="font-body font-semibold text-sm text-foreground">Add Resident</p>
              <p className="text-xs text-muted-foreground">Register new resident</p>
            </div>
          </div>
        </Link>
        <Link to="/admin/site-settings" className="bg-card rounded-xl shadow-warm p-5 hover:shadow-lg transition-all group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
              <Icon name="Settings" size={20} color="#f59e0b" />
            </div>
            <div>
              <p className="font-body font-semibold text-sm text-foreground">Site Settings</p>
              <p className="text-xs text-muted-foreground">Hours & ordering</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default AdminDashboard;
