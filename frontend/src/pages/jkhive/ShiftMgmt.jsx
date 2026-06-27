import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Calendar, ChevronLeft, ChevronRight, X, Trash2, Pencil, Users, Clock,
} from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';

const FONT = { fontFamily: 'Outfit, sans-serif' };
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Return the ISO Monday of the week containing the given date. */
const startOfWeek = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay() || 7;
  if (day !== 1) x.setDate(x.getDate() - (day - 1));
  return x;
};

const toIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const fmtDayLabel = (d) => `${DAY_NAMES[(d.getDay() + 6) % 7]} ${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}`;

const fmtRange = (from, to) => `${from.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – ${to.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`;

const ShiftMgmt = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { adminLocationId, locations } = useLocation2();

  // Anchor on this week's Monday. Navigation moves in 7-day chunks.
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const [shifts, setShifts] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // shift object or new template

  const locName = useMemo(() => locations.find(l => l.id === adminLocationId)?.name || '', [locations, adminLocationId]);

  const load = useCallback(async () => {
    if (!adminLocationId) return;
    setLoading(true);
    setError('');
    try {
      const [rows, staff] = await Promise.all([
        api.shiftsList({ location_id: adminLocationId, start_date: toIso(weekStart), end_date: toIso(weekEnd) }),
        api.adminListStaff().catch(() => []),
      ]);
      setShifts(rows || []);
      setStaffList(staff || []);
    } catch (err) {
      setError(err.message || 'Failed to load shifts');
    } finally {
      setLoading(false);
    }
  }, [adminLocationId, weekStart, weekEnd]);

  useEffect(() => { load(); }, [load]);

  if (!adminLocationId) {
    return (
      <div style={{ padding: 24, ...FONT }}>
        <p style={{ color: '#FF9500' }}>Pick a location from JKHive home first.</p>
      </div>
    );
  }

  // Group shifts by date string for the day cards.
  const byDay = shifts.reduce((acc, s) => {
    (acc[s.date] = acc[s.date] || []).push(s);
    return acc;
  }, {});

  // Weekly totals — hours per staff member across the visible window.
  const totals = shifts.reduce((acc, s) => {
    if (!s.staff_id) return acc;
    const key = s.staff_id;
    if (!acc[key]) acc[key] = { name: s.staff_name, hours: 0, count: 0 };
    acc[key].hours += (s.hours || 0);
    acc[key].count += 1;
    return acc;
  }, {});
  const totalsList = Object.values(totals).sort((a, b) => b.hours - a.hours);
  const weekHours = totalsList.reduce((s, r) => s + r.hours, 0);

  return (
    <div data-testid="shifts-page" style={{ paddingBottom: 110, ...FONT }}>
      {/* Back */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <button
          data-testid="shifts-back"
          onClick={() => navigate('/jkhive/workforce')}
          style={{ background: 'transparent', border: 0, padding: 4, display: 'inline-flex', alignItems: 'center', gap: 4, color: '#007AFF', cursor: 'pointer', fontSize: 13, fontWeight: 600, ...FONT }}
        >
          <ArrowLeft size={14} /> Workforce
        </button>
      </div>

      <div style={{ marginBottom: 14 }}>
        <p className="text-[13px] font-medium" style={{ color: '#86868B' }}>Rotas, swaps and weekly hours</p>
        <h1 className="text-[28px] sm:text-[34px] font-bold tracking-tight leading-[1.05]" style={{ color: '#1D1D1F' }}>
          Shift Management
        </h1>
        <p className="text-[13px] mt-1" style={{ color: '#86868B' }}>{locName}</p>
      </div>

      {/* Week navigator */}
      <div style={{
        background: '#FFFFFF', borderRadius: 14, padding: 12, marginBottom: 12,
        display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}>
        <button data-testid="shifts-prev-week"
          onClick={() => setWeekStart(prev => addDays(prev, -7))}
          aria-label="Previous week"
          style={{ width: 36, height: 36, borderRadius: 999, background: '#F5F5F7', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={16} color="#1D1D1F" />
        </button>
        <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1D1D1F', ...FONT }}>{fmtRange(weekStart, weekEnd)}</p>
          <p style={{ margin: 0, fontSize: 11, color: '#86868B' }}>
            {shifts.length} shift{shifts.length === 1 ? '' : 's'} · {weekHours.toFixed(1)}h total
          </p>
        </div>
        <button data-testid="shifts-this-week"
          onClick={() => setWeekStart(startOfWeek(new Date()))}
          style={{ padding: '8px 12px', borderRadius: 999, background: '#F5F5F7', border: 0, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#1D1D1F', ...FONT }}
        >Today</button>
        <button data-testid="shifts-next-week"
          onClick={() => setWeekStart(prev => addDays(prev, 7))}
          aria-label="Next week"
          style={{ width: 36, height: 36, borderRadius: 999, background: '#F5F5F7', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronRight size={16} color="#1D1D1F" />
        </button>
      </div>

      {error && (
        <div data-testid="shifts-error" style={{ background: 'rgba(255,59,48,0.10)', borderRadius: 12, padding: 12, marginBottom: 12, color: '#C0392B', fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading && <p style={{ textAlign: 'center', color: '#86868B', padding: 24 }}>Loading…</p>}

      {!loading && (
        <>
          {/* Per-day list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {Array.from({ length: 7 }, (_, i) => {
              const d = addDays(weekStart, i);
              const iso = toIso(d);
              const day = byDay[iso] || [];
              const isToday = toIso(new Date()) === iso;
              return (
                <div key={iso} data-testid={`shifts-day-${iso}`}
                  style={{
                    background: '#FFFFFF', borderRadius: 14, padding: '12px 14px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    borderLeft: isToday ? '3px solid #007AFF' : '3px solid transparent',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: day.length ? 8 : 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1D1D1F', flex: 1 }}>
                      {fmtDayLabel(d)} {isToday && <span style={{ fontSize: 10, color: '#007AFF', marginLeft: 4 }}>· Today</span>}
                    </p>
                    {isAdmin && (
                      <button data-testid={`shifts-add-${iso}`}
                        onClick={() => setEditing({ date: iso, location_id: adminLocationId, staff_id: '', start_time: '09:00', end_time: '17:00', role: '', notes: '' })}
                        aria-label="Add shift"
                        style={{ width: 28, height: 28, borderRadius: 999, background: '#1D1D1F', border: 0, color: '#FFFFFF', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Plus size={14} />
                      </button>
                    )}
                  </div>
                  {day.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 12, color: '#C7C7CC', ...FONT }}>No shifts</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {day.map(s => (
                        <button
                          key={s.id}
                          data-testid={`shifts-row-${s.id}`}
                          onClick={() => isAdmin && setEditing(s)}
                          disabled={!isAdmin}
                          style={{
                            display: 'grid', gridTemplateColumns: '1fr auto', gap: 6,
                            padding: '8px 10px', borderRadius: 10, background: '#F9F9FB',
                            border: 0, cursor: isAdmin ? 'pointer' : 'default', textAlign: 'left',
                            ...FONT,
                          }}>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1D1D1F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {s.staff_name}
                            </p>
                            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#86868B' }}>
                              {s.start_time} – {s.end_time}{s.role && ` · ${s.role}`}
                            </p>
                          </div>
                          <span style={{ alignSelf: 'center', fontSize: 12, fontWeight: 700, color: '#007AFF' }}>{s.hours}h</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Weekly totals card */}
          {totalsList.length > 0 && (
            <div data-testid="shifts-weekly-totals" style={{ background: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Users size={16} color="#1D1D1F" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1D1D1F', flex: 1 }}>Weekly hours by staff</h3>
                <Clock size={14} color="#86868B" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {totalsList.map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, ...FONT }}>
                    <span style={{ flex: 1, color: '#1D1D1F' }}>{t.name}</span>
                    <span style={{ color: '#86868B', fontSize: 11 }}>{t.count} shift{t.count === 1 ? '' : 's'}</span>
                    <span style={{ fontWeight: 700, color: '#1D1D1F', width: 50, textAlign: 'right' }}>{t.hours.toFixed(1)}h</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit / Add modal */}
      {editing && (
        <ShiftModal
          shift={editing}
          staffList={staffList}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
};

const ShiftModal = ({ shift, staffList, onClose, onSaved }) => {
  const isEdit = !!shift.id;
  const [form, setForm] = useState({
    staff_id: shift.staff_id || '',
    date: shift.date,
    start_time: shift.start_time || '09:00',
    end_time: shift.end_time || '17:00',
    role: shift.role || '',
    notes: shift.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!form.staff_id) { setError('Pick a staff member'); return; }
    if (!form.date || !form.start_time || !form.end_time) { setError('Date and times are required'); return; }
    setSaving(true); setError('');
    try {
      if (isEdit) {
        await api.shiftUpdate(shift.id, form);
      } else {
        await api.shiftCreate({ location_id: shift.location_id, ...form });
      }
      onSaved();
    } catch (e) {
      setError(e.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this shift?')) return;
    setSaving(true); setError('');
    try {
      await api.shiftDelete(shift.id);
      onSaved();
    } catch (e) {
      setError(e.message || 'Could not delete');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="shift-modal"
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }} />
      <div style={{
        position: 'relative', background: '#FFFFFF', width: '100%', maxWidth: 460,
        borderRadius: 18, padding: '20px 22px', boxShadow: '0 24px 48px rgba(0,0,0,0.28)',
        maxHeight: '90vh', overflowY: 'auto', ...FONT,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>{isEdit ? 'Edit shift' : 'New shift'}</p>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1D1D1F', margin: '2px 0 0' }}>{shift.date}</h2>
          </div>
          <button onClick={onClose} aria-label="Close"
            style={{ width: 32, height: 32, borderRadius: 999, background: '#F5F5F7', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={15} color="#1D1D1F" />
          </button>
        </div>

        <label style={{ display: 'block', marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Staff member</span>
          <select data-testid="shift-staff-select" value={form.staff_id} onChange={e => set('staff_id', e.target.value)}
            style={{ display: 'block', marginTop: 4, width: '100%', padding: '10px 12px', borderRadius: 10, background: '#F5F5F7', border: 0, fontSize: 14, color: '#1D1D1F', ...FONT }}>
            <option value="">Select staff…</option>
            {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <label>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Start</span>
            <input data-testid="shift-start" type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)}
              style={{ display: 'block', marginTop: 4, width: '100%', padding: '10px 12px', borderRadius: 10, background: '#F5F5F7', border: 0, fontSize: 14, color: '#1D1D1F', ...FONT }} />
          </label>
          <label>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>End</span>
            <input data-testid="shift-end" type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)}
              style={{ display: 'block', marginTop: 4, width: '100%', padding: '10px 12px', borderRadius: 10, background: '#F5F5F7', border: 0, fontSize: 14, color: '#1D1D1F', ...FONT }} />
          </label>
        </div>

        <label style={{ display: 'block', marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date</span>
          <input data-testid="shift-date" type="date" value={form.date} onChange={e => set('date', e.target.value)}
            style={{ display: 'block', marginTop: 4, width: '100%', padding: '10px 12px', borderRadius: 10, background: '#F5F5F7', border: 0, fontSize: 14, color: '#1D1D1F', ...FONT }} />
        </label>

        <label style={{ display: 'block', marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Role <span style={{ textTransform: 'none', fontWeight: 500 }}>(optional)</span></span>
          <input data-testid="shift-role" value={form.role} onChange={e => set('role', e.target.value)} placeholder="Barista, Kitchen, Manager…"
            style={{ display: 'block', marginTop: 4, width: '100%', padding: '10px 12px', borderRadius: 10, background: '#F5F5F7', border: 0, fontSize: 14, color: '#1D1D1F', ...FONT }} />
        </label>

        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Notes <span style={{ textTransform: 'none', fontWeight: 500 }}>(optional)</span></span>
          <textarea data-testid="shift-notes" value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
            style={{ display: 'block', marginTop: 4, width: '100%', padding: '10px 12px', borderRadius: 10, background: '#F5F5F7', border: 0, fontSize: 14, color: '#1D1D1F', resize: 'vertical', ...FONT }} />
        </label>

        {error && <p style={{ fontSize: 12, color: '#C0392B', margin: '0 0 12px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10 }}>
          {isEdit && (
            <button data-testid="shift-delete" onClick={remove} disabled={saving}
              aria-label="Delete shift"
              style={{ width: 44, height: 44, borderRadius: 999, background: 'rgba(255,59,48,0.10)', color: '#C0392B', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <Trash2 size={16} />
            </button>
          )}
          <button data-testid="shift-save" onClick={save} disabled={saving}
            style={{
              flex: 1, padding: '12px 14px', borderRadius: 999, border: 0,
              background: '#1D1D1F', color: '#FFFFFF', fontSize: 14, fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, ...FONT,
            }}>
            {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Create shift')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShiftMgmt;
