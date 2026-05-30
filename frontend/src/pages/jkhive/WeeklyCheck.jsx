import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Check, ChevronRight, X, ArrowRight, Gauge, Droplet, ListChecks } from 'lucide-react';
import { WizardHeader } from './cooling/_shared';
import { useLocation2 } from '../../contexts/LocationContext';
import api from '../../lib/api';

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
      const [probeCals, legio, checklists] = await Promise.all([
        api.adminListProbeCalibration({ location_id: adminLocationId, start_date: weekStartDate }).catch(() => []),
        api.adminListLegionella({ location_id: adminLocationId, start_date: weekStartDate }).catch(() => []),
        api.checklistList(adminLocationId).catch(() => []),
      ]);
      setData({ probeCals: probeCals || [], legio: legio || [], checklists: checklists || [] });
    } finally { setLoading(false); }
  }, [adminLocationId, weekStartDate]);

  useEffect(() => { load(); }, [load]);

  const weeklyTpls = (data.checklists || []).filter(c => c.frequency === 'weekly');
  const weeklyTplDone = (c) => {
    const at = c.last_run_at || c.last_run_date || '';
    return at >= weekStartIso || at.slice(0, 10) >= weekStartDate;
  };
  const weeklyChecklistDone = weeklyTpls.length > 0 && weeklyTpls.some(weeklyTplDone);

  // When there's exactly one weekly template, jump straight into its run page.
  const weeklyChecklistTarget = weeklyTpls.length === 1
    ? `/jkhive/checklists/${weeklyTpls[0].id}/run?back=/jkhive/weekly-check`
    : '/jkhive/checklists?back=/jkhive/weekly-check';

  const tasks = [
    {
      id: 'probe-calibration',
      icon: Gauge,
      color: '#FF9500',
      title: 'Probe Calibration',
      sub: 'Cold 0°C / Hot 100°C accuracy',
      to: '/jkhive/probe-calibration?back=/jkhive/weekly-check',
      done: (data.probeCals || []).length > 0,
    },
    {
      id: 'legionella',
      icon: Droplet,
      color: '#30B0C7',
      title: 'Legionella',
      sub: 'Weekly hot/cold water test',
      to: '/jkhive/legionella?back=/jkhive/weekly-check',
      done: (data.legio || []).length > 0,
    },
    {
      id: 'weekly-checklist',
      icon: ListChecks,
      color: '#34C759',
      title: weeklyTpls.length === 1 ? weeklyTpls[0].title : 'Weekly Checklist',
      sub: weeklyTpls.length === 0
        ? 'No weekly template — set one up in Checklists'
        : (weeklyChecklistDone ? 'Submitted this week' : 'Pending this week'),
      to: weeklyChecklistTarget,
      done: weeklyChecklistDone,
    },
  ];

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
                background: t.done ? 'rgba(52,199,89,0.15)' : 'rgba(255,149,0,0.15)',
                color: t.done ? '#1B7A35' : '#A35E00',
              }}>{t.done ? 'DONE' : 'PENDING'}</span>
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
