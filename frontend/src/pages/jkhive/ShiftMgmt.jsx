import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, ChevronLeft, ChevronRight, X, Trash2, Users, Clock, Copy, Send, FileEdit, Sparkles, TrendingUp, Wallet, Edit3, Check, RotateCcw, Printer, Bug,
} from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';

const FONT = { fontFamily: 'Outfit, sans-serif' };
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Return the ISO Monday of the week containing the given date. */
const startOfWeek = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay() || 7;
  if (day !== 1) x.setDate(x.getDate() - (day - 1));
  return x;
};

const toIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const fmtDayLabel = (d) => `${DAY_NAMES[(d.getDay() + 6) % 7]} ${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}`;

const fmtRange = (from, to) => `${from.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – ${to.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`;

const fmtGbp = (v) => `£${(Number(v) || 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtGbpD = (v) => `£${(Number(v) || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Wage Budget header — only rendered for admin/super_admin.
 *
 *  3 tiles: Last week's revenue (read-only), Next-week forecast (admin
 *  can override with a pencil + reset), and Wage allocation (30% by
 *  default) with a live progress bar that ticks DOWN as the manager
 *  fills the rota. `weekCost` is recomputed in the parent on every shift
 *  edit so the "remaining" figure stays in sync without any extra fetch.
 */
const BudgetBar = ({ locationId, weekStart, weekCost }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [editingForecast, setEditingForecast] = useState(false);
  const [forecastDraft, setForecastDraft] = useState('');
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetDraft, setTargetDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!locationId || !weekStart) return;
    setLoading(true);
    setErr('');
    try {
      const res = await api.shiftWeekBudgetGet({ location_id: locationId, week_start: weekStart });
      setData(res);
    } catch (e) {
      setErr(e.message || 'Failed to load budget');
    } finally {
      setLoading(false);
    }
  }, [locationId, weekStart]);
  useEffect(() => { load(); }, [load]);

  const saveForecast = async (overrideOrNull) => {
    setSaving(true);
    setErr('');
    try {
      const res = await api.shiftWeekBudgetPut({
        location_id: locationId,
        week_start: weekStart,
        forecast_override: overrideOrNull,
      });
      setData(res);
      setEditingForecast(false);
    } catch (e) {
      setErr(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const saveTarget = async (pct) => {
    setSaving(true);
    setErr('');
    try {
      const res = await api.shiftWeekBudgetPut({
        location_id: locationId,
        week_start: weekStart,
        target_pct: pct,
      });
      setData(res);
      setEditingTarget(false);
    } catch (e) {
      setErr(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <div data-testid="shifts-budget-bar-loading" style={{
        background: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)', color: '#86868B', fontSize: 12, ...FONT,
      }}>Loading wage budget…</div>
    );
  }
  if (!data) return null;

  const budget = Number(data.wage_budget) || 0;
  const used = Number(weekCost) || 0;
  const remaining = budget - used;
  const usedPct = budget > 0 ? Math.min(999, (used / budget) * 100) : 0;
  // Colour bands: <80% green, 80-100% amber, >100% red.
  const accent = usedPct > 100 ? '#FF3B30' : usedPct >= 80 ? '#FF9500' : '#34C759';

  return (
    <div data-testid="shifts-budget-bar" style={{
      background: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10,
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)', ...FONT,
    }}>
      <div style={{
        display: 'grid', gap: 12,
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      }}>
        {/* Last week revenue */}
        <div data-testid="budget-tile-last-week">
          <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 4 }}>
            <TrendingUp size={10} /> Last week revenue
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1D1D1F', marginTop: 2, letterSpacing: '-0.02em' }}>
            {fmtGbp(data.last_week_revenue)}
          </div>
          <div style={{ fontSize: 10, color: '#86868B', marginTop: 2 }}>
            {data.last_week_start?.slice(5)} – {data.last_week_end?.slice(5)}
          </div>
        </div>

        {/* Forecast — editable */}
        <div data-testid="budget-tile-forecast">
          <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 4 }}>
            Next-week forecast
            {data.forecast_overridden && (
              <span style={{ background: 'rgba(0,122,255,0.12)', color: '#007AFF', padding: '1px 5px', borderRadius: 4, fontSize: 9 }}>
                MANUAL
              </span>
            )}
          </div>
          {editingForecast ? (
            <div style={{ display: 'flex', gap: 4, marginTop: 4, alignItems: 'center' }}>
              <span style={{ color: '#86868B', fontSize: 16 }}>£</span>
              <input
                data-testid="budget-forecast-input"
                type="number"
                inputMode="decimal"
                autoFocus
                value={forecastDraft}
                onChange={(e) => setForecastDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveForecast(Number(forecastDraft) || 0); if (e.key === 'Escape') setEditingForecast(false); }}
                style={{ flex: 1, minWidth: 60, padding: '4px 6px', border: '1px solid #007AFF', borderRadius: 6, fontSize: 16, fontWeight: 700, ...FONT }}
              />
              <button data-testid="budget-forecast-save" onClick={() => saveForecast(Number(forecastDraft) || 0)} disabled={saving}
                style={{ width: 22, height: 22, borderRadius: 999, background: '#34C759', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={12} color="#FFF" />
              </button>
              <button onClick={() => setEditingForecast(false)} disabled={saving}
                style={{ width: 22, height: 22, borderRadius: 999, background: '#F5F5F7', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={12} color="#1D1D1F" />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.02em' }}>
                {fmtGbp(data.forecast)}
              </span>
              <button
                data-testid="budget-forecast-edit"
                onClick={() => { setForecastDraft(String(Math.round(Number(data.forecast) || 0))); setEditingForecast(true); }}
                aria-label="Override forecast"
                style={{ background: 'transparent', border: 0, padding: 2, cursor: 'pointer', color: '#007AFF' }}
              >
                <Edit3 size={12} />
              </button>
              {data.forecast_overridden && (
                <button
                  data-testid="budget-forecast-reset"
                  onClick={() => saveForecast(null)}
                  aria-label="Reset to last week"
                  title="Reset to last week's revenue"
                  style={{ background: 'transparent', border: 0, padding: 2, cursor: 'pointer', color: '#86868B' }}
                >
                  <RotateCcw size={11} />
                </button>
              )}
            </div>
          )}
          <div style={{ fontSize: 10, color: '#86868B', marginTop: 2 }}>
            {data.forecast_overridden ? 'Manager override' : 'Default = last week'}
          </div>
        </div>

        {/* Wage allocation — live progress */}
        <div data-testid="budget-tile-wages" style={{ gridColumn: 'span 1', minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Wallet size={10} />
            <span>Wage allocation</span>
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
              {editingTarget ? (
                <>
                  <input
                    data-testid="budget-target-input"
                    type="number"
                    min="0"
                    max="100"
                    autoFocus
                    value={targetDraft}
                    onChange={(e) => setTargetDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveTarget(Number(targetDraft) || 0); if (e.key === 'Escape') setEditingTarget(false); }}
                    style={{ width: 40, padding: '2px 4px', border: '1px solid #007AFF', borderRadius: 4, fontSize: 11, ...FONT }}
                  />
                  <span>%</span>
                  <button onClick={() => saveTarget(Number(targetDraft) || 0)} disabled={saving}
                    style={{ width: 18, height: 18, borderRadius: 999, background: '#34C759', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={10} color="#FFF" />
                  </button>
                </>
              ) : (
                <button
                  data-testid="budget-target-edit"
                  onClick={() => { setTargetDraft(String(Math.round(Number(data.target_pct) || 30))); setEditingTarget(true); }}
                  style={{ background: 'transparent', border: 0, padding: '0 2px', cursor: 'pointer', color: '#007AFF', fontSize: 10, fontWeight: 700 }}
                  title="Change target %"
                >
                  {Math.round(data.target_pct || 30)}%
                </button>
              )}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: accent, letterSpacing: '-0.02em' }}>
              {fmtGbpD(remaining)}
            </span>
            <span style={{ fontSize: 11, color: '#86868B' }}>left of {fmtGbp(budget)}</span>
          </div>
          <div style={{ marginTop: 6, height: 6, borderRadius: 999, background: '#F0F0F2', overflow: 'hidden', position: 'relative' }}>
            <div
              data-testid="budget-progress-fill"
              style={{
                position: 'absolute', inset: 0, width: `${Math.min(100, usedPct)}%`,
                background: accent, borderRadius: 999, transition: 'width 0.3s ease',
              }}
            />
          </div>
          <div style={{ fontSize: 10, color: '#86868B', marginTop: 4 }}>
            Used <span style={{ color: '#1D1D1F', fontWeight: 700 }}>{fmtGbpD(used)}</span>
            {' · '}
            <span style={{ color: accent, fontWeight: 700 }}>{usedPct.toFixed(0)}%</span>
            {usedPct > 100 && <span style={{ color: '#FF3B30', fontWeight: 700 }}> · over budget</span>}
          </div>
        </div>
      </div>

      {err && (
        <div data-testid="budget-error" style={{ marginTop: 8, fontSize: 11, color: '#C0392B' }}>
          {err}
        </div>
      )}
    </div>
  );
};

const ShiftMgmt = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { adminLocationId, locations } = useLocation2();

  // Anchor on this week's Monday. Navigation moves in 7-day chunks.
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const [shifts, setShifts] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [staffFilter, setStaffFilter] = useState(''); // admin-only: show only one person's shifts
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // shift object or new template
  // Quick-copy popover: { shift, anchor } — clicking the copy icon on any
  // shift card opens a small popover with date presets (next day / +2 /
  // next week / custom) that duplicates the shift into another date.
  const [copyingShift, setCopyingShift] = useState(null);
  const [copyBusy, setCopyBusy] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishMsg, setPublishMsg] = useState('');
  const [printBusy, setPrintBusy] = useState(false);
  const [emailDebug, setEmailDebug] = useState(null); // { open, loading, data, error }
  // AI rota suggestion — preview before applying.
  const [aiBusy, setAiBusy] = useState(false);
  const [aiPreview, setAiPreview] = useState(null); // { reasoning, target_start, shifts }
  const [aiError, setAiError] = useState('');

  const locName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  const load = useCallback(async () => {
    if (!adminLocationId) return;
    setLoading(true);
    setError('');
    try {
      const [rows, staff] = await Promise.all([
        api.shiftsList({ location_id: adminLocationId, start_date: toIso(weekStart), end_date: toIso(weekEnd) }),
        // Only admins need the staff list — for assigning shifts and filtering.
        isAdmin ? api.adminListStaff().catch(() => []) : Promise.resolve([]),
      ]);
      setShifts(rows || []);
      // Scope the staff roster to people who work at this location AND
      // are currently Active. Legacy records with no `location_ids` and no
      // explicit `active` field are treated as "available everywhere" so
      // they don't silently vanish.
      const scopedStaff = (staff || []).filter(s => {
        if (s.active === false) return false;
        const ids = Array.isArray(s.location_ids) ? s.location_ids : [];
        return ids.length === 0 || ids.includes(adminLocationId);
      });
      setStaffList(scopedStaff);
    } catch (err) {
      setError(err.message || 'Failed to load shifts');
    } finally {
      setLoading(false);
    }
  }, [adminLocationId, weekStart, weekEnd, isAdmin]);

  useEffect(() => { load(); }, [load]);

  // "Copy last week" — replicate every shift from the previous 7 days
  // into the currently-visible week. Asks for confirmation since this
  // can create dozens of records at once.
  const copyLastWeek = async () => {
    const src = addDays(weekStart, -7);
    if (!window.confirm(`Copy every shift from ${fmtRange(src, addDays(src, 6))} into ${fmtRange(weekStart, weekEnd)}?`)) return;
    setCopyBusy(true);
    setError('');
    try {
      const res = await api.shiftCopyWeek({
        location_id: adminLocationId,
        source_start: toIso(src),
        target_start: toIso(weekStart),
        overwrite: false,
      });
      if (!res.copied && !res.skipped) {
        setError(res.message || 'Nothing to copy — last week had no shifts.');
      }
      await load();
    } catch (err) {
      setError(err.message || 'Could not copy week');
    } finally {
      setCopyBusy(false);
    }
  };

  // Duplicate a single shift into a target date. Same staff, role and
  // times; new shift starts as a draft (backend default) so the manager
  // can review before publishing.
  const copyShiftTo = async (shift, targetDateIso) => {
    if (!shift || !targetDateIso) return;
    setCopyBusy(true);
    setError('');
    try {
      await api.shiftCreate({
        location_id: shift.location_id || adminLocationId,
        staff_id: shift.staff_id,
        date: targetDateIso,
        start_time: shift.start_time,
        end_time: shift.end_time,
        role: shift.role || '',
        notes: shift.notes || '',
      });
      setCopyingShift(null);
      // If the target lands outside the visible week, jump the view to
      // that week so the manager immediately sees the new shift land.
      const target = new Date(targetDateIso);
      if (target < weekStart || target > addDays(weekStart, 6)) {
        setWeekStart(startOfWeek(target));
      } else {
        await load();
      }
    } catch (e) {
      setError(e.message || 'Could not copy shift');
    } finally {
      setCopyBusy(false);
    }
  };

  // AI rota suggest — ask Claude for a draft week, preview, then apply.
  const aiSuggest = async () => {
    setAiBusy(true);
    setAiError('');
    setAiPreview(null);
    try {
      const res = await api.shiftAiSuggestWeek({
        location_id: adminLocationId,
        target_start: toIso(weekStart),
      });
      if (!res.shifts || res.shifts.length === 0) {
        setAiError(res.reasoning || 'AI could not produce a rota for this week. Check that staff and recent sales exist.');
        return;
      }
      setAiPreview(res);
    } catch (e) {
      setAiError(e.message || 'AI suggest failed');
    } finally {
      setAiBusy(false);
    }
  };

  const aiApply = async () => {
    if (!aiPreview) return;
    const payloadShifts = aiPreview.shifts.map(s => ({
      location_id: adminLocationId,
      staff_id: s.staff_id,
      date: s.date,
      start_time: s.start_time,
      end_time: s.end_time,
      role: s.role || '',
      notes: '',
    }));
    setAiBusy(true);
    setAiError('');
    try {
      const res = await api.shiftBulkCreate({
        location_id: adminLocationId,
        shifts: payloadShifts,
        skip_clashes: true,
      });
      setPublishMsg(`Added ${res.created} AI-suggested draft shift${res.created === 1 ? '' : 's'}${res.skipped ? ` · ${res.skipped} skipped (already scheduled)` : ''}.`);
      setAiPreview(null);
      await load();
    } catch (e) {
      setAiError(e.message || 'Could not apply AI rota');
    } finally {
      setAiBusy(false);
    }
  };

  // "Publish week" — flip every draft shift in the current view to
  // published and notify each affected staff member by push. Idempotent:
  // already-published shifts are skipped silently.
  const publishWeek = async () => {
    const draftCount = shifts.filter(s => !s.published).length;
    if (draftCount === 0) {
      setPublishMsg('Nothing to publish — this week is already up to date.');
      return;
    }
    if (!window.confirm(`Publish ${draftCount} draft shift${draftCount === 1 ? '' : 's'} and notify the staff involved?`)) return;
    setPublishBusy(true);
    setPublishMsg('');
    setError('');
    try {
      const res = await api.shiftPublishWeek({
        location_id: adminLocationId,
        start_date: toIso(weekStart),
        end_date: toIso(weekEnd),
        notify: true,
      });
      setPublishMsg(`Published ${res.published} shift${res.published === 1 ? '' : 's'} · notified ${res.notified} staff member${res.notified === 1 ? '' : 's'}${typeof res.emailed === 'number' ? ` · emailed ${res.emailed}` : ''}.`);
      await load();
    } catch (err) {
      setError(err.message || 'Could not publish week');
    } finally {
      setPublishBusy(false);
    }
  };

  // "Print rota" — landscape A4 PDF for pinning up in the kitchen.
  // Downloads via the browser's usual Save-As flow.
  const printRota = async () => {
    setPrintBusy(true);
    setError('');
    try {
      const blob = await api.shiftPrintDownload({
        location_id: adminLocationId,
        start_date: toIso(weekStart),
        end_date: toIso(weekEnd),
        include_drafts: true,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rota_${adminLocationId}_${toIso(weekStart)}_to_${toIso(weekEnd)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Could not print rota');
    } finally {
      setPrintBusy(false);
    }
  };

  // "Email debug" — inspects the shift-publish email path so admins can
  // see exactly why emails did or didn't reach staff (SMTP status, per
  // staff email lookup, actual send attempt). `override_to` reroutes
  // every attempt to a single admin mailbox so we can safely test in
  // production without spamming real staff. Dry-run is a look-only.
  const runEmailDebug = async ({ dryRun = false, overrideTo = '' } = {}) => {
    setEmailDebug({ open: true, loading: true, data: null, error: '' });
    try {
      const data = await api.shiftDebugEmail({
        location_id: adminLocationId,
        start_date: toIso(weekStart),
        end_date: toIso(weekEnd),
        dry_run: dryRun,
        override_to: overrideTo || undefined,
      });
      setEmailDebug({ open: true, loading: false, data, error: '' });
    } catch (err) {
      setEmailDebug({ open: true, loading: false, data: null, error: err.message || 'Debug failed' });
    }
  };

  // Wage cost for the visible window — sums hours × hourly_rate from the
  // staff records. Falls back to 0 for staff without an hourly rate set.
  const rateById = useMemo(() => Object.fromEntries(
    (staffList || []).map(s => [s.id, Number(s.hourly_rate) || 0]),
  ), [staffList]);

  if (!adminLocationId) {
    return (
      <div style={{ padding: 24, ...FONT }}>
        <p style={{ color: '#FF9500' }}>Pick a location from JKHive home first.</p>
      </div>
    );
  }

  // Group shifts by date string for the day cards. Apply the admin staff
  // filter here so the per-day cards + weekly totals stay in sync.
  const visibleShifts = staffFilter
    ? shifts.filter(s => s.staff_id === staffFilter)
    : shifts;
  const byDay = visibleShifts.reduce((acc, s) => {
    (acc[s.date] = acc[s.date] || []).push(s);
    return acc;
  }, {});

  // Weekly totals — hours per staff member across the visible window.
  const totals = visibleShifts.reduce((acc, s) => {
    if (!s.staff_id) return acc;
    const key = s.staff_id;
    if (!acc[key]) acc[key] = { name: s.staff_name, hours: 0, count: 0 };
    acc[key].hours += (s.hours || 0);
    acc[key].count += 1;
    return acc;
  }, {});
  const totalsList = Object.values(totals).sort((a, b) => b.hours - a.hours);
  const weekHours = totalsList.reduce((s, r) => s + r.hours, 0);
  // Estimated wage for the visible window. Visible to admin only.
  const weekCost = isAdmin
    ? visibleShifts.reduce((sum, s) => sum + (s.hours || 0) * (rateById[s.staff_id] || 0), 0)
    : 0;
  // Draft count = unpublished shifts in the visible window.
  const draftCount = visibleShifts.filter(s => !s.published).length;

  return (
    <div data-testid="shifts-page" style={{ paddingBottom: 110, ...FONT }}>
      {/* Back */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <button
          data-testid="shifts-back"
          onClick={() => navigate('/jkhive/workforce')}
          style={{ background: 'transparent', border: 0, padding: 4, display: 'inline-flex', alignItems: 'center', gap: 4, color: '#007AFF', cursor: 'pointer', fontSize: 13, fontWeight: 600, ...FONT }}
        >
          <ArrowLeft size={14} /> Workforce
        </button>
      </div>

      <div style={{ marginBottom: 14 }}>
        <p className="text-[13px] font-medium" style={{ color: '#86868B' }}>
          {isAdmin ? 'Rotas, swaps and weekly hours' : 'Your upcoming shifts'}
        </p>
        <h1 className="text-[28px] sm:text-[34px] font-bold tracking-tight leading-[1.05]" style={{ color: '#1D1D1F' }}>
          {isAdmin ? 'Shift Management' : 'My Shifts'}
        </h1>
        <p className="text-[13px] mt-1" style={{ color: '#86868B' }}>{locName}</p>
      </div>

      {/* Wage Budget bar — admin only. Shows last-week revenue, next-week
          forecast (override-able) and the 30% wage allocation, then ticks
          DOWN live as shifts × hourly_rate fill the week. */}
      {isAdmin && (
        <BudgetBar
          locationId={adminLocationId}
          weekStart={toIso(weekStart)}
          weekCost={weekCost}
        />
      )}

      {/* Admin tools row — per-staff filter + Copy-last-week + Publish.
          Hidden for regular staff so their view stays focused on their own shifts. */}
      {isAdmin && (
        <>
          <div style={{
            background: '#FFFFFF', borderRadius: 14, padding: 10, marginBottom: 8,
            display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}>
            <select
              data-testid="shifts-staff-filter"
              value={staffFilter}
              onChange={e => setStaffFilter(e.target.value)}
              style={{ flex: '1 1 140px', padding: '8px 10px', borderRadius: 9, background: '#F5F5F7', border: 0, fontSize: 13, color: '#1D1D1F', ...FONT }}
            >
              <option value="">Everyone</option>
              {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button
              data-testid="shifts-copy-week"
              onClick={copyLastWeek}
              disabled={copyBusy}
              style={{
                padding: '8px 12px', borderRadius: 999, border: 0,
                background: '#F5F5F7', color: '#1D1D1F', fontSize: 12, fontWeight: 700,
                cursor: copyBusy ? 'not-allowed' : 'pointer', opacity: copyBusy ? 0.5 : 1,
                display: 'inline-flex', alignItems: 'center', gap: 4, ...FONT,
              }}>
              <Copy size={12} /> {copyBusy ? 'Copying…' : 'Copy last week'}
            </button>
            <button
              data-testid="shifts-ai-suggest"
              onClick={aiSuggest}
              disabled={aiBusy}
              title="Auto-fill this week with an AI-suggested draft rota"
              style={{
                padding: '8px 12px', borderRadius: 999, border: 0,
                background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)',
                color: '#FFFFFF', fontSize: 12, fontWeight: 700,
                cursor: aiBusy ? 'wait' : 'pointer', opacity: aiBusy ? 0.7 : 1,
                display: 'inline-flex', alignItems: 'center', gap: 4, ...FONT,
              }}>
              <Sparkles size={12} /> {aiBusy ? 'Thinking…' : 'AI Suggest'}
            </button>
            <button
              data-testid="shifts-publish-week"
              onClick={publishWeek}
              disabled={publishBusy || draftCount === 0}
              style={{
                padding: '8px 14px', borderRadius: 999, border: 0,
                background: draftCount === 0 ? '#F5F5F7' : '#34C759',
                color: draftCount === 0 ? '#86868B' : '#FFFFFF',
                fontSize: 12, fontWeight: 700,
                cursor: (publishBusy || draftCount === 0) ? 'not-allowed' : 'pointer',
                opacity: publishBusy ? 0.6 : 1,
                display: 'inline-flex', alignItems: 'center', gap: 4, ...FONT,
              }}>
              <Send size={12} /> {publishBusy ? 'Publishing…' : (draftCount > 0 ? `Publish (${draftCount})` : 'Published')}
            </button>
            <button
              data-testid="shifts-print-rota"
              onClick={printRota}
              disabled={printBusy}
              title="Download landscape A4 rota PDF for pinning up"
              style={{
                padding: '8px 12px', borderRadius: 999, border: 0,
                background: '#F5F5F7', color: '#1D1D1F', fontSize: 12, fontWeight: 700,
                cursor: printBusy ? 'wait' : 'pointer', opacity: printBusy ? 0.6 : 1,
                display: 'inline-flex', alignItems: 'center', gap: 4, ...FONT,
              }}>
              <Printer size={12} /> {printBusy ? 'Building PDF…' : 'Print'}
            </button>
            <button
              data-testid="shifts-email-debug"
              onClick={() => runEmailDebug({ dryRun: true })}
              title="Inspect the rota-email path for this week (SMTP status + per-staff diagnosis, no emails sent)"
              style={{
                padding: '8px 12px', borderRadius: 999, border: 0,
                background: '#FFF3E0', color: '#A35E00', fontSize: 12, fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 4, ...FONT,
              }}>
              <Bug size={12} /> Email debug
            </button>
          </div>
          {publishMsg && (
            <div data-testid="shifts-publish-msg" style={{ background: 'rgba(52,199,89,0.12)', color: '#1B7A35', borderRadius: 12, padding: '8px 12px', marginBottom: 10, fontSize: 12, ...FONT }}>
              {publishMsg}
            </div>
          )}
        </>
      )}

      {/* Week navigator */}
      <div style={{
        background: '#FFFFFF', borderRadius: 14, padding: 12, marginBottom: 12,
        display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}>
        <button data-testid="shifts-prev-week"
          onClick={() => setWeekStart(prev => addDays(prev, -7))}
          aria-label="Previous week"
          style={{ width: 36, height: 36, borderRadius: 999, background: '#F5F5F7', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={16} color="#1D1D1F" />
        </button>
        <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1D1D1F', ...FONT }}>{fmtRange(weekStart, weekEnd)}</p>
          <p style={{ margin: 0, fontSize: 11, color: '#86868B' }}>
            {visibleShifts.length} shift{visibleShifts.length === 1 ? '' : 's'} · {weekHours.toFixed(1)}h total
            {isAdmin && weekCost > 0 && ` · £${weekCost.toFixed(2)}`}
            {isAdmin && draftCount > 0 && (
              <span style={{ color: '#A35E00', marginLeft: 6 }}>· {draftCount} draft{draftCount === 1 ? '' : 's'}</span>
            )}
          </p>
        </div>
        <button data-testid="shifts-this-week"
          onClick={() => setWeekStart(startOfWeek(new Date()))}
          style={{ padding: '8px 12px', borderRadius: 999, background: '#F5F5F7', border: 0, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#1D1D1F', ...FONT }}
        >Today</button>
        <button data-testid="shifts-next-week"
          onClick={() => setWeekStart(prev => addDays(prev, 7))}
          aria-label="Next week"
          style={{ width: 36, height: 36, borderRadius: 999, background: '#F5F5F7', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronRight size={16} color="#1D1D1F" />
        </button>
      </div>

      {error && (
        <div data-testid="shifts-error" style={{ background: 'rgba(255,59,48,0.10)', borderRadius: 12, padding: 12, marginBottom: 12, color: '#C0392B', fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading && <p style={{ textAlign: 'center', color: '#86868B', padding: 24 }}>Loading…</p>}

      {!loading && (
        <>
          {/* Desktop / tablet grid view (RotaCloud-style) — admin only. */}
          {isAdmin && (
            <div className="hidden md:block">
              <ShiftGrid
                weekStart={weekStart}
                staffList={staffList}
                shifts={visibleShifts}
                staffFilter={staffFilter}
                locationId={adminLocationId}
                onChanged={load}
                onEditShift={(s) => setEditing(s)}
                onCopyShift={(s, ev) => {
                  const rect = ev.currentTarget.getBoundingClientRect();
                  setCopyingShift({
                    shift: s,
                    anchor: { left: rect.right + window.scrollX - 240, top: rect.bottom + window.scrollY + 6 },
                  });
                }}
              />
            </div>
          )}

          {/* Per-day list — primary view on mobile, fallback when no staff exist.
              NOTE: wrap the flex container in an outer `md:hidden` div because
              the inline `display:flex` on the inner div would otherwise win
              over Tailwind's `md:hidden` (display:none) at >=768px. */}
          <div className={isAdmin ? 'md:hidden' : ''}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {Array.from({ length: 7 }, (_, i) => {
              const d = addDays(weekStart, i);
              const iso = toIso(d);
              const day = byDay[iso] || [];
              const isToday = toIso(new Date()) === iso;
              return (
                <div key={iso} data-testid={`shifts-day-${iso}`}
                  style={{
                    background: '#FFFFFF', borderRadius: 14, padding: '12px 14px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    borderLeft: isToday ? '3px solid #007AFF' : '3px solid transparent',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: day.length ? 8 : 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1D1D1F', flex: 1 }}>
                      {fmtDayLabel(d)} {isToday && <span style={{ fontSize: 10, color: '#007AFF', marginLeft: 4 }}>· Today</span>}
                    </p>
                    {isAdmin && (
                      <button data-testid={`shifts-add-${iso}`}
                        onClick={() => setEditing({ date: iso, location_id: adminLocationId, staff_id: '', start_time: '09:00', end_time: '17:00', role: '', notes: '' })}
                        aria-label="Add shift"
                        style={{ width: 28, height: 28, borderRadius: 999, background: '#1D1D1F', border: 0, color: '#FFFFFF', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Plus size={14} />
                      </button>
                    )}
                  </div>
                  {day.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 12, color: '#C7C7CC', ...FONT }}>No shifts</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {day.map(s => (
                        <div
                          key={s.id}
                          data-testid={`shifts-row-${s.id}`}
                          role={isAdmin ? 'button' : undefined}
                          tabIndex={isAdmin ? 0 : undefined}
                          onClick={() => isAdmin && setEditing(s)}
                          onKeyDown={(e) => { if (isAdmin && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setEditing(s); } }}
                          style={{
                            display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 6,
                            alignItems: 'center',
                            padding: '8px 10px', borderRadius: 10,
                            background: s.published ? '#F9F9FB' : 'rgba(255,149,0,0.10)',
                            borderLeft: s.published ? 'none' : '3px solid #FF9500',
                            border: 0, cursor: isAdmin ? 'pointer' : 'default', textAlign: 'left',
                            ...FONT,
                          }}>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1D1D1F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {s.staff_name}
                              {isAdmin && !s.published && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '1px 6px', borderRadius: 999, background: 'rgba(255,149,0,0.18)', color: '#A35E00', fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                                  <FileEdit size={8} /> Draft
                                </span>
                              )}
                            </p>
                            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#86868B' }}>
                              {s.start_time} – {s.end_time}{s.role && ` · ${s.role}`}
                            </p>
                          </div>
                          <span style={{ alignSelf: 'center', fontSize: 12, fontWeight: 700, color: '#007AFF' }}>{s.hours}h</span>
                          {isAdmin && (
                            <button
                              data-testid={`shifts-copy-${s.id}`}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                const rect = ev.currentTarget.getBoundingClientRect();
                                setCopyingShift({
                                  shift: s,
                                  anchor: { left: rect.right + window.scrollX - 240, top: rect.bottom + window.scrollY + 6 },
                                });
                              }}
                              aria-label="Copy shift to another day"
                              title="Copy shift"
                              style={{ width: 28, height: 28, borderRadius: 999, background: 'rgba(0,122,255,0.10)', color: '#007AFF', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Copy size={13} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </div>

          {/* Weekly totals card */}
          {totalsList.length > 0 && (
            <div data-testid="shifts-weekly-totals" style={{ background: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Users size={16} color="#1D1D1F" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1D1D1F', flex: 1 }}>Weekly hours by staff</h3>
                <Clock size={14} color="#86868B" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {totalsList.map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, ...FONT }}>
                    <span style={{ flex: 1, color: '#1D1D1F' }}>{t.name}</span>
                    <span style={{ color: '#86868B', fontSize: 11 }}>{t.count} shift{t.count === 1 ? '' : 's'}</span>
                    <span style={{ fontWeight: 700, color: '#1D1D1F', width: 50, textAlign: 'right' }}>{t.hours.toFixed(1)}h</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit / Add modal */}
      {editing && (
        <ShiftModal
          shift={editing}
          staffList={staffList}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      {/* Quick-copy popover — duplicates a shift to another date. */}
      {copyingShift && (
        <CopyShiftPopover
          shift={copyingShift.shift}
          anchor={copyingShift.anchor}
          busy={copyBusy}
          onClose={() => setCopyingShift(null)}
          onCopy={(dateIso) => copyShiftTo(copyingShift.shift, dateIso)}
        />
      )}

      {/* AI rota error banner */}
      {aiError && !aiPreview && (
        <div data-testid="shifts-ai-error" style={{ background: 'rgba(255,59,48,0.10)', borderRadius: 12, padding: 12, marginTop: 12, color: '#C0392B', fontSize: 13, ...FONT }}>
          {aiError}
        </div>
      )}

      {/* AI rota preview modal */}
      {aiPreview && (
        <AiRotaPreview
          preview={aiPreview}
          weekStart={weekStart}
          busy={aiBusy}
          error={aiError}
          onClose={() => { setAiPreview(null); setAiError(''); }}
          onApply={aiApply}
        />
      )}

      {emailDebug?.open && (
        <EmailDebugModal
          state={emailDebug}
          onClose={() => setEmailDebug(null)}
          onRerun={runEmailDebug}
        />
      )}
    </div>
  );
};

/**
 * ShiftGrid — RotaCloud-style desktop matrix.
 *
 * Rows = staff (filtered to one if staffFilter is set).
 * Columns = the 7 days of the week (Mon → Sun).
 * Click an empty cell → small inline popover for start/end + role → creates a shift.
 * Click a shift block → opens the full edit modal (delegated to parent).
 * Drag a shift block → drop it on another cell to MOVE the shift
 *   (changes staff_id and/or date in one PATCH).
 *
 * Only rendered on `md:` and above; mobile keeps the day-card list which
 * is more thumb-friendly for staff viewing their own week.
 */
const ShiftGrid = ({ weekStart, staffList, shifts, staffFilter, locationId, onChanged, onEditShift, onCopyShift }) => {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const rows = useMemo(() => {
    const list = staffFilter ? staffList.filter(s => s.id === staffFilter) : staffList;
    // Sort by name for a stable layout regardless of API ordering.
    return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [staffList, staffFilter]);

  // Bucket shifts by `${staff_id}|${date}` so cell lookup is O(1).
  const byCell = useMemo(() => {
    const map = {};
    for (const s of shifts) {
      const key = `${s.staff_id}|${s.date}`;
      (map[key] = map[key] || []).push(s);
    }
    return map;
  }, [shifts]);

  // Per-staff weekly totals (hours) for the right-hand summary column.
  const totalsByStaff = useMemo(() => {
    const out = {};
    for (const s of shifts) {
      if (!s.staff_id) continue;
      out[s.staff_id] = (out[s.staff_id] || 0) + (s.hours || 0);
    }
    return out;
  }, [shifts]);

  // Inline quick-add popover state. Anchored to the clicked cell so the
  // editor never covers the cell itself.
  const [popover, setPopover] = useState(null); // { staffId, date, anchor }
  const [dropTarget, setDropTarget] = useState(null); // `${staffId}|${date}` while a drag is over it
  const [busy, setBusy] = useState(false);
  const dragShift = useRef(null);

  const closePopover = () => setPopover(null);

  const onCellClick = (staffId, dateIso, ev) => {
    if (busy) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    setPopover({
      staffId,
      date: dateIso,
      // Position popover just below the clicked cell.
      anchor: { left: rect.left + window.scrollX, top: rect.bottom + window.scrollY + 4 },
    });
  };

  const quickCreate = async ({ start_time, end_time, role }) => {
    if (!popover) return;
    setBusy(true);
    try {
      await api.shiftCreate({
        location_id: locationId,
        staff_id: popover.staffId,
        date: popover.date,
        start_time,
        end_time,
        role: role || '',
        notes: '',
      });
      closePopover();
      await onChanged();
    } catch (e) {
      // Surface error inline — keep popover open so the manager can retry.
      window.alert(e.message || 'Could not create shift');
    } finally {
      setBusy(false);
    }
  };

  const handleDragStart = (shift, ev) => {
    dragShift.current = shift;
    try { ev.dataTransfer.effectAllowed = 'move'; } catch { /* ignore */ }
  };

  const handleDragEnd = () => {
    dragShift.current = null;
    setDropTarget(null);
  };

  const handleDragOver = (key, ev) => {
    ev.preventDefault();
    try { ev.dataTransfer.dropEffect = 'move'; } catch { /* ignore */ }
    if (dropTarget !== key) setDropTarget(key);
  };

  const handleDrop = async (staffId, dateIso, ev) => {
    ev.preventDefault();
    const s = dragShift.current;
    dragShift.current = null;
    setDropTarget(null);
    if (!s) return;
    // No-op if dropped on the same cell.
    if (s.staff_id === staffId && s.date === dateIso) return;
    setBusy(true);
    try {
      await api.shiftUpdate(s.id, { staff_id: staffId, date: dateIso });
      await onChanged();
    } catch (e) {
      window.alert(e.message || 'Could not move shift');
    } finally {
      setBusy(false);
    }
  };

  const todayIso = toIso(new Date());

  if (rows.length === 0) {
    return (
      <div style={{ background: '#FFFFFF', borderRadius: 14, padding: 24, marginBottom: 16, textAlign: 'center', color: '#86868B', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        No staff set up for this location yet. Add staff under Workforce to start building rotas.
      </div>
    );
  }

  return (
    <div data-testid="shifts-grid" style={{ background: '#FFFFFF', borderRadius: 14, marginBottom: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 880 }}>
          {/* Header row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '180px repeat(7, minmax(110px, 1fr)) 84px',
            background: '#FAFAFC',
            borderBottom: '1px solid #ECECEF',
            ...FONT,
          }}>
            <div style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Staff</div>
            {days.map((d) => {
              const iso = toIso(d);
              const isToday = iso === todayIso;
              return (
                <div key={iso} style={{
                  padding: '10px 8px',
                  textAlign: 'center',
                  borderLeft: '1px solid #ECECEF',
                  background: isToday ? 'rgba(0,122,255,0.06)' : 'transparent',
                }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {DAY_NAMES[(d.getDay() + 6) % 7]}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 700, color: isToday ? '#007AFF' : '#1D1D1F' }}>
                    {d.getDate()}
                  </p>
                </div>
              );
            })}
            <div style={{ padding: '10px 8px', textAlign: 'center', borderLeft: '1px solid #ECECEF', fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total</div>
          </div>

          {/* Body rows */}
          {rows.map((staff, rowIdx) => (
            <div key={staff.id} style={{
              display: 'grid',
              gridTemplateColumns: '180px repeat(7, minmax(110px, 1fr)) 84px',
              borderBottom: rowIdx === rows.length - 1 ? 'none' : '1px solid #ECECEF',
              minHeight: 76,
            }}>
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1D1D1F' }}>{staff.name}</p>
                {staff.role && (
                  <p style={{ margin: 0, fontSize: 10, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{staff.role}</p>
                )}
              </div>
              {days.map((d) => {
                const iso = toIso(d);
                const key = `${staff.id}|${iso}`;
                const cellShifts = byCell[key] || [];
                const isToday = iso === todayIso;
                const isDrop = dropTarget === key;
                return (
                  <div
                    key={iso}
                    data-testid={`shifts-cell-${staff.id}-${iso}`}
                    onClick={(ev) => { if (cellShifts.length === 0) onCellClick(staff.id, iso, ev); }}
                    onDragOver={(ev) => handleDragOver(key, ev)}
                    onDragLeave={() => { if (dropTarget === key) setDropTarget(null); }}
                    onDrop={(ev) => handleDrop(staff.id, iso, ev)}
                    style={{
                      borderLeft: '1px solid #ECECEF',
                      padding: 4,
                      background: isDrop ? 'rgba(0,122,255,0.12)' : (isToday ? 'rgba(0,122,255,0.03)' : 'transparent'),
                      cursor: cellShifts.length === 0 ? 'pointer' : 'default',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      position: 'relative',
                      transition: 'background 0.15s',
                    }}
                  >
                    {cellShifts.length === 0 ? (
                      <div style={{
                        flex: 1, minHeight: 64,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#C7C7CC', opacity: 0,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = 0; }}>
                        <Plus size={16} />
                      </div>
                    ) : cellShifts.map(s => (
                      <div
                        key={s.id}
                        data-testid={`shifts-grid-block-${s.id}`}
                        draggable
                        role="button"
                        tabIndex={0}
                        onDragStart={(ev) => handleDragStart(s, ev)}
                        onDragEnd={handleDragEnd}
                        onClick={(ev) => { ev.stopPropagation(); onEditShift(s); }}
                        onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onEditShift(s); } }}
                        title={`${s.start_time}–${s.end_time}${s.role ? ' · ' + s.role : ''}${s.notes ? '\n' + s.notes : ''}`}
                        style={{
                          textAlign: 'left',
                          border: 0,
                          padding: '6px 8px',
                          borderRadius: 8,
                          background: s.published ? 'rgba(0,122,255,0.10)' : 'rgba(255,149,0,0.14)',
                          borderLeft: `3px solid ${s.published ? '#007AFF' : '#FF9500'}`,
                          color: '#1D1D1F',
                          cursor: 'grab',
                          fontFamily: 'inherit',
                          display: 'flex', flexDirection: 'column', gap: 2,
                          position: 'relative',
                        }}
                      >
                        <span style={{ fontSize: 11, fontWeight: 700 }}>
                          {s.start_time}–{s.end_time}
                        </span>
                        <span style={{ fontSize: 10, color: '#86868B', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {(s.hours || 0).toFixed(1)}h
                          {s.role && <span>· {s.role}</span>}
                          {!s.published && (
                            <span style={{ marginLeft: 'auto', padding: '0 4px', borderRadius: 4, background: 'rgba(255,149,0,0.25)', color: '#A35E00', fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Draft</span>
                          )}
                        </span>
                        {onCopyShift && (
                          <button
                            data-testid={`shifts-grid-copy-${s.id}`}
                            onClick={(ev) => { ev.stopPropagation(); onCopyShift(s, ev); }}
                            onMouseDown={(ev) => ev.stopPropagation()}
                            draggable={false}
                            aria-label="Copy shift to another day"
                            title="Copy shift"
                            style={{
                              position: 'absolute', top: 2, right: 2,
                              width: 20, height: 20, borderRadius: 999,
                              background: 'rgba(255,255,255,0.85)', border: 0,
                              color: '#007AFF', cursor: 'pointer',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                            }}
                          >
                            <Copy size={11} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
              <div style={{ borderLeft: '1px solid #ECECEF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#1D1D1F' }}>
                {(totalsByStaff[staff.id] || 0).toFixed(1)}h
              </div>
            </div>
          ))}
        </div>
      </div>

      {popover && (
        <QuickAddPopover
          anchor={popover.anchor}
          busy={busy}
          onClose={closePopover}
          onCreate={quickCreate}
        />
      )}
    </div>
  );
};

/**
 * Modal that surfaces the shift-publish email diagnosis. Shows SMTP
 * status, every staff member scheduled this week, their resolved
 * email address, and the actual send result. Two action buttons:
 *  • Dry run — recompute without sending anything
 *  • Send test → me — reroutes every attempt to the admin's own email
 *    so the admin can preview the exact HTML each staff will get.
 */
const EmailDebugModal = ({ state, onClose, onRerun }) => {
  const { loading, data, error } = state;
  const [overrideTo, setOverrideTo] = React.useState('');

  return (
    <div
      data-testid="email-debug-modal"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, padding: 16, ...FONT,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#FFFFFF', borderRadius: 20, maxWidth: 640, width: '100%',
          maxHeight: '84vh', overflow: 'auto', padding: 20,
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Bug size={16} color="#A35E00" />
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1D1D1F' }}>
            Rota email debug
          </h2>
          <button
            data-testid="email-debug-close"
            onClick={onClose}
            style={{ marginLeft: 'auto', background: 'transparent', border: 0, cursor: 'pointer', color: '#86868B' }}
            aria-label="Close"
          ><X size={18} /></button>
        </div>
        <p style={{ margin: '0 0 14px', fontSize: 12, color: '#86868B' }}>
          Inspects the shift-publish email path for the current week. Use
          &ldquo;Send test → me&rdquo; to receive a real preview at your own address without spamming staff.
        </p>

        {loading && (
          <div style={{ padding: 24, textAlign: 'center', color: '#86868B', fontSize: 13 }}>
            Diagnosing…
          </div>
        )}
        {error && (
          <div style={{ background: 'rgba(255,59,48,0.08)', color: '#C0392B', padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {data && (
          <>
            <div style={{ background: '#F5F5F7', borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12 }}>
                <div>
                  <span style={{ color: '#86868B' }}>SMTP: </span>
                  <strong style={{ color: data.smtp_configured ? '#1B7A35' : '#C0392B' }}>
                    {data.smtp_configured ? 'configured' : 'NOT configured'}
                  </strong>
                </div>
                {data.smtp_host && (
                  <div><span style={{ color: '#86868B' }}>Host: </span><strong>{data.smtp_host}</strong></div>
                )}
                {data.smtp_email && (
                  <div><span style={{ color: '#86868B' }}>Sender: </span><strong>{data.smtp_email}</strong></div>
                )}
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: '#3A3A3C' }}>
                {data.location_name} · {data.shifts_in_window} shifts across {data.staff_scheduled} staff ·
                {' '}{data.dry_run ? 'dry-run' : `sent ${data.sent}`}
                {data.override_to ? ` · rerouted to ${data.override_to}` : ''}
              </div>
            </div>

            {(!data.results || data.results.length === 0) ? (
              <p style={{ color: '#86868B', fontSize: 13, textAlign: 'center', padding: 20 }}>
                No staff are scheduled for this week.
              </p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#FBFBFD', color: '#86868B', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    <th style={{ textAlign: 'left', padding: '8px 8px', fontSize: 11 }}>Staff</th>
                    <th style={{ textAlign: 'left', padding: '8px 8px', fontSize: 11 }}>Email used</th>
                    <th style={{ textAlign: 'right', padding: '8px 8px', fontSize: 11 }}>Shifts</th>
                    <th style={{ textAlign: 'left', padding: '8px 8px', fontSize: 11 }}>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map(r => (
                    <tr key={r.staff_id} style={{ borderTop: '1px solid #EEE' }}>
                      <td style={{ padding: '8px 8px', fontWeight: 600, color: '#1D1D1F' }}>{r.staff_name || '—'}</td>
                      <td style={{ padding: '8px 8px', color: r.resolved_recipient ? '#1D1D1F' : '#C0392B', fontSize: 11 }}>
                        {r.resolved_recipient || '(none)'}
                        {r.personal_email && r.account_email && r.personal_email !== r.account_email && (
                          <div style={{ color: '#86868B', fontSize: 10 }}>account: {r.account_email}</div>
                        )}
                      </td>
                      <td style={{ padding: '8px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.shift_count}</td>
                      <td style={{ padding: '8px 8px', fontSize: 11 }}>
                        <span style={{
                          display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontWeight: 700,
                          background: r.sent ? 'rgba(52,199,89,0.12)' : (r.reason === 'dry_run' ? '#F5F5F7' : 'rgba(255,149,0,0.12)'),
                          color: r.sent ? '#1B7A35' : (r.reason === 'dry_run' ? '#3A3A3C' : '#A35E00'),
                        }}>{r.sent ? 'SENT' : (r.reason || 'skipped')}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        <div style={{ borderTop: '1px solid #EEE', marginTop: 14, paddingTop: 12 }}>
          <label style={{ display: 'block', fontSize: 11, color: '#86868B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
            Send test → me (routes every email to this address)
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              data-testid="email-debug-override"
              type="email"
              placeholder="your.email@example.com"
              value={overrideTo}
              onChange={e => setOverrideTo(e.target.value)}
              style={{ flex: '1 1 200px', padding: '8px 10px', borderRadius: 10, border: '1px solid #E5E5EA', fontSize: 13 }}
            />
            <button
              data-testid="email-debug-send-test"
              onClick={() => onRerun({ dryRun: false, overrideTo })}
              disabled={!overrideTo || loading}
              style={{
                padding: '8px 14px', borderRadius: 999, border: 0,
                background: overrideTo ? '#34C759' : '#F5F5F7',
                color: overrideTo ? '#FFFFFF' : '#86868B', fontSize: 12, fontWeight: 700,
                cursor: overrideTo ? 'pointer' : 'not-allowed',
              }}>
              Send test
            </button>
            <button
              data-testid="email-debug-rerun"
              onClick={() => onRerun({ dryRun: true })}
              disabled={loading}
              style={{
                padding: '8px 14px', borderRadius: 999, border: 0,
                background: '#F5F5F7', color: '#1D1D1F', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>
              Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Tiny inline popover for the empty-cell quick-add. Offers three common
 * presets plus a custom start/end time + role. Anchored at a fixed
 * page-coordinate so it tracks the clicked cell on the X axis but stays
 * inside the viewport on the Y axis.
 */
const QuickAddPopover = ({ anchor, busy, onClose, onCreate }) => {
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('17:00');
  const [role, setRole] = useState('');

  // Clamp so the popover never overflows the right edge.
  const POPOVER_W = 280;
  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - POPOVER_W - 8));
  const top = Math.min(anchor.top, window.innerHeight + window.scrollY - 260);

  const preset = (s, e) => () => onCreate({ start_time: s, end_time: e, role });

  return (
    <>
      {/* Click-outside catcher */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'transparent' }} />
      <div data-testid="shifts-quick-add" style={{
        position: 'absolute', zIndex: 60,
        left, top, width: POPOVER_W,
        background: '#FFFFFF', borderRadius: 14,
        boxShadow: '0 12px 32px rgba(0,0,0,0.16)', border: '1px solid #ECECEF',
        padding: 12, ...FONT,
      }}>
        <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Quick add</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
          <button data-testid="shifts-preset-morning" disabled={busy} onClick={preset('08:00', '14:00')}
            style={{ padding: '8px 6px', borderRadius: 8, border: 0, background: '#F5F5F7', fontSize: 11, fontWeight: 700, cursor: 'pointer', ...FONT }}>
            Morning · 8–14
          </button>
          <button data-testid="shifts-preset-evening" disabled={busy} onClick={preset('14:00', '22:00')}
            style={{ padding: '8px 6px', borderRadius: 8, border: 0, background: '#F5F5F7', fontSize: 11, fontWeight: 700, cursor: 'pointer', ...FONT }}>
            Evening · 14–22
          </button>
          <button data-testid="shifts-preset-day" disabled={busy} onClick={preset('09:00', '17:00')}
            style={{ padding: '8px 6px', borderRadius: 8, border: 0, background: '#F5F5F7', fontSize: 11, fontWeight: 700, cursor: 'pointer', ...FONT }}>
            Day · 9–17
          </button>
          <button data-testid="shifts-preset-close" disabled={busy} onClick={preset('17:00', '23:00')}
            style={{ padding: '8px 6px', borderRadius: 8, border: 0, background: '#F5F5F7', fontSize: 11, fontWeight: 700, cursor: 'pointer', ...FONT }}>
            Close · 17–23
          </button>
        </div>
        <div style={{ height: 1, background: '#ECECEF', margin: '6px 0 10px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
          <label>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Start</span>
            <input data-testid="shifts-quick-start" type="time" value={start} onChange={e => setStart(e.target.value)}
              style={{ display: 'block', marginTop: 2, width: '100%', padding: '6px 8px', borderRadius: 8, background: '#F5F5F7', border: 0, fontSize: 13, ...FONT }} />
          </label>
          <label>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>End</span>
            <input data-testid="shifts-quick-end" type="time" value={end} onChange={e => setEnd(e.target.value)}
              style={{ display: 'block', marginTop: 2, width: '100%', padding: '6px 8px', borderRadius: 8, background: '#F5F5F7', border: 0, fontSize: 13, ...FONT }} />
          </label>
        </div>
        <label style={{ display: 'block', marginBottom: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Role (optional)</span>
          <input data-testid="shifts-quick-role" value={role} onChange={e => setRole(e.target.value)} placeholder="Barista, Kitchen…"
            style={{ display: 'block', marginTop: 2, width: '100%', padding: '6px 8px', borderRadius: 8, background: '#F5F5F7', border: 0, fontSize: 13, ...FONT }} />
        </label>
        <button data-testid="shifts-quick-create" disabled={busy} onClick={() => onCreate({ start_time: start, end_time: end, role })}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 999, border: 0, background: '#1D1D1F', color: '#FFFFFF', fontSize: 13, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1, ...FONT }}>
          {busy ? 'Adding…' : 'Add shift'}
        </button>
      </div>
    </>
  );
};


/**
 * AiRotaPreview — overlay listing the AI-suggested shifts grouped by day,
 * with an Apply (bulk-create as drafts) / Cancel choice. Shows the LLM's
 * one-line reasoning + a per-day breakdown so the manager can sanity-check
 * before committing.
 */
const AiRotaPreview = ({ preview, weekStart, busy, error, onClose, onApply }) => {
  const grouped = useMemo(() => {
    const by = {};
    for (const s of preview.shifts || []) {
      (by[s.date] = by[s.date] || []).push(s);
    }
    return by;
  }, [preview]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const totalHours = (preview.shifts || []).reduce((s, x) => s + (x.hours || 0), 0);

  return (
    <div data-testid="shifts-ai-preview" style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }} />
      <div style={{
        position: 'relative', background: '#FFFFFF', width: '100%', maxWidth: 560,
        borderRadius: 18, padding: '20px 22px', boxShadow: '0 24px 48px rgba(0,0,0,0.28)',
        maxHeight: '88vh', overflowY: 'auto', ...FONT,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>AI Suggested Rota</p>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1D1D1F', margin: '2px 0 0' }}>
              {fmtRange(weekStart, addDays(weekStart, 6))}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#86868B' }}>
              {(preview.shifts || []).length} shifts · {totalHours.toFixed(1)}h total
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" data-testid="shifts-ai-close"
            style={{ width: 32, height: 32, borderRadius: 999, background: '#F5F5F7', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={15} color="#1D1D1F" />
          </button>
        </div>

        {preview.reasoning && (
          <div style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(79,70,229,0.08) 100%)', borderRadius: 12, padding: '10px 12px', marginBottom: 12, fontSize: 12, color: '#3F2A78', lineHeight: 1.5 }}>
            {preview.reasoning}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {days.map(d => {
            const iso = toIso(d);
            const list = grouped[iso] || [];
            return (
              <div key={iso} data-testid={`shifts-ai-day-${iso}`} style={{ background: '#F9F9FB', borderRadius: 12, padding: '8px 12px' }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#1D1D1F' }}>
                  {fmtDayLabel(d)} <span style={{ fontWeight: 500, color: '#86868B' }}>· {list.length} shift{list.length === 1 ? '' : 's'}</span>
                </p>
                {list.length > 0 && (
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {list.map((s, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                        <span style={{ flex: 1, color: '#1D1D1F' }}>{s.staff_name || 'Unassigned'}</span>
                        <span style={{ color: '#86868B' }}>{s.start_time}–{s.end_time}</span>
                        {s.role && <span style={{ color: '#86868B' }}>· {s.role}</span>}
                        <span style={{ fontWeight: 700, color: '#1D1D1F', width: 38, textAlign: 'right' }}>{(s.hours || 0).toFixed(1)}h</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <p data-testid="shifts-ai-apply-error" style={{ fontSize: 12, color: '#C0392B', margin: '0 0 10px' }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button data-testid="shifts-ai-cancel" onClick={onClose} disabled={busy}
            style={{ flex: 1, padding: '12px 14px', borderRadius: 999, border: 0, background: '#F5F5F7', color: '#1D1D1F', fontSize: 14, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', ...FONT }}>
            Cancel
          </button>
          <button data-testid="shifts-ai-apply" onClick={onApply} disabled={busy}
            style={{
              flex: 1, padding: '12px 14px', borderRadius: 999, border: 0,
              background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)',
              color: '#FFFFFF', fontSize: 14, fontWeight: 700,
              cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1, ...FONT,
            }}>
            {busy ? 'Applying…' : `Apply ${(preview.shifts || []).length} draft${(preview.shifts || []).length === 1 ? '' : 's'}`}
          </button>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 11, color: '#86868B', textAlign: 'center' }}>
          Shifts are added as <strong>drafts</strong>. Review on the grid, then Publish to notify staff.
        </p>
      </div>
    </div>
  );
};


const ShiftModal = ({ shift, staffList, onClose, onSaved }) => {
  const isEdit = !!shift.id;
  const [form, setForm] = useState({
    staff_id: shift.staff_id || '',
    date: shift.date,
    start_time: shift.start_time || '09:00',
    end_time: shift.end_time || '17:00',
    role: shift.role || '',
    notes: shift.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!form.staff_id) { setError('Pick a staff member'); return; }
    if (!form.date || !form.start_time || !form.end_time) { setError('Date and times are required'); return; }
    setSaving(true); setError('');
    try {
      if (isEdit) {
        await api.shiftUpdate(shift.id, form);
      } else {
        await api.shiftCreate({ location_id: shift.location_id, ...form });
      }
      onSaved();
    } catch (e) {
      setError(e.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this shift?')) return;
    setSaving(true); setError('');
    try {
      await api.shiftDelete(shift.id);
      onSaved();
    } catch (e) {
      setError(e.message || 'Could not delete');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="shift-modal"
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }} />
      <div style={{
        position: 'relative', background: '#FFFFFF', width: '100%', maxWidth: 460,
        borderRadius: 18, padding: '20px 22px', boxShadow: '0 24px 48px rgba(0,0,0,0.28)',
        maxHeight: '90vh', overflowY: 'auto', ...FONT,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>{isEdit ? 'Edit shift' : 'New shift'}</p>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1D1D1F', margin: '2px 0 0' }}>{shift.date}</h2>
          </div>
          <button onClick={onClose} aria-label="Close"
            style={{ width: 32, height: 32, borderRadius: 999, background: '#F5F5F7', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={15} color="#1D1D1F" />
          </button>
        </div>

        <label style={{ display: 'block', marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Staff member</span>
          <select data-testid="shift-staff-select" value={form.staff_id} onChange={e => set('staff_id', e.target.value)}
            style={{ display: 'block', marginTop: 4, width: '100%', padding: '10px 12px', borderRadius: 10, background: '#F5F5F7', border: 0, fontSize: 14, color: '#1D1D1F', ...FONT }}>
            <option value="">Select staff…</option>
            {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <label>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Start</span>
            <input data-testid="shift-start" type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)}
              style={{ display: 'block', marginTop: 4, width: '100%', padding: '10px 12px', borderRadius: 10, background: '#F5F5F7', border: 0, fontSize: 14, color: '#1D1D1F', ...FONT }} />
          </label>
          <label>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>End</span>
            <input data-testid="shift-end" type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)}
              style={{ display: 'block', marginTop: 4, width: '100%', padding: '10px 12px', borderRadius: 10, background: '#F5F5F7', border: 0, fontSize: 14, color: '#1D1D1F', ...FONT }} />
          </label>
        </div>

        <label style={{ display: 'block', marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date</span>
          <input data-testid="shift-date" type="date" value={form.date} onChange={e => set('date', e.target.value)}
            style={{ display: 'block', marginTop: 4, width: '100%', padding: '10px 12px', borderRadius: 10, background: '#F5F5F7', border: 0, fontSize: 14, color: '#1D1D1F', ...FONT }} />
        </label>

        <label style={{ display: 'block', marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Role <span style={{ textTransform: 'none', fontWeight: 500 }}>(optional)</span></span>
          <input data-testid="shift-role" value={form.role} onChange={e => set('role', e.target.value)} placeholder="Barista, Kitchen, Manager…"
            style={{ display: 'block', marginTop: 4, width: '100%', padding: '10px 12px', borderRadius: 10, background: '#F5F5F7', border: 0, fontSize: 14, color: '#1D1D1F', ...FONT }} />
        </label>

        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Notes <span style={{ textTransform: 'none', fontWeight: 500 }}>(optional)</span></span>
          <textarea data-testid="shift-notes" value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
            style={{ display: 'block', marginTop: 4, width: '100%', padding: '10px 12px', borderRadius: 10, background: '#F5F5F7', border: 0, fontSize: 14, color: '#1D1D1F', resize: 'vertical', ...FONT }} />
        </label>

        {error && <p style={{ fontSize: 12, color: '#C0392B', margin: '0 0 12px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10 }}>
          {isEdit && (
            <button data-testid="shift-delete" onClick={remove} disabled={saving}
              aria-label="Delete shift"
              style={{ width: 44, height: 44, borderRadius: 999, background: 'rgba(255,59,48,0.10)', color: '#C0392B', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <Trash2 size={16} />
            </button>
          )}
          <button data-testid="shift-save" onClick={save} disabled={saving}
            style={{
              flex: 1, padding: '12px 14px', borderRadius: 999, border: 0,
              background: '#1D1D1F', color: '#FFFFFF', fontSize: 14, fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, ...FONT,
            }}>
            {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Create shift')}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Quick-copy popover — duplicates an existing shift into another date.
 * Anchored to the right edge of the copy icon so it opens leftwards on
 * mobile without overflowing the viewport.
 *
 * Presets: Next day, In 2 days, Next week (same weekday +7 days), plus a
 * native `<input type="date">` for anywhere-else duplication.
 */
const CopyShiftPopover = ({ shift, anchor, busy, onClose, onCopy }) => {
  const base = useMemo(() => {
    const [y, m, d] = (shift.date || '').split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }, [shift.date]);

  const presets = useMemo(() => ([
    { key: 'next-day', label: 'Next day', date: toIso(addDays(base, 1)) },
    { key: 'two-days', label: 'In 2 days', date: toIso(addDays(base, 2)) },
    { key: 'next-week', label: 'Next week', date: toIso(addDays(base, 7)) },
  ]), [base]);

  const [custom, setCustom] = useState(toIso(addDays(base, 1)));

  // Clamp anchor so the popover never overflows the right edge.
  const left = Math.max(12, Math.min(anchor.left, window.innerWidth - 268));

  return (
    <>
      <div
        data-testid="shifts-copy-popover-scrim"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'transparent' }}
      />
      <div
        data-testid="shifts-copy-popover"
        style={{
          position: 'absolute',
          left,
          top: anchor.top,
          zIndex: 56,
          width: 256,
          background: '#FFFFFF',
          borderRadius: 14,
          boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
          padding: 12,
          ...FONT,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Copy size={13} color="#007AFF" />
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#1D1D1F' }}>
            Copy shift
          </p>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ marginLeft: 'auto', width: 24, height: 24, borderRadius: 999, background: '#F5F5F7', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={12} color="#1D1D1F" />
          </button>
        </div>

        <p style={{ margin: '0 0 10px', fontSize: 11, color: '#86868B' }}>
          {shift.staff_name} · {shift.start_time}–{shift.end_time}
          {shift.role && ` · ${shift.role}`}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {presets.map(p => (
            <button
              key={p.key}
              data-testid={`shifts-copy-preset-${p.key}`}
              disabled={busy}
              onClick={() => onCopy(p.date)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 12px', borderRadius: 10, border: 0,
                background: '#F5F5F7', color: '#1D1D1F',
                fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.5 : 1, ...FONT,
              }}
            >
              <span>{p.label}</span>
              <span style={{ fontSize: 11, color: '#86868B' }}>
                {new Date(p.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}
              </span>
            </button>
          ))}
        </div>

        <div style={{ borderTop: '1px solid #ECECEF', paddingTop: 10 }}>
          <label style={{ display: 'block' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Custom date
            </span>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <input
                data-testid="shifts-copy-custom-date"
                type="date"
                value={custom}
                min={toIso(base)}
                onChange={(e) => setCustom(e.target.value)}
                style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: '#F5F5F7', border: 0, fontSize: 12, color: '#1D1D1F', ...FONT }}
              />
              <button
                data-testid="shifts-copy-custom-go"
                disabled={busy || !custom}
                onClick={() => onCopy(custom)}
                style={{
                  padding: '8px 14px', borderRadius: 8, border: 0,
                  background: '#1D1D1F', color: '#FFFFFF',
                  fontSize: 12, fontWeight: 700,
                  cursor: (busy || !custom) ? 'not-allowed' : 'pointer',
                  opacity: (busy || !custom) ? 0.5 : 1,
                }}
              >
                {busy ? '…' : 'Go'}
              </button>
            </div>
          </label>
        </div>
      </div>
    </>
  );
};

export default ShiftMgmt;
