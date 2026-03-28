import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Icon from '../../components/AppIcon';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  preparing: 'bg-purple-100 text-purple-700',
  ready: 'bg-green-100 text-green-700',
  collected: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-600',
};

const STATUS_FLOW = ['pending', 'confirmed', 'preparing', 'ready', 'collected'];

const AdminOrders = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin, loading: authLoading, signOut } = useAuth();
  const { locations } = useLocation2();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) navigate('/admin-login');
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.adminGetOrders(filterLocation || null, filterStatus || null);
      setOrders(data);
    } catch (err) {
      if (err.message?.includes('401')) { navigate('/admin-login'); return; }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterLocation, filterStatus, navigate]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(fetchOrders, 15000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleStatusUpdate = async (orderId, newStatus) => {
    setError('');
    try {
      await api.adminUpdateOrderStatus(orderId, newStatus);
      setSuccessMsg(`Order updated to "${newStatus}"`);
      setTimeout(() => setSuccessMsg(''), 3000);
      await fetchOrders();
    } catch (err) {
      setError(err.message);
    }
  };

  const getNextStatus = (currentStatus) => {
    const idx = STATUS_FLOW.indexOf(currentStatus);
    if (idx === -1 || idx >= STATUS_FLOW.length - 1) return null;
    return STATUS_FLOW[idx + 1];
  };

  if (authLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div></div>;
  if (!isAuthenticated || !isAdmin) return null;

  const locationName = (id) => locations.find(l => l.id === id)?.name || id;

  return (
    <div className="min-h-screen" style={{ background: '#F5F5F7' }}>
      <main>
        <section className="py-6 lg:py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>Orders</h1>
            <p className="text-sm mt-1" style={{ color: '#86868B' }}>Manage incoming collection orders</p>
          </div>
        </section>

        <section className="pb-6 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto space-y-5">
            {successMsg && (
              <div className="p-4 rounded-2xl text-sm flex items-center gap-2" style={{ background: 'rgba(52,199,89,0.08)', color: '#34C759' }}>
                <Icon name="CheckCircle" size={16} />
                {successMsg}
              </div>
            )}
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 flex items-center gap-2">
                <Icon name="AlertCircle" size={18} color="var(--color-destructive)" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Filters */}
            <div className="bg-card rounded-xl shadow-warm p-4 flex flex-wrap gap-3 items-center">
              <select
                data-testid="order-location-filter"
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm font-body"
              >
                <option value="">All Locations</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <select
                data-testid="order-status-filter"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm font-body"
              >
                <option value="">All Statuses</option>
                {STATUS_FLOW.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                <option value="cancelled">Cancelled</option>
              </select>
              <button onClick={fetchOrders} className="ml-auto px-4 py-2 bg-primary/10 text-primary rounded-lg text-sm font-body font-medium hover:bg-primary/20 transition-all">
                <Icon name="RefreshCw" size={14} className="inline mr-1" /> Refresh
              </button>
            </div>

            {/* Orders */}
            {loading ? (
              <div className="bg-card rounded-xl shadow-warm p-8 space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse flex gap-4 items-center">
                    <div className="h-12 w-24 bg-muted rounded"></div>
                    <div className="flex-1 space-y-2"><div className="h-4 bg-muted rounded w-1/3"></div><div className="h-3 bg-muted rounded w-1/2"></div></div>
                    <div className="h-8 w-20 bg-muted rounded"></div>
                  </div>
                ))}
              </div>
            ) : orders.length === 0 ? (
              <div className="bg-card rounded-xl shadow-warm p-12 text-center">
                <Icon name="ClipboardList" size={48} color="var(--color-muted-foreground)" className="mx-auto mb-4" />
                <h3 className="text-lg font-heading font-bold text-foreground mb-2">No orders yet</h3>
                <p className="text-sm text-muted-foreground">Orders will appear here when customers place them.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map(order => {
                  const nextStatus = getNextStatus(order.status);
                  return (
                    <div key={order.id} data-testid={`order-card-${order.order_number}`} className="bg-card rounded-xl shadow-warm overflow-hidden">
                      <div className="p-4 sm:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                          <div>
                            <p className="font-heading font-bold text-lg text-primary">{order.order_number}</p>
                            <p className="text-xs text-muted-foreground">{locationName(order.location_id)} &middot; {new Date(order.created_at).toLocaleString()}</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-body font-medium ${STATUS_COLORS[order.status] || 'bg-muted text-muted-foreground'}`}>
                            {order.status?.charAt(0).toUpperCase() + order.status?.slice(1)}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm mb-4">
                          <span className="text-muted-foreground"><Icon name="User" size={12} className="inline mr-1" />{order.customer_name}</span>
                          <span className="text-muted-foreground"><Icon name="Mail" size={12} className="inline mr-1" />{order.customer_email}</span>
                          <span className="text-muted-foreground"><Icon name="Phone" size={12} className="inline mr-1" />{order.customer_phone}</span>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3 mb-4">
                          {order.items?.map((item, i) => (
                            <div key={i} className="flex justify-between text-sm py-0.5">
                              <span>{item.quantity}x {item.name}</span>
                              <span className="font-medium">{'\u00A3'}{(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                          {order.special_instructions && (
                            <p className="text-xs text-muted-foreground italic mt-2 pt-2 border-t border-border">Note: {order.special_instructions}</p>
                          )}
                          <div className="mt-2 pt-2 border-t border-border flex justify-between font-body font-semibold">
                            <span>Total</span>
                            <span className="text-primary">{'\u00A3'}{order.total?.toFixed(2)}</span>
                          </div>
                        </div>
                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-2">
                          {nextStatus && (
                            <button
                              data-testid={`advance-order-${order.order_number}`}
                              onClick={() => handleStatusUpdate(order.id, nextStatus)}
                              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-body font-medium hover:bg-primary/90 transition-all"
                            >
                              Mark as {nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1)}
                            </button>
                          )}
                          {order.status !== 'cancelled' && order.status !== 'collected' && (
                            <button
                              onClick={() => handleStatusUpdate(order.id, 'cancelled')}
                              className="px-4 py-2 border border-destructive/30 text-destructive rounded-lg text-sm font-body font-medium hover:bg-destructive/10 transition-all"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default AdminOrders;
