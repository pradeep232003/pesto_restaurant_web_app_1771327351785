import React from 'react';
import { DollarSign, Users, BarChart3, Gift, ScanLine, FileText, Calendar } from 'lucide-react';
import { Tile, SectionLabel } from './Tile';
import { useAuth } from '../../contexts/AuthContext';

const Workforce = () => {
  const { isAdmin } = useAuth();

  return (
    <div className="pb-8" data-testid="jkhive-workforce">
      <h1 className="text-[34px] sm:text-[40px] font-bold tracking-tight leading-[1.05]" style={{ color: '#1D1D1F' }}>
        Workforce
      </h1>
      <p className="text-[14px] mt-2 mb-1" style={{ color: '#86868B' }}>
        People, sales and customer engagement at a glance.
      </p>

      <SectionLabel>Sales & people</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Tile testId="tile-daily-sales"   to="/admin/daily-sales"    icon={DollarSign} color="#34C759" title="Daily Sales"   subtitle="Record sales & hours" />
        <Tile testId="tile-sales-summary" to="/admin/sales-summary"  icon={BarChart3}  color="#007AFF" title="Sales Summary" subtitle="Totals & breakdowns" />
        {isAdmin && (
          <Tile testId="tile-staff-table" to="/admin/staff" icon={Users} color="#5856D6" title="Staff Table" subtitle="HR roster" />
        )}
        {isAdmin && (
          <Tile testId="tile-edit-log" to="/admin/edit-log" icon={FileText} color="#8E8E93" title="Edit Log" subtitle="All record changes" />
        )}
      </div>

      <SectionLabel>Loyalty</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Tile testId="tile-loyalty-scanner" to="/admin/loyalty-scanner" icon={ScanLine} color="#FF9500" title="Scan QR"  subtitle="Award loyalty points" />
        <Tile testId="tile-loyalty"         to="/admin/loyalty"         icon={Gift}     color="#FF2D55" title="Loyalty"  subtitle="Members & rewards" />
      </div>

      <SectionLabel>Coming soon</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Tile testId="tile-shift-mgmt" comingSoon icon={Calendar} color="#AF52DE" title="Shift Management" subtitle="Rotas & swaps" />
      </div>
    </div>
  );
};

export default Workforce;
