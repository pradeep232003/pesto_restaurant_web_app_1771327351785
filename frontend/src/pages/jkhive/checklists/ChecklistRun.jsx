import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  const { adminLocationId, locations } = useLocation2();
  const [tpl, setTpl] = useState(null);
  const [checked, setChecked] = useState(new Set());
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  useEffect(() => {
    api.checklistGet(id, adminLocationId)
      .then(setTpl)
      .catch(err => alert('Failed to load: ' + err.message));
  }, [id, adminLocationId]);

  if (!tpl) return <p style={{ padding: 24, color: '#86868B', textAlign: 'center' }}>Loading…</p>;

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
            onClick={() => navigate('/jkhive/checklists', { replace: true })}
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
      <WizardHeader title={tpl.title} locationName={locationName} dateStr={today} backTo="/jkhive/checklists" />

      <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#86868B', margin: '6px 4px 8px' }}>
        {checked.size}/{total} done · {tpl.frequency}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
        {(tpl.items || []).map((it, idx) => {
          const isChecked = checked.has(idx);
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
              <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: '#1D1D1F', textDecoration: isChecked ? 'line-through' : 'none', textDecorationColor: 'rgba(0,0,0,0.3)' }}>
                {typeof it === 'string' ? it : it.text}
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
