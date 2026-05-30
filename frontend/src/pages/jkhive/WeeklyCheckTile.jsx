import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck2, Clock, ChevronRight, Check } from 'lucide-react';
import api from '../../lib/api';
import { useLocation2 } from '../../contexts/LocationContext';

/**
 * Wide "Weekly Check" hero card for /jkhive/routines.
 *
 * Rolls up the three weekly-frequency tasks (Probe Calibration, Legionella,
 * Weekly Checklist) into outstanding/done counts for the CURRENT ISO week
 * (Mon 00:00 → Sun 23:59). Auto-refreshes every 60 s.
 */
const startOfWeekISO = () => {
  const d = new Date();
  const day = d.getDay(); // Sun=0..Sat=6
  const diff = day === 0 ? 6 : day - 1; // back to Monday
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const startOfWeekDateOnly = () => startOfWeekISO().slice(0, 10);

const WeeklyCheckTile = () => {
  const { adminLocationId } = useLocation2();
  const [counts, setCounts] = useState({ done: 0, outstanding: 3, total: 3, loaded: false });

  const load = useCallback(async () => {
    if (!adminLocationId) { setCounts(c => ({ ...c, loaded: true })); return; }
    const weekStartIso = startOfWeekISO();
    const weekStartDate = startOfWeekDateOnly();

    const [probeCals, legio, checklists] = await Promise.all([
      // JKHive wizard endpoint — stores `recorded_at` (full ISO ts) not date.
      api.probeCalibrations(adminLocationId).catch(() => []),
      api.adminListLegionella({ location_id: adminLocationId, start_date: weekStartDate }).catch(() => []),
      api.checklistList(adminLocationId).catch(() => []),
    ]);

    const probeDone = (probeCals || []).some(r => (r.recorded_at || '') >= weekStartIso);
    const legioDone = (legio || []).length > 0;

    // Weekly checklist counts as DONE only when every visible item across
    // the weekly templates has been ticked at least once during this ISO
    // week. Half-completed still counts as outstanding.
    const weeklyTpls = (checklists || []).filter(c => c.frequency === 'weekly');
    let weeklyDone = false;
    if (weeklyTpls.length > 0) {
      const allFullyTicked = await Promise.all(weeklyTpls.map(async (tpl) => {
        const runs = await api.checklistRunsList(tpl.id).catch(() => []);
        const inWeek = (runs || []).filter(r => {
          if (r.location_id && r.location_id !== adminLocationId) return false;
          return (r.submitted_at || '') >= weekStartIso;
        });
        const union = new Set();
        for (const r of inWeek) for (const i of (r.checked_items || [])) union.add(i);
        const total = tpl.visible_items_count ?? (tpl.items || []).length;
        return total > 0 && union.size >= total;
      }));
      weeklyDone = allFullyTicked.every(Boolean);
    }

    const flags = [probeDone, legioDone, weeklyDone];
    const done = flags.filter(Boolean).length;
    setCounts({ done, outstanding: flags.length - done, total: flags.length, loaded: true });
  }, [adminLocationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const allDone = counts.loaded && counts.done === counts.total;

  return (
    <Link to="/jkhive/weekly-check" className="col-span-2 block" style={{ textDecoration: 'none' }} data-testid="tile-weekly-check">
      <div className="relative rounded-3xl p-5 active:scale-[0.99] hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
        style={{ background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', fontFamily: 'Outfit, sans-serif' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-[12px] flex items-center justify-center" style={{ background: '#1D1D1F' }}>
            <CalendarCheck2 size={22} color="white" strokeWidth={2} />
          </div>
          <div className="flex-1">
            <p className="text-[16px] font-semibold leading-tight" style={{ color: '#1D1D1F' }}>Weekly Check</p>
            <p className="text-[12px] mt-0.5" style={{ color: '#86868B' }}>Probe · Legionella · Weekly checklist</p>
          </div>
          <ChevronRight size={18} strokeWidth={2.4} style={{ color: '#C7C7CC' }} />
        </div>

        <div className="flex gap-3">
          <div data-testid="tile-weekly-check-outstanding"
            className="flex-1 rounded-2xl p-3" style={{ background: 'rgba(255,149,0,0.10)' }}>
            <div className="flex items-center gap-1.5 mb-1">
              <Clock size={13} color="#FF9500" strokeWidth={2.6} />
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#A35E00' }}>Outstanding</span>
            </div>
            <p className="text-[28px] font-bold leading-none" style={{ color: '#1D1D1F', fontFeatureSettings: '"tnum"' }}>
              {counts.loaded ? counts.outstanding : '—'}
            </p>
          </div>
          <div data-testid="tile-weekly-check-done"
            className="flex-1 rounded-2xl p-3" style={{ background: 'rgba(52,199,89,0.10)' }}>
            <div className="flex items-center gap-1.5 mb-1">
              <Check size={13} color="#34C759" strokeWidth={2.8} />
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#1B7A35' }}>Done</span>
            </div>
            <p className="text-[28px] font-bold leading-none" style={{ color: '#1D1D1F', fontFeatureSettings: '"tnum"' }}>
              {counts.loaded ? counts.done : '—'}
            </p>
          </div>
        </div>

        {allDone && (
          <p className="text-[11px] font-semibold mt-2.5" style={{ color: '#34C759' }}>
            All weekly checks complete ✓
          </p>
        )}
      </div>
    </Link>
  );
};

export default WeeklyCheckTile;
