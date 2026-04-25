import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Shield, ShieldCheck, UserCog, Search } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

const ROLE_CONFIG = {
  customer: { label: 'Customer', color: '#86868B', bg: 'rgba(142,142,147,0.1)' },
  staff: { label: 'Staff', color: '#007AFF', bg: 'rgba(0,122,255,0.1)' },
  admin: { label: 'Admin', color: '#AF52DE', bg: 'rgba(175,82,222,0.1)' },
  super_admin: { label: 'Super Admin', color: '#FF9500', bg: 'rgba(255,149,0,0.1)' },
};

const AdminUsers = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isSuperAdmin, loading: authLoading } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState(null);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isSuperAdmin)) navigate('/admin-login');
  }, [authLoading, isAuthenticated, isSuperAdmin, navigate]);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const data = await api.adminGetCustomers();
      setCustomers(data);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (customerId, newRole) => {
    setUpdating(customerId);
    try {
      await api.adminUpdateCustomerRole(customerId, newRole);
      setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, role: newRole } : c));
    } catch (err) {
      alert('Failed to update role: ' + err.message);
    } finally {
      setUpdating(null);
    }
  };

  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    return !q || c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q);
  });

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl" data-testid="admin-users-page">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>User Management</h1>
        <p className="text-sm mt-1" style={{ color: '#86868B' }}>Manage registered customers and assign roles</p>
      </div>

      {/* Search */}
      <div className="mb-5 relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#86868B' }} />
        <input
          data-testid="user-search-input"
          type="text"
          placeholder="Search by name, email or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border-0 outline-none"
          style={{ background: '#FFFFFF', color: '#1D1D1F', fontFamily: 'Outfit, sans-serif', boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total Customers', count: customers.length, icon: Users, color: '#1D1D1F' },
          { label: 'Staff', count: customers.filter(c => c.role === 'staff').length, icon: Shield, color: '#007AFF' },
          { label: 'Admins', count: customers.filter(c => c.role === 'admin').length, icon: ShieldCheck, color: '#AF52DE' },
        ].map(stat => (
          <div key={stat.label} className="p-4 rounded-2xl" style={{ background: '#FFFFFF' }}>
            <stat.icon size={18} style={{ color: stat.color }} className="mb-2" />
            <p className="text-xl font-semibold" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>{stat.count}</p>
            <p className="text-xs" style={{ color: '#86868B' }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ fontFamily: 'Outfit, sans-serif' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <th className="text-left px-5 py-3.5 text-xs font-medium uppercase tracking-wider" style={{ color: '#86868B' }}>Name</th>
                <th className="text-left px-5 py-3.5 text-xs font-medium uppercase tracking-wider" style={{ color: '#86868B' }}>Email</th>
                <th className="text-left px-5 py-3.5 text-xs font-medium uppercase tracking-wider hidden sm:table-cell" style={{ color: '#86868B' }}>Phone</th>
                <th className="text-left px-5 py-3.5 text-xs font-medium uppercase tracking-wider" style={{ color: '#86868B' }}>Current Role</th>
                <th className="text-left px-5 py-3.5 text-xs font-medium uppercase tracking-wider" style={{ color: '#86868B' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center" style={{ color: '#86868B' }}>
                    {search ? 'No customers match your search.' : 'No registered customers yet.'}
                  </td>
                </tr>
              ) : filtered.map(customer => {
                const role = customer.role || 'customer';
                const rc = ROLE_CONFIG[role] || ROLE_CONFIG.customer;
                return (
                  <tr key={customer.id} data-testid={`user-row-${customer.id}`} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                    <td className="px-5 py-3.5 font-medium" style={{ color: '#1D1D1F' }}>{customer.name || '—'}</td>
                    <td className="px-5 py-3.5" style={{ color: '#3A3A3C' }}>{customer.email}</td>
                    <td className="px-5 py-3.5 hidden sm:table-cell" style={{ color: '#3A3A3C' }}>{customer.phone || '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium" style={{ background: rc.bg, color: rc.color }}>
                        {rc.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <select
                        data-testid={`role-select-${customer.id}`}
                        value={role}
                        disabled={updating === customer.id}
                        onChange={e => handleRoleChange(customer.id, e.target.value)}
                        className="px-3 py-1.5 rounded-lg text-xs border-0 outline-none cursor-pointer"
                        style={{ background: '#F5F5F7', color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
                      >
                        <option value="customer">Customer</option>
                        <option value="staff">Staff</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminUsers;
