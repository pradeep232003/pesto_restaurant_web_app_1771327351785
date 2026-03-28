import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import Icon from './AppIcon';
import { useAuth } from '../contexts/AuthContext';

const NAV_ITEMS = [
  { path: '/admin', label: 'Dashboard', icon: 'LayoutDashboard', exact: true },
  { path: '/admin/menu', label: 'Menu Management', icon: 'UtensilsCrossed' },
  { path: '/admin/orders', label: 'Orders', icon: 'ClipboardList' },
  { path: '/admin/site-settings', label: 'Site Settings', icon: 'Settings' },
  { path: '/admin/residents', label: 'Resident Wallets', icon: 'Wallet' },
  { path: '/admin/transactions', label: 'Transaction Report', icon: 'Receipt' },
];

const AdminLayout = ({ children }) => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/admin-login');
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 z-40 h-screen w-64 bg-[#1a1a2e] text-white flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                <Icon name="ChefHat" size={20} color="white" />
              </div>
              <div>
                <h1 className="font-heading font-bold text-base leading-tight">Jolly's Kafe</h1>
                <p className="text-[10px] text-white/50 font-body">Admin Panel</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 hover:bg-white/10 rounded">
              <Icon name="X" size={18} color="white" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-body transition-all duration-200 ${
                  isActive
                    ? 'bg-primary text-white font-medium shadow-lg shadow-primary/20'
                    : 'text-white/60 hover:text-white hover:bg-white/8'
                }`
              }
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User / Logout */}
        <div className="px-3 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center">
              <Icon name="User" size={14} color="white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-body font-medium text-white truncate">{user?.name || 'Admin'}</p>
              <p className="text-[10px] text-white/40 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            data-testid="admin-logout-btn"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-body text-white/50 hover:text-white hover:bg-white/8 transition-all"
          >
            <Icon name="LogOut" size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile) */}
        <header className="lg:hidden sticky top-0 z-20 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <button
            data-testid="mobile-menu-toggle"
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 rounded-lg hover:bg-muted transition-all"
          >
            <Icon name="Menu" size={20} />
          </button>
          <span className="font-heading font-bold text-sm text-foreground">Jolly's Kafe Admin</span>
          <div className="w-8" />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
