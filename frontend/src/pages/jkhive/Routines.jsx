import React, { useEffect, useState } from 'react';
import { Sunrise, Sunset, Snowflake, ListChecks, Flame, Truck, ChefHat, MoreHorizontal } from 'lucide-react';
import { Tile, SectionLabel } from './Tile';
import api from '../../lib/api';
import { useLocation2 } from '../../contexts/LocationContext';
import { reconcile, worstStatus, STATUS_COLOR } from './cooling/cooling_alarms';

const Routines = () => {
  const { adminLocationId } = useLocation2();
  const [coolingLogs, setCoolingLogs] = useState([]);
  const [completedTodayCount, setCompletedTodayCount] = useState(0);
  const [tick, setTick] = useState(0);

  // Refresh from server on mount + every 60s; recompute age every 30s.
  useEffect(() => {
    if (!adminLocationId) { setCoolingLogs([]); setCompletedTodayCount(0); return; }
    let cancelled = false;
    const todayLocal = () => new Date().toISOString().slice(0, 10);
    const load = () => Promise.all([
      api.coolingList(adminLocationId, 'cooling'),
      api.coolingList(adminLocationId, 'complete'),
    ]).then(([active, complete]) => {
      if (cancelled) return;
      setCoolingLogs(active || []);
      reconcile(active || []);
      const t = todayLocal();
      const n = (complete || []).filter(c => (c.completed_at || c.started_at || '').slice(0, 10) === t).length;
      setCompletedTodayCount(n);
    }).catch(() => {});
    load();
    const refresh = setInterval(load, 60000);
    const ageTick = setInterval(() => setTick(t => t + 1), 30000);
    return () => { cancelled = true; clearInterval(refresh); clearInterval(ageTick); };
  }, [adminLocationId]);

  // Re-derive on every tick so the badge color updates as time passes.
  const worst = worstStatus(coolingLogs);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ = tick;
  // Badge shows total of in-progress + today's completed so staff still see
  // their day's activity even after every record is submitted.
  const coolingCount = coolingLogs.length + completedTodayCount;
  // Colour priority: any in-progress overdue → red; any warn → orange;
  // otherwise neutral blue (informational total).
  const badgeColor = worst ? STATUS_COLOR[worst] : '#0A84C9';

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
        <Tile testId="tile-cooking-and-cooling" to="/jkhive/cooking-cooling"   icon={Snowflake}   color="#30B0C7" title="Cooking & Cooling"  subtitle="Cool-down log"
              badge={coolingCount} badgeColor={badgeColor} />
        <Tile testId="tile-checklists"          comingSoon                     icon={ListChecks}  color="#34C759" title="Checklists"         subtitle="Custom checklists" />
        <Tile testId="tile-reheating"           to="/jkhive/reheating"         icon={Flame}       color="#FF3B30" title="Reheating"          subtitle="≥ 75°C reheat log" />
        <Tile testId="tile-deliveries"          to="/jkhive/delivery-records"  icon={Truck}       color="#8E8E93" title="Deliveries"         subtitle="Goods-in records" />
        <Tile testId="tile-cooking"             to="/jkhive/cooked-temp"       icon={ChefHat}     color="#FF2D55" title="Cooking"            subtitle="Cooked-temp log" />
        <Tile testId="tile-other-routines"      to="/jkhive/routines/more"     icon={MoreHorizontal} color="#3A3A3C" title="Other"           subtitle="Probe, holding, more…" />
      </div>
    </div>
  );
};

export default Routines;
