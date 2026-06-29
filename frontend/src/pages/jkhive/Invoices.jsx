import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Camera, X, Trash2, MapPin, Edit3, FileText, Loader2, AlertTriangle, Receipt, Plus, Search, Download, LayoutGrid, Table as TableIcon,
} from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';

const FONT = { fontFamily: 'Outfit, sans-serif' };

const fmtMoney = (v) => `£${(Number(v) || 0).toFixed(2)}`;
const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * /jkhive/invoices
 *  - Staff: scan/upload a delivery invoice with the phone camera. Claude
 *    Sonnet 4.5 (vision) extracts supplier, items, qty, unit price, VAT,
 *    total. Staff can amend before saving and see all invoices for the
 *    current location.
 *  - Admin / Super admin: can ALSO change the location (e.g. when a staff
 *    member accidentally scanned the receipt under the wrong site) and
 *    delete invoices.
 */
const Invoices = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, loading: authLoading } = useAuth();
  const { adminLocationId, locations } = useLocation2();

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // full invoice doc

  // Recent | All — view switcher. Recent = card grid scoped to the current
  // JKHive location (handover-friendly for staff). All = table for admins
  // with from/to + location filter + CSV export + spend widgets.
  const [tab, setTab] = useState('recent');

  // All-view filter state. Default end_date = today; start_date = last 30d.
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [allStart, setAllStart] = useState(monthAgo);
  const [allEnd, setAllEnd] = useState(today);
  const [allLocation, setAllLocation] = useState(''); // '' = all locations
  const [allList, setAllList] = useState([]);
  const [allLoading, setAllLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/admin-login');
  }, [authLoading, isAuthenticated, navigate]);

  const load = async () => {
    if (!adminLocationId) return;
    setLoading(true);
    try {
      const rows = await api.invoicesList({ location_id: adminLocationId });
      setList(rows || []);
    } catch (e) {
      setError(e.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [adminLocationId]);

  // Lazy-load the "All" view only when switched to (and again whenever
  // filters change). Keeps initial paint fast.
  const loadAll = async () => {
    setAllLoading(true);
    try {
      const rows = await api.invoicesList({
        location_id: allLocation || undefined,
        start_date: allStart || undefined,
        end_date: allEnd || undefined,
      });
      setAllList(rows || []);
    } catch (e) {
      setError(e.message || 'Failed to load invoices');
    } finally {
      setAllLoading(false);
    }
  };
  useEffect(() => {
    if (tab === 'all') loadAll();
  }, [tab, allStart, allEnd, allLocation]);

  return (
    <div data-testid="invoices-page" style={{ ...FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <button data-testid="invoices-back" onClick={() => navigate('/jkhive')} style={{ background: 'none', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: '#007AFF', ...FONT }}>
          <ArrowLeft size={16} /> Back
        </button>
        <div style={{ flex: 1 }} />
        <ScanButton onScanned={load} adminLocationId={adminLocationId} setBusy={setBusy} busy={busy} setError={setError} />
      </div>

      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1D1D1F', margin: '0 0 4px' }}>Invoices</h1>
      <p style={{ fontSize: 13, color: '#86868B', margin: '0 0 16px' }}>
        Snap a photo of supplier delivery invoices &amp; purchases. AI auto-extracts itemised products, prices, VAT and Total.
      </p>

      {/* Tab switcher — Recent (mobile-friendly card grid, for everyone)
          vs All (admin-only table with date range + location filter + CSV
          export). Staff never see the All tab as their job is to scan,
          not reconcile accounts. */}
      <div data-testid="invoices-tabs" style={{ display: 'inline-flex', background: '#F5F5F7', borderRadius: 12, padding: 3, marginBottom: 12 }}>
        {[{ k: 'recent', icon: LayoutGrid, label: 'Recent' }, isAdmin && { k: 'all', icon: TableIcon, label: 'All invoices' }].filter(Boolean).map(({ k, icon: Icon, label }) => (
          <button
            key={k}
            data-testid={`invoices-tab-${k}`}
            onClick={() => setTab(k)}
            style={{
              border: 0, background: tab === k ? '#FFFFFF' : 'transparent',
              boxShadow: tab === k ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              color: tab === k ? '#1D1D1F' : '#86868B',
              fontSize: 12, fontWeight: 700, padding: '7px 14px', borderRadius: 10,
              display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', ...FONT,
            }}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {tab === 'recent' && (
        <RecentView
          loading={loading}
          list={list}
          search={search}
          setSearch={setSearch}
          isAdmin={isAdmin}
          locations={locations}
          onOpen={setEditing}
        />
      )}

      {tab === 'all' && isAdmin && (
        <AllInvoicesView
          loading={allLoading}
          list={allList}
          start={allStart}
          end={allEnd}
          location={allLocation}
          locations={locations}
          setStart={setAllStart}
          setEnd={setAllEnd}
          setLocation={setAllLocation}
          isAdmin={isAdmin}
          onOpen={setEditing}
        />
      )}

      {error && (
        <div data-testid="invoices-error" style={{ background: 'rgba(255,59,48,0.08)', borderRadius: 12, padding: '10px 12px', marginTop: 12, color: '#C0392B', fontSize: 12, ...FONT, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <AlertTriangle size={14} /> <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 0, color: '#C0392B', cursor: 'pointer' }}><X size={14} /></button>
        </div>
      )}

      {editing && (
        <InvoiceModal
          invoice={editing}
          isAdmin={isAdmin}
          locations={locations}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
};

/** Toolbar Scan button — kicks off a file pick. On mobile this opens
 *  the OS camera picker because of `capture="environment"`. */
const ScanButton = ({ adminLocationId, setBusy, busy, setError, onScanned }) => {
  const ref = useRef(null);
  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!adminLocationId) {
      setError('Pick a location first');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('location_id', adminLocationId);
      await api.invoiceScan(fd);
      await onScanned();
    } catch (err) {
      setError(err.message || 'Scan failed');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <input ref={ref} data-testid="invoices-file-input" type="file" accept="image/*,application/pdf" capture="environment" hidden onChange={onPick} />
      <button
        data-testid="invoices-scan-btn"
        onClick={() => ref.current?.click()}
        disabled={busy || !adminLocationId}
        style={{
          padding: '8px 14px', borderRadius: 999, border: 0,
          background: 'linear-gradient(135deg, #34C759 0%, #007AFF 100%)',
          color: '#FFFFFF', fontSize: 13, fontWeight: 700,
          cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1,
          display: 'inline-flex', alignItems: 'center', gap: 6, ...FONT,
        }}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
        {busy ? 'Reading…' : 'Scan Invoice'}
      </button>
    </>
  );
};

/** Recent view — card grid scoped to the current JKHive location. Same
 *  search filter as before so staff can still skim a supplier name. */
const RecentView = ({ loading, list, search, setSearch, isAdmin, locations, onOpen }) => {
  const filtered = list.filter(r =>
    !search ? true
      : (r.supplier || '').toLowerCase().includes(search.toLowerCase())
        || (r.invoice_number || '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: 12, color: '#86868B' }} />
        <input
          data-testid="invoices-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search supplier or invoice #"
          style={{ width: '100%', padding: '10px 12px 10px 32px', borderRadius: 12, border: 0, background: '#FFFFFF', boxShadow: '0 0 0 1px rgba(0,0,0,0.06)', fontSize: 13, ...FONT }}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="animate-spin" size={20} color="#86868B" /></div>
      ) : filtered.length === 0 ? (
        <div data-testid="invoices-empty" style={{ background: '#FFFFFF', borderRadius: 14, padding: 32, textAlign: 'center', color: '#86868B', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <Receipt size={28} color="#C7C7CC" style={{ margin: '0 auto 8px' }} />
          <p style={{ fontSize: 14, margin: 0 }}>No invoices yet for this location.</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>Tap &quot;Scan Invoice&quot; to snap one with your camera.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {filtered.map(r => (
            <InvoiceCard
              key={r.id}
              invoice={r}
              isAdmin={isAdmin}
              locations={locations}
              onOpen={() => onOpen(r)}
            />
          ))}
        </div>
      )}
    </>
  );
};

/** All Invoices view — table + filters + widgets + CSV download. Primarily
 *  for admins to share monthly spend with their accountant. */
const AllInvoicesView = ({ loading, list, start, end, location, locations, setStart, setEnd, setLocation, isAdmin, onOpen }) => {
  const stats = useMemo(() => {
    const count = list.length;
    const totalSpend = list.reduce((a, r) => a + (Number(r.total) || 0), 0);
    const totalVat = list.reduce((a, r) => a + (Number(r.vat) || 0), 0);
    const totalSubtotal = totalSpend - totalVat;
    const avg = count ? totalSpend / count : 0;
    const bySupplier = list.reduce((acc, r) => {
      const k = (r.supplier || '—').trim() || '—';
      acc[k] = (acc[k] || 0) + (Number(r.total) || 0);
      return acc;
    }, {});
    const topSupplier = Object.entries(bySupplier).sort((a, b) => b[1] - a[1])[0];
    return { count, totalSpend, totalVat, totalSubtotal, avg, topSupplier };
  }, [list]);

  const locName = (id) => locations.find(l => l.id === id)?.name || id;

  // Quote-safe CSV cell — RFC4180.
  const csvCell = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const downloadCsv = (filename, rows) => {
    const csv = rows.map(row => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    // Summary CSV — one row per invoice. For the accountant.
    const rows = [
      ['Date', 'Uploaded', 'Supplier', 'Invoice #', 'Location', 'Subtotal £', 'VAT £', 'Total £', 'Items', 'AI status', 'Note'],
      ...list.map(r => [
        r.invoice_date || '',
        (r.uploaded_at || '').slice(0, 10),
        r.supplier || '',
        r.invoice_number || '',
        locName(r.location_id),
        ((Number(r.total) || 0) - (Number(r.vat) || 0)).toFixed(2),
        (Number(r.vat) || 0).toFixed(2),
        (Number(r.total) || 0).toFixed(2),
        (r.items || []).length,
        r.ai_status || '',
        (r.note || '').replace(/[\r\n]+/g, ' '),
      ]),
    ];
    downloadCsv(`invoices_${start || 'all'}_to_${end || 'today'}.csv`, rows);
  };

  // Detailed CSV — one row per line item with the parent invoice metadata
  // repeated on each row. Perfect for local stocktake / item-level
  // analysis (qty × unit price × supplier × location pivots).
  const handleExportDetailed = () => {
    const rows = [[
      'Date', 'Supplier', 'Invoice #', 'Location',
      'Item #', 'Description', 'Qty', 'Unit £', 'Line Total £',
      'Invoice Subtotal £', 'Invoice VAT £', 'Invoice Total £',
      'AI status', 'Uploaded by', 'Uploaded at',
    ]];
    for (const r of list) {
      const items = Array.isArray(r.items) ? r.items : [];
      const sharedHead = [
        r.invoice_date || '',
        r.supplier || '',
        r.invoice_number || '',
        locName(r.location_id),
      ];
      const sharedFoot = [
        ((Number(r.total) || 0) - (Number(r.vat) || 0)).toFixed(2),
        (Number(r.vat) || 0).toFixed(2),
        (Number(r.total) || 0).toFixed(2),
        r.ai_status || '',
        r.uploaded_by_name || r.uploaded_by || '',
        (r.uploaded_at || '').slice(0, 19).replace('T', ' '),
      ];
      if (items.length === 0) {
        // Still emit a row so the invoice isn't dropped from the detailed
        // export — useful for spotting AI-failed scans missing items.
        rows.push([...sharedHead, '', '(no items extracted)', '', '', '', ...sharedFoot]);
      } else {
        items.forEach((it, i) => {
          rows.push([
            ...sharedHead,
            i + 1,
            it.description || '',
            (Number(it.qty) || 0).toString(),
            (Number(it.unit_price) || 0).toFixed(2),
            (Number(it.line_total) || 0).toFixed(2),
            ...sharedFoot,
          ]);
        });
      }
    }
    downloadCsv(`invoices_items_${start || 'all'}_to_${end || 'today'}.csv`, rows);
  };

  return (
    <>
      <div data-testid="invoices-all-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'flex-end' }}>
        <FilterField label="From">
          <input data-testid="invoices-all-from" type="date" value={start} onChange={e => setStart(e.target.value)} style={dateInput} />
        </FilterField>
        <FilterField label="To">
          <input data-testid="invoices-all-to" type="date" value={end} onChange={e => setEnd(e.target.value)} style={dateInput} />
        </FilterField>
        <FilterField label="Location">
          <select data-testid="invoices-all-location" value={location} onChange={e => setLocation(e.target.value)} style={{ ...dateInput, minWidth: 160 }}>
            <option value="">All locations</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </FilterField>
        <div style={{ flex: 1 }} />
        <button
          data-testid="invoices-export-csv"
          onClick={handleExport}
          disabled={list.length === 0}
          title="Summary CSV (one row per invoice) — send to your accountant"
          style={{
            padding: '8px 14px', borderRadius: 999, border: 0,
            background: list.length === 0 ? '#E5E5EA' : '#1D1D1F',
            color: list.length === 0 ? '#86868B' : '#FFFFFF',
            fontSize: 12, fontWeight: 700, cursor: list.length === 0 ? 'not-allowed' : 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6, ...FONT,
          }}
        >
          <Download size={13} /> Download CSV
        </button>
        <button
          data-testid="invoices-export-all-csv"
          onClick={handleExportDetailed}
          disabled={list.length === 0}
          title="Detailed CSV (one row per line item, with qty + prices) — for stocktake & local analysis"
          style={{
            padding: '8px 14px', borderRadius: 999, border: 0,
            background: list.length === 0 ? '#E5E5EA' : '#5856D6',
            color: list.length === 0 ? '#86868B' : '#FFFFFF',
            fontSize: 12, fontWeight: 700, cursor: list.length === 0 ? 'not-allowed' : 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6, ...FONT,
          }}
        >
          <Download size={13} /> Download all CSV
        </button>
      </div>

      <div data-testid="invoices-widgets" style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: 14 }}>
        <Widget testId="widget-total-spend" label="Total Purchases" value={fmtMoney(stats.totalSpend)} accent="#1D1D1F" sub={`${stats.count} invoice${stats.count === 1 ? '' : 's'}`} />
        <Widget testId="widget-vat" label="VAT" value={fmtMoney(stats.totalVat)} accent="#FF9500" sub="Reclaimable" />
        <Widget testId="widget-net" label="Net (ex VAT)" value={fmtMoney(stats.totalSubtotal)} accent="#34C759" sub="Sub-total" />
        <Widget testId="widget-avg" label="Avg Invoice" value={fmtMoney(stats.avg)} accent="#5856D6" sub="Per scan" />
        {stats.topSupplier && (
          <Widget
            testId="widget-top-supplier"
            label="Top Supplier"
            value={stats.topSupplier[0].length > 18 ? stats.topSupplier[0].slice(0, 18) + '…' : stats.topSupplier[0]}
            accent="#007AFF"
            sub={fmtMoney(stats.topSupplier[1])}
          />
        )}
      </div>

      <div data-testid="invoices-all-table-wrap" style={{ background: '#FFFFFF', borderRadius: 14, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        {loading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="animate-spin" size={20} color="#86868B" /></div>
        ) : list.length === 0 ? (
          <p style={{ padding: 32, textAlign: 'center', color: '#86868B', fontSize: 13, ...FONT, margin: 0 }}>
            No invoices in this date range.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table data-testid="invoices-all-table" style={{ width: '100%', borderCollapse: 'collapse', ...FONT }}>
              <thead style={{ background: '#FAFAFC' }}>
                <tr>
                  {['Date', 'Supplier', 'Invoice #', 'Location', 'Items', 'Net £', 'VAT £', 'Total £', ''].map(h => (
                    <th key={h} style={{ textAlign: h.endsWith('£') || h === 'Items' ? 'right' : 'left', padding: '10px 12px', fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #ECECEF', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map(r => {
                  const net = (Number(r.total) || 0) - (Number(r.vat) || 0);
                  return (
                    <tr key={r.id} data-testid={`invoices-all-row-${r.id}`} style={{ borderBottom: '1px solid #F2F2F4' }}>
                      <td style={td}>{r.invoice_date || (r.uploaded_at || '').slice(0, 10)}</td>
                      <td style={{ ...td, fontWeight: 600, color: '#1D1D1F' }}>{r.supplier || '—'}</td>
                      <td style={td}>{r.invoice_number || '—'}</td>
                      <td style={td}>{locName(r.location_id)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{(r.items || []).length}</td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(net)}</td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#86868B' }}>{fmtMoney(r.vat)}</td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: '#1D1D1F' }}>{fmtMoney(r.total)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <button
                          data-testid={`invoices-all-open-${r.id}`}
                          onClick={() => onOpen(r)}
                          style={{ border: 0, background: '#F5F5F7', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#1D1D1F', ...FONT }}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#FAFAFC' }}>
                  <td style={{ ...td, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', fontSize: 10 }} colSpan={5}>Totals</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(stats.totalSubtotal)}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#FF9500' }}>{fmtMoney(stats.totalVat)}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#1D1D1F' }}>{fmtMoney(stats.totalSpend)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
      {!isAdmin && (
        <p style={{ marginTop: 8, fontSize: 11, color: '#86868B', textAlign: 'center' }}>
          Read-only — only an Admin can change a row&apos;s location or delete it.
        </p>
      )}
    </>
  );
};

const td = { padding: '10px 12px', fontSize: 12, color: '#3A3A3C', whiteSpace: 'nowrap' };
const dateInput = {
  padding: '7px 10px', borderRadius: 10, border: 0, background: '#FFFFFF',
  boxShadow: '0 0 0 1px rgba(0,0,0,0.06)', fontSize: 12, fontFamily: 'Outfit, sans-serif',
};

const FilterField = ({ label, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
    <span style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
    {children}
  </label>
);

const Widget = ({ testId, label, value, accent, sub }) => (
  <div data-testid={testId} style={{ background: '#FFFFFF', borderRadius: 12, padding: '12px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', borderLeft: `3px solid ${accent}`, ...FONT }}>
    <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
    <p style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 700, color: '#1D1D1F', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
    {sub && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#86868B' }}>{sub}</p>}
  </div>
);


const InvoiceCard = ({ invoice, locations, onOpen }) => {
  const loc = locations.find(l => l.id === invoice.location_id);
  const failed = invoice.ai_status === 'failed';
  return (
    <button
      data-testid={`invoice-card-${invoice.id}`}
      onClick={onOpen}
      style={{
        textAlign: 'left', background: '#FFFFFF', borderRadius: 14, padding: 14,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)', border: 0, cursor: 'pointer', ...FONT,
        display: 'flex', flexDirection: 'column', gap: 6,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#1D1D1F', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {invoice.supplier || (failed ? 'Untitled · AI failed' : 'Untitled supplier')}
          </p>
          <p style={{ fontSize: 11, color: '#86868B', margin: '2px 0 0' }}>
            {invoice.invoice_number ? `#${invoice.invoice_number} · ` : ''}{fmtDate(invoice.invoice_date || invoice.uploaded_at)}
          </p>
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#1D1D1F' }}>{fmtMoney(invoice.total)}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#86868B' }}>
        <MapPin size={11} /> {loc?.name || invoice.location_id}
        <span>·</span>
        <span>{(invoice.items || []).length} items</span>
        {invoice.vat > 0 && <><span>·</span><span>VAT {fmtMoney(invoice.vat)}</span></>}
        {failed && (
          <span style={{ marginLeft: 'auto', background: 'rgba(255,149,0,0.15)', color: '#A35E00', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
            AI failed
          </span>
        )}
      </div>
    </button>
  );
};

/** Detail / edit drawer. Admin can change location, edit fields, delete.
 *  Staff get a read-only view with the photo + line items. */
const InvoiceModal = ({ invoice: initial, isAdmin, locations, onClose, onSaved }) => {
  // Defensive normalisation — when an AI-failed scan opens the modal the
  // invoice_date can be '' or any free-form string. <input type="date">
  // requires either '' or 'YYYY-MM-DD' so coerce anything else to ''.
  const safeDate = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
  const [invoice, setInvoice] = useState({
    ...initial,
    invoice_date: safeDate(initial?.invoice_date),
    items: Array.isArray(initial?.items) ? initial.items : [],
  });
  const safeLocations = Array.isArray(locations) ? locations : [];
  const [editingFields, setEditingFields] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Fetch the image as a blob URL so the <img> tag carries the auth header
  // (cross-origin <img src> does NOT send Bearer tokens).
  const [fileUrl, setFileUrl] = useState('');
  useEffect(() => {
    let revoke = '';
    let cancelled = false;
    (async () => {
      try {
        const url = await api.invoiceFileBlobUrl(invoice.id);
        if (cancelled) URL.revokeObjectURL(url);
        else { setFileUrl(url); revoke = url; }
      } catch { /* leave fileUrl '' — preview just won't render */ }
    })();
    return () => { cancelled = true; if (revoke) URL.revokeObjectURL(revoke); };
  }, [invoice.id]);

  const save = async () => {
    setBusy(true);
    setErr('');
    try {
      const payload = {
        location_id: invoice.location_id,
        supplier: invoice.supplier,
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        subtotal: Number(invoice.subtotal) || 0,
        vat: Number(invoice.vat) || 0,
        total: Number(invoice.total) || 0,
        items: (invoice.items || []).map(it => ({
          description: it.description || '',
          qty: Number(it.qty) || 0,
          unit_price: Number(it.unit_price) || 0,
          line_total: Number(it.line_total) || 0,
        })),
        note: invoice.note || '',
      };
      await api.invoiceUpdate(invoice.id, payload);
      onSaved();
    } catch (e) {
      setErr(e.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this invoice? This cannot be undone.')) return;
    setBusy(true);
    try {
      await api.invoiceDelete(invoice.id);
      onSaved();
    } catch (e) {
      setErr(e.message || 'Delete failed');
      setBusy(false);
    }
  };

  const setField = (k, v) => setInvoice(prev => ({ ...prev, [k]: v }));
  const setItem = (idx, k, v) => setInvoice(prev => {
    const items = [...(prev.items || [])];
    items[idx] = { ...items[idx], [k]: v };
    return { ...prev, items };
  });
  const addItem = () => setInvoice(prev => ({ ...prev, items: [...(prev.items || []), { description: '', qty: 1, unit_price: 0, line_total: 0 }] }));
  const removeItem = (idx) => setInvoice(prev => ({ ...prev, items: (prev.items || []).filter((_, i) => i !== idx) }));

  const canEditAll = isAdmin || editingFields;

  return (
    <div data-testid="invoice-modal" style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
      <div style={{
        position: 'relative', background: '#FFFFFF', width: '100%', maxWidth: 720,
        borderRadius: '20px 20px 0 0', padding: '18px 18px 24px', maxHeight: '92vh',
        overflowY: 'auto', ...FONT,
        // Reserve room under the action row so the persistent JKHive footer
        // nav (fixed bottom, ~72px) cannot intercept clicks on Save/Delete.
        paddingBottom: 'calc(24px + env(safe-area-inset-bottom) + 84px)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>Invoice</p>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1D1D1F', margin: '2px 0 0' }}>
              {invoice.supplier || 'Untitled'}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {!isAdmin && !editingFields && (
              <button data-testid="invoice-edit-toggle" onClick={() => setEditingFields(true)}
                style={{ width: 32, height: 32, borderRadius: 999, background: '#F5F5F7', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Edit3 size={14} color="#1D1D1F" />
              </button>
            )}
            <button onClick={onClose} aria-label="Close"
              style={{ width: 32, height: 32, borderRadius: 999, background: '#F5F5F7', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={15} color="#1D1D1F" />
            </button>
          </div>
        </div>

        {invoice.ai_status === 'failed' && (
          <div style={{ background: 'rgba(255,149,0,0.12)', borderRadius: 12, padding: '8px 10px', marginBottom: 12, fontSize: 12, color: '#A35E00' }}>
            AI couldn&apos;t read this invoice — fill in the fields manually.
            {invoice.ai_error && <span style={{ display: 'block', marginTop: 2, opacity: 0.8 }}>{invoice.ai_error}</span>}
          </div>
        )}

        {/* Photo preview */}
        <div style={{ marginBottom: 12, borderRadius: 12, overflow: 'hidden', background: '#F5F5F7' }}>
          {!fileUrl ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#86868B', fontSize: 12 }}>Loading image…</div>
          ) : (invoice.content_type || '').startsWith('image/') ? (
            <img data-testid="invoice-image" src={fileUrl} alt="Invoice" style={{ display: 'block', width: '100%', maxHeight: 360, objectFit: 'contain' }} />
          ) : (
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 14, color: '#007AFF', fontSize: 13 }}>
              <FileText size={16} /> Open original PDF
            </a>
          )}
        </div>

        {/* Header fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <Field label="Supplier" value={invoice.supplier} onChange={(v) => setField('supplier', v)} disabled={!canEditAll} testId="invoice-supplier" />
          <Field label="Invoice #" value={invoice.invoice_number} onChange={(v) => setField('invoice_number', v)} disabled={!canEditAll} testId="invoice-number" />
          <Field label="Date" type="date" value={invoice.invoice_date} onChange={(v) => setField('invoice_date', v)} disabled={!canEditAll} testId="invoice-date" />
          {/* Only admins can change the location (the user's hard requirement). */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Location</label>
            <select
              data-testid="invoice-location-select"
              value={invoice.location_id || ''}
              onChange={(e) => setField('location_id', e.target.value)}
              disabled={!isAdmin}
              style={{
                marginTop: 2, width: '100%', padding: '8px 10px', borderRadius: 10, border: 0,
                background: isAdmin ? '#FFFFFF' : '#F5F5F7', boxShadow: '0 0 0 1px rgba(0,0,0,0.06)',
                fontSize: 13, ...FONT, cursor: isAdmin ? 'pointer' : 'not-allowed',
              }}>
              {safeLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        </div>

        {/* Line items */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>Line Items</p>
            {canEditAll && (
              <button data-testid="invoice-add-item" onClick={addItem} style={{ border: 0, background: 'transparent', color: '#007AFF', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Plus size={12} /> Add row
              </button>
            )}
          </div>
          <div style={{ background: '#F9F9FB', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 60px 80px 80px 28px', gap: 6, padding: '6px 8px', fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <span>Description</span><span>Qty</span><span>Unit £</span><span>Total £</span><span></span>
            </div>
            {(invoice.items || []).length === 0 && (
              <p style={{ padding: 10, margin: 0, textAlign: 'center', fontSize: 12, color: '#86868B' }}>No items yet</p>
            )}
            {(invoice.items || []).map((it, i) => (
              <div key={i} data-testid={`invoice-item-${i}`} style={{ display: 'grid', gridTemplateColumns: '2fr 60px 80px 80px 28px', gap: 6, padding: '4px 8px', alignItems: 'center', borderTop: '1px solid #ECECEF' }}>
                <input value={it.description || ''} onChange={(e) => setItem(i, 'description', e.target.value)} disabled={!canEditAll} placeholder="Item" style={inputStyle(canEditAll)} />
                <input type="number" step="0.001" value={it.qty ?? ''} onChange={(e) => setItem(i, 'qty', e.target.value)} disabled={!canEditAll} style={inputStyle(canEditAll)} />
                <input type="number" step="0.01" value={it.unit_price ?? ''} onChange={(e) => setItem(i, 'unit_price', e.target.value)} disabled={!canEditAll} style={inputStyle(canEditAll)} />
                <input type="number" step="0.01" value={it.line_total ?? ''} onChange={(e) => setItem(i, 'line_total', e.target.value)} disabled={!canEditAll} style={inputStyle(canEditAll)} />
                {canEditAll ? (
                  <button data-testid={`invoice-remove-item-${i}`} onClick={() => removeItem(i)} aria-label="Remove" style={{ background: 'transparent', border: 0, cursor: 'pointer', color: '#FF3B30' }}>
                    <Trash2 size={13} />
                  </button>
                ) : <span />}
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
          <Field label="Subtotal £" type="number" step="0.01" value={invoice.subtotal} onChange={(v) => setField('subtotal', v)} disabled={!canEditAll} testId="invoice-subtotal" />
          <Field label="VAT £" type="number" step="0.01" value={invoice.vat} onChange={(v) => setField('vat', v)} disabled={!canEditAll} testId="invoice-vat" />
          <Field label="Total £" type="number" step="0.01" value={invoice.total} onChange={(v) => setField('total', v)} disabled={!canEditAll} testId="invoice-total" />
        </div>

        {err && <p data-testid="invoice-modal-error" style={{ color: '#C0392B', fontSize: 12, marginBottom: 8 }}>{err}</p>}

        <div style={{ display: 'flex', gap: 8 }}>
          {isAdmin && (
            <button data-testid="invoice-delete" onClick={remove} disabled={busy}
              style={{ padding: '10px 14px', borderRadius: 999, border: 0, background: 'rgba(255,59,48,0.10)', color: '#C0392B', fontSize: 13, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, ...FONT }}>
              <Trash2 size={13} /> Delete
            </button>
          )}
          <div style={{ flex: 1 }} />
          {canEditAll && (
            <button data-testid="invoice-save" onClick={save} disabled={busy}
              style={{ padding: '10px 18px', borderRadius: 999, border: 0, background: '#1D1D1F', color: '#FFFFFF', fontSize: 13, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1, ...FONT }}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          )}
        </div>
        {!isAdmin && (
          <p style={{ marginTop: 10, fontSize: 11, color: '#86868B', textAlign: 'center' }}>
            Only Admins can change the location or delete this invoice.
          </p>
        )}
      </div>
    </div>
  );
};

const Field = ({ label, value, onChange, disabled, testId, type = 'text', step }) => (
  <div>
    <label style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</label>
    <input
      data-testid={testId}
      type={type}
      step={step}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={inputStyle(!disabled)}
    />
  </div>
);

const inputStyle = (editable) => ({
  marginTop: 2, width: '100%', padding: '7px 10px', borderRadius: 8, border: 0,
  background: editable ? '#FFFFFF' : '#F5F5F7',
  boxShadow: '0 0 0 1px rgba(0,0,0,0.06)', fontSize: 13, ...FONT,
});

export default Invoices;
