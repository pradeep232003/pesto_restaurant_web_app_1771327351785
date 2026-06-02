import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Check, ChevronRight, X, ArrowRight, Gauge, Droplet, ListChecks } from 'lucide-react';
import { WizardHeader } from './cooling/_shared';
import { useLocation2 } from '../../contexts/LocationContext';
import api from '../../lib/api';
import { isRoutineApplicable } from './_routineCatalog';

/** Monday 00:00 of the current ISO week, as an ISO timestamp. */
const startOfWeekISO = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const WeeklyCheck = () => {
  const navigate = useNavigate();
  const { adminLocationId, locations } = useLocation2();
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  const weekStartIso = startOfWeekISO();
  const weekStartDate = weekStartIso.slice(0, 10);

  // Pretty "Mon 6 — Sun 12 May" range string for the header sub-text.
  const range = useMemo(() => {
    const start = new Date(weekStartIso);
    const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
    const fmt = (d) => d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    return `${fmt(start)} — ${fmt(end)}`;
  }, [weekStartIso]);

  const load = useCallback(async () => {
    if (!adminLocationId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [probeCalsAll, legioAll, checklists] = await Promise.all([
        // Probe calibrations come from /api/admin/probes/calibrations — the
        // JKHive wizard endpoint. Has `recorded_at` (full ISO), no date filter.
        api.probeCalibrations(adminLocationId).catch(() => []),
        // Pull EVERY legionella test (no start_date) so we can also surface
        // the most-recent record when it's outside this week.
        api.adminListLegionella({ location_id: adminLocationId }).catch(() => []),
        api.checklistList(adminLocationId).catch(() => []),
      ]);
      // Filter to this week client-side.
      const probeCalsThisWeek = (probeCalsAll || []).filter(r => (r.recorded_at || '') >= weekStartIso);
      const legioThisWeek = (legioAll || []).filter(r => {
        const d = r.date || r.recorded_at || '';
        return d >= weekStartDate;
      });
      // Newest-overall for "Last calibrated …" sub-text when this week is empty.
      const probeLast = (probeCalsAll || []).slice().sort((a, b) => (b.recorded_at || '').localeCompare(a.recorded_at || ''))[0];
      const legioLast = (legioAll || []).slice().sort((a, b) => ((b.date || b.recorded_at || '')).localeCompare(a.date || a.recorded_at || ''))[0];
      // For weekly templates, pull every run and compute the UNION of ticked
      // indices in the current week so we can derive PENDING / IN-PROGRESS /
      // DONE. Done = every visible item has been ticked at least once this
      // week. In-progress = some ticked but not all. Pending = zero ticks.
      const weeklyTpls = (checklists || []).filter(c => c.frequency === 'weekly');
      const weeklyProgress = await Promise.all(weeklyTpls.map(async (tpl) => {
        const runs = await api.checklistRunsList(tpl.id).catch(() => []);
        const inWeek = (runs || []).filter(r => {
          if (r.location_id && r.location_id !== adminLocationId) return false;
          const sa = r.submitted_at || '';
          return sa >= weekStartIso;
        });
        const union = new Set();
        for (const r of inWeek) for (const i of (r.checked_items || [])) union.add(i);
        const total = tpl.visible_items_count ?? (tpl.items || []).length;
        return { id: tpl.id, title: tpl.title, ticked: union.size, total, runCount: inWeek.length };
      }));
      setData({
        probeCals: probeCalsThisWeek, probeLast,
        legio: legioThisWeek, legioLast,
        checklists: checklists || [], weeklyTpls, weeklyProgress,
      });
    } finally { setLoading(false); }
  }, [adminLocationId, weekStartDate, weekStartIso]);

  useEffect(() => { load(); }, [load]);

  const weeklyTpls = data.weeklyTpls || [];
  const weeklyProgress = data.weeklyProgress || [];
  // Aggregate progress across all weekly templates at this location.
  const wkTicked = weeklyProgress.reduce((s, p) => s + p.ticked, 0);
  const wkTotal  = weeklyProgress.reduce((s, p) => s + p.total, 0);
  let weeklyState = 'pending';
  if (weeklyTpls.length === 0)      weeklyState = 'pending';      // no template at all
  else if (wkTotal === 0)           weeklyState = 'pending';      // empty templates
  else if (wkTicked >= wkTotal)     weeklyState = 'done';
  else if (wkTicked > 0)            weeklyState = 'in_progress';
  const weeklyChecklistDone = weeklyState === 'done';

  // When there's exactly one weekly template, jump straight into its run page.
  const weeklyChecklistTarget = weeklyTpls.length === 1
    ? `/jkhive/checklists/${weeklyTpls[0].id}/run?back=/jkhive/weekly-check`
    : '/jkhive/checklists?back=/jkhive/weekly-check';

  const fmtPastDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const probeDoneThisWeek = (data.probeCals || []).length > 0;
  const legioDoneThisWeek = (data.legio || []).length > 0;

  // Filter tiles by what's applicable for this location (Admin → Site Settings
  // → Weekly Check routines). Empty / missing routines list = all applicable.
  const applicable = useMemo(
    () => locations.find(l => l.id === adminLocationId)?.applicable_routines || [],
    [locations, adminLocationId]
  );
  const allTasks = [
    {
      id: 'probe-calibration',
      routineKey: 'probe_calibration',
      icon: Gauge,
      color: '#FF9500',
      title: 'Probe Calibration',
      sub: probeDoneThisWeek
        ? 'Done this week'
        : (data.probeLast?.recorded_at
            ? `Last calibrated ${fmtPastDate(data.probeLast.recorded_at)} — due again`
            : 'Cold 0°C / Hot 100°C accuracy'),
      to: '/jkhive/probe-calibration?back=/jkhive/weekly-check',
      done: probeDoneThisWeek,
    },
    {
      id: 'legionella',
      routineKey: 'legionella',
      icon: Droplet,
      color: '#30B0C7',
      title: 'Legionella',
      sub: legioDoneThisWeek
        ? 'Done this week'
        : (data.legioLast
            ? `Last tested ${fmtPastDate(data.legioLast.date || data.legioLast.recorded_at)} — due again`
            : 'Weekly hot/cold water test'),
      to: '/jkhive/legionella?back=/jkhive/weekly-check',
      done: legioDoneThisWeek,
    },
    {
      id: 'weekly-checklist',
      routineKey: 'weekly_checklist',
      icon: ListChecks,
      color: '#34C759',
      title: weeklyTpls.length === 1 ? weeklyTpls[0].title : 'Weekly Checklist',
      sub: weeklyTpls.length === 0
        ? 'No weekly template — set one up in Checklists'
        : (weeklyState === 'done'
            ? `All ${wkTotal} items ticked this week`
            : (weeklyState === 'in_progress'
                ? `${wkTicked} of ${wkTotal} items ticked`
                : 'Pending this week')),
      to: weeklyChecklistTarget,
      done: weeklyChecklistDone,
      state: weeklyState,
    },
  ];
  const tasks = allTasks.filter(t => isRoutineApplicable(applicable, t.routineKey));

  // Map each task into a {label, bg, color} pill spec. Custom 3-state for
  // weekly checklist so half-done shows as "IN PROGRESS" rather than PENDING.
  const stateForTask = (t) => {
    if (t.id === 'weekly-checklist') {
      if (t.state === 'done')        return { label: 'DONE',        bg: 'rgba(52,199,89,0.15)',  color: '#1B7A35' };
      if (t.state === 'in_progress') return { label: 'IN PROGRESS', bg: 'rgba(0,122,255,0.12)',  color: '#0A66CC' };
      return { label: 'PENDING', bg: 'rgba(255,149,0,0.15)', color: '#A35E00' };
    }
    return t.done
      ? { label: 'DONE',    bg: 'rgba(52,199,89,0.15)',  color: '#1B7A35' }
      : { label: 'PENDING', bg: 'rgba(255,149,0,0.15)', color: '#A35E00' };
  };

  const done = tasks.filter(t => t.done).length;
  const outstanding = tasks.length - done;
  const firstPending = tasks.find(t => !t.done);

  return (
    <div style={{ paddingBottom: 130, fontFamily: 'Outfit, sans-serif' }} data-testid="weekly-check-hub">
      <WizardHeader title="Weekly Check" locationName={locationName} dateStr={range} backTo="/jkhive/routines" />

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <div data-testid="wc-outstanding-card"
          style={{ flex: 1, background: '#FFFFFF', borderRadius: 18, padding: '16px 18px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={16} color="#FF9500" strokeWidth={2.4} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Outstanding</span>
          </div>
          <p style={{ fontSize: 36, fontWeight: 800, color: '#1D1D1F', margin: '4px 0 0', fontFeatureSettings: '"tnum"' }}>{outstanding}</p>
        </div>
        <div data-testid="wc-done-card"
          style={{ flex: 1, background: '#FFFFFF', borderRadius: 18, padding: '16px 18px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Check size={16} color="#34C759" strokeWidth={2.6} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Done</span>
          </div>
          <p style={{ fontSize: 36, fontWeight: 800, color: '#1D1D1F', margin: '4px 0 0', fontFeatureSettings: '"tnum"' }}>{done}</p>
        </div>
      </div>

      {loading && <p style={{ color: '#86868B', textAlign: 'center', padding: 18 }}>Loading…</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tasks.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} data-testid={`wc-task-${t.id}`}
              onClick={() => navigate(t.to)}
              style={{
                background: '#FFFFFF', borderRadius: 16, padding: 14,
                display: 'flex', alignItems: 'center', gap: 12,
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                opacity: t.done ? 0.7 : 1, width: '100%',
                border: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'Outfit, sans-serif',
              }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={22} color="#fff" strokeWidth={2} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1D1D1F', textDecoration: t.done ? 'line-through' : 'none' }}>{t.title}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#86868B' }}>{t.sub}</p>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                background: stateForTask(t).bg,
                color: stateForTask(t).color,
              }} data-testid={`wc-status-${t.id}`}>{stateForTask(t).label}</span>
              <ChevronRight size={16} color="#C7C7CC" strokeWidth={2.4} />
            </button>
          );
        })}
      </div>

      <div style={{ position: 'fixed', left: 16, right: 16, bottom: 84, zIndex: 5, display: 'flex', gap: 10 }}>
        <button data-testid="wc-exit"
          onClick={() => navigate('/jkhive/routines')}
          style={{
            padding: '14px 18px', borderRadius: 999,
            border: '1px solid rgba(0,0,0,0.12)', background: '#FFFFFF', color: '#1D1D1F',
            fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: 'Outfit, sans-serif', boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
          }}>
          <X size={16} strokeWidth={2.6} /> Exit
        </button>
        {firstPending && (
          <button data-testid="wc-jump-next"
            onClick={() => navigate(firstPending.to)}
            style={{
              flex: 1, padding: '14px 18px', borderRadius: 999, border: 0,
              background: '#1D1D1F', color: '#FFFFFF', fontSize: 15, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontFamily: 'Outfit, sans-serif', boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
            }}>
            Next: {firstPending.title} <ArrowRight size={16} strokeWidth={2.6} />
          </button>
        )}
      </div>
    </div>
  );
};

export default WeeklyCheck;
