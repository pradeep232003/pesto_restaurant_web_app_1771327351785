import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, ChevronLeft, ChevronRight, X, Trash2, Users, Clock, Copy, Send, FileEdit, Sparkles,
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
  const [copyBusy, setCopyBusy] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishMsg, setPublishMsg] = useState('');
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
      // Scope the staff roster to people who work at this location. Legacy
      // records with no `location_ids` (empty array / missing field) are
      // treated as "available everywhere" so they don't silently vanish.
      const scopedStaff = (staff || []).filter(s => {
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
      setPublishMsg(`Published ${res.published} shift${res.published === 1 ? '' : 's'} · notified ${res.notified} staff member${res.notified === 1 ? '' : 's'}.`);
      await load();
    } catch (err) {
      setError(err.message || 'Could not publish week');
    } finally {
      setPublishBusy(false);
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
                        <button
                          key={s.id}
                          data-testid={`shifts-row-${s.id}`}
                          onClick={() => isAdmin && setEditing(s)}
                          disabled={!isAdmin}
                          style={{
                            display: 'grid', gridTemplateColumns: '1fr auto', gap: 6,
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
                        </button>
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
const ShiftGrid = ({ weekStart, staffList, shifts, staffFilter, locationId, onChanged, onEditShift }) => {
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
                      <button
                        key={s.id}
                        data-testid={`shifts-grid-block-${s.id}`}
                        draggable
                        onDragStart={(ev) => handleDragStart(s, ev)}
                        onDragEnd={handleDragEnd}
                        onClick={(ev) => { ev.stopPropagation(); onEditShift(s); }}
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
                      </button>
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

export default ShiftMgmt;
