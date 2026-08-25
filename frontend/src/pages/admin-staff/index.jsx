import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Users, ArrowLeft, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

const EMPTY = { name: '', forename: '', surname: '', ni_number: '', dob: '', address: '', employee_no: '', start_date: '', hourly_rate: '', weekly_hours_target: '', account_email: '', location_ids: [], active: true };

const FIELDS = [
  { key: 'name',         label: 'Name',        type: 'text',  required: true, placeholder: 'Full name (for matching)' },
  { key: 'forename',     label: 'Forename',    type: 'text' },
  { key: 'surname',      label: 'Surname',     type: 'text' },
  { key: 'ni_number',    label: 'NI Number',   type: 'text',  placeholder: 'AB123456C' },
  { key: 'dob',          label: 'DoB',         type: 'date' },
  { key: 'address',      label: 'Address',     type: 'textarea' },
  { key: 'employee_no',  label: 'Employee No', type: 'text' },
  { key: 'start_date',   label: 'Start Date',  type: 'date' },
  { key: 'hourly_rate',  label: 'Hourly Rate (£)', type: 'number', placeholder: '12.50' },
  { key: 'weekly_hours_target', label: 'Weekly Hours Target', type: 'number', placeholder: '32 (0 = flexible)' },
];

const AdminStaff = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, loading: authLoading } = useAuth();
  const [staff, setStaff] = useState([]);
  const [locations, setLocations] = useState([]);
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null); // staff object or 'new'
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) navigate('/admin-login');
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  useEffect(() => { if (isAdmin) { fetchStaff(); fetchLocations(); fetchUsers(); } }, [isAdmin]);

  const fetchStaff = async () => {
    setLoading(true);
    try { setStaff(await api.adminListStaff()); }
    catch (err) { alert('Failed to load staff: ' + err.message); }
    finally { setLoading(false); }
  };

  const fetchLocations = async () => {
    try { setLocations(await api.adminGetLocations()); }
    // Surface during dev — silent catches previously hid a typo here.
    catch (err) { console.warn('admin-staff: failed to load locations', err); }
  };

  // Load registered users (email accounts) so the admin can link a
  // staff record to a login account instead of typing an email by hand.
  const fetchUsers = async () => {
    try { setUsers(await api.adminGetCustomers()); }
    catch (err) { console.warn('admin-staff: failed to load users', err); }
  };

  const openNew = () => { setForm({ ...EMPTY, location_ids: [], active: true }); setUserSearch(''); setEditing('new'); };
  const openEdit = (s) => { setForm({ ...EMPTY, ...s, location_ids: Array.isArray(s.location_ids) ? s.location_ids : [], active: s.active !== false }); setUserSearch(''); setEditing(s); };
  const closeForm = () => { setEditing(null); setForm(EMPTY); setUserSearch(''); };

  const toggleLocation = (locId) => {
    setForm(prev => {
      const cur = Array.isArray(prev.location_ids) ? prev.location_ids : [];
      return { ...prev, location_ids: cur.includes(locId) ? cur.filter(x => x !== locId) : [...cur, locId] };
    });
  };

  const handleSave = async () => {
    if (!form.name?.trim()) { alert('Name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        hourly_rate: form.hourly_rate === '' || form.hourly_rate == null ? 0 : parseFloat(form.hourly_rate) || 0,
        weekly_hours_target: form.weekly_hours_target === '' || form.weekly_hours_target == null ? 0 : parseFloat(form.weekly_hours_target) || 0,
        location_ids: Array.isArray(form.location_ids) ? form.location_ids : [],
        active: form.active !== false,
      };
      if (editing === 'new') await api.adminCreateStaff(payload);
      else await api.adminUpdateStaff(editing.id, payload);
      await fetchStaff();
      closeForm();
    } catch (err) { alert('Save failed: ' + err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (s) => {
    if (!window.confirm(`Delete ${s.name}? This cannot be undone.`)) return;
    try { await api.adminDeleteStaff(s.id); await fetchStaff(); }
    catch (err) { alert('Delete failed: ' + err.message); }
  };

  // Quick toggle from the table — avoids opening the drawer just to mark
  // someone as on leave / left the business.
  const toggleActive = async (s) => {
    const nextActive = !(s.active !== false);
    try {
      await api.adminUpdateStaff(s.id, { active: nextActive });
      await fetchStaff();
    } catch (err) { alert('Update failed: ' + err.message); }
  };

  if (authLoading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>;

  const font = { fontFamily: 'Outfit, sans-serif' };
  const inputCls = 'w-full px-3 py-2.5 rounded-lg text-sm border-0 outline-none';
  const inputStyle = { background: '#FFFFFF', color: '#1D1D1F', ...font, boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto" data-testid="admin-staff-page">
      <Link to="/admin" data-testid="back-to-dashboard" className="inline-flex items-center gap-1.5 text-xs font-medium mb-3 active:scale-95" style={{ color: '#007AFF', ...font }}>
        <ArrowLeft size={13} /> Dashboard
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#1D1D1F' }}>
            <Users size={18} color="white" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: '#1D1D1F', ...font }}>Staff Table</h1>
            <p className="text-xs sm:text-sm" style={{ color: '#86868B' }}>Employee records · admin + super admin only</p>
          </div>
        </div>
        <button data-testid="add-staff-btn" onClick={openNew}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold active:scale-95"
          style={{ background: '#1D1D1F', color: '#FFFFFF', ...font }}>
          <Plus size={14} /> Add Staff
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>
      ) : staff.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ background: '#FFFFFF' }}>
          <Users size={32} className="mx-auto mb-3" style={{ color: '#C7C7CC' }} />
          <p className="text-sm" style={{ color: '#86868B', ...font }}>No staff records yet. Click "Add Staff" to create one.</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF' }}>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: 900 }}>
              <thead>
                <tr style={{ background: '#F5F5F7' }}>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Name</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Employee No</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>NI Number</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>DoB</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Start Date</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>£/hr</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Locations</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Login</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Status</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map(s => (
                  <tr key={s.id} data-testid={`staff-row-${s.id}`} style={{ borderTop: '1px solid rgba(0,0,0,0.04)', opacity: s.active === false ? 0.55 : 1 }}>
                    <td className="px-3 py-2.5 text-sm font-medium" style={{ color: '#1D1D1F', ...font }}>
                      <div>{s.name}</div>
                      {(s.forename || s.surname) && (
                        <div className="text-[11px]" style={{ color: '#86868B' }}>{[s.forename, s.surname].filter(Boolean).join(' ')}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-sm" style={{ color: '#1D1D1F', ...font }}>{s.employee_no || '—'}</td>
                    <td className="px-3 py-2.5 text-sm" style={{ color: '#1D1D1F', ...font }}>{s.ni_number || '—'}</td>
                    <td className="px-3 py-2.5 text-sm" style={{ color: '#1D1D1F', ...font }}>{s.dob || '—'}</td>
                    <td className="px-3 py-2.5 text-sm" style={{ color: '#1D1D1F', ...font }}>{s.start_date || '—'}</td>
                    <td className="px-3 py-2.5 text-sm" style={{ color: '#1D1D1F', ...font }} data-testid={`staff-hourly-${s.id}`}>{s.hourly_rate > 0 ? `£${Number(s.hourly_rate).toFixed(2)}` : '—'}</td>
                    <td className="px-3 py-2.5 text-sm" data-testid={`staff-locations-${s.id}`}>
                      {(() => {
                        const ids = Array.isArray(s.location_ids) ? s.location_ids : [];
                        if (ids.length === 0) {
                          return <span className="text-[11px]" style={{ color: '#FF9500', ...font }}>All sites</span>;
                        }
                        const names = ids
                          .map(id => locations.find(l => l.id === id)?.name)
                          .filter(Boolean);
                        return (
                          <div className="flex flex-wrap gap-1" style={{ maxWidth: 220 }}>
                            {names.map(n => (
                              <span key={n} className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: 'rgba(0,122,255,0.12)', color: '#0A66C2', ...font }}>
                                {n.split(',')[0]}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2.5 text-sm" data-testid={`staff-login-${s.id}`}>
                      {s.account_email ? (
                        <div className="flex flex-col" style={{ maxWidth: 200 }}>
                          <span className="text-[12px] font-medium truncate" style={{ color: '#1D1D1F', ...font }}>
                            {users.find(u => (u.email || '').toLowerCase() === (s.account_email || '').toLowerCase())?.name || s.account_email}
                          </span>
                          <span className="text-[10px] truncate" style={{ color: '#86868B', ...font }}>
                            {s.account_email}
                          </span>
                        </div>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: 'rgba(142,142,147,0.15)', color: '#6E6E73', ...font }}>
                          Not linked
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        data-testid={`staff-active-row-${s.id}`}
                        onClick={() => toggleActive(s)}
                        title="Click to toggle"
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold active:scale-95"
                        style={{
                          background: s.active === false ? 'rgba(142,142,147,0.15)' : 'rgba(52,199,89,0.15)',
                          color: s.active === false ? '#6E6E73' : '#1F8A3E',
                          ...font,
                        }}>
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: s.active === false ? '#8E8E93' : '#34C759',
                        }} />
                        {s.active === false ? 'Inactive' : 'Active'}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button data-testid={`edit-staff-${s.id}`} onClick={() => openEdit(s)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs active:scale-95 mr-2"
                        style={{ background: '#F5F5F7', color: '#1D1D1F', ...font }}>
                        <Pencil size={11} /> Edit
                      </button>
                      <button data-testid={`delete-staff-${s.id}`} onClick={() => handleDelete(s)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs active:scale-95"
                        style={{ background: 'rgba(255,59,48,0.1)', color: '#FF3B30', ...font }}>
                        <Trash2 size={11} /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit drawer */}
      {editing && (
        <div className="fixed inset-0 z-50" data-testid="staff-form-drawer">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={closeForm} />
          <div className="absolute right-0 top-0 bottom-0 w-full sm:w-[480px] overflow-y-auto" style={{ background: '#F5F5F7' }}>
            <div className="sticky top-0 z-10 px-5 py-4 flex items-center justify-between" style={{ background: '#FFFFFF', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <h2 className="text-lg font-semibold" style={{ color: '#1D1D1F', ...font }}>
                {editing === 'new' ? 'Add Staff' : 'Edit Staff'}
              </h2>
              <button onClick={closeForm} className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-95" style={{ background: '#F5F5F7' }}>
                <X size={15} style={{ color: '#1D1D1F' }} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {FIELDS.map(f => (
                <div key={f.key}>
                  <label className="block text-[11px] font-medium mb-1" style={{ color: '#86868B', ...font }}>
                    {f.label}{f.required ? ' *' : ''}
                  </label>
                  {f.type === 'textarea' ? (
                    <textarea
                      data-testid={`staff-field-${f.key}`}
                      value={form[f.key] || ''}
                      onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      placeholder={f.placeholder || ''}
                      rows={3}
                      className={inputCls}
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />
                  ) : (
                    <input
                      data-testid={`staff-field-${f.key}`}
                      type={f.type}
                      value={form[f.key] || ''}
                      onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      placeholder={f.placeholder || ''}
                      className={inputCls}
                      style={inputStyle}
                    />
                  )}
                </div>
              ))}

              {/* Active toggle — when off, the staff member is hidden from
                  the rota scheduler and AI-suggest roster but their
                  history remains intact. */}
              <div data-testid="staff-field-active" className="flex items-center justify-between rounded-lg p-3" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: '#1D1D1F', ...font }}>Active</p>
                  <p className="text-[11px]" style={{ color: '#86868B', ...font }}>
                    {form.active === false
                      ? 'Hidden from shift scheduling. Existing shifts are kept.'
                      : 'Available for shift scheduling and AI rota suggestions.'}
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="staff-active-toggle"
                  onClick={() => setForm(prev => ({ ...prev, active: !(prev.active !== false) }))}
                  aria-pressed={form.active !== false}
                  style={{
                    width: 50, height: 30, borderRadius: 999, border: 0, cursor: 'pointer',
                    background: form.active === false ? '#D1D1D6' : '#34C759',
                    position: 'relative', transition: 'background 0.2s',
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 3, left: form.active === false ? 3 : 23,
                    width: 24, height: 24, borderRadius: '50%', background: '#FFFFFF',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
                  }} />
                </button>
              </div>

              {/* Locations multi-select — pick every site this staff member
                  works at. Leaving all blank means "all sites". */}
              <div data-testid="staff-field-locations">
                <label className="block text-[11px] font-medium mb-1" style={{ color: '#86868B', ...font }}>
                  Locations <span className="font-normal">(tick every site they work at — none = all sites)</span>
                </label>
                {locations.length === 0 ? (
                  <p className="text-xs" style={{ color: '#86868B', ...font }}>No locations available.</p>
                ) : (
                  <div className="rounded-lg p-2 space-y-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}>
                    {locations.map(loc => {
                      const checked = (form.location_ids || []).includes(loc.id);
                      return (
                        <label key={loc.id}
                          data-testid={`staff-location-${loc.id}`}
                          className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-gray-50"
                          style={{ ...font }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleLocation(loc.id)}
                            style={{ width: 16, height: 16, accentColor: '#34C759', cursor: 'pointer' }}
                          />
                          <span className="text-sm" style={{ color: '#1D1D1F' }}>{loc.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Linked login account — picks from the registered users
                  (Admin → Users). Storing the account email here makes
                  clock-in/out, shift-visibility and payroll all resolve
                  to the same person regardless of role. */}
              {(() => {
                const currentEmail = (form.account_email || '').trim().toLowerCase();
                const q = userSearch.trim().toLowerCase();
                const linkedByOther = staff.find(
                  s => (s.account_email || '').trim().toLowerCase() === currentEmail
                    && currentEmail
                    && s.id !== (editing?.id)
                );
                const filteredUsers = (users || []).filter(u => {
                  if (!q) return true;
                  return (u.name || '').toLowerCase().includes(q)
                    || (u.email || '').toLowerCase().includes(q);
                }).slice(0, 30);
                return (
                  <div data-testid="staff-field-account-link">
                    <label className="block text-[11px] font-medium mb-1" style={{ color: '#86868B', ...font }}>
                      Linked login account <span className="font-normal">(matches clock-in / shift visibility to this user)</span>
                    </label>
                    <div className="rounded-lg" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}>
                      <div className="p-2 flex items-center justify-between gap-2" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                        <div className="text-sm truncate" style={{ color: currentEmail ? '#1D1D1F' : '#86868B', ...font }}>
                          {currentEmail ? (
                            <>
                              <span className="font-semibold">
                                {users.find(u => (u.email || '').toLowerCase() === currentEmail)?.name || 'Unknown user'}
                              </span>
                              <span className="ml-1" style={{ color: '#86868B' }}>{currentEmail}</span>
                            </>
                          ) : '— Not linked —'}
                        </div>
                        {currentEmail && (
                          <button
                            type="button"
                            data-testid="staff-clear-account-link"
                            onClick={() => setForm(prev => ({ ...prev, account_email: '' }))}
                            className="px-2 py-1 rounded text-[11px] font-semibold active:scale-95"
                            style={{ background: 'rgba(255,59,48,0.1)', color: '#FF3B30', ...font }}
                          >Clear</button>
                        )}
                      </div>
                      {linkedByOther && (
                        <div className="px-3 py-1.5 text-[11px]" style={{ background: 'rgba(255,149,0,0.1)', color: '#A35E00', ...font }}>
                          Already linked to <strong>{linkedByOther.name}</strong> — saving will move the link here.
                        </div>
                      )}
                      <input
                        type="text"
                        data-testid="staff-account-search"
                        value={userSearch}
                        onChange={e => setUserSearch(e.target.value)}
                        placeholder="Search users by name or email…"
                        className="w-full px-3 py-2 text-sm border-0 outline-none"
                        style={{ background: '#F5F5F7', color: '#1D1D1F', ...font }}
                      />
                      <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                        {users.length === 0 ? (
                          <div className="px-3 py-3 text-xs" style={{ color: '#86868B', ...font }}>
                            No users found. Ensure the person has registered at /admin/users.
                          </div>
                        ) : filteredUsers.length === 0 ? (
                          <div className="px-3 py-3 text-xs" style={{ color: '#86868B', ...font }}>
                            No users match &quot;{userSearch}&quot;.
                          </div>
                        ) : (
                          filteredUsers.map(u => {
                            const uEmail = (u.email || '').toLowerCase();
                            const isCurrent = uEmail === currentEmail;
                            const takenBy = staff.find(
                              s => (s.account_email || '').trim().toLowerCase() === uEmail
                                && s.id !== (editing?.id)
                            );
                            return (
                              <button
                                key={u.id || u.email}
                                type="button"
                                data-testid={`staff-account-option-${u.id || u.email}`}
                                onClick={() => setForm(prev => ({ ...prev, account_email: u.email }))}
                                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left active:scale-[0.99]"
                                style={{
                                  background: isCurrent ? 'rgba(52,199,89,0.10)' : 'transparent',
                                  borderTop: '1px solid rgba(0,0,0,0.04)',
                                  ...font,
                                }}
                              >
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold truncate" style={{ color: '#1D1D1F' }}>{u.name || u.email}</div>
                                  <div className="text-[11px] truncate" style={{ color: '#86868B' }}>
                                    {u.email}{u.role ? ` · ${u.role}` : ''}
                                  </div>
                                </div>
                                {takenBy && !isCurrent && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,149,0,0.15)', color: '#A35E00' }}>
                                    linked: {takenBy.name}
                                  </span>
                                )}
                                {isCurrent && (
                                  <Check size={13} style={{ color: '#34C759', flexShrink: 0 }} />
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="flex gap-2 pt-3">
                <button data-testid="save-staff-btn" disabled={saving} onClick={handleSave}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold active:scale-95 disabled:opacity-50"
                  style={{ background: '#34C759', color: '#FFFFFF', ...font }}>
                  <Check size={14} /> {saving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={closeForm}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold active:scale-95"
                  style={{ background: '#FFFFFF', color: '#1D1D1F', ...font, boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStaff;
