import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Coins, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';
import { api } from '../../lib/api';
import { FONT, ACCENT, presetRange } from './petty_cash/shared';
import { PettyForm } from './petty_cash/PettyForm';
import { PettyFilters } from './petty_cash/PettyFilters';
import { PettySummary } from './petty_cash/PettySummary';
import { PettyList } from './petty_cash/PettyList';

const PettyCash = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { adminLocationId, locations } = useLocation2();
  const sites = locations || [];

  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState(() => ({ ...presetRange('month'), preset: 'month', location: 'all', category: 'all' }));
  const [data, setData] = useState({ items: [] });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(null);

  useEffect(() => { api.pettyCashCategories().then((r) => setCategories(r.categories || [])).catch(() => {}); }, []);

  const load = async () => {
    setLoading(true); setErr('');
    try {
      setData(await api.pettyCashList({ location_id: filters.location, date_from: filters.from, date_to: filters.to, category: filters.category }));
    } catch (e) {
      setErr(e.message || 'Failed to load'); setData({ items: [] });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [filters.from, filters.to, filters.location, filters.category]);

  const submit = async (payload) => {
    setErr('');
    try {
      if (editing) await api.pettyCashUpdate(editing.id, payload);
      else await api.pettyCashCreate(payload);
      setEditing(null);
      await load();
    } catch (e) {
      setErr(e.message || 'Save failed');
      throw e;
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete £${row.amount.toFixed(2)} — "${row.description}"?`)) return;
    try { await api.pettyCashDelete(row.id); if (editing?.id === row.id) setEditing(null); await load(); }
    catch (e) { setErr(e.message || 'Delete failed'); }
  };

  const startEdit = (row) => { setEditing(row); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <div data-testid="petty-cash-page" style={{ paddingBottom: 32, ...FONT }}>
      <button data-testid="petty-back" onClick={() => navigate('/jkhive')}
        style={{ background: 'none', border: 0, color: '#007AFF', fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 6, padding: 0 }}>
        <ArrowLeft size={14} /> Intelligence
      </button>
      <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.05, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Coins size={30} color={ACCENT} /> Petty Cash
      </h1>
      <p style={{ margin: '6px 0 16px', fontSize: 14, color: '#86868B' }}>
        {isAdmin ? 'Every cash spend across your sites. Filter by date, site and category.' : 'Log cash you spend for the site — milk, cleaning bits and so on. You see your own entries.'}
      </p>

      <PettyForm sites={sites} categories={categories} defaultLocationId={adminLocationId || sites[0]?.id}
        editing={editing} onSubmit={submit} onCancel={() => setEditing(null)} onError={setErr} />

      {err && (
        <div data-testid="petty-error" style={{ background: 'rgba(255,59,48,0.10)', color: '#C0392B', padding: 12, borderRadius: 12, fontSize: 13, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={14} /> {err}
        </div>
      )}

      <PettyFilters filters={filters} setFilters={setFilters} sites={sites} categories={categories} />
      <PettySummary data={data} sites={sites} isAdmin={isAdmin} />

      {loading && (
        <p style={{ textAlign: 'center', padding: 20, color: '#86868B', fontSize: 13 }}>
          <Loader2 size={14} className="animate-spin" style={{ verticalAlign: 'middle', marginRight: 6 }} /> Loading…
        </p>
      )}
      {!loading && data.items.length === 0 && (
        <div data-testid="petty-empty" style={{ background: '#FFF', borderRadius: 14, padding: 28, textAlign: 'center', color: '#86868B', fontSize: 13 }}>
          No spends for these filters yet.
        </div>
      )}
      {!loading && data.items.length > 0 && <PettyList items={data.items} sites={sites} onEdit={startEdit} onDelete={remove} />}
    </div>
  );
};

export default PettyCash;
