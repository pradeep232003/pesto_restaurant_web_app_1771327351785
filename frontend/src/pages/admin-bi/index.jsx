import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { TrendingUp, ArrowLeft, Users, DollarSign, ChefHat, Activity, AlertTriangle, RefreshCcw, ChevronDown, ChevronRight, Sparkles, AlertOctagon, CheckCircle2, Zap, KeyRound, X } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';

const font = { fontFamily: 'Outfit, sans-serif' };

const fmtGBP = (n) => `£${Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysAgoISO = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

const PRESETS = [
  { id: '7', label: 'Last 7 days', days: 7 },
  { id: '30', label: 'Last 30 days', days: 30 },
  { id: '90', label: 'Last 90 days', days: 90 },
  { id: 'mtd', label: 'Month to date', days: null, mtd: true },
];

const KpiCard = ({ icon: IconComp, label, value, sub, color, accent, testid }) => (
  <div data-testid={testid} className="p-5 rounded-2xl" style={{ background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
    <div className="flex items-center justify-between mb-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: color }}>
        <IconComp size={18} color="white" strokeWidth={1.6} />
      </div>
      {accent && (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: accent.bg, color: accent.color, ...font }}>{accent.label}</span>
      )}
    </div>
    <p className="text-2xl font-semibold tracking-tight" style={{ color: '#1D1D1F', ...font }}>{value}</p>
    <p className="text-xs mt-1" style={{ color: '#86868B', ...font }}>{label}</p>
    {sub && <p className="text-[11px] mt-1.5" style={{ color: '#86868B', ...font }}>{sub}</p>}
  </div>
);

const labourBand = (pct) => {
  if (pct === 0) return { bg: 'rgba(142,142,147,0.12)', color: '#8E8E93', label: 'no data' };
  if (pct <= 30) return { bg: 'rgba(52,199,89,0.12)', color: '#1F8C42', label: 'healthy' };
  if (pct <= 40) return { bg: 'rgba(255,204,0,0.18)', color: '#9A6A00', label: 'watch' };
  return { bg: 'rgba(255,59,48,0.12)', color: '#C0392B', label: 'high' };
};

const foodBand = (pct) => {
  if (pct === 0) return { bg: 'rgba(142,142,147,0.12)', color: '#8E8E93', label: 'no recipes' };
  if (pct <= 25) return { bg: 'rgba(52,199,89,0.12)', color: '#1F8C42', label: 'healthy' };
  if (pct <= 35) return { bg: 'rgba(255,204,0,0.18)', color: '#9A6A00', label: 'watch' };
  return { bg: 'rgba(255,59,48,0.12)', color: '#C0392B', label: 'high' };
};

const HEALTH_COLORS = {
  Excellent: { bg: 'linear-gradient(135deg, #34C759 0%, #1F8C42 100%)', chip: '#1F8C42' },
  Strong:    { bg: 'linear-gradient(135deg, #007AFF 0%, #0058B0 100%)', chip: '#0058B0' },
  Healthy:   { bg: 'linear-gradient(135deg, #5856D6 0%, #3E3CB5 100%)', chip: '#3E3CB5' },
  'At risk': { bg: 'linear-gradient(135deg, #FF9500 0%, #B36500 100%)', chip: '#B36500' },
  Critical:  { bg: 'linear-gradient(135deg, #FF3B30 0%, #B0241A 100%)', chip: '#B0241A' },
  'No data': { bg: 'linear-gradient(135deg, #8E8E93 0%, #555555 100%)', chip: '#555555' },
};

const PRIORITY_META = {
  high:   { bg: 'rgba(255,59,48,0.10)',  color: '#C0392B', label: 'HIGH' },
  medium: { bg: 'rgba(255,149,0,0.14)',  color: '#A35E00', label: 'MEDIUM' },
  low:    { bg: 'rgba(0,122,255,0.10)',  color: '#0058B0', label: 'LOW' },
};

/** Sparkle-headed panel that renders Claude's structured BI analysis. */
const AIInsightsPanel = ({ insights, loading, cached, generatedAt, error, keyInfo, canManageKey, onRefresh, onOpenKeyModal, onRetryAfterKey }) => {
  const palette = HEALTH_COLORS[insights?.health_label] || HEALTH_COLORS.Healthy;
  const score = insights?.health_score ?? null;
  const keyMissing = keyInfo && !keyInfo.has_key;
  // Surface "no key" errors with a primary action to open the key modal
  // rather than burying the fix in copy.
  const isKeyError = error && /no API key|EMERGENT_LLM_KEY|api key/i.test(error);

  return (
    <div data-testid="bi-ai-insights" className="rounded-2xl overflow-hidden mb-5"
      style={{ background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
      {/* Hero header — always renders so the section is recognisable mid-load. */}
      <div className="p-5 sm:p-6" style={{ background: insights ? palette.bg : 'linear-gradient(135deg, #1D1D1F 0%, #3A3A3C 100%)', color: '#FFFFFF' }}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles size={16} strokeWidth={2.2} />
            <span className="text-[11px] font-semibold uppercase tracking-wider truncate" style={{ ...font, opacity: 0.85 }}>
              AI Insights · Claude Sonnet 4.5
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {canManageKey ? (
              <button
                data-testid="bi-ai-configure-key"
                onClick={onOpenKeyModal}
                className="px-2.5 py-1 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 active:scale-95"
                style={{ background: 'rgba(255,255,255,0.18)', color: '#FFFFFF', border: 0, ...font }}
                title={keyInfo?.has_key ? `Active key ends ${keyInfo.last4} (${keyInfo.source})` : 'No API key configured'}
              >
                <KeyRound size={11} /> {keyInfo?.has_key ? `Key · ${keyInfo.last4}` : 'Add key'}
              </button>
            ) : keyInfo?.has_key ? (
              <span
                data-testid="bi-ai-key-readonly"
                className="px-2.5 py-1 rounded-full text-[11px] font-semibold inline-flex items-center gap-1"
                style={{ background: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.85)', ...font }}
                title="Only a Super Admin can change the API key"
              >
                <KeyRound size={11} /> Key · {keyInfo.last4}
              </span>
            ) : null}
            <button
              data-testid="bi-ai-refresh"
              onClick={onRefresh}
              disabled={loading || keyMissing}
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 active:scale-95"
              style={{ background: 'rgba(255,255,255,0.18)', color: '#FFFFFF', border: 0, ...font, opacity: (loading || keyMissing) ? 0.5 : 1 }}
            >
              <RefreshCcw size={11} className={loading ? 'animate-spin' : ''} /> {loading ? 'Thinking…' : (cached ? 'Refresh' : 'Re-run')}
            </button>
          </div>
        </div>
        {loading && !insights && !keyMissing && (
          <p className="text-sm" style={{ ...font, opacity: 0.9 }}>Analysing your data with Claude…</p>
        )}
        {keyMissing && !insights && !loading && (
          <div data-testid="bi-ai-no-key">
            <p className="text-base sm:text-lg leading-snug mb-2" style={{ ...font, fontWeight: 500 }}>
              {canManageKey ? 'Add an AI key to unlock insights.' : 'AI insights are disabled — no API key configured.'}
            </p>
            <p className="text-xs mb-3" style={{ ...font, opacity: 0.85 }}>
              {canManageKey ? 'Use your own Anthropic Claude key.' : 'Ask a Super Admin to add an Anthropic Claude key.'}
            </p>
            {canManageKey && (
              <button
                data-testid="bi-ai-add-key-cta"
                onClick={onOpenKeyModal}
                className="px-3.5 py-2 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 active:scale-95"
                style={{ background: '#FFFFFF', color: '#1D1D1F', border: 0, ...font }}
              >
                <KeyRound size={12} /> Configure AI key
              </button>
            )}
          </div>
        )}
        {insights && (
          <>
            <div className="flex items-baseline gap-3 mb-2">
              {score != null && (
                <span data-testid="bi-ai-score" className="text-4xl font-bold tracking-tight" style={{ ...font }}>{score}</span>
              )}
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider"
                style={{ background: 'rgba(255,255,255,0.22)', color: '#FFFFFF', ...font }}>
                {insights.health_label?.toUpperCase()}
              </span>
            </div>
            <p data-testid="bi-ai-headline" className="text-base sm:text-lg leading-snug" style={{ ...font, fontWeight: 500 }}>
              {insights.headline}
            </p>
          </>
        )}
        {error && !keyMissing && (
          <div className="mt-3">
            <p className="text-xs" style={{ ...font, color: '#FFE5E5' }}>{error}</p>
            {isKeyError && canManageKey && (
              <button
                data-testid="bi-ai-error-add-key"
                onClick={onOpenKeyModal}
                className="mt-2 px-3 py-1.5 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 active:scale-95"
                style={{ background: '#FFFFFF', color: '#1D1D1F', border: 0, ...font }}
              >
                <KeyRound size={11} /> Add API key
              </button>
            )}
            {isKeyError && !canManageKey && (
              <p className="mt-2 text-[11px]" style={{ ...font, opacity: 0.85 }}>
                Please ask a Super Admin to update the AI key.
              </p>
            )}
            {!isKeyError && (
              <button
                onClick={onRetryAfterKey}
                className="mt-2 px-3 py-1.5 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 active:scale-95"
                style={{ background: '#FFFFFF', color: '#1D1D1F', border: 0, ...font }}
              >
                <RefreshCcw size={11} /> Try again
              </button>
            )}
          </div>
        )}
      </div>

      {/* Body — strengths, risks, actions, anomalies. */}
      {insights && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          {insights.strengths?.length > 0 && (
            <div className="p-5 sm:p-6" style={{ borderRight: '1px solid rgba(0,0,0,0.04)' }}>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={14} color="#1F8C42" />
                <h3 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#86868B', ...font }}>What&apos;s working</h3>
              </div>
              <ul className="space-y-2">
                {insights.strengths.map((s, i) => (
                  <li key={i} data-testid={`bi-ai-strength-${i}`} className="text-sm leading-snug flex gap-2" style={{ color: '#1D1D1F', ...font }}>
                    <span style={{ color: '#1F8C42' }}>•</span> <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {insights.risks?.length > 0 && (
            <div className="p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-3">
                <AlertOctagon size={14} color="#C0392B" />
                <h3 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#86868B', ...font }}>Risks to address</h3>
              </div>
              <ul className="space-y-2">
                {insights.risks.map((r, i) => (
                  <li key={i} data-testid={`bi-ai-risk-${i}`} className="text-sm leading-snug flex gap-2" style={{ color: '#1D1D1F', ...font }}>
                    <span style={{ color: '#C0392B' }}>•</span> <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {insights.actions?.length > 0 && (
            <div className="col-span-1 lg:col-span-2 p-5 sm:p-6" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Zap size={14} color="#5856D6" />
                <h3 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#86868B', ...font }}>Recommended actions</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {insights.actions.map((a, i) => {
                  const meta = PRIORITY_META[a.priority] || PRIORITY_META.medium;
                  return (
                    <div key={i} data-testid={`bi-ai-action-${i}`} className="p-4 rounded-xl" style={{ background: '#F9F9FB' }}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider" style={{ background: meta.bg, color: meta.color, ...font }}>{meta.label}</span>
                      </div>
                      <p className="text-sm font-semibold mb-1" style={{ color: '#1D1D1F', ...font }}>{a.title}</p>
                      <p className="text-xs leading-snug mb-1.5" style={{ color: '#3A3A3C', ...font }}>{a.detail}</p>
                      {a.impact && (
                        <p className="text-[11px]" style={{ color: '#86868B', ...font }}><strong>Impact:</strong> {a.impact}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {insights.anomalies?.length > 0 && (
            <div className="col-span-1 lg:col-span-2 p-5 sm:p-6" style={{ borderTop: '1px solid rgba(0,0,0,0.04)', background: '#FAFAFA' }}>
              <div className="flex items-center gap-2 mb-3">
                <Activity size={14} color="#FF9500" />
                <h3 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#86868B', ...font }}>Anomalies & patterns</h3>
              </div>
              <ul className="space-y-1.5">
                {insights.anomalies.map((a, i) => (
                  <li key={i} data-testid={`bi-ai-anomaly-${i}`} className="text-xs leading-snug" style={{ color: '#3A3A3C', ...font }}>· {a}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="col-span-1 lg:col-span-2 px-5 sm:px-6 py-2.5" style={{ background: '#FAFAFA', borderTop: '1px solid rgba(0,0,0,0.04)' }}>
            <p className="text-[10px]" style={{ color: '#86868B', ...font }}>
              {cached ? 'Cached ' : 'Generated '}{generatedAt && new Date(generatedAt).toLocaleString('en-GB')}
              · AI analysis is advisory, not a substitute for management judgement
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

/** Super-admin modal for storing the AI API key in the DB.
 *  Accepts either the Emergent universal key (recommended) or a raw
 *  Anthropic Claude key. Key value is never displayed back — only last 4
 *  characters via the parent's keyInfo prop. */
const AIKeyModal = ({ open, keyInfo, onClose, onSaved }) => {
  const [apiKey, setApiKey] = useState('');
  // Anthropic is the only supported provider in the UI — the user
  // explicitly opted out of the Emergent universal key path.
  const provider = 'anthropic';
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [testStatus, setTestStatus] = useState(null); // {ok, message}
  const [testing, setTesting] = useState(false);

  // Reset the input every time the modal opens so the previous text doesn't
  // linger as a stale "value" the admin might accidentally save again.
  useEffect(() => {
    if (open) {
      setApiKey('');
      setError('');
      setTestStatus(null);
    }
  }, [open, keyInfo]);

  if (!open) return null;

  const save = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) { setError('Please paste the API key'); return; }
    setSaving(true); setError('');
    try {
      await api.adminSetAiKey({ api_key: trimmed, provider });
      onSaved();
    } catch (e) {
      setError(e?.message || 'Could not save key');
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    if (!window.confirm('Remove the stored key? AI insights will stop working until you add another in the server environment.')) return;
    setSaving(true); setError('');
    try {
      await api.adminClearAiKey();
      onSaved();
    } catch (e) {
      setError(e?.message || 'Could not clear key');
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) { setError('Paste the key first, then tap Test'); return; }
    setTesting(true); setError(''); setTestStatus(null);
    try {
      const res = await api.adminTestAiKey({ api_key: trimmed, provider });
      setTestStatus(res);
    } catch (e) {
      setTestStatus({ ok: false, message: e?.message || 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div
      data-testid="bi-ai-key-modal"
      role="dialog"
      aria-modal="true"
      style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }} />
      <div style={{
        position: 'relative', background: '#FFFFFF', width: '100%', maxWidth: 520,
        borderRadius: 18, padding: '22px 24px', boxShadow: '0 24px 48px rgba(0,0,0,0.28)',
        maxHeight: '90vh', overflowY: 'auto', ...font,
      }}>
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0">
            <p style={{ fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Settings</p>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1D1D1F', margin: '2px 0 0' }}>AI key</h2>
          </div>
          <button data-testid="bi-ai-key-modal-close" onClick={onClose} aria-label="Close"
            style={{ width: 32, height: 32, borderRadius: 999, background: '#F5F5F7', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={15} color="#1D1D1F" />
          </button>
        </div>

        <p style={{ fontSize: 13, color: '#3A3A3C', margin: '0 0 14px', lineHeight: 1.4 }}>
          Stored in the database. The key is used to call Claude
          Sonnet 4.5 for Business Intelligence insights — nothing else.
        </p>

        <div style={{ background: '#F9F9FB', borderRadius: 12, padding: '10px 12px', marginBottom: 14, fontSize: 12, color: '#3A3A3C' }}>
          {keyInfo?.has_key ? (
            <>
              <strong style={{ color: '#1D1D1F' }}>Current key</strong> · ends <code style={{ background: '#FFFFFF', padding: '1px 6px', borderRadius: 6 }}>…{keyInfo.last4}</code>
              {' '}({keyInfo.source === 'database' ? 'stored in app' : keyInfo.source === 'env' ? 'from server env' : keyInfo.source})
              {keyInfo.updated_by && <span style={{ color: '#86868B' }}> · saved by {keyInfo.updated_by}</span>}
            </>
          ) : (
            <span style={{ color: '#C0392B' }}>No key configured yet.</span>
          )}
        </div>

        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>API key</span>
          <input
            data-testid="bi-ai-key-input"
            type="password"
            autoComplete="new-password"
            value={apiKey}
            onChange={(e) => { setApiKey(e.target.value); if (error) setError(''); }}
            placeholder="sk-ant-…"
            style={{ display: 'block', marginTop: 4, width: '100%', padding: '12px 14px', borderRadius: 10, background: '#F5F5F7', border: error ? '1px solid #FF3B30' : 0, fontSize: 14, color: '#1D1D1F', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
          />
          <p style={{ margin: '6px 0 0', fontSize: 11, color: '#86868B' }}>
            Anthropic Claude keys start with <code>sk-ant-…</code>.
          </p>
        </label>

        {error && (
          <p data-testid="bi-ai-key-error" style={{ fontSize: 12, color: '#C0392B', margin: '0 0 12px' }}>{error}</p>
        )}

        {testStatus && (
          <div data-testid="bi-ai-key-test-status"
            style={{
              fontSize: 12, padding: '8px 12px', borderRadius: 10, margin: '0 0 12px',
              background: testStatus.ok ? 'rgba(52,199,89,0.12)' : 'rgba(255,59,48,0.10)',
              color: testStatus.ok ? '#1B7A35' : '#C0392B',
            }}>
            {testStatus.ok ? '✓ ' : '✕ '}{testStatus.message}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
          <button
            data-testid="bi-ai-key-test"
            onClick={test}
            disabled={testing || !apiKey.trim()}
            style={{
              padding: '12px 14px', borderRadius: 999, border: '1px solid rgba(0,0,0,0.1)',
              background: '#FFFFFF', color: '#1D1D1F', fontSize: 13, fontWeight: 600,
              cursor: (testing || !apiKey.trim()) ? 'not-allowed' : 'pointer',
              opacity: (testing || !apiKey.trim()) ? 0.5 : 1, ...font,
            }}
          >{testing ? 'Testing…' : 'Test key'}</button>
          <button
            data-testid="bi-ai-key-save"
            onClick={save}
            disabled={saving || !apiKey.trim()}
            style={{
              flex: 1, minWidth: 160, padding: '12px 14px', borderRadius: 999, border: 0,
              background: '#1D1D1F', color: '#FFFFFF', fontSize: 14, fontWeight: 700,
              cursor: (saving || !apiKey.trim()) ? 'not-allowed' : 'pointer',
              opacity: (saving || !apiKey.trim()) ? 0.5 : 1, ...font,
            }}
          >{saving ? 'Saving…' : 'Save key'}</button>
          {keyInfo?.has_key && keyInfo.source === 'database' && (
            <button
              data-testid="bi-ai-key-clear"
              onClick={clear}
              disabled={saving}
              style={{
                padding: '12px 14px', borderRadius: 999, border: '1px solid rgba(255,59,48,0.4)',
                background: '#FFFFFF', color: '#C0392B', fontSize: 13, fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer', ...font,
              }}
            >Remove</button>
          )}
        </div>

        <p style={{ marginTop: 14, fontSize: 11, color: '#86868B', lineHeight: 1.5 }}>
          Don&apos;t have a key? Visit{' '}
          <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer" style={{ color: '#007AFF', textDecoration: 'none' }}>console.anthropic.com</a>
          {' '}for a Claude key.
        </p>
      </div>
    </div>
  );
};


const AdminBI = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, isSuperAdmin, loading: authLoading } = useAuth();
  const { locations } = useLocation2();
  const routerLocation = useLocation();
  // When mounted under /jkhive/bi, we render in mobile-first mode with a
  // back link to the JKHive Manager hub. Outside of JKHive we keep the
  // existing desktop AdminLayout chrome with a back link to /admin.
  const isJkhive = routerLocation.pathname.startsWith('/jkhive');
  const [preset, setPreset] = useState('30');
  const [startDate, setStartDate] = useState(daysAgoISO(29));
  const [endDate, setEndDate] = useState(todayISO());
  const [locationId, setLocationId] = useState('');
  const [data, setData] = useState(null);
  const [menuCost, setMenuCost] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [expandedLoc, setExpandedLoc] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  // AI insights — lazy-loaded so the page is fast and credits aren't burned
  // on every visit. Loads automatically once the BI data first arrives, then
  // refresh / re-runs whenever the filters change.
  const [aiInsights, setAiInsights] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiCached, setAiCached] = useState(false);
  const [aiGeneratedAt, setAiGeneratedAt] = useState('');
  // AI key management — surfaced as a modal triggered from the panel header
  // or from the friendly "no key configured" empty state.
  const [aiKeyInfo, setAiKeyInfo] = useState(null); // {has_key, source, last4, provider, ...}
  const [showAiKeyModal, setShowAiKeyModal] = useState(false);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      navigate(isAuthenticated ? '/admin' : '/admin-login');
    }
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  const applyPreset = (id) => {
    setPreset(id);
    const p = PRESETS.find(x => x.id === id);
    if (!p) return;
    if (p.mtd) {
      const d = new Date(); d.setDate(1);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(todayISO());
    } else {
      setStartDate(daysAgoISO(p.days - 1));
      setEndDate(todayISO());
    }
  };

  const fetch = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const [bi, mc] = await Promise.all([
        api.adminBIOverview({ start_date: startDate, end_date: endDate, location_id: locationId || undefined }),
        api.adminBIMenuCost(locationId ? { location_id: locationId } : {}),
      ]);
      setData(bi);
      setMenuCost(mc?.items || []);
    } catch (e) {
      setErr(e?.message || 'Failed to load BI data');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, locationId]);

  useEffect(() => { if (isAdmin) fetch(); }, [fetch, isAdmin]);

  const fetchAi = useCallback(async (force = false) => {
    setAiLoading(true); setAiError('');
    try {
      const res = await api.adminBIAIInsights({
        start_date: startDate, end_date: endDate,
        location_id: locationId || undefined,
        refresh: force,
      });
      setAiInsights(res.insights);
      setAiCached(!!res.cached);
      setAiGeneratedAt(res.generated_at || '');
    } catch (e) {
      setAiError(e?.message || 'Failed to generate insights');
    } finally {
      setAiLoading(false);
    }
  }, [startDate, endDate, locationId]);

  // Auto-load AI insights once BI data has arrived. Re-runs when filters
  // change because `fetchAi` is memoised on those same dependencies.
  useEffect(() => {
    if (isAdmin && data && !loading) fetchAi(false);
  }, [isAdmin, data, loading, fetchAi]);

  // Load AI key status so the panel can surface "key missing" / last-4.
  useEffect(() => {
    if (!isAdmin) return;
    api.adminGetAiSettings()
      .then(setAiKeyInfo)
      .catch(() => setAiKeyInfo({ has_key: false }));
  }, [isAdmin, showAiKeyModal]);

  if (authLoading || !isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
      </div>
    );
  }

  const kpi = data?.kpi || {};
  const byLoc = data?.by_location || [];
  const lband = labourBand(kpi.labour_pct || 0);
  const fband = foodBand(kpi.food_cost_pct || 0);

  return (
    <div
      className={isJkhive
        ? 'pb-24 max-w-[1400px] mx-auto'
        : 'p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto'}
      data-testid="admin-bi-page"
      style={isJkhive ? {} : { background: '#F5F5F7', minHeight: '100vh' }}
    >
      <Link
        to={isJkhive ? '/jkhive/manager' : '/admin'}
        data-testid="bi-back-link"
        className="inline-flex items-center gap-1.5 -ml-1 px-1 py-1 mb-2 rounded-lg active:scale-95"
        style={{ color: '#007AFF', ...font }}
      >
        <ArrowLeft size={isJkhive ? 20 : 13} strokeWidth={2.4} />
        <span className={isJkhive ? 'text-base font-semibold' : 'text-xs font-medium'}>
          {isJkhive ? 'Manager' : 'Dashboard'}
        </span>
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 sm:mb-6">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#1D1D1F' }}>
            <TrendingUp size={isJkhive ? 18 : 20} color="white" strokeWidth={1.6} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: '#1D1D1F', ...font }}>Business Intelligence</h1>
            <p className="text-[11px] sm:text-sm truncate" style={{ color: '#86868B', ...font }}>
              {isJkhive ? 'AI-powered analytics' : 'Labour %, Food Cost %, Margin'}
            </p>
          </div>
        </div>
        <button
          data-testid="bi-refresh-btn"
          onClick={fetch}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold active:scale-95 disabled:opacity-50"
          style={{ background: '#FFFFFF', color: '#1D1D1F', boxShadow: '0 0 0 1px rgba(0,0,0,0.08)', ...font }}
        >
          <RefreshCcw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl p-4 mb-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map(p => (
            <button
              key={p.id}
              data-testid={`bi-preset-${p.id}`}
              onClick={() => applyPreset(p.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold active:scale-95 transition-colors`}
              style={preset === p.id
                ? { background: '#1D1D1F', color: '#FFFFFF', ...font }
                : { background: '#F5F5F7', color: '#1D1D1F', ...font }}
            >
              {p.label}
            </button>
          ))}
          <div className="h-5 w-px mx-2" style={{ background: 'rgba(0,0,0,0.08)' }} />
          <div className="flex items-center gap-1.5">
            <label className="text-[11px]" style={{ color: '#86868B', ...font }}>From</label>
            <input
              data-testid="bi-start-date"
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPreset(''); }}
              className="px-2 py-1.5 rounded-lg text-xs"
              style={{ background: '#F5F5F7', color: '#1D1D1F', ...font, border: 'none' }}
            />
            <label className="text-[11px] ml-1" style={{ color: '#86868B', ...font }}>To</label>
            <input
              data-testid="bi-end-date"
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPreset(''); }}
              className="px-2 py-1.5 rounded-lg text-xs"
              style={{ background: '#F5F5F7', color: '#1D1D1F', ...font, border: 'none' }}
            />
          </div>
          <div className="h-5 w-px mx-2" style={{ background: 'rgba(0,0,0,0.08)' }} />
          <select
            data-testid="bi-location-filter"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs"
            style={{ background: '#F5F5F7', color: '#1D1D1F', ...font, border: 'none' }}
          >
            <option value="">All locations</option>
            {locations?.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      </div>

      {err && (
        <div className="rounded-2xl p-4 mb-5 flex items-start gap-2" style={{ background: 'rgba(255,59,48,0.08)' }}>
          <AlertTriangle size={16} color="#C0392B" />
          <p className="text-xs" style={{ color: '#C0392B', ...font }}>{err}</p>
        </div>
      )}

      {/* AI Insights — Claude Sonnet 4.5 analysis */}
      <AIInsightsPanel
        insights={aiInsights}
        loading={aiLoading}
        cached={aiCached}
        generatedAt={aiGeneratedAt}
        error={aiError}
        keyInfo={aiKeyInfo}
        onRefresh={() => fetchAi(true)}
        onOpenKeyModal={() => setShowAiKeyModal(true)}
        canManageKey={isSuperAdmin}
        onRetryAfterKey={() => { setAiError(''); fetchAi(true); }}
      />

      <AIKeyModal
        open={showAiKeyModal && isSuperAdmin}
        keyInfo={aiKeyInfo}
        onClose={() => setShowAiKeyModal(false)}
        onSaved={() => { setShowAiKeyModal(false); setAiError(''); fetchAi(true); }}
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard
          testid="kpi-revenue"
          icon={DollarSign}
          label="Revenue"
          value={fmtGBP(kpi.total_revenue)}
          sub={`${kpi.entries || 0} sales entries · ${data?.period?.days || 0}d`}
          color="#34C759"
        />
        <KpiCard
          testid="kpi-labour"
          icon={Users}
          label="Labour"
          value={fmtGBP(kpi.total_labour)}
          sub={`${(kpi.total_hours || 0).toFixed(1)} hrs total`}
          color="#007AFF"
          accent={{ ...lband, label: `${kpi.labour_pct || 0}% · ${lband.label}` }}
        />
        <KpiCard
          testid="kpi-food-cost"
          icon={ChefHat}
          label="Est. Food Cost"
          value={fmtGBP(kpi.est_food_cost)}
          sub={`Based on linked recipes`}
          color="#FF9500"
          accent={{ ...fband, label: `${kpi.food_cost_pct || 0}% · ${fband.label}` }}
        />
        <KpiCard
          testid="kpi-margin"
          icon={Activity}
          label="Gross Margin"
          value={fmtGBP(kpi.gross_margin)}
          sub={`${kpi.gross_margin_pct || 0}% of revenue`}
          color="#AF52DE"
        />
      </div>

      {/* Per-location table */}
      <div className="rounded-2xl mb-5 overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: '#1D1D1F', ...font }}>By location</h2>
            <p className="text-[11px]" style={{ color: '#86868B', ...font }}>Sorted by revenue. Click a row for staff breakdown.</p>
          </div>
        </div>
        {loading ? (
          <div className="p-10 text-center">
            <div className="inline-block w-5 h-5 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
          </div>
        ) : byLoc.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm mb-1" style={{ color: '#1D1D1F', ...font }}>No sales entries in this period.</p>
            <p className="text-xs" style={{ color: '#86868B', ...font }}>Try widening the date range or selecting a different location.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: 900 }}>
              <thead style={{ background: '#F5F5F7' }}>
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Location</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Revenue</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Hours</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Labour £</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Labour %</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Food %</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Margin</th>
                </tr>
              </thead>
              <tbody>
                {byLoc.map(loc => {
                  const lb = labourBand(loc.labour_pct);
                  const fb = foodBand(loc.food_cost_pct);
                  const isExpanded = expandedLoc === loc.location_id;
                  return (
                    <React.Fragment key={loc.location_id}>
                      <tr
                        data-testid={`bi-loc-row-${loc.location_id}`}
                        onClick={() => setExpandedLoc(isExpanded ? null : loc.location_id)}
                        style={{ borderTop: '1px solid rgba(0,0,0,0.04)', cursor: 'pointer' }}
                        className="hover:bg-gray-50"
                      >
                        <td className="px-4 py-3 text-sm font-medium" style={{ color: '#1D1D1F', ...font }}>
                          <div className="flex items-center gap-1.5">
                            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            <span>{loc.location_name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: '#F5F5F7', color: '#86868B' }}>{loc.days}d</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-mono" style={{ color: '#1D1D1F', ...font }}>{fmtGBP(loc.revenue)}</td>
                        <td className="px-4 py-3 text-sm text-right font-mono" style={{ color: '#1D1D1F', ...font }}>{loc.hours.toFixed(1)}</td>
                        <td className="px-4 py-3 text-sm text-right font-mono" style={{ color: '#1D1D1F', ...font }}>{fmtGBP(loc.labour)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: lb.bg, color: lb.color, ...font }}>
                            {loc.labour_pct}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: fb.bg, color: fb.color, ...font }}>
                            {loc.food_cost_pct}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-mono font-semibold" style={{ color: loc.gross_margin >= 0 ? '#1F8C42' : '#C0392B', ...font }}>
                          {fmtGBP(loc.gross_margin)}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr style={{ background: '#FAFAFA' }}>
                          <td colSpan={7} className="px-4 py-3">
                            <div className="text-[11px] font-semibold mb-2" style={{ color: '#86868B', ...font }}>
                              Staff breakdown · {loc.staff_breakdown.length} people · Coverage {loc.menu_coverage.items_with_recipe}/{loc.menu_coverage.total_items} menu items have recipes
                            </div>
                            {loc.staff_breakdown.length === 0 ? (
                              <p className="text-xs italic" style={{ color: '#86868B' }}>No staff hours recorded.</p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {loc.staff_breakdown.map(sb => (
                                  <div key={sb.name} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: '#FFFFFF' }}>
                                    <div>
                                      <div className="text-xs font-medium" style={{ color: '#1D1D1F', ...font }}>{sb.name}</div>
                                      <div className="text-[10px]" style={{ color: '#86868B', ...font }}>
                                        {sb.hours.toFixed(1)}h{sb.rate > 0 ? ` · £${sb.rate.toFixed(2)}/h` : ' · no rate set'}
                                      </div>
                                    </div>
                                    <div className="text-xs font-mono font-semibold" style={{ color: sb.cost > 0 ? '#1D1D1F' : '#FF9500', ...font }}>
                                      {sb.cost > 0 ? fmtGBP(sb.cost) : '—'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Menu cost breakdown */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <button
          data-testid="bi-menu-toggle"
          onClick={() => setShowMenu(s => !s)}
          className="w-full px-5 py-4 flex items-center justify-between active:bg-gray-50"
          style={{ borderBottom: showMenu ? '1px solid rgba(0,0,0,0.06)' : 'none' }}
        >
          <div className="text-left">
            <h2 className="text-sm font-semibold" style={{ color: '#1D1D1F', ...font }}>Menu cost breakdown</h2>
            <p className="text-[11px]" style={{ color: '#86868B', ...font }}>{menuCost.filter(x => x.has_recipe).length} of {menuCost.length} items have a recipe</p>
          </div>
          {showMenu ? <ChevronDown size={14} style={{ color: '#86868B' }} /> : <ChevronRight size={14} style={{ color: '#86868B' }} />}
        </button>
        {showMenu && (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: 760 }}>
              <thead style={{ background: '#F5F5F7' }}>
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Item</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Category</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Price</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Recipe £</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Food %</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Margin</th>
                </tr>
              </thead>
              <tbody>
                {menuCost.slice(0, 50).map(m => {
                  const fb = m.has_recipe ? foodBand(m.food_cost_pct) : { bg: '#F5F5F7', color: '#8E8E93', label: 'no recipe' };
                  return (
                    <tr key={m.id} data-testid={`bi-menu-row-${m.id}`} style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                      <td className="px-4 py-2.5 text-sm font-medium" style={{ color: '#1D1D1F', ...font }}>{m.name}</td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: '#86868B', ...font }}>{m.category}</td>
                      <td className="px-4 py-2.5 text-sm text-right font-mono" style={{ color: '#1D1D1F', ...font }}>{fmtGBP(m.price)}</td>
                      <td className="px-4 py-2.5 text-sm text-right font-mono" style={{ color: m.has_recipe ? '#1D1D1F' : '#C7C7CC', ...font }}>
                        {m.has_recipe ? fmtGBP(m.recipe_cost) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: fb.bg, color: fb.color, ...font }}>
                          {m.has_recipe ? `${m.food_cost_pct}%` : 'no recipe'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-right font-mono font-semibold" style={{ color: m.has_recipe ? (m.margin >= 0 ? '#1F8C42' : '#C0392B') : '#C7C7CC', ...font }}>
                        {m.has_recipe ? fmtGBP(m.margin) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {menuCost.length > 50 && (
              <p className="px-4 py-3 text-[11px] text-center" style={{ color: '#86868B', ...font }}>
                Showing top 50 of {menuCost.length} items. Use the location filter to narrow down.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Hint banner */}
      <div className="mt-5 p-4 rounded-2xl flex items-start gap-2" style={{ background: 'rgba(0,122,255,0.06)' }}>
        <Activity size={14} color="#007AFF" className="mt-0.5" />
        <div className="text-[11px]" style={{ color: '#1D1D1F', ...font }}>
          <strong>How this is calculated</strong> · Revenue from Daily Sales totals · Labour from staff hours × per-staff hourly rate (set in <Link to="/admin/staff" className="underline" style={{ color: '#007AFF' }}>Staff Table</Link>) · Food Cost from recipe ingredients on each menu item (set in <Link to="/admin-menu" className="underline" style={{ color: '#007AFF' }}>Menu Management</Link>). Items without a recipe contribute £0 to estimated food cost.
        </div>
      </div>
    </div>
  );
};

export default AdminBI;
