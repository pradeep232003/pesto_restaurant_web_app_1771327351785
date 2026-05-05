import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Users, ArrowLeft, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

const EMPTY = { name: '', forename: '', surname: '', ni_number: '', dob: '', address: '', employee_no: '', start_date: '' };

const FIELDS = [
  { key: 'name',         label: 'Name',        type: 'text',  required: true, placeholder: 'Full name (for matching)' },
  { key: 'forename',     label: 'Forename',    type: 'text' },
  { key: 'surname',      label: 'Surname',     type: 'text' },
  { key: 'ni_number',    label: 'NI Number',   type: 'text',  placeholder: 'AB123456C' },
  { key: 'dob',          label: 'DoB',         type: 'date' },
  { key: 'address',      label: 'Address',     type: 'textarea' },
  { key: 'employee_no',  label: 'Employee No', type: 'text' },
  { key: 'start_date',   label: 'Start Date',  type: 'date' },
];

const AdminStaff = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, loading: authLoading } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null); // staff object or 'new'
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) navigate('/admin-login');
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  useEffect(() => { if (isAdmin) fetchStaff(); }, [isAdmin]);

  const fetchStaff = async () => {
    setLoading(true);
    try { setStaff(await api.adminListStaff()); }
    catch (err) { alert('Failed to load staff: ' + err.message); }
    finally { setLoading(false); }
  };

  const openNew = () => { setForm(EMPTY); setEditing('new'); };
  const openEdit = (s) => { setForm({ ...EMPTY, ...s }); setEditing(s); };
  const closeForm = () => { setEditing(null); setForm(EMPTY); };

  const handleSave = async () => {
    if (!form.name?.trim()) { alert('Name is required'); return; }
    setSaving(true);
    try {
      if (editing === 'new') await api.adminCreateStaff(form);
      else await api.adminUpdateStaff(editing.id, form);
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
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold" style={{ color: '#86868B', ...font }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map(s => (
                  <tr key={s.id} data-testid={`staff-row-${s.id}`} style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
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
