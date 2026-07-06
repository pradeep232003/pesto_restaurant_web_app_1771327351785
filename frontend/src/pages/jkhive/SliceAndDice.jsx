import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Download, Filter, TrendingUp, TrendingDown } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';

const FONT = { fontFamily: 'Outfit, sans-serif' };
const fmtGBP = (n) => `£${Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtGBP2 = (n) => `£${Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtNum = (n) => Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 1 });
const fmtPct = (n) => `${Number(n || 0).toFixed(1)}%`;
const todayIso = () => new Date().toISOString().slice(0, 10);
const daysAgoIso = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

const PRESETS = [
  { id: 7, label: '7d' },
  { id: 30, label: '30d' },
  { id: 90, label: '90d' },
  { id: 365, label: '1y' },
];

// Each column definition drives BOTH the header AND how the value is
// rendered/sorted. Group ("ops" | "comp") drives the section colour band.
const COLUMNS = [
  { key: 'location_name', label: 'Site', group: 'label', width: 200, fmt: v => v, align: 'left' },
  { key: 'sales_total',   label: 'Sales',        group: 'ops',  fmt: fmtGBP },
  { key: 'invoices_total',label: 'Invoices £',   group: 'ops',  fmt: fmtGBP },
  { key: 'stock_spend',   label: 'Stock spend',  group: 'ops',  fmt: fmtGBP },
  { key: 'orders_count',  label: 'Orders',       group: 'ops',  fmt: fmtNum },
  { key: 'staff_hours',   label: 'Staff hrs',    group: 'ops',  fmt: fmtNum },
  { key: 'labour_pct',    label: 'Labour %',     group: 'ops',  fmt: fmtPct, tone: (v) => v > 30 ? '#FF3B30' : v > 25 ? '#FF9500' : '#34C759' },
  { key: 'daily_check_pct',  label: 'Daily checks', group: 'comp', fmt: fmtPct, tone: (v) => v >= 90 ? '#34C759' : v >= 70 ? '#FF9500' : '#FF3B30' },
  { key: 'closedown_pct',    label: 'Closedown',    group: 'comp', fmt: fmtPct, tone: (v) => v >= 90 ? '#34C759' : v >= 70 ? '#FF9500' : '#FF3B30' },
  { key: 'temp_logs_count',  label: 'Temp logs',    group: 'comp', fmt: fmtNum },
  { key: 'daily_clean_pct',  label: 'Cleaning D',   group: 'comp', fmt: fmtPct, tone: (v) => v >= 90 ? '#34C759' : v >= 70 ? '#FF9500' : '#FF3B30' },
  { key: 'weekly_clean_pct', label: 'Cleaning W',   group: 'comp', fmt: fmtPct, tone: (v) => v >= 90 ? '#34C759' : v >= 70 ? '#FF9500' : '#FF3B30' },
  { key: 'compliance_score', label: 'Compliance',   group: 'comp', fmt: fmtPct, tone: (v) => v >= 90 ? '#34C759' : v >= 70 ? '#FF9500' : '#FF3B30', bold: true },
];

const csvEscape = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const SliceAndDice = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAuth();
  const { locations } = useLocation2();

  const [selected, setSelected] = useState([]); // location_ids; [] = all
  const [start, setStart] = useState(daysAgoIso(30));
  const [end, setEnd] = useState(todayIso());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [sortBy, setSortBy] = useState('sales_total');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    if (!authLoading && !isAdmin) navigate('/jkhive');
  }, [authLoading, isAdmin, navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setErr('');
      try {
        const res = await api.sliceAndDice({ locations: selected, start, end });
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setErr(e.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selected, start, end]);

  const rows = useMemo(() => {
    const list = (data?.rows || []).slice();
    list.sort((a, b) => {
      const va = a[sortBy]; const vb = b[sortBy];
      if (typeof va === 'string') return (sortDir === 'asc' ? 1 : -1) * String(va).localeCompare(String(vb));
      return (sortDir === 'asc' ? 1 : -1) * ((vb || 0) - (va || 0));
    });
    return list;
  }, [data, sortBy, sortDir]);

  const setPreset = (days) => {
    setStart(daysAgoIso(days));
    setEnd(todayIso());
  };

  const toggleLoc = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const clearFilters = () => { setSelected([]); setPreset(30); };

  const downloadCsv = () => {
    if (!data) return;
    const header = COLUMNS.map(c => c.label);
    const lines = [header.join(',')];
    [...rows, data.totals].forEach(r => {
      lines.push(COLUMNS.map(c => csvEscape(r[c.key])).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `slice-and-dice-${start}-to-${end}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const sortIcon = (key) => sortBy !== key ? null :
    (sortDir === 'desc' ? <TrendingDown size={11} style={{ marginLeft: 3 }} /> : <TrendingUp size={11} style={{ marginLeft: 3 }} />);

  const clickHeader = (key) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  return (
    <div data-testid="slice-dice-page" style={{ paddingBottom: 24, ...FONT }}>
      <button data-testid="sd-back" onClick={() => navigate('/jkhive/manager')}
        style={{ background: 'none', border: 0, color: '#007AFF', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginBottom: 12, ...FONT }}>
        <ArrowLeft size={16} /> Back
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1D1D1F', margin: 0, letterSpacing: '-0.02em' }}>Slice & Dice</h1>
          <p style={{ fontSize: 13, color: '#86868B', margin: '2px 0 0' }}>
            Operations + compliance drilldown · {start} → {end}
            {data && ` · ${data.period.days} days`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PRESETS.map(p => (
            <button
              key={p.id}
              data-testid={`sd-preset-${p.id}`}
              onClick={() => setPreset(p.id)}
              style={{ padding: '6px 12px', borderRadius: 999, border: '1px solid #E5E5EA', background: '#FFFFFF', fontSize: 12, fontWeight: 700, cursor: 'pointer', ...FONT }}
            >{p.label}</button>
          ))}
          <button
            data-testid="sd-export-csv"
            onClick={downloadCsv}
            disabled={!data}
            style={{ padding: '6px 12px', borderRadius: 999, border: 0, background: '#1D1D1F', color: '#FFFFFF', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, ...FONT }}
          >
            <Download size={12} /> CSV
          </button>
        </div>
      </div>

      {/* Slicers */}
      <div data-testid="sd-slicers" style={{ background: '#FFFFFF', borderRadius: 14, padding: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Filter size={12} color="#86868B" />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sites</span>
          {selected.length > 0 && (
            <button
              data-testid="sd-clear"
              onClick={clearFilters}
              style={{ marginLeft: 'auto', background: 'transparent', border: 0, color: '#007AFF', cursor: 'pointer', fontSize: 11, fontWeight: 700, ...FONT }}
            >
              Clear filters
            </button>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <button
            data-testid="sd-loc-all"
            onClick={() => setSelected([])}
            style={{
              padding: '6px 12px', borderRadius: 999,
              border: `1px solid ${selected.length === 0 ? '#1D1D1F' : '#E5E5EA'}`,
              background: selected.length === 0 ? '#1D1D1F' : '#FFFFFF',
              color: selected.length === 0 ? '#FFFFFF' : '#1D1D1F',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', ...FONT,
            }}
          >All sites</button>
          {locations.map(loc => {
            const active = selected.includes(loc.id);
            return (
              <button
                key={loc.id}
                data-testid={`sd-loc-${loc.id}`}
                onClick={() => toggleLoc(loc.id)}
                style={{
                  padding: '6px 12px', borderRadius: 999,
                  border: `1px solid ${active ? '#007AFF' : '#E5E5EA'}`,
                  background: active ? 'rgba(0,122,255,0.08)' : '#FFFFFF',
                  color: active ? '#007AFF' : '#1D1D1F',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', ...FONT,
                }}
              >{loc.name}</button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#86868B' }}>From</span>
          <input type="date" data-testid="sd-start" value={start} onChange={e => setStart(e.target.value)} style={dateInput} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#86868B' }}>To</span>
          <input type="date" data-testid="sd-end" value={end} onChange={e => setEnd(e.target.value)} style={dateInput} />
        </div>
      </div>

      {err && <div style={{ background: 'rgba(255,59,48,0.10)', color: '#C0392B', padding: '10px 12px', borderRadius: 10, fontSize: 12, marginBottom: 10 }}>{err}</div>}

      {loading && !data ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#86868B' }}>
          <Loader2 size={20} className="animate-spin" style={{ display: 'inline-block' }} /> Loading…
        </div>
      ) : data && (
        <>
          {/* Grand-total tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 12 }}>
            <SumTile label="Sales" value={fmtGBP(data.totals.sales_total)} accent="#34C759" />
            <SumTile label="Invoices" value={fmtGBP(data.totals.invoices_total)} accent="#FF9500" />
            <SumTile label="Stock spend" value={fmtGBP(data.totals.stock_spend)} accent="#5856D6" />
            <SumTile label="Orders" value={fmtNum(data.totals.orders_count)} accent="#007AFF" />
            <SumTile label="Labour %" value={fmtPct(data.totals.labour_pct)} accent="#FF3B30" />
            <SumTile label="Avg compliance" value={fmtPct(data.totals.compliance_score)} accent="#34C759" />
          </div>

          {/* Pivot table */}
          <div style={{ overflowX: 'auto', background: '#FFFFFF', borderRadius: 14, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900, fontSize: 12, ...FONT }} data-testid="sd-table">
              <thead>
                <tr>
                  {COLUMNS.map(c => (
                    <th
                      key={c.key}
                      onClick={() => clickHeader(c.key)}
                      style={{
                        padding: '10px 12px',
                        textAlign: c.align === 'left' ? 'left' : 'right',
                        background: c.group === 'ops' ? '#F8F8FA' : c.group === 'comp' ? 'rgba(52,199,89,0.06)' : '#1D1D1F',
                        color: c.group === 'label' ? '#FFFFFF' : '#1D1D1F',
                        fontWeight: 800, fontSize: 11, letterSpacing: '0.02em',
                        cursor: 'pointer', userSelect: 'none',
                        position: 'sticky', top: 0, zIndex: 1,
                        borderBottom: '1px solid #E5E5EA',
                      }}
                    >
                      {c.label}{sortIcon(c.key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.location_id} data-testid={`sd-row-${r.location_id}`}>
                    {COLUMNS.map(c => {
                      const v = r[c.key];
                      const tone = c.tone ? c.tone(v) : null;
                      return (
                        <td
                          key={c.key}
                          style={{
                            padding: '9px 12px',
                            textAlign: c.align === 'left' ? 'left' : 'right',
                            borderTop: '1px solid #F0F0F2',
                            fontVariantNumeric: 'tabular-nums',
                            color: tone || '#1D1D1F',
                            fontWeight: c.bold ? 800 : (c.align === 'left' ? 600 : 500),
                          }}
                        >
                          {c.fmt(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {/* Totals row */}
                <tr style={{ background: '#F8F8FA' }} data-testid="sd-row-total">
                  {COLUMNS.map(c => (
                    <td
                      key={c.key}
                      style={{
                        padding: '10px 12px',
                        textAlign: c.align === 'left' ? 'left' : 'right',
                        borderTop: '2px solid #1D1D1F',
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 800,
                        color: '#1D1D1F',
                      }}
                    >
                      {c.fmt(data.totals[c.key])}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

const SumTile = ({ label, value, accent }) => (
  <div style={{ background: '#FFFFFF', borderRadius: 12, padding: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', borderLeft: `3px solid ${accent}` }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 800, color: '#1D1D1F', marginTop: 2, letterSpacing: '-0.02em' }}>{value}</div>
  </div>
);

const dateInput = {
  padding: '6px 10px', borderRadius: 8, border: '1px solid #E5E5EA', background: '#FFFFFF',
  fontSize: 12, fontFamily: 'Outfit, sans-serif',
};

export default SliceAndDice;
