import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, Check, Clock, ArrowRight, X,
  ListChecks, Refrigerator, ShowerHead, Flame, ChefHat,
  Soup, Snowflake, Truck, Sparkles, ClipboardCheck,
} from 'lucide-react';
import api from '../../lib/api';
import { useLocation2 } from '../../contexts/LocationContext';
import { WizardHeader } from './cooling/_shared';

/**
 * /jkhive/daily-check — operational hub.
 *
 * Lists every routine that should be completed today for the current
 * location. Each row reports a "done today" status by querying the
 * matching list endpoint and counting records dated today.
 *
 * Rows wired:
 *   1.  Opening checklist               → /jkhive/opening
 *   2.  Fridge / Freezer opening temp   → /jkhive/opening/fridge-temp
 *   3.  Washer Temps                    → /jkhive/washer-temps
 *   4.  Hot/Cold Holding                → /jkhive/hot-cold-holding
 *   5.  Cooked Temps                    → /jkhive/cooked-temps
 *   6.  Reheating                       → /jkhive/reheating
 *   7.  Bulk Cooling                    → /jkhive/cooking-cooling   (with No bulk prep today)
 *   8.  Deliveries                      → /jkhive/delivery-records  (with No delivery today)
 *   9.  Daily cleaning checklists       → /jkhive/checklists
 *   10. Fridge / Freezer closing temp   → /jkhive/kitchen-closedown
 *   11. Closing checklist               → /jkhive/kitchen-closedown
 */
const today = () => new Date().toISOString().slice(0, 10);
const isTodayIso = (iso) => (iso || '').slice(0, 10) === today();

const buildTasks = (loc, data) => {
  const dc = data.dailyCheck || {};
  const dcStatus = dc.status || 'not_started';
  const dcOpening = dcStatus === 'completed' || dcStatus === 'submitted';
  const dcFridges = (dc.fridges || []).length > 0 || dcOpening;
  const checklistsRunToday = (data.checklists || []).filter(c => (c.last_run_at || c.last_run_date || '').slice(0, 10) === today()).length;
  return [
    { id: 'opening',         icon: ListChecks,      color: '#FF9500', title: 'Opening checklist',
      sub: 'Daily setup tasks',                  to: '/jkhive/opening',
      done: dcOpening },
    { id: 'fridge-open',     icon: Refrigerator,    color: '#34C759', title: 'Fridge / Freezer opening temps',
      sub: 'AM temp probe round',               to: '/jkhive/opening/fridge-temp',
      done: dcFridges },
    { id: 'washer',          icon: ShowerHead,      color: '#FFCC00', title: 'Washer Temps',
      sub: 'Wash & rinse cycle',                to: '/jkhive/washer-temps',
      done: (data.washers || []).some(r => isTodayIso(r.recorded_at)) },
    { id: 'hot-cold',        icon: Flame,           color: '#FF3B30', title: 'Hot / Cold Holding',
      sub: 'Service temperatures',              to: '/jkhive/hot-cold-holding',
      done: (data.hotCold || []).some(r => isTodayIso(r.start_time || r.recorded_at)) },
    { id: 'cooked',          icon: ChefHat,         color: '#FF9500', title: 'Cooked Temps',
      sub: 'Probe at end of cook',              to: '/jkhive/cooked-temps',
      done: (data.cooked || []).some(r => isTodayIso(r.recorded_at)) },
    { id: 'reheating',       icon: Soup,            color: '#FF6B35', title: 'Reheating',
      sub: 'Reheat ≥75 °C log',                 to: '/jkhive/reheating',
      done: (data.reheating || []).some(r => isTodayIso(r.recorded_at)) },
    { id: 'bulk-cooling',    icon: Snowflake,       color: '#5AC8FA', title: 'Bulk Cooling',
      sub: 'Cool < 90 min · or "no bulk prep"', to: '/jkhive/cooking-cooling',
      done: (data.cooling || []).some(r => isTodayIso(r.started_at || r.recorded_at)),
      quickAction: { label: 'No bulk prep today', call: () => api.coolingNoBulkPrep(loc) } },
    { id: 'deliveries',      icon: Truck,           color: '#0A84C9', title: 'Deliveries',
      sub: 'Goods-in temps · or "no delivery"', to: '/jkhive/delivery-records',
      done: (data.deliveries || []).some(r => isTodayIso(r.recorded_at)),
      quickAction: { label: 'No deliveries today', call: () => api.deliveriesNoDelivery(loc) } },
    { id: 'cleaning',        icon: Sparkles,        color: '#32ADE6', title: 'Daily Cleaning',
      sub: 'Cleaning checklists',               to: '/jkhive/checklists',
      done: checklistsRunToday > 0 },
    { id: 'fridge-close',    icon: Refrigerator,    color: '#5856D6', title: 'Fridge / Freezer closing temps',
      sub: 'PM temp probe round',               to: '/jkhive/kitchen-closedown',
      done: (data.closedown?.fridges || []).length > 0 || data.closedown?.status === 'completed' },
    { id: 'closing',         icon: ClipboardCheck,  color: '#1D1D1F', title: 'Closing checklist',
      sub: 'End of trade tasks',                to: '/jkhive/kitchen-closedown',
      done: data.closedown?.status === 'completed' || data.closedown?.status === 'submitted' },
  ];
};

const DailyCheck = () => {
  const navigate = useNavigate();
  const { adminLocationId, locations } = useLocation2();
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const date = today();
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  const load = useCallback(async () => {
    if (!adminLocationId) { setLoading(false); return; }
    setLoading(true);
    const calls = [
      api.washerChecks(adminLocationId).catch(() => []),
      api.hotColdList(adminLocationId).catch(() => []),
      api.cookedList(adminLocationId).catch(() => []),
      api.reheatingList(adminLocationId).catch(() => []),
      api.coolingList(adminLocationId).catch(() => []),
      api.deliveriesList(adminLocationId).catch(() => []),
      api.checklistList(adminLocationId).catch(() => []),
      api.adminGetDailyCheck(adminLocationId, date).catch(() => null),
      api.adminGetClosedown(adminLocationId, date).catch(() => null),
    ];
    const [washers, hotCold, cooked, reheating, cooling, deliveries, checklists, dailyCheck, closedown] = await Promise.all(calls);
    setData({ washers, hotCold, cooked, reheating, cooling, deliveries, checklists, dailyCheck, closedown });
    setLoading(false);
  }, [adminLocationId, date]);
  useEffect(() => { load(); }, [load]);

  const tasks = useMemo(() => buildTasks(adminLocationId, data), [adminLocationId, data]);
  const done = tasks.filter(t => t.done).length;
  const outstanding = tasks.length - done;
  const firstPending = tasks.find(t => !t.done);

  const runQuickAction = async (task) => {
    if (!task.quickAction || busy) return;
    setBusy(task.id);
    try { await task.quickAction.call(); await load(); }
    catch (e) { alert(e.message); }
    finally { setBusy(null); }
  };

  return (
    <div style={{ paddingBottom: 130, fontFamily: 'Outfit, sans-serif' }} data-testid="daily-check-hub">
      <WizardHeader title="Today's Check" locationName={locationName} dateStr={date} backTo="/jkhive" />

      {/* Summary card */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <div data-testid="dc-outstanding-card"
          style={{ flex: 1, background: '#FFFFFF', borderRadius: 18, padding: '16px 18px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={16} color="#FF9500" strokeWidth={2.4} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Outstanding</span>
          </div>
          <p style={{ fontSize: 36, fontWeight: 800, color: '#1D1D1F', margin: '4px 0 0', fontFeatureSettings: '"tnum"' }}>{outstanding}</p>
        </div>
        <div data-testid="dc-done-card"
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
            <div key={t.id} data-testid={`dc-task-${t.id}`}
              style={{
                background: '#FFFFFF', borderRadius: 16, padding: 14,
                display: 'flex', alignItems: 'center', gap: 12,
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                opacity: t.done ? 0.7 : 1,
              }}>
              <button onClick={() => navigate(t.to)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }}>
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
              {t.quickAction && !t.done && (
                <button data-testid={`dc-quick-${t.id}`}
                  onClick={() => runQuickAction(t)}
                  disabled={busy === t.id}
                  style={{
                    marginLeft: 4, padding: '6px 12px', borderRadius: 999,
                    border: '1px solid rgba(0,0,0,0.12)', background: '#FFFFFF', color: '#1D1D1F',
                    fontSize: 11, fontWeight: 600, cursor: busy === t.id ? 'not-allowed' : 'pointer',
                    fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap',
                  }}>{busy === t.id ? '…' : t.quickAction.label}</button>
              )}
            </div>
          );
        })}
      </div>

      {/* Sticky bottom action bar */}
      <div style={{ position: 'fixed', left: 16, right: 16, bottom: 84, zIndex: 5, display: 'flex', gap: 10 }}>
        <button data-testid="dc-exit"
          onClick={() => navigate('/jkhive')}
          style={{
            padding: '14px 18px', borderRadius: 999,
            border: '1px solid rgba(0,0,0,0.12)', background: '#FFFFFF', color: '#1D1D1F',
            fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: 'Outfit, sans-serif', boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
          }}>
          <X size={16} strokeWidth={2.6} /> Exit
        </button>
        {firstPending && (
          <button data-testid="dc-jump-next"
            onClick={() => navigate(firstPending.to)}
            style={{
              flex: 1, padding: '18px 16px', borderRadius: 999, border: 0,
              background: '#1D1D1F', color: '#fff', fontSize: 16, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'Outfit, sans-serif',
              boxShadow: '0 8px 22px rgba(0,0,0,0.25)',
            }}>
            Jump to “{firstPending.title}” <ArrowRight size={18} strokeWidth={2.6} />
          </button>
        )}
        {!firstPending && !loading && (
          <div style={{ flex: 1, padding: '18px 16px', borderRadius: 999, background: '#34C759', color: '#fff', fontSize: 16, fontWeight: 700, textAlign: 'center', fontFamily: 'Outfit, sans-serif' }}>
            All checks done ✓
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyCheck;
