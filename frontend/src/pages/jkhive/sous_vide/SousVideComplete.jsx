import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, MessageSquare } from 'lucide-react';
import api from '../../../lib/api';
import { useLocation2 } from '../../../contexts/LocationContext';
import { WizardHeader, TempStepper, TempGauge } from '../cooling/_shared';

/**
 * /jkhive/sous-vide/:id/complete — 4-step completion wizard:
 *   1. Enter final core temperature   (IMG_6747)
 *   2. Served or Cooled?              (IMG_6748)
 *   3. Confirm starting temperature   (IMG_6749)
 *   4. Add a comment? + Submit Record (IMG_6750)
 */
const SousVideComplete = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { adminLocationId, locations } = useLocation2();
  const today = new Date().toISOString().slice(0, 10);
  const locationName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  const [session, setSession] = useState(null);
  const [step, setStep] = useState(1);
  const [coreTemp, setCoreTemp] = useState(49.1);
  const [servedOrCooled, setServedOrCooled] = useState(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    if (!adminLocationId) return;
    api.sousVideList(adminLocationId, 'active').then(rows => {
      const r = (rows || []).find(x => x.id === id);
      if (!r) { alert('Session not found or already completed'); navigate('/jkhive/sous-vide', { replace: true }); return; }
      setSession(r);
    });
  }, [adminLocationId, id, navigate]);

  const back = () => (step === 1 ? navigate(-1) : setStep(step - 1));

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await api.sousVideComplete(id, {
        final_core_temp: Number(coreTemp),
        served_or_cooled: servedOrCooled,
        comment,
      });
      setDone(res);
    } catch (e) { alert('Submit failed: ' + e.message); }
    finally { setSubmitting(false); }
  };

  if (!session) {
    return (
      <div style={{ padding: 24, fontFamily: 'Outfit, sans-serif' }}>
        <WizardHeader title="Sous Vide" locationName={locationName} dateStr={today} backTo="/jkhive/sous-vide" />
        <p style={{ color: '#86868B', textAlign: 'center', marginTop: 40 }}>Loading…</p>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ padding: '24px 12px', fontFamily: 'Outfit, sans-serif' }} data-testid="sous-vide-complete-done">
        <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '36px 22px', textAlign: 'center', marginTop: 80 }}>
          <div style={{ width: 72, height: 72, borderRadius: 999, background: '#34C759', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Check size={36} strokeWidth={2.6} color="#fff" />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px' }}>Cook completed</h2>
          <p style={{ fontSize: 14, color: '#3A3A3C', margin: '0 0 18px' }}>
            {session.item_name} · final core {Number(done.final_core_temp).toFixed(1)}°C · {done.served_or_cooled}
          </p>
          <button data-testid="sous-vide-complete-back"
            onClick={() => navigate('/jkhive/sous-vide', { replace: true })}
            style={{ width: '100%', padding: '14px 16px', borderRadius: 999, border: 0, background: '#1D1D1F', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>Done</button>
        </div>
      </div>
    );
  }

  const cookedLabel = session.raw_or_cooked === 'pre-cooked' ? 'Pre-Cooked' : 'Raw';

  // ---------- Step 1 — Final core temperature ----------
  if (step === 1) {
    return (
      <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="sous-vide-complete-step1">
        <WizardHeader title="Sous Vide" locationName={locationName} dateStr={today} onBack={back} />
        <h2 style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.01em', color: '#1D1D1F', margin: '12px 0 32px' }}>
          Enter final core temperature
        </h2>
        <TempStepper value={coreTemp} onChange={(v) => setCoreTemp(Math.round(v * 10) / 10)} />
        <TempGauge
          value={coreTemp} min={45} max={100}
          ticks={[45, 56, 67, 78, 89, 100]}
          onChange={(v) => setCoreTemp(Math.round(v * 10) / 10)}
          color="#FF3B30"
        />
        <div style={{ position: 'fixed', left: 16, right: 16, bottom: 84, zIndex: 5 }}>
          <button data-testid="sous-vide-complete-temp-next" onClick={() => setStep(2)}
            style={{ width: '100%', padding: '18px 16px', border: 0, borderRadius: 999, background: '#1D1D1F', color: '#fff', fontSize: 17, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', boxShadow: '0 8px 22px rgba(0,0,0,0.25)' }}>Next</button>
        </div>
      </div>
    );
  }

  // ---------- Step 2 — Served or Cooled? ----------
  if (step === 2) {
    const Card = ({ id: cardId, label }) => (
      <button data-testid={`sous-vide-complete-${cardId}`}
        onClick={() => { setServedOrCooled(cardId); setStep(3); }}
        style={{
          flex: 1, height: 200, borderRadius: 18, background: '#FFFFFF',
          border: '2.5px solid #1D1D1F', cursor: 'pointer',
          display: 'flex', alignItems: 'flex-end', padding: 18,
          fontSize: 22, fontWeight: 600, color: '#1D1D1F',
          fontFamily: 'Outfit, sans-serif',
        }}>{label}</button>
    );
    return (
      <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="sous-vide-complete-step2">
        <WizardHeader title="Sous Vide" locationName={locationName} dateStr={today} onBack={back} />
        <h2 style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.01em', color: '#1D1D1F', margin: '32px 0 60px' }}>
          Is this item being served or cooled?
        </h2>
        <div style={{ display: 'flex', gap: 14 }}>
          <Card id="served" label="Served" />
          <Card id="cooled" label="Cooled" />
        </div>
      </div>
    );
  }

  // ---------- Step 3 — Confirm starting temperature ----------
  if (step === 3) {
    return (
      <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="sous-vide-complete-step3">
        <WizardHeader title="Sous Vide" locationName={locationName} dateStr={today} onBack={back} />
        <div style={{ textAlign: 'center', marginTop: 30 }}>
          <div style={{ fontSize: 120, lineHeight: 1 }}>{session.item_icon || '🍲'}</div>
          <p style={{ fontSize: 28, fontWeight: 700, color: '#1D1D1F', margin: '14px 0 0' }}>
            Sous Vide {session.item_name}
          </p>
          <h3 style={{ fontSize: 32, fontWeight: 800, color: '#1D1D1F', margin: '40px 0 24px', letterSpacing: '-0.01em' }}>
            Starting Temperature:
          </h3>
          <p style={{ fontSize: 56, fontWeight: 700, color: '#FF3B30', margin: 0, fontFeatureSettings: '"tnum"' }}>
            {Number(coreTemp).toFixed(1)}°C
          </p>
          <p style={{ fontSize: 13, color: '#86868B', margin: '14px 24px 0' }}>
            This becomes the start of your {servedOrCooled === 'cooled' ? 'cooling log' : 'service line'} for {cookedLabel.toLowerCase()} {session.item_name}.
          </p>
        </div>
        <div style={{ position: 'fixed', left: 16, right: 16, bottom: 84, zIndex: 5 }}>
          <button data-testid="sous-vide-complete-confirm-next" onClick={() => setStep(4)}
            style={{ width: '100%', padding: '18px 16px', border: 0, borderRadius: 999, background: '#1D1D1F', color: '#fff', fontSize: 17, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', boxShadow: '0 8px 22px rgba(0,0,0,0.25)' }}>Next</button>
        </div>
      </div>
    );
  }

  // ---------- Step 4 — Add comment + Submit ----------
  return (
    <div style={{ paddingBottom: 110, fontFamily: 'Outfit, sans-serif' }} data-testid="sous-vide-complete-step4">
      <WizardHeader title="Sous Vide" locationName={locationName} dateStr={today} onBack={back} />

      <div style={{ display: 'flex', justifyContent: 'center', margin: '60px 0 24px' }}>
        <div style={{ width: 96, height: 96, borderRadius: 24, background: 'rgba(0,122,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <MessageSquare size={56} strokeWidth={1.8} color="#0A84C9" />
        </div>
      </div>

      <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', color: '#1D1D1F', margin: '0 0 4px', textAlign: 'center' }}>
        Add a comment?
      </h2>
      <p style={{ fontSize: 14, color: '#86868B', margin: '0 0 18px', textAlign: 'center' }}>(This is optional)</p>

      <textarea data-testid="sous-vide-complete-comment"
        value={comment} onChange={e => setComment(e.target.value.slice(0, 250))}
        rows={4}
        style={{
          width: '100%', padding: 14, fontSize: 15,
          border: '1px solid rgba(0,0,0,0.18)', borderRadius: 14,
          background: '#FFFFFF', color: '#1D1D1F', resize: 'vertical', outline: 'none',
          fontFamily: 'Outfit, sans-serif',
        }} />
      <p style={{ fontSize: 12, color: '#86868B', textAlign: 'right', marginTop: 6 }}>{comment.length}/250</p>

      <div style={{ position: 'fixed', left: 16, right: 16, bottom: 84, zIndex: 5 }}>
        <button data-testid="sous-vide-complete-submit"
          onClick={submit} disabled={submitting}
          style={{
            width: '100%', padding: '18px 16px', border: 0, borderRadius: 999,
            background: '#1D1D1F', color: '#FFFFFF', fontSize: 17, fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1,
            fontFamily: 'Outfit, sans-serif',
            boxShadow: '0 8px 22px rgba(0,0,0,0.25)',
          }}>{submitting ? 'Submitting…' : 'Submit Record'}</button>
      </div>
    </div>
  );
};

export default SousVideComplete;
