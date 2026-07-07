import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Upload, FileSpreadsheet, Download, Trash2, Loader2,
  TrendingUp, TrendingDown, Wallet, CheckCircle2, AlertTriangle, FileText, Sparkles,
  ListFilter, Search, MapPin, Layers, Check, RefreshCw,
} from 'lucide-react';
import api, { API_BASE_URL } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';

const FONT = { fontFamily: 'Outfit, sans-serif' };

const fmtGBP = (n) => `£${Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
};

/** Trigger a browser download of an already-created blob URL. */
const downloadBlobUrl = (url, filename) => {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};

const BankStatements = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAuth();
  const { adminLocationId, locations } = useLocation2();
  const inputRef = useRef(null);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [lastResult, setLastResult] = useState(null);
  const [tab, setTab] = useState('upload'); // 'upload' | 'details'

  useEffect(() => {
    if (!authLoading && !isAdmin) navigate('/jkhive');
  }, [authLoading, isAdmin, navigate]);

  const load = async () => {
    if (!adminLocationId) return;
    setLoading(true); setErr('');
    try {
      const res = await api.bankStatementsList({ location_id: adminLocationId });
      setItems(res.items || []);
    } catch (e) {
      setErr(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [adminLocationId]);

  const locName = useMemo(
    () => locations.find(l => l.id === adminLocationId)?.name || 'All sites',
    [locations, adminLocationId],
  );

  const onPickFile = () => {
    if (!adminLocationId) { setErr('Pick a location first'); return; }
    inputRef.current?.click();
  };

  const [debug, setDebug] = useState([]); // { t, msg } — visible diagnostic trail

  const pushDebug = (msg) => {
    const stamp = new Date().toLocaleTimeString('en-GB', { hour12: false });
    // Also log to browser console so users can screenshot for us.
     
    console.log('[BankStatement]', stamp, msg);
    setDebug((prev) => [...prev, { t: stamp, msg: String(msg).slice(0, 400) }]);
  };

  const onFileChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!adminLocationId) { setErr('Pick a location first'); return; }

    setBusy(true); setErr(''); setLastResult(null); setDebug([]);
    const t0 = performance.now();
    pushDebug(`Picked file "${file.name}" · ${(file.size / 1024).toFixed(1)} KB · type=${file.type || 'unknown'}`);
    pushDebug(`Uploading to ${adminLocationId} …`);

    // Direct fetch so we can inspect status, headers and raw body on failure.
    // 5-minute explicit timeout — well beyond backend's 120 s per-chunk
    // limit but generous enough to survive slow mobile links.
    const controller = new AbortController();
    const timeoutMs = 5 * 60 * 1000;
    const timeoutId = setTimeout(() => {
      pushDebug(`ABORTED — client timeout after ${timeoutMs / 1000}s`);
      controller.abort();
    }, timeoutMs);

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('location_id', adminLocationId);

      const tok = localStorage.getItem('access_token');
      const url = `${API_BASE_URL}/api/admin/bank-statements/upload`;
      pushDebug(`POST ${url || '(relative)'}`);

      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: tok ? { Authorization: `Bearer ${tok}` } : {},
          body: fd,
          signal: controller.signal,
        });
      } catch (netErr) {
        // Network-level failure: DNS, TLS, connection reset, abort.
        const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
        const name = netErr?.name || 'NetworkError';
        const reason = netErr?.message || String(netErr);
        pushDebug(`NETWORK ERROR after ${elapsed}s · ${name} · ${reason}`);
        if (name === 'AbortError') {
          throw new Error(`Client timeout after ${elapsed}s — the request was aborted before the server responded. Likely the upload is stuck at a proxy (Cloudflare) or offline.`);
        }
        throw new Error(`Network error (${name}): ${reason}. Elapsed ${elapsed}s.`);
      }

      const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
      pushDebug(`Response after ${elapsed}s · HTTP ${response.status} ${response.statusText || ''}`);

      // Try to read the body as text first so a non-JSON error page (e.g.
      // Cloudflare's HTML error page) still shows something useful.
      const rawBody = await response.text();
      pushDebug(`Body size: ${rawBody.length} bytes${rawBody.length ? ` · first bytes: ${rawBody.slice(0, 160).replace(/\s+/g, ' ')}` : ' (empty)'}`);

      if (!response.ok) {
        let detail = rawBody;
        try {
          const j = JSON.parse(rawBody);
          detail = j.detail || j.message || JSON.stringify(j).slice(0, 300);
        } catch {
          // Not JSON — probably Cloudflare / Nginx HTML error page.
          if (/cloudflare/i.test(rawBody) || /<html/i.test(rawBody)) {
            detail = `Proxy returned an HTML error page (likely an ingress timeout or 502). Raw: ${rawBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)}`;
          } else {
            detail = rawBody.slice(0, 300);
          }
        }
        throw new Error(`HTTP ${response.status}: ${detail}`);
      }

      let rec;
      try {
        rec = JSON.parse(rawBody);
      } catch (parseErr) {
        throw new Error(`Response wasn't JSON: ${parseErr.message}. First 200 chars: ${rawBody.slice(0, 200)}`);
      }
      pushDebug(`Parsed OK · ${rec.income_count} income, ${rec.expense_count} expenses · net £${rec.net}`);
      setLastResult(rec);

      // Auto-download the XLSX.
      pushDebug('Requesting XLSX download …');
      try {
        const downloadUrl = await api.bankStatementXlsxUrl(rec.id);
        const stem = (file.name || 'statement').replace(/\.[^.]+$/, '');
        downloadBlobUrl(downloadUrl, `${stem}_split.xlsx`);
        pushDebug('XLSX downloaded');
      } catch (downloadErr) {
        pushDebug(`XLSX download failed: ${downloadErr.message}`);
        setErr(`Saved, but download failed: ${downloadErr.message}`);
      }
      await load();
    } catch (ex) {
      pushDebug(`FAIL · ${ex.message}`);
      setErr(ex.message || 'Upload failed');
    } finally {
      clearTimeout(timeoutId);
      setBusy(false);
    }
  };

  const downloadOne = async (rec) => {
    setBusy(true); setErr('');
    try {
      const url = await api.bankStatementXlsxUrl(rec.id);
      const stem = (rec.filename || 'statement').replace(/\.[^.]+$/, '');
      downloadBlobUrl(url, `${stem}_split.xlsx`);
    } catch (e) {
      setErr(e.message || 'Download failed');
    } finally {
      setBusy(false);
    }
  };

  const deleteOne = async (rec) => {
    if (!window.confirm(`Delete "${rec.filename}"? This can't be undone.`)) return;
    setBusy(true); setErr('');
    try {
      await api.bankStatementDelete(rec.id);
      setLastResult(null);
      await load();
    } catch (e) {
      setErr(e.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  // Track which row is currently mid-reclassify so we can show a spinner
  // on just that button instead of a global busy-lock (reclassify can
  // take 30-60s for large PDFs).
  const [reclassifyingId, setReclassifyingId] = useState(null);

  const reclassifyOne = async (rec) => {
    const ok = window.confirm(
      `Re-classify "${rec.filename}"? The AI will re-read the stored file, apply the latest supplier list and update all transactions.\n\nThis can take 30-60 seconds.`,
    );
    if (!ok) return;
    setReclassifyingId(rec.id);
    setErr('');
    try {
      const updated = await api.bankStatementReclassify(rec.id);
      setLastResult(updated);
      await load();
    } catch (e) {
      setErr(e.message || 'Re-classify failed');
    } finally {
      setReclassifyingId(null);
    }
  };

  return (
    <div data-testid="bank-statements-page" style={{ paddingBottom: 24, ...FONT }}>
      <button
        data-testid="bs-back"
        onClick={() => navigate('/jkhive/manager')}
        style={{ background: 'none', border: 0, color: '#007AFF', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginBottom: 12, ...FONT }}
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileSpreadsheet size={22} color="#5856D6" />
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1D1D1F', margin: 0, letterSpacing: '-0.02em' }}>
            Bank Statement Splitter
          </h1>
        </div>
        <p style={{ fontSize: 13, color: '#86868B', margin: '6px 0 0' }}>
          {tab === 'upload'
            ? <>Upload a bank statement — AI splits it into Income & Expenses and gives you a 3-tab XLSX. Site: <strong style={{ color: '#1D1D1F' }}>{locName}</strong></>
            : <>Drill into uploaded statements across one, many or all sites. Download a combined XLSX in the same 3-tab format.</>
          }
        </p>
      </div>

      {/* Tab switcher — Upload workflow vs Details drill-down. */}
      <div
        role="tablist"
        data-testid="bs-tabs"
        style={{
          display: 'inline-flex', gap: 4, padding: 4, borderRadius: 999,
          background: '#F5F5F7', marginBottom: 16,
        }}
      >
        {[
          { key: 'upload', label: 'Upload', icon: Upload },
          { key: 'details', label: 'Details', icon: Layers },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              data-testid={`bs-tab-${t.key}`}
              onClick={() => setTab(t.key)}
              style={{
                padding: '8px 16px', borderRadius: 999, border: 0,
                background: active ? '#1D1D1F' : 'transparent',
                color: active ? '#FFFFFF' : '#1D1D1F',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                transition: 'all 120ms ease',
                ...FONT,
              }}
            >
              <Icon size={13} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'details' && (
        <BankStatementsDetails
          adminLocationId={adminLocationId}
          locations={locations}
        />
      )}

      {tab === 'upload' && <>
      {/* Upload panel */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(88,86,214,0.08), rgba(0,122,255,0.06))',
        borderRadius: 18, padding: 20, marginBottom: 18,
        border: '1px dashed rgba(88,86,214,0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, background: '#5856D6', color: '#FFFFFF',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Upload size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1D1D1F' }}>
              Drop a statement here
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#86868B' }}>
              PDF · CSV · XLSX — up to 15 MB. AI classifies each transaction, matches suppliers, then
              XLSX downloads automatically with Income and Expenses on separate tabs.
            </p>
          </div>
          <button
            data-testid="bs-upload"
            onClick={onPickFile}
            disabled={busy || !adminLocationId}
            style={{
              padding: '12px 22px', borderRadius: 999, border: 0,
              background: busy || !adminLocationId ? '#C7C7CC' : '#1D1D1F',
              color: '#FFFFFF', fontSize: 14, fontWeight: 700,
              cursor: busy || !adminLocationId ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 8, ...FONT,
            }}
          >
            {busy ? <><Loader2 size={16} className="animate-spin" /> Analysing…</> : <><Sparkles size={16} /> Upload & Split</>}
          </button>
          <input
            ref={inputRef}
            type="file"
            data-testid="bs-file-input"
            accept=".pdf,.csv,.xlsx,.xls,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            style={{ display: 'none' }}
            onChange={onFileChosen}
          />
        </div>

        {busy && (
          <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: 'rgba(0,122,255,0.08)', color: '#1D1D1F', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Loader2 size={14} className="animate-spin" color="#007AFF" />
            Reading the file and asking Claude to classify each transaction — large statements
            (20+ pages) are split into chunks and processed in parallel, typically ~30–60 s.
            Please stay on this page.
          </div>
        )}
      </div>

      {err && (
        <div data-testid="bs-error" style={{ background: 'rgba(255,59,48,0.10)', color: '#C0392B', padding: 12, borderRadius: 12, fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, wordBreak: 'break-word' }}>{err}</div>
        </div>
      )}

      {/* Debug trail — visible so managers can screenshot the exact failure. */}
      {debug.length > 0 && (
        <div data-testid="bs-debug" style={{
          background: '#0B0B0F', color: '#E5E5EA',
          padding: 12, borderRadius: 12, fontSize: 11,
          marginBottom: 12, ...FONT,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          maxHeight: 260, overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: '#8E8E93', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
              Debug trail
            </span>
            <button
              onClick={() => {
                const txt = debug.map(d => `${d.t} ${d.msg}`).join('\n');
                if (navigator.clipboard?.writeText) {
                  navigator.clipboard.writeText(txt);
                }
              }}
              data-testid="bs-debug-copy"
              style={{ background: 'transparent', border: '1px solid #3A3A3C', color: '#E5E5EA', fontSize: 10, padding: '3px 8px', borderRadius: 6, cursor: 'pointer' }}
            >
              Copy
            </button>
          </div>
          {debug.map((d, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, lineHeight: 1.5 }}>
              <span style={{ color: '#48D597', flexShrink: 0 }}>{d.t}</span>
              <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{d.msg}</span>
            </div>
          ))}
        </div>
      )}

      {lastResult && !err && (
        <div data-testid="bs-last-result" style={{ background: 'rgba(52,199,89,0.10)', color: '#1D5A2F', padding: 14, borderRadius: 12, fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <CheckCircle2 size={18} color="#34C759" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 700, color: '#1D1D1F' }}>
              Statement split · {lastResult.income_count} income · {lastResult.expense_count} expenses
            </p>
            <p style={{ margin: '2px 0 0', color: '#3A3A3C', fontSize: 12 }}>
              Total income {fmtGBP(lastResult.total_income)} · Total expense {fmtGBP(lastResult.total_expense)} ·
              Net <strong>{fmtGBP(lastResult.net)}</strong>. XLSX has been downloaded to your device.
            </p>
          </div>
        </div>
      )}

      {/* History */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <FileText size={14} color="#86868B" />
        <h2 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Previous statements
        </h2>
      </div>

      {loading && <p style={{ textAlign: 'center', color: '#86868B', padding: 24 }}>Loading…</p>}

      {!loading && items.length === 0 && (
        <div data-testid="bs-empty" style={{ background: '#FFFFFF', borderRadius: 14, padding: 28, textAlign: 'center', color: '#86868B', fontSize: 13, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          No statements uploaded yet for this site. Upload one above and the split XLSX will
          download automatically.
        </div>
      )}

      {!loading && items.length > 0 && (
        <div data-testid="bs-list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((rec) => (
            <div
              key={rec.id}
              data-testid={`bs-row-${rec.id}`}
              style={{
                background: '#FFFFFF', borderRadius: 14, padding: 14,
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1D1D1F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {rec.filename}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: '#86868B' }}>
                  {rec.period_start && rec.period_end
                    ? `${rec.period_start} → ${rec.period_end}`
                    : 'Statement period auto-detected'}
                  {rec.account_ref && ` · ${rec.account_ref}`}
                  {' · uploaded '}{fmtDate(rec.uploaded_at)}
                  {rec.uploaded_by_name && ` by ${rec.uploaded_by_name}`}
                </p>
                <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 999, background: 'rgba(52,199,89,0.12)', color: '#1D5A2F', fontSize: 11, fontWeight: 700 }}>
                    <TrendingUp size={11} /> {fmtGBP(rec.total_income)} income
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 999, background: 'rgba(255,59,48,0.12)', color: '#8A2822', fontSize: 11, fontWeight: 700 }}>
                    <TrendingDown size={11} /> {fmtGBP(rec.total_expense)} expense
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 999, background: '#F5F5F7', color: '#1D1D1F', fontSize: 11, fontWeight: 700 }}>
                    <Wallet size={11} /> Net {fmtGBP(rec.net)}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  data-testid={`bs-download-${rec.id}`}
                  onClick={() => downloadOne(rec)}
                  disabled={busy}
                  aria-label="Download XLSX"
                  title="Download XLSX (Income + Expenses tabs)"
                  style={{ width: 36, height: 36, borderRadius: 999, background: '#1D1D1F', color: '#FFFFFF', border: 0, cursor: busy ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}
                >
                  <Download size={15} />
                </button>
                <button
                  data-testid={`bs-reclassify-${rec.id}`}
                  onClick={() => reclassifyOne(rec)}
                  disabled={busy || reclassifyingId === rec.id}
                  aria-label="Re-classify with AI"
                  title="Re-classify with latest supplier list & prompt (30-60s)"
                  style={{ width: 36, height: 36, borderRadius: 999, background: 'rgba(88,86,214,0.10)', color: '#5856D6', border: 0, cursor: (busy || reclassifyingId === rec.id) ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: (busy || reclassifyingId === rec.id) ? 0.6 : 1 }}
                >
                  {reclassifyingId === rec.id
                    ? <Loader2 size={15} className="animate-spin" />
                    : <RefreshCw size={15} />}
                </button>
                <button
                  data-testid={`bs-delete-${rec.id}`}
                  onClick={() => deleteOne(rec)}
                  disabled={busy}
                  aria-label="Delete statement"
                  title="Delete statement"
                  style={{ width: 36, height: 36, borderRadius: 999, background: 'rgba(255,59,48,0.10)', color: '#C0392B', border: 0, cursor: busy ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      </>}
    </div>
  );
};

/* ============================================================================
 * Details tab — drills into uploaded statements. Multi-select location chips,
 * optional statement dropdown, live transaction table with search + type
 * filter, and a Download button that hits the aggregate XLSX endpoint (same
 * 3-tab format as the per-statement download).
 * ==========================================================================*/
const BankStatementsDetails = ({ adminLocationId, locations }) => {
  const [selectedLocations, setSelectedLocations] = useState(
    () => (adminLocationId ? [adminLocationId] : []),
  );
  const [stmtList, setStmtList] = useState([]);
  const [selectedStmt, setSelectedStmt] = useState(''); // '' = all
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({ total_income: 0, total_expense: 0, statement_count: 0 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'income' | 'expense'
  const [downloading, setDownloading] = useState(false);

  const allSites = locations || [];
  const locName = (id) => allSites.find((l) => l.id === id)?.name || id;

  // Reload statement list whenever the location filter changes.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setBusy(true); setErr('');
      try {
        const res = await api.bankStatementsList({ location_ids: selectedLocations });
        if (cancelled) return;
        setStmtList(res.items || []);
        // If the previously-selected statement no longer matches the
        // filter, reset it back to "all".
        if (selectedStmt && !(res.items || []).some((s) => s.id === selectedStmt)) {
          setSelectedStmt('');
        }
      } catch (e) {
        if (!cancelled) setErr(e.message || 'Failed to load statements');
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [selectedLocations.join(',')]);

  // Reload transaction feed whenever location or statement selection changes.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setBusy(true); setErr('');
      try {
        const params = selectedStmt
          ? { ids: [selectedStmt] }
          : { location_ids: selectedLocations };
        const res = await api.bankStatementsAggregate(params);
        if (cancelled) return;
        setRows(res.transactions || []);
        setTotals({
          total_income: res.total_income || 0,
          total_expense: res.total_expense || 0,
          statement_count: res.statement_count || 0,
        });
      } catch (e) {
        if (!cancelled) setErr(e.message || 'Failed to load transactions');
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [selectedLocations.join(','), selectedStmt]);

  const toggleLocation = (id) => {
    setSelectedLocations((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectAllSites = () => setSelectedLocations(allSites.map((l) => l.id));
  const clearSites = () => setSelectedLocations([]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== 'all' && r.type !== typeFilter) return false;
      if (q && ![r.description, r.category, r.matched_supplier, r.date, r.statement_filename]
        .some((v) => (v || '').toLowerCase().includes(q))) return false;
      return true;
    });
  }, [rows, search, typeFilter]);

  const download = async () => {
    setDownloading(true); setErr('');
    try {
      const params = selectedStmt
        ? { ids: [selectedStmt] }
        : { location_ids: selectedLocations };
      const url = await api.bankStatementsAggregateXlsxUrl(params);
      const stem = selectedStmt
        ? (stmtList.find((s) => s.id === selectedStmt)?.filename || 'statement').replace(/\.[^.]+$/, '')
        : `combined_${selectedLocations.length || 'all'}sites`;
      downloadBlobUrl(url, `${stem}_split.xlsx`);
    } catch (e) {
      setErr(e.message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div data-testid="bs-details" style={{ ...FONT }}>
      {/* Location multi-select */}
      <div style={{ background: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <MapPin size={13} color="#5856D6" />
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Sites
          </p>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button
              data-testid="bs-detail-all-sites"
              onClick={selectAllSites}
              style={{ padding: '4px 10px', borderRadius: 999, border: 0, background: '#F5F5F7', color: '#1D1D1F', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
            >All</button>
            <button
              data-testid="bs-detail-clear-sites"
              onClick={clearSites}
              style={{ padding: '4px 10px', borderRadius: 999, border: 0, background: '#F5F5F7', color: '#86868B', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
            >Clear</button>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {allSites.map((l) => {
            const on = selectedLocations.includes(l.id);
            return (
              <button
                key={l.id}
                data-testid={`bs-detail-site-${l.id}`}
                onClick={() => toggleLocation(l.id)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '6px 12px', borderRadius: 999, border: 0,
                  background: on ? '#5856D6' : '#F5F5F7',
                  color: on ? '#FFFFFF' : '#1D1D1F',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  transition: 'all 120ms ease', ...FONT,
                }}
              >
                {on && <Check size={11} />} {l.name}
              </button>
            );
          })}
          {allSites.length === 0 && (
            <span style={{ fontSize: 12, color: '#86868B' }}>No sites available</span>
          )}
        </div>
      </div>

      {/* Statement dropdown + Download button */}
      <div style={{ background: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end' }}>
        <label style={{ display: 'block', minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            <FileText size={12} /> Statement (blank = all)
          </span>
          <select
            data-testid="bs-detail-stmt-select"
            value={selectedStmt}
            onChange={(e) => setSelectedStmt(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 10,
              background: '#F5F5F7', border: 0, fontSize: 13, color: '#1D1D1F',
              ...FONT,
            }}
          >
            <option value="">All statements combined ({stmtList.length})</option>
            {stmtList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.filename} · {locName(s.location_id)} · {s.period_start || fmtDate(s.uploaded_at)}
              </option>
            ))}
          </select>
        </label>
        <button
          data-testid="bs-detail-download"
          onClick={download}
          disabled={downloading || rows.length === 0}
          style={{
            padding: '10px 18px', borderRadius: 10, border: 0,
            background: downloading || rows.length === 0 ? '#C7C7CC' : '#1D1D1F',
            color: '#FFFFFF', fontSize: 13, fontWeight: 700,
            cursor: downloading || rows.length === 0 ? 'not-allowed' : 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            ...FONT,
          }}
        >
          {downloading ? <><Loader2 size={14} className="animate-spin" /> Preparing…</> : <><Download size={14} /> Download XLSX</>}
        </button>
      </div>

      {/* Totals + type filter */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 12 }}>
        <button
          data-testid="bs-detail-filter-all"
          onClick={() => setTypeFilter('all')}
          style={{
            textAlign: 'left', padding: 12, borderRadius: 12, border: 0,
            background: typeFilter === 'all' ? '#1D1D1F' : '#FFFFFF',
            color: typeFilter === 'all' ? '#FFFFFF' : '#1D1D1F',
            cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', ...FONT,
          }}
        >
          <p style={{ margin: 0, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.7, fontWeight: 700 }}>All rows</p>
          <p style={{ margin: '3px 0 0', fontSize: 18, fontWeight: 800 }}>{rows.length}</p>
          <p style={{ margin: '2px 0 0', fontSize: 10, opacity: 0.6 }}>{totals.statement_count} statement{totals.statement_count === 1 ? '' : 's'}</p>
        </button>
        <button
          data-testid="bs-detail-filter-income"
          onClick={() => setTypeFilter('income')}
          style={{
            textAlign: 'left', padding: 12, borderRadius: 12, border: 0,
            background: typeFilter === 'income' ? '#34C759' : '#FFFFFF',
            color: typeFilter === 'income' ? '#FFFFFF' : '#1D1D1F',
            cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', ...FONT,
          }}
        >
          <p style={{ margin: 0, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.85, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
            <TrendingUp size={11} /> Income
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 18, fontWeight: 800 }}>{fmtGBP(totals.total_income)}</p>
        </button>
        <button
          data-testid="bs-detail-filter-expense"
          onClick={() => setTypeFilter('expense')}
          style={{
            textAlign: 'left', padding: 12, borderRadius: 12, border: 0,
            background: typeFilter === 'expense' ? '#FF3B30' : '#FFFFFF',
            color: typeFilter === 'expense' ? '#FFFFFF' : '#1D1D1F',
            cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', ...FONT,
          }}
        >
          <p style={{ margin: 0, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.85, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
            <TrendingDown size={11} /> Expenses
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 18, fontWeight: 800 }}>{fmtGBP(totals.total_expense)}</p>
        </button>
        <div style={{
          padding: 12, borderRadius: 12, background: '#FFFFFF',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}>
          <p style={{ margin: 0, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#86868B', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Wallet size={11} /> Net
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 18, fontWeight: 800, color: (totals.total_income - totals.total_expense) >= 0 ? '#1D5A2F' : '#8A2822' }}>
            {fmtGBP(totals.total_income - totals.total_expense)}
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', background: '#FFFFFF', borderRadius: 12, padding: '4px 12px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <Search size={14} color="#86868B" />
        <input
          data-testid="bs-detail-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search description, category, supplier…"
          style={{ flex: 1, border: 0, background: 'transparent', padding: '10px 0', fontSize: 13, color: '#1D1D1F', outline: 'none', ...FONT }}
        />
        {search && (
          <button
            data-testid="bs-detail-search-clear"
            onClick={() => setSearch('')}
            style={{ background: 'none', border: 0, color: '#86868B', cursor: 'pointer', fontSize: 12 }}
          >Clear</button>
        )}
        <ListFilter size={14} color="#86868B" />
        <span style={{ fontSize: 11, color: '#86868B' }}>{filteredRows.length} of {rows.length}</span>
      </div>

      {err && (
        <div data-testid="bs-detail-error" style={{ background: 'rgba(255,59,48,0.10)', color: '#C0392B', padding: 12, borderRadius: 12, fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={14} /> {err}
        </div>
      )}

      {busy && (
        <p style={{ textAlign: 'center', color: '#86868B', padding: 24 }}>
          <Loader2 size={16} className="animate-spin" style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Loading…
        </p>
      )}

      {!busy && filteredRows.length === 0 && (
        <div data-testid="bs-detail-empty" style={{ background: '#FFFFFF', borderRadius: 14, padding: 28, textAlign: 'center', color: '#86868B', fontSize: 13, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          {rows.length === 0
            ? 'No statements match your filters. Adjust the sites above or upload a new statement.'
            : 'No transactions match the current search + type filter.'}
        </div>
      )}

      {/* Transaction table */}
      {!busy && filteredRows.length > 0 && (
        <div data-testid="bs-detail-table" style={{ background: '#FFFFFF', borderRadius: 14, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, ...FONT }}>
              <thead>
                <tr style={{ background: '#F5F5F7' }}>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Description</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Type</th>
                  <th style={thStyle}>Category</th>
                  <th style={thStyle}>Matched supplier</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                  <th style={thStyle}>Site · Statement</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.slice(0, 500).map((r, idx) => (
                  <tr key={`${r.statement_id}-${idx}`} style={{ borderTop: '1px solid #ECECEF' }}>
                    <td style={tdStyle}>{r.date || '—'}</td>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{r.description}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        padding: '2px 8px', borderRadius: 999,
                        background: r.type === 'income' ? 'rgba(52,199,89,0.12)' : 'rgba(255,59,48,0.12)',
                        color: r.type === 'income' ? '#1D5A2F' : '#8A2822',
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase',
                      }}>
                        {r.type === 'income' ? <TrendingUp size={9} /> : <TrendingDown size={9} />} {r.type}
                      </span>
                    </td>
                    <td style={tdStyle}>{r.category || '—'}</td>
                    <td style={tdStyle}>{r.matched_supplier || '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: r.type === 'income' ? '#1D5A2F' : '#8A2822' }}>
                      {fmtGBP(r.amount)}
                    </td>
                    <td style={{ ...tdStyle, color: '#86868B', fontSize: 11 }}>
                      {locName(r.location_id)} · <span title={r.statement_filename}>{(r.statement_filename || '').slice(0, 20)}{(r.statement_filename || '').length > 20 ? '…' : ''}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredRows.length > 500 && (
            <p style={{ margin: 0, padding: 10, textAlign: 'center', fontSize: 11, color: '#86868B', borderTop: '1px solid #ECECEF' }}>
              Showing first 500 rows — download the XLSX for the full dataset.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

const thStyle = {
  textAlign: 'left', padding: '10px 12px', fontSize: 10,
  fontWeight: 700, color: '#86868B', textTransform: 'uppercase',
  letterSpacing: '0.06em', whiteSpace: 'nowrap',
};
const tdStyle = { padding: '10px 12px', color: '#1D1D1F', verticalAlign: 'middle' };

export default BankStatements;
