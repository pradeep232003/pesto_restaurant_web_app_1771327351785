import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Shield, ArrowLeft, Printer, Check, X, AlertTriangle, Clock, Filter, Mail, FileDown } from 'lucide-react';
import api, { API_BASE_URL } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';

const STATUS_META = {
  complete:     { bg: '#34C759', fg: '#FFFFFF', icon: Check,          label: 'Complete' },
  partial:      { bg: '#FF9500', fg: '#FFFFFF', icon: AlertTriangle,  label: 'Partial' },
  overdue:      { bg: '#FF3B30', fg: '#FFFFFF', icon: Clock,          label: 'Overdue' },
  missing:      { bg: '#E8E8ED', fg: '#8E8E93', icon: X,              label: 'Missing' },
  not_required: { bg: '#F5F5F7', fg: '#C7C7CC', icon: null,           label: 'N/A' },
};

const fmtDate = (s) => {
  if (!s) return '—';
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    // Include time when the source value is a full ISO timestamp (has a 'T').
    const hasTime = typeof s === 'string' && s.includes('T');
    return hasTime
      ? d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  } catch { return s; }
};

/** Best-effort field accessors so the drill-down modal renders complete details
 *  for every check type, not just opening_checklist. Each collection uses
 *  different field names (recorded_at vs date vs start_time, recorded_by_name
 *  vs completed_by_name vs submitted_by_name vs started_by_name, etc).
 */
const entryWhen = (e) =>
  e.completed_at || e.recorded_at || e.submitted_at || e.start_time || e.started_at
  || e.date || e.week_ending || e.created_at || e.updated_at || '';

const entryBy = (e) =>
  e.completed_by_name || e.recorded_by_name || e.submitted_by_name || e.started_by_name
  || e.created_by_name || e.completed_by || e.recorded_by || e.submitted_by
  || e.started_by || e.created_by || '—';

const entryPass = (e) => {
  if (e.passed != null) return e.passed;
  if (e.completed === true) return true;
  if (e.passed_items != null && e.total_items != null) return e.passed_items === e.total_items;
  return null;
};

const entrySummary = (e) => {
  const parts = [];
  // Item / target labels
  if (e.item_name) parts.push(e.item_name);
  if (e.washer_name) parts.push(e.washer_name);
  if (e.title) parts.push(e.title);
  if (e.food_item) parts.push(e.food_item);
  if (e.supplier) parts.push(e.supplier);
  if (e.location_of_test) parts.push(e.location_of_test);
  if (e.probe_name) parts.push(`Probe ${e.probe_name}`);
  if (e.probe_no) parts.push(`Probe ${e.probe_no}`);
  if (e.unit_id) parts.push(e.unit_id);
  // "No cold holding today" type idempotent stubs — show the mode label
  if (e.kind === 'no_holding' && e.mode) parts.push(`(no ${e.mode} holding)`);
  if (e.kind === 'no_bulk_prep') parts.push('(no bulk prep)');
  // Temperatures
  if (e.wash_temp != null) parts.push(`Wash ${Number(e.wash_temp).toFixed(1)}°C`);
  if (e.rinse_temp != null) parts.push(`Rinse ${Number(e.rinse_temp).toFixed(1)}°C`);
  if (e.start_temp_c != null) parts.push(`Start ${Number(e.start_temp_c).toFixed(1)}°C`);
  if (e.end_temp_c != null) parts.push(`End ${Number(e.end_temp_c).toFixed(1)}°C`);
  if (e.temp_c != null) parts.push(`${e.temp_c}°C`);
  if (e.temperature != null) parts.push(`${e.temperature}°C`);
  if (e.boiling_temp != null) parts.push(`Boil ${e.boiling_temp}°C`);
  if (e.iced_temp != null) parts.push(`Iced ${e.iced_temp}°C`);
  if (e.hot_water_temp != null) parts.push(`Hot ${e.hot_water_temp}°C`);
  if (e.cold_water_temp != null) parts.push(`Cold ${e.cold_water_temp}°C`);
  // Counters
  if (e.passed_items != null && e.total_items != null) parts.push(`${e.passed_items}/${e.total_items} ticked`);
  if (Array.isArray(e.checked_items) && e.total_items != null && e.passed_items == null) parts.push(`${e.checked_items.length}/${e.total_items} ticked`);
  if (e.passed_cells != null && e.total_cells != null) parts.push(`${e.passed_cells}/${e.total_cells} cells`);
  // Status badges for cooling
  if (e.status && e.status !== 'complete') parts.push(`status: ${e.status}`);
  return parts;
};

const AdminCompliance = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin, loading: authLoading } = useAuth();
  const { locations } = useLocation2();
  const routerLocation = useLocation();
  const isJkhive = routerLocation.pathname.startsWith('/jkhive');

  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 6 * 864e5).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(weekAgo);
  const [endDate, setEndDate] = useState(today);
  const [filterLoc, setFilterLoc] = useState('');
  const [filterCheck, setFilterCheck] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  // Drill-down
  const [detail, setDetail] = useState(null);      // { location_id, location_name, check_key, label, entries }
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) navigate('/admin-login');
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  useEffect(() => { fetchData(); }, [startDate, endDate, filterLoc]);

  const fetchData = async () => {
    setLoading(true);
    try { setData(await api.adminGetCompliance({ start_date: startDate, end_date: endDate, location_id: filterLoc || undefined })); }
    catch (err) { alert('Failed: ' + err.message); }
    finally { setLoading(false); }
  };

  // Lock body scroll while the drill-down modal is open
  useEffect(() => {
    if (detail) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [detail]);

  const openDetail = async (site, checkKey) => {
    setDetailLoading(true);
    setDetail({ location_id: site.location_id, location_name: site.location_name, check_key: checkKey, label: data.check_types.find(c => c.key === checkKey)?.label, entries: [] });
    try {
      const d = await api.adminGetComplianceDetail({ location_id: site.location_id, check_key: checkKey, start_date: startDate, end_date: endDate });
      setDetail(prev => ({ ...prev, entries: d.entries }));
    } catch (err) { alert('Failed: ' + err.message); }
    finally { setDetailLoading(false); }
  };

  const [printing, setPrinting] = useState(false);
  const handlePrint = async () => {
    // Open the PDF in a new tab. The browser's built-in PDF viewer correctly
    // reads landscape orientation from the PDF and exposes a Print icon
    // (top-right) that launches the standard print dialog with printer picker,
    // copies, paper size, etc. Auto-triggering print() programmatically caused
    // Chrome to use HTML-print mode which forced portrait + cropped the logo.
    setPrinting(true);
    try {
      const token = localStorage.getItem('access_token');
      const qs = new URLSearchParams({ start_date: startDate, end_date: endDate }).toString();
      const resp = await fetch(`${API_BASE_URL}/api/admin/compliance-digest/preview-pdf?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
    } catch (err) { alert('Print failed: ' + err.message); }
    finally { setPrinting(false); }
  };

  const [pdfLoading, setPdfLoading] = useState(false);
  const handlePreviewPDF = async () => {
    setPdfLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const qs = new URLSearchParams({ start_date: startDate, end_date: endDate }).toString();
      const resp = await fetch(`${API_BASE_URL}/api/admin/compliance-digest/preview-pdf?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      // Anchor-click bypasses popup blockers
      const a = document.createElement('a');
      a.href = blobUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
    } catch (err) { alert('Preview failed: ' + err.message); }
    finally { setPdfLoading(false); }
  };

  const [sending, setSending] = useState(false);
  const handleSendDigest = async () => {
    if (!window.confirm('Send the weekly compliance digest to all admins now?')) return;
    setSending(true);
    try {
      const res = await api.adminSendComplianceDigestNow();
      alert(`Sent to ${res.recipients.length} admin${res.recipients.length === 1 ? '' : 's'}:\n${res.recipients.join('\n')}`);
    } catch (err) { alert('Failed: ' + err.message); }
    finally { setSending(false); }
  };

  if (authLoading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>;

  const font = { fontFamily: 'Outfit, sans-serif' };
  const inputStyle = { background: '#FFFFFF', color: '#1D1D1F', ...font, boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' };

  // Apply client-side filters (check type + status)
  let displayedSites = data?.sites || [];
  if (filterStatus && data) {
    displayedSites = displayedSites.filter(s => {
      if (filterCheck) return s.checks[filterCheck]?.status === filterStatus;
      return Object.values(s.checks).some(c => c.status === filterStatus);
    });
  }
  const displayedChecks = filterCheck ? data?.check_types.filter(c => c.key === filterCheck) : data?.check_types;

  return (
    <div className={isJkhive ? "px-4 sm:px-6 lg:px-8 pt-2 pb-4 max-w-[1400px] mx-auto" : "p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto"} data-testid="admin-compliance-page">
      {/* Non-printable header */}
      <div className="print:hidden">
        {isJkhive ? (
          <Link
            to="/jkhive"
            data-testid="back-to-jkhive"
            className="inline-flex items-center gap-1.5 -ml-1 px-1 py-1 mb-3 rounded-lg active:scale-95"
            style={{ color: '#1D1D1F', ...font }}
          >
            <ArrowLeft size={20} strokeWidth={2.4} style={{ color: '#007AFF' }} />
            <span className="text-xl sm:text-2xl font-semibold tracking-tight">Food Safety Compliance</span>
          </Link>
        ) : (
          <Link to="/admin" data-testid="back-to-dashboard" className="inline-flex items-center gap-1.5 text-xs font-medium mb-3 active:scale-95" style={{ color: '#007AFF', ...font }}>
            <ArrowLeft size={13} /> Dashboard
          </Link>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            {!isJkhive && (
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#1D1D1F' }}>
                <Shield size={18} color="white" strokeWidth={1.8} />
              </div>
            )}
            <div>
              {!isJkhive && (
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: '#1D1D1F', ...font }}>Food Safety Compliance</h1>
              )}
              <p className="text-xs sm:text-sm" style={{ color: '#86868B' }}>EHO-ready compliance matrix across all sites</p>
            </div>
          </div>
          <button data-testid="print-report-btn" disabled={printing} onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 active:scale-95"
            style={{ background: '#1D1D1F', color: '#FFFFFF', ...font }}>
            <Printer size={14} /> {printing ? 'Preparing…' : 'Print Report'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-5 print:hidden">
          <button data-testid="preview-pdf-btn" disabled={pdfLoading} onClick={handlePreviewPDF}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-50 active:scale-95"
            style={{ background: '#F5F5F7', color: '#1D1D1F', ...font }}>
            <FileDown size={12} /> {pdfLoading ? 'Loading…' : 'Preview PDF'}
          </button>
          <button data-testid="send-digest-btn" disabled={sending} onClick={handleSendDigest}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-50 active:scale-95"
            style={{ background: '#007AFF', color: '#FFFFFF', ...font }}>
            <Mail size={12} /> {sending ? 'Sending...' : 'Email Digest Now'}
          </button>
          <span className="text-[11px]" style={{ color: '#86868B', ...font }}>Auto-sent every Monday 07:00 UK</span>
        </div>

        {/* Filters */}
        <div className="p-4 rounded-2xl mb-5" style={{ background: '#FFFFFF' }}>
          <div className="flex items-center gap-1.5 mb-3">
            <Filter size={12} style={{ color: '#86868B' }} />
            <span className="text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>FILTERS</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-[11px] mb-1" style={{ color: '#86868B', ...font }}>From</label>
              <input type="date" data-testid="filter-start" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm border-0 outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: '#86868B', ...font }}>To</label>
              <input type="date" data-testid="filter-end" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm border-0 outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: '#86868B', ...font }}>Site</label>
              <select data-testid="filter-location" value={filterLoc} onChange={e => setFilterLoc(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm border-0 outline-none" style={inputStyle}>
                <option value="">All sites</option>
                {locations.filter(l => l.is_active).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: '#86868B', ...font }}>Check Type</label>
              <select data-testid="filter-check" value={filterCheck} onChange={e => setFilterCheck(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm border-0 outline-none" style={inputStyle}>
                <option value="">All checks</option>
                {(data?.check_types || []).map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: '#86868B', ...font }}>Status</label>
              <select data-testid="filter-status" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm border-0 outline-none" style={inputStyle}>
                <option value="">All statuses</option>
                <option value="complete">Complete</option>
                <option value="partial">Partial</option>
                <option value="overdue">Overdue</option>
                <option value="missing">Missing</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden">
        <h1 className="text-2xl font-bold" style={font}>Food Safety Compliance Report</h1>
        <p className="text-sm" style={font}>Jolly's Kafe · Generated {new Date().toLocaleString('en-GB')}</p>
        <p className="text-sm" style={font}>Period: {startDate} to {endDate}</p>
        <p className="text-sm" style={font}>Generated by: {user?.name || user?.email}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>
      ) : !data ? null : (
        <>
          {/* Overall */}
          <div className="mb-5 p-5 rounded-2xl flex items-center justify-between" style={{ background: '#FFFFFF' }}>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#86868B', ...font }}>Overall Compliance</p>
              <p className="text-4xl font-semibold mt-1" style={{ color: data.overall_pct >= 90 ? '#34C759' : data.overall_pct >= 60 ? '#FF9500' : '#FF3B30', ...font }} data-testid="overall-pct">
                {data.overall_pct}%
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#86868B', ...font }}>Across {data.sites.length} sites</p>
              <p className="text-sm" style={{ color: '#1D1D1F', ...font }}>{data.check_types.length} check types · {startDate} → {endDate}</p>
            </div>
          </div>

          {/* Matrix — rows = checks, columns = sites */}
          <div className="rounded-2xl overflow-hidden mb-6" style={{ background: '#FFFFFF' }}>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ minWidth: Math.max(560, 220 + displayedSites.length * 140) }}>
                <thead>
                  <tr style={{ background: '#F5F5F7' }}>
                    <th className="sticky left-0 z-10 px-3 py-2.5 text-left text-[11px] font-semibold" style={{ background: '#F5F5F7', color: '#86868B', ...font, minWidth: 220 }}>Check</th>
                    {displayedSites.map(site => (
                      <th key={site.location_id} className="px-2 py-2.5 text-center text-[11px] font-semibold" style={{ color: '#86868B', ...font, minWidth: 130 }} data-testid={`site-col-${site.location_id}`}>
                        <div>{site.location_name}</div>
                        <div className="mt-1">
                          <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold"
                            style={{
                              background: site.compliance_pct >= 90 ? 'rgba(52,199,89,0.12)' : site.compliance_pct >= 60 ? 'rgba(255,149,0,0.12)' : 'rgba(255,59,48,0.12)',
                              color:      site.compliance_pct >= 90 ? '#1F8C42' : site.compliance_pct >= 60 ? '#A35E00' : '#C0392B',
                            }}>
                            {site.compliance_pct}%
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedChecks?.map(c => (
                    <tr key={c.key} style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }} data-testid={`check-row-${c.key}`}>
                      <td className="sticky left-0 z-10 px-3 py-2.5 text-sm" style={{ background: '#FFFFFF', color: '#1D1D1F', ...font }}>
                        <div className="font-medium">{c.label}</div>
                        <div className="text-[10px] mt-0.5 inline-block px-1.5 py-0.5 rounded"
                          style={{ background: c.cadence === 'weekly' ? 'rgba(0,122,255,0.10)' : 'rgba(142,142,147,0.10)',
                                   color:      c.cadence === 'weekly' ? '#0A66CC'             : '#86868B' }}>
                          {c.cadence}
                        </div>
                      </td>
                      {displayedSites.map(site => {
                        const check = site.checks[c.key];
                        // Site doesn't include this routine, OR has never
                        // produced any record (weekly cadence default) → N/A.
                        if (!check || check.status === 'not_applicable') {
                          const meta = STATUS_META.not_required;
                          return (
                            <td key={site.location_id} className="px-2 py-2 text-center" data-testid={`cell-${site.location_id}-${c.key}`}>
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium"
                                title={!check ? 'Not required at this location' : 'No records ever — not set up'}
                                style={{ background: meta.bg, color: meta.fg, ...font }}>
                                {meta.label}
                              </span>
                            </td>
                          );
                        }
                        const meta = STATUS_META[check.status] || STATUS_META.missing;
                        const Ico = meta.icon;
                        const tipParts = [];
                        if (check.last_date) tipParts.push(`Last: ${fmtDate(check.last_date)}`);
                        if (check.last_by) tipParts.push(`by ${check.last_by}`);
                        const tip = tipParts.join(' · ') || `${check.actual_periods}/${check.expected} in range`;
                        return (
                          <td key={site.location_id} className="px-2 py-2 text-center">
                            <button onClick={() => openDetail(site, c.key)} data-testid={`cell-${site.location_id}-${c.key}`}
                              title={tip}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium active:scale-95 hover:opacity-80"
                              style={{ background: meta.bg, color: meta.fg, ...font }}>
                              {Ico && <Ico size={11} strokeWidth={3} />}
                              <span className="print:hidden">{check.pct}%</span>
                              <span className="hidden print:inline">{meta.label}</span>
                            </button>
                            <div className="text-[9px] mt-0.5" style={{ color: '#86868B' }}>
                              {check.actual_periods}/{check.expected}{c.cadence === 'weekly' ? ' wk' : ''}
                            </div>
                            {check.status === 'missing' && check.last_date && (
                              <div className="text-[9px] mt-0.5 italic" style={{ color: '#86868B' }}>
                                last {fmtDate(check.last_date)}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {displayedSites.length === 0 && (
                    <tr><td colSpan={(displayedSites?.length || 0) + 1} className="px-4 py-10 text-center text-sm" style={{ color: '#86868B', ...font }}>No sites match current filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 px-4 py-3 flex-wrap print:hidden" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
              {Object.entries(STATUS_META).filter(([k]) => k !== 'not_required').map(([k, m]) => (
                <div key={k} className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded" style={{ background: m.bg }} />
                  <span className="text-[11px]" style={{ color: '#86868B', ...font }}>{m.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Per-site detail tables (kept for in-app screen reference; not used for print since print now uses PDF) */}
          <div className="hidden">
            {data.sites.map(site => (
              <div key={site.location_id} className="print-site-page" style={{ breakInside: 'avoid' }}>
                <h2 className="text-lg font-bold mt-6" style={font}>{site.location_name} — {site.compliance_pct}%</h2>
                <p className="text-xs mb-2" style={{ color: '#86868B', ...font }}>Period: {startDate} to {endDate}</p>
                <table className="w-full text-xs mt-2" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr><th className="border p-1 text-left">Check</th><th className="border p-1 text-left">Status</th><th className="border p-1 text-left">Coverage</th></tr>
                  </thead>
                  <tbody>
                    {data.check_types.map(c => {
                      const ch = site.checks[c.key];
                      if (!ch) {
                        return (
                          <tr key={c.key}>
                            <td className="border p-1">{c.label}</td>
                            <td className="border p-1">N/A</td>
                            <td className="border p-1">—</td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={c.key}>
                          <td className="border p-1">{c.label}</td>
                          <td className="border p-1">{(STATUS_META[ch.status] || STATUS_META.missing).label}</td>
                          <td className="border p-1">{ch.actual_periods}/{ch.expected} ({ch.pct}%)</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Drill-down drawer */}
      {detail && (
        <div className="fixed inset-0 z-50 print:hidden flex items-end sm:items-center justify-center" data-testid="detail-drawer">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }} onClick={() => setDetail(null)} />
          <div
            className="relative w-full sm:w-[560px] sm:max-w-[92vw] flex flex-col"
            style={{
              background: '#F5F5F7',
              maxHeight: '90vh',
              borderRadius: '24px 24px 0 0',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.18)',
            }}
          >
            {/* Mobile grab handle */}
            <div className="sm:hidden flex justify-center pt-2 pb-1">
              <span style={{ width: 36, height: 4, borderRadius: 999, background: 'rgba(0,0,0,0.18)' }} />
            </div>
            <div className="px-5 py-3.5 flex items-center justify-between gap-3" style={{ background: '#FFFFFF', borderBottom: '1px solid rgba(0,0,0,0.06)', borderRadius: '24px 24px 0 0' }}>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: '#86868B', ...font }}>{detail.location_name}</p>
                <h2 className="text-base sm:text-lg font-semibold truncate" style={{ color: '#1D1D1F', ...font }}>{detail.label}</h2>
                {!detailLoading && detail.entries.length > 0 && (
                  <p className="text-[11px] mt-0.5" style={{ color: '#86868B', ...font }}>
                    {detail.entries.length} {detail.entries.length === 1 ? 'entry' : 'entries'} · {fmtDate(startDate)} → {fmtDate(endDate)}
                  </p>
                )}
              </div>
              <button
                onClick={() => setDetail(null)}
                data-testid="detail-close"
                aria-label="Close"
                className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform flex-shrink-0"
                style={{ background: '#F5F5F7' }}
              >
                <X size={16} strokeWidth={2.4} style={{ color: '#1D1D1F' }} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ WebkitOverflowScrolling: 'touch', minHeight: 0, overscrollBehavior: 'contain' }}>
              {detailLoading ? (
                <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>
              ) : detail.entries.length === 0 ? (
                <div className="text-center py-10 rounded-2xl" style={{ background: '#FFFFFF' }}>
                  <p className="text-sm" style={{ color: '#86868B', ...font }}>No entries in this period.</p>
                </div>
              ) : detail.entries.map((e, i) => {
                const dateVal = entryWhen(e);
                const by = entryBy(e);
                const pass = entryPass(e);
                const summary = entrySummary(e);
                const note = e.note || e.quality_comments || e.action_taken || e.comments || e.comment;
                return (
                  <div key={e.id || i} data-testid={`compliance-entry-${i}`} className="p-4 rounded-2xl" style={{ background: '#FFFFFF' }}>
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <span className="text-sm font-semibold" style={{ color: '#1D1D1F', ...font }}>{fmtDate(dateVal)}</span>
                      {pass != null && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md" style={{ background: pass ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)', color: pass ? '#34C759' : '#FF3B30' }}>
                          {pass ? 'PASS' : 'FAIL'}
                        </span>
                      )}
                    </div>
                    {summary.length > 0 && <p className="text-xs mb-1.5 leading-relaxed" style={{ color: '#3A3A3C', ...font }}>{summary.join(' · ')}</p>}
                    <p className="text-[11px]" style={{ color: '#86868B', ...font }}>By {by}</p>
                    {note && (
                      <p className="text-[11px] mt-2 px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(255,149,0,0.08)', color: '#A35E00', ...font }}>
                        ⚠ {note}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Print styles intentionally removed — Print Report opens the PDF in a
          new tab and uses the PDF viewer's native print, which preserves
          landscape orientation. No @media print CSS needed for the dashboard. */}
    </div>
  );
};

export default AdminCompliance;
