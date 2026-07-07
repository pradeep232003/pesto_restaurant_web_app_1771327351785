import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Upload, FileSpreadsheet, Download, Trash2, Loader2,
  TrendingUp, TrendingDown, Wallet, CheckCircle2, AlertTriangle, FileText, Sparkles,
} from 'lucide-react';
import api from '../../lib/api';
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

  const onFileChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!adminLocationId) { setErr('Pick a location first'); return; }

    setBusy(true); setErr(''); setLastResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('location_id', adminLocationId);
      const rec = await api.bankStatementUpload(fd);
      setLastResult(rec);
      // Auto-download the XLSX so the manager gets the file immediately.
      try {
        const url = await api.bankStatementXlsxUrl(rec.id);
        const stem = (file.name || 'statement').replace(/\.[^.]+$/, '');
        downloadBlobUrl(url, `${stem}_split.xlsx`);
      } catch (downloadErr) {
        setErr(`Saved, but download failed: ${downloadErr.message}`);
      }
      await load();
    } catch (ex) {
      setErr(ex.message || 'Upload failed');
    } finally {
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
          Upload a bank statement — AI splits it into Income & Expenses and gives you a 2-tab XLSX.
          Site: <strong style={{ color: '#1D1D1F' }}>{locName}</strong>
        </p>
      </div>

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
        <div data-testid="bs-error" style={{ background: 'rgba(255,59,48,0.10)', color: '#C0392B', padding: 12, borderRadius: 12, fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={14} /> {err}
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
    </div>
  );
};

export default BankStatements;
