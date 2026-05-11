/**
 * Canonical list of the 10 daily routines surfaced on the Daily Check hub.
 * Keys match the `CHECK_CONFIG` keys in /app/backend/routes/compliance.py so
 * a location's `applicable_routines` array applies consistently to both the
 * hub UI and the compliance % calculation.
 *
 * If a location's `applicable_routines` is empty (or missing), ALL routines
 * apply — this keeps existing sites working without a migration.
 */
export const ROUTINE_CATALOG = [
  { key: 'opening_checklist', label: 'Opening checklist' },
  { key: 'opening_temps',     label: 'Fridge / Freezer opening temps' },
  { key: 'washer_temps',      label: 'Washer Temps' },
  { key: 'hot_cold_holding',  label: 'Hot / Cold Holding' },
  { key: 'reheating',         label: 'Cooking / Reheating' },
  { key: 'bulk_cooling',      label: 'Bulk Cooking / Cooling' },
  { key: 'delivery_records',  label: 'Deliveries' },
  { key: 'daily_cleaning',    label: 'Daily Cleaning' },
  { key: 'closing_temps',     label: 'Fridge / Freezer closing temps' },
  { key: 'closing_checklist', label: 'Closing checklist' },
];

/** Returns true if `key` should be shown for a location whose
 *  `applicable_routines` value is `routines` (may be undefined/empty). */
export const isRoutineApplicable = (routines, key) => {
  if (!routines || routines.length === 0) return true;
  return routines.includes(key);
};
