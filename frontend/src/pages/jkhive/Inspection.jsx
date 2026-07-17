import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Printer, Calendar, MapPin, Phone, Shield, Gauge, Droplet,
  Users, ClipboardList, CheckCircle, AlertTriangle, XCircle, MinusCircle, ClipboardX,
} from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';

/** Map a compliance status to a (label, colour, Icon) triple. Keeps the
 *  audit pack visually consistent with the Compliance Matrix. */
const STATUS_META = {
  complete:       { label: 'Complete',  bg: 'rgba(52,199,89,0.14)',  fg: '#1B7A35', Icon: CheckCircle },
  partial:        { label: 'Partial',   bg: 'rgba(0,122,255,0.12)',  fg: '#0A66CC', Icon: AlertTriangle },
  overdue:        { label: 'Overdue',   bg: 'rgba(255,149,0,0.16)',  fg: '#A35E00', Icon: AlertTriangle },
  missing:        { label: 'Missing',   bg: 'rgba(255,59,48,0.12)',  fg: '#C0392B', Icon: XCircle },
  not_applicable: { label: 'N/A',       bg: 'rgba(0,0,0,0.04)',      fg: '#86868B', Icon: MinusCircle },
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? iso : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtDateTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const Section = ({ title, icon: Icon, children, count }) => (
  <section
    data-testid={`inspection-section-${title.toLowerCase().replace(/\s+/g, '-')}`}
    className="inspection-section"
    style={{ background: '#FFFFFF', borderRadius: 18, padding: 18, marginBottom: 14, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
  >
    <header style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F5F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} color="#1D1D1F" strokeWidth={2.2} />
      </div>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1D1D1F', margin: 0, flex: 1 }}>{title}</h2>
      {count != null && (
        <span style={{ fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{count}</span>
      )}
    </header>
    {children}
  </section>
);

const Inspection = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAuth();
  const { adminLocationId, locations } = useLocation2();

  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);

  const [start, setStart] = useState(monthAgo);
  const [end, setEnd] = useState(today);
  const [pack, setPack] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const locationName = useMemo(
    () => locations.find(l => l.id === adminLocationId)?.name || '',
    [locations, adminLocationId],
  );

  const load = useCallback(async () => {
    if (!adminLocationId) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.adminInspectionPack({
        location_id: adminLocationId,
        start_date: start,
        end_date: end,
      });
      setPack(data);
    } catch (err) {
      setError(err.message || 'Failed to load inspection pack');
    } finally {
      setLoading(false);
    }
  }, [adminLocationId, start, end]);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  if (!authLoading && !isAdmin) {
    return (
      <div style={{ padding: 24, fontFamily: 'Outfit, sans-serif' }}>
        <p style={{ color: '#FF9500' }}>Inspection Mode is admin-only.</p>
      </div>
    );
  }

  if (!adminLocationId) {
    return (
      <div style={{ padding: 24, fontFamily: 'Outfit, sans-serif' }}>
        <p style={{ color: '#FF9500' }}>Pick a location from JKHive home first.</p>
      </div>
    );
  }

  const compliancePct = pack?.compliance?.overall_pct ?? 0;
  const checks = pack?.compliance?.checks || {};
  const checkEntries = Object.entries(checks);

  // Order routines deterministically: complete/partial first by cadence, then
  // missing/overdue last so the auditor sees gaps at the bottom of the section.
  const orderedChecks = [...checkEntries].sort(([, a], [, b]) => {
    const rank = (s) => ({ missing: 3, overdue: 2, partial: 1, complete: 0, not_applicable: 4 }[s] ?? 5);
    return rank(a.status) - rank(b.status);
  });

  return (
    <div data-testid="inspection-page" style={{ paddingBottom: 90, fontFamily: 'Outfit, sans-serif' }}>
      {/* Print styles — applied only when window.print() runs */}
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          html, body { background: #FFFFFF !important; }
          .inspection-toolbar, .inspection-back, .jkhive-bottom-nav, .jkhive-top-bar { display: none !important; }
          .inspection-section { break-inside: avoid; box-shadow: none !important; border: 1px solid #E5E5EA !important; }
          .inspection-page-title { font-size: 22pt !important; }
        }
      `}</style>

      {/* Back + title row (hidden in print) */}
      <div className="inspection-back" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <button
          data-testid="inspection-back"
          onClick={() => navigate('/jkhive')}
          style={{ background: 'transparent', border: 0, padding: 4, display: 'inline-flex', alignItems: 'center', gap: 4, color: '#007AFF', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: 13, fontWeight: 600 }}
        >
          <ArrowLeft size={14} /> Intelligence
        </button>
      </div>

      <div style={{ marginBottom: 10 }}>
        <p className="text-[13px] font-medium" style={{ color: '#86868B' }}>EHO-ready audit pack</p>
        <h1 className="inspection-page-title text-[28px] sm:text-[34px] font-bold tracking-tight leading-[1.05]" style={{ color: '#1D1D1F' }}>
          Inspection Mode
        </h1>
        <p className="text-[13px] mt-1" style={{ color: '#86868B' }}>
          Print or hand the EHO this page — everything they ask for, on one screen.
        </p>
      </div>

      {/* Toolbar: date range + print (hidden in print) */}
      <div className="inspection-toolbar" style={{
        background: '#FFFFFF', borderRadius: 14, padding: 12, marginBottom: 14,
        display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 130px' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>From</span>
          <input
            data-testid="inspection-start-date"
            type="date" value={start} onChange={e => setStart(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: 9, background: '#F5F5F7', border: 0, fontSize: 13, color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 130px' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>To</span>
          <input
            data-testid="inspection-end-date"
            type="date" value={end} onChange={e => setEnd(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: 9, background: '#F5F5F7', border: 0, fontSize: 13, color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
          />
        </label>
        <button
          data-testid="inspection-print"
          onClick={() => window.print()}
          style={{
            padding: '10px 16px', borderRadius: 999, border: 0, background: '#1D1D1F',
            color: '#FFFFFF', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Outfit, sans-serif',
            alignSelf: 'flex-end',
          }}
        >
          <Printer size={14} /> Print / Save PDF
        </button>
      </div>

      {error && (
        <div data-testid="inspection-error" style={{ background: 'rgba(255,59,48,0.10)', borderRadius: 12, padding: 12, marginBottom: 12, color: '#C0392B', fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading && (
        <p style={{ textAlign: 'center', color: '#86868B', padding: 24 }}>Building audit pack…</p>
      )}

      {!loading && pack && (
        <>
          {/* Identity card */}
          <Section title="Site" icon={MapPin}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#1D1D1F', margin: 0 }} data-testid="inspection-site-name">
                {pack.location.name || locationName}
              </p>
              {pack.location.address && (
                <p style={{ fontSize: 13, color: '#3A3A3C', margin: 0 }}>{pack.location.address}</p>
              )}
              {pack.location.phone && (
                <p style={{ fontSize: 13, color: '#3A3A3C', margin: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Phone size={12} color="#86868B" /> {pack.location.phone}
                </p>
              )}
              <p style={{ fontSize: 12, color: '#86868B', margin: '6px 0 0', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={11} /> Audit range: {fmtDate(pack.range.start_date)} → {fmtDate(pack.range.end_date)}
              </p>
            </div>
          </Section>

          {/* Compliance headline */}
          <Section title="Compliance" icon={Shield}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }} data-testid="inspection-compliance-headline">
              <span style={{ fontSize: 36, fontWeight: 800, color: '#1D1D1F', fontFeatureSettings: '"tnum"' }}>{compliancePct}%</span>
              <span style={{ fontSize: 13, color: '#86868B' }}>overall compliance for the selected period</span>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {orderedChecks.length === 0 && <p style={{ color: '#86868B', fontSize: 13 }}>No applicable routines for this site.</p>}
              {orderedChecks.map(([key, c]) => {
                const meta = STATUS_META[c.status] || STATUS_META.missing;
                return (
                  <div
                    key={key}
                    data-testid={`inspection-check-${key}`}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr auto', gap: 8,
                      padding: '10px 12px', borderRadius: 12, background: '#F9F9FB',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1D1D1F' }}>{c.label}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: '#86868B' }}>
                        {c.actual_periods}/{c.expected} {c.cadence === 'daily' ? 'days' : 'weeks'} covered
                        {c.last_date && ` · last ${fmtDate(c.last_date)}`}
                        {c.last_by && ` by ${c.last_by}`}
                      </p>
                    </div>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                      background: meta.bg, color: meta.fg, height: 'fit-content', alignSelf: 'center',
                    }}>
                      <meta.Icon size={11} strokeWidth={2.6} /> {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Corrective Actions — every failed check in the range with
              its remedial action. Massive EHO trust signal. */}
          {pack.corrective_actions && (
            <Section
              title="Corrective Actions"
              icon={ClipboardX}
              count={`${pack.corrective_actions.total} in range · ${pack.corrective_actions.open} open · ${pack.corrective_actions.resolved} resolved`}
            >
              {pack.corrective_actions.total === 0 && (
                <p style={{ fontSize: 13, color: '#86868B', margin: 0 }}>No corrective actions logged in this range — no failed checks recorded.</p>
              )}
              {pack.corrective_actions.total > 0 && (
                <>
                  <p style={{ fontSize: 12, color: '#86868B', margin: '0 0 10px' }}>
                    Auto-logged: <strong style={{ color: '#1D1D1F' }}>{pack.corrective_actions.auto_logged}</strong>
                    {' · By category: '}
                    {Object.entries(pack.corrective_actions.by_category || {}).map(([k, v], i, arr) => (
                      <span key={k}>{k.replace(/_/g, ' ')} ({v}){i < arr.length - 1 ? ', ' : ''}</span>
                    ))}
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
                    {pack.corrective_actions.rows.slice(0, 60).map((r) => (
                      <li
                        key={r.id}
                        style={{
                          padding: '10px 12px', borderRadius: 10,
                          background: r.status === 'resolved' ? '#F0FAF3' : '#FFF3F2',
                          borderLeft: `3px solid ${r.status === 'resolved' ? '#34C759' : '#FF3B30'}`,
                          fontSize: 12,
                        }}
                      >
                        <div style={{ fontWeight: 700, color: '#1D1D1F' }}>
                          {(r.category || 'other').replace(/_/g, ' ')} · {r.item || 'no item'}
                          <span style={{
                            marginLeft: 8, fontSize: 10, fontWeight: 800, letterSpacing: '0.04em',
                            textTransform: 'uppercase', padding: '1px 6px', borderRadius: 999,
                            background: r.status === 'resolved' ? '#34C75922' : '#FF3B3022',
                            color: r.status === 'resolved' ? '#1D5A2F' : '#8A2822',
                          }}>{r.status}</span>
                        </div>
                        <div style={{ margin: '3px 0 0', color: '#3A3A3C' }}>{r.failure_description}</div>
                        {r.corrective_action && (
                          <div style={{ margin: '3px 0 0', color: '#1D5A2F' }}>
                            <strong>Action:</strong> {r.corrective_action}
                          </div>
                        )}
                        <div style={{ margin: '3px 0 0', color: '#86868B', fontSize: 11 }}>
                          Logged by {r.logged_by_name || 'unknown'} · {(r.logged_at || '').slice(0, 16).replace('T', ' ')}
                          {r.status === 'resolved' && r.resolved_by_name && (
                            <> · Resolved by {r.resolved_by_name} · {(r.resolved_at || '').slice(0, 16).replace('T', ' ')}</>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {pack.corrective_actions.rows.length > 60 && (
                    <p style={{ margin: '8px 0 0', fontSize: 11, color: '#86868B', fontStyle: 'italic' }}>
                      Showing first 60 of {pack.corrective_actions.rows.length} — download the .docx from the Corrective Actions page for the full log.
                    </p>
                  )}
                </>
              )}
            </Section>
          )}

          {/* Probes */}
          <Section title="Probe Calibration" icon={Gauge} count={`${pack.probes.length} probe${pack.probes.length === 1 ? '' : 's'}`}>
            {pack.probes.length === 0 && <p style={{ fontSize: 13, color: '#86868B', margin: 0 }}>No probes registered at this site.</p>}
            {pack.probes.length > 0 && (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
                {pack.probes.map(p => (
                  <li key={p.id} style={{ padding: '8px 12px', borderRadius: 10, background: '#F9F9FB', fontSize: 13 }}>
                    <strong style={{ color: '#1D1D1F' }}>{p.name}</strong>
                    {p.info && <span style={{ color: '#86868B' }}> · {p.info}</span>}
                  </li>
                ))}
              </ul>
            )}
            {pack.recent_calibrations.length > 0 && (
              <>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '14px 0 6px' }}>
                  Last {pack.recent_calibrations.length} calibrations
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 4 }}>
                  {pack.recent_calibrations.map(c => (
                    <li key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: '#3A3A3C', padding: '4px 0' }}>
                      <span><strong>{c.probe_name}</strong> · Boil {c.boiling_temp}°C / Iced {c.iced_temp}°C</span>
                      <span style={{ color: c.passed ? '#1B7A35' : '#C0392B', fontWeight: 600 }}>
                        {c.passed ? 'PASS' : 'FAIL'} · {fmtDateTime(c.recorded_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Section>

          {/* Legionella */}
          <Section title="Legionella (Water hygiene)" icon={Droplet} count={`${pack.legionella.length} test${pack.legionella.length === 1 ? '' : 's'}`}>
            {pack.legionella.length === 0 && <p style={{ fontSize: 13, color: '#86868B', margin: 0 }}>No legionella tests on file for the last 12 weeks.</p>}
            {pack.legionella.length > 0 && (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 4 }}>
                {pack.legionella.map(l => (
                  <li key={l.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: '#3A3A3C', padding: '4px 0' }}>
                    <span>
                      <strong>{fmtDate(l.date)}</strong> · {l.location_of_test || '—'}
                      {l.hot_water_temp != null && ` · Hot ${l.hot_water_temp}°C`}
                      {l.cold_water_temp != null && ` · Cold ${l.cold_water_temp}°C`}
                    </span>
                    <span style={{ color: l.passed ? '#1B7A35' : '#C0392B', fontWeight: 600 }}>
                      {l.passed ? 'PASS' : 'FAIL'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Staff */}
          <Section title="Staff on roster" icon={Users} count={`${pack.staff.length} active`}>
            {pack.staff.length === 0 && <p style={{ fontSize: 13, color: '#86868B', margin: 0 }}>No staff recorded for this site.</p>}
            {pack.staff.length > 0 && (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 4 }}>
                {pack.staff.map(s => (
                  <li key={s.id} style={{ fontSize: 13, color: '#3A3A3C', padding: '4px 0' }}>
                    <strong style={{ color: '#1D1D1F' }}>{s.name}</strong>
                    {s.role && <span style={{ color: '#86868B' }}> · {s.role}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Templates summary */}
          <Section
            title="Documents on file"
            icon={ClipboardList}
            count={`${pack.documents?.total ?? 0} on file · ${pack.documents?.with_expiry ?? 0} tracked`}
          >
            {(pack.documents?.expired?.length ?? 0) > 0 && (
              <div data-testid="inspection-expired-docs" style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#C0392B', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>
                  Expired ({pack.documents.expired.length})
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {pack.documents.expired.map(d => (
                    <li key={d.id} style={{ fontSize: 13, color: '#C0392B', padding: '2px 0' }}>
                      {d.title} <span style={{ color: '#86868B' }}>· {d.category} · expired {fmtDate(d.expires_at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(pack.documents?.expiring_soon?.length ?? 0) > 0 && (
              <div data-testid="inspection-expiring-docs" style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#A35E00', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>
                  Expiring within 60 days ({pack.documents.expiring_soon.length})
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {pack.documents.expiring_soon.map(d => (
                    <li key={d.id} style={{ fontSize: 13, color: '#A35E00', padding: '2px 0' }}>
                      {d.title} <span style={{ color: '#86868B' }}>· {d.category} · expires {fmtDate(d.expires_at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(pack.documents?.total ?? 0) === 0 && (
              <p style={{ fontSize: 13, color: '#86868B', margin: 0 }}>No documents uploaded for this site.</p>
            )}
            {(pack.documents?.total ?? 0) > 0
              && (pack.documents?.expired?.length ?? 0) === 0
              && (pack.documents?.expiring_soon?.length ?? 0) === 0 && (
              <p style={{ fontSize: 13, color: '#1B7A35', margin: 0 }}>All tracked documents are in date.</p>
            )}
          </Section>

          {/* Templates summary */}
          <Section title="Operational checklists" icon={ClipboardList}>
            {['daily', 'weekly', 'monthly'].map(cadence => {
              const list = pack.templates[cadence] || [];
              return (
                <div key={cadence} style={{ marginBottom: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px' }}>
                    {cadence} ({list.length})
                  </p>
                  {list.length === 0 ? (
                    <p style={{ fontSize: 13, color: '#86868B', margin: 0 }}>—</p>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {list.map(t => (
                        <li key={t.id} style={{ fontSize: 13, color: '#3A3A3C', padding: '2px 0' }}>
                          {t.title} <span style={{ color: '#86868B' }}>· {t.items} items</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </Section>

          {/* Footer signature line for the EHO */}
          <div style={{ fontSize: 11, color: '#86868B', textAlign: 'center', padding: '14px 0' }}>
            Generated by JKHive · {fmtDateTime(new Date().toISOString())}
          </div>
        </>
      )}
    </div>
  );
};

export default Inspection;
