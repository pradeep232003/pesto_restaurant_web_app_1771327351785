import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Icon from '../../components/AppIcon';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

const LOCATION_NAMES = {
  'oakmere-handforth': 'Oakmere, Handforth',
  'willowmere-middlewich': 'Willowmere, Middlewich',
};

const ResidentHistory = () => {
  const navigate = useNavigate();
  const { residentId } = useParams();
  const { isAuthenticated, isAdmin, loading: authLoading, signOut } = useAuth();
  
  const [resident, setResident] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      navigate('/admin-login');
    }
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters = {};
      if (startDate) filters.start_date = startDate;
      if (endDate) filters.end_date = endDate;
      
      const data = await api.getResidentTransactions(residentId, filters);
      setResident(data.resident);
      setTransactions(data.transactions || []);
    } catch (err) {
      if (err.message?.includes('401')) {
        navigate('/admin-login');
        return;
      }
      setError(err?.message);
    } finally {
      setLoading(false);
    }
  }, [residentId, startDate, endDate, navigate]);

  useEffect(() => {
    if (isAuthenticated && isAdmin && residentId) {
      fetchData();
    }
  }, [isAuthenticated, isAdmin, residentId, fetchData]);

  const handlePrint = () => {
    window.print();
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/admin-login');
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white; }
          .print-container { padding: 0; margin: 0; }
        }
        .print-only { display: none; }
      `}</style>

      <main className="print:pt-0">
        {/* Page Header */}
        <section className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-6 no-print">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/admin/residents')}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <Icon name="ArrowLeft" size={24} />
              </button>
              <div className="flex-1">
                <h1 className="text-2xl lg:text-3xl font-heading font-bold">Transaction History</h1>
                {resident && (
                  <p className="text-sm opacity-80 mt-1">
                    {resident.name} • #{resident.residence_number} • {LOCATION_NAMES[resident.location]}
                  </p>
                )}
              </div>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-emerald-600 rounded-lg font-medium hover:bg-white/90 transition-colors"
              >
                <Icon name="Printer" size={18} />
                <span>Print</span>
              </button>
            </div>
          </div>
        </section>

        {/* Print Header */}
        <div className="print-only p-6 border-b-2 border-gray-200">
          <h1 className="text-2xl font-bold">Transaction History</h1>
          {resident && (
            <div className="mt-2">
              <p className="text-lg">{resident.name} • #{resident.residence_number}</p>
              <p className="text-gray-600">{LOCATION_NAMES[resident.location]}</p>
              <p className="text-sm text-gray-500 mt-1">Printed: {new Date().toLocaleString()}</p>
            </div>
          )}
        </div>

        <section className="py-8 print:py-4 print-container">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            {/* Resident Summary Card */}
            {resident && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 print:shadow-none print:border-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                      <Icon name="User" size={32} className="text-emerald-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{resident.name}</h2>
                      <p className="text-gray-500">#{resident.residence_number} • {LOCATION_NAMES[resident.location]}</p>
                      {resident.about && <p className="text-sm text-gray-400 mt-1">{resident.about}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Current Balance</p>
                    <p className="text-3xl font-bold text-emerald-600">£{(resident.balance || 0).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Date Filters - No Print */}
            <div className="flex flex-wrap gap-4 items-end no-print">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                Clear Filters
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
                <Icon name="AlertCircle" size={18} className="text-red-600" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Transactions Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden print:shadow-none print:border-2">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">
                  Transactions ({transactions.length})
                </h3>
              </div>
              
              {transactions.length === 0 ? (
                <div className="p-8 text-center">
                  <Icon name="FileText" size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">No transactions found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date & Time</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {transactions.map((t) => (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {formatDate(t.created_at)}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                              t.transaction_type === 'topup' 
                                ? 'bg-emerald-100 text-emerald-700' 
                                : 'bg-rose-100 text-rose-700'
                            }`}>
                              <Icon name={t.transaction_type === 'topup' ? 'Plus' : 'Minus'} size={12} />
                              {t.transaction_type === 'topup' ? 'Top Up' : 'Purchase'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {t.description || '-'}
                          </td>
                          <td className={`px-6 py-4 text-sm font-semibold text-right ${
                            t.amount > 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {t.amount > 0 ? '+' : ''}£{Math.abs(t.amount).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-right text-gray-900">
                            £{(t.balance_after || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default ResidentHistory;
