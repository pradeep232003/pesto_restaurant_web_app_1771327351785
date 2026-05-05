import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { DollarSign, Calendar, Clock, Plus, Trash2, ChevronDown, Filter, FileText, Share2, X, LogOut, Pencil, Check, Grid3X3, ArrowLeft, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCustomer } from '../../contexts/CustomerContext';
import { useLocation2 } from '../../contexts/LocationContext';

const AdminDailySales = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isStaff, isAdmin, signOut, loading: authLoading } = useAuth();
  const { logout: customerLogout } = useCustomer();
  const { locations, adminLocationId: selectedLocation, setAdminLocationId: setSelectedLocation } = useLocation2();
  const [activeTab, setActiveTab] = useState('entry');
  const [loading, setLoading] = useState(false);
  const [staffNames, setStaffNames] = useState([]);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const summaryRef = useRef(null);

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
  const [editingEntry, setEditingEntry] = useState(null);
  const [editStaffHours, setEditStaffHours] = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [totalExpenses, setTotalExpenses] = useState(0);

  // Completion grid state
  const now = new Date();
  const [gridMonth, setGridMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [gridData, setGridData] = useState(null);
  const [gridLoading, setGridLoading] = useState(false);
  const [hoveredCell, setHoveredCell] = useState(null);

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

  useEffect(() => {
    if (activeTab === 'grid' && isAdmin) fetchGrid();
  }, [activeTab, gridMonth]);

  const fetchGrid = async () => {
    setGridLoading(true);
    try {
      const d = await api.adminGetSalesCompletion(gridMonth);
      setGridData(d);
    } catch {} finally { setGridLoading(false); }
  };

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
      setShowSummary(true);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) { alert('Failed to save: ' + err.message); }
    finally { setSaving(false); }
  };

  const getLocationName = (locId) => locations.find(l => l.id === locId)?.name || locId;

  const handleSalesLogout = async () => {
    await signOut();
    customerLogout();
    localStorage.removeItem('customer_token');
    window.location.href = '/';
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  const buildWhatsAppText = () => {
    const loc = getLocationName(selectedLocation);
    const date = formatDate(entryDate);
    const validStaff = staffHours.filter(sh => sh.name);
    let msg = `*Jolly's Kafe — Daily Sales*\n`;
    msg += `${loc}\n${date}\n\n`;
    msg += `*Sales:* \u00A3${(parseFloat(sales) || 0).toFixed(2)}\n`;
    msg += `*Float:* \u00A3${(parseFloat(floatAmount) || 0).toFixed(2)}\n`;
    msg += `*Cash Taken:* \u00A3${(parseFloat(cashTaken) || 0).toFixed(2)}\n`;
    msg += `*Cash Taken By:* ${cashTakenBy}\n`;
    if (validStaff.length > 0) {
      msg += `\n*Staff Hours:*\n`;
      validStaff.forEach(sh => { msg += `  ${sh.name}: ${sh.start_time} — ${sh.end_time}\n`; });
    }
    return msg;
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(buildWhatsAppText());
    window.open(`https://wa.me/?text=${text}`, '_blank');
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
      const [salesData, expData] = await Promise.all([
        api.adminGetDailySales({
          location_id: filterLocation || undefined,
          start_date: filterStartDate || undefined,
          end_date: filterEndDate || undefined,
        }),
        api.adminGetExpenses({
          location_id: filterLocation || undefined,
          start_date: filterStartDate || undefined,
          end_date: filterEndDate || undefined,
        }),
      ]);
      setHistory(salesData);
      setTotalExpenses(expData.total || 0);
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

  // Compute hours from "HH:MM" → "HH:MM" (handles overnight shifts)
  const computeHours = (start, end) => {
    if (!start || !end) return 0;
    try {
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      let diff = (eh * 60 + em) - (sh * 60 + sm);
      if (diff < 0) diff += 24 * 60; // overnight
      return Math.round((diff / 60) * 100) / 100;
    } catch { return 0; }
  };

  const handleDownloadHistory = () => {
    if (!history.length) return;
    const locName = filterLocation
      ? (locations.find(l => l.id === filterLocation)?.name || 'location')
      : 'all-locations';
    const rangeStart = filterStartDate || (history[history.length - 1]?.date || '');
    const rangeEnd = filterEndDate || (history[0]?.date || '');

    // Per-entry summary row builder (reused for combined + per-location sheets)
    const buildRow = (e) => {
      const totalStaffHours = (e.staff_hours || []).reduce(
        (sum, sh) => sum + computeHours(sh.start_time, sh.end_time), 0,
      );
      return {
        Date: e.date,
        Location: getLocationName(e.location_id),
        Sales: e.sales ?? 0,
        Float: e.float_amount ?? 0,
        'Cash Taken': e.cash_taken ?? 0,
        'Cash Taken By': e.cash_taken_by || '',
        'Staff Count': (e.staff_hours || []).length,
        'Total Staff Hours': Math.round(totalStaffHours * 100) / 100,
        'Updated By': e.updated_by || e.created_by || '',
      };
    };

    // Sheet 1: Daily Sales — combined across all locations
    const summaryRows = history.map(buildRow);

    // Sheet 2: Staff Hours — combined across all locations
    const staffRows = [];
    history.forEach(e => {
      (e.staff_hours || []).forEach(sh => {
        if (!sh.name && !sh.start_time && !sh.end_time) return;
        staffRows.push({
          Date: e.date,
          Location: getLocationName(e.location_id),
          'Staff Name': sh.name || '',
          'Start Time': sh.start_time || '',
          'End Time': sh.end_time || '',
          Hours: computeHours(sh.start_time, sh.end_time),
        });
      });
    });

    // Sheet 3: Staff Total Hours by Location — aggregated for the filtered range
    // Key = `${location}||${staff_name}` → { hours, shifts }
    const totalsMap = {};
    history.forEach(e => {
      const lname = getLocationName(e.location_id);
      (e.staff_hours || []).forEach(sh => {
        const name = (sh.name || '').trim();
        if (!name) return;
        const hrs = computeHours(sh.start_time, sh.end_time);
        const key = `${lname}||${name}`;
        if (!totalsMap[key]) totalsMap[key] = { Location: lname, 'Staff Name': name, 'Total Hours': 0, Shifts: 0 };
        totalsMap[key]['Total Hours'] = Math.round((totalsMap[key]['Total Hours'] + hrs) * 100) / 100;
        totalsMap[key].Shifts += 1;
      });
    });
    const totalsRows = Object.values(totalsMap).sort((a, b) => {
      if (a.Location !== b.Location) return a.Location.localeCompare(b.Location);
      return b['Total Hours'] - a['Total Hours'];
    });

    // Group history by location for per-location sheets
    const byLocation = {};
    history.forEach(e => {
      const lname = getLocationName(e.location_id);
      if (!byLocation[lname]) byLocation[lname] = [];
      byLocation[lname].push(e);
    });

    // Excel sheet names: max 31 chars, cannot contain : \ / ? * [ ]
    const usedSheetNames = new Set(['Daily Sales', 'Staff Hours', 'Staff Totals by Location']);
    const sanitizeSheetName = (raw, prefix = '') => {
      const cleaned = (prefix + raw).replace(/[:\\/?*[\]]/g, '-').slice(0, 31).trim() || 'Sheet';
      let name = cleaned;
      let i = 2;
      while (usedSheetNames.has(name)) {
        const suffix = ` (${i})`;
        name = (cleaned.slice(0, 31 - suffix.length)) + suffix;
        i += 1;
      }
      usedSheetNames.add(name);
      return name;
    };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Daily Sales');
    if (staffRows.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(staffRows), 'Staff Hours');
    }
    if (totalsRows.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(totalsRows), 'Staff Totals by Location');
    }
    // Per-location Daily Sales sheets (sorted by location name)
    Object.keys(byLocation).sort().forEach(lname => {
      const rows = byLocation[lname].map(buildRow);
      const sheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, sheet, sanitizeSheetName(lname));
    });

    const fname = `daily-sales_${locName}_${rangeStart || 'start'}_to_${rangeEnd || 'end'}.xlsx`
      .replace(/\s+/g, '-');
    XLSX.writeFile(wb, fname);
  };

  const startEditStaffHours = (entry) => {
    setEditingEntry(entry.id);
    setEditStaffHours(entry.staff_hours?.length > 0 ? entry.staff_hours.map(sh => ({ ...sh })) : [{ name: '', start_time: '', end_time: '' }]);
  };

  const cancelEdit = () => { setEditingEntry(null); setEditStaffHours([]); };

  const updateEditRow = (i, field, val) => {
    const updated = [...editStaffHours];
    updated[i] = { ...updated[i], [field]: val };
    setEditStaffHours(updated);
  };

  const addEditRow = () => setEditStaffHours([...editStaffHours, { name: '', start_time: '', end_time: '' }]);
  const removeEditRow = (i) => setEditStaffHours(editStaffHours.filter((_, idx) => idx !== i));

  const saveEditStaffHours = async (entry) => {
    setSavingEdit(true);
    try {
      await api.adminCreateDailySales({
        location_id: entry.location_id,
        date: entry.date,
        sales: entry.sales,
        float_amount: entry.float_amount,
        cash_taken: entry.cash_taken,
        cash_taken_by: entry.cash_taken_by,
        staff_hours: editStaffHours.filter(sh => sh.name),
      });
      setHistory(prev => prev.map(e => e.id === entry.id ? { ...e, staff_hours: editStaffHours.filter(sh => sh.name) } : e));
      setEditingEntry(null);
    } catch (err) { alert('Failed to save: ' + err.message); }
    finally { setSavingEdit(false); }
  };

  if (authLoading) {
    return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>;
  }

  const font = { fontFamily: 'Outfit, sans-serif' };
  const inputBase = "w-full px-3 py-3 rounded-xl text-sm border-0 outline-none min-w-0";
  const inputStyle = { background: '#F5F5F7', color: '#1D1D1F', ...font, boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' };
  const labelCls = "block text-xs font-medium mb-1.5";
  const labelStyle = { color: '#86868B', ...font };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto overflow-hidden" data-testid="admin-daily-sales-page">
      <Link to="/admin" data-testid="back-to-dashboard" className="inline-flex items-center gap-1.5 text-xs font-medium mb-3 active:scale-95" style={{ color: '#007AFF', ...font }}>
        <ArrowLeft size={13} /> Dashboard
      </Link>
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: '#1D1D1F', ...font }}>Daily Sales</h1>
          <p className="text-xs sm:text-sm mt-1" style={{ color: '#86868B' }}>Record sales and staff hours</p>
        </div>
        <button
          data-testid="sales-logout-btn"
          onClick={handleSalesLogout}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-95 lg:hidden"
          style={{ color: '#FF3B30', background: 'rgba(255,59,48,0.06)', ...font }}
        >
          <LogOut size={14} />
          <span>Logout</span>
        </button>
      </div>

      {/* Tabs — only show if admin has history tab */}
      {isAdmin && (
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
            Sales Entry
          </button>
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
          <button
            data-testid="tab-grid"
            onClick={() => setActiveTab('grid')}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-sm font-medium transition-all text-center"
            style={{
              background: activeTab === 'grid' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'grid' ? '#1D1D1F' : '#86868B', ...font,
              boxShadow: activeTab === 'grid' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <Grid3X3 size={14} className="inline mr-1 -mt-0.5" />
            Overview
          </button>
        </div>
      )}

      {/* ========== ENTRY TAB ========== */}
      {activeTab === 'entry' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {successMsg && (
            <div data-testid="success-message" className="p-3 rounded-xl text-sm font-medium flex items-center justify-between gap-3" style={{ background: 'rgba(52,199,89,0.1)', color: '#34C759', ...font }}>
              <span>{successMsg}</span>
              <button
                data-testid="view-summary-btn"
                type="button"
                onClick={() => setShowSummary(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all active:scale-95"
                style={{ background: '#1D1D1F', color: '#FFFFFF' }}
              >
                <FileText size={13} /> Summary
              </button>
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

          {/* Date — compact width */}
          <div className="w-1/2">
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
                <select data-testid="sales-cash-by-input" value={cashTakenBy} onChange={e => setCashTakenBy(e.target.value)} required className={inputBase} style={inputStyle}>
                  <option value="">— Select staff —</option>
                  {staffNames.map(n => <option key={n} value={n}>{n}</option>)}
                  {cashTakenBy && !staffNames.includes(cashTakenBy) && (
                    <option value={cashTakenBy}>{cashTakenBy} (not in Staff Table)</option>
                  )}
                </select>
                {staffNames.length === 0 && (
                  <p className="text-[10px] mt-1" style={{ color: '#FF9500', ...font }}>
                    No staff in Staff Table — ask an admin to add staff first.
                  </p>
                )}
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
                  {/* Name — restricted to Staff Table entries only */}
                  <div className="mb-2">
                    <label className="block text-[11px] font-medium mb-1" style={{ color: '#86868B' }}>Staff Name</label>
                    <select
                      data-testid={`staff-name-${i}`}
                      value={sh.name || ''}
                      onChange={e => updateStaffRow(i, 'name', e.target.value)}
                      className={inputBase}
                      style={{ ...inputStyle, background: '#FFFFFF' }}
                    >
                      <option value="">— Select staff —</option>
                      {staffNames.map(n => <option key={n} value={n}>{n}</option>)}
                      {sh.name && !staffNames.includes(sh.name) && (
                        <option value={sh.name}>{sh.name} (not in Staff Table)</option>
                      )}
                    </select>
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
          </div>

          {/* Submit + Summary buttons */}
          <div className="flex gap-3">
            <button
              data-testid="save-sales-btn"
              type="submit"
              disabled={saving || !selectedLocation}
              className="flex-1 py-3.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 active:scale-[0.98]"
              style={{ background: '#1D1D1F', color: '#FFFFFF', ...font }}
            >
              {saving ? 'Saving...' : 'Save Sales Data'}
            </button>
            {successMsg && (
              <button
                data-testid="print-summary-btn"
                type="button"
                onClick={() => setShowSummary(true)}
                className="px-5 py-3.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] flex items-center gap-2"
                style={{ background: '#F5F5F7', color: '#1D1D1F', ...font }}
              >
                <FileText size={16} /> Print
              </button>
            )}
          </div>
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
            <button data-testid="download-sales-btn" onClick={handleDownloadHistory}
              disabled={!history.length}
              className="w-full sm:w-auto px-4 py-3 sm:py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#34C759', color: '#FFFFFF', ...font }}>
              <Download size={14} /> Download Excel{history.length ? ` (${history.length})` : ''}
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
            <>
              {/* Totals */}
              {(() => {
                const totalSales = history.reduce((sum, e) => sum + (e.sales || 0), 0);
                const totalCash = history.reduce((sum, e) => sum + (e.cash_taken || 0), 0);
                const actualCash = totalCash - totalExpenses;
                return (
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="p-3.5 rounded-2xl" style={{ background: '#FFFFFF' }}>
                      <p className="text-[11px] uppercase tracking-wider font-medium" style={{ color: '#86868B' }}>Total Sales</p>
                      <p className="text-lg font-bold mt-0.5" style={{ color: '#1D1D1F', ...font }}>{'\u00A3'}{totalSales.toFixed(2)}</p>
                    </div>
                    <div className="p-3.5 rounded-2xl" style={{ background: '#FFFFFF' }}>
                      <p className="text-[11px] uppercase tracking-wider font-medium" style={{ color: '#86868B' }}>Total Cash</p>
                      <p className="text-lg font-bold mt-0.5" style={{ color: '#1D1D1F', ...font }}>{'\u00A3'}{totalCash.toFixed(2)}</p>
                    </div>
                    <div className="p-3.5 rounded-2xl" style={{ background: '#FFFFFF' }}>
                      <p className="text-[11px] uppercase tracking-wider font-medium" style={{ color: '#86868B' }}>Actual Cash</p>
                      <p className="text-lg font-bold mt-0.5" style={{ color: actualCash >= 0 ? '#34C759' : '#FF3B30', ...font }}>{'\u00A3'}{actualCash.toFixed(2)}</p>
                      <p className="text-[9px] mt-0.5" style={{ color: '#C7C7CC' }}>Cash - Expenses</p>
                    </div>
                  </div>
                );
              })()}

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

                      {(entry.staff_hours?.length > 0 || editingEntry === entry.id) && (
                        <div className="mt-1">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[11px] font-medium" style={{ color: '#86868B' }}>Staff Hours</p>
                            {editingEntry !== entry.id ? (
                              <button
                                data-testid={`edit-staff-${entry.id}`}
                                onClick={() => startEditStaffHours(entry)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium active:scale-95 transition-all"
                                style={{ color: '#007AFF', background: 'rgba(0,122,255,0.06)' }}
                              >
                                <Pencil size={11} /> Edit
                              </button>
                            ) : (
                              <div className="flex gap-1.5">
                                <button
                                  data-testid={`add-edit-row-${entry.id}`}
                                  type="button"
                                  onClick={addEditRow}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium active:scale-95 transition-all"
                                  style={{ color: '#1D1D1F', background: '#F5F5F7' }}
                                >
                                  <Plus size={11} /> Add
                                </button>
                                <button
                                  data-testid={`cancel-edit-${entry.id}`}
                                  onClick={cancelEdit}
                                  className="px-2 py-1 rounded-lg text-[11px] font-medium active:scale-95 transition-all"
                                  style={{ color: '#86868B', background: '#F5F5F7' }}
                                >
                                  Cancel
                                </button>
                                <button
                                  data-testid={`save-edit-${entry.id}`}
                                  onClick={() => saveEditStaffHours(entry)}
                                  disabled={savingEdit}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium active:scale-95 transition-all disabled:opacity-50"
                                  style={{ color: '#FFFFFF', background: '#34C759' }}
                                >
                                  <Check size={11} /> {savingEdit ? '...' : 'Save'}
                                </button>
                              </div>
                            )}
                          </div>

                          {editingEntry !== entry.id ? (
                            <div className="space-y-1.5">
                              {entry.staff_hours.map((sh, i) => (
                                <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ background: '#F5F5F7' }}>
                                  <span className="text-sm font-medium" style={{ color: '#1D1D1F', ...font }}>{sh.name}</span>
                                  <span className="text-xs" style={{ color: '#86868B' }}>{sh.start_time} — {sh.end_time}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {editStaffHours.map((sh, i) => (
                                <div key={i} className="p-2.5 rounded-xl" style={{ background: '#F9F9FB', border: '1px solid rgba(0,0,0,0.04)' }}>
                                  <input
                                    type="text"
                                    placeholder="Staff name"
                                    value={sh.name}
                                    onChange={e => updateEditRow(i, 'name', e.target.value)}
                                    className="w-full px-2.5 py-2 rounded-lg text-sm border-0 outline-none mb-1.5"
                                    style={{ background: '#FFFFFF', color: '#1D1D1F', ...font, boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }}
                                  />
                                  <div className="flex gap-1.5 items-center">
                                    <input type="time" value={sh.start_time} onChange={e => updateEditRow(i, 'start_time', e.target.value)}
                                      className="flex-1 px-2.5 py-2 rounded-lg text-sm border-0 outline-none min-w-0"
                                      style={{ background: '#FFFFFF', color: '#1D1D1F', ...font, boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }} />
                                    <span className="text-xs" style={{ color: '#86868B' }}>to</span>
                                    <input type="time" value={sh.end_time} onChange={e => updateEditRow(i, 'end_time', e.target.value)}
                                      className="flex-1 px-2.5 py-2 rounded-lg text-sm border-0 outline-none min-w-0"
                                      style={{ background: '#FFFFFF', color: '#1D1D1F', ...font, boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }} />
                                    {editStaffHours.length > 1 && (
                                      <button type="button" onClick={() => removeEditRow(i)} className="p-2 rounded-lg shrink-0 active:scale-95"
                                        style={{ color: '#FF3B30', background: 'rgba(255,59,48,0.06)' }}>
                                        <Trash2 size={13} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
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
            </>
          )}
        </div>
      )}

      {/* ========== COMPLETION GRID TAB ========== */}
      {activeTab === 'grid' && isAdmin && (
        <div>
          {/* Month selector */}
          <div className="flex items-center gap-3 mb-5">
            <button onClick={() => {
              const [y, m] = gridMonth.split('-').map(Number);
              const d = new Date(y, m - 2, 1);
              setGridMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
            }} className="px-3 py-2 rounded-xl text-sm font-medium active:scale-95 transition-all" style={{ background: '#F5F5F7', color: '#1D1D1F', ...font }}>
              &larr;
            </button>
            <p className="text-sm font-semibold flex-1 text-center" style={{ color: '#1D1D1F', ...font }}>
              {new Date(gridMonth + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </p>
            <button onClick={() => {
              const [y, m] = gridMonth.split('-').map(Number);
              const d = new Date(y, m, 1);
              setGridMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
            }} className="px-3 py-2 rounded-xl text-sm font-medium active:scale-95 transition-all" style={{ background: '#F5F5F7', color: '#1D1D1F', ...font }}>
              &rarr;
            </button>
          </div>

          {gridLoading ? (
            <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>
          ) : !gridData ? (
            <div className="text-center py-16 rounded-2xl" style={{ background: '#FFFFFF' }}>
              <p className="text-sm" style={{ color: '#86868B', ...font }}>No data</p>
            </div>
          ) : (() => {
            const activeLocations = locations.filter(l => l.is_active);
            const days = Array.from({ length: gridData.days_in_month }, (_, i) => i + 1);
            const todayStr = new Date().toISOString().split('T')[0];
            return (
              <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF' }}>
                <div className="overflow-x-auto">
                  <table className="w-full" style={{ minWidth: `${days.length * 32 + 140}px` }}>
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-10 px-3 py-2.5 text-left text-[11px] font-semibold" style={{ background: '#F5F5F7', color: '#86868B', ...font, minWidth: 140 }}>Location</th>
                        {days.map(d => {
                          const dateStr = `${gridMonth}-${String(d).padStart(2, '0')}`;
                          const isToday = dateStr === todayStr;
                          const dayName = new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'narrow' });
                          return (
                            <th key={d} className="px-0.5 py-2 text-center" style={{ background: isToday ? '#E8E8ED' : '#F5F5F7', minWidth: 30 }}>
                              <span className="text-[9px] block" style={{ color: '#C7C7CC' }}>{dayName}</span>
                              <span className="text-[11px] font-medium" style={{ color: isToday ? '#1D1D1F' : '#86868B', ...font }}>{d}</span>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {activeLocations.map(loc => (
                        <tr key={loc.id} style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                          <td className="sticky left-0 z-10 px-3 py-2 text-xs font-medium truncate" style={{ background: '#FFFFFF', color: '#1D1D1F', ...font, maxWidth: 140 }}>{loc.name}</td>
                          {days.map(d => {
                            const dateStr = `${gridMonth}-${String(d).padStart(2, '0')}`;
                            const key = `${loc.id}|${dateStr}`;
                            const cellData = gridData.grid[key];
                            const isFuture = dateStr > todayStr;
                            const cellId = `${loc.id}-${d}`;
                            return (
                              <td key={d} className="px-0.5 py-2 text-center relative"
                                onMouseEnter={() => cellData && setHoveredCell(cellId)}
                                onMouseLeave={() => setHoveredCell(null)}>
                                {isFuture ? (
                                  <span className="inline-block w-5 h-5 rounded-md" style={{ background: '#F5F5F7' }} />
                                ) : cellData ? (
                                  <span className="inline-block w-5 h-5 rounded-md" style={{ background: '#34C759' }} />
                                ) : (
                                  <span className="inline-block w-5 h-5 rounded-md" style={{ background: '#FF3B30', opacity: 0.25 }} />
                                )}
                                {hoveredCell === cellId && cellData && (
                                  <div className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-1 p-2.5 rounded-xl text-left whitespace-nowrap" style={{ background: '#1D1D1F', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', minWidth: 130 }}>
                                    <p className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>{dateStr}</p>
                                    <p className="text-xs font-bold text-white" style={font}>{'\u00A3'}{cellData.sales?.toFixed(2)}</p>
                                    <div className="flex gap-3 mt-1">
                                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.6)' }}>Cash: {'\u00A3'}{cellData.cash_taken?.toFixed(2)}</span>
                                    </div>
                                    <p className="text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{cellData.updated_by}</p>
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0" style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #1D1D1F' }} />
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Legend */}
                <div className="flex items-center gap-4 px-4 py-3" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                  <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded" style={{ background: '#34C759' }} /><span className="text-[11px]" style={{ color: '#86868B' }}>Submitted</span></div>
                  <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded" style={{ background: '#FF3B30', opacity: 0.25 }} /><span className="text-[11px]" style={{ color: '#86868B' }}>Missing</span></div>
                  <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded" style={{ background: '#F5F5F7' }} /><span className="text-[11px]" style={{ color: '#86868B' }}>Future</span></div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ========== SUMMARY OVERLAY ========== */}
      {showSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
          <div ref={summaryRef} className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', maxHeight: '90vh', overflowY: 'auto' }}>
            {/* Summary Header */}
            <div className="px-5 pt-6 pb-4 text-center" style={{ background: '#1D1D1F' }}>
              <p className="text-[11px] font-medium uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.5)', ...font }}>Daily Sales Report</p>
              <h2 className="text-lg font-semibold text-white" style={font}>{getLocationName(selectedLocation)}</h2>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.6)', ...font }}>{formatDate(entryDate)}</p>
            </div>

            {/* Sales Figures */}
            <div className="px-5 py-5">
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wider font-medium" style={{ color: '#86868B' }}>Total Sales</p>
                  <p className="text-xl font-bold mt-0.5" style={{ color: '#1D1D1F', ...font }}>{'\u00A3'}{(parseFloat(sales) || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider font-medium" style={{ color: '#86868B' }}>Float</p>
                  <p className="text-xl font-bold mt-0.5" style={{ color: '#1D1D1F', ...font }}>{'\u00A3'}{(parseFloat(floatAmount) || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider font-medium" style={{ color: '#86868B' }}>Cash Taken</p>
                  <p className="text-xl font-bold mt-0.5" style={{ color: '#1D1D1F', ...font }}>{'\u00A3'}{(parseFloat(cashTaken) || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider font-medium" style={{ color: '#86868B' }}>Cash Taken By</p>
                  <p className="text-xl font-bold mt-0.5" style={{ color: '#1D1D1F', ...font }}>{cashTakenBy || '\u2014'}</p>
                </div>
              </div>

              {/* Staff Hours */}
              {staffHours.filter(sh => sh.name).length > 0 && (
                <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                  <p className="text-[11px] uppercase tracking-wider font-medium mb-3" style={{ color: '#86868B' }}>Staff Hours</p>
                  <div className="space-y-2">
                    {staffHours.filter(sh => sh.name).map((sh, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ background: '#F5F5F7' }}>
                        <span className="text-sm font-semibold" style={{ color: '#1D1D1F', ...font }}>{sh.name}</span>
                        <span className="text-xs font-medium" style={{ color: '#86868B', ...font }}>{sh.start_time} — {sh.end_time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submitted by */}
              <div className="mt-4 pt-3 text-center" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                <p className="text-[11px]" style={{ color: '#C7C7CC' }}>Submitted by {user?.email}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="px-5 pb-5 space-y-2.5">
              <button
                data-testid="share-whatsapp-btn"
                onClick={shareWhatsApp}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
                style={{ background: '#25D366', color: '#FFFFFF', ...font }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Share via WhatsApp
              </button>
              <button
                data-testid="close-summary-btn"
                onClick={() => setShowSummary(false)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all active:scale-[0.98]"
                style={{ background: '#F5F5F7', color: '#1D1D1F', ...font }}
              >
                <X size={16} /> Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDailySales;
