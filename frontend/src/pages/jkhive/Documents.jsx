import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Upload, FileText, Image as ImageIcon, FileSpreadsheet,
  Eye, Download, Trash2, X, FolderOpen, Loader2, CalendarClock, Pencil,
} from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';

const FONT = { fontFamily: 'Outfit, sans-serif' };
const MAX_BYTES = 25 * 1024 * 1024; // mirror backend cap so we fail fast

const fmtSize = (bytes) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const fmtDateTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const fmtShortDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
};

/** Derive a status pill spec for the document's expiry date.
 *  - null/missing  → "N/A"  (doc doesn't expire)
 *  - in the past   → "Expired"
 *  - ≤ 30 days     → "Expiring"
 *  - > 30 days     → "OK" (with date)
 */
const expirySpec = (expires_at) => {
  if (!expires_at) return { label: 'N/A',     bg: 'rgba(0,0,0,0.04)',     fg: '#86868B', daysLeft: null };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const exp = new Date(expires_at);
  if (Number.isNaN(exp.getTime())) return { label: 'N/A', bg: 'rgba(0,0,0,0.04)', fg: '#86868B', daysLeft: null };
  const days = Math.round((exp - today) / 86400000);
  if (days < 0)  return { label: `Expired (${fmtShortDate(expires_at)})`, bg: 'rgba(255,59,48,0.12)',  fg: '#C0392B', daysLeft: days };
  if (days <= 30) return { label: `Expiring in ${days}d`,                 bg: 'rgba(255,149,0,0.16)',  fg: '#A35E00', daysLeft: days };
  return { label: `Expires ${fmtShortDate(expires_at)}`,                   bg: 'rgba(52,199,89,0.14)',  fg: '#1B7A35', daysLeft: days };
};

/** Decide which icon to show for the file's content type. */
const iconFor = (ct = '') => {
  if (ct.startsWith('image/'))   return ImageIcon;
  if (ct === 'application/pdf')  return FileText;
  if (ct.includes('sheet') || ct.includes('excel') || ct === 'text/csv') return FileSpreadsheet;
  return FileText;
};

/** Can the browser render this inline (PDF or image)? */
const isPreviewable = (ct = '') => ct.startsWith('image/') || ct === 'application/pdf';

const Documents = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isStaff, isAdmin } = useAuth();
  const { adminLocationId, locations } = useLocation2();

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Upload form
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Policies');
  const [expiresAt, setExpiresAt] = useState(''); // empty = N/A / non-expiring
  // Location the upload will be filed against. Defaults to the current
  // JKHive site picker, but the admin can target any site from the form.
  const [uploadLocationId, setUploadLocationId] = useState(adminLocationId || '');
  const [categories, setCategories] = useState(['Policies', 'Certificates', 'Training', 'Risk Assessments', 'Suppliers', 'HACCP', 'Other']);
  const [uploading, setUploading] = useState(false);

  // Keep the upload form's location in sync whenever the JKHive site picker
  // changes (e.g. admin switches site before opening the form).
  useEffect(() => { if (adminLocationId) setUploadLocationId(adminLocationId); }, [adminLocationId]);

  // Inline expiry editor
  const [editingExpiryFor, setEditingExpiryFor] = useState(null); // doc.id or null
  const [editExpiryValue, setEditExpiryValue] = useState('');

  // Filter
  const [filterCategory, setFilterCategory] = useState('');

  // Preview modal
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const locationName = useMemo(
    () => locations.find(l => l.id === adminLocationId)?.name || '',
    [locations, adminLocationId],
  );

  const load = useCallback(async () => {
    if (!adminLocationId) return;
    setLoading(true);
    setError('');
    try {
      const [d, c] = await Promise.all([
        api.documentsList({ location_id: adminLocationId, category: filterCategory || undefined }),
        api.documentsCategories().catch(() => null),
      ]);
      setDocs(d || []);
      if (c?.categories?.length) setCategories(c.categories);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [adminLocationId, filterCategory]);

  useEffect(() => { if (isAuthenticated && isStaff) load(); }, [isAuthenticated, isStaff, load]);

  // Auto-fill title from filename when a file is picked.
  const onFilePicked = (e) => {
    const f = e.target.files?.[0] || null;
    if (!f) { setFile(null); return; }
    if (f.size > MAX_BYTES) {
      setError(`File too large — max ${MAX_BYTES / 1024 / 1024} MB`);
      e.target.value = '';
      return;
    }
    setError('');
    setFile(f);
    if (!title) {
      // Strip extension, replace separators with spaces, title-case lightly.
      const base = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
      setTitle(base);
    }
  };

  const submitUpload = async () => {
    if (!file || !title.trim()) { setError('Pick a file and give it a title'); return; }
    if (!uploadLocationId) { setError('Select a location to file this document against'); return; }
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('location_id', uploadLocationId);
      fd.append('title', title.trim());
      fd.append('category', category);
      if (expiresAt) fd.append('expires_at', expiresAt);
      await api.documentsUpload(fd);
      // Reset form & refresh
      setFile(null); setTitle(''); setCategory('Policies'); setExpiresAt('');
      setUploadLocationId(adminLocationId || '');
      setShowUpload(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const openPreview = async (doc) => {
    setPreviewDoc(doc);
    setPreviewUrl('');
    setPreviewLoading(true);
    try {
      const url = await api.documentsFileBlobUrl(doc.id);
      setPreviewUrl(url);
    } catch (err) {
      setError(err.message);
      setPreviewDoc(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setPreviewDoc(null);
  };

  const downloadFile = async (doc) => {
    try {
      const url = await api.documentsFileBlobUrl(doc.id);
      const a = document.createElement('a');
      a.href = url; a.download = doc.filename || doc.title || 'file';
      document.body.appendChild(a); a.click(); a.remove();
      // Revoke after a tick so the download has time to start.
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      setError(err.message);
    }
  };

  const removeDoc = async (doc) => {
    if (!window.confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    try {
      await api.documentsDelete(doc.id);
      setDocs(d => d.filter(x => x.id !== doc.id));
    } catch (err) {
      setError(err.message);
    }
  };

  const startEditExpiry = (doc) => {
    setEditingExpiryFor(doc.id);
    setEditExpiryValue(doc.expires_at || '');
  };

  const saveExpiry = async (doc) => {
    try {
      // Empty string clears the expiry → backend stores null → renders as N/A.
      const updated = await api.documentsUpdate(doc.id, { expires_at: editExpiryValue });
      setDocs(prev => prev.map(d => (d.id === doc.id ? { ...d, ...updated } : d)));
      setEditingExpiryFor(null);
    } catch (err) {
      setError(err.message);
    }
  };

  if (!adminLocationId) {
    return (
      <div style={{ padding: 24, ...FONT }}>
        <p style={{ color: '#FF9500' }}>Pick a location from JKHive home first.</p>
      </div>
    );
  }

  // Group docs by category for the listing.
  const grouped = docs.reduce((acc, d) => {
    const k = d.category || 'Other';
    (acc[k] = acc[k] || []).push(d);
    return acc;
  }, {});
  const groupKeys = Object.keys(grouped).sort();

  return (
    <div data-testid="documents-page" style={{ paddingBottom: 90, ...FONT }}>
      {/* Back */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <button
          data-testid="documents-back"
          onClick={() => navigate('/jkhive')}
          style={{ background: 'transparent', border: 0, padding: 4, display: 'inline-flex', alignItems: 'center', gap: 4, color: '#007AFF', cursor: 'pointer', fontSize: 13, fontWeight: 600, ...FONT }}
        >
          <ArrowLeft size={14} /> Intelligence
        </button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <p className="text-[13px] font-medium" style={{ color: '#86868B' }}>Policies, certificates, training records & more</p>
        <h1 className="text-[28px] sm:text-[34px] font-bold tracking-tight leading-[1.05]" style={{ color: '#1D1D1F' }}>
          Documents
        </h1>
        <p className="text-[13px] mt-1" style={{ color: '#86868B' }}>{locationName} · {docs.length} on file</p>
      </div>

      {/* Toolbar */}
      <div style={{
        background: '#FFFFFF', borderRadius: 14, padding: 12, marginBottom: 14,
        display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}>
        <select
          data-testid="documents-filter-category"
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 9, background: '#F5F5F7', border: 0, fontSize: 13, color: '#1D1D1F', ...FONT, flex: '1 1 160px' }}
        >
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          data-testid="documents-show-upload"
          onClick={() => setShowUpload(s => !s)}
          style={{
            padding: '10px 16px', borderRadius: 999, border: 0, background: '#1D1D1F',
            color: '#FFFFFF', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6, ...FONT,
          }}
        >
          <Upload size={14} /> {showUpload ? 'Cancel' : 'Upload'}
        </button>
      </div>

      {/* Upload form */}
      {showUpload && (
        <div data-testid="documents-upload-form"
          style={{ background: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 14, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
        >
          <label style={{ display: 'block', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Location</span>
            <select
              data-testid="documents-upload-location"
              value={uploadLocationId}
              onChange={e => setUploadLocationId(e.target.value)}
              style={{ display: 'block', marginTop: 4, width: '100%', padding: '10px 12px', borderRadius: 10, background: '#F5F5F7', border: 0, fontSize: 14, color: '#1D1D1F', ...FONT }}
            >
              <option value="">Select a location…</option>
              {locations.filter(l => l.is_active !== false).map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'block', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>File</span>
            <input
              data-testid="documents-file-input"
              type="file"
              onChange={onFilePicked}
              accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx,.csv,.txt"
              style={{ display: 'block', marginTop: 4, fontSize: 13, ...FONT }}
            />
            {file && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#86868B' }}>{file.name} · {fmtSize(file.size)}</p>}
          </label>
          <label style={{ display: 'block', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Title</span>
            <input
              data-testid="documents-title-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Allergen Policy v3"
              style={{ display: 'block', marginTop: 4, width: '100%', padding: '10px 12px', borderRadius: 10, background: '#F5F5F7', border: 0, fontSize: 14, color: '#1D1D1F', ...FONT }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Category</span>
            <select
              data-testid="documents-category-input"
              value={category}
              onChange={e => setCategory(e.target.value)}
              style={{ display: 'block', marginTop: 4, width: '100%', padding: '10px 12px', borderRadius: 10, background: '#F5F5F7', border: 0, fontSize: 14, color: '#1D1D1F', ...FONT }}
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label style={{ display: 'block', marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Expires on <span style={{ textTransform: 'none', fontWeight: 500, color: '#86868B' }}>· leave blank if N/A</span></span>
            <input
              data-testid="documents-expiry-input"
              type="date"
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
              style={{ display: 'block', marginTop: 4, width: '100%', padding: '10px 12px', borderRadius: 10, background: '#F5F5F7', border: 0, fontSize: 14, color: '#1D1D1F', ...FONT }}
            />
          </label>
          <button
            data-testid="documents-submit-upload"
            disabled={uploading || !file || !title.trim() || !uploadLocationId}
            onClick={submitUpload}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 999, border: 0,
              background: '#34C759', color: '#FFFFFF', fontSize: 14, fontWeight: 700,
              cursor: uploading ? 'not-allowed' : 'pointer', opacity: (uploading || !file || !title.trim() || !uploadLocationId) ? 0.5 : 1, ...FONT,
            }}
          >
            {uploading ? 'Uploading…' : 'Upload document'}
          </button>
        </div>
      )}

      {error && (
        <div data-testid="documents-error" style={{ background: 'rgba(255,59,48,0.10)', borderRadius: 12, padding: 12, marginBottom: 12, color: '#C0392B', fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading && <p style={{ textAlign: 'center', color: '#86868B', padding: 24 }}>Loading…</p>}

      {!loading && docs.length === 0 && (
        <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 28, textAlign: 'center' }}>
          <FolderOpen size={28} color="#C7C7CC" style={{ margin: '0 auto 8px' }} />
          <p style={{ color: '#1D1D1F', fontSize: 14, fontWeight: 600, margin: 0 }}>No documents yet</p>
          <p style={{ color: '#86868B', fontSize: 12, margin: '4px 0 0' }}>Tap Upload to add your first policy, certificate or risk assessment.</p>
        </div>
      )}

      {!loading && groupKeys.map(group => (
        <div key={group} style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '4px 4px 6px' }}>
            {group} · {grouped[group].length}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {grouped[group].map(doc => {
              const Ico = iconFor(doc.content_type);
              const can = isPreviewable(doc.content_type);
              return (
                <div key={doc.id} data-testid={`documents-row-${doc.id}`}
                  style={{ background: '#FFFFFF', borderRadius: 14, padding: 12, display: 'flex', gap: 12, alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
                >
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: '#F5F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Ico size={20} color="#1D1D1F" strokeWidth={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1D1D1F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#86868B' }}>
                      {fmtSize(doc.size)} · {fmtDateTime(doc.uploaded_at)}
                      {doc.uploaded_by_name && ` · ${doc.uploaded_by_name}`}
                    </p>
                    {(() => {
                      const spec = expirySpec(doc.expires_at);
                      const isEditing = editingExpiryFor === doc.id;
                      return (
                        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {!isEditing && (
                            <span data-testid={`documents-expiry-chip-${doc.id}`}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                                background: spec.bg, color: spec.fg,
                              }}>
                              <CalendarClock size={11} strokeWidth={2.4} /> {spec.label}
                            </span>
                          )}
                          {isAdmin && !isEditing && (
                            <button
                              data-testid={`documents-edit-expiry-${doc.id}`}
                              onClick={() => startEditExpiry(doc)}
                              aria-label="Edit expiry"
                              style={{ background: 'transparent', border: 0, padding: 2, color: '#86868B', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, ...FONT }}
                            >
                              <Pencil size={11} /> {doc.expires_at ? 'Edit' : 'Set expiry'}
                            </button>
                          )}
                          {isEditing && (
                            <>
                              <input
                                data-testid={`documents-expiry-edit-${doc.id}`}
                                type="date"
                                value={editExpiryValue}
                                onChange={e => setEditExpiryValue(e.target.value)}
                                style={{ padding: '4px 6px', borderRadius: 8, background: '#F5F5F7', border: 0, fontSize: 12, color: '#1D1D1F', ...FONT }}
                              />
                              <button data-testid={`documents-expiry-save-${doc.id}`}
                                onClick={() => saveExpiry(doc)}
                                style={{ background: '#1D1D1F', color: '#FFFFFF', border: 0, borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', ...FONT }}
                              >Save</button>
                              <button onClick={() => setEditingExpiryFor(null)}
                                style={{ background: 'transparent', color: '#86868B', border: 0, padding: '4px 6px', fontSize: 11, cursor: 'pointer', ...FONT }}
                              >Cancel</button>
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {can && (
                      <button data-testid={`documents-preview-${doc.id}`} onClick={() => openPreview(doc)}
                        aria-label="Preview"
                        style={{ width: 34, height: 34, borderRadius: 999, border: 0, background: '#F5F5F7', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Eye size={15} color="#1D1D1F" />
                      </button>
                    )}
                    <button data-testid={`documents-download-${doc.id}`} onClick={() => downloadFile(doc)}
                      aria-label="Download"
                      style={{ width: 34, height: 34, borderRadius: 999, border: 0, background: '#F5F5F7', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Download size={15} color="#1D1D1F" />
                    </button>
                    {isAdmin && (
                      <button data-testid={`documents-delete-${doc.id}`} onClick={() => removeDoc(doc)}
                        aria-label="Delete"
                        style={{ width: 34, height: 34, borderRadius: 999, border: 0, background: 'rgba(255,59,48,0.10)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trash2 size={15} color="#C0392B" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Preview modal */}
      {previewDoc && (
        <div data-testid="documents-preview-modal"
          style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={closePreview}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }} />
          <div style={{
            position: 'relative', background: '#FFFFFF', width: '100%', maxWidth: 900, height: '85vh',
            borderRadius: 18, boxShadow: '0 24px 48px rgba(0,0,0,0.28)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden', ...FONT,
          }}>
            <header style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid #E5E5EA' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>{previewDoc.category}</p>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1D1D1F', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{previewDoc.title}</h2>
              </div>
              <button onClick={closePreview} aria-label="Close"
                style={{ width: 34, height: 34, borderRadius: 999, background: '#F5F5F7', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} color="#1D1D1F" />
              </button>
            </header>
            <div style={{ flex: 1, background: '#0F0F12', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }}>
              {previewLoading && <Loader2 size={26} color="#FFFFFF" style={{ animation: 'spin 1s linear infinite' }} />}
              {!previewLoading && previewUrl && (
                previewDoc.content_type?.startsWith('image/')
                  ? <img src={previewUrl} alt={previewDoc.title} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  : <iframe title={previewDoc.title} src={previewUrl} style={{ width: '100%', height: '100%', border: 0, background: '#FFFFFF' }} />
              )}
            </div>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  );
};

export default Documents;
