import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sparkles, Check, ArrowLeft, Plus, Pencil, Trash2, Save, Globe, MapPin } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useLocation2 } from '../contexts/LocationContext';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Compute the coming/current Sunday for a given date
const sundayOf = (dateStr) => {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0=Sun, 1=Mon..
  const offset = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
};

const CleaningSchedulePage = ({ kind, title, subtitle, iconColor }) => {
  const navigate = useNavigate();
  const { isAuthenticated, isStaff, isAdmin, loading: authLoading } = useAuth();
  const { locations } = useLocation2();

  const todaySun = sundayOf(new Date().toISOString().split('T')[0]);

  const [activeTab, setActiveTab] = useState('check');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [weekEnding, setWeekEnding] = useState(todaySun);
  const [items, setItems] = useState([]);
  const [ticks, setTicks] = useState({});
  const [completedBy, setCompletedBy] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Manage
  const [allItems, setAllItems] = useState([]);
  const [manageLoading, setManageLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', frequency: '', methods: '', chemical: '', scope: 'global', location_id: '' });

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isStaff)) navigate('/admin-login');
  }, [authLoading, isAuthenticated, isStaff, navigate]);

  useEffect(() => { fetchItems(); }, [selectedLocation]);
  useEffect(() => { if (selectedLocation && weekEnding) loadExisting(); }, [selectedLocation, weekEnding]);
  useEffect(() => { if (activeTab === 'manage' && isAdmin) fetchAllItems(); }, [activeTab]);

  const fetchItems = async () => {
    try { setItems(await api.adminGetCleaningItems(kind, selectedLocation || undefined)); } catch {}
  };

  const loadExisting = async () => {
    setLoading(true);
    try {
      const d = await api.adminGetCleaningLog(kind, selectedLocation, weekEnding);
      if (d) { setTicks(d.ticks || {}); setCompletedBy(d.completed_by_name || ''); }
      else { setTicks({}); setCompletedBy(''); }
    } catch { setTicks({}); setCompletedBy(''); }
    finally { setLoading(false); }
  };

  const toggleTick = (itemId, day) => {
    setTicks(prev => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || {}), [day]: !prev[itemId]?.[day] },
    }));
  };

  const handleSave = async () => {
    if (!selectedLocation) return;
    setSaving(true); setSuccessMsg('');
    try {
      const res = await api.adminSubmitCleaningLog(kind, { location_id: selectedLocation, week_ending: weekEnding, ticks });
      setSuccessMsg(`Saved! ${res.passed}/${res.total} cells ticked`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) { alert('Failed: ' + err.message); }
    finally { setSaving(false); }
  };

  // ---- Manage Items ----
  const fetchAllItems = async () => {
    setManageLoading(true);
    try { setAllItems(await api.adminListAllCleaningItems(kind)); }
    catch (err) { alert('Failed: ' + err.message); }
    finally { setManageLoading(false); }
  };

  const resetForm = () => setFormData({ name: '', frequency: '', methods: '', chemical: '', scope: 'global', location_id: '' });

  const handleAdd = async () => {
    if (!formData.name.trim()) return;
    try {
      await api.adminCreateCleaningItem(kind, {
        name: formData.name.trim(),
        frequency: formData.frequency,
        methods: formData.methods,
        chemical: formData.chemical,
        location_id: formData.scope === 'location' ? formData.location_id : null,
      });
      resetForm(); setShowAddForm(false);
      await fetchAllItems(); await fetchItems();
    } catch (err) { alert('Failed: ' + err.message); }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setFormData({
      name: item.name || '',
      frequency: item.frequency || '',
      methods: item.methods || '',
      chemical: item.chemical || '',
      scope: item.location_id ? 'location' : 'global',
      location_id: item.location_id || '',
    });
  };

  const saveEdit = async () => {
    if (!formData.name.trim()) return;
    try {
      await api.adminUpdateCleaningItem(kind, editingId, {
        name: formData.name.trim(),
        frequency: formData.frequency,
        methods: formData.methods,
        chemical: formData.chemical,
        scope: formData.scope,
        location_id: formData.scope === 'location' ? formData.location_id : null,
      });
      setEditingId(null); resetForm();
      await fetchAllItems(); await fetchItems();
    } catch (err) { alert('Failed: ' + err.message); }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    try {
      await api.adminDeleteCleaningItem(kind, item.id);
      await fetchAllItems(); await fetchItems();
    } catch (err) { alert('Failed: ' + err.message); }
  };

  const getLocationName = (locId) => locations.find(l => l.id === locId)?.name || locId;

  if (authLoading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>;

  const font = { fontFamily: 'Outfit, sans-serif' };
  const inputStyle = { background: '#F5F5F7', color: '#1D1D1F', ...font, boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto" data-testid={`admin-${kind}-page`}>
      <Link to="/admin" data-testid="back-to-dashboard" className="inline-flex items-center gap-1.5 text-xs font-medium mb-3 active:scale-95" style={{ color: '#007AFF', ...font }}>
        <ArrowLeft size={13} /> Dashboard
      </Link>
      <div className="mb-5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: iconColor }}>
          <Sparkles size={18} color="white" strokeWidth={1.8} />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: '#1D1D1F', ...font }}>{title}</h1>
          <p className="text-xs sm:text-sm" style={{ color: '#86868B' }}>{subtitle}</p>
        </div>
      </div>

      <div className="mb-4">
        <select data-testid={`${kind}-location`} value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)}
          className="w-full px-3 py-3 rounded-xl text-sm border-0 outline-none" style={{ ...inputStyle, background: '#FFFFFF' }}>
          <option value="">Select location...</option>
          {locations.filter(l => l.is_active).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {isAdmin && (
        <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: '#E8E8ED' }}>
          {[{k:'check',l:'Schedule'},{k:'manage',l:'Manage Items'}].map(t => (
            <button key={t.k} data-testid={`${kind}-tab-${t.k}`} onClick={() => setActiveTab(t.k)}
              className="flex-1 px-3 py-2.5 rounded-lg text-sm font-medium"
              style={{ background: activeTab === t.k ? '#FFFFFF' : 'transparent', color: activeTab === t.k ? '#1D1D1F' : '#86868B', ...font, boxShadow: activeTab === t.k ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
              {t.l}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'check' && (
        <>
          {!selectedLocation ? (
            <div className="text-center py-16 rounded-2xl" style={{ background: '#FFFFFF' }}>
              <Sparkles size={32} className="mx-auto mb-3" style={{ color: '#C7C7CC' }} />
              <p className="text-sm" style={{ color: '#86868B', ...font }}>Select a location above to begin.</p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium mb-1" style={{ color: '#86868B', ...font }}>Week ending (Sunday)</label>
                  <input type="date" value={weekEnding} onChange={e => setWeekEnding(sundayOf(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm border-0 outline-none" style={{ ...inputStyle, background: '#FFFFFF' }} />
                </div>
              </div>

              {successMsg && <div className="p-3 rounded-xl text-sm font-medium mb-4" style={{ background: 'rgba(52,199,89,0.1)', color: '#34C759', ...font }}>{successMsg}</div>}
              {completedBy && <div className="p-2.5 rounded-xl mb-4 text-xs" style={{ background: 'rgba(0,122,255,0.06)', color: '#007AFF', ...font }}>Last completed by <strong>{completedBy}</strong></div>}

              {loading ? (
                <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>
              ) : items.length === 0 ? (
                <div className="text-center py-16 rounded-2xl" style={{ background: '#FFFFFF' }}>
                  <p className="text-sm" style={{ color: '#86868B', ...font }}>No items. Add some in the Manage tab.</p>
                </div>
              ) : (
                <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF' }}>
                  <div className="overflow-x-auto">
                    <table className="w-full" style={{ minWidth: 720 }}>
                      <thead>
                        <tr style={{ background: '#F5F5F7' }}>
                          <th className="px-3 py-2.5 text-left text-[11px] font-semibold sticky left-0" style={{ background: '#F5F5F7', color: '#86868B', ...font, minWidth: 160 }}>Item</th>
                          <th className="px-2 py-2.5 text-left text-[11px] font-semibold" style={{ color: '#86868B', ...font, minWidth: 80 }}>Frequency</th>
                          <th className="px-2 py-2.5 text-left text-[11px] font-semibold" style={{ color: '#86868B', ...font, minWidth: 180 }}>Method</th>
                          <th className="px-2 py-2.5 text-left text-[11px] font-semibold" style={{ color: '#86868B', ...font, minWidth: 110 }}>Chemical</th>
                          {DAY_LABELS.map((l, i) => (
                            <th key={i} className="px-1 py-2.5 text-center text-[11px] font-semibold" style={{ color: '#86868B', ...font, minWidth: 36 }}>{l}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(item => (
                          <tr key={item.id} data-testid={`${kind}-row-${item.id}`} style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                            <td className="px-3 py-2 text-xs font-medium sticky left-0" style={{ background: '#FFFFFF', color: '#1D1D1F', ...font }}>{item.name}</td>
                            <td className="px-2 py-2 text-[11px]" style={{ color: '#86868B', ...font }}>{item.frequency}</td>
                            <td className="px-2 py-2 text-[11px]" style={{ color: '#3A3A3C', ...font }}>{item.methods}</td>
                            <td className="px-2 py-2 text-[11px]" style={{ color: '#86868B', ...font }}>{item.chemical}</td>
                            {DAYS.map(d => {
                              const on = !!ticks[item.id]?.[d];
                              return (
                                <td key={d} className="px-1 py-2 text-center">
                                  <button data-testid={`${kind}-tick-${item.id}-${d}`} onClick={() => toggleTick(item.id, d)}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90"
                                    style={{ background: on ? '#34C759' : '#F5F5F7' }}>
                                    {on && <Check size={14} color="white" strokeWidth={3} />}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <button data-testid={`save-${kind}-btn`} onClick={handleSave} disabled={saving || !selectedLocation || items.length === 0}
                className="w-full mt-4 py-3.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 active:scale-[0.98]"
                style={{ background: '#1D1D1F', color: '#FFFFFF', ...font }}>
                {saving ? 'Saving...' : 'Save Week'}
              </button>
            </>
          )}
        </>
      )}

      {activeTab === 'manage' && isAdmin && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs" style={{ color: '#86868B', ...font }}>{allItems.length} item{allItems.length === 1 ? '' : 's'} total</p>
            <button data-testid={`add-${kind}-item-btn`} onClick={() => { setShowAddForm(!showAddForm); setEditingId(null); resetForm(); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold active:scale-95"
              style={{ background: '#1D1D1F', color: '#FFFFFF', ...font }}>
              <Plus size={13} /> {showAddForm ? 'Cancel' : 'Add Item'}
            </button>
          </div>

          {(showAddForm || editingId) && (
            <div className="p-4 rounded-2xl mb-4 space-y-3" style={{ background: '#FFFFFF' }}>
              <input data-testid={`${kind}-item-name`} placeholder="Item name (e.g. FRIDGE)" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl text-sm border-0 outline-none" style={inputStyle} />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Frequency (EOS, AM, CAYG, WEEKLY...)" value={formData.frequency} onChange={e => setFormData({ ...formData, frequency: e.target.value })}
                  className="px-3 py-2.5 rounded-xl text-sm border-0 outline-none" style={inputStyle} />
                <input placeholder="Chemical (e.g. SANITISER)" value={formData.chemical} onChange={e => setFormData({ ...formData, chemical: e.target.value })}
                  className="px-3 py-2.5 rounded-xl text-sm border-0 outline-none" style={inputStyle} />
              </div>
              <textarea rows={2} placeholder="Methods" value={formData.methods} onChange={e => setFormData({ ...formData, methods: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl text-sm border-0 outline-none resize-none" style={inputStyle} />
              <div className="grid grid-cols-2 gap-3">
                <select value={formData.scope} onChange={e => setFormData({ ...formData, scope: e.target.value })}
                  className="px-3 py-2.5 rounded-xl text-sm border-0 outline-none" style={inputStyle}>
                  <option value="global">All Locations</option>
                  <option value="location">Specific Location</option>
                </select>
                {formData.scope === 'location' && (
                  <select value={formData.location_id} onChange={e => setFormData({ ...formData, location_id: e.target.value })}
                    className="px-3 py-2.5 rounded-xl text-sm border-0 outline-none" style={inputStyle}>
                    <option value="">Select...</option>
                    {locations.filter(l => l.is_active).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                )}
              </div>
              <div className="flex gap-2">
                <button data-testid={`save-${kind}-item-btn`} onClick={editingId ? saveEdit : handleAdd}
                  disabled={!formData.name.trim() || (formData.scope === 'location' && !formData.location_id)}
                  className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 active:scale-[0.98]"
                  style={{ background: '#34C759', color: '#FFFFFF', ...font }}>
                  <Save size={13} /> {editingId ? 'Save Changes' : 'Save Item'}
                </button>
                {editingId && (
                  <button onClick={() => { setEditingId(null); resetForm(); }} className="flex-1 py-2.5 rounded-xl text-sm font-semibold active:scale-95" style={{ background: '#F5F5F7', color: '#86868B', ...font }}>Cancel</button>
                )}
              </div>
            </div>
          )}

          {manageLoading ? (
            <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>
          ) : allItems.length === 0 ? (
            <div className="text-center py-16 rounded-2xl" style={{ background: '#FFFFFF' }}>
              <p className="text-sm" style={{ color: '#86868B', ...font }}>No items yet. Add one above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {allItems.map(item => {
                const scopeLabel = item.location_id ? getLocationName(item.location_id) : 'All Locations';
                const isBeingEdited = editingId === item.id;
                if (isBeingEdited) return null;
                return (
                  <div key={item.id} data-testid={`${kind}-manage-${item.id}`} className="p-4 rounded-2xl flex items-start gap-3" style={{ background: '#FFFFFF' }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: '#1D1D1F', ...font }}>{item.name}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: '#86868B', ...font }}>
                        {item.frequency && <span>{item.frequency} · </span>}
                        {item.methods && <span>{item.methods}</span>}
                        {item.chemical && <span> · <span style={{ color: '#FF9500' }}>{item.chemical}</span></span>}
                      </p>
                      <div className="flex items-center gap-1.5 mt-2">
                        {item.location_id ? <MapPin size={11} style={{ color: '#007AFF' }} /> : <Globe size={11} style={{ color: '#34C759' }} />}
                        <span className="text-[11px] font-medium" style={{ color: item.location_id ? '#007AFF' : '#34C759', ...font }}>{scopeLabel}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button data-testid={`edit-${kind}-${item.id}`} onClick={() => startEdit(item)} className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-95" style={{ background: '#F5F5F7' }}>
                        <Pencil size={13} style={{ color: '#1D1D1F' }} />
                      </button>
                      <button data-testid={`del-${kind}-${item.id}`} onClick={() => handleDelete(item)} className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-95" style={{ background: 'rgba(255,59,48,0.1)' }}>
                        <Trash2 size={13} style={{ color: '#FF3B30' }} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CleaningSchedulePage;
