/**
 * Shared daily-check completion helper. Given a location id + ISO date,
 * fetches every routine collection surfaced on the Daily Check hub and
 * returns a `{done, total, missing:[{key,label}], loaded:true}` summary.
 *
 * Kept in sync with `DailyCheckTile.jsx` — the hub uses the exact same
 * flag logic, so both views stay consistent.
 */
import api from '../../lib/api';
import { ROUTINE_CATALOG, isRoutineApplicable } from './_routineCatalog';

const isSameDay = (iso, dt) => (iso || '').slice(0, 10) === dt;

export async function fetchDailyCheckStatus(locationId, dt, applicableRoutines = []) {
  if (!locationId || !dt) return { done: 0, total: 0, missing: [], loaded: true };

  const [
    washers, hotCold, reheating, cooling, deliveries, checklists,
    dc, cd, openingTemps, closingTemps,
  ] = await Promise.all([
    api.washerChecks(locationId).catch(() => []),
    api.hotColdList(locationId).catch(() => []),
    api.reheatingList(locationId).catch(() => []),
    api.coolingList(locationId).catch(() => []),
    api.deliveriesList(locationId).catch(() => []),
    api.checklistList(locationId).catch(() => []),
    api.adminGetDailyCheck(locationId, dt).catch(() => null),
    api.adminGetClosedown(locationId, dt).catch(() => null),
    api.fetch(`/api/admin/routine-temps?location_id=${encodeURIComponent(locationId)}&period=opening&start_date=${dt}&end_date=${dt}`).catch(() => []),
    api.fetch(`/api/admin/routine-temps?location_id=${encodeURIComponent(locationId)}&period=closing&start_date=${dt}&end_date=${dt}`).catch(() => []),
  ]);

  const dcOpening = !!dc && (dc.total_items ?? 0) > 0 && (dc.passed_items ?? 0) >= (dc.total_items ?? 0);
  const cdComplete = !!cd && (cd.total_items ?? 0) > 0 && (cd.passed_items ?? 0) >= (cd.total_items ?? 0);
  const hcToday = (hotCold || []).filter(r => isSameDay(r.start_time || r.recorded_at, dt));
  const hcDone = hcToday.some(r => r.mode === 'hot') && hcToday.some(r => r.mode === 'cold');

  const candidates = [
    ['opening_checklist', dcOpening],
    ['opening_temps',     (openingTemps || []).length > 0],
    ['washer_temps',      (washers || []).some(r => isSameDay(r.recorded_at, dt))],
    ['hot_cold_holding',  hcDone],
    ['reheating',         (reheating || []).some(r => isSameDay(r.recorded_at, dt))],
    ['bulk_cooling',      (cooling || []).some(r =>
      isSameDay(r.started_at || r.recorded_at, dt) && (r.status === 'complete' || r.kind === 'no_bulk_prep')
    )],
    ['delivery_records',  (deliveries || []).some(r => isSameDay(r.recorded_at, dt))],
    ['daily_cleaning',    (checklists || []).some(c => isSameDay(c.last_run_at || c.last_run_date, dt))],
    ['closing_temps',     (closingTemps || []).length > 0],
    ['closing_checklist', cdComplete],
  ];

  const applicable = candidates.filter(([k]) => isRoutineApplicable(applicableRoutines, k));
  const labelFor = (key) => ROUTINE_CATALOG.find(r => r.key === key)?.label || key;
  const done = applicable.filter(([, v]) => v).length;
  const missing = applicable.filter(([, v]) => !v).map(([k]) => ({ key: k, label: labelFor(k) }));
  return { done, total: applicable.length, missing, loaded: true };
}
