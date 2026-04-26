import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, UtensilsCrossed, ClipboardList, Settings, Wallet, Receipt, LogOut, Menu, X, ChefHat, User, Users, DollarSign, BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCustomer } from '../contexts/CustomerContext';

const getNavItems = (role) => {
  const items = [
    { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { path: '/admin/menu', label: 'Menu', icon: UtensilsCrossed },
    { path: '/admin/orders', label: 'Orders', icon: ClipboardList },
    { path: '/admin/site-settings', label: 'Locations', icon: Settings },
    { path: '/admin/residents', label: 'Wallets', icon: Wallet },
    { path: '/admin/transactions', label: 'Reports', icon: Receipt },
    { path: '/admin/daily-sales', label: 'Daily Sales', icon: DollarSign },
    { path: '/admin/sales-summary', label: 'Sales Summary', icon: BarChart3 },
    { path: '/admin/income', label: 'Income', icon: TrendingUp },
    { path: '/admin/expenses', label: 'Expenses', icon: TrendingDown },
  ];
  if (role === 'super_admin') {
    items.push({ path: '/admin/users', label: 'Users', icon: Users });
  }
  return items;
};

const AdminLayout = ({ children }) => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { logout: customerLogout } = useCustomer();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const NAV_ITEMS = getNavItems(user?.role);

  const handleLogout = async () => {
    await signOut();
    customerLogout();
    localStorage.removeItem('customer_token');
    navigate('/admin-login');
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#F5F5F7' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-40 h-screen w-60 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: '#1D1D1F' }}
      >
        {/* Logo */}
        <div className="px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <ChefHat size={17} color="white" strokeWidth={1.5} />
              </div>
              <div>
                <h1 className="font-semibold text-sm leading-tight text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>Jolly's Kafe</h1>
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Admin</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 rounded-lg" style={{ color: 'rgba(255,255,255,0.5)' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                  isActive ? 'font-medium' : ''
                }`
              }
              style={({ isActive }) => ({
                background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.45)',
                fontFamily: 'Outfit, sans-serif',
              })}
            >
              <item.icon size={17} strokeWidth={1.5} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="px-3 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2.5 px-3 mb-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <User size={13} color="white" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate" style={{ fontFamily: 'Outfit, sans-serif' }}>{user?.name || 'Admin'}</p>
              <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>{user?.email}</p>
            </div>
          </div>
          <button
            data-testid="admin-logout-btn"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all"
            style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Outfit, sans-serif' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#FFFFFF'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.background = 'transparent'; }}
          >
            <LogOut size={15} strokeWidth={1.5} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header
          className="lg:hidden sticky top-0 z-20 px-4 py-3 flex items-center justify-between backdrop-blur-xl"
          style={{ background: 'rgba(245,245,247,0.85)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}
        >
          <button data-testid="mobile-menu-toggle" onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 rounded-lg transition-all" style={{ color: '#1D1D1F' }}>
            <Menu size={20} strokeWidth={1.5} />
          </button>
          <span className="text-sm font-medium" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>Jolly's Kafe</span>
          <div className="w-8" />
        </header>

        {/* Page */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
