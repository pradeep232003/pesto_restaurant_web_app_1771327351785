import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  try { return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); } catch { return s; }
};

const AdminCompliance = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin, loading: authLoading } = useAuth();
  const { locations } = useLocation2();

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

  const openDetail = async (site, checkKey) => {
    setDetailLoading(true);
    setDetail({ location_id: site.location_id, location_name: site.location_name, check_key: checkKey, label: data.check_types.find(c => c.key === checkKey)?.label, entries: [] });
    try {
      const d = await api.adminGetComplianceDetail({ location_id: site.location_id, check_key: checkKey, start_date: startDate, end_date: endDate });
      setDetail(prev => ({ ...prev, entries: d.entries }));
    } catch (err) { alert('Failed: ' + err.message); }
    finally { setDetailLoading(false); }
  };

  const handlePrint = () => window.print();

  const [pdfLoading, setPdfLoading] = useState(false);
  const handlePreviewPDF = async () => {
    setPdfLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const resp = await fetch(`${API_BASE_URL}/api/admin/compliance-digest/preview-pdf`, {
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto" data-testid="admin-compliance-page">
      {/* Non-printable header */}
      <div className="print:hidden">
        <Link to="/admin" data-testid="back-to-dashboard" className="inline-flex items-center gap-1.5 text-xs font-medium mb-3 active:scale-95" style={{ color: '#007AFF', ...font }}>
          <ArrowLeft size={13} /> Dashboard
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#1D1D1F' }}>
              <Shield size={18} color="white" strokeWidth={1.8} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: '#1D1D1F', ...font }}>Food Safety Compliance</h1>
              <p className="text-xs sm:text-sm" style={{ color: '#86868B' }}>EHO-ready compliance matrix across all sites</p>
            </div>
          </div>
          <button data-testid="print-report-btn" onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold active:scale-95"
            style={{ background: '#1D1D1F', color: '#FFFFFF', ...font }}>
            <Printer size={14} /> Print Report
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
      <div className="hidden print:block mb-6">
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

          {/* Matrix */}
          <div className="rounded-2xl overflow-hidden mb-6" style={{ background: '#FFFFFF' }}>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ minWidth: 900 }}>
                <thead>
                  <tr style={{ background: '#F5F5F7' }}>
                    <th className="sticky left-0 z-10 px-3 py-2.5 text-left text-[11px] font-semibold" style={{ background: '#F5F5F7', color: '#86868B', ...font, minWidth: 180 }}>Site</th>
                    <th className="px-3 py-2.5 text-center text-[11px] font-semibold" style={{ color: '#86868B', ...font, minWidth: 75 }}>Score</th>
                    {displayedChecks?.map(c => (
                      <th key={c.key} className="px-2 py-2.5 text-center text-[11px] font-semibold" style={{ color: '#86868B', ...font, minWidth: 100 }}>
                        {c.label}
                        <div className="text-[9px] font-normal mt-0.5" style={{ color: '#C7C7CC' }}>{c.cadence}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedSites.map(site => (
                    <tr key={site.location_id} style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }} data-testid={`site-row-${site.location_id}`}>
                      <td className="sticky left-0 z-10 px-3 py-2.5 text-sm font-medium" style={{ background: '#FFFFFF', color: '#1D1D1F', ...font }}>{site.location_name}</td>
                      <td className="px-3 py-2 text-center">
                        <span className="inline-block px-2 py-1 rounded-lg text-xs font-semibold" style={{ background: site.compliance_pct >= 90 ? 'rgba(52,199,89,0.1)' : site.compliance_pct >= 60 ? 'rgba(255,149,0,0.1)' : 'rgba(255,59,48,0.1)', color: site.compliance_pct >= 90 ? '#34C759' : site.compliance_pct >= 60 ? '#FF9500' : '#FF3B30' }}>
                          {site.compliance_pct}%
                        </span>
                      </td>
                      {displayedChecks?.map(c => {
                        const check = site.checks[c.key];
                        const meta = STATUS_META[check.status];
                        const Ico = meta.icon;
                        return (
                          <td key={c.key} className="px-2 py-2 text-center">
                            <button onClick={() => openDetail(site, c.key)} data-testid={`cell-${site.location_id}-${c.key}`}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium active:scale-95 hover:opacity-80"
                              style={{ background: meta.bg, color: meta.fg, ...font }}>
                              {Ico && <Ico size={11} strokeWidth={3} />}
                              <span className="print:hidden">{check.pct}%</span>
                              <span className="hidden print:inline">{meta.label}</span>
                            </button>
                            <div className="text-[9px] mt-0.5" style={{ color: '#86868B' }}>
                              {check.actual_periods}/{check.expected}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {displayedSites.length === 0 && (
                    <tr><td colSpan={(displayedChecks?.length || 0) + 2} className="px-4 py-10 text-center text-sm" style={{ color: '#86868B', ...font }}>No sites match current filters.</td></tr>
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

          {/* Print detail tables — full per-site breakdown, one location per page */}
          <div className="hidden print:block">
            {data.sites.map(site => (
              <div key={site.location_id} className="print-site-page" style={{ breakInside: 'avoid' }}>
                <h2 className="text-lg font-bold mt-6" style={font}>{site.location_name} — {site.compliance_pct}%</h2>
                <p className="text-xs mb-2" style={{ color: '#86868B', ...font }}>Period: {startDate} to {endDate}</p>
                <table className="w-full text-xs mt-2" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr><th className="border p-1 text-left">Check</th><th className="border p-1 text-left">Status</th><th className="border p-1 text-left">Coverage</th><th className="border p-1 text-left">Last Record</th><th className="border p-1 text-left">Completed By</th></tr>
                  </thead>
                  <tbody>
                    {data.check_types.map(c => {
                      const ch = site.checks[c.key];
                      return (
                        <tr key={c.key}>
                          <td className="border p-1">{c.label}</td>
                          <td className="border p-1">{STATUS_META[ch.status].label}</td>
                          <td className="border p-1">{ch.actual_periods}/{ch.expected} ({ch.pct}%)</td>
                          <td className="border p-1">{fmtDate(ch.last_date)}</td>
                          <td className="border p-1">{ch.last_by || '—'}</td>
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
        <div className="fixed inset-0 z-50 print:hidden" data-testid="detail-drawer">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setDetail(null)} />
          <div className="absolute right-0 top-0 bottom-0 w-full sm:w-[520px] overflow-y-auto" style={{ background: '#F5F5F7' }}>
            <div className="sticky top-0 z-10 px-5 py-4 flex items-center justify-between" style={{ background: '#FFFFFF', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <div className="min-w-0">
                <p className="text-xs font-medium" style={{ color: '#86868B', ...font }}>{detail.location_name}</p>
                <h2 className="text-lg font-semibold truncate" style={{ color: '#1D1D1F', ...font }}>{detail.label}</h2>
              </div>
              <button onClick={() => setDetail(null)} className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-95" style={{ background: '#F5F5F7' }}>
                <X size={15} style={{ color: '#1D1D1F' }} />
              </button>
            </div>
            <div className="p-5 space-y-2">
              {detailLoading ? (
                <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>
              ) : detail.entries.length === 0 ? (
                <div className="text-center py-10 rounded-2xl" style={{ background: '#FFFFFF' }}>
                  <p className="text-sm" style={{ color: '#86868B', ...font }}>No entries in this period.</p>
                </div>
              ) : detail.entries.map((e, i) => {
                const dateVal = e.date || e.week_ending;
                const by = e.completed_by_name || e.created_by_name || e.completed_by || e.created_by || '—';
                const pass = e.passed ?? (e.passed_items != null && e.total_items != null ? e.passed_items === e.total_items : null);
                const summary = [];
                if (e.food_item) summary.push(e.food_item);
                if (e.supplier) summary.push(e.supplier);
                if (e.probe_no) summary.push(`Probe ${e.probe_no}`);
                if (e.location_of_test) summary.push(e.location_of_test);
                if (e.unit_id) summary.push(e.unit_id);
                if (e.temp_c != null) summary.push(`${e.temp_c}°C`);
                if (e.temperature != null) summary.push(`${e.temperature}°C`);
                if (e.passed_items != null && e.total_items != null) summary.push(`${e.passed_items}/${e.total_items} checks`);
                if (e.passed_cells != null && e.total_cells != null) summary.push(`${e.passed_cells}/${e.total_cells} cells`);
                return (
                  <div key={e.id || i} className="p-4 rounded-2xl" style={{ background: '#FFFFFF' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold" style={{ color: '#1D1D1F', ...font }}>{fmtDate(dateVal)}</span>
                      {pass != null && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md" style={{ background: pass ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)', color: pass ? '#34C759' : '#FF3B30' }}>
                          {pass ? 'PASS' : 'FAIL'}
                        </span>
                      )}
                    </div>
                    {summary.length > 0 && <p className="text-xs mb-1" style={{ color: '#3A3A3C', ...font }}>{summary.join(' · ')}</p>}
                    <p className="text-[11px]" style={{ color: '#86868B', ...font }}>By {by}</p>
                    {(e.note || e.quality_comments || e.action_taken || e.comments) && (
                      <p className="text-[11px] mt-2 px-2 py-1.5 rounded-lg" style={{ background: '#F5F5F7', color: '#FF9500', ...font }}>
                        ⚠ {e.note || e.quality_comments || e.action_taken || e.comments}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          html, body { background: white !important; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; font-size: 8px !important; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          .print\\:inline { display: inline !important; }
          /* Force matrix scroll-wrapper to expand so the full table prints */
          .overflow-x-auto { overflow: visible !important; }
          table { width: 100% !important; page-break-inside: auto; font-size: 7.5px !important; table-layout: fixed; min-width: 0 !important; }
          th, td { padding: 2px 3px !important; word-break: break-word; line-height: 1.15 !important; }
          th { font-size: 7px !important; }
          /* Compact status pills in matrix cells */
          button { background: transparent !important; padding: 0 !important; font-size: 7px !important; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          /* Each per-site detailed breakdown starts on its own page */
          .print-site-page { page-break-before: always; break-before: page; }
          .print-site-page:first-child { page-break-before: auto; break-before: auto; }
          .print-site-page table { font-size: 9px !important; }
          .print-site-page th, .print-site-page td { padding: 3px 4px !important; }
          h1 { font-size: 16px !important; }
          h2 { font-size: 12px !important; margin-top: 8px !important; }
          h1, h2 { page-break-after: avoid; }
        }
      `}</style>
    </div>
  );
};

export default AdminCompliance;
