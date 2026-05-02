import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Thermometer, Plus, Trash2, Check, Download, Clock, Settings } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';
import * as XLSX from 'xlsx';

const TEMP_LIMITS = { fridge: { max: 8, label: 'Max 8°C' }, freezer: { max: -18, label: '-18°C or below' }, chiller: { max: 8, label: 'Max 8°C' } };
const isOutOfRange = (temp, type) => {
  if (temp === null || temp === undefined || temp === '') return false;
  const t = parseFloat(temp);
  if (isNaN(t)) return false;
  return type === 'freezer' ? t > -18 : t > 8;
};

const AdminTempMonitor = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isStaff, isAdmin, loading: authLoading } = useAuth();
  const { locations } = useLocation2();

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [activeTab, setActiveTab] = useState('record');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [units, setUnits] = useState([]);
  const [timeSlots, setTimeSlots] = useState(['08:00', '13:00']);
  const [readings, setReadings] = useState({});
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [entryDate, setEntryDate] = useState(today);

  const [viewMonth, setViewMonth] = useState(currentMonth);
  const [monthlyLogs, setMonthlyLogs] = useState([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  const [showAddUnit, setShowAddUnit] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitType, setNewUnitType] = useState('fridge');

  const [showTimeSettings, setShowTimeSettings] = useState(false);
  const [editTimeSlots, setEditTimeSlots] = useState([]);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isStaff)) navigate('/admin-login');
  }, [authLoading, isAuthenticated, isStaff, navigate]);

  useEffect(() => {
    if (selectedLocation) { fetchUnits(); fetchTimeSlots(); }
  }, [selectedLocation]);

  useEffect(() => {
    if (selectedLocation && units.length > 0) loadExistingReadings();
  }, [selectedLocation, entryDate, units]);

  useEffect(() => {
    if (activeTab === 'monthly' && selectedLocation) fetchMonthly();
  }, [activeTab, viewMonth, selectedLocation]);

  const fetchUnits = async () => {
    try {
      let u = await api.adminGetTempUnits(selectedLocation);
      if (u.length === 0 && isAdmin) {
        await api.adminSeedTempDefaults();
        u = await api.adminGetTempUnits(selectedLocation);
      }
      setUnits(u);
    } catch {}
  };

  const fetchTimeSlots = async () => {
    try {
      const d = await api.adminGetTempTimeSlots(selectedLocation);
      setTimeSlots(d.time_slots || ['08:00', '13:00']);
    } catch {}
  };

  const loadExistingReadings = async () => {
    try {
      const logs = await api.adminGetTempLogs(selectedLocation, { date: entryDate });
      const r = {};
      logs.forEach(l => {
        const temps = {};
        Object.keys(l).forEach(k => {
          if (k.startsWith('temp_') && k !== 'temp_logs') {
            const slot = k.replace('temp_', '').replace(/(\d{2})(\d{2})/, '$1:$2');
            temps[slot] = l[k];
          }
        });
        r[l.unit_id] = temps;
      });
      setReadings(r);
    } catch {}
  };

  const updateReading = (unitId, slot, val) => {
    setReadings(prev => ({ ...prev, [unitId]: { ...prev[unitId], [slot]: val } }));
  };

  const handleSave = async () => {
    if (!selectedLocation) return;
    setSaving(true); setSuccessMsg('');
    try {
      const readingsList = units.map(u => {
        const temps = {};
        timeSlots.forEach(slot => {
          const val = readings[u.id]?.[slot];
          if (val !== undefined && val !== '') temps[slot] = parseFloat(val);
        });
        return { unit_id: u.id, temps };
      }).filter(r => Object.keys(r.temps).length > 0);
      if (readingsList.length === 0) { alert('Enter at least one temperature'); setSaving(false); return; }
      await api.adminSubmitTempLog({ location_id: selectedLocation, date: entryDate, readings: readingsList });
      setSuccessMsg('Temperatures saved!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) { alert('Failed: ' + err.message); }
    finally { setSaving(false); }
  };

  const fetchMonthly = async () => {
    if (!selectedLocation) return;
    setMonthlyLoading(true);
    try { setMonthlyLogs(await api.adminGetTempLogs(selectedLocation, { month: viewMonth })); }
    catch {} finally { setMonthlyLoading(false); }
  };

  const handleAddUnit = async () => {
    if (!newUnitName || !selectedLocation) return;
    try {
      await api.adminCreateTempUnit({ name: newUnitName, unit_type: newUnitType, location_id: selectedLocation, time_slots: timeSlots });
      setNewUnitName(''); setShowAddUnit(false); fetchUnits();
    } catch (err) { alert(err.message); }
  };

  const handleDeleteUnit = async (id) => {
    if (!window.confirm('Remove this unit?')) return;
    try { await api.adminDeleteTempUnit(id); fetchUnits(); } catch (err) { alert(err.message); }
  };

  const handleSaveTimeSlots = async () => {
    try {
      await api.adminUpdateTempTimeSlots(selectedLocation, editTimeSlots.filter(s => s));
      setTimeSlots(editTimeSlots.filter(s => s));
      setShowTimeSettings(false);
    } catch (err) { alert(err.message); }
  };

  const exportMonthly = () => {
    if (!monthlyLogs.length) return;
    const loc = locations.find(l => l.id === selectedLocation)?.name || selectedLocation;
    const monthLabel = new Date(viewMonth + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const rows = monthlyLogs.map(l => {
      const row = { 'Date': l.date, 'Unit': l.unit_name, 'Type': l.unit_type };
      timeSlots.forEach(slot => { row[slot] = l[`temp_${slot.replace(':', '')}`] ?? ''; });
      row['Recorded By'] = l.updated_by_name || l.created_by_name || '';
      return row;
    });
    rows.push({});
    rows.push({ 'Date': `Location: ${loc}`, 'Unit': `Month: ${monthLabel}` });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Temp Log');
    XLSX.writeFile(wb, `Jollys-TempLog-${loc.replace(/\s/g, '_')}-${viewMonth}.xlsx`);
  };

  if (authLoading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>;

  const font = { fontFamily: 'Outfit, sans-serif' };
  const inputBase = "w-full px-3 py-3 rounded-xl text-sm border-0 outline-none min-w-0";
  const inputStyle = { background: '#F5F5F7', color: '#1D1D1F', ...font, boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto" data-testid="admin-temp-monitor-page">
      <div className="mb-5">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: '#1D1D1F', ...font }}>Temp Monitoring</h1>
        <p className="text-xs sm:text-sm mt-1" style={{ color: '#86868B' }}>Fridge, Freezer & Chiller daily checks</p>
      </div>

      <div className="mb-4">
        <select data-testid="temp-location" value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)}
          className={inputBase} style={{ ...inputStyle, background: '#FFFFFF' }}>
          <option value="">Select location...</option>
          {locations.filter(l => l.is_active).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {selectedLocation && (
        <>
          {isAdmin && (
            <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: '#E8E8ED' }}>
              {['record', 'monthly'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all text-center"
                  style={{ background: activeTab === tab ? '#FFFFFF' : 'transparent', color: activeTab === tab ? '#1D1D1F' : '#86868B', ...font, boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                  {tab === 'record' ? 'Record' : 'Monthly View'}
                </button>
              ))}
            </div>
          )}

          {/* ========= RECORD TAB ========= */}
          {activeTab === 'record' && (
            <div>
              {successMsg && (
                <div className="p-3 rounded-xl text-sm font-medium mb-4" style={{ background: 'rgba(52,199,89,0.1)', color: '#34C759', ...font }}>{successMsg}</div>
              )}

              <div className="flex gap-3 mb-4 items-end">
                <div className="w-1/2">
                  <label className="block text-xs font-medium mb-1" style={{ color: '#86868B', ...font }}>Date</label>
                  <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className={inputBase} style={{ ...inputStyle, background: '#FFFFFF' }} />
                </div>
                {isAdmin && (
                  <button onClick={() => { setEditTimeSlots([...timeSlots]); setShowTimeSettings(!showTimeSettings); }}
                    className="flex items-center gap-1.5 px-3 py-3 rounded-xl text-xs font-medium active:scale-95 transition-all"
                    style={{ background: '#F5F5F7', color: '#007AFF', ...font }}>
                    <Clock size={14} /> Times
                  </button>
                )}
              </div>

              {/* Time slots settings */}
              {showTimeSettings && isAdmin && (
                <div className="p-4 rounded-2xl mb-4 space-y-3" style={{ background: '#FFFFFF', border: '2px solid #007AFF' }}>
                  <p className="text-xs font-semibold" style={{ color: '#1D1D1F', ...font }}>Recording Times for {locations.find(l => l.id === selectedLocation)?.name}</p>
                  <div className="space-y-2">
                    {editTimeSlots.map((slot, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input type="time" value={slot} onChange={e => { const s = [...editTimeSlots]; s[i] = e.target.value; setEditTimeSlots(s); }}
                          className="flex-1 px-3 py-2.5 rounded-xl text-sm border-0 outline-none" style={inputStyle} />
                        {editTimeSlots.length > 1 && (
                          <button onClick={() => setEditTimeSlots(editTimeSlots.filter((_, j) => j !== i))} className="p-2 rounded-lg" style={{ color: '#FF3B30' }}><Trash2 size={14} /></button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setEditTimeSlots([...editTimeSlots, ''])} className="flex items-center gap-1 text-xs font-medium" style={{ color: '#007AFF' }}><Plus size={13} /> Add Time</button>
                  <div className="flex gap-2 pt-1">
                    <button onClick={handleSaveTimeSlots} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: '#34C759', color: '#FFFFFF', ...font }}><Check size={14} className="inline mr-1" />Save</button>
                    <button onClick={() => setShowTimeSettings(false)} className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: '#F5F5F7', color: '#1D1D1F', ...font }}>Cancel</button>
                  </div>
                </div>
              )}

              <div className="p-3 rounded-xl mb-4 text-xs" style={{ background: 'rgba(0,122,255,0.06)', color: '#007AFF', ...font }}>
                <strong>Fridge/Chiller:</strong> below 8°C &nbsp;|&nbsp; <strong>Freezer:</strong> -18°C or colder
              </div>

              {units.length === 0 ? (
                <div className="text-center py-12 rounded-2xl" style={{ background: '#FFFFFF' }}>
                  <Thermometer size={32} className="mx-auto mb-3" style={{ color: '#C7C7CC' }} />
                  <p className="text-sm" style={{ color: '#86868B', ...font }}>No units configured.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {units.map(u => {
                    const r = readings[u.id] || {};
                    const limit = TEMP_LIMITS[u.unit_type] || TEMP_LIMITS.fridge;
                    const anyBad = timeSlots.some(slot => isOutOfRange(r[slot], u.unit_type));
                    return (
                      <div key={u.id} className="p-4 rounded-2xl" style={{ background: '#FFFFFF', border: anyBad ? '2px solid #FF3B30' : '1px solid rgba(0,0,0,0.04)' }}>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-sm font-semibold" style={{ color: '#1D1D1F', ...font }}>{u.name}</p>
                            <p className="text-[11px]" style={{ color: '#86868B' }}>{u.unit_type.charAt(0).toUpperCase() + u.unit_type.slice(1)} · {limit.label}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {isAdmin && <button onClick={() => handleDeleteUnit(u.id)} className="p-1.5 rounded-lg" style={{ color: '#C7C7CC' }}><Trash2 size={13} /></button>}
                            <Thermometer size={18} style={{ color: anyBad ? '#FF3B30' : '#86868B' }} />
                          </div>
                        </div>
                        <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${timeSlots.length}, 1fr)` }}>
                          {timeSlots.map(slot => {
                            const val = r[slot] ?? '';
                            const bad = isOutOfRange(val, u.unit_type);
                            return (
                              <div key={slot}>
                                <label className="block text-[11px] font-medium mb-1" style={{ color: '#86868B' }}>{slot}</label>
                                <input
                                  data-testid={`temp-${slot.replace(':', '')}-${u.id}`}
                                  type="number" step="0.1" inputMode="decimal" placeholder="°C"
                                  value={val}
                                  onChange={e => updateReading(u.id, slot, e.target.value)}
                                  className={inputBase}
                                  style={{ ...inputStyle, background: bad ? 'rgba(255,59,48,0.06)' : '#F5F5F7', color: bad ? '#FF3B30' : '#1D1D1F' }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {isAdmin && (
                <div className="mt-4">
                  {showAddUnit ? (
                    <div className="p-4 rounded-2xl space-y-3" style={{ background: '#FFFFFF' }}>
                      <input type="text" placeholder="Unit name (e.g. Fridge 3)" value={newUnitName} onChange={e => setNewUnitName(e.target.value)} className={inputBase} style={inputStyle} />
                      <select value={newUnitType} onChange={e => setNewUnitType(e.target.value)} className={inputBase} style={inputStyle}>
                        <option value="fridge">Fridge</option>
                        <option value="freezer">Freezer</option>
                        <option value="chiller">Display Chiller</option>
                      </select>
                      <div className="flex gap-2">
                        <button onClick={handleAddUnit} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: '#34C759', color: '#FFFFFF', ...font }}><Check size={14} className="inline mr-1" />Add</button>
                        <button onClick={() => setShowAddUnit(false)} className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: '#F5F5F7', color: '#1D1D1F', ...font }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowAddUnit(true)} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#007AFF', ...font }}><Plus size={14} /> Add Unit</button>
                  )}
                </div>
              )}

              {units.length > 0 && (
                <button data-testid="save-temps-btn" onClick={handleSave} disabled={saving}
                  className="w-full mt-5 py-3.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 active:scale-[0.98]"
                  style={{ background: '#1D1D1F', color: '#FFFFFF', ...font }}>
                  {saving ? 'Saving...' : 'Save Temperatures'}
                </button>
              )}
            </div>
          )}

          {/* ========= MONTHLY VIEW TAB ========= */}
          {activeTab === 'monthly' && isAdmin && (
            <div>
              <div className="flex items-center gap-3 mb-5">
                <button onClick={() => {
                  const [y, m] = viewMonth.split('-').map(Number);
                  const d = new Date(y, m - 2, 1);
                  setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                }} className="px-3 py-2 rounded-xl text-sm font-medium active:scale-95" style={{ background: '#F5F5F7', color: '#1D1D1F', ...font }}>&larr;</button>
                <p className="text-sm font-semibold flex-1 text-center" style={{ color: '#1D1D1F', ...font }}>
                  {new Date(viewMonth + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                </p>
                <button onClick={exportMonthly} disabled={!monthlyLogs.length} className="px-3 py-2 rounded-xl text-sm font-medium active:scale-95 disabled:opacity-40" style={{ background: '#F5F5F7', color: '#1D1D1F', ...font }}><Download size={14} /></button>
                <button onClick={() => {
                  const [y, m] = viewMonth.split('-').map(Number);
                  const d = new Date(y, m, 1);
                  setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                }} className="px-3 py-2 rounded-xl text-sm font-medium active:scale-95" style={{ background: '#F5F5F7', color: '#1D1D1F', ...font }}>&rarr;</button>
              </div>

              {monthlyLoading ? (
                <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>
              ) : monthlyLogs.length === 0 ? (
                <div className="text-center py-16 rounded-2xl" style={{ background: '#FFFFFF' }}>
                  <Thermometer size={32} className="mx-auto mb-3" style={{ color: '#C7C7CC' }} />
                  <p className="text-sm" style={{ color: '#86868B', ...font }}>No temperature records for this month.</p>
                </div>
              ) : (
                <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF' }}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs" style={font}>
                      <thead>
                        <tr style={{ background: '#F5F5F7' }}>
                          <th className="px-3 py-2.5 text-left font-semibold" style={{ color: '#86868B' }}>Date</th>
                          <th className="px-3 py-2.5 text-left font-semibold" style={{ color: '#86868B' }}>Unit</th>
                          {timeSlots.map(slot => (
                            <th key={slot} className="px-3 py-2.5 text-center font-semibold" style={{ color: '#86868B' }}>{slot}</th>
                          ))}
                          <th className="px-3 py-2.5 text-left font-semibold" style={{ color: '#86868B' }}>By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyLogs.map((l, i) => (
                          <tr key={l.id || i} style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                            <td className="px-3 py-2.5 font-medium" style={{ color: '#1D1D1F' }}>{l.date?.substring(5)}</td>
                            <td className="px-3 py-2.5" style={{ color: '#3A3A3C' }}>{l.unit_name}</td>
                            {timeSlots.map(slot => {
                              const key = `temp_${slot.replace(':', '')}`;
                              const val = l[key];
                              const bad = isOutOfRange(val, l.unit_type);
                              return (
                                <td key={slot} className="px-3 py-2.5 text-center font-semibold" style={{ color: bad ? '#FF3B30' : '#1D1D1F' }}>
                                  {val != null ? `${val}°` : '—'}
                                </td>
                              );
                            })}
                            <td className="px-3 py-2.5" style={{ color: '#86868B' }}>{l.updated_by_name || l.created_by_name || ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminTempMonitor;
