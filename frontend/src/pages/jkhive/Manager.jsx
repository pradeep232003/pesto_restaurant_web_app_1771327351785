import React from 'react';
import { Settings, Users, ShieldCheck, BarChart3, TrendingUp, TrendingDown, UtensilsCrossed, Snowflake } from 'lucide-react';
import { Tile, SectionLabel } from './Tile';
import { useAuth } from '../../contexts/AuthContext';

const Manager = () => {
  const { user, isAdmin } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <div className="pb-8" data-testid="jkhive-manager">
      <h1 className="text-[34px] sm:text-[40px] font-bold tracking-tight leading-[1.05]" style={{ color: '#1D1D1F' }}>
        Manager
      </h1>
      <p className="text-[14px] mt-2 mb-1" style={{ color: '#86868B' }}>
        Settings, finances and admin controls.
      </p>

      <SectionLabel>Finance</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Tile testId="tile-sales-summary" to="/jkhive/sales-summary" icon={BarChart3} color="#007AFF" title="Sales Summary" subtitle="Totals & breakdowns" />
        <Tile testId="tile-income"   to="/admin/income"   icon={TrendingUp}   color="#34C759" title="Income"   subtitle="Track revenue streams" />
        <Tile testId="tile-expenses" to="/admin/expenses" icon={TrendingDown} color="#FF3B30" title="Expenses" subtitle="Outgoings & receipts" />
      </div>

      <SectionLabel>Configuration</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Tile testId="tile-menu-management" to="/jkhive/menu" icon={UtensilsCrossed} color="#5856D6" title="Menu Management" subtitle="Items, pricing, images" />
        {isAdmin && (
          <Tile testId="tile-routine-units" to="/jkhive/manager/routine-units" icon={Snowflake} color="#30B0C7" title="Routine Units" subtitle="Skip Display Chiller etc." />
        )}
        {isAdmin && (
          <Tile testId="tile-locations" to="/admin/site-settings" icon={Settings} color="#8E8E93" title="Locations" subtitle="5 sites · settings" />
        )}
        {isSuperAdmin && (
          <Tile testId="tile-users" to="/admin/users" icon={Users} color="#AF52DE" title="Users" subtitle="Roles & access" />
        )}
        <Tile testId="tile-compliance-shortcut" to="/jkhive/compliance" icon={ShieldCheck} color="#34C759" title="Compliance" subtitle="EHO matrix" />
      </div>
    </div>
  );
};

export default Manager;
