import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Check, MessageSquare } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader } from '../cooling/_shared';

/**
 * /jkhive/checklists/:id/run — execute a checklist:
 * tap each item to tick it, optionally leave a comment, Submit.
 */
const ChecklistRun = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const backTo = searchParams.get('back') || '/jkhive/checklists';
  const { adminLocationId, locations } = useLocation2();
  const [tpl, setTpl] = useState(null);
  const [checked, setChecked] = useState(new Set());
  const [tickedAt, setTickedAt] = useState(new Map()); // idx → ISO timestamp of FIRST tick in window
  const [tickedBy, setTickedBy] = useState(new Map()); // idx → who first ticked
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  useEffect(() => {
    const now = new Date();

    // Compute the start of the persistence window based on frequency.
    // daily   → today (YYYY-MM-DD)
    // weekly  → Monday 00:00 of the current ISO week through Sunday 23:59
    // monthly → 1st of the current month through end of month
    const startOfDayLocalISO = () => now.toISOString().slice(0, 10);
    const startOfWeekLocalISO = () => {
      const d = new Date(now);
      const day = d.getDay(); // Sun=0..Sat=6
      const diff = day === 0 ? 6 : day - 1; // back to Monday
      d.setDate(d.getDate() - diff);
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    };
    const startOfMonthLocalISO = () => {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return d.toISOString();
    };

    Promise.all([
      api.checklistGet(id, adminLocationId),
      api.checklistRunsList(id).catch(() => []),
    ]).then(([template, allRuns]) => {
      setTpl(template);

      const freq = template?.frequency || 'daily';
      let windowStart;
      if (freq === 'weekly')        windowStart = startOfWeekLocalISO();
      else if (freq === 'monthly')  windowStart = startOfMonthLocalISO();
      else                          windowStart = startOfDayLocalISO();

      // Filter runs in the current window for this location.
      // Union every `checked_items` array across those runs so a Monday tick
      // stays visible on Wednesday. Reset happens automatically when the
      // window rolls over (new week / new month / new day).
      const inWindow = (allRuns || []).filter(r => {
        if (r.location_id && r.location_id !== adminLocationId) return false;
        const sa = r.submitted_at || '';
        if (freq === 'daily') return sa.slice(0, 10) === windowStart;
        return sa >= windowStart;
      });
      const union = new Set();
      const firstTick = new Map();  // idx → earliest run.submitted_at that included it
      const firstBy   = new Map();  // idx → who submitted that run
      let lastComment = '';
      // Sort oldest → newest so the first encounter wins (the date the item
      // was originally ticked, not the most recent re-confirmation).
      const sortedRuns = [...inWindow].sort((a, b) => (a.submitted_at || '').localeCompare(b.submitted_at || ''));
      for (const r of sortedRuns) {
        if (Array.isArray(r.checked_items)) {
          for (const i of r.checked_items) {
            union.add(i);
            if (!firstTick.has(i)) {
              firstTick.set(i, r.submitted_at || '');
              firstBy.set(i, r.submitted_by_name || r.submitted_by || '');
            }
          }
        }
        if (r.comment) lastComment = r.comment;
      }
      if (union.size > 0) setChecked(union);
      setTickedAt(firstTick);
      setTickedBy(firstBy);
      if (lastComment) setComment(lastComment);
    }).catch(err => alert('Failed to load: ' + err.message));
  }, [id, adminLocationId]);

  if (!tpl) return <p style={{ padding: 24, color: '#86868B', textAlign: 'center' }}>Loading…</p>;

  const fmtTickedAt = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    // Day-of-month + short month, no year. e.g. "Mon 25 May · 14:30".
    const day = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return `${day} · ${time}`;
  };

  const toggle = (idx) => {
    const next = new Set(checked);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    setChecked(next);
  };

  const total = (tpl.items || []).length;
  const all = checked.size === total && total > 0;

  const submit = async () => {
    setSubmitting(true);
    try {
      await api.checklistRunSubmit(id, { checked_items: [...checked], comment, location_id: adminLocationId });
      setDone(true);
    } catch (err) { alert('Submit failed: ' + err.message); }
    finally { setSubmitting(false); }
  };

  if (done) {
    return (
      <div style={{ padding: '24px 12px', fontFamily: 'Outfit, sans-serif' }} data-testid="checklist-done">
        <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '36px 22px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', marginTop: 80 }}>
          <div style={{ width: 72, height: 72, borderRadius: 999, background: '#34C759', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Check size={36} strokeWidth={2.6} color="#fff" />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#1D1D1F', margin: '0 0 6px' }}>Checklist saved!</h2>
          <p style={{ fontSize: 14, color: '#3A3A3C', margin: '0 0 18px' }}>
            {checked.size}/{total} ticked — logged against {locationName}.
          </p>
          <button data-testid="checklist-done-back"
            onClick={() => navigate(backTo, { replace: true })}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 999, border: 0,
              background: '#1D1D1F', color: '#FFFFFF', fontSize: 16, fontWeight: 600, cursor: 'pointer',
            }}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="checklist-run">
      <WizardHeader title={tpl.title} locationName={locationName} dateStr={today} backTo={backTo} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '6px 4px 10px' }}>
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#86868B', margin: 0 }}>
          {checked.size}/{total} done · {tpl.frequency}
        </p>
        {total > 0 && (
          <button
            data-testid="checklist-all-done"
            onClick={() => setChecked(all ? new Set() : new Set((tpl.items || []).map((_, i) => i)))}
            style={{
              padding: '6px 14px', borderRadius: 999, cursor: 'pointer',
              border: '1px solid rgba(0,0,0,0.12)',
              background: all ? '#FFFFFF' : '#1D1D1F',
              color: all ? '#1D1D1F' : '#FFFFFF',
              fontSize: 12, fontWeight: 700, letterSpacing: '0.02em',
              fontFamily: 'Outfit, sans-serif',
              display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
            }}>
            {all ? 'Clear' : (
              <>
                <Check size={13} strokeWidth={2.8} />
                All Done
              </>
            )}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
        {(tpl.items || []).map((it, idx) => {
          const isChecked = checked.has(idx);
          const tAt = tickedAt.get(idx);
          const tBy = tickedBy.get(idx);
          return (
            <button key={idx}
              data-testid={`checklist-item-${idx}`}
              onClick={() => toggle(idx)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                background: isChecked ? 'rgba(52,199,89,0.08)' : '#FFFFFF',
                border: 0, borderRadius: 14, cursor: 'pointer', textAlign: 'left',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                fontFamily: 'Outfit, sans-serif',
              }}>
              <span style={{
                width: 24, height: 24, borderRadius: 6,
                border: isChecked ? 0 : '2px solid #C7C7CC',
                background: isChecked ? '#34C759' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {isChecked && <Check size={16} strokeWidth={3} color="#fff" />}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: '#1D1D1F', textDecoration: isChecked ? 'line-through' : 'none', textDecorationColor: 'rgba(0,0,0,0.3)' }}>
                  {typeof it === 'string' ? it : it.text}
                </span>
                {isChecked && tAt && (
                  <span data-testid={`checklist-item-meta-${idx}`}
                    style={{ display: 'block', marginTop: 2, fontSize: 11, fontWeight: 500, color: '#1B7A35', letterSpacing: '0.01em' }}>
                    Ticked {fmtTickedAt(tAt)}{tBy ? ` · ${tBy}` : ''}
                  </span>
                )}
                {isChecked && !tAt && (
                  <span data-testid={`checklist-item-meta-${idx}`}
                    style={{ display: 'block', marginTop: 2, fontSize: 11, fontWeight: 500, color: '#86868B' }}>
                    Just ticked — submit to save
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 4px' }}>
        <MessageSquare size={14} strokeWidth={2.4} color="#86868B" />
        <p style={{ fontSize: 12, fontWeight: 600, color: '#86868B', margin: 0 }}>Comment (optional)</p>
      </div>
      <textarea data-testid="checklist-comment"
        value={comment} onChange={e => setComment(e.target.value.slice(0, 250))}
        rows={3}
        style={{
          width: '100%', padding: 12, fontSize: 14,
          border: '1px solid rgba(0,0,0,0.12)', borderRadius: 12,
          background: '#FFFFFF', color: '#1D1D1F', resize: 'vertical', outline: 'none',
          fontFamily: 'Outfit, sans-serif',
        }} />

      <div style={{ position: 'fixed', left: 16, right: 16, bottom: 96, maxWidth: 600, margin: '0 auto', zIndex: 5 }}>
        <button data-testid="checklist-submit-btn" onClick={submit} disabled={submitting}
          style={{
            width: '100%', padding: '18px 16px', borderRadius: 999, border: 0,
            background: '#1D1D1F', color: '#FFFFFF', fontSize: 17, fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1,
            boxShadow: '0 6px 18px rgba(0,0,0,0.18)', fontFamily: 'Outfit, sans-serif',
          }}>
          {submitting ? 'Submitting…' : (all ? 'Submit Record' : `Submit (${checked.size}/${total})`)}
        </button>
      </div>
    </div>
  );
};

export default ChecklistRun;
