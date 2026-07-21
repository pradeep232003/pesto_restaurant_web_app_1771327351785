import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, Clock, ChevronRight, Check } from 'lucide-react';
import { useLocation2 } from '../../contexts/LocationContext';
import { fetchDailyCheckStatus } from './_dailyCheckStatus';

/**
 * Wide "Today's Check" hero card for /jkhive Intelligence.
 *
 * Spans 2 columns. Loads the same routine list the hub uses, derives the
 * outstanding/done counts, and renders them in two stat blocks. Refreshes
 * every 60 s so the home tile stays current while staff complete tasks.
 */
const today = () => new Date().toISOString().slice(0, 10);

const DailyCheckTile = () => {
  const { adminLocationId, locations } = useLocation2();
  const [counts, setCounts] = useState({ done: 0, outstanding: 0, total: 10, loaded: false });
  const dt = today();

  const load = useCallback(async () => {
    if (!adminLocationId) { setCounts(c => ({ ...c, loaded: true })); return; }
    const loc = (locations || []).find(l => l.id === adminLocationId);
    const applicable = loc?.applicable_routines || [];
    const s = await fetchDailyCheckStatus(adminLocationId, dt, applicable);
    setCounts({ done: s.done, outstanding: s.total - s.done, total: s.total, loaded: true });
  }, [adminLocationId, dt, locations]);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const allDone = counts.loaded && counts.done === counts.total;

  return (
    <Link to="/jkhive/daily-check" className="col-span-2 block" style={{ textDecoration: 'none' }} data-testid="tile-daily-check">
      <div className="relative rounded-3xl p-5 active:scale-[0.99] hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
        style={{ background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', fontFamily: 'Outfit, sans-serif' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-[12px] flex items-center justify-center" style={{ background: '#1D1D1F' }}>
            <CheckSquare size={22} color="white" strokeWidth={2} />
          </div>
          <div className="flex-1">
            <p className="text-[16px] font-semibold leading-tight" style={{ color: '#1D1D1F' }}>Today&apos;s Check</p>
            <p className="text-[12px] mt-0.5" style={{ color: '#86868B' }}>{counts.loaded ? `${counts.total} routines for an EHO-ready day` : '10 routines for an EHO-ready day'}</p>
          </div>
          <ChevronRight size={18} strokeWidth={2.4} style={{ color: '#C7C7CC' }} />
        </div>

        <div className="flex gap-3">
          <div data-testid="tile-daily-check-outstanding"
            className="flex-1 rounded-2xl p-3" style={{ background: 'rgba(255,149,0,0.10)' }}>
            <div className="flex items-center gap-1.5 mb-1">
              <Clock size={13} color="#FF9500" strokeWidth={2.6} />
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#A35E00' }}>Outstanding</span>
            </div>
            <p className="text-[28px] font-bold leading-none" style={{ color: '#1D1D1F', fontFeatureSettings: '"tnum"' }}>
              {counts.loaded ? counts.outstanding : '—'}
            </p>
          </div>
          <div data-testid="tile-daily-check-done"
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
            All checks complete for today ✓
          </p>
        )}
      </div>
    </Link>
  );
};

export default DailyCheckTile;
