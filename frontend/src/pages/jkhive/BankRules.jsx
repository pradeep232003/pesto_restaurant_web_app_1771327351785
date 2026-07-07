import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ListChecks, Plus, Trash2, Loader2, AlertTriangle,
  CheckCircle2, Sparkles, Code2, Search, RefreshCw, Lock,
} from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

const FONT = { fontFamily: 'Outfit, sans-serif' };

const BankRules = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAuth();
  const [data, setData] = useState({ custom: [], builtin: [], expense_categories: [], income_categories: [] });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [search, setSearch] = useState('');

  // Add-rule form state
  const [form, setForm] = useState({
    label: '', pattern: '', type: 'expense', category: 'supplier', mode: 'simple',
  });

  useEffect(() => {
    if (!authLoading && !isAdmin) navigate('/jkhive');
  }, [authLoading, isAdmin, navigate]);

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const res = await api.bankRulesList();
      setData(res);
    } catch (e) {
      setErr(e.message || 'Failed to load rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const catsForType = useMemo(
    () => (form.type === 'income' ? data.income_categories : data.expense_categories),
    [form.type, data.income_categories, data.expense_categories],
  );

  // Ensure category is valid whenever type flips.
  useEffect(() => {
    if (catsForType.length && !catsForType.includes(form.category)) {
      setForm((f) => ({ ...f, category: catsForType[0] }));
    }
  }, [catsForType]); // eslint-disable-line

  const submit = async (e) => {
    e.preventDefault();
    if (!form.label.trim() || !form.pattern.trim()) {
      setErr('Label and pattern are required');
      return;
    }
    setBusy(true); setErr(''); setOk('');
    try {
      await api.bankRuleCreate(form);
      setOk(`Rule "${form.label}" added. Click Re-classify on any statement to apply.`);
      setForm({ label: '', pattern: '', type: form.type, category: form.category, mode: form.mode });
      await load();
    } catch (ex) {
      setErr(ex.message || 'Failed to add rule');
    } finally {
      setBusy(false);
    }
  };

  const removeRule = async (r) => {
    if (!window.confirm(`Delete rule "${r.label}"?`)) return;
    setBusy(true); setErr(''); setOk('');
    try {
      await api.bankRuleDelete(r.id);
      setOk(`Rule "${r.label}" deleted.`);
      await load();
    } catch (e) {
      setErr(e.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const filteredCustom = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.custom || [];
    return (data.custom || []).filter(r =>
      [r.label, r.pattern, r.category, r.type, r.created_by_name].some(v => (v || '').toLowerCase().includes(q)),
    );
  }, [data.custom, search]);

  const filteredBuiltin = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.builtin || [];
    return (data.builtin || []).filter(r =>
      [r.label, r.pattern, r.category, r.type].some(v => (v || '').toLowerCase().includes(q)),
    );
  }, [data.builtin, search]);

  return (
    <div data-testid="bank-rules-page" style={{ paddingBottom: 32, ...FONT }}>
      <button
        data-testid="br-back"
        onClick={() => navigate('/jkhive/manager')}
        style={{ background: 'none', border: 0, color: '#007AFF', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginBottom: 12, ...FONT }}
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ListChecks size={22} color="#5856D6" />
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1D1D1F', margin: 0, letterSpacing: '-0.02em' }}>
            Bank Rules Configuration
          </h1>
        </div>
        <p style={{ fontSize: 13, color: '#86868B', margin: '6px 0 0' }}>
          Add merchant patterns so future bank statements auto-categorise them.
          After adding a rule, open a statement and click <strong style={{ color: '#5856D6' }}>Re-classify</strong> to apply it retroactively.
        </p>
      </div>

      {/* Add rule form */}
      <form
        data-testid="br-add-form"
        onSubmit={submit}
        style={{
          background: 'linear-gradient(135deg, rgba(88,86,214,0.08), rgba(0,122,255,0.06))',
          borderRadius: 18, padding: 18, marginBottom: 18,
          border: '1px solid rgba(88,86,214,0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <Plus size={14} color="#5856D6" />
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#5856D6', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Add a new rule
          </h2>
          <div style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4, background: '#FFFFFF', padding: 3, borderRadius: 999 }}>
            {[
              { key: 'simple', label: 'Simple keyword', icon: Sparkles },
              { key: 'regex', label: 'Advanced regex', icon: Code2 },
            ].map(m => {
              const Icon = m.icon;
              const on = form.mode === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  data-testid={`br-mode-${m.key}`}
                  onClick={() => setForm(f => ({ ...f, mode: m.key }))}
                  style={{
                    padding: '5px 12px', borderRadius: 999, border: 0,
                    background: on ? '#1D1D1F' : 'transparent',
                    color: on ? '#FFFFFF' : '#1D1D1F',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 4, ...FONT,
                  }}
                >
                  <Icon size={11} /> {m.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          <label style={{ display: 'block' }}>
            <span style={LBL}>Label (shown in downloads)</span>
            <input
              data-testid="br-form-label"
              value={form.label}
              onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="e.g. Amazon Marketplace"
              maxLength={80}
              style={INPUT}
            />
          </label>
          <label style={{ display: 'block' }}>
            <span style={LBL}>
              {form.mode === 'simple' ? 'Keyword (matches whole words, any case)' : 'Regex pattern (case-insensitive)'}
            </span>
            <input
              data-testid="br-form-pattern"
              value={form.pattern}
              onChange={(e) => setForm(f => ({ ...f, pattern: e.target.value }))}
              placeholder={form.mode === 'simple' ? 'AMZN MKTP' : '\\b(AMZN|AMAZON)\\s*MKTP\\b'}
              maxLength={400}
              style={{ ...INPUT, fontFamily: form.mode === 'regex' ? 'ui-monospace, Menlo, monospace' : 'inherit' }}
            />
          </label>
          <label style={{ display: 'block' }}>
            <span style={LBL}>Type</span>
            <select
              data-testid="br-form-type"
              value={form.type}
              onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))}
              style={INPUT}
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </label>
          <label style={{ display: 'block' }}>
            <span style={LBL}>Category</span>
            <select
              data-testid="br-form-category"
              value={form.category}
              onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
              style={INPUT}
            >
              {catsForType.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="submit"
            data-testid="br-form-submit"
            disabled={busy || !form.label.trim() || !form.pattern.trim()}
            style={{
              padding: '10px 22px', borderRadius: 999, border: 0,
              background: busy || !form.label.trim() || !form.pattern.trim() ? '#C7C7CC' : '#1D1D1F',
              color: '#FFFFFF', fontSize: 13, fontWeight: 700,
              cursor: busy || !form.label.trim() || !form.pattern.trim() ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6, ...FONT,
            }}
          >
            {busy ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : <><Plus size={13} /> Add rule</>}
          </button>
          <span style={{ fontSize: 11, color: '#86868B' }}>
            After saving, open your statements and click Re-classify to apply.
          </span>
        </div>
      </form>

      {err && (
        <div data-testid="br-error" style={{ background: 'rgba(255,59,48,0.10)', color: '#C0392B', padding: 10, borderRadius: 10, fontSize: 13, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={14} /> {err}
        </div>
      )}
      {ok && (
        <div data-testid="br-ok" style={{ background: 'rgba(52,199,89,0.12)', color: '#1D5A2F', padding: 10, borderRadius: 10, fontSize: 13, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle2 size={14} /> {ok}
        </div>
      )}

      {/* Search + refresh */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', background: '#FFFFFF', borderRadius: 12, padding: '4px 12px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <Search size={14} color="#86868B" />
        <input
          data-testid="br-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search rules by label, pattern, category…"
          style={{ flex: 1, border: 0, background: 'transparent', padding: '10px 0', fontSize: 13, color: '#1D1D1F', outline: 'none', ...FONT }}
        />
        <button
          data-testid="br-refresh"
          onClick={load}
          disabled={loading}
          style={{ background: 'none', border: 0, color: '#007AFF', cursor: loading ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Refresh
        </button>
      </div>

      {/* Custom rules */}
      <SectionHeader
        title="Your custom rules"
        count={filteredCustom.length}
        subtitle="Editable · take priority over built-ins"
      />
      {filteredCustom.length === 0 && !loading && (
        <div data-testid="br-empty-custom" style={{ background: '#FFFFFF', borderRadius: 12, padding: 20, textAlign: 'center', color: '#86868B', fontSize: 12, marginBottom: 16 }}>
          No custom rules yet. Add one above to auto-categorise merchants that currently fall
          into <strong>no match → other</strong>.
        </div>
      )}
      {filteredCustom.length > 0 && (
        <div data-testid="br-list-custom" style={{ background: '#FFFFFF', borderRadius: 12, marginBottom: 16, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <RulesTable rows={filteredCustom} onDelete={removeRule} busy={busy} />
        </div>
      )}

      {/* Built-in rules */}
      <SectionHeader
        title="Built-in rules"
        count={filteredBuiltin.length}
        subtitle="Read-only · shipped with the app"
        icon={Lock}
      />
      {filteredBuiltin.length > 0 && (
        <div data-testid="br-list-builtin" style={{ background: '#FFFFFF', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <RulesTable rows={filteredBuiltin} readOnly />
        </div>
      )}
    </div>
  );
};

const SectionHeader = ({ title, count, subtitle, icon }) => {
  const Icon = icon;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 8px' }}>
      {Icon && <Icon size={13} color="#86868B" />}
      <h2 style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {title} · <span style={{ color: '#5856D6' }}>{count}</span>
      </h2>
      {subtitle && <span style={{ fontSize: 11, color: '#86868B' }}>· {subtitle}</span>}
    </div>
  );
};

const RulesTable = ({ rows, onDelete, readOnly, busy }) => (
  <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr style={{ background: '#F5F5F7' }}>
          <th style={TH}>Label</th>
          <th style={TH}>Pattern</th>
          <th style={{ ...TH, textAlign: 'center' }}>Type</th>
          <th style={TH}>Category</th>
          {!readOnly && <th style={TH}>Added by</th>}
          {!readOnly && <th style={{ ...TH, textAlign: 'center' }}> </th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, idx) => (
          <tr key={r.id || `builtin-${idx}`} data-testid={`br-row-${r.id || idx}`} style={{ borderTop: '1px solid #ECECEF' }}>
            <td style={{ ...TD, fontWeight: 600 }}>
              {r.label}
              {r.compile_error && (
                <span title={r.compile_error} style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 999, background: 'rgba(255,59,48,0.14)', color: '#8A2822', fontSize: 9, fontWeight: 700 }}>
                  BAD REGEX
                </span>
              )}
            </td>
            <td style={{ ...TD, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, color: '#3A3A3C', maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.pattern}>
              {r.pattern}
              {r.mode && r.mode !== 'simple' && (
                <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 999, background: 'rgba(0,122,255,0.12)', color: '#0552B5', fontSize: 9, fontWeight: 700 }}>
                  REGEX
                </span>
              )}
            </td>
            <td style={{ ...TD, textAlign: 'center' }}>
              <span style={{
                padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase',
                background: r.type === 'income' ? 'rgba(52,199,89,0.12)' : 'rgba(255,59,48,0.12)',
                color: r.type === 'income' ? '#1D5A2F' : '#8A2822',
              }}>
                {r.type}
              </span>
            </td>
            <td style={{ ...TD, color: '#1D1D1F' }}>{r.category}</td>
            {!readOnly && <td style={{ ...TD, color: '#86868B', fontSize: 11 }}>{r.created_by_name || '—'}</td>}
            {!readOnly && (
              <td style={{ ...TD, textAlign: 'center' }}>
                <button
                  data-testid={`br-delete-${r.id}`}
                  onClick={() => onDelete(r)}
                  disabled={busy}
                  aria-label="Delete rule"
                  style={{ width: 30, height: 30, borderRadius: 999, background: 'rgba(255,59,48,0.10)', color: '#C0392B', border: 0, cursor: busy ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Trash2 size={13} />
                </button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const LBL = { display: 'block', fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 };
const INPUT = { width: '100%', padding: '9px 12px', borderRadius: 10, background: '#FFFFFF', border: '1px solid #E5E5EA', fontSize: 13, color: '#1D1D1F', outline: 'none', ...FONT };
const TH = { textAlign: 'left', padding: '10px 12px', fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' };
const TD = { padding: '10px 12px', color: '#1D1D1F', verticalAlign: 'middle' };

export default BankRules;
