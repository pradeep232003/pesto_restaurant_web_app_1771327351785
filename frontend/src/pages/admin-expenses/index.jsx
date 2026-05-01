import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingDown, Plus, Trash2, Filter, Calendar, Pencil, Check, X, Download } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';
import * as XLSX from 'xlsx';

const AdminExpenses = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin, loading: authLoading } = useAuth();
  const { locations } = useLocation2();

  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const today = now.toISOString().split('T')[0];

  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(today);
  const [locationId, setLocationId] = useState('');
  const [saving, setSaving] = useState(false);

  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filterLocation, setFilterLocation] = useState('');
  const [filterStart, setFilterStart] = useState(firstOfMonth);
  const [filterEnd, setFilterEnd] = useState(today);
  const [filterCreatedBy, setFilterCreatedBy] = useState('');
  const [creators, setCreators] = useState([]);
  const [totalIncome, setTotalIncome] = useState(0);

  const [editingId, setEditingId] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
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
      const d = await api.adminGetExpenses({ location_id: filterLocation || undefined, created_by: filterCreatedBy || undefined, start_date: filterStart || undefined, end_date: filterEnd || undefined });
      setEntries(d.entries); setTotal(d.total);
      if (d.creators) setCreators(d.creators);
    } catch {}
    try {
      const incD = await api.adminGetIncome({ start_date: filterStart || undefined, end_date: filterEnd || undefined });
      setTotalIncome(incD.total || 0);
    } catch {}
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!amount || !description || !category || !date || !locationId) return;
    setSaving(true);
    try {
      await api.adminCreateExpense({ amount: parseFloat(amount), description, category, date, location_id: locationId });
      setAmount(''); setDescription(''); setCategory(''); setShowForm(false); fetchData();
    } catch (err) { alert('Failed: ' + err.message); } finally { setSaving(false); }
  };

  const startEdit = (e) => {
    setEditingId(e.id); setEditAmount(e.amount?.toString() || '');
    setEditDescription(e.description || ''); setEditCategory(e.category || '');
    setEditDate(e.date || ''); setEditLocationId(e.location_id || '');
  };

  const saveEdit = async (id) => {
    setSaving(true);
    try {
      await api.adminUpdateExpense(id, { amount: parseFloat(editAmount), description: editDescription, category: editCategory, date: editDate, location_id: editLocationId });
      setEditingId(null); fetchData();
    } catch (err) { alert('Failed: ' + err.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense entry?')) return;
    try { await api.adminDeleteExpense(id); fetchData(); } catch (err) { alert('Failed: ' + err.message); }
  };

  const getLocationName = (locId) => locations.find(l => l.id === locId)?.name || locId;

  const exportToExcel = () => {
    if (!entries.length) return;
    const period = `${filterStart || 'All'} to ${filterEnd || 'All'}`;
    const rows = entries.map(e => ({
      'Date': e.date,
      'Category': e.category,
      'Description': e.description,
      'Amount (£)': e.amount?.toFixed(2),
      'Location': getLocationName(e.location_id),
      'Added By': e.created_by_name || e.created_by,
    }));
    rows.push({});
    rows.push({ 'Date': 'Total', 'Amount (£)': total.toFixed(2) });
    rows.push({ 'Date': `Period: ${period}` });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
    XLSX.writeFile(wb, `Jollys-Expenses-${filterStart || 'all'}-to-${filterEnd || 'all'}.xlsx`);
  };

  const categoryTotals = entries.reduce((acc, e) => { const c = e.category || 'Other'; acc[c] = (acc[c] || 0) + (e.amount || 0); return acc; }, {});
  if (authLoading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>;

  const font = { fontFamily: 'Outfit, sans-serif' };
  const inputBase = "w-full px-3 py-3 rounded-xl text-sm border-0 outline-none min-w-0";
  const inputStyle = { background: '#F5F5F7', color: '#1D1D1F', ...font, boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto" data-testid="admin-expenses-page">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: '#1D1D1F', ...font }}>Expenses</h1>
          <p className="text-xs sm:text-sm mt-1" style={{ color: '#86868B' }}>Record and track expenses by location</p>
        </div>
        <div className="flex gap-2">
          <button data-testid="export-expense-btn" onClick={exportToExcel} disabled={!entries.length}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium active:scale-95 transition-all disabled:opacity-40"
            style={{ background: '#F5F5F7', color: '#1D1D1F', ...font }}><Download size={16} /></button>
          <button data-testid="add-expense-btn" onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium active:scale-95 transition-all"
            style={{ background: '#FF3B30', color: '#FFFFFF', ...font }}><Plus size={16} /> Add</button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="p-4 rounded-2xl mb-5 space-y-3" style={{ background: '#FFFFFF' }}>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium mb-1" style={{ color: '#86868B', ...font }}>Amount</label>
              <input data-testid="expense-amount" type="number" step="0.01" inputMode="decimal" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required className={inputBase} style={inputStyle} /></div>
            <div><label className="block text-xs font-medium mb-1" style={{ color: '#86868B', ...font }}>Date</label>
              <input data-testid="expense-date" type="date" value={date} onChange={e => setDate(e.target.value)} required className={inputBase} style={inputStyle} /></div>
          </div>
          <div><label className="block text-xs font-medium mb-1" style={{ color: '#86868B', ...font }}>Category</label>
            <input data-testid="expense-category" type="text" placeholder="e.g. Supplies, Rent, Utilities" value={category} onChange={e => setCategory(e.target.value)} required className={inputBase} style={inputStyle} /></div>
          <div><label className="block text-xs font-medium mb-1" style={{ color: '#86868B', ...font }}>Description</label>
            <input data-testid="expense-description" type="text" placeholder="e.g. Monthly electricity bill" value={description} onChange={e => setDescription(e.target.value)} required className={inputBase} style={inputStyle} /></div>
          <div><label className="block text-xs font-medium mb-1" style={{ color: '#86868B', ...font }}>Location</label>
            <select data-testid="expense-location" value={locationId} onChange={e => setLocationId(e.target.value)} required className={inputBase} style={inputStyle}>
              <option value="">Select location...</option>
              {locations.filter(l => l.is_active).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select></div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl text-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-50" style={{ background: '#1D1D1F', color: '#FFFFFF', ...font }}>{saving ? 'Saving...' : 'Save Expense'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-5 py-3 rounded-xl text-sm font-medium" style={{ background: '#F5F5F7', color: '#1D1D1F', ...font }}>Cancel</button>
          </div>
          <p className="text-[11px] text-right" style={{ color: '#C7C7CC' }}>Added by {user?.name || user?.email}</p>
        </form>
      )}

      <div className="space-y-3 sm:space-y-0 sm:flex sm:flex-wrap sm:gap-3 sm:items-end mb-5">
        <div className="sm:w-auto"><label className="block text-xs font-medium mb-1" style={{ color: '#86868B', ...font }}>Location</label>
          <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className={inputBase} style={{ ...inputStyle, background: '#FFFFFF' }}>
            <option value="">All Locations</option>
            {locations.filter(l => l.is_active).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select></div>
        <div className="sm:w-auto"><label className="block text-xs font-medium mb-1" style={{ color: '#86868B', ...font }}>Added By</label>
          <select value={filterCreatedBy} onChange={e => setFilterCreatedBy(e.target.value)} className={inputBase} style={{ ...inputStyle, background: '#FFFFFF' }}>
            <option value="">All</option>
            {creators.map(c => <option key={c.email} value={c.email}>{c.name || c.email}</option>)}
          </select></div>
        <div className="grid grid-cols-2 gap-3 sm:contents">
          <div><label className="block text-xs font-medium mb-1" style={{ color: '#86868B', ...font }}>From</label>
            <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} className={inputBase} style={{ ...inputStyle, background: '#FFFFFF' }} /></div>
          <div><label className="block text-xs font-medium mb-1" style={{ color: '#86868B', ...font }}>To</label>
            <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} className={inputBase} style={{ ...inputStyle, background: '#FFFFFF' }} /></div>
        </div>
        <button onClick={fetchData} className="w-full sm:w-auto px-4 py-3 sm:py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all" style={{ background: '#1D1D1F', color: '#FFFFFF', ...font }}><Filter size={14} /> Apply</button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3.5 rounded-2xl" style={{ background: '#FFFFFF' }}>
          <p className="text-[11px] uppercase tracking-wider font-medium" style={{ color: '#86868B' }}>Total Expenses</p>
          <p className="text-xl font-bold mt-0.5" style={{ color: '#FF3B30', ...font }}>{'\u00A3'}{total.toFixed(2)}</p>
          <p className="text-[11px]" style={{ color: '#86868B' }}>{entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}</p>
        </div>
        <div className="p-3.5 rounded-2xl" style={{ background: '#FFFFFF' }}>
          <p className="text-[11px] uppercase tracking-wider font-medium" style={{ color: '#86868B' }}>Actual Balance</p>
          <p className="text-xl font-bold mt-0.5" style={{ color: (totalIncome - total) >= 0 ? '#34C759' : '#FF3B30', ...font }}>{'\u00A3'}{(totalIncome - total).toFixed(2)}</p>
          <p className="text-[9px] mt-0.5" style={{ color: '#C7C7CC' }}>Income - Expenses</p>
        </div>
        <div className="p-3.5 rounded-2xl" style={{ background: '#FFFFFF' }}>
          <p className="text-[11px] uppercase tracking-wider font-medium mb-1.5" style={{ color: '#86868B' }}>By Category</p>
          {Object.keys(categoryTotals).length === 0 ? <p className="text-xs" style={{ color: '#C7C7CC' }}>—</p> : (
            <div className="space-y-1">
              {Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                <div key={cat} className="flex justify-between text-xs">
                  <span className="truncate mr-2" style={{ color: '#3A3A3C' }}>{cat}</span>
                  <span className="font-medium shrink-0" style={{ color: '#1D1D1F' }}>{'\u00A3'}{amt.toFixed(2)}</span>
                </div>))}
            </div>)}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ background: '#FFFFFF' }}>
          <Calendar size={32} className="mx-auto mb-3" style={{ color: '#C7C7CC' }} />
          <p className="text-sm" style={{ color: '#86868B', ...font }}>No expenses recorded for this period.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(e => editingId === e.id ? (
            <div key={e.id} className="p-4 rounded-2xl space-y-2" style={{ background: '#FFFFFF', border: '2px solid #007AFF' }}>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" step="0.01" value={editAmount} onChange={ev => setEditAmount(ev.target.value)} className={inputBase} style={inputStyle} />
                <input type="date" value={editDate} onChange={ev => setEditDate(ev.target.value)} className={inputBase} style={inputStyle} />
              </div>
              <input type="text" value={editCategory} onChange={ev => setEditCategory(ev.target.value)} placeholder="Category" className={inputBase} style={inputStyle} />
              <input type="text" value={editDescription} onChange={ev => setEditDescription(ev.target.value)} placeholder="Description" className={inputBase} style={inputStyle} />
              <select value={editLocationId} onChange={ev => setEditLocationId(ev.target.value)} className={inputBase} style={inputStyle}>
                {locations.filter(l => l.is_active).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <div className="flex gap-2">
                <button onClick={() => saveEdit(e.id)} disabled={saving} className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: '#34C759', color: '#FFFFFF', ...font }}><Check size={14} /> Save</button>
                <button onClick={() => setEditingId(null)} className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: '#F5F5F7', color: '#1D1D1F', ...font }}><X size={14} /></button>
              </div>
            </div>
          ) : (
            <div key={e.id} data-testid={`expense-entry-${e.id}`} className="flex items-center justify-between px-4 py-3.5 rounded-2xl" style={{ background: '#FFFFFF' }}>
              <div className="min-w-0 mr-3">
                <p className="text-sm font-medium truncate" style={{ color: '#1D1D1F', ...font }}>{e.description}</p>
                <p className="text-[11px]" style={{ color: '#86868B' }}>{e.date} · {getLocationName(e.location_id)}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.04)', color: '#86868B' }}>{e.category}</span>
                  <span className="text-[10px]" style={{ color: '#C7C7CC' }}>By {e.created_by_name || e.created_by}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <p className="text-sm font-bold" style={{ color: '#FF3B30', ...font }}>{'\u00A3'}{e.amount?.toFixed(2)}</p>
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

export default AdminExpenses;
