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

  const [selectedLocation, setSelectedLocation] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [sales, setSales] = useState('');
  const [floatAmount, setFloatAmount] = useState('');
  const [cashTaken, setCashTaken] = useState('');
  const [cashTakenBy, setCashTakenBy] = useState('');
  const [staffHours, setStaffHours] = useState([{ name: '', start_time: '', end_time: '' }]);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [filterLocation, setFilterLocation] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [expandedEntry, setExpandedEntry] = useState(null);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isStaff)) navigate('/admin-login');
  }, [authLoading, isAuthenticated, isStaff, navigate]);

  useEffect(() => { fetchStaffNames(); }, []);

  useEffect(() => {
    if (selectedLocation && entryDate) loadExistingEntry();
  }, [selectedLocation, entryDate]);

  useEffect(() => {
    if (activeTab === 'history' && isAdmin) fetchHistory();
  }, [activeTab]);

  const fetchStaffNames = async () => {
    try { setStaffNames(await api.adminGetStaffNames()); } catch {}
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
      } else { resetForm(false); }
    } catch { resetForm(false); }
    finally { setLoading(false); }
  };

  const resetForm = (clearLocation = true) => {
    setSales(''); setFloatAmount(''); setCashTaken(''); setCashTakenBy('');
    setStaffHours([{ name: '', start_time: '', end_time: '' }]);
    if (clearLocation) setSelectedLocation('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLocation || !entryDate) return;
    setSaving(true); setSuccessMsg('');
    try {
      await api.adminCreateDailySales({
        location_id: selectedLocation, date: entryDate,
        sales: parseFloat(sales) || 0, float_amount: parseFloat(floatAmount) || 0,
        cash_taken: parseFloat(cashTaken) || 0, cash_taken_by: cashTakenBy,
        staff_hours: staffHours.filter(sh => sh.name),
      });
      setSuccessMsg('Sales data saved successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) { alert('Failed to save: ' + err.message); }
    finally { setSaving(false); }
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
      setHistory(await api.adminGetDailySales({
        location_id: filterLocation || undefined,
        start_date: filterStartDate || undefined,
        end_date: filterEndDate || undefined,
      }));
    } catch (err) { alert('Failed to load history: ' + err.message); }
    finally { setHistoryLoading(false); }
  };

  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm('Delete this entry?')) return;
    try {
      await api.adminDeleteDailySales(entryId);
      setHistory(prev => prev.filter(e => e.id !== entryId));
    } catch (err) { alert('Failed to delete: ' + err.message); }
  };

  const getLocationName = (locId) => locations.find(l => l.id === locId)?.name || locId;

  if (authLoading) {
    return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>;
  }

  const font = { fontFamily: 'Outfit, sans-serif' };
  const inputBase = "w-full px-3 py-3 rounded-xl text-sm border-0 outline-none";
  const inputStyle = { background: '#F5F5F7', color: '#1D1D1F', ...font, boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' };
  const labelCls = "block text-xs font-medium mb-1.5";
  const labelStyle = { color: '#86868B', ...font };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto" data-testid="admin-daily-sales-page">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: '#1D1D1F', ...font }}>Daily Sales</h1>
        <p className="text-xs sm:text-sm mt-1" style={{ color: '#86868B' }}>Record sales and staff hours</p>
      </div>

      {/* Tabs — full width on mobile */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: '#E8E8ED' }}>
        <button
          data-testid="tab-entry"
          onClick={() => setActiveTab('entry')}
          className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-sm font-medium transition-all text-center"
          style={{
            background: activeTab === 'entry' ? '#FFFFFF' : 'transparent',
            color: activeTab === 'entry' ? '#1D1D1F' : '#86868B', ...font,
            boxShadow: activeTab === 'entry' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
          }}
        >
          <DollarSign size={14} className="inline mr-1 -mt-0.5" />
          Enter Sales
        </button>
        {isAdmin && (
          <button
            data-testid="tab-history"
            onClick={() => setActiveTab('history')}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-sm font-medium transition-all text-center"
            style={{
              background: activeTab === 'history' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'history' ? '#1D1D1F' : '#86868B', ...font,
              boxShadow: activeTab === 'history' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <Calendar size={14} className="inline mr-1 -mt-0.5" />
            History
          </button>
        )}
      </div>

      {/* ========== ENTRY TAB ========== */}
      {activeTab === 'entry' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {successMsg && (
            <div data-testid="success-message" className="p-3 rounded-xl text-sm font-medium" style={{ background: 'rgba(52,199,89,0.1)', color: '#34C759', ...font }}>
              {successMsg}
            </div>
          )}

          {/* Location — full width on mobile for easy tap */}
          <div>
            <label className={labelCls} style={labelStyle}>Location</label>
            <select
              data-testid="sales-location-select"
              value={selectedLocation}
              onChange={e => setSelectedLocation(e.target.value)}
              required
              className={inputBase}
              style={{ ...inputStyle, background: '#FFFFFF' }}
            >
              <option value="">Select location...</option>
              {locations.filter(l => l.is_active).map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          {/* Date — full width on mobile */}
          <div>
            <label className={labelCls} style={labelStyle}>Date</label>
            <input
              data-testid="sales-date-input"
              type="date"
              value={entryDate}
              onChange={e => setEntryDate(e.target.value)}
              required
              className={inputBase}
              style={{ ...inputStyle, background: '#FFFFFF' }}
            />
          </div>

          {/* Sales section */}
          <div className="p-4 sm:p-5 rounded-2xl" style={{ background: '#FFFFFF' }}>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#1D1D1F', ...font }}>
              <DollarSign size={16} /> Sales Information
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} style={labelStyle}>Total Sales</label>
                <input data-testid="sales-amount-input" type="number" step="0.01" inputMode="decimal" placeholder="0.00" value={sales} onChange={e => setSales(e.target.value)} required className={inputBase} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Float</label>
                <input data-testid="sales-float-input" type="number" step="0.01" inputMode="decimal" placeholder="0.00" value={floatAmount} onChange={e => setFloatAmount(e.target.value)} required className={inputBase} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Cash Taken</label>
                <input data-testid="sales-cash-input" type="number" step="0.01" inputMode="decimal" placeholder="0.00" value={cashTaken} onChange={e => setCashTaken(e.target.value)} required className={inputBase} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Cash Taken By</label>
                <input data-testid="sales-cash-by-input" type="text" placeholder="Name" value={cashTakenBy} onChange={e => setCashTakenBy(e.target.value)} required className={inputBase} style={inputStyle} />
              </div>
            </div>
          </div>

          {/* Staff Hours — card-based on mobile */}
          <div className="p-4 sm:p-5 rounded-2xl" style={{ background: '#FFFFFF' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#1D1D1F', ...font }}>
                <Clock size={16} /> Staff Hours
              </h3>
              <button type="button" data-testid="add-staff-row-btn" onClick={addStaffRow}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium active:scale-95 transition-all"
                style={{ background: '#F5F5F7', color: '#1D1D1F', ...font }}>
                <Plus size={13} /> Add
              </button>
            </div>

            <div className="space-y-3">
              {staffHours.map((sh, i) => (
                <div key={i} className="p-3 rounded-xl" style={{ background: '#F9F9FB', border: '1px solid rgba(0,0,0,0.04)' }}>
                  {/* Name — full width */}
                  <div className="mb-2">
                    <label className="block text-[11px] font-medium mb-1" style={{ color: '#86868B' }}>Staff Name</label>
                    <input
                      data-testid={`staff-name-${i}`}
                      list="staff-names-list"
                      type="text"
                      placeholder="Select or type name"
                      value={sh.name}
                      onChange={e => updateStaffRow(i, 'name', e.target.value)}
                      className={inputBase}
                      style={{ ...inputStyle, background: '#FFFFFF' }}
                    />
                  </div>
                  {/* Time row — side by side even on mobile */}
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="block text-[11px] font-medium mb-1" style={{ color: '#86868B' }}>Start</label>
                      <input data-testid={`staff-start-${i}`} type="time" value={sh.start_time} onChange={e => updateStaffRow(i, 'start_time', e.target.value)} className={inputBase} style={{ ...inputStyle, background: '#FFFFFF' }} />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[11px] font-medium mb-1" style={{ color: '#86868B' }}>End</label>
                      <input data-testid={`staff-end-${i}`} type="time" value={sh.end_time} onChange={e => updateStaffRow(i, 'end_time', e.target.value)} className={inputBase} style={{ ...inputStyle, background: '#FFFFFF' }} />
                    </div>
                    {staffHours.length > 1 && (
                      <button type="button" onClick={() => removeStaffRow(i)} className="p-3 rounded-xl shrink-0 active:scale-95 transition-all" style={{ color: '#FF3B30', background: 'rgba(255,59,48,0.06)' }}>
                        <Trash2 size={16} />
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

          {/* Submit — always full width on mobile for easy tap */}
          <button
            data-testid="save-sales-btn"
            type="submit"
            disabled={saving || !selectedLocation}
            className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 active:scale-[0.98]"
            style={{ background: '#1D1D1F', color: '#FFFFFF', ...font }}
          >
            {saving ? 'Saving...' : 'Save Sales Data'}
          </button>
        </form>
      )}

      {/* ========== HISTORY TAB ========== */}
      {activeTab === 'history' && isAdmin && (
        <div>
          {/* Filters — stacked on mobile */}
          <div className="space-y-3 sm:space-y-0 sm:flex sm:flex-wrap sm:gap-3 sm:items-end mb-5">
            <div className="sm:w-auto">
              <label className={labelCls} style={labelStyle}>Location</label>
              <select data-testid="history-location-filter" value={filterLocation} onChange={e => setFilterLocation(e.target.value)}
                className={inputBase} style={{ ...inputStyle, background: '#FFFFFF' }}>
                <option value="">All Locations</option>
                {locations.filter(l => l.is_active).map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:contents">
              <div>
                <label className={labelCls} style={labelStyle}>From</label>
                <input data-testid="history-start-date" type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)}
                  className={inputBase} style={{ ...inputStyle, background: '#FFFFFF' }} />
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>To</label>
                <input data-testid="history-end-date" type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)}
                  className={inputBase} style={{ ...inputStyle, background: '#FFFFFF' }} />
              </div>
            </div>
            <button data-testid="apply-filters-btn" onClick={fetchHistory}
              className="w-full sm:w-auto px-4 py-3 sm:py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all"
              style={{ background: '#1D1D1F', color: '#FFFFFF', ...font }}>
              <Filter size={14} /> Apply Filters
            </button>
          </div>

          {/* History list */}
          {historyLoading ? (
            <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>
          ) : history.length === 0 ? (
            <div className="text-center py-16 rounded-2xl" style={{ background: '#FFFFFF' }}>
              <Calendar size={32} className="mx-auto mb-3" style={{ color: '#C7C7CC' }} />
              <p className="text-sm" style={{ color: '#86868B', ...font }}>No sales data found. Adjust filters and try again.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map(entry => (
                <div key={entry.id} data-testid={`history-entry-${entry.id}`} className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF' }}>
                  <button onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                    className="w-full flex items-center justify-between px-4 sm:px-5 py-4 text-left active:bg-gray-50 transition-colors">
                    <div className="min-w-0 mr-3">
                      <p className="text-sm font-semibold truncate" style={{ color: '#1D1D1F', ...font }}>{getLocationName(entry.location_id)}</p>
                      <p className="text-xs" style={{ color: '#86868B' }}>{entry.date}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-semibold" style={{ color: '#1D1D1F', ...font }}>{'\u00A3'}{entry.sales?.toFixed(2)}</p>
                        <p className="text-[11px]" style={{ color: '#86868B' }}>Sales</p>
                      </div>
                      <ChevronDown size={16} style={{ color: '#86868B', transform: expandedEntry === entry.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </div>
                  </button>

                  {expandedEntry === entry.id && (
                    <div className="px-4 sm:px-5 pb-4" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                      <div className="grid grid-cols-2 gap-3 py-4">
                        <div>
                          <p className="text-[11px]" style={{ color: '#86868B' }}>Sales</p>
                          <p className="text-sm font-medium" style={{ color: '#1D1D1F', ...font }}>{'\u00A3'}{entry.sales?.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-[11px]" style={{ color: '#86868B' }}>Float</p>
                          <p className="text-sm font-medium" style={{ color: '#1D1D1F', ...font }}>{'\u00A3'}{entry.float_amount?.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-[11px]" style={{ color: '#86868B' }}>Cash Taken</p>
                          <p className="text-sm font-medium" style={{ color: '#1D1D1F', ...font }}>{'\u00A3'}{entry.cash_taken?.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-[11px]" style={{ color: '#86868B' }}>Cash Taken By</p>
                          <p className="text-sm font-medium" style={{ color: '#1D1D1F', ...font }}>{entry.cash_taken_by || '\u2014'}</p>
                        </div>
                      </div>

                      {entry.staff_hours?.length > 0 && (
                        <div className="mt-1">
                          <p className="text-[11px] font-medium mb-2" style={{ color: '#86868B' }}>Staff Hours</p>
                          <div className="space-y-1.5">
                            {entry.staff_hours.map((sh, i) => (
                              <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ background: '#F5F5F7' }}>
                                <span className="text-sm font-medium" style={{ color: '#1D1D1F', ...font }}>{sh.name}</span>
                                <span className="text-xs" style={{ color: '#86868B' }}>{sh.start_time} — {sh.end_time}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                        <p className="text-[11px] truncate mr-2" style={{ color: '#C7C7CC' }}>
                          By {entry.updated_by || entry.created_by}
                        </p>
                        <button data-testid={`delete-entry-${entry.id}`} onClick={() => handleDeleteEntry(entry.id)}
                          className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium shrink-0 active:scale-95 transition-all"
                          style={{ color: '#FF3B30', background: 'rgba(255,59,48,0.06)' }}>
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
