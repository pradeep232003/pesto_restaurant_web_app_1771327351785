import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Icon from '../../components/AppIcon';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

const LOCATIONS = [
  { id: 'oakmere-handforth', name: 'Oakmere, Handforth' },
  { id: 'willowmere-middlewich', name: 'Willowmere, Middlewich' },
];

const LOCATION_NAMES = {
  'oakmere-handforth': 'Oakmere',
  'willowmere-middlewich': 'Willowmere',
};

const TransactionReport = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, loading: authLoading, signOut } = useAuth();
  
  const [transactions, setTransactions] = useState([]);
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  
  // Filters
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedResident, setSelectedResident] = useState('');
  const [transactionType, setTransactionType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      navigate('/admin-login');
    }
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  const fetchResidents = useCallback(async () => {
    try {
      const data = await api.getResidents();
      setResidents(data || []);
    } catch (err) {
      console.error('Error fetching residents:', err);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters = {};
      if (selectedLocation) filters.location = selectedLocation;
      if (selectedResident) filters.resident_id = selectedResident;
      if (transactionType) filters.transaction_type = transactionType;
      if (startDate) filters.start_date = startDate;
      if (endDate) filters.end_date = endDate;
      
      const data = await api.getTransactions(filters);
      setTransactions(data || []);
      
      // Calculate summary
      const topUps = data.filter(t => t.transaction_type === 'topup');
      const purchases = data.filter(t => t.transaction_type === 'purchase');
      setSummary({
        totalTransactions: data.length,
        totalTopUps: topUps.reduce((sum, t) => sum + Math.abs(t.amount), 0),
        totalPurchases: purchases.reduce((sum, t) => sum + Math.abs(t.amount), 0),
        topUpCount: topUps.length,
        purchaseCount: purchases.length,
      });
    } catch (err) {
      if (err.message?.includes('401')) {
        navigate('/admin-login');
        return;
      }
      setError(err?.message);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [selectedLocation, selectedResident, transactionType, startDate, endDate, navigate]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchResidents();
    }
  }, [isAuthenticated, isAdmin, fetchResidents]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchTransactions();
    }
  }, [isAuthenticated, isAdmin, fetchTransactions]);

  const handlePrint = () => {
    window.print();
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/admin-login');
  };

  const clearFilters = () => {
    setSelectedLocation('');
    setSelectedResident('');
    setTransactionType('');
    setStartDate('');
    setEndDate('');
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

  const filteredResidents = selectedLocation 
    ? residents.filter(r => r.location === selectedLocation)
    : residents;

  if (authLoading) {
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

      <div className="no-print">
        <Header
          cartCount={0}
          onCartClick={() => navigate('/shopping-cart')}
          onAccountClick={() => {}}
          onSearch={() => {}}
          onLogout={handleLogout}
        />
      </div>

      <main className="pt-16 print:pt-0">
        {/* Page Header */}
        <section className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-6 no-print">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/resident-balance')}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <Icon name="ArrowLeft" size={24} />
              </button>
              <div className="flex-1">
                <h1 className="text-2xl lg:text-3xl font-heading font-bold flex items-center gap-3">
                  <Icon name="BarChart3" size={32} />
                  Transaction Report
                </h1>
                <p className="text-sm opacity-80 mt-1">
                  View and filter all transactions across locations
                </p>
              </div>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-indigo-600 rounded-lg font-medium hover:bg-white/90 transition-colors"
              >
                <Icon name="Printer" size={18} />
                <span>Print Report</span>
              </button>
            </div>
          </div>
        </section>

        {/* Print Header */}
        <div className="print-only p-6 border-b-2 border-gray-200">
          <h1 className="text-2xl font-bold">Transaction Report</h1>
          <p className="text-gray-600 mt-1">
            {selectedLocation ? LOCATION_NAMES[selectedLocation] : 'All Locations'} 
            {startDate && ` • From: ${startDate}`}
            {endDate && ` To: ${endDate}`}
          </p>
          <p className="text-sm text-gray-500 mt-1">Generated: {new Date().toLocaleString()}</p>
        </div>

        <section className="py-8 print:py-4 print-container">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            {/* Filters - No Print */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 no-print">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Icon name="Filter" size={18} />
                Filters
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <select
                    value={selectedLocation}
                    onChange={(e) => {
                      setSelectedLocation(e.target.value);
                      setSelectedResident('');
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">All Locations</option>
                    {LOCATIONS.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Resident</label>
                  <select
                    value={selectedResident}
                    onChange={(e) => setSelectedResident(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">All Residents</option>
                    {filteredResidents.map(r => (
                      <option key={r.id} value={r.id}>#{r.residence_number} - {r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={transactionType}
                    onChange={(e) => setTransactionType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">All Types</option>
                    <option value="topup">Top Ups</option>
                    <option value="purchase">Purchases</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Clear All Filters
                </button>
              </div>
            </div>

            {/* Summary Cards */}
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 print:shadow-none print:border-2">
                  <p className="text-sm text-gray-500">Total Transactions</p>
                  <p className="text-2xl font-bold text-gray-900">{summary.totalTransactions}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 print:shadow-none print:border-2">
                  <p className="text-sm text-gray-500">Top Ups ({summary.topUpCount})</p>
                  <p className="text-2xl font-bold text-emerald-600">+£{summary.totalTopUps.toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 print:shadow-none print:border-2">
                  <p className="text-sm text-gray-500">Purchases ({summary.purchaseCount})</p>
                  <p className="text-2xl font-bold text-rose-600">-£{summary.totalPurchases.toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 print:shadow-none print:border-2">
                  <p className="text-sm text-gray-500">Net Flow</p>
                  <p className={`text-2xl font-bold ${summary.totalTopUps - summary.totalPurchases >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    £{(summary.totalTopUps - summary.totalPurchases).toFixed(2)}
                  </p>
                </div>
              </div>
            )}

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
              
              {loading ? (
                <div className="p-8 flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
                </div>
              ) : transactions.length === 0 ? (
                <div className="p-8 text-center">
                  <Icon name="FileText" size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">No transactions found matching your filters</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Resident</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Location</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {transactions.map((t) => (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                            {formatDate(t.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{t.resident_name}</p>
                              <p className="text-xs text-gray-500">#{t.residence_number}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {LOCATION_NAMES[t.resident_location] || t.resident_location}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                              t.transaction_type === 'topup' 
                                ? 'bg-emerald-100 text-emerald-700' 
                                : 'bg-rose-100 text-rose-700'
                            }`}>
                              <Icon name={t.transaction_type === 'topup' ? 'Plus' : 'Minus'} size={12} />
                              {t.transaction_type === 'topup' ? 'Top Up' : 'Purchase'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                            {t.description || '-'}
                          </td>
                          <td className={`px-4 py-3 text-sm font-semibold text-right whitespace-nowrap ${
                            t.amount > 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {t.amount > 0 ? '+' : ''}£{Math.abs(t.amount).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-right text-gray-900 whitespace-nowrap">
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

export default TransactionReport;
