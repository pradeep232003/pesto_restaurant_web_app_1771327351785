import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Gauge, Plus, Trash2, Check, X, ArrowLeft, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';

const AdminProbeCalibration = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isStaff, isAdmin, loading: authLoading } = useAuth();
  const { locations } = useLocation2();

  const today = new Date().toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 29 * 864e5).toISOString().split('T')[0];

  const [activeTab, setActiveTab] = useState('today');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ date: today, probe_no: '', tested_by: '', cold_temp: '', hot_temp: '', comments: '' });

  const [historyStart, setHistoryStart] = useState(monthAgo);
  const [historyEnd, setHistoryEnd] = useState(today);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isStaff)) navigate('/admin-login');
  }, [authLoading, isAuthenticated, isStaff, navigate]);

  useEffect(() => { if (selectedLocation && activeTab === 'today') fetchEntries(); }, [selectedLocation, activeTab]);
  useEffect(() => { if (selectedLocation && activeTab === 'history' && isAdmin) fetchHistory(); }, [selectedLocation, activeTab, historyStart, historyEnd]);

  const fetchEntries = async () => {
    setLoading(true);
    try { setEntries(await api.adminListProbeCalibration({ location_id: selectedLocation, start_date: today, end_date: today })); }
    catch (err) { alert('Failed: ' + err.message); }
    finally { setLoading(false); }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try { setHistory(await api.adminListProbeCalibration({ location_id: selectedLocation, start_date: historyStart, end_date: historyEnd })); }
    catch (err) { alert('Failed: ' + err.message); }
    finally { setHistoryLoading(false); }
  };

  const handleSave = async () => {
    if (!form.probe_no) return;
    setSaving(true);
    try {
      await api.adminCreateProbeCalibration({
        location_id: selectedLocation,
        date: form.date,
        probe_no: form.probe_no,
        tested_by: form.tested_by,
        cold_temp: form.cold_temp === '' ? null : parseFloat(form.cold_temp),
        hot_temp: form.hot_temp === '' ? null : parseFloat(form.hot_temp),
        comments: form.comments,
      });
      setForm({ date: today, probe_no: '', tested_by: '', cold_temp: '', hot_temp: '', comments: '' });
      setShowForm(false);
      await fetchEntries();
    } catch (err) { alert('Failed: ' + err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this entry?')) return;
    try { await api.adminDeleteProbeCalibration(id); if (activeTab === 'today') fetchEntries(); else fetchHistory(); }
    catch (err) { alert('Failed: ' + err.message); }
  };

  const handleDownload = () => {
    const locName = locations.find(l => l.id === selectedLocation)?.name || 'all';
    const rows = history.map(e => ({
      Date: e.date, 'Probe No': e.probe_no, 'Tested By': e.tested_by || '',
      'Cold °C': e.cold_temp, 'Hot °C': e.hot_temp,
      Pass: e.passed ? 'Yes' : 'No', Comments: e.comments || '',
      'Logged by': e.created_by_name || e.created_by,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Probe Calibration');
    XLSX.writeFile(wb, `probe-calibration_${locName}_${historyStart}_to_${historyEnd}.xlsx`);
  };

  if (authLoading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>;

  const font = { fontFamily: 'Outfit, sans-serif' };
  const inputStyle = { background: '#F5F5F7', color: '#1D1D1F', ...font, boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' };
  const list = activeTab === 'today' ? entries : history;
  const listLoading = activeTab === 'today' ? loading : historyLoading;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto" data-testid="admin-probe-calibration-page">
      <Link to="/admin" data-testid="back-to-dashboard" className="inline-flex items-center gap-1.5 text-xs font-medium mb-3 active:scale-95" style={{ color: '#007AFF', ...font }}>
        <ArrowLeft size={13} /> Dashboard
      </Link>
      <div className="mb-5">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: '#1D1D1F', ...font }}>Probe Calibration</h1>
        <p className="text-xs sm:text-sm mt-1" style={{ color: '#86868B' }}>Test in boiling (100°C ± 1) and iced water (0°C ± 1). Use kettle or pan — never coffee machine.</p>
      </div>

      <div className="mb-4">
        <select data-testid="probe-location" value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)}
          className="w-full px-3 py-3 rounded-xl text-sm border-0 outline-none" style={{ ...inputStyle, background: '#FFFFFF' }}>
          <option value="">Select location...</option>
          {locations.filter(l => l.is_active).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {!selectedLocation ? (
        <div className="text-center py-16 rounded-2xl" style={{ background: '#FFFFFF' }}>
          <Gauge size={32} className="mx-auto mb-3" style={{ color: '#C7C7CC' }} />
          <p className="text-sm" style={{ color: '#86868B', ...font }}>Select a location above to begin.</p>
        </div>
      ) : (
        <>
          {isAdmin && (
            <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: '#E8E8ED' }}>
              {[{k:'today',l:'Today'},{k:'history',l:'History'}].map(t => (
                <button key={t.k} data-testid={`probe-tab-${t.k}`} onClick={() => setActiveTab(t.k)}
                  className="flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                  style={{ background: activeTab === t.k ? '#FFFFFF' : 'transparent', color: activeTab === t.k ? '#1D1D1F' : '#86868B', ...font, boxShadow: activeTab === t.k ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                  {t.l}
                </button>
              ))}
            </div>
          )}

          {activeTab === 'today' && (
            <button data-testid="add-probe-btn" onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold mb-4 active:scale-95"
              style={{ background: '#1D1D1F', color: '#FFFFFF', ...font }}>
              <Plus size={13} /> {showForm ? 'Cancel' : 'New Test'}
            </button>
          )}

          {activeTab === 'today' && showForm && (
            <div className="p-4 rounded-2xl mb-4 space-y-3" style={{ background: '#FFFFFF' }}>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm border-0 outline-none" style={inputStyle} />
              <div className="grid grid-cols-2 gap-3">
                <input data-testid="probe-no" placeholder="Probe No." value={form.probe_no} onChange={e => setForm({ ...form, probe_no: e.target.value })} className="px-3 py-2.5 rounded-xl text-sm border-0 outline-none" style={inputStyle} />
                <input placeholder="Tested by" value={form.tested_by} onChange={e => setForm({ ...form, tested_by: e.target.value })} className="px-3 py-2.5 rounded-xl text-sm border-0 outline-none" style={inputStyle} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input data-testid="cold-temp" type="number" step="0.1" placeholder="Cold °C (0 ± 1)" value={form.cold_temp} onChange={e => setForm({ ...form, cold_temp: e.target.value })} className="px-3 py-2.5 rounded-xl text-sm border-0 outline-none" style={inputStyle} />
                <input data-testid="hot-temp" type="number" step="0.1" placeholder="Hot °C (100 ± 1)" value={form.hot_temp} onChange={e => setForm({ ...form, hot_temp: e.target.value })} className="px-3 py-2.5 rounded-xl text-sm border-0 outline-none" style={inputStyle} />
              </div>
              <textarea rows={2} placeholder="Comments / action taken (optional)" value={form.comments} onChange={e => setForm({ ...form, comments: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm border-0 outline-none resize-none" style={inputStyle} />
              <button data-testid="save-probe-btn" disabled={saving || !form.probe_no} onClick={handleSave}
                className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 active:scale-[0.98]"
                style={{ background: '#34C759', color: '#FFFFFF', ...font }}>{saving ? 'Saving...' : 'Save Test'}</button>
            </div>
          )}

          {activeTab === 'history' && isAdmin && (
            <div className="p-4 rounded-2xl mb-4 space-y-3" style={{ background: '#FFFFFF' }}>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={historyStart} onChange={e => setHistoryStart(e.target.value)} className="px-3 py-2.5 rounded-xl text-sm border-0 outline-none" style={inputStyle} />
                <input type="date" value={historyEnd} onChange={e => setHistoryEnd(e.target.value)} className="px-3 py-2.5 rounded-xl text-sm border-0 outline-none" style={inputStyle} />
              </div>
              <button data-testid="download-probe-btn" disabled={!history.length} onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-40 active:scale-95"
                style={{ background: '#007AFF', color: '#FFFFFF', ...font }}>
                <Download size={13} /> Download Excel ({history.length})
              </button>
            </div>
          )}

          {listLoading ? (
            <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>
          ) : list.length === 0 ? (
            <div className="text-center py-16 rounded-2xl" style={{ background: '#FFFFFF' }}>
              <Gauge size={32} className="mx-auto mb-3" style={{ color: '#C7C7CC' }} />
              <p className="text-sm" style={{ color: '#86868B', ...font }}>{activeTab === 'today' ? 'No tests today.' : 'No tests in this range.'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {list.map(e => (
                <div key={e.id} data-testid={`probe-entry-${e.id}`} className="p-4 rounded-2xl flex items-start gap-3" style={{ background: '#FFFFFF' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: e.passed ? 'rgba(52,199,89,0.12)' : 'rgba(255,59,48,0.12)' }}>
                    {e.passed ? <Check size={18} style={{ color: '#34C759' }} /> : <X size={18} style={{ color: '#FF3B30' }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: '#1D1D1F', ...font }}>Probe {e.probe_no}{e.tested_by ? ` · ${e.tested_by}` : ''}</p>
                    <p className="text-[11px]" style={{ color: '#86868B' }}>
                      {e.date}
                      {e.cold_temp != null && ` · Cold ${e.cold_temp}°C`}
                      {e.hot_temp != null && ` · Hot ${e.hot_temp}°C`}
                    </p>
                    {e.comments && <p className="text-[11px] mt-1" style={{ color: '#FF9500' }}>⚠ {e.comments}</p>}
                  </div>
                  {isAdmin && (
                    <button data-testid={`del-probe-${e.id}`} onClick={() => handleDelete(e.id)} className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-95" style={{ background: 'rgba(255,59,48,0.1)' }}>
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

export default AdminProbeCalibration;
