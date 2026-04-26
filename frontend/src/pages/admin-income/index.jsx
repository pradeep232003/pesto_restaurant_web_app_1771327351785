import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Plus, Trash2, Filter, Calendar, Pencil, Check, X } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';

const AdminIncome = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin, loading: authLoading } = useAuth();
  const { locations } = useLocation2();

  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const today = now.toISOString().split('T')[0];

  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(today);
  const [locationId, setLocationId] = useState('');
  const [saving, setSaving] = useState(false);

  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filterLocation, setFilterLocation] = useState('');
  const [filterStart, setFilterStart] = useState(firstOfMonth);
  const [filterEnd, setFilterEnd] = useState(today);

  const [editingId, setEditingId] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editLocationId, setEditLocationId] = useState('');

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) navigate('/admin-login');
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) fetchData();
  }, [isAuthenticated, isAdmin]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const d = await api.adminGetIncome({ location_id: filterLocation || undefined, start_date: filterStart || undefined, end_date: filterEnd || undefined });
      setEntries(d.entries); setTotal(d.total);
    } catch {} finally { setLoading(false); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!amount || !description || !date || !locationId) return;
    setSaving(true);
    try {
      await api.adminCreateIncome({ amount: parseFloat(amount), description, date, location_id: locationId });
      setAmount(''); setDescription(''); setShowForm(false); fetchData();
    } catch (err) { alert('Failed: ' + err.message); } finally { setSaving(false); }
  };

  const startEdit = (e) => {
    setEditingId(e.id); setEditAmount(e.amount?.toString() || '');
    setEditDescription(e.description || ''); setEditDate(e.date || '');
    setEditLocationId(e.location_id || '');
  };

  const saveEdit = async (id) => {
    setSaving(true);
    try {
      await api.adminUpdateIncome(id, { amount: parseFloat(editAmount), description: editDescription, date: editDate, location_id: editLocationId });
      setEditingId(null); fetchData();
    } catch (err) { alert('Failed: ' + err.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this income entry?')) return;
    try { await api.adminDeleteIncome(id); fetchData(); } catch (err) { alert('Failed: ' + err.message); }
  };

  const getLocationName = (locId) => locations.find(l => l.id === locId)?.name || locId;
  if (authLoading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>;

  const font = { fontFamily: 'Outfit, sans-serif' };
  const inputBase = "w-full px-3 py-3 rounded-xl text-sm border-0 outline-none min-w-0";
  const inputStyle = { background: '#F5F5F7', color: '#1D1D1F', ...font, boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto" data-testid="admin-income-page">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: '#1D1D1F', ...font }}>Income</h1>
          <p className="text-xs sm:text-sm mt-1" style={{ color: '#86868B' }}>Record and track income by location</p>
        </div>
        <button data-testid="add-income-btn" onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium active:scale-95 transition-all"
          style={{ background: '#34C759', color: '#FFFFFF', ...font }}><Plus size={16} /> Add</button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="p-4 rounded-2xl mb-5 space-y-3" style={{ background: '#FFFFFF' }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#86868B', ...font }}>Amount</label>
              <input data-testid="income-amount" type="number" step="0.01" inputMode="decimal" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required className={inputBase} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#86868B', ...font }}>Date</label>
              <input data-testid="income-date" type="date" value={date} onChange={e => setDate(e.target.value)} required className={inputBase} style={inputStyle} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#86868B', ...font }}>Description</label>
            <input data-testid="income-description" type="text" placeholder="e.g. Catering event" value={description} onChange={e => setDescription(e.target.value)} required className={inputBase} style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#86868B', ...font }}>Location</label>
            <select data-testid="income-location" value={locationId} onChange={e => setLocationId(e.target.value)} required className={inputBase} style={inputStyle}>
              <option value="">Select location...</option>
              {locations.filter(l => l.is_active).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl text-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-50" style={{ background: '#1D1D1F', color: '#FFFFFF', ...font }}>{saving ? 'Saving...' : 'Save Income'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-5 py-3 rounded-xl text-sm font-medium" style={{ background: '#F5F5F7', color: '#1D1D1F', ...font }}>Cancel</button>
          </div>
          <p className="text-[11px] text-right" style={{ color: '#C7C7CC' }}>Added by {user?.name || user?.email}</p>
        </form>
      )}

      <div className="space-y-3 sm:space-y-0 sm:flex sm:flex-wrap sm:gap-3 sm:items-end mb-5">
        <div className="sm:w-auto">
          <label className="block text-xs font-medium mb-1" style={{ color: '#86868B', ...font }}>Location</label>
          <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className={inputBase} style={{ ...inputStyle, background: '#FFFFFF' }}>
            <option value="">All Locations</option>
            {locations.filter(l => l.is_active).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:contents">
          <div><label className="block text-xs font-medium mb-1" style={{ color: '#86868B', ...font }}>From</label>
            <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} className={inputBase} style={{ ...inputStyle, background: '#FFFFFF' }} /></div>
          <div><label className="block text-xs font-medium mb-1" style={{ color: '#86868B', ...font }}>To</label>
            <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} className={inputBase} style={{ ...inputStyle, background: '#FFFFFF' }} /></div>
        </div>
        <button onClick={fetchData} className="w-full sm:w-auto px-4 py-3 sm:py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all" style={{ background: '#1D1D1F', color: '#FFFFFF', ...font }}><Filter size={14} /> Apply</button>
      </div>

      <div className="p-3.5 rounded-2xl mb-4" style={{ background: '#FFFFFF' }}>
        <p className="text-[11px] uppercase tracking-wider font-medium" style={{ color: '#86868B' }}>Total Income</p>
        <p className="text-xl font-bold mt-0.5" style={{ color: '#34C759', ...font }}>{'\u00A3'}{total.toFixed(2)}</p>
        <p className="text-[11px]" style={{ color: '#86868B' }}>{entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ background: '#FFFFFF' }}>
          <Calendar size={32} className="mx-auto mb-3" style={{ color: '#C7C7CC' }} />
          <p className="text-sm" style={{ color: '#86868B', ...font }}>No income recorded for this period.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(e => editingId === e.id ? (
            <div key={e.id} className="p-4 rounded-2xl space-y-2" style={{ background: '#FFFFFF', border: '2px solid #007AFF' }}>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" step="0.01" value={editAmount} onChange={ev => setEditAmount(ev.target.value)} className={inputBase} style={inputStyle} />
                <input type="date" value={editDate} onChange={ev => setEditDate(ev.target.value)} className={inputBase} style={inputStyle} />
              </div>
              <input type="text" value={editDescription} onChange={ev => setEditDescription(ev.target.value)} className={inputBase} style={inputStyle} />
              <select value={editLocationId} onChange={ev => setEditLocationId(ev.target.value)} className={inputBase} style={inputStyle}>
                {locations.filter(l => l.is_active).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <div className="flex gap-2">
                <button onClick={() => saveEdit(e.id)} disabled={saving} className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: '#34C759', color: '#FFFFFF', ...font }}><Check size={14} /> Save</button>
                <button onClick={() => setEditingId(null)} className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: '#F5F5F7', color: '#1D1D1F', ...font }}><X size={14} /></button>
              </div>
            </div>
          ) : (
            <div key={e.id} data-testid={`income-entry-${e.id}`} className="flex items-center justify-between px-4 py-3.5 rounded-2xl" style={{ background: '#FFFFFF' }}>
              <div className="min-w-0 mr-3">
                <p className="text-sm font-medium truncate" style={{ color: '#1D1D1F', ...font }}>{e.description}</p>
                <p className="text-[11px]" style={{ color: '#86868B' }}>{e.date} · {getLocationName(e.location_id)}</p>
                <p className="text-[10px]" style={{ color: '#C7C7CC' }}>By {e.created_by_name || e.created_by}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <p className="text-sm font-bold" style={{ color: '#34C759', ...font }}>{'\u00A3'}{e.amount?.toFixed(2)}</p>
                {e.can_modify && (
                  <>
                    <button onClick={() => startEdit(e)} className="p-2 rounded-lg active:scale-95 transition-all" style={{ color: '#007AFF', background: 'rgba(0,122,255,0.06)' }}><Pencil size={13} /></button>
                    <button onClick={() => handleDelete(e.id)} className="p-2 rounded-lg active:scale-95 transition-all" style={{ color: '#FF3B30', background: 'rgba(255,59,48,0.06)' }}><Trash2 size={13} /></button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminIncome;
