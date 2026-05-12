import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, Eye, EyeOff, Upload, X, Save, ChevronUp, ChevronDown } from 'lucide-react';
import api, { resolveImageUrl } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';

const font = { fontFamily: 'Outfit, sans-serif' };
const todayISO = () => new Date().toISOString().slice(0, 10);

const blankOffer = () => ({
  title: '', caption: '', price: '', image_url: '',
  location_ids: [], start_date: '', end_date: '', is_active: true,
});

const AdminOffers = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, loading: authLoading } = useAuth();
  const { locations } = useLocation2();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | "new" | offerId
  const [draft, setDraft] = useState(blankOffer());
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) navigate('/admin-login');
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  const load = () => {
    setLoading(true);
    api.adminListOffers()
      .then(rows => setOffers(rows || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (!authLoading && isAdmin) load(); }, [authLoading, isAdmin]);

  const openCreate = () => { setDraft(blankOffer()); setEditing('new'); setError(''); };
  const openEdit = (o) => {
    setDraft({
      title: o.title || '', caption: o.caption || '', price: o.price || '',
      image_url: o.image_url || '', location_ids: o.location_ids || [],
      start_date: o.start_date || '', end_date: o.end_date || '',
      is_active: !!o.is_active,
    });
    setEditing(o.id);
    setError('');
  };
  const close = () => { setEditing(null); setDraft(blankOffer()); setError(''); };

  const toggleLocation = (id) => {
    setDraft(d => {
      const has = d.location_ids.includes(id);
      return { ...d, location_ids: has ? d.location_ids.filter(x => x !== id) : [...d.location_ids, id] };
    });
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError('');
    try {
      const { image_url } = await api.adminUploadOfferImage(file);
      setDraft(d => ({ ...d, image_url }));
    } catch (err) { setError(err.message); }
    finally { setUploading(false); }
  };

  const save = async () => {
    if (!draft.title.trim()) { setError('Title is required'); return; }
    setError('');
    try {
      if (editing === 'new') {
        await api.adminCreateOffer(draft);
      } else {
        await api.adminUpdateOffer(editing, draft);
      }
      close(); load();
    } catch (err) { setError(err.message); }
  };

  const remove = async (o) => {
    if (!window.confirm(`Delete "${o.title}"? This cannot be undone.`)) return;
    try { await api.adminDeleteOffer(o.id); load(); }
    catch (err) { setError(err.message); }
  };

  const toggleActive = async (o) => {
    try { await api.adminUpdateOffer(o.id, { is_active: !o.is_active }); load(); }
    catch (err) { setError(err.message); }
  };

  const move = async (o, dir) => {
    const idx = offers.findIndex(x => x.id === o.id);
    const swap = offers[idx + dir];
    if (!swap) return;
    try {
      await Promise.all([
        api.adminUpdateOffer(o.id, { sort_order: swap.sort_order }),
        api.adminUpdateOffer(swap.id, { sort_order: o.sort_order }),
      ]);
      load();
    } catch (err) { setError(err.message); }
  };

  const locName = (id) => locations.find(l => l.id === id)?.name || id;
  const today = todayISO();
  const isLive = (o) => {
    if (!o.is_active) return false;
    if (o.start_date && today < o.start_date) return false;
    if (o.end_date && today > o.end_date) return false;
    return true;
  };

  if (authLoading) return <div className="p-8 text-center" style={font}>Loading…</div>;

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
              Current Offers
            </h1>
            <p className="text-sm mt-1" style={{ color: '#86868B' }}>
              Posters shown on the home page. Drag artwork, set dates, tick locations.
            </p>
          </div>
          <button data-testid="new-offer-btn" onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-white text-sm font-semibold active:scale-95"
            style={{ background: '#1D1D1F' }}>
            <Plus size={16} strokeWidth={2.6} /> New offer
          </button>
        </div>

        {error && (
          <div data-testid="error-banner" className="mb-4 p-3 rounded-xl text-sm" style={{ background: 'rgba(255,59,48,0.1)', color: '#B5170E' }}>
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-center py-12" style={{ color: '#86868B' }}>Loading offers…</p>
        ) : offers.length === 0 ? (
          <div className="text-center py-20 rounded-3xl" style={{ background: '#FFFFFF' }}>
            <p className="text-base mb-4" style={{ color: '#86868B' }}>No offers yet.</p>
            <button onClick={openCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-white text-sm font-semibold"
              style={{ background: '#1D1D1F' }}>
              <Plus size={16} strokeWidth={2.6} /> Create your first offer
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {offers.map((o, idx) => (
              <article key={o.id} data-testid={`offer-row-${o.id}`}
                className="flex items-center gap-4 p-4 rounded-2xl"
                style={{ background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0" style={{ background: '#1a1410' }}>
                  {o.image_url ? (
                    <img src={o.image_url.startsWith('/api/') ? resolveImageUrl(o.image_url) : o.image_url}
                      alt={o.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: '#888' }}>No image</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold truncate" style={{ color: '#1D1D1F' }}>{o.title}</h3>
                    {isLive(o) ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(52,199,89,0.15)', color: '#1B7A35' }}>LIVE</span>
                    ) : !o.is_active ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(142,142,147,0.15)', color: '#3A3A3C' }}>Hidden</span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,149,0,0.15)', color: '#A35E00' }}>Scheduled</span>
                    )}
                  </div>
                  {o.caption && <p className="text-xs mt-0.5 truncate" style={{ color: '#86868B' }}>{o.caption}</p>}
                  <p className="text-[11px] mt-1" style={{ color: '#86868B' }}>
                    {(o.location_ids?.length || 0) === 0
                      ? 'All locations'
                      : o.location_ids.map(locName).join(', ')}
                    {o.start_date || o.end_date ? ` · ${o.start_date || '—'} → ${o.end_date || '—'}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button data-testid={`move-up-${o.id}`} onClick={() => move(o, -1)} aria-label="Move up"
                    disabled={idx === 0}
                    className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-30 active:scale-95"
                    style={{ background: 'transparent', color: '#1D1D1F' }}>
                    <ChevronUp size={18} />
                  </button>
                  <button data-testid={`move-down-${o.id}`} onClick={() => move(o, 1)} aria-label="Move down"
                    disabled={idx === offers.length - 1}
                    className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-30 active:scale-95"
                    style={{ background: 'transparent', color: '#1D1D1F' }}>
                    <ChevronDown size={18} />
                  </button>
                  <button data-testid={`toggle-active-${o.id}`} onClick={() => toggleActive(o)}
                    aria-label={o.is_active ? 'Hide' : 'Show'}
                    className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95"
                    style={{ background: 'transparent', color: o.is_active ? '#1D1D1F' : '#86868B' }}>
                    {o.is_active ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                  <button data-testid={`edit-${o.id}`} onClick={() => openEdit(o)} aria-label="Edit"
                    className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95"
                    style={{ background: 'transparent', color: '#007AFF' }}>
                    <Pencil size={17} />
                  </button>
                  <button data-testid={`delete-${o.id}`} onClick={() => remove(o)} aria-label="Delete"
                    className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95"
                    style={{ background: 'transparent', color: '#FF3B30' }}>
                    <Trash2 size={17} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {editing !== null && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={close}>
            <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl p-5 sm:p-6"
              style={{ background: '#FFFFFF' }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold" style={{ color: '#1D1D1F' }}>
                  {editing === 'new' ? 'New offer' : 'Edit offer'}
                </h2>
                <button onClick={close} aria-label="Close" data-testid="close-modal"
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: '#F2F2F7', color: '#1D1D1F' }}>
                  <X size={18} />
                </button>
              </div>

              {/* Image preview + upload */}
              <div className="mb-4">
                <div className="w-full aspect-[3/4] rounded-2xl overflow-hidden mb-2"
                  style={{ background: '#1a1410' }}>
                  {draft.image_url ? (
                    <img src={draft.image_url.startsWith('/api/') ? resolveImageUrl(draft.image_url) : draft.image_url}
                      alt="Poster preview" className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm" style={{ color: '#888' }}>
                      No poster yet
                    </div>
                  )}
                </div>
                <label data-testid="upload-image-label"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium cursor-pointer active:scale-95"
                  style={{ background: '#F2F2F7', color: '#1D1D1F' }}>
                  <Upload size={15} strokeWidth={2.4} />
                  {uploading ? 'Uploading…' : (draft.image_url ? 'Replace image' : 'Upload poster')}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                    data-testid="upload-image-input" onChange={handleFile} disabled={uploading} />
                </label>
              </div>

              <Field label="Title" required>
                <input data-testid="field-title" value={draft.title}
                  onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                  placeholder="e.g. Sunday Roast — £11.50" className="input-base" />
              </Field>

              <Field label="Caption">
                <input data-testid="field-caption" value={draft.caption}
                  onChange={e => setDraft(d => ({ ...d, caption: e.target.value }))}
                  placeholder="e.g. Every Sunday. Walk-ins welcome." className="input-base" />
              </Field>

              <Field label="Price (optional)">
                <input data-testid="field-price" value={draft.price}
                  onChange={e => setDraft(d => ({ ...d, price: e.target.value }))}
                  placeholder="£11.50" className="input-base" />
              </Field>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <Field label="Starts">
                  <input data-testid="field-start" type="date" value={draft.start_date}
                    onChange={e => setDraft(d => ({ ...d, start_date: e.target.value }))}
                    className="input-base" />
                </Field>
                <Field label="Ends">
                  <input data-testid="field-end" type="date" value={draft.end_date}
                    onChange={e => setDraft(d => ({ ...d, end_date: e.target.value }))}
                    className="input-base" />
                </Field>
              </div>

              <div className="mb-3">
                <p className="text-xs font-semibold mb-2" style={{ color: '#3A3A3C', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Locations <span className="font-normal" style={{ color: '#86868B', textTransform: 'none', letterSpacing: 0 }}>(empty = all sites)</span>
                </p>
                <div className="space-y-1.5">
                  {locations.map(l => (
                    <label key={l.id} data-testid={`loc-toggle-${l.id}`}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer"
                      style={{ background: '#F8F8FA' }}>
                      <input type="checkbox" checked={draft.location_ids.includes(l.id)}
                        onChange={() => toggleLocation(l.id)} className="w-4 h-4" />
                      <span className="text-sm">{l.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 mb-4 cursor-pointer">
                <input data-testid="field-active" type="checkbox" checked={draft.is_active}
                  onChange={e => setDraft(d => ({ ...d, is_active: e.target.checked }))}
                  className="w-4 h-4" />
                <span className="text-sm font-medium" style={{ color: '#1D1D1F' }}>Active (show on home page)</span>
              </label>

              {error && (
                <div className="mb-3 p-2.5 rounded-lg text-sm"
                  style={{ background: 'rgba(255,59,48,0.1)', color: '#B5170E' }}>
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={close} data-testid="cancel-btn"
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold active:scale-95"
                  style={{ background: '#F2F2F7', color: '#1D1D1F' }}>
                  Cancel
                </button>
                <button onClick={save} disabled={uploading} data-testid="save-btn"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-sm font-semibold text-white active:scale-95"
                  style={{ background: '#1D1D1F', opacity: uploading ? 0.5 : 1 }}>
                  <Save size={15} strokeWidth={2.4} />
                  {editing === 'new' ? 'Create offer' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .input-base {
          width: 100%;
          padding: 11px 13px;
          border-radius: 12px;
          background: #F8F8FA;
          border: 1px solid rgba(0,0,0,0.06);
          font-size: 14px;
          font-family: Outfit, sans-serif;
          color: #1D1D1F;
          outline: none;
        }
        .input-base:focus { border-color: #007AFF; background: #FFFFFF; }
      `}</style>
    </div>
  );
};

const Field = ({ label, required, children }) => (
  <div className="mb-3">
    <label className="block text-xs font-semibold mb-1.5"
      style={{ color: '#3A3A3C', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
      {label}{required && <span style={{ color: '#FF3B30' }}> *</span>}
    </label>
    {children}
  </div>
);

export default AdminOffers;
