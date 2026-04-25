import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Calendar, Clock, Plus, Trash2, ChevronDown, Filter } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';

const AdminDailySales = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isStaff, isAdmin, loading: authLoading } = useAuth();
  const { locations } = useLocation2();
  const [activeTab, setActiveTab] = useState('entry');
  const [loading, setLoading] = useState(false);
  const [staffNames, setStaffNames] = useState([]);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Entry form state
  const [selectedLocation, setSelectedLocation] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [sales, setSales] = useState('');
  const [floatAmount, setFloatAmount] = useState('');
  const [cashTaken, setCashTaken] = useState('');
  const [cashTakenBy, setCashTakenBy] = useState('');
  const [staffHours, setStaffHours] = useState([{ name: '', start_time: '', end_time: '' }]);

  // History state
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [filterLocation, setFilterLocation] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [expandedEntry, setExpandedEntry] = useState(null);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isStaff)) navigate('/admin-login');
  }, [authLoading, isAuthenticated, isStaff, navigate]);

  useEffect(() => {
    fetchStaffNames();
  }, []);

  useEffect(() => {
    if (selectedLocation && entryDate) loadExistingEntry();
  }, [selectedLocation, entryDate]);

  const fetchStaffNames = async () => {
    try {
      const names = await api.adminGetStaffNames();
      setStaffNames(names);
    } catch { /* ignore */ }
  };

  const loadExistingEntry = async () => {
    if (!selectedLocation || !entryDate) return;
    setLoading(true);
    try {
      const entry = await api.adminGetTodaySales(selectedLocation, entryDate);
      if (entry) {
        setSales(entry.sales?.toString() || '');
        setFloatAmount(entry.float_amount?.toString() || '');
        setCashTaken(entry.cash_taken?.toString() || '');
        setCashTakenBy(entry.cash_taken_by || '');
        setStaffHours(entry.staff_hours?.length > 0 ? entry.staff_hours : [{ name: '', start_time: '', end_time: '' }]);
      } else {
        resetForm(false);
      }
    } catch {
      resetForm(false);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = (clearLocation = true) => {
    setSales('');
    setFloatAmount('');
    setCashTaken('');
    setCashTakenBy('');
    setStaffHours([{ name: '', start_time: '', end_time: '' }]);
    if (clearLocation) setSelectedLocation('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLocation || !entryDate) return;
    setSaving(true);
    setSuccessMsg('');
    try {
      await api.adminCreateDailySales({
        location_id: selectedLocation,
        date: entryDate,
        sales: parseFloat(sales) || 0,
        float_amount: parseFloat(floatAmount) || 0,
        cash_taken: parseFloat(cashTaken) || 0,
        cash_taken_by: cashTakenBy,
        staff_hours: staffHours.filter(sh => sh.name),
      });
      setSuccessMsg('Sales data saved successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const addStaffRow = () => setStaffHours([...staffHours, { name: '', start_time: '', end_time: '' }]);
  const removeStaffRow = (i) => setStaffHours(staffHours.filter((_, idx) => idx !== i));
  const updateStaffRow = (i, field, val) => {
    const updated = [...staffHours];
    updated[i] = { ...updated[i], [field]: val };
    setStaffHours(updated);
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await api.adminGetDailySales({
        location_id: filterLocation || undefined,
        start_date: filterStartDate || undefined,
        end_date: filterEndDate || undefined,
      });
      setHistory(data);
    } catch (err) {
      alert('Failed to load history: ' + err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm('Delete this entry?')) return;
    try {
      await api.adminDeleteDailySales(entryId);
      setHistory(prev => prev.filter(e => e.id !== entryId));
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

  useEffect(() => {
    if (activeTab === 'history' && isAdmin) fetchHistory();
  }, [activeTab]);

  const getLocationName = (locId) => locations.find(l => l.id === locId)?.name || locId;

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
      </div>
    );
  }

  const inputStyle = { background: '#FFFFFF', color: '#1D1D1F', fontFamily: 'Outfit, sans-serif', boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl" data-testid="admin-daily-sales-page">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>Daily Sales</h1>
        <p className="text-sm mt-1" style={{ color: '#86868B' }}>Record daily sales and staff hours by location</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: '#E8E8ED' }}>
        <button
          data-testid="tab-entry"
          onClick={() => setActiveTab('entry')}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{
            background: activeTab === 'entry' ? '#FFFFFF' : 'transparent',
            color: activeTab === 'entry' ? '#1D1D1F' : '#86868B',
            fontFamily: 'Outfit, sans-serif',
            boxShadow: activeTab === 'entry' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
          }}
        >
          <DollarSign size={14} className="inline mr-1.5 -mt-0.5" />
          Enter Sales
        </button>
        {isAdmin && (
          <button
            data-testid="tab-history"
            onClick={() => setActiveTab('history')}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: activeTab === 'history' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'history' ? '#1D1D1F' : '#86868B',
              fontFamily: 'Outfit, sans-serif',
              boxShadow: activeTab === 'history' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <Calendar size={14} className="inline mr-1.5 -mt-0.5" />
            History
          </button>
        )}
      </div>

      {/* ENTRY TAB */}
      {activeTab === 'entry' && (
        <form onSubmit={handleSubmit} className="space-y-5">
          {successMsg && (
            <div data-testid="success-message" className="p-3 rounded-xl text-sm font-medium" style={{ background: 'rgba(52,199,89,0.1)', color: '#34C759', fontFamily: 'Outfit, sans-serif' }}>
              {successMsg}
            </div>
          )}

          {/* Location + Date row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}>Location</label>
              <select
                data-testid="sales-location-select"
                value={selectedLocation}
                onChange={e => setSelectedLocation(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-xl text-sm border-0 outline-none"
                style={inputStyle}
              >
                <option value="">Select location...</option>
                {locations.filter(l => l.is_active).map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}>Date</label>
              <input
                data-testid="sales-date-input"
                type="date"
                value={entryDate}
                onChange={e => setEntryDate(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-xl text-sm border-0 outline-none"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Sales section */}
          <div className="p-5 rounded-2xl" style={{ background: '#FFFFFF' }}>
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>
              <DollarSign size={16} />
              Sales Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}>Total Sales</label>
                <input
                  data-testid="sales-amount-input"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={sales}
                  onChange={e => setSales(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl text-sm border-0 outline-none"
                  style={{ ...inputStyle, background: '#F5F5F7' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}>Float</label>
                <input
                  data-testid="sales-float-input"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={floatAmount}
                  onChange={e => setFloatAmount(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl text-sm border-0 outline-none"
                  style={{ ...inputStyle, background: '#F5F5F7' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}>Cash Taken</label>
                <input
                  data-testid="sales-cash-input"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={cashTaken}
                  onChange={e => setCashTaken(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl text-sm border-0 outline-none"
                  style={{ ...inputStyle, background: '#F5F5F7' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}>Cash Taken By</label>
                <input
                  data-testid="sales-cash-by-input"
                  type="text"
                  placeholder="Name"
                  value={cashTakenBy}
                  onChange={e => setCashTakenBy(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl text-sm border-0 outline-none"
                  style={{ ...inputStyle, background: '#F5F5F7' }}
                />
              </div>
            </div>
          </div>

          {/* Staff Hours section */}
          <div className="p-5 rounded-2xl" style={{ background: '#FFFFFF' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>
                <Clock size={16} />
                Staff Hours
              </h3>
              <button
                type="button"
                data-testid="add-staff-row-btn"
                onClick={addStaffRow}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: '#F5F5F7', color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}
              >
                <Plus size={13} /> Add Staff
              </button>
            </div>
            <div className="space-y-3">
              {staffHours.map((sh, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                  <div>
                    {i === 0 && <label className="block text-xs font-medium mb-1.5" style={{ color: '#86868B' }}>Name</label>}
                    <input
                      data-testid={`staff-name-${i}`}
                      list="staff-names-list"
                      type="text"
                      placeholder="Staff name"
                      value={sh.name}
                      onChange={e => updateStaffRow(i, 'name', e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-sm border-0 outline-none"
                      style={{ ...inputStyle, background: '#F5F5F7' }}
                    />
                  </div>
                  <div>
                    {i === 0 && <label className="block text-xs font-medium mb-1.5" style={{ color: '#86868B' }}>Start</label>}
                    <input
                      data-testid={`staff-start-${i}`}
                      type="time"
                      value={sh.start_time}
                      onChange={e => updateStaffRow(i, 'start_time', e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-sm border-0 outline-none"
                      style={{ ...inputStyle, background: '#F5F5F7' }}
                    />
                  </div>
                  <div>
                    {i === 0 && <label className="block text-xs font-medium mb-1.5" style={{ color: '#86868B' }}>End</label>}
                    <input
                      data-testid={`staff-end-${i}`}
                      type="time"
                      value={sh.end_time}
                      onChange={e => updateStaffRow(i, 'end_time', e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-sm border-0 outline-none"
                      style={{ ...inputStyle, background: '#F5F5F7' }}
                    />
                  </div>
                  <div>
                    {i === 0 && <label className="block text-xs font-medium mb-1.5 opacity-0">X</label>}
                    {staffHours.length > 1 && (
                      <button type="button" onClick={() => removeStaffRow(i)} className="p-2.5 rounded-xl transition-all" style={{ color: '#FF3B30', background: 'rgba(255,59,48,0.06)' }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <datalist id="staff-names-list">
              {staffNames.map(n => <option key={n} value={n} />)}
            </datalist>
          </div>

          {/* Submit */}
          <button
            data-testid="save-sales-btn"
            type="submit"
            disabled={saving || !selectedLocation}
            className="w-full sm:w-auto px-8 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            style={{ background: '#1D1D1F', color: '#FFFFFF', fontFamily: 'Outfit, sans-serif' }}
          >
            {saving ? 'Saving...' : 'Save Sales Data'}
          </button>
        </form>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'history' && isAdmin && (
        <div>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-5 items-end">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}>Location</label>
              <select
                data-testid="history-location-filter"
                value={filterLocation}
                onChange={e => setFilterLocation(e.target.value)}
                className="px-3 py-2.5 rounded-xl text-sm border-0 outline-none"
                style={inputStyle}
              >
                <option value="">All Locations</option>
                {locations.filter(l => l.is_active).map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}>From</label>
              <input
                data-testid="history-start-date"
                type="date"
                value={filterStartDate}
                onChange={e => setFilterStartDate(e.target.value)}
                className="px-3 py-2.5 rounded-xl text-sm border-0 outline-none"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}>To</label>
              <input
                data-testid="history-end-date"
                type="date"
                value={filterEndDate}
                onChange={e => setFilterEndDate(e.target.value)}
                className="px-3 py-2.5 rounded-xl text-sm border-0 outline-none"
                style={inputStyle}
              />
            </div>
            <button
              data-testid="apply-filters-btn"
              onClick={fetchHistory}
              className="px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-1.5"
              style={{ background: '#1D1D1F', color: '#FFFFFF', fontFamily: 'Outfit, sans-serif' }}
            >
              <Filter size={14} /> Apply
            </button>
          </div>

          {/* History list */}
          {historyLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-16 rounded-2xl" style={{ background: '#FFFFFF' }}>
              <Calendar size={32} className="mx-auto mb-3" style={{ color: '#C7C7CC' }} />
              <p className="text-sm" style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}>No sales data found. Adjust your filters and try again.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map(entry => (
                <div key={entry.id} data-testid={`history-entry-${entry.id}`} className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF' }}>
                  <button
                    onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>{getLocationName(entry.location_id)}</p>
                        <p className="text-xs" style={{ color: '#86868B' }}>{entry.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-semibold" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>
                          {'\u00A3'}{entry.sales?.toFixed(2)}
                        </p>
                        <p className="text-xs" style={{ color: '#86868B' }}>Total Sales</p>
                      </div>
                      <ChevronDown size={16} style={{ color: '#86868B', transform: expandedEntry === entry.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </div>
                  </button>

                  {expandedEntry === entry.id && (
                    <div className="px-5 pb-5" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4">
                        <div>
                          <p className="text-xs" style={{ color: '#86868B' }}>Sales</p>
                          <p className="text-sm font-medium" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>{'\u00A3'}{entry.sales?.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: '#86868B' }}>Float</p>
                          <p className="text-sm font-medium" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>{'\u00A3'}{entry.float_amount?.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: '#86868B' }}>Cash Taken</p>
                          <p className="text-sm font-medium" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>{'\u00A3'}{entry.cash_taken?.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: '#86868B' }}>Cash Taken By</p>
                          <p className="text-sm font-medium" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>{entry.cash_taken_by || '—'}</p>
                        </div>
                      </div>

                      {entry.staff_hours?.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium mb-2" style={{ color: '#86868B' }}>Staff Hours</p>
                          <div className="space-y-1.5">
                            {entry.staff_hours.map((sh, i) => (
                              <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: '#F5F5F7' }}>
                                <span className="text-sm font-medium" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>{sh.name}</span>
                                <span className="text-xs" style={{ color: '#86868B' }}>{sh.start_time} — {sh.end_time}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                        <p className="text-xs" style={{ color: '#C7C7CC' }}>
                          Updated by {entry.updated_by || entry.created_by}
                        </p>
                        <button
                          data-testid={`delete-entry-${entry.id}`}
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                          style={{ color: '#FF3B30', background: 'rgba(255,59,48,0.06)' }}
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminDailySales;
