import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Power, Check, X, ChevronDown, Plus, Pencil, Trash2, Globe, MapPin, Save, ArrowLeft } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';

const AdminKitchenClosedown = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isStaff, isAdmin, loading: authLoading } = useAuth();
  const { locations, adminLocationId: selectedLocation, setAdminLocationId: setSelectedLocation } = useLocation2();

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [activeTab, setActiveTab] = useState('check');
  const [entryDate, setEntryDate] = useState(today);
  const [items, setItems] = useState([]);
  const [checks, setChecks] = useState({});
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [completedBy, setCompletedBy] = useState('');

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const [gridMonth, setGridMonth] = useState(currentMonth);
  const [gridData, setGridData] = useState(null);
  const [gridLoading, setGridLoading] = useState(false);

  const [allItems, setAllItems] = useState([]);
  const [manageLoading, setManageLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editScope, setEditScope] = useState('global');
  const [editLocId, setEditLocId] = useState('');
  const [newText, setNewText] = useState('');
  const [newScope, setNewScope] = useState('global');
  const [newLocId, setNewLocId] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isStaff)) navigate('/admin-login');
  }, [authLoading, isAuthenticated, isStaff, navigate]);

  useEffect(() => { fetchItems(); }, [selectedLocation]);

  useEffect(() => {
    if (selectedLocation && entryDate) loadExisting();
  }, [selectedLocation, entryDate]);

  useEffect(() => {
    if (activeTab === 'history' && isAdmin) fetchHistory();
  }, [activeTab, selectedLocation]);

  useEffect(() => {
    if (activeTab === 'overview' && isAdmin) fetchGrid();
  }, [activeTab, gridMonth]);

  useEffect(() => {
    if (activeTab === 'manage' && isAdmin) fetchAllItems();
  }, [activeTab]);

  const fetchItems = async () => {
    try { setItems(await api.adminGetClosedownItems(selectedLocation || undefined)); } catch {}
  };

  const fetchAllItems = async () => {
    setManageLoading(true);
    try { setAllItems(await api.adminListAllClosedownItems()); }
    catch (err) { alert('Failed to load items: ' + err.message); }
    finally { setManageLoading(false); }
  };

  const handleAddItem = async () => {
    if (!newText.trim()) return;
    try {
      await api.adminCreateClosedownItem({
        text: newText.trim(),
        location_id: newScope === 'location' ? newLocId : null,
      });
      setNewText(''); setNewScope('global'); setNewLocId(''); setShowAddForm(false);
      await fetchAllItems();
      await fetchItems();
    } catch (err) { alert('Failed to add item: ' + err.message); }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditText(item.text);
    setEditScope(item.location_id ? 'location' : 'global');
    setEditLocId(item.location_id || '');
  };

  const saveEdit = async () => {
    if (!editText.trim()) return;
    try {
      await api.adminUpdateClosedownItem(editingId, {
        text: editText.trim(),
        scope: editScope,
        location_id: editScope === 'location' ? editLocId : null,
      });
      setEditingId(null);
      await fetchAllItems();
      await fetchItems();
    } catch (err) { alert('Failed to update item: ' + err.message); }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.text.slice(0, 60)}${item.text.length > 60 ? '…' : ''}"?`)) return;
    try {
      await api.adminDeleteClosedownItem(item.id);
      await fetchAllItems();
      await fetchItems();
    } catch (err) { alert('Failed to delete: ' + err.message); }
  };

  const loadExisting = async () => {
    setLoading(true);
    try {
      const d = await api.adminGetClosedown(selectedLocation, entryDate);
      if (d) {
        setChecks(d.checks || {});
        setNote(d.note || '');
        setCompletedBy(d.completed_by_name || '');
      } else {
        setChecks({}); setNote(''); setCompletedBy('');
      }
    } catch { setChecks({}); setNote(''); setCompletedBy(''); }
    finally { setLoading(false); }
  };

  const toggleCheck = (itemId) => {
    setChecks(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const toggleAll = (val) => {
    const newChecks = {};
    items.forEach(i => { newChecks[i.id] = val; });
    setChecks(newChecks);
  };

  const handleSave = async () => {
    if (!selectedLocation) return;
    setSaving(true); setSuccessMsg('');
    try {
      const res = await api.adminSubmitClosedown({ location_id: selectedLocation, date: entryDate, checks, note });
      setSuccessMsg(`Saved! ${res.passed}/${res.total} checks passed`);
      setCompletedBy(user?.name || user?.email || '');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) { alert('Failed: ' + err.message); }
    finally { setSaving(false); }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try { setHistory(await api.adminGetClosedownHistory({ location_id: selectedLocation || undefined })); }
    catch {} finally { setHistoryLoading(false); }
  };

  const fetchGrid = async () => {
    setGridLoading(true);
    try { setGridData(await api.adminGetClosedownCompletion(gridMonth)); }
    catch {} finally { setGridLoading(false); }
  };

  const passedCount = items.filter(i => checks[i.id]).length;
  const totalCount = items.length;
  const getLocationName = (locId) => locations.find(l => l.id === locId)?.name || locId;

  if (authLoading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>;

  const font = { fontFamily: 'Outfit, sans-serif' };
  const inputBase = "w-full px-3 py-3 rounded-xl text-sm border-0 outline-none min-w-0";
  const inputStyle = { background: '#F5F5F7', color: '#1D1D1F', ...font, boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto" data-testid="admin-kitchen-closedown-page">
      <Link to="/admin" data-testid="back-to-dashboard" className="inline-flex items-center gap-1.5 text-xs font-medium mb-3 active:scale-95" style={{ color: '#007AFF', ...font }}>
        <ArrowLeft size={13} /> Dashboard
      </Link>
      <div className="mb-5">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: '#1D1D1F', ...font }}>Kitchen Closedown</h1>
        <p className="text-xs sm:text-sm mt-1" style={{ color: '#86868B' }}>End-of-day checks — complete before locking up</p>
      </div>

      <div className="mb-4">
        <select data-testid="closedown-location" value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)}
          className={inputBase} style={{ ...inputStyle, background: '#FFFFFF' }}>
          <option value="">Select location...</option>
          {locations.filter(l => l.is_active).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {isAdmin && (
        <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: '#E8E8ED' }}>
          {[{k:'check',l:'Check'},{k:'history',l:'History'},{k:'overview',l:'Overview'},{k:'manage',l:'Manage'}].map(tab => (
            <button key={tab.k} data-testid={`closedown-tab-${tab.k}`} onClick={() => setActiveTab(tab.k)}
              className="flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-center"
              style={{ background: activeTab === tab.k ? '#FFFFFF' : 'transparent', color: activeTab === tab.k ? '#1D1D1F' : '#86868B', ...font, boxShadow: activeTab === tab.k ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
              {tab.l}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'check' && !selectedLocation && (
        <div className="text-center py-16 rounded-2xl" style={{ background: '#FFFFFF' }}>
          <Power size={32} className="mx-auto mb-3" style={{ color: '#C7C7CC' }} />
          <p className="text-sm" style={{ color: '#86868B', ...font }}>Select a location above to begin.</p>
        </div>
      )}

      {((activeTab === 'check' && selectedLocation) || activeTab === 'history' || activeTab === 'overview' || activeTab === 'manage') && (
        <>
          {activeTab === 'check' && (
            <div>
              {successMsg && (
                <div className="p-3 rounded-xl text-sm font-medium mb-4" style={{ background: 'rgba(52,199,89,0.1)', color: '#34C759', ...font }}>{successMsg}</div>
              )}

              <div className="flex gap-3 mb-4 items-end">
                <div className="w-1/2">
                  <label className="block text-xs font-medium mb-1" style={{ color: '#86868B', ...font }}>Date</label>
                  <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className={inputBase} style={{ ...inputStyle, background: '#FFFFFF' }} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold" style={{ color: passedCount === totalCount ? '#34C759' : '#1D1D1F', ...font }}>{passedCount}/{totalCount}</span>
                </div>
              </div>

              {completedBy && (
                <div className="p-2.5 rounded-xl mb-4 text-xs" style={{ background: 'rgba(0,122,255,0.06)', color: '#007AFF', ...font }}>
                  Last completed by <strong>{completedBy}</strong>
                </div>
              )}

              <div className="flex gap-2 mb-4">
                <button onClick={() => toggleAll(true)} className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium active:scale-95"
                  style={{ background: 'rgba(52,199,89,0.1)', color: '#34C759', ...font }}>
                  <Check size={13} /> All Pass
                </button>
                <button onClick={() => toggleAll(false)} className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium active:scale-95"
                  style={{ background: '#F5F5F7', color: '#86868B', ...font }}>
                  <X size={13} /> Clear
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>
              ) : (
                <div className="space-y-2">
                  {items.map(item => {
                    const checked = !!checks[item.id];
                    return (
                      <button key={item.id} data-testid={`closedown-check-${item.id}`}
                        onClick={() => toggleCheck(item.id)}
                        className="w-full flex items-start gap-3 p-4 rounded-2xl text-left transition-all active:scale-[0.99]"
                        style={{ background: '#FFFFFF', border: checked ? '2px solid #34C759' : '1px solid rgba(0,0,0,0.04)' }}>
                        <div className="w-6 h-6 rounded-lg shrink-0 mt-0.5 flex items-center justify-center transition-all"
                          style={{ background: checked ? '#34C759' : '#F5F5F7' }}>
                          {checked && <Check size={14} color="white" strokeWidth={3} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm leading-snug" style={{ color: checked ? '#1D1D1F' : '#3A3A3C', ...font }}>{item.text}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-4">
                <label className="block text-xs font-medium mb-1" style={{ color: '#86868B', ...font }}>Notes (optional)</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Any issues or comments..."
                  className="w-full px-3 py-3 rounded-xl text-sm border-0 outline-none resize-none"
                  style={{ ...inputStyle }} />
              </div>

              <button data-testid="save-closedown-btn" onClick={handleSave} disabled={saving || !selectedLocation}
                className="w-full mt-4 py-3.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 active:scale-[0.98]"
                style={{ background: passedCount === totalCount ? '#34C759' : '#1D1D1F', color: '#FFFFFF', ...font }}>
                {saving ? 'Saving...' : passedCount === totalCount ? 'All Checks Passed — Save' : `Save (${passedCount}/${totalCount})`}
              </button>
            </div>
          )}

          {activeTab === 'history' && isAdmin && (
            <div>
              {historyLoading ? (
                <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>
              ) : history.length === 0 ? (
                <div className="text-center py-16 rounded-2xl" style={{ background: '#FFFFFF' }}>
                  <Power size={32} className="mx-auto mb-3" style={{ color: '#C7C7CC' }} />
                  <p className="text-sm" style={{ color: '#86868B', ...font }}>No closedowns recorded yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map(entry => {
                    const allPassed = entry.passed_items === entry.total_items;
                    const isOpen = expandedId === entry.id;
                    return (
                      <div key={entry.id} className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF' }}>
                        <button onClick={() => setExpandedId(isOpen ? null : entry.id)}
                          className="w-full flex items-center justify-between px-4 py-3.5 text-left active:bg-gray-50">
                          <div className="min-w-0 mr-3">
                            <p className="text-sm font-medium" style={{ color: '#1D1D1F', ...font }}>{entry.date} — {getLocationName(entry.location_id)}</p>
                            <p className="text-[11px]" style={{ color: '#86868B' }}>By {entry.completed_by_name || entry.completed_by}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-semibold px-2 py-1 rounded-lg"
                              style={{ background: allPassed ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)', color: allPassed ? '#34C759' : '#FF3B30' }}>
                              {entry.passed_items}/{entry.total_items}
                            </span>
                            <ChevronDown size={14} style={{ color: '#86868B', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                          </div>
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-4" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                            <div className="space-y-1.5 mt-3">
                              {(entry.items_snapshot && entry.items_snapshot.length ? entry.items_snapshot : items).map(item => {
                                const passed = entry.checks?.[item.id];
                                return (
                                  <div key={item.id} className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{ background: passed ? 'rgba(52,199,89,0.04)' : 'rgba(255,59,48,0.04)' }}>
                                    {passed ? <Check size={14} className="shrink-0 mt-0.5" style={{ color: '#34C759' }} /> : <X size={14} className="shrink-0 mt-0.5" style={{ color: '#FF3B30' }} />}
                                    <span className="text-xs" style={{ color: passed ? '#1D1D1F' : '#FF3B30' }}>{item.text}</span>
                                  </div>
                                );
                              })}
                            </div>
                            {entry.note && (
                              <div className="mt-3 p-2.5 rounded-lg text-xs" style={{ background: '#F5F5F7', color: '#3A3A3C' }}>
                                <strong>Note:</strong> {entry.note}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'overview' && isAdmin && (
            <div>
              <div className="flex items-center gap-3 mb-5">
                <button onClick={() => {
                  const [y, m] = gridMonth.split('-').map(Number);
                  const d = new Date(y, m - 2, 1);
                  setGridMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                }} className="px-3 py-2 rounded-xl text-sm font-medium active:scale-95" style={{ background: '#F5F5F7', color: '#1D1D1F', ...font }}>&larr;</button>
                <p className="text-sm font-semibold flex-1 text-center" style={{ color: '#1D1D1F', ...font }}>
                  {new Date(gridMonth + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                </p>
                <button onClick={() => {
                  const [y, m] = gridMonth.split('-').map(Number);
                  const d = new Date(y, m, 1);
                  setGridMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                }} className="px-3 py-2 rounded-xl text-sm font-medium active:scale-95" style={{ background: '#F5F5F7', color: '#1D1D1F', ...font }}>&rarr;</button>
              </div>

              {gridLoading ? (
                <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>
              ) : !gridData ? null : (() => {
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
                              return (
                                <th key={d} className="px-0.5 py-2 text-center" style={{ background: isToday ? '#E8E8ED' : '#F5F5F7', minWidth: 30 }}>
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
                                const cell = gridData.grid[key];
                                const isFuture = dateStr > todayStr;
                                const allPassed = cell && cell.passed === cell.total;
                                return (
                                  <td key={d} className="px-0.5 py-2 text-center">
                                    {isFuture ? (
                                      <span className="inline-block w-5 h-5 rounded-md" style={{ background: '#F5F5F7' }} />
                                    ) : cell ? (
                                      <span className="inline-block w-5 h-5 rounded-md text-[8px] font-bold leading-5 text-white"
                                        style={{ background: allPassed ? '#34C759' : '#FF9500' }}>
                                        {allPassed ? '' : cell.passed}
                                      </span>
                                    ) : (
                                      <span className="inline-block w-5 h-5 rounded-md" style={{ background: '#FF3B30', opacity: 0.25 }} />
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center gap-4 px-4 py-3" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                      <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded" style={{ background: '#34C759' }} /><span className="text-[11px]" style={{ color: '#86868B' }}>All passed</span></div>
                      <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded" style={{ background: '#FF9500' }} /><span className="text-[11px]" style={{ color: '#86868B' }}>Partial</span></div>
                      <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded" style={{ background: '#FF3B30', opacity: 0.25 }} /><span className="text-[11px]" style={{ color: '#86868B' }}>Missing</span></div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {activeTab === 'manage' && isAdmin && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs" style={{ color: '#86868B', ...font }}>
                  {allItems.length} item{allItems.length === 1 ? '' : 's'} total
                </p>
                <button data-testid="closedown-add-item-btn" onClick={() => setShowAddForm(!showAddForm)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold active:scale-95"
                  style={{ background: '#1D1D1F', color: '#FFFFFF', ...font }}>
                  <Plus size={13} /> {showAddForm ? 'Cancel' : 'Add Item'}
                </button>
              </div>

              {showAddForm && (
                <div className="p-4 rounded-2xl mb-4 space-y-3" style={{ background: '#FFFFFF' }}>
                  <textarea data-testid="closedown-new-item-text" value={newText} onChange={e => setNewText(e.target.value)} rows={2}
                    placeholder="Enter checklist item text..."
                    className="w-full px-3 py-2.5 rounded-xl text-sm border-0 outline-none resize-none"
                    style={{ ...inputStyle }} />
                  <div className="flex gap-2">
                    <select data-testid="closedown-new-item-scope" value={newScope} onChange={e => setNewScope(e.target.value)}
                      className="flex-1 px-3 py-2.5 rounded-xl text-sm border-0 outline-none"
                      style={{ ...inputStyle, background: '#F5F5F7' }}>
                      <option value="global">All Locations</option>
                      <option value="location">Specific Location</option>
                    </select>
                    {newScope === 'location' && (
                      <select data-testid="closedown-new-item-location" value={newLocId} onChange={e => setNewLocId(e.target.value)}
                        className="flex-1 px-3 py-2.5 rounded-xl text-sm border-0 outline-none"
                        style={{ ...inputStyle, background: '#F5F5F7' }}>
                        <option value="">Select...</option>
                        {locations.filter(l => l.is_active).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    )}
                  </div>
                  <button data-testid="closedown-save-new-item-btn" onClick={handleAddItem}
                    disabled={!newText.trim() || (newScope === 'location' && !newLocId)}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 active:scale-[0.98]"
                    style={{ background: '#34C759', color: '#FFFFFF', ...font }}>
                    Save Item
                  </button>
                </div>
              )}

              {manageLoading ? (
                <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>
              ) : allItems.length === 0 ? (
                <div className="text-center py-16 rounded-2xl" style={{ background: '#FFFFFF' }}>
                  <Power size={32} className="mx-auto mb-3" style={{ color: '#C7C7CC' }} />
                  <p className="text-sm" style={{ color: '#86868B', ...font }}>No items yet. Add your first one above.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {allItems.map(item => {
                    const isEditing = editingId === item.id;
                    const scopeLabel = item.location_id ? getLocationName(item.location_id) : 'All Locations';
                    return (
                      <div key={item.id} data-testid={`closedown-manage-item-${item.id}`} className="p-4 rounded-2xl" style={{ background: '#FFFFFF' }}>
                        {isEditing ? (
                          <div className="space-y-3">
                            <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={2}
                              className="w-full px-3 py-2.5 rounded-xl text-sm border-0 outline-none resize-none"
                              style={{ ...inputStyle }} />
                            <div className="flex gap-2">
                              <select value={editScope} onChange={e => setEditScope(e.target.value)}
                                className="flex-1 px-3 py-2.5 rounded-xl text-sm border-0 outline-none"
                                style={{ ...inputStyle, background: '#F5F5F7' }}>
                                <option value="global">All Locations</option>
                                <option value="location">Specific Location</option>
                              </select>
                              {editScope === 'location' && (
                                <select value={editLocId} onChange={e => setEditLocId(e.target.value)}
                                  className="flex-1 px-3 py-2.5 rounded-xl text-sm border-0 outline-none"
                                  style={{ ...inputStyle, background: '#F5F5F7' }}>
                                  <option value="">Select...</option>
                                  {locations.filter(l => l.is_active).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                </select>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button data-testid={`closedown-save-edit-${item.id}`} onClick={saveEdit}
                                disabled={!editText.trim() || (editScope === 'location' && !editLocId)}
                                className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-semibold disabled:opacity-40 active:scale-95"
                                style={{ background: '#34C759', color: '#FFFFFF', ...font }}>
                                <Save size={13} /> Save
                              </button>
                              <button onClick={() => setEditingId(null)}
                                className="flex-1 py-2.5 rounded-xl text-xs font-semibold active:scale-95"
                                style={{ background: '#F5F5F7', color: '#86868B', ...font }}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm leading-snug mb-2" style={{ color: '#1D1D1F', ...font }}>{item.text}</p>
                              <div className="flex items-center gap-1.5">
                                {item.location_id ? <MapPin size={11} style={{ color: '#007AFF' }} /> : <Globe size={11} style={{ color: '#34C759' }} />}
                                <span className="text-[11px] font-medium" style={{ color: item.location_id ? '#007AFF' : '#34C759', ...font }}>{scopeLabel}</span>
                              </div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button data-testid={`closedown-edit-${item.id}`} onClick={() => startEdit(item)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-95"
                                style={{ background: '#F5F5F7' }}>
                                <Pencil size={13} style={{ color: '#1D1D1F' }} />
                              </button>
                              <button data-testid={`closedown-delete-${item.id}`} onClick={() => handleDelete(item)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-95"
                                style={{ background: 'rgba(255,59,48,0.1)' }}>
                                <Trash2 size={13} style={{ color: '#FF3B30' }} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminKitchenClosedown;
