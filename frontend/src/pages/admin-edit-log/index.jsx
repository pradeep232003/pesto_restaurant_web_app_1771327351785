import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Filter, ChevronDown } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

const ACTION_COLORS = {
  create: { color: '#34C759', bg: 'rgba(52,199,89,0.1)' },
  update: { color: '#007AFF', bg: 'rgba(0,122,255,0.1)' },
  delete: { color: '#FF3B30', bg: 'rgba(255,59,48,0.1)' },
};

const AdminEditLog = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, loading: authLoading } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) navigate('/admin-login');
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) fetchLog();
  }, [isAuthenticated, isAdmin]);

  const fetchLog = async () => {
    setLoading(true);
    try {
      const d = await api.adminGetEditLog({ record_type: filterType || undefined, start_date: filterStart || undefined, end_date: filterEnd || undefined });
      setEntries(d);
    } catch {} finally { setLoading(false); }
  };

  if (authLoading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>;

  const font = { fontFamily: 'Outfit, sans-serif' };
  const inputBase = "w-full px-3 py-2.5 rounded-xl text-sm border-0 outline-none min-w-0";
  const inputStyle = { background: '#FFFFFF', color: '#1D1D1F', ...font, boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto" data-testid="admin-edit-log-page">
      <div className="mb-5">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: '#1D1D1F', ...font }}>Edit Log</h1>
        <p className="text-xs sm:text-sm mt-1" style={{ color: '#86868B' }}>Audit trail for all data changes</p>
      </div>

      <div className="space-y-3 sm:space-y-0 sm:flex sm:flex-wrap sm:gap-3 sm:items-end mb-5">
        <div className="sm:w-auto">
          <label className="block text-xs font-medium mb-1" style={{ color: '#86868B', ...font }}>Type</label>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className={inputBase} style={inputStyle}>
            <option value="">All</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="daily_sales">Daily Sales</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:contents">
          <div><label className="block text-xs font-medium mb-1" style={{ color: '#86868B', ...font }}>From</label>
            <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} className={inputBase} style={inputStyle} /></div>
          <div><label className="block text-xs font-medium mb-1" style={{ color: '#86868B', ...font }}>To</label>
            <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} className={inputBase} style={inputStyle} /></div>
        </div>
        <button onClick={fetchLog} className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all" style={{ background: '#1D1D1F', color: '#FFFFFF', ...font }}><Filter size={14} /> Apply</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ background: '#FFFFFF' }}>
          <FileText size={32} className="mx-auto mb-3" style={{ color: '#C7C7CC' }} />
          <p className="text-sm" style={{ color: '#86868B', ...font }}>No edit history found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(e => {
            const ac = ACTION_COLORS[e.action] || ACTION_COLORS.update;
            const isOpen = expandedId === e.id;
            const ts = e.timestamp ? new Date(e.timestamp).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '';
            return (
              <div key={e.id} className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF' }}>
                <button onClick={() => setExpandedId(isOpen ? null : e.id)} className="w-full flex items-center justify-between px-4 py-3.5 text-left active:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-md shrink-0" style={{ background: ac.bg, color: ac.color }}>{e.action}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: '#1D1D1F', ...font }}>{e.record_type?.replace('_', ' ')}</p>
                      <p className="text-[11px]" style={{ color: '#86868B' }}>{e.edited_by_name || e.edited_by} · {ts}</p>
                    </div>
                  </div>
                  <ChevronDown size={14} className="shrink-0 ml-2" style={{ color: '#86868B', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 space-y-2" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                    <div className="flex gap-2 mt-3">
                      <span className="text-[11px] font-medium w-12" style={{ color: '#86868B' }}>Role:</span>
                      <span className="text-[11px]" style={{ color: '#1D1D1F' }}>{e.role}</span>
                    </div>
                    {e.before && (
                      <div>
                        <p className="text-[11px] font-medium mb-1" style={{ color: '#FF3B30' }}>Before:</p>
                        <div className="p-2.5 rounded-lg text-xs space-y-0.5" style={{ background: 'rgba(255,59,48,0.04)' }}>
                          {Object.entries(e.before).map(([k, v]) => (
                            <div key={k} className="flex gap-2"><span className="font-medium" style={{ color: '#86868B' }}>{k}:</span><span style={{ color: '#1D1D1F' }}>{v?.toString() || '—'}</span></div>
                          ))}
                        </div>
                      </div>
                    )}
                    {e.after && (
                      <div>
                        <p className="text-[11px] font-medium mb-1" style={{ color: '#34C759' }}>After:</p>
                        <div className="p-2.5 rounded-lg text-xs space-y-0.5" style={{ background: 'rgba(52,199,89,0.04)' }}>
                          {Object.entries(e.after).map(([k, v]) => (
                            <div key={k} className="flex gap-2"><span className="font-medium" style={{ color: '#86868B' }}>{k}:</span><span style={{ color: '#1D1D1F' }}>{v?.toString() || '—'}</span></div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminEditLog;
