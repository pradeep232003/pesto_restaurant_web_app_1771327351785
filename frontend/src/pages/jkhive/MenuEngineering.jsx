import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Star, Zap, Puzzle, Trash2, HelpCircle, TrendingUp, Upload, X, Download, CheckCircle2, AlertTriangle } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';

const FONT = { fontFamily: 'Outfit, sans-serif' };

const QUADRANTS = [
  {
    key: 'star',
    label: 'Stars',
    emoji: '⭐',
    icon: Star,
    color: '#34C759',
    tint: 'rgba(52,199,89,0.10)',
    tagline: 'High profit + High popularity',
    action: 'Feature prominently. Maintain strict quality. Promote heavily.',
  },
  {
    key: 'plow_horse',
    label: 'Plow Horses',
    emoji: '🐎',
    icon: Zap,
    color: '#FF9500',
    tint: 'rgba(255,149,0,0.10)',
    tagline: 'Low profit + High popularity',
    action: 'Raise price slightly, tune portion, or find cheaper ingredients.',
  },
  {
    key: 'puzzle',
    label: 'Puzzles',
    emoji: '🧩',
    icon: Puzzle,
    color: '#5856D6',
    tint: 'rgba(88,86,214,0.10)',
    tagline: 'High profit + Low popularity',
    action: 'Rename it, reposition on the menu, or have servers upsell.',
  },
  {
    key: 'dog',
    label: 'Dogs',
    emoji: '🐕',
    icon: Trash2,
    color: '#FF3B30',
    tint: 'rgba(255,59,48,0.10)',
    tagline: 'Low profit + Low popularity',
    action: 'Remove from the menu. Takes up space, makes no money.',
  },
];

const PRESETS = [
  { id: 7, label: '7d' },
  { id: 30, label: '30d' },
  { id: 90, label: '90d' },
  { id: 365, label: '1y' },
];

const fmtGBP = (n) => `£${Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtUnits = (n) => Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });

/** Small chip inside a quadrant card — one row per item. */
const ItemRow = ({ item }) => (
  <div
    data-testid={`me-item-${item.id}`}
    style={{
      display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8,
      padding: '7px 10px', borderRadius: 8, background: '#FFFFFF',
      fontSize: 12, alignItems: 'center', ...FONT,
    }}
  >
    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1D1D1F', fontWeight: 600 }}>
      {item.name || '—'}
    </span>
    <span style={{ color: '#86868B', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
      {fmtUnits(item.units)} sold
    </span>
    <span style={{ color: '#1D1D1F', fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
      {fmtGBP(item.margin)}
    </span>
  </div>
);

const QuadrantCard = ({ meta, items }) => {
  const Icon = meta.icon;
  return (
    <div
      data-testid={`me-quadrant-${meta.key}`}
      style={{
        background: meta.tint, borderRadius: 16, padding: 14,
        display: 'flex', flexDirection: 'column', gap: 10, minHeight: 260,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 20 }} aria-hidden>{meta.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.01em' }}>
            {meta.label}
          </div>
          <div style={{ fontSize: 11, color: '#86868B', marginTop: 1 }}>{meta.tagline}</div>
        </div>
        <div style={{
          padding: '4px 10px', borderRadius: 999, background: meta.color, color: '#FFFFFF',
          fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <Icon size={12} /> {items.length}
        </div>
      </div>
      <div style={{
        background: 'rgba(255,255,255,0.5)', borderRadius: 10, padding: 8,
        border: `1px dashed ${meta.color}55`, fontSize: 11, color: '#3A3A3C',
      }}>
        <strong style={{ color: meta.color }}>Action:</strong> {meta.action}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 340, overflowY: 'auto' }}>
        {items.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: '#86868B', fontSize: 12 }}>No items in this quadrant.</div>
        ) : (
          items.map(it => <ItemRow key={it.id} item={it} />)
        )}
      </div>
    </div>
  );
};

const MenuEngineering = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAuth();
  const { adminLocationId, locations } = useLocation2();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [showHelp, setShowHelp] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadReport, setUploadReport] = useState(null);
  const [uploadErr, setUploadErr] = useState('');
  const uploadRef = useRef(null);

  useEffect(() => {
    if (!authLoading && !isAdmin) navigate('/jkhive');
  }, [authLoading, isAdmin, navigate]);

  const reload = async () => {
    if (!adminLocationId) return;
    setLoading(true); setErr('');
    try {
      const res = await api.biMenuEngineering({ location_id: adminLocationId, days });
      setData(res);
    } catch (e) {
      setErr(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!adminLocationId) return;
    let cancelled = false;
    (async () => {
      setLoading(true); setErr('');
      try {
        const res = await api.biMenuEngineering({ location_id: adminLocationId, days });
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setErr(e.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [adminLocationId, days]);

  // Download the XLSX template with a fetch (so the Bearer token is sent)
  // and hand it to the browser via a temporary anchor + object URL.
  const downloadTemplate = async () => {
    try {
      const tok = localStorage.getItem('access_token');
      const res = await fetch(`${api.biMenuEngineeringTemplateUrl()}`, {
        headers: tok ? { Authorization: `Bearer ${tok}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'menu-engineering-sales-template.xlsx';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setErr(e.message || 'Template download failed');
    }
  };

  const onUploadPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!adminLocationId) { setUploadErr('Pick a location first'); return; }
    setUploadBusy(true); setUploadErr(''); setUploadReport(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('location_id', adminLocationId);
      const report = await api.biMenuEngineeringUpload(fd);
      setUploadReport(report);
      // Refresh the analysis so new sales flow into the quadrants.
      await reload();
    } catch (ex) {
      setUploadErr(ex.message || 'Upload failed');
    } finally {
      setUploadBusy(false);
    }
  };

  // Bucket items by quadrant.
  const byQuadrant = useMemo(() => {
    const out = { star: [], plow_horse: [], puzzle: [], dog: [], uncategorised: [] };
    for (const it of (data?.items || [])) {
      (out[it.quadrant] || out.uncategorised).push(it);
    }
    // Within a quadrant, sort by revenue desc so the top earners land first.
    for (const k of Object.keys(out)) out[k].sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
    return out;
  }, [data]);

  const locName = locations.find(l => l.id === adminLocationId)?.name || 'All sites';
  const b = data?.benchmarks;

  return (
    <div data-testid="menu-engineering-page" style={{ paddingBottom: 24, ...FONT }}>
      <button
        data-testid="me-back"
        onClick={() => navigate('/jkhive/manager')}
        style={{ background: 'none', border: 0, color: '#007AFF', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginBottom: 12, ...FONT }}
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1D1D1F', margin: 0, letterSpacing: '-0.02em' }}>
              Menu Engineering
            </h1>
            <button
              data-testid="me-help-btn"
              onClick={() => setShowHelp(true)}
              aria-label="How Menu Engineering works"
              title="How it works · file format"
              style={iconBtn}
            >
              <HelpCircle size={16} color="#1D1D1F" />
            </button>
            <input
              ref={uploadRef}
              data-testid="me-upload-input"
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              hidden
              onChange={onUploadPick}
            />
            <button
              data-testid="me-upload-btn"
              onClick={() => uploadRef.current?.click()}
              disabled={uploadBusy || !adminLocationId}
              aria-label="Upload sales XLSX"
              title="Upload sales data (XLSX)"
              style={{ ...iconBtn, opacity: uploadBusy ? 0.6 : 1, cursor: uploadBusy ? 'wait' : 'pointer' }}
            >
              {uploadBusy ? <Loader2 size={16} color="#1D1D1F" className="animate-spin" /> : <Upload size={16} color="#1D1D1F" />}
            </button>
          </div>
          <p style={{ fontSize: 13, color: '#86868B', margin: '2px 0 0' }}>
            Kasavana & Smith 2×2 · {locName} · last {days} days
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {PRESETS.map(p => (
            <button
              key={p.id}
              data-testid={`me-preset-${p.id}`}
              onClick={() => setDays(p.id)}
              style={{
                padding: '6px 12px', borderRadius: 999,
                border: `1px solid ${days === p.id ? '#1D1D1F' : '#E5E5EA'}`,
                background: days === p.id ? '#1D1D1F' : '#FFFFFF',
                color: days === p.id ? '#FFFFFF' : '#1D1D1F',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', ...FONT,
              }}
            >{p.label}</button>
          ))}
        </div>
      </div>

      {/* Upload result toast — brief inline feedback so admin knows what
          landed and which item names didn't match the menu. */}
      {uploadReport && (
        <div data-testid="me-upload-report" style={{
          marginTop: 6, background: uploadReport.unmatched_count > 0 ? 'rgba(255,149,0,0.10)' : 'rgba(52,199,89,0.10)',
          borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          {uploadReport.unmatched_count > 0
            ? <AlertTriangle size={16} color="#FF9500" style={{ marginTop: 2 }} />
            : <CheckCircle2 size={16} color="#34C759" style={{ marginTop: 2 }} />}
          <div style={{ flex: 1, fontSize: 12, color: '#1D1D1F', ...FONT }}>
            <strong>{uploadReport.rows_saved}</strong> rows saved · matched{' '}
            <strong>{uploadReport.matched}</strong> · unmatched{' '}
            <strong>{uploadReport.unmatched_count}</strong>
            {uploadReport.unmatched_count > 0 && (
              <div style={{ marginTop: 4, fontSize: 11, color: '#3A3A3C' }}>
                Not on menu (yet): {uploadReport.unmatched.slice(0, 8).join(', ')}
                {uploadReport.unmatched.length > 8 && ` … +${uploadReport.unmatched.length - 8} more`}
              </div>
            )}
          </div>
          <button onClick={() => setUploadReport(null)} style={{ background: 'transparent', border: 0, cursor: 'pointer', color: '#86868B' }} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}
      {uploadErr && (
        <div data-testid="me-upload-error" style={{ marginTop: 6, background: 'rgba(255,59,48,0.10)', color: '#C0392B', padding: '10px 12px', borderRadius: 10, fontSize: 12 }}>
          {uploadErr}
        </div>
      )}

      {/* Help modal */}
      {showHelp && (
        <HelpModal onClose={() => setShowHelp(false)} onDownloadTemplate={downloadTemplate} />
      )}

      {/* Benchmarks summary */}
      {b && (
        <div data-testid="me-benchmarks" style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10,
          marginTop: 14, marginBottom: 14,
        }}>
          <StatTile label="Total items on menu" value={fmtUnits(b.total_menu_items)} icon={<HelpCircle size={12} />} />
          <StatTile label="Classified" value={fmtUnits(b.eligible_items)} icon={<TrendingUp size={12} />} sub="sold + priced" />
          <StatTile label="Avg units / item" value={fmtUnits(b.mean_units)} sub="popularity line" />
          <StatTile label="Avg margin / item" value={fmtGBP(b.mean_margin)} sub="profitability line" />
        </div>
      )}

      {err && (
        <div data-testid="me-error" style={{ background: 'rgba(255,59,48,0.10)', color: '#C0392B', padding: '10px 12px', borderRadius: 10, fontSize: 12, marginBottom: 10 }}>
          {err}
        </div>
      )}

      {loading && !data ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#86868B' }}>
          <Loader2 size={20} className="animate-spin" style={{ display: 'inline-block' }} /> Loading…
        </div>
      ) : (
        <>
          {/* 2×2 quadrant grid */}
          <div data-testid="me-grid" style={{
            display: 'grid', gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          }}>
            {QUADRANTS.map(meta => (
              <QuadrantCard key={meta.key} meta={meta} items={byQuadrant[meta.key] || []} />
            ))}
          </div>

          {/* Uncategorised bin */}
          {byQuadrant.uncategorised.length > 0 && (
            <div data-testid="me-uncategorised" style={{ marginTop: 14, background: '#F8F8FA', borderRadius: 14, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <HelpCircle size={13} color="#86868B" />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#3A3A3C' }}>
                  Needs setup — {byQuadrant.uncategorised.length} items
                </span>
              </div>
              <p style={{ fontSize: 11, color: '#86868B', margin: '0 0 8px' }}>
                Items without a recipe (no food cost) or with no sales in the period. Complete the recipe in Menu Manager to include them here.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                {byQuadrant.uncategorised.slice(0, 60).map(it => (
                  <div key={it.id} style={{ padding: '5px 8px', borderRadius: 6, background: '#FFFFFF', fontSize: 11, color: '#3A3A3C', display: 'flex', justifyContent: 'space-between', gap: 6, ...FONT }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>
                    <span style={{ color: '#86868B', fontSize: 10 }}>{it.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const StatTile = ({ label, value, sub, icon }) => (
  <div style={{ background: '#FFFFFF', borderRadius: 12, padding: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {icon} {label}
    </div>
    <div style={{ fontSize: 20, fontWeight: 800, color: '#1D1D1F', marginTop: 2, letterSpacing: '-0.02em' }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: '#86868B', marginTop: 1 }}>{sub}</div>}
  </div>
);

const iconBtn = {
  width: 32, height: 32, borderRadius: 999, border: 0,
  background: '#FFFFFF', boxShadow: '0 0 0 1px rgba(0,0,0,0.08)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
};

const HelpModal = ({ onClose, onDownloadTemplate }) => (
  <div data-testid="me-help-modal" style={{ position: 'fixed', inset: 0, zIndex: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, ...FONT }}>
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
    <div style={{
      position: 'relative', background: '#FFFFFF', width: '100%', maxWidth: 620,
      borderRadius: 20, padding: '22px 22px 24px',
      maxHeight: 'calc(100vh - 32px)', overflowY: 'auto',
      boxShadow: '0 24px 48px rgba(0,0,0,0.25)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>How it works</p>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1D1D1F', margin: '2px 0 0' }}>Menu Engineering setup</h2>
        </div>
        <button data-testid="me-help-close" onClick={onClose} aria-label="Close"
          style={{ width: 32, height: 32, borderRadius: 999, background: '#F5F5F7', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={15} color="#1D1D1F" />
        </button>
      </div>

      <p style={{ fontSize: 13, color: '#3A3A3C', margin: '4px 0 14px', lineHeight: 1.5 }}>
        To classify each dish as a <strong>Star</strong>, <strong>Plow Horse</strong>, <strong>Puzzle</strong>, or <strong>Dog</strong>, we need two things per item:
      </p>

      <ol style={{ margin: '0 0 14px', paddingLeft: 20, fontSize: 13, color: '#3A3A3C', lineHeight: 1.55 }}>
        <li style={{ marginBottom: 8 }}>
          <strong>A recipe with food cost</strong> — set inside <em>Manager → Menu Management</em>. Any item without ingredient costs shows in the &quot;Needs setup&quot; bin below.
        </li>
        <li style={{ marginBottom: 8 }}>
          <strong>Sales data</strong> — either via connected orders (POS) OR by uploading an XLSX with the last few weeks of sales. Use the <strong>Upload</strong> icon (⬆) top-right on this page.
        </li>
      </ol>

      <div style={{ background: '#F8F8FA', borderRadius: 12, padding: 14, marginBottom: 14 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#1D1D1F', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Upload size={12} /> XLSX format
        </p>
        <p style={{ fontSize: 12, color: '#3A3A3C', margin: '0 0 10px' }}>
          One row per item per day. Column headers on row 1, data from row 2. Required: <code>item_name</code>, <code>units_sold</code>. Optional: <code>unit_price</code>, <code>date</code>.
        </p>
        <div style={{ background: '#FFFFFF', borderRadius: 8, overflow: 'hidden', border: '1px solid #E5E5EA' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
            <thead>
              <tr style={{ background: '#1D1D1F', color: '#FFFFFF' }}>
                <th style={helpTh}>item_name</th>
                <th style={helpTh}>units_sold</th>
                <th style={helpTh}>unit_price</th>
                <th style={helpTh}>date</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={helpTd}>Chicken Katsu Curry</td>
                <td style={helpTd}>12</td>
                <td style={helpTd}>12.50</td>
                <td style={helpTd}>2026-07-01</td>
              </tr>
              <tr style={{ background: '#F8F8FA' }}>
                <td style={helpTd}>Vegan Buddha Bowl</td>
                <td style={helpTd}>5</td>
                <td style={helpTd}>11.00</td>
                <td style={helpTd}>2026-07-01</td>
              </tr>
              <tr>
                <td style={helpTd}>Chicken Katsu Curry</td>
                <td style={helpTd}>9</td>
                <td style={helpTd}>12.50</td>
                <td style={helpTd}>2026-07-02</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ul style={{ margin: '10px 0 0', paddingLeft: 20, fontSize: 11.5, color: '#3A3A3C', lineHeight: 1.55 }}>
          <li><code>item_name</code> matches against your menu (case-insensitive). Items that don&apos;t match are still saved but flagged so you can rename them.</li>
          <li>Dates can be <code>2026-07-01</code>, <code>01/07/2026</code>, or blank (defaults to today).</li>
          <li>Up to 10&nbsp;MB per file. Multiple uploads accumulate — nothing is overwritten.</li>
        </ul>
      </div>

      <button
        data-testid="me-help-download-template"
        onClick={() => { onClose(); onDownloadTemplate(); }}
        style={{
          width: '100%', padding: '12px 16px', borderRadius: 12, border: 0,
          background: 'linear-gradient(135deg, #34C759 0%, #007AFF 100%)',
          color: '#FFFFFF', fontSize: 14, fontWeight: 700,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, ...FONT,
        }}
      >
        <Download size={14} /> Download blank template
      </button>
    </div>
  </div>
);

const helpTh = { padding: '6px 8px', textAlign: 'left', fontWeight: 700, fontSize: 11, letterSpacing: '0.02em' };
const helpTd = { padding: '6px 8px', borderTop: '1px solid #E5E5EA', color: '#1D1D1F', fontVariantNumeric: 'tabular-nums' };

export default MenuEngineering;
