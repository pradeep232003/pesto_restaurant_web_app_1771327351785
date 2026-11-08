import React from 'react';
import { CATEGORY_COLOURS, cardStyle, gbp, labelStyle } from './shared';

export const PettySummary = ({ data, sites, isAdmin }) => {
  const cats = Object.entries(data.by_category || {}).sort((a, b) => b[1] - a[1]);
  const locs = Object.entries(data.by_location || {}).sort((a, b) => b[1] - a[1]);
  const nameFor = (id) => sites.find((l) => l.id === id)?.name || 'Unknown site';
  const total = data.total || 0;

  return (
    <div data-testid="petty-summary" style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <p style={{ ...labelStyle, margin: 0 }}>{isAdmin ? 'Total spent' : 'Your spends'}</p>
        <span style={{ fontSize: 12, color: '#86868B' }} data-testid="petty-summary-count">{data.count || 0} entries</span>
      </div>
      <p data-testid="petty-summary-total" style={{ margin: '4px 0 10px', fontSize: 34, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.02em' }}>
        {gbp(total)}
      </p>
      {cats.length > 0 && (
        <div style={{ display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden', background: '#F5F5F7', marginBottom: 10 }}>
          {cats.map(([c, v]) => <div key={c} title={`${c} ${gbp(v)}`} style={{ width: `${(v / total) * 100}%`, background: CATEGORY_COLOURS[c] || '#8E8E93' }} />)}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {cats.map(([c, v]) => (
          <span key={c} data-testid={`petty-cat-total-${c}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#1D1D1F', background: '#F5F5F7', padding: '4px 10px', borderRadius: 999 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: CATEGORY_COLOURS[c] || '#8E8E93' }} />
            {c} <strong>{gbp(v)}</strong>
          </span>
        ))}
      </div>
      {isAdmin && locs.length > 1 && (
        <div style={{ marginTop: 12, borderTop: '1px solid #F2F2F7', paddingTop: 10, display: 'grid', gap: 4 }}>
          {locs.map(([id, v]) => (
            <div key={id} data-testid={`petty-loc-total-${id}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#3A3A3C' }}>
              <span>{nameFor(id)}</span><strong>{gbp(v)}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
