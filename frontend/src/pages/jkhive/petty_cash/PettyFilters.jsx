import React from 'react';
import { FONT, ACCENT, cardStyle, fieldStyle, labelStyle, presetRange } from './shared';

const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: 'month', label: 'This month' },
  { key: 'last-month', label: 'Last month' },
  { key: 'all', label: 'All time' },
];

export const PettyFilters = ({ filters, setFilters, sites, categories }) => {
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value, preset: k === 'from' || k === 'to' ? '' : f.preset }));
  const applyPreset = (key) => {
    const r = presetRange(key);
    setFilters((f) => ({ ...f, from: r.from, to: r.to, preset: key }));
  };

  return (
    <div data-testid="petty-filters" style={cardStyle}>
      <p style={labelStyle}>Filter</p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {PRESETS.map((p) => (
          <button key={p.key} data-testid={`petty-preset-${p.key}`} onClick={() => applyPreset(p.key)}
            style={{ border: 0, padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: filters.preset === p.key ? ACCENT : '#F5F5F7', color: filters.preset === p.key ? '#FFF' : '#1D1D1F', ...FONT }}>
            {p.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        <label style={{ fontSize: 11, color: '#86868B' }}>From
          <input data-testid="petty-filter-from" type="date" value={filters.from} max={filters.to || undefined} onChange={set('from')} style={{ ...fieldStyle, marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 11, color: '#86868B' }}>To
          <input data-testid="petty-filter-to" type="date" value={filters.to} min={filters.from || undefined} onChange={set('to')} style={{ ...fieldStyle, marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 11, color: '#86868B' }}>Site
          <select data-testid="petty-filter-location" value={filters.location} onChange={set('location')} style={{ ...fieldStyle, marginTop: 4 }}>
            <option value="all">All sites</option>
            {sites.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 11, color: '#86868B' }}>Category
          <select data-testid="petty-filter-category" value={filters.category} onChange={set('category')} style={{ ...fieldStyle, marginTop: 4 }}>
            <option value="all">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
};
