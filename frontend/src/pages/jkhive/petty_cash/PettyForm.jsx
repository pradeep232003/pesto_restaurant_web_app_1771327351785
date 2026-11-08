import React, { useEffect, useState } from 'react';
import { Plus, Loader2, Save } from 'lucide-react';
import { ReceiptPicker } from './ReceiptPicker';
import { ACCENT, FONT, cardStyle, fieldStyle, labelStyle, isoDay } from './shared';

const blank = (locationId) => ({
  location_id: locationId || '', date: isoDay(new Date()), amount: '',
  category: '', description: '', receipt_url: '',
});

export const PettyForm = ({ sites, categories, defaultLocationId, editing, onSubmit, onCancel, onError }) => {
  const [form, setForm] = useState(blank(defaultLocationId));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(editing ? { ...editing, amount: String(editing.amount) } : blank(defaultLocationId));
  }, [editing, defaultLocationId]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target ? e.target.value : e }));
  const amount = parseFloat(form.amount);
  const valid = form.location_id && form.date && amount > 0 && form.category && form.description.trim();

  const submit = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      const { location_id, date, category, description, receipt_url } = form;
      await onSubmit({ location_id, date, category, description: description.trim(), receipt_url, amount });
      if (!editing) setForm(blank(form.location_id));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="petty-form" style={{ ...cardStyle, border: editing ? `2px solid ${ACCENT}` : 0 }}>
      <p style={labelStyle}>{editing ? 'Edit spend' : 'Record a spend'}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: 10, fontSize: 14, color: '#86868B' }}>£</span>
          <input data-testid="petty-amount" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00"
            value={form.amount} onChange={set('amount')} style={{ ...fieldStyle, paddingLeft: 24, fontWeight: 700 }} />
        </div>
        <input data-testid="petty-date" type="date" value={form.date} max={isoDay(new Date())} onChange={set('date')} style={fieldStyle} />
        <select data-testid="petty-category" value={form.category} onChange={set('category')} style={fieldStyle}>
          <option value="">Category…</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select data-testid="petty-location" value={form.location_id} onChange={set('location_id')} style={fieldStyle}>
          <option value="">Site…</option>
          {sites.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>
      <input data-testid="petty-description" value={form.description} onChange={set('description')} maxLength={300}
        placeholder="What was bought? (e.g. 4 pints semi-skimmed milk, Tesco)" style={{ ...fieldStyle, marginTop: 8 }} />
      <div style={{ marginTop: 10 }}>
        <ReceiptPicker value={form.receipt_url} onChange={set('receipt_url')} onError={onError} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {editing && (
          <button data-testid="petty-cancel-edit" onClick={onCancel}
            style={{ flex: 1, padding: '11px 16px', borderRadius: 10, border: '1px solid #ECECEF', background: '#FFF', color: '#1D1D1F', fontSize: 14, fontWeight: 700, cursor: 'pointer', ...FONT }}>
            Cancel
          </button>
        )}
        <button data-testid="petty-submit" onClick={submit} disabled={!valid || saving}
          style={{ flex: 2, padding: '11px 16px', borderRadius: 10, border: 0, background: !valid || saving ? '#C7C7CC' : ACCENT, color: '#FFF', fontSize: 14, fontWeight: 700, cursor: !valid || saving ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, ...FONT }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : editing ? <Save size={14} /> : <Plus size={14} />}
          {editing ? 'Save changes' : 'Add spend'}
        </button>
      </div>
    </div>
  );
};
