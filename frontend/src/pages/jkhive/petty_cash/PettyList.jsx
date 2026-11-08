import React from 'react';
import { Pencil, Trash2, Receipt } from 'lucide-react';
import { resolveImageUrl } from '../../../lib/api';
import { CATEGORY_COLOURS, gbp, fmtDay } from './shared';

const iconBtn = (bg, fg) => ({
  width: 32, height: 32, borderRadius: 999, background: bg, color: fg, border: 0,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
});

const Row = ({ row, siteName, siteColour, onEdit, onDelete }) => (
  <div data-testid={`petty-row-${row.id}`} style={{ background: '#FFF', borderRadius: 12, padding: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', display: 'flex', gap: 10, alignItems: 'flex-start', borderLeft: `4px solid ${siteColour}` }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#FFF', background: CATEGORY_COLOURS[row.category] || '#8E8E93', padding: '2px 8px', borderRadius: 999 }}>{row.category}</span>
        <span style={{ fontSize: 11, color: '#86868B' }}>{siteName}</span>
      </div>
      <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 600, color: '#1D1D1F', overflowWrap: 'anywhere' }}>{row.description}</p>
      <p style={{ margin: '3px 0 0', fontSize: 11, color: '#86868B' }}>
        {fmtDay(row.date)} · by <strong>{row.added_by_name || row.added_by}</strong>
      </p>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      <span data-testid={`petty-row-amount-${row.id}`} style={{ fontSize: 17, fontWeight: 800, color: '#1D1D1F' }}>{gbp(row.amount)}</span>
      <div style={{ display: 'flex', gap: 6 }}>
        {row.receipt_url && (
          <a data-testid={`petty-row-receipt-${row.id}`} href={resolveImageUrl(row.receipt_url)} target="_blank" rel="noreferrer" title="View receipt" style={iconBtn('rgba(52,199,89,0.12)', '#1D7A3A')}>
            <Receipt size={13} />
          </a>
        )}
        <button data-testid={`petty-row-edit-${row.id}`} onClick={() => onEdit(row)} title="Edit" style={iconBtn('rgba(0,122,255,0.10)', '#007AFF')}><Pencil size={13} /></button>
        <button data-testid={`petty-row-delete-${row.id}`} onClick={() => onDelete(row)} title="Delete" style={iconBtn('rgba(255,59,48,0.10)', '#FF3B30')}><Trash2 size={13} /></button>
      </div>
    </div>
  </div>
);

export const PettyList = ({ items, sites, onEdit, onDelete }) => {
  const site = (id) => sites.find((l) => l.id === id);
  return (
    <div data-testid="petty-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((row) => (
        <Row key={row.id} row={row} siteName={site(row.location_id)?.name || 'Unknown site'}
          siteColour={(site(row.location_id)?.color || '').trim() || '#C7C7CC'} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
};
