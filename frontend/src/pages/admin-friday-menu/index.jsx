import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Upload, Eye, EyeOff, Save, X, Calendar } from 'lucide-react';
import api, { resolveImageUrl } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';

const font = { fontFamily: 'Outfit, sans-serif' };

const todayISO = () => new Date().toISOString().slice(0, 10);
// Find the next Friday (or today if today is Friday)
const nextFriday = () => {
  const d = new Date();
  const offset = (5 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + (offset || 0));
  return d.toISOString().slice(0, 10);
};
const sundayBefore = (fridayIso) => {
  const f = new Date(fridayIso);
  f.setDate(f.getDate() - 5);
  return f.toISOString().slice(0, 10) + 'T00:00:00Z';
};
const wednesdayBefore = (fridayIso) => {
  const f = new Date(fridayIso);
  f.setDate(f.getDate() - 2);
  return f.toISOString().slice(0, 10) + 'T23:59:00Z';
};

const blankItem = () => ({
  id: '', name: '', description: '', image_url: '',
  price: 0, allergens: [], stock_by_location: {},
});

const blankMenu = () => {
  const fri = nextFriday();
  return {
    week_friday: fri,
    bundle_enabled: true, bundle_price: 18.5,
    order_window_start: sundayBefore(fri),
    order_window_end: wednesdayBefore(fri),
    starters: [], mains: [], desserts: [],
    location_pickups: [],
    is_published: false,
  };
};

const AdminFridayMenu = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, loading: authLoading } = useAuth();
  const { locations } = useLocation2();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | "new" | id
  const [draft, setDraft] = useState(blankMenu());
  const [uploading, setUploading] = useState(null); // course key
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) navigate('/admin-login');
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  const load = () => {
    setLoading(true);
    api.adminListFridayMenus()
      .then(rows => setList(rows || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (!authLoading && isAdmin) load(); }, [authLoading, isAdmin]);

  const openNew = () => { setDraft(blankMenu()); setEditing('new'); setError(''); };
  const openEdit = (m) => { setDraft({ ...blankMenu(), ...m }); setEditing(m.id); setError(''); };
  const close = () => { setEditing(null); setError(''); };

  const addItem = (course) => setDraft(d => ({ ...d, [course]: [...d[course], blankItem()] }));
  const updateItem = (course, idx, patch) => setDraft(d => ({
    ...d, [course]: d[course].map((it, i) => i === idx ? { ...it, ...patch } : it),
  }));
  const removeItem = (course, idx) => setDraft(d => ({
    ...d, [course]: d[course].filter((_, i) => i !== idx),
  }));
  const setStock = (course, idx, locId, qty) => setDraft(d => ({
    ...d, [course]: d[course].map((it, i) => i === idx
      ? { ...it, stock_by_location: { ...(it.stock_by_location || {}), [locId]: Math.max(0, Number(qty) || 0) } }
      : it),
  }));
  const toggleLocation = (locId) => setDraft(d => {
    const has = d.location_pickups.find(p => p.location_id === locId);
    return {
      ...d,
      location_pickups: has
        ? d.location_pickups.filter(p => p.location_id !== locId)
        : [...d.location_pickups, { location_id: locId, pickup_time: '15:00' }],
    };
  });
  const setPickupTime = (locId, time) => setDraft(d => ({
    ...d,
    location_pickups: d.location_pickups.map(p => p.location_id === locId ? { ...p, pickup_time: time } : p),
  }));

  const handleUpload = async (course, idx, file) => {
    if (!file) return;
    setUploading(`${course}-${idx}`); setError('');
    try {
      const { image_url } = await api.adminUploadFridayImage(file);
      updateItem(course, idx, { image_url });
    } catch (err) { setError(err.message); }
    finally { setUploading(null); }
  };

  const save = async () => {
    if (!draft.week_friday) { setError('Friday date is required'); return; }
    setError('');
    try {
      const payload = { ...draft };
      if (editing === 'new') await api.adminCreateFridayMenu(payload);
      else await api.adminUpdateFridayMenu(editing, payload);
      close(); load();
    } catch (err) { setError(err.message); }
  };

  const remove = async (m) => {
    if (!window.confirm(`Delete the Friday ${m.week_friday} menu? This cannot be undone.`)) return;
    try { await api.adminDeleteFridayMenu(m.id); load(); }
    catch (err) { setError(err.message); }
  };

  const togglePublished = async (m) => {
    try { await api.adminUpdateFridayMenu(m.id, { is_published: !m.is_published }); load(); }
    catch (err) { setError(err.message); }
  };

  if (authLoading) return <div className="p-8 text-center" style={font}>Loading…</div>;

  const participatingIds = (draft.location_pickups || []).map(p => p.location_id);

  return (
    <div className="min-h-screen bg-[#FBFBFD]" style={font}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Link to="/admin" data-testid="back-to-admin"
          className="inline-flex items-center gap-1.5 text-sm font-medium mb-4 active:scale-95"
          style={{ color: '#007AFF' }}>
          <ArrowLeft size={18} strokeWidth={2.4} /> Dashboard
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight" style={{ color: '#1D1D1F' }}>
              Friday Feast
            </h1>
            <p className="text-sm mt-1" style={{ color: '#86868B' }}>
              Weekly bundle-or-single pre-order. Orders accepted Sun → Wed, pickup Friday.
            </p>
          </div>
          <button data-testid="new-menu-btn" onClick={openNew}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-white text-sm font-semibold active:scale-95"
            style={{ background: '#1D1D1F' }}>
            <Plus size={16} strokeWidth={2.6} /> New week
          </button>
        </div>

        {error && (
          <div data-testid="error-banner" className="mb-4 p-3 rounded-xl text-sm" style={{ background: 'rgba(255,59,48,0.1)', color: '#B5170E' }}>
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-center py-12" style={{ color: '#86868B' }}>Loading menus…</p>
        ) : list.length === 0 ? (
          <div className="text-center py-20 rounded-3xl" style={{ background: '#FFFFFF' }}>
            <p className="text-base mb-4" style={{ color: '#86868B' }}>No Friday menus yet.</p>
            <button onClick={openNew}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-white text-sm font-semibold"
              style={{ background: '#1D1D1F' }}>
              <Plus size={16} strokeWidth={2.6} /> Create this week's menu
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map(m => (
              <article key={m.id} data-testid={`menu-row-${m.id}`}
                className="flex items-center gap-4 p-4 rounded-2xl"
                style={{ background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(139,30,63,0.08)', color: '#8B1E3F' }}>
                  <Calendar size={20} strokeWidth={2.4} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold" style={{ color: '#1D1D1F' }}>
                      Friday {m.week_friday}
                    </h3>
                    {m.is_published ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(52,199,89,0.15)', color: '#1B7A35' }}>PUBLISHED</span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(142,142,147,0.15)', color: '#3A3A3C' }}>Draft</span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: '#86868B' }}>
                    {(m.starters || []).length} starters · {(m.mains || []).length} mains · {(m.desserts || []).length} desserts ·
                    {' '}{(m.location_pickups || []).length || 'all'} cafe{(m.location_pickups || []).length === 1 ? '' : 's'}
                    {m.bundle_enabled && m.bundle_price ? ` · bundle £${Number(m.bundle_price).toFixed(2)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button data-testid={`toggle-pub-${m.id}`} onClick={() => togglePublished(m)}
                    className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95"
                    style={{ color: m.is_published ? '#1D1D1F' : '#86868B' }} title={m.is_published ? 'Unpublish' : 'Publish'}>
                    {m.is_published ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                  <button data-testid={`edit-${m.id}`} onClick={() => openEdit(m)}
                    className="px-3 py-2 rounded-full text-xs font-semibold active:scale-95"
                    style={{ background: '#F2F2F7', color: '#1D1D1F' }}>Edit</button>
                  <button data-testid={`delete-${m.id}`} onClick={() => remove(m)} aria-label="Delete"
                    className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95"
                    style={{ color: '#FF3B30' }}>
                    <Trash2 size={17} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {editing !== null && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4"
            style={{ background: 'rgba(0,0,0,0.5)' }} onClick={close}>
            <div className="w-full max-w-3xl max-h-[94vh] overflow-y-auto rounded-3xl p-5 sm:p-6"
              style={{ background: '#FFFFFF' }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4 sticky top-0 -mt-1 pt-1" style={{ background: '#FFFFFF', zIndex: 2 }}>
                <h2 className="text-xl font-semibold" style={{ color: '#1D1D1F' }}>
                  {editing === 'new' ? 'New Friday menu' : 'Edit Friday menu'}
                </h2>
                <button onClick={close} aria-label="Close" data-testid="close-modal"
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: '#F2F2F7', color: '#1D1D1F' }}><X size={18} /></button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                <Field label="Friday date">
                  <input data-testid="field-friday" type="date" value={draft.week_friday}
                    onChange={e => setDraft(d => ({
                      ...d, week_friday: e.target.value,
                      order_window_start: sundayBefore(e.target.value),
                      order_window_end: wednesdayBefore(e.target.value),
                    }))} className="input-base" />
                </Field>
                <Field label="Bundle price (£)">
                  <input data-testid="field-bundle-price" type="number" step="0.01" min="0"
                    value={draft.bundle_price ?? ''}
                    onChange={e => setDraft(d => ({ ...d, bundle_price: e.target.value === '' ? null : Number(e.target.value) }))}
                    className="input-base" />
                </Field>
                <label className="flex items-end gap-2 pb-2">
                  <input data-testid="field-bundle-enabled" type="checkbox" checked={draft.bundle_enabled}
                    onChange={e => setDraft(d => ({ ...d, bundle_enabled: e.target.checked }))}
                    className="w-4 h-4" />
                  <span className="text-sm">Bundle enabled</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <Field label="Orders open from">
                  <input data-testid="field-window-start" type="datetime-local"
                    value={(draft.order_window_start || '').slice(0, 16)}
                    onChange={e => setDraft(d => ({ ...d, order_window_start: e.target.value ? new Date(e.target.value).toISOString() : '' }))}
                    className="input-base" />
                </Field>
                <Field label="Orders close at">
                  <input data-testid="field-window-end" type="datetime-local"
                    value={(draft.order_window_end || '').slice(0, 16)}
                    onChange={e => setDraft(d => ({ ...d, order_window_end: e.target.value ? new Date(e.target.value).toISOString() : '' }))}
                    className="input-base" />
                </Field>
              </div>

              {/* Participating cafes + pickup time */}
              <div className="mb-5">
                <p className="text-xs font-semibold mb-2" style={{ color: '#3A3A3C', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Participating cafes & Friday pickup time
                </p>
                <p className="text-[11px] mb-2" style={{ color: '#86868B' }}>Tick the cafes serving this week. Leave all unticked to enable for every location.</p>
                <div className="space-y-1.5">
                  {locations.map(l => {
                    const pk = (draft.location_pickups || []).find(p => p.location_id === l.id);
                    const on = !!pk;
                    return (
                      <div key={l.id} data-testid={`loc-row-${l.id}`}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl"
                        style={{ background: '#F8F8FA' }}>
                        <input type="checkbox" checked={on} onChange={() => toggleLocation(l.id)} className="w-4 h-4" />
                        <span className="text-sm flex-1">{l.name}</span>
                        {on && (
                          <>
                            <span className="text-[11px]" style={{ color: '#86868B' }}>pickup</span>
                            <input data-testid={`pickup-${l.id}`} type="time" value={pk.pickup_time}
                              onChange={e => setPickupTime(l.id, e.target.value)}
                              className="input-base !py-1 !px-2 !w-24" />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Courses */}
              {['starters', 'mains', 'desserts'].map(course => (
                <CourseEditor key={course}
                  course={course}
                  items={draft[course] || []}
                  locations={(draft.location_pickups || []).length ? locations.filter(l => participatingIds.includes(l.id)) : locations}
                  uploading={uploading}
                  onAdd={() => addItem(course)}
                  onChange={(idx, patch) => updateItem(course, idx, patch)}
                  onRemove={(idx) => removeItem(course, idx)}
                  onUpload={(idx, f) => handleUpload(course, idx, f)}
                  onStock={(idx, locId, qty) => setStock(course, idx, locId, qty)} />
              ))}

              <label className="flex items-center gap-2 mb-4 cursor-pointer">
                <input data-testid="field-published" type="checkbox" checked={draft.is_published}
                  onChange={e => setDraft(d => ({ ...d, is_published: e.target.checked }))}
                  className="w-4 h-4" />
                <span className="text-sm font-medium" style={{ color: '#1D1D1F' }}>Published (visible on /friday-feast)</span>
              </label>

              {error && (
                <div className="mb-3 p-2.5 rounded-lg text-sm" style={{ background: 'rgba(255,59,48,0.1)', color: '#B5170E' }}>{error}</div>
              )}

              <div className="flex gap-2 sticky bottom-0 pb-1 pt-2" style={{ background: '#FFFFFF' }}>
                <button onClick={close} data-testid="cancel-btn"
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold active:scale-95"
                  style={{ background: '#F2F2F7', color: '#1D1D1F' }}>Cancel</button>
                <button onClick={save} data-testid="save-btn"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-sm font-semibold text-white active:scale-95"
                  style={{ background: '#1D1D1F' }}>
                  <Save size={15} strokeWidth={2.4} />
                  {editing === 'new' ? 'Create menu' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .input-base {
          width: 100%; padding: 11px 13px; border-radius: 12px;
          background: #F8F8FA; border: 1px solid rgba(0,0,0,0.06);
          font-size: 14px; font-family: Outfit, sans-serif; color: #1D1D1F; outline: none;
        }
        .input-base:focus { border-color: #007AFF; background: #FFFFFF; }
      `}</style>
    </div>
  );
};

const Field = ({ label, children }) => (
  <div>
    <label className="block text-xs font-semibold mb-1.5"
      style={{ color: '#3A3A3C', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</label>
    {children}
  </div>
);

const CourseEditor = ({ course, items, locations, uploading, onAdd, onChange, onRemove, onUpload, onStock }) => {
  const title = course === 'starters' ? 'Starters' : course === 'mains' ? 'Mains' : 'Desserts';
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold" style={{ color: '#3A3A3C', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {title} ({items.length})
        </p>
        <button data-testid={`add-${course}`} onClick={onAdd}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold active:scale-95"
          style={{ background: '#F2F2F7', color: '#1D1D1F' }}>
          <Plus size={13} /> Add {course === 'starters' ? 'starter' : course === 'mains' ? 'main' : 'dessert'}
        </button>
      </div>
      <div className="space-y-3">
        {items.map((it, idx) => (
          <div key={idx} data-testid={`${course}-row-${idx}`}
            className="flex gap-3 p-3 rounded-2xl" style={{ background: '#F8F8FA' }}>
            <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0" style={{ background: '#1a1410' }}>
              {it.image_url ? (
                <img src={it.image_url.startsWith('/api/') ? resolveImageUrl(it.image_url) : it.image_url}
                  alt={it.name} className="w-full h-full object-cover" />
              ) : (
                <label className="w-full h-full flex flex-col items-center justify-center gap-1 cursor-pointer text-xs text-white">
                  {uploading === `${course}-${idx}` ? '...' : <><Upload size={14} /> Photo</>}
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => onUpload(idx, e.target.files?.[0])} />
                </label>
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <input data-testid={`${course}-name-${idx}`} value={it.name}
                onChange={e => onChange(idx, { name: e.target.value })}
                placeholder="Dish name (e.g. Slow-roast lamb shoulder)" className="input-base" />
              <input data-testid={`${course}-desc-${idx}`} value={it.description}
                onChange={e => onChange(idx, { description: e.target.value })}
                placeholder="Short description" className="input-base" />
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: '#86868B' }}>£</span>
                <input data-testid={`${course}-price-${idx}`} type="number" step="0.01" min="0" value={it.price}
                  onChange={e => onChange(idx, { price: Number(e.target.value) })}
                  className="input-base !py-1.5 !w-24" />
                {it.image_url && (
                  <label className="text-xs text-[#007AFF] cursor-pointer">
                    Replace photo
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => onUpload(idx, e.target.files?.[0])} />
                  </label>
                )}
                <button data-testid={`${course}-del-${idx}`} onClick={() => onRemove(idx)} aria-label="Remove"
                  className="ml-auto w-8 h-8 rounded-full flex items-center justify-center active:scale-95"
                  style={{ color: '#FF3B30' }}>
                  <Trash2 size={15} />
                </button>
              </div>
              {/* Stock per location */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
                {locations.map(l => (
                  <div key={l.id} className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: '#FFFFFF' }}>
                    <span className="text-[11px] truncate flex-1" title={l.name}>{l.name}</span>
                    <input data-testid={`${course}-stock-${idx}-${l.id}`} type="number" min="0"
                      value={(it.stock_by_location || {})[l.id] ?? 0}
                      onChange={e => onStock(idx, l.id, e.target.value)}
                      className="input-base !py-0.5 !px-1.5 !w-14 !text-center !text-xs" />
                  </div>
                ))}
                {locations.length === 0 && (
                  <p className="text-[11px] col-span-full" style={{ color: '#86868B' }}>Tick at least one participating cafe above to set stock.</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminFridayMenu;
