import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Camera, Upload, X, Trash2, MapPin, Edit3, FileText, Loader2, AlertTriangle, Receipt, Plus, Search,
} from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';

const FONT = { fontFamily: 'Outfit, sans-serif' };

const fmtMoney = (v) => `£${(Number(v) || 0).toFixed(2)}`;
const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * /jkhive/invoices
 *  - Staff: scan/upload a delivery invoice with the phone camera. Claude
 *    Sonnet 4.5 (vision) extracts supplier, items, qty, unit price, VAT,
 *    total. Staff can amend before saving and see all invoices for the
 *    current location.
 *  - Admin / Super admin: can ALSO change the location (e.g. when a staff
 *    member accidentally scanned the receipt under the wrong site) and
 *    delete invoices.
 */
const Invoices = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, loading: authLoading } = useAuth();
  const { adminLocationId, locations } = useLocation2();

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // full invoice doc

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/admin-login');
  }, [authLoading, isAuthenticated, navigate]);

  const load = async () => {
    if (!adminLocationId) return;
    setLoading(true);
    try {
      const rows = await api.invoicesList({ location_id: adminLocationId });
      setList(rows || []);
    } catch (e) {
      setError(e.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [adminLocationId]);

  const filtered = list.filter(r =>
    !search
      ? true
      : (r.supplier || '').toLowerCase().includes(search.toLowerCase())
        || (r.invoice_number || '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div data-testid="invoices-page" style={{ ...FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <button data-testid="invoices-back" onClick={() => navigate('/jkhive')} style={{ background: 'none', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: '#007AFF', ...FONT }}>
          <ArrowLeft size={16} /> Back
        </button>
        <div style={{ flex: 1 }} />
        <ScanButton onScanned={load} adminLocationId={adminLocationId} setBusy={setBusy} busy={busy} setError={setError} />
      </div>

      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1D1D1F', margin: '0 0 4px' }}>Invoices</h1>
      <p style={{ fontSize: 13, color: '#86868B', margin: '0 0 16px' }}>
        Snap a photo of supplier delivery invoices. AI auto-extracts itemised products, prices, VAT and total.
      </p>

      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: 12, color: '#86868B' }} />
        <input
          data-testid="invoices-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search supplier or invoice #"
          style={{ width: '100%', padding: '10px 12px 10px 32px', borderRadius: 12, border: 0, background: '#FFFFFF', boxShadow: '0 0 0 1px rgba(0,0,0,0.06)', fontSize: 13, ...FONT }}
        />
      </div>

      {error && (
        <div data-testid="invoices-error" style={{ background: 'rgba(255,59,48,0.08)', borderRadius: 12, padding: '10px 12px', marginBottom: 12, color: '#C0392B', fontSize: 12, ...FONT, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <AlertTriangle size={14} /> <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 0, color: '#C0392B', cursor: 'pointer' }}><X size={14} /></button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="animate-spin" size={20} color="#86868B" /></div>
      ) : filtered.length === 0 ? (
        <div data-testid="invoices-empty" style={{ background: '#FFFFFF', borderRadius: 14, padding: 32, textAlign: 'center', color: '#86868B', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <Receipt size={28} color="#C7C7CC" style={{ margin: '0 auto 8px' }} />
          <p style={{ fontSize: 14, margin: 0 }}>No invoices yet for this location.</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>Tap &quot;Scan Invoice&quot; to snap one with your camera.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {filtered.map(r => (
            <InvoiceCard
              key={r.id}
              invoice={r}
              isAdmin={isAdmin}
              locations={locations}
              onOpen={() => setEditing(r)}
            />
          ))}
        </div>
      )}

      {editing && (
        <InvoiceModal
          invoice={editing}
          isAdmin={isAdmin}
          locations={locations}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
};

/** Toolbar Scan button — kicks off a file pick. On mobile this opens
 *  the OS camera picker because of `capture="environment"`. */
const ScanButton = ({ adminLocationId, setBusy, busy, setError, onScanned }) => {
  const ref = useRef(null);
  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!adminLocationId) {
      setError('Pick a location first');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('location_id', adminLocationId);
      await api.invoiceScan(fd);
      await onScanned();
    } catch (err) {
      setError(err.message || 'Scan failed');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <input ref={ref} data-testid="invoices-file-input" type="file" accept="image/*,application/pdf" capture="environment" hidden onChange={onPick} />
      <button
        data-testid="invoices-scan-btn"
        onClick={() => ref.current?.click()}
        disabled={busy || !adminLocationId}
        style={{
          padding: '8px 14px', borderRadius: 999, border: 0,
          background: 'linear-gradient(135deg, #34C759 0%, #007AFF 100%)',
          color: '#FFFFFF', fontSize: 13, fontWeight: 700,
          cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1,
          display: 'inline-flex', alignItems: 'center', gap: 6, ...FONT,
        }}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
        {busy ? 'Reading…' : 'Scan Invoice'}
      </button>
    </>
  );
};

const InvoiceCard = ({ invoice, locations, onOpen }) => {
  const loc = locations.find(l => l.id === invoice.location_id);
  const failed = invoice.ai_status === 'failed';
  return (
    <button
      data-testid={`invoice-card-${invoice.id}`}
      onClick={onOpen}
      style={{
        textAlign: 'left', background: '#FFFFFF', borderRadius: 14, padding: 14,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)', border: 0, cursor: 'pointer', ...FONT,
        display: 'flex', flexDirection: 'column', gap: 6,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#1D1D1F', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {invoice.supplier || (failed ? 'Untitled · AI failed' : 'Untitled supplier')}
          </p>
          <p style={{ fontSize: 11, color: '#86868B', margin: '2px 0 0' }}>
            {invoice.invoice_number ? `#${invoice.invoice_number} · ` : ''}{fmtDate(invoice.invoice_date || invoice.uploaded_at)}
          </p>
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#1D1D1F' }}>{fmtMoney(invoice.total)}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#86868B' }}>
        <MapPin size={11} /> {loc?.name || invoice.location_id}
        <span>·</span>
        <span>{(invoice.items || []).length} items</span>
        {invoice.vat > 0 && <><span>·</span><span>VAT {fmtMoney(invoice.vat)}</span></>}
        {failed && (
          <span style={{ marginLeft: 'auto', background: 'rgba(255,149,0,0.15)', color: '#A35E00', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
            AI failed
          </span>
        )}
      </div>
    </button>
  );
};

/** Detail / edit drawer. Admin can change location, edit fields, delete.
 *  Staff get a read-only view with the photo + line items. */
const InvoiceModal = ({ invoice: initial, isAdmin, locations, onClose, onSaved }) => {
  // Defensive normalisation — when an AI-failed scan opens the modal the
  // invoice_date can be '' or any free-form string. <input type="date">
  // requires either '' or 'YYYY-MM-DD' so coerce anything else to ''.
  const safeDate = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
  const [invoice, setInvoice] = useState({
    ...initial,
    invoice_date: safeDate(initial?.invoice_date),
    items: Array.isArray(initial?.items) ? initial.items : [],
  });
  const safeLocations = Array.isArray(locations) ? locations : [];
  const [editingFields, setEditingFields] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Fetch the image as a blob URL so the <img> tag carries the auth header
  // (cross-origin <img src> does NOT send Bearer tokens).
  const [fileUrl, setFileUrl] = useState('');
  useEffect(() => {
    let revoke = '';
    let cancelled = false;
    (async () => {
      try {
        const url = await api.invoiceFileBlobUrl(invoice.id);
        if (cancelled) URL.revokeObjectURL(url);
        else { setFileUrl(url); revoke = url; }
      } catch { /* leave fileUrl '' — preview just won't render */ }
    })();
    return () => { cancelled = true; if (revoke) URL.revokeObjectURL(revoke); };
  }, [invoice.id]);

  const save = async () => {
    setBusy(true);
    setErr('');
    try {
      const payload = {
        location_id: invoice.location_id,
        supplier: invoice.supplier,
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        subtotal: Number(invoice.subtotal) || 0,
        vat: Number(invoice.vat) || 0,
        total: Number(invoice.total) || 0,
        items: (invoice.items || []).map(it => ({
          description: it.description || '',
          qty: Number(it.qty) || 0,
          unit_price: Number(it.unit_price) || 0,
          line_total: Number(it.line_total) || 0,
        })),
        note: invoice.note || '',
      };
      await api.invoiceUpdate(invoice.id, payload);
      onSaved();
    } catch (e) {
      setErr(e.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this invoice? This cannot be undone.')) return;
    setBusy(true);
    try {
      await api.invoiceDelete(invoice.id);
      onSaved();
    } catch (e) {
      setErr(e.message || 'Delete failed');
      setBusy(false);
    }
  };

  const setField = (k, v) => setInvoice(prev => ({ ...prev, [k]: v }));
  const setItem = (idx, k, v) => setInvoice(prev => {
    const items = [...(prev.items || [])];
    items[idx] = { ...items[idx], [k]: v };
    return { ...prev, items };
  });
  const addItem = () => setInvoice(prev => ({ ...prev, items: [...(prev.items || []), { description: '', qty: 1, unit_price: 0, line_total: 0 }] }));
  const removeItem = (idx) => setInvoice(prev => ({ ...prev, items: (prev.items || []).filter((_, i) => i !== idx) }));

  const canEditAll = isAdmin || editingFields;

  return (
    <div data-testid="invoice-modal" style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
      <div style={{
        position: 'relative', background: '#FFFFFF', width: '100%', maxWidth: 720,
        borderRadius: '20px 20px 0 0', padding: '18px 18px 24px', maxHeight: '92vh',
        overflowY: 'auto', ...FONT,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>Invoice</p>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1D1D1F', margin: '2px 0 0' }}>
              {invoice.supplier || 'Untitled'}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {!isAdmin && !editingFields && (
              <button data-testid="invoice-edit-toggle" onClick={() => setEditingFields(true)}
                style={{ width: 32, height: 32, borderRadius: 999, background: '#F5F5F7', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Edit3 size={14} color="#1D1D1F" />
              </button>
            )}
            <button onClick={onClose} aria-label="Close"
              style={{ width: 32, height: 32, borderRadius: 999, background: '#F5F5F7', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={15} color="#1D1D1F" />
            </button>
          </div>
        </div>

        {invoice.ai_status === 'failed' && (
          <div style={{ background: 'rgba(255,149,0,0.12)', borderRadius: 12, padding: '8px 10px', marginBottom: 12, fontSize: 12, color: '#A35E00' }}>
            AI couldn&apos;t read this invoice — fill in the fields manually.
            {invoice.ai_error && <span style={{ display: 'block', marginTop: 2, opacity: 0.8 }}>{invoice.ai_error}</span>}
          </div>
        )}

        {/* Photo preview */}
        <div style={{ marginBottom: 12, borderRadius: 12, overflow: 'hidden', background: '#F5F5F7' }}>
          {!fileUrl ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#86868B', fontSize: 12 }}>Loading image…</div>
          ) : (invoice.content_type || '').startsWith('image/') ? (
            <img data-testid="invoice-image" src={fileUrl} alt="Invoice" style={{ display: 'block', width: '100%', maxHeight: 360, objectFit: 'contain' }} />
          ) : (
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 14, color: '#007AFF', fontSize: 13 }}>
              <FileText size={16} /> Open original PDF
            </a>
          )}
        </div>

        {/* Header fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <Field label="Supplier" value={invoice.supplier} onChange={(v) => setField('supplier', v)} disabled={!canEditAll} testId="invoice-supplier" />
          <Field label="Invoice #" value={invoice.invoice_number} onChange={(v) => setField('invoice_number', v)} disabled={!canEditAll} testId="invoice-number" />
          <Field label="Date" type="date" value={invoice.invoice_date} onChange={(v) => setField('invoice_date', v)} disabled={!canEditAll} testId="invoice-date" />
          {/* Only admins can change the location (the user's hard requirement). */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Location</label>
            <select
              data-testid="invoice-location-select"
              value={invoice.location_id || ''}
              onChange={(e) => setField('location_id', e.target.value)}
              disabled={!isAdmin}
              style={{
                marginTop: 2, width: '100%', padding: '8px 10px', borderRadius: 10, border: 0,
                background: isAdmin ? '#FFFFFF' : '#F5F5F7', boxShadow: '0 0 0 1px rgba(0,0,0,0.06)',
                fontSize: 13, ...FONT, cursor: isAdmin ? 'pointer' : 'not-allowed',
              }}>
              {safeLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        </div>

        {/* Line items */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>Line Items</p>
            {canEditAll && (
              <button data-testid="invoice-add-item" onClick={addItem} style={{ border: 0, background: 'transparent', color: '#007AFF', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Plus size={12} /> Add row
              </button>
            )}
          </div>
          <div style={{ background: '#F9F9FB', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 60px 80px 80px 28px', gap: 6, padding: '6px 8px', fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <span>Description</span><span>Qty</span><span>Unit £</span><span>Total £</span><span></span>
            </div>
            {(invoice.items || []).length === 0 && (
              <p style={{ padding: 10, margin: 0, textAlign: 'center', fontSize: 12, color: '#86868B' }}>No items yet</p>
            )}
            {(invoice.items || []).map((it, i) => (
              <div key={i} data-testid={`invoice-item-${i}`} style={{ display: 'grid', gridTemplateColumns: '2fr 60px 80px 80px 28px', gap: 6, padding: '4px 8px', alignItems: 'center', borderTop: '1px solid #ECECEF' }}>
                <input value={it.description || ''} onChange={(e) => setItem(i, 'description', e.target.value)} disabled={!canEditAll} placeholder="Item" style={inputStyle(canEditAll)} />
                <input type="number" step="0.001" value={it.qty ?? ''} onChange={(e) => setItem(i, 'qty', e.target.value)} disabled={!canEditAll} style={inputStyle(canEditAll)} />
                <input type="number" step="0.01" value={it.unit_price ?? ''} onChange={(e) => setItem(i, 'unit_price', e.target.value)} disabled={!canEditAll} style={inputStyle(canEditAll)} />
                <input type="number" step="0.01" value={it.line_total ?? ''} onChange={(e) => setItem(i, 'line_total', e.target.value)} disabled={!canEditAll} style={inputStyle(canEditAll)} />
                {canEditAll ? (
                  <button data-testid={`invoice-remove-item-${i}`} onClick={() => removeItem(i)} aria-label="Remove" style={{ background: 'transparent', border: 0, cursor: 'pointer', color: '#FF3B30' }}>
                    <Trash2 size={13} />
                  </button>
                ) : <span />}
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
          <Field label="Subtotal £" type="number" step="0.01" value={invoice.subtotal} onChange={(v) => setField('subtotal', v)} disabled={!canEditAll} testId="invoice-subtotal" />
          <Field label="VAT £" type="number" step="0.01" value={invoice.vat} onChange={(v) => setField('vat', v)} disabled={!canEditAll} testId="invoice-vat" />
          <Field label="Total £" type="number" step="0.01" value={invoice.total} onChange={(v) => setField('total', v)} disabled={!canEditAll} testId="invoice-total" />
        </div>

        {err && <p data-testid="invoice-modal-error" style={{ color: '#C0392B', fontSize: 12, marginBottom: 8 }}>{err}</p>}

        <div style={{ display: 'flex', gap: 8 }}>
          {isAdmin && (
            <button data-testid="invoice-delete" onClick={remove} disabled={busy}
              style={{ padding: '10px 14px', borderRadius: 999, border: 0, background: 'rgba(255,59,48,0.10)', color: '#C0392B', fontSize: 13, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, ...FONT }}>
              <Trash2 size={13} /> Delete
            </button>
          )}
          <div style={{ flex: 1 }} />
          {canEditAll && (
            <button data-testid="invoice-save" onClick={save} disabled={busy}
              style={{ padding: '10px 18px', borderRadius: 999, border: 0, background: '#1D1D1F', color: '#FFFFFF', fontSize: 13, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1, ...FONT }}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          )}
        </div>
        {!isAdmin && (
          <p style={{ marginTop: 10, fontSize: 11, color: '#86868B', textAlign: 'center' }}>
            Only Admins can change the location or delete this invoice.
          </p>
        )}
      </div>
    </div>
  );
};

const Field = ({ label, value, onChange, disabled, testId, type = 'text', step }) => (
  <div>
    <label style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</label>
    <input
      data-testid={testId}
      type={type}
      step={step}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={inputStyle(!disabled)}
    />
  </div>
);

const inputStyle = (editable) => ({
  marginTop: 2, width: '100%', padding: '7px 10px', borderRadius: 8, border: 0,
  background: editable ? '#FFFFFF' : '#F5F5F7',
  boxShadow: '0 0 0 1px rgba(0,0,0,0.06)', fontSize: 13, ...FONT,
});

export default Invoices;
