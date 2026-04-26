import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gift, ChevronDown, Search } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';

const AdminLoyalty = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, loading: authLoading } = useAuth();
  const { locations } = useLocation2();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) navigate('/admin-login');
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) fetchCustomers();
  }, [isAuthenticated, isAdmin]);

  const fetchCustomers = async () => {
    try {
      const d = await api.adminGetLoyaltyCustomers();
      setCustomers(d);
    } catch {} finally { setLoading(false); }
  };

  const toggleExpand = async (cid) => {
    if (expandedId === cid) { setExpandedId(null); setDetail(null); return; }
    setExpandedId(cid);
    setDetailLoading(true);
    try {
      const d = await api.adminGetLoyaltyDetail(cid);
      setDetail(d);
    } catch {} finally { setDetailLoading(false); }
  };

  const getLocationName = (locId) => locations.find(l => l.id === locId)?.name || locId;
  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    return !q || c.customer_name?.toLowerCase().includes(q) || c.customer_email?.toLowerCase().includes(q);
  });
  const totalAllSpend = customers.reduce((s, c) => s + c.total_spend, 0);

  if (authLoading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>;

  const font = { fontFamily: 'Outfit, sans-serif' };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto" data-testid="admin-loyalty-page">
      <div className="mb-5">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: '#1D1D1F', ...font }}>Loyalty Program</h1>
        <p className="text-xs sm:text-sm mt-1" style={{ color: '#86868B' }}>Customer spend tracking</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="p-4 rounded-2xl" style={{ background: '#FFFFFF' }}>
          <p className="text-xl font-bold" style={{ color: '#1D1D1F', ...font }}>{customers.length}</p>
          <p className="text-[11px]" style={{ color: '#86868B' }}>Members</p>
        </div>
        <div className="p-4 rounded-2xl" style={{ background: '#FFFFFF' }}>
          <p className="text-xl font-bold" style={{ color: '#34C759', ...font }}>{'\u00A3'}{totalAllSpend.toFixed(0)}</p>
          <p className="text-[11px]" style={{ color: '#86868B' }}>Total Spend</p>
        </div>
        <div className="p-4 rounded-2xl" style={{ background: '#FFFFFF' }}>
          <p className="text-xl font-bold" style={{ color: '#1D1D1F', ...font }}>{customers.reduce((s, c) => s + c.visits, 0)}</p>
          <p className="text-[11px]" style={{ color: '#86868B' }}>Total Visits</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#86868B' }} />
        <input type="text" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border-0 outline-none"
          style={{ background: '#FFFFFF', color: '#1D1D1F', ...font, boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }} />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ background: '#FFFFFF' }}>
          <Gift size={32} className="mx-auto mb-3" style={{ color: '#C7C7CC' }} />
          <p className="text-sm" style={{ color: '#86868B', ...font }}>No loyalty members yet. Scan a customer's QR to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.customer_id} className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF' }}>
              <button onClick={() => toggleExpand(c.customer_id)}
                className="w-full flex items-center justify-between px-4 py-3.5 text-left active:bg-gray-50 transition-colors">
                <div className="min-w-0 mr-3">
                  <p className="text-sm font-medium truncate" style={{ color: '#1D1D1F', ...font }}>{c.customer_name || 'Unknown'}</p>
                  <p className="text-[11px]" style={{ color: '#86868B' }}>{c.customer_email} · {c.visits} visit{c.visits !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <p className="text-sm font-bold" style={{ color: '#34C759', ...font }}>{'\u00A3'}{c.total_spend.toFixed(2)}</p>
                  <ChevronDown size={14} style={{ color: '#86868B', transform: expandedId === c.customer_id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </div>
              </button>

              {expandedId === c.customer_id && (
                <div className="px-4 pb-4" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                  {detailLoading ? (
                    <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>
                  ) : detail?.transactions?.length > 0 ? (
                    <div className="space-y-1.5 mt-3">
                      {detail.transactions.map(t => (
                        <div key={t.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ background: '#F5F5F7' }}>
                          <div className="min-w-0">
                            <p className="text-xs font-medium" style={{ color: '#1D1D1F', ...font }}>{t.created_at?.substring(0, 10)}</p>
                            <p className="text-[11px] truncate" style={{ color: '#86868B' }}>{getLocationName(t.location_id)}{t.note ? ` · ${t.note}` : ''}</p>
                            <p className="text-[10px]" style={{ color: '#C7C7CC' }}>By {t.scanned_by_name || t.scanned_by}</p>
                          </div>
                          <p className="text-sm font-semibold shrink-0 ml-3" style={{ color: '#1D1D1F', ...font }}>{'\u00A3'}{t.amount?.toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs py-4 text-center" style={{ color: '#86868B' }}>No transactions</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminLoyalty;
