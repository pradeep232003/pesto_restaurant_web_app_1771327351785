import React from 'react';
import { Sunrise, Sunset, Snowflake, ListChecks, Flame, Truck, ChefHat, Thermometer, MoreHorizontal } from 'lucide-react';
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

      <SectionLabel>Daily flow</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Tile testId="tile-opening-routine"     to="/jkhive/opening"           icon={Sunrise}     color="#FF9500" title="Opening Routine"    subtitle="Pre-service checks" />
        <Tile testId="tile-closing-routine"     to="/jkhive/closing"           icon={Sunset}      color="#5856D6" title="Closing Routine"    subtitle="End-of-day shutdown" />
        <Tile testId="tile-temp-log"            to="/jkhive/temp-monitor"      icon={Thermometer} color="#007AFF" title="Temp Log"           subtitle="Fridge & freezer" />
        <Tile testId="tile-cooking-and-cooling" comingSoon                     icon={Snowflake}   color="#30B0C7" title="Cooking & Cooling"  subtitle="Cool-down log" />
        <Tile testId="tile-checklists"          comingSoon                     icon={ListChecks}  color="#34C759" title="Checklists"         subtitle="Custom checklists" />
        <Tile testId="tile-reheating"           comingSoon                     icon={Flame}       color="#FF3B30" title="Reheating"          subtitle="≥ 75°C reheat log" />
        <Tile testId="tile-deliveries"          to="/jkhive/delivery-records"  icon={Truck}       color="#8E8E93" title="Deliveries"         subtitle="Goods-in records" />
        <Tile testId="tile-cooking"             to="/jkhive/cooked-temp"       icon={ChefHat}     color="#FF2D55" title="Cooking"            subtitle="Cooked-temp log" />
        <Tile testId="tile-other-routines"      to="/jkhive/routines/more"     icon={MoreHorizontal} color="#3A3A3C" title="Other"           subtitle="Probe, holding, more…" />
      </div>
    </div>
  );
};

export default Routines;
