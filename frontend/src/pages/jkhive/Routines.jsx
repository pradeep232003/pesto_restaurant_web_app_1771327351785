import React from 'react';
import { ClipboardCheck, Power, Flame, Thermometer, Truck, Gauge, Droplet, Sparkles } from 'lucide-react';
import { Tile, SectionLabel } from './Tile';

const Routines = () => {
  return (
    <div className="pb-8" data-testid="jkhive-routines">
      <h1 className="text-[34px] sm:text-[40px] font-bold tracking-tight leading-[1.05]" style={{ color: '#1D1D1F' }}>
        Routines
      </h1>
      <p className="text-[14px] mt-2 mb-1" style={{ color: '#86868B' }}>
        Daily, weekly and ad-hoc operational checks across every site.
      </p>

      <SectionLabel>Daily checks</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Tile testId="tile-daily-checks"     to="/admin/daily-checks"      icon={ClipboardCheck} color="#34C759" title="Daily Checks"     subtitle="15-item opening list" />
        <Tile testId="tile-kitchen-closedown" to="/admin/kitchen-closedown" icon={Power}          color="#AF52DE" title="Kitchen Closedown" subtitle="End-of-day shutdown" />
        <Tile testId="tile-temp-monitor"     to="/admin/temp-monitor"      icon={Thermometer}    color="#007AFF" title="Temperature Log"  subtitle="Fridge & freezer" />
        <Tile testId="tile-cooked-temp"      to="/admin/cooked-temp"       icon={Flame}          color="#FF3B30" title="Cooked Temp"      subtitle="≥ 75°C compliance" />
      </div>

      <SectionLabel>Weekly & ad-hoc</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Tile testId="tile-deliveries"        to="/admin/delivery-records"  icon={Truck}      color="#5856D6" title="Deliveries"        subtitle="Goods-in records" />
        <Tile testId="tile-probe-cal"         to="/admin/probe-calibration" icon={Gauge}      color="#FF9500" title="Probe Calibration" subtitle="Cold/hot accuracy" />
        <Tile testId="tile-legionella"        to="/admin/legionella"        icon={Droplet}    color="#30B0C7" title="Legionella"        subtitle="Weekly water test" />
        <Tile testId="tile-daily-cleaning"    to="/admin/daily-cleaning"    icon={Sparkles}   color="#32ADE6" title="Daily Cleaning"    subtitle="18 cleaning items" />
        <Tile testId="tile-weekly-cleaning"   to="/admin/weekly-cleaning"   icon={Sparkles}   color="#BF5AF2" title="Weekly Deep Clean" subtitle="Deep clean roster" />
      </div>
    </div>
  );
};

export default Routines;
