import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Settings, ClipboardCheck } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { useAuth } from '../../../contexts/AuthContext';
import { WizardHeader } from '../cooling/_shared';

const TABS = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];

/**
 * /jkhive/checklists — tabbed home for Daily / Weekly / Monthly templates.
 *
 * Each card shows the title, a clipboard icon, and a settings cog (admin only).
 * Tap card → opens the run wizard. Tap cog → opens the editor.
 * Floating "+ New checklist" pill (admin only) creates a new template
 * pre-filled with the active tab's frequency.
 */
const ChecklistsHome = () => {
  const navigate = useNavigate();
  const { adminLocationId, locations } = useLocation2();
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState('daily');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  useEffect(() => {
    if (!adminLocationId) { setLoading(false); return; }
    setLoading(true);
    api.checklistList(adminLocationId, tab)
      .then(setItems)
      .catch(err => alert('Failed to load: ' + err.message))
      .finally(() => setLoading(false));
  }, [adminLocationId, tab]);

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="checklists-home">
      <WizardHeader title="Checklists" locationName={locationName} dateStr={today} backTo="/jkhive/routines" />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, justifyContent: 'space-around', borderBottom: '1px solid rgba(0,0,0,0.06)', marginBottom: 16 }}>
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <button key={t.key}
              data-testid={`checklist-tab-${t.key}`}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, background: 'transparent', border: 0, padding: '12px 0',
                fontSize: 16, fontWeight: 700, color: active ? '#1D1D1F' : '#86868B',
                cursor: 'pointer', position: 'relative', fontFamily: 'inherit',
              }}>
              {t.label}
              {active && <span style={{ position: 'absolute', left: '30%', right: '30%', bottom: -1, height: 3, background: '#FF3B30', borderRadius: 2 }} />}
            </button>
          );
        })}
      </div>

      {!adminLocationId && (<p style={{ color: '#FF9500', padding: 18 }}>Pick a location from JKHive home first.</p>)}
      {adminLocationId && loading && (<p style={{ color: '#86868B', padding: 18, textAlign: 'center' }}>Loading…</p>)}

      {adminLocationId && !loading && items.length === 0 && (
        <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '36px 22px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ width: 64, height: 64, borderRadius: 999, background: 'rgba(52,199,89,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <ClipboardCheck size={32} color="#34C759" strokeWidth={2} />
          </div>
          <p style={{ fontSize: 17, fontWeight: 700, color: '#1D1D1F', margin: '0 0 4px' }}>No {tab} checklists</p>
          <p style={{ fontSize: 13, color: '#86868B', margin: 0 }}>
            {isAdmin ? 'Tap "New checklist" to create one.' : 'Ask an admin to add one.'}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map(it => (
          <div key={it.id} data-testid={`checklist-card-${it.id}`}
            style={{
              position: 'relative', background: '#FFFFFF', borderRadius: 18,
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)', overflow: 'hidden',
            }}>
            <button onClick={() => navigate(`/jkhive/checklists/${it.id}/run`)}
              data-testid={`checklist-open-${it.id}`}
              style={{
                width: '100%', display: 'block', padding: '16px 16px 22px', textAlign: 'left',
                background: 'transparent', border: 0, cursor: 'pointer', fontFamily: 'inherit',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <p style={{ fontSize: 18, fontWeight: 700, color: '#1D1D1F', margin: 0 }}>{it.title}</p>
                {it.scope === 'global' && (
                  <span data-testid={`checklist-global-${it.id}`} style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                    background: 'rgba(0,122,255,0.12)', color: '#0A84C9',
                  }}>🌍 All sites</span>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 4px' }}>
                <ClipboardEmoji />
              </div>
              <p style={{ fontSize: 12, color: '#86868B', margin: '6px 0 0' }}>
                {(it.items || []).length} item{(it.items || []).length === 1 ? '' : 's'}
              </p>
            </button>
            {isAdmin && (
              <button data-testid={`checklist-edit-${it.id}`}
                onClick={() => navigate(`/jkhive/checklists/${it.id}/edit`)}
                aria-label="Edit checklist"
                style={{
                  position: 'absolute', right: 12, bottom: 12, width: 36, height: 36,
                  borderRadius: 999, background: 'rgba(0,0,0,0.04)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: 0, cursor: 'pointer', color: '#3A3A3C',
                }}>
                <Settings size={18} strokeWidth={2.4} />
              </button>
            )}
          </div>
        ))}
      </div>

      {isAdmin && adminLocationId && (
        <button data-testid="new-checklist-btn"
          onClick={() => navigate(`/jkhive/checklists/new?frequency=${tab}`)}
          style={{
            position: 'fixed', right: 16, bottom: 96, maxWidth: 240,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px 20px', borderRadius: 999, border: 0,
            background: '#1D1D1F', color: '#FFFFFF', fontSize: 15, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
            boxShadow: '0 6px 18px rgba(0,0,0,0.18)', zIndex: 5,
          }}>
          <Plus size={18} strokeWidth={2.6} /> New checklist
        </button>
      )}
    </div>
  );
};

/** Big illustrative clipboard glyph used as the card visual. */
const ClipboardEmoji = () => (
  <span style={{ fontSize: 56, lineHeight: 1 }}>📋</span>
);

export default ChecklistsHome;
