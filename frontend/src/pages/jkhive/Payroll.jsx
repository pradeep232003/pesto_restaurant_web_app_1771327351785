import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Wallet, Download, Loader2, Filter } from 'lucide-react';
import api from '../../lib/api';
import { useLocation2 } from '../../contexts/LocationContext';

/**
 * Payroll — per-staff hours × hourly_rate for a picked window.
 *
 * Data comes from `/api/admin/payroll`. Uses the standard JKHive
 * layout (header + fixed footer) so no scroll-eating containers.
 * Filters: date range (defaults to last completed Mon-Sun), location
 * (all sites or one), staff (all or one). Include-drafts toggle so
 * admins can preview forecast pay for an in-progress week.
 */
const FONT = { fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif" };
const CARD = { background: '#FFFFFF', borderRadius: 14, padding: 14, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' };
const MONEY = (n) => `£${(Number(n) || 0).toFixed(2)}`;
const HRS = (n) => `${(Number(n) || 0).toFixed(2)}h`;

const isoDate = (d) => d.toISOString().slice(0, 10);
// Monday of the ISO week that contains `d`.
const isoMonday = (d) => {
  const c = new Date(d); const day = (c.getDay() + 6) % 7; // Mon = 0
  c.setDate(c.getDate() - day); c.setHours(0, 0, 0, 0);
  return c;
};

const Payroll = () => {
  const { adminLocationId, locations } = useLocation2();

  // Defaults: last completed Mon-Sun week.
  const [range, setRange] = useState(() => {
    const today = new Date();
    const thisMon = isoMonday(today);
    const lastSun = new Date(thisMon); lastSun.setDate(lastSun.getDate() - 1);
    const lastMon = isoMonday(lastSun);
    return { start: isoDate(lastMon), end: isoDate(lastSun) };
  });
  const [locFilter, setLocFilter] = useState(() => adminLocationId || 'all');
  const [staffFilter, setStaffFilter] = useState('all');
  const [includeDrafts, setIncludeDrafts] = useState(false);

  const [staffList, setStaffList] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [downloading, setDownloading] = useState(false);

  // Sync location filter with the header pill so switching sites via
  // the pill re-scopes the page instantly.
  useEffect(() => { if (adminLocationId) setLocFilter(adminLocationId); }, [adminLocationId]);

  // Load staff list once for the dropdown. Only active staff appear.
  useEffect(() => {
    let cancelled = false;
    api.staffList?.().catch(() => api.fetch('/api/admin/staff'))
      .then((rows) => {
        if (cancelled) return;
        setStaffList((rows || []).filter((s) => s.active !== false));
      })
      .catch(() => { /* silent — dropdown falls back to "All" */ });
    return () => { cancelled = true; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const res = await api.payrollSummary({
        start_date: range.start,
        end_date: range.end,
        location_id: locFilter === 'all' ? undefined : locFilter,
        staff_id: staffFilter === 'all' ? undefined : staffFilter,
        include_drafts: includeDrafts,
      });
      setData(res);
    } catch (e) {
      setErr(e.message || 'Failed to load payroll');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range.start, range.end, locFilter, staffFilter, includeDrafts]);

  useEffect(() => { load(); }, [load]);

  const downloadCsv = async () => {
    setDownloading(true);
    try {
      const blob = await api.payrollCsvDownload({
        start_date: range.start,
        end_date: range.end,
        location_id: locFilter === 'all' ? undefined : locFilter,
        staff_id: staffFilter === 'all' ? undefined : staffFilter,
        include_drafts: includeDrafts,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payroll_${locFilter}_${range.start}_to_${range.end}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e.message || 'CSV download failed');
    } finally { setDownloading(false); }
  };

  const results = data?.results || [];
  const anyDraft = useMemo(() => results.some((r) => r.any_draft), [results]);

  return (
    <div data-testid="jkhive-payroll" style={{ paddingBottom: 20, ...FONT }}>
      <Link
        to="/jkhive/manager"
        data-testid="payroll-back"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#1D1D1F', fontSize: 13, textDecoration: 'none', marginBottom: 8 }}
      >
        <ArrowLeft size={14} /> Manager
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(255,149,0,0.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <Wallet size={22} color="#FF9500" />
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 11, color: '#86868B', textTransform: 'uppercase', letterSpacing: 0.4 }}>Rotas × pay rates</p>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1D1D1F' }}>Payroll</h1>
        </div>
      </div>
      <p style={{ margin: '4px 0 12px', color: '#86868B', fontSize: 12 }}>
        Hours from Shifts × <Link to="/admin/staff" style={{ color: '#007AFF' }}>staff pay rates</Link>.
      </p>

      {/* Filters card */}
      <div style={{ ...CARD, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color: '#86868B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          <Filter size={12} /> Filters
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: '#86868B', display: 'block', marginBottom: 3 }}>From</label>
            <input
              data-testid="payroll-start"
              type="date"
              value={range.start}
              onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#86868B', display: 'block', marginBottom: 3 }}>To</label>
            <input
              data-testid="payroll-end"
              type="date"
              value={range.end}
              onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#86868B', display: 'block', marginBottom: 3 }}>Site</label>
            <select
              data-testid="payroll-location"
              value={locFilter}
              onChange={(e) => setLocFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="all">All sites</option>
              {(locations || []).map((l) => (
                <option key={l.id} value={l.id}>{l.name || l.id}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#86868B', display: 'block', marginBottom: 3 }}>Staff</label>
            <select
              data-testid="payroll-staff"
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="all">All staff</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#3A3A3C' }}>
            <input
              data-testid="payroll-include-drafts"
              type="checkbox"
              checked={includeDrafts}
              onChange={(e) => setIncludeDrafts(e.target.checked)}
            />
            Include unpublished (draft) shifts
          </label>
          <button
            data-testid="payroll-csv"
            onClick={downloadCsv}
            disabled={downloading || loading || results.length === 0}
            style={{
              marginLeft: 'auto', padding: '8px 12px', borderRadius: 999, border: 0,
              background: results.length === 0 ? '#F5F5F7' : '#1D1D1F',
              color: results.length === 0 ? '#86868B' : '#FFFFFF',
              fontSize: 12, fontWeight: 700, cursor: results.length === 0 ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6, ...FONT,
            }}
          >
            <Download size={12} /> {downloading ? 'Preparing…' : 'CSV export'}
          </button>
        </div>
      </div>

      {err && (
        <div data-testid="payroll-error" style={{ background: 'rgba(255,59,48,0.08)', color: '#C0392B', padding: 10, borderRadius: 10, fontSize: 12, marginBottom: 10 }}>
          {err}
        </div>
      )}

      {/* Totals strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
        <div style={{ ...CARD }} data-testid="payroll-total-hours">
          <p style={{ margin: 0, fontSize: 10, color: '#86868B', textTransform: 'uppercase', letterSpacing: 0.4 }}>Hours</p>
          <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: '#1D1D1F' }}>{HRS(data?.total_hours)}</p>
        </div>
        <div style={{ ...CARD }} data-testid="payroll-total-gross">
          <p style={{ margin: 0, fontSize: 10, color: '#86868B', textTransform: 'uppercase', letterSpacing: 0.4 }}>Gross pay</p>
          <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: '#1B7A35' }}>{MONEY(data?.total_gross)}</p>
        </div>
        <div style={{ ...CARD }} data-testid="payroll-staff-count">
          <p style={{ margin: 0, fontSize: 10, color: '#86868B', textTransform: 'uppercase', letterSpacing: 0.4 }}>Staff</p>
          <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: '#1D1D1F' }}>{data?.staff_count || 0}</p>
        </div>
      </div>

      {anyDraft && (
        <div style={{ background: 'rgba(255,149,0,0.10)', color: '#A35E00', padding: 8, borderRadius: 10, fontSize: 11, marginBottom: 10 }}>
          ⚠︎ Some rows include unpublished draft shifts — these figures are forecasts, not final.
        </div>
      )}

      {loading ? (
        <div style={{ ...CARD, textAlign: 'center', color: '#86868B' }}>
          <Loader2 size={16} className="animate-spin" style={{ verticalAlign: 'middle', marginRight: 6 }} /> Loading…
        </div>
      ) : results.length === 0 ? (
        <div data-testid="payroll-empty" style={{ ...CARD, textAlign: 'center', color: '#86868B', fontSize: 13 }}>
          No shifts in this window for the current filters.
        </div>
      ) : (
        <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table data-testid="payroll-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, ...FONT }}>
              <thead>
                <tr style={{ background: '#FBFBFD', color: '#86868B', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  <th style={thStyle}>Staff</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Hours</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Rate £/h</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Gross</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Shifts</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.staff_id} data-testid={`payroll-row-${r.staff_id}`} style={{ borderTop: '1px solid #F0F0F2' }}>
                    <td style={{ ...tdStyle }}>
                      <div style={{ fontWeight: 700, color: '#1D1D1F' }}>
                        {r.staff_name}
                        {r.any_draft && (
                          <span style={{ marginLeft: 6, padding: '1px 6px', background: '#FFF3E0', color: '#A35E00', fontSize: 10, borderRadius: 999, fontWeight: 700 }}>
                            DRAFT
                          </span>
                        )}
                      </div>
                      {r.employee_no && (
                        <div style={{ fontSize: 10, color: '#86868B' }}>#{r.employee_no}</div>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{HRS(r.hours)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: r.hourly_rate ? '#1D1D1F' : '#C0392B' }}>
                      {r.hourly_rate ? MONEY(r.hourly_rate) : 'no rate'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: '#1B7A35' }}>{MONEY(r.gross_pay)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: '#86868B', fontVariantNumeric: 'tabular-nums' }}>{r.shift_count}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#FBFBFD', fontWeight: 800 }}>
                  <td style={{ ...tdStyle }}>Total</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{HRS(data?.total_hours)}</td>
                  <td style={{ ...tdStyle }}></td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: '#1B7A35' }}>{MONEY(data?.total_gross)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: '#86868B' }}>{data?.shift_count || 0}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const inputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: 10, border: '1px solid #E5E5EA',
  fontSize: 12, background: '#FFFFFF', color: '#1D1D1F', ...FONT,
};
const thStyle = { padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' };
const tdStyle = { padding: '10px 12px', color: '#1D1D1F' };

export default Payroll;
