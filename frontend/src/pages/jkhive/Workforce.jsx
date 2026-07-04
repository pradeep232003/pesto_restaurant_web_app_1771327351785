import React from 'react';
import { Calendar, Clock, Wallet, MessageSquareWarning, Headphones, Sparkles, Award, ClipboardCheck, ArrowUpRight } from 'lucide-react';
import { Tile, SectionLabel } from './Tile';

const Workforce = () => {
  return (
    <div className="pb-8" data-testid="jkhive-workforce">
      <h1 className="text-[34px] sm:text-[40px] font-bold tracking-tight leading-[1.05]" style={{ color: '#1D1D1F' }}>
        Workforce
      </h1>
      <p className="text-[14px] mt-2 mb-1" style={{ color: '#86868B' }}>
        People, sales and customer engagement at a glance.
      </p>

      <SectionLabel>Operate</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Tile testId="tile-clock-in-out" to="/jkhive/clock"        icon={Clock}    color="#34C759" title="Clock In / Out"  subtitle="Geo-verified time track" />
        <Tile testId="tile-shift-mgmt"   to="/jkhive/shifts"       icon={Calendar} color="#AF52DE" title="Shift Management" subtitle="Rotas & swaps" />
      </div>

      <SectionLabel>Learn</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Tile testId="tile-sales-training" to="/jkhive/sales-training" icon={ArrowUpRight} color="#34C759" title="Sales Scripts" subtitle="Up-sell & cross-sell" />
        <Tile testId="tile-learning"     comingSoon icon={Sparkles}        color="#FFCC00" title="Learning"      subtitle="Staff training & courses" />
        <Tile testId="tile-certificates" comingSoon icon={Award}           color="#AF52DE" title="Certificates"  subtitle="Level 2/3 hygiene certs" />
        <Tile testId="tile-onboarding"   comingSoon icon={ClipboardCheck}  color="#30B0C7" title="Onboarding"    subtitle="New starter packs" />
      </div>

      <SectionLabel>Coming soon</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Tile testId="tile-payroll"      comingSoon icon={Wallet}               color="#007AFF" title="Payroll"          subtitle="Hours → pay reports" />
        <Tile testId="tile-complaints"   comingSoon icon={MessageSquareWarning} color="#FF3B30" title="Complaints"       subtitle="Customer feedback log" />
        <Tile testId="tile-hotline"      comingSoon icon={Headphones}           color="#30B0C7" title="Safety Hotline"   subtitle="24/7 expert advice" />
      </div>
    </div>
  );
};

export default Workforce;
