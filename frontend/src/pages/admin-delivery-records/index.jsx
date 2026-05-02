import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Plus, Trash2, Check, X } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';

const AdminDeliveryRecords = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isStaff, isAdmin, loading: authLoading } = useAuth();
  const { locations } = useLocation2();

  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 6 * 864e5).toISOString().split('T')[0];

  const [selectedLocation, setSelectedLocation] = useState('');
  const [startDate, setStartDate] = useState(weekAgo);
  const [endDate, setEndDate] = useState(today);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ date: today, supplier: '', invoice_number: '', food_frozen_temp: '', food_chilled_temp: '', quality_comments: '' });

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isStaff)) navigate('/admin-login');
  }, [authLoading, isAuthenticated, isStaff, navigate]);

  useEffect(() => { if (selectedLocation) fetchEntries(); }, [selectedLocation, startDate, endDate]);

  const fetchEntries = async () => {
    setLoading(true);
    try { setEntries(await api.adminListDeliveryRecords({ location_id: selectedLocation, start_date: startDate, end_date: endDate })); }
    catch (err) { alert('Failed: ' + err.message); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!form.supplier) return;
    setSaving(true);
    try {
      await api.adminCreateDeliveryRecord({
        location_id: selectedLocation,
        date: form.date,
        supplier: form.supplier,
        invoice_number: form.invoice_number,
        food_frozen_temp: form.food_frozen_temp === '' ? null : parseFloat(form.food_frozen_temp),
        food_chilled_temp: form.food_chilled_temp === '' ? null : parseFloat(form.food_chilled_temp),
        quality_comments: form.quality_comments,
      });
      setForm({ date: today, supplier: '', invoice_number: '', food_frozen_temp: '', food_chilled_temp: '', quality_comments: '' });
      setShowForm(false);
      await fetchEntries();
    } catch (err) { alert('Failed: ' + err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this entry?')) return;
    try { await api.adminDeleteDeliveryRecord(id); await fetchEntries(); }
    catch (err) { alert('Failed: ' + err.message); }
  };

  if (authLoading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>;

  const font = { fontFamily: 'Outfit, sans-serif' };
  const inputStyle = { background: '#F5F5F7', color: '#1D1D1F', ...font, boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto" data-testid="admin-delivery-records-page">
      <div className="mb-5">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: '#1D1D1F', ...font }}>Delivery Records</h1>
        <p className="text-xs sm:text-sm mt-1" style={{ color: '#86868B' }}>Frozen &lt; -15°C · Chilled &lt; +8°C · Record every delivery</p>
      </div>

      <div className="space-y-3 mb-5">
        <select data-testid="delivery-location" value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)}
          className="w-full px-3 py-3 rounded-xl text-sm border-0 outline-none" style={{ ...inputStyle, background: '#FFFFFF' }}>
          <option value="">Select location...</option>
          {locations.filter(l => l.is_active).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        {selectedLocation && (
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-3 py-2.5 rounded-xl text-sm border-0 outline-none" style={{ ...inputStyle, background: '#FFFFFF' }} />
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-3 py-2.5 rounded-xl text-sm border-0 outline-none" style={{ ...inputStyle, background: '#FFFFFF' }} />
          </div>
        )}
      </div>

      {!selectedLocation ? (
        <div className="text-center py-16 rounded-2xl" style={{ background: '#FFFFFF' }}>
          <Truck size={32} className="mx-auto mb-3" style={{ color: '#C7C7CC' }} />
          <p className="text-sm" style={{ color: '#86868B', ...font }}>Select a location above to begin.</p>
        </div>
      ) : (
        <>
          <button data-testid="add-delivery-btn" onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold mb-4 active:scale-95"
            style={{ background: '#1D1D1F', color: '#FFFFFF', ...font }}>
            <Plus size={13} /> {showForm ? 'Cancel' : 'New Delivery'}
          </button>

          {showForm && (
            <div className="p-4 rounded-2xl mb-4 space-y-3" style={{ background: '#FFFFFF' }}>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm border-0 outline-none" style={inputStyle} />
              <input data-testid="supplier-input" placeholder="Supplier" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm border-0 outline-none" style={inputStyle} />
              <input placeholder="Invoice number" value={form.invoice_number} onChange={e => setForm({ ...form, invoice_number: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm border-0 outline-none" style={inputStyle} />
              <div className="grid grid-cols-2 gap-3">
                <input data-testid="frozen-temp" type="number" step="0.1" placeholder="Frozen °C (≤ -15)" value={form.food_frozen_temp} onChange={e => setForm({ ...form, food_frozen_temp: e.target.value })} className="px-3 py-2.5 rounded-xl text-sm border-0 outline-none" style={inputStyle} />
                <input data-testid="chilled-temp" type="number" step="0.1" placeholder="Chilled °C (≤ 8)" value={form.food_chilled_temp} onChange={e => setForm({ ...form, food_chilled_temp: e.target.value })} className="px-3 py-2.5 rounded-xl text-sm border-0 outline-none" style={inputStyle} />
              </div>
              <textarea rows={2} placeholder="Quality comments / rejection reason (optional)" value={form.quality_comments} onChange={e => setForm({ ...form, quality_comments: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm border-0 outline-none resize-none" style={inputStyle} />
              <button data-testid="save-delivery-btn" disabled={saving || !form.supplier} onClick={handleSave}
                className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 active:scale-[0.98]"
                style={{ background: '#34C759', color: '#FFFFFF', ...font }}>{saving ? 'Saving...' : 'Save Delivery'}</button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>
          ) : entries.length === 0 ? (
            <div className="text-center py-16 rounded-2xl" style={{ background: '#FFFFFF' }}>
              <Truck size={32} className="mx-auto mb-3" style={{ color: '#C7C7CC' }} />
              <p className="text-sm" style={{ color: '#86868B', ...font }}>No deliveries in this range.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map(e => (
                <div key={e.id} data-testid={`delivery-entry-${e.id}`} className="p-4 rounded-2xl flex items-start gap-3" style={{ background: '#FFFFFF' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: e.passed ? 'rgba(52,199,89,0.12)' : 'rgba(255,59,48,0.12)' }}>
                    {e.passed ? <Check size={18} style={{ color: '#34C759' }} /> : <X size={18} style={{ color: '#FF3B30' }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: '#1D1D1F', ...font }}>{e.supplier}</p>
                    <p className="text-[11px]" style={{ color: '#86868B' }}>
                      {e.date}{e.invoice_number ? ` · INV ${e.invoice_number}` : ''}
                      {e.food_frozen_temp != null && ` · Frozen ${e.food_frozen_temp}°C`}
                      {e.food_chilled_temp != null && ` · Chilled ${e.food_chilled_temp}°C`}
                    </p>
                    {e.quality_comments && <p className="text-[11px] mt-1" style={{ color: '#FF9500' }}>⚠ {e.quality_comments}</p>}
                  </div>
                  {isAdmin && (
                    <button data-testid={`del-delivery-${e.id}`} onClick={() => handleDelete(e.id)} className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-95" style={{ background: 'rgba(255,59,48,0.1)' }}>
                      <Trash2 size={13} style={{ color: '#FF3B30' }} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminDeliveryRecords;
