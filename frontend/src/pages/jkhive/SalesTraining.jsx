import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Link2, RefreshCw, Loader2, MessageSquare, Sparkles, ChefHat } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';

const FONT = { fontFamily: 'Outfit, sans-serif' };

const fmtWhen = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/** Small card used for both up-sell and cross-sell tips. */
const TipCard = ({ head, script, reason, tint, tone }) => (
  <div style={{
    background: '#FFFFFF', borderRadius: 14, padding: 14,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)', borderLeft: `3px solid ${tint}`,
    display: 'flex', flexDirection: 'column', gap: 8, ...FONT,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        padding: '3px 8px', borderRadius: 999,
        background: `${tint}18`, color: tint,
        fontSize: 10, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
      }}>{tone}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: '#1D1D1F' }}>{head}</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, background: '#F8F8FA', borderRadius: 10, padding: '8px 10px' }}>
      <MessageSquare size={13} color="#86868B" style={{ marginTop: 2, flexShrink: 0 }} />
      <p style={{ fontSize: 13, color: '#1D1D1F', margin: 0, lineHeight: 1.4, fontStyle: 'italic' }}>
        “{script}”
      </p>
    </div>
    {reason && (
      <p style={{ fontSize: 11, color: '#86868B', margin: 0 }}>Why: {reason}</p>
    )}
  </div>
);

const SalesTraining = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading, isAuthenticated } = useAuth();
  const { adminLocationId, locations } = useLocation2();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);   // refresh in flight
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/admin-login');
  }, [authLoading, isAuthenticated, navigate]);

  const load = async () => {
    if (!adminLocationId) return;
    setLoading(true); setErr('');
    try {
      const res = await api.salesTrainingGet(adminLocationId);
      setData(res);
    } catch (e) {
      setErr(e.message || 'Failed to load training');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [adminLocationId]);

  const refresh = async () => {
    if (!adminLocationId || busy) return;
    if (!window.confirm(
      'Rebuild the sales training playbook from the current menu? '
      + '(Uses AI credits and will overwrite the existing content.)'
    )) return;
    setBusy(true); setErr('');
    try {
      const res = await api.salesTrainingRefresh(adminLocationId);
      setData(res);
    } catch (e) {
      setErr(e.message || 'Refresh failed');
    } finally {
      setBusy(false);
    }
  };

  const locName = locations.find(l => l.id === adminLocationId)?.name || 'this site';
  const upsells = data?.upsells || [];
  const crossSells = data?.cross_sells || [];
  const hasContent = data?.exists && (upsells.length || crossSells.length);

  return (
    <div data-testid="sales-training-page" style={{ paddingBottom: 24, ...FONT }}>
      <button
        data-testid="st-back"
        onClick={() => navigate('/jkhive/workforce')}
        style={{ background: 'none', border: 0, color: '#007AFF', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginBottom: 12, ...FONT }}
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1D1D1F', margin: 0, letterSpacing: '-0.02em' }}>
              Up-selling & Cross-selling
            </h1>
          </div>
          <p style={{ fontSize: 13, color: '#86868B', margin: '2px 0 0' }}>
            Server scripts for {locName}
            {data?.generated_at && (
              <> · updated {fmtWhen(data.generated_at)}
                {data?.generated_by_name ? ` by ${data.generated_by_name}` : ''}</>
            )}
          </p>
        </div>
        {isAdmin && (
          <button
            data-testid="st-refresh"
            onClick={refresh}
            disabled={busy || !adminLocationId}
            title="Regenerate with AI from the current menu"
            style={{
              padding: '8px 14px', borderRadius: 999, border: 0,
              background: busy ? '#E5E5EA' : 'linear-gradient(135deg, #34C759 0%, #007AFF 100%)',
              color: busy ? '#86868B' : '#FFFFFF',
              fontSize: 12, fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6, ...FONT,
            }}
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {busy ? 'Generating…' : 'Refresh with AI'}
          </button>
        )}
      </div>

      {err && (
        <div data-testid="st-error" style={{ marginTop: 10, background: 'rgba(255,59,48,0.10)', color: '#C0392B', padding: '10px 12px', borderRadius: 10, fontSize: 12 }}>
          {err}
        </div>
      )}

      {loading && !data && (
        <div style={{ padding: 40, textAlign: 'center', color: '#86868B' }}>
          <Loader2 size={20} className="animate-spin" style={{ display: 'inline-block' }} /> Loading…
        </div>
      )}

      {!loading && !hasContent && (
        <div data-testid="st-empty" style={{
          marginTop: 20, background: '#FFFFFF', borderRadius: 16, padding: 28,
          textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}>
          <Sparkles size={28} color="#AF52DE" style={{ margin: '0 auto 10px' }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1D1D1F', margin: '0 0 6px' }}>No training playbook yet</h3>
          <p style={{ fontSize: 13, color: '#86868B', margin: '0 0 14px', lineHeight: 1.5 }}>
            {isAdmin
              ? 'Hit “Refresh with AI” to generate the first playbook from the current menu. It takes ~15 seconds.'
              : 'Ask a manager to generate the training playbook — they’ll see a Refresh button up top.'}
          </p>
          {isAdmin && (
            <button
              data-testid="st-empty-generate"
              onClick={refresh}
              disabled={busy || !adminLocationId}
              style={{
                padding: '10px 18px', borderRadius: 12, border: 0,
                background: 'linear-gradient(135deg, #34C759 0%, #007AFF 100%)',
                color: '#FFFFFF', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 8, ...FONT,
              }}
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              Generate now
            </button>
          )}
        </div>
      )}

      {hasContent && (
        <div style={{ marginTop: 16, display: 'grid', gap: 24 }}>
          {/* Up-sells */}
          <section data-testid="st-upsells">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <ArrowUpRight size={18} color="#34C759" />
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1D1D1F', margin: 0 }}>Up-sells</h2>
              <span style={{ fontSize: 11, color: '#86868B' }}>{upsells.length} scripts</span>
            </div>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
              {upsells.map((u, i) => (
                <TipCard
                  key={i}
                  head={`${u.item}${u.suggestion ? ' — ' + u.suggestion : ''}`}
                  script={u.server_script || ''}
                  reason={u.reason}
                  tint="#34C759"
                  tone="Up-sell"
                />
              ))}
            </div>
          </section>

          {/* Cross-sells */}
          <section data-testid="st-crosssells">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Link2 size={18} color="#5856D6" />
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1D1D1F', margin: 0 }}>Cross-sells</h2>
              <span style={{ fontSize: 11, color: '#86868B' }}>{crossSells.length} pairings</span>
            </div>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
              {crossSells.map((c, i) => (
                <TipCard
                  key={i}
                  head={(c.items || []).join(' + ')}
                  script={c.server_script || ''}
                  reason={c.reason}
                  tint="#5856D6"
                  tone="Cross-sell"
                />
              ))}
            </div>
          </section>

          {data?.dish_count != null && (
            <p style={{ fontSize: 11, color: '#86868B', marginTop: 8, textAlign: 'center', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
              <ChefHat size={11} /> Generated from {data.dish_count} menu items · model {data.model}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default SalesTraining;
