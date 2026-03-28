import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Icon from '../../components/AppIcon';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import ResidentModal from './components/ResidentModal';
import TransactionModal from './components/TransactionModal';
import ResidentCard from './components/ResidentCard';

const LOCATIONS = [
  { id: 'oakmere-handforth', name: 'Oakmere, Handforth' },
  { id: 'willowmere-middlewich', name: 'Willowmere, Middlewich' },
];

const ResidentBalance = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin, loading: authLoading, signOut } = useAuth();
  
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [summary, setSummary] = useState(null);
  
  // Modal states
  const [isResidentModalOpen, setIsResidentModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [editingResident, setEditingResident] = useState(null);
  const [selectedResident, setSelectedResident] = useState(null);
  const [transactionType, setTransactionType] = useState('topup');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  // Redirect to login if not authenticated as admin
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      navigate('/admin-login');
    }
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  const fetchResidents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getResidents(selectedLocation || null);
      setResidents(data || []);
    } catch (err) {
      if (err.message?.includes('401') || err.message?.includes('Not authenticated')) {
        navigate('/admin-login');
        return;
      }
      setError(err?.message);
      setResidents([]);
    } finally {
      setLoading(false);
    }
  }, [selectedLocation, navigate]);

  const fetchSummary = useCallback(async () => {
    try {
      const data = await api.getBalanceSummary(selectedLocation || null);
      setSummary(data);
    } catch (err) {
      console.error('Error fetching summary:', err);
    }
  }, [selectedLocation]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchResidents();
      fetchSummary();
    }
  }, [isAuthenticated, isAdmin, fetchResidents, fetchSummary]);

  const handleLogout = async () => {
    await signOut();
    navigate('/admin-login');
  };

  const handleAddResident = () => {
    setEditingResident(null);
    setIsResidentModalOpen(true);
  };

  const handleEditResident = (resident) => {
    setEditingResident(resident);
    setIsResidentModalOpen(true);
  };

  const handleDeleteResident = async (residentId) => {
    if (!window.confirm('Are you sure? This will delete the resident and all their transaction history.')) return;
    try {
      await api.deleteResident(residentId);
      setSuccessMsg('Resident deleted successfully!');
      fetchResidents();
      fetchSummary();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err?.message);
    }
  };

  const handleSaveResident = async (formData) => {
    try {
      if (editingResident) {
        await api.updateResident(editingResident.id, formData);
        setSuccessMsg('Resident updated successfully!');
      } else {
        await api.createResident(formData);
        setSuccessMsg('Resident added successfully!');
      }
      setIsResidentModalOpen(false);
      setEditingResident(null);
      fetchResidents();
      fetchSummary();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      throw err;
    }
  };

  const handleTopUp = (resident, method = 'cash') => {
    setSelectedResident(resident);
    setTransactionType('topup');
    setPaymentMethod(method);
    setIsTransactionModalOpen(true);
  };

  const handlePurchase = (resident) => {
    setSelectedResident(resident);
    setTransactionType('purchase');
    setIsTransactionModalOpen(true);
  };

  const handleSaveTransaction = async (transactionData) => {
    try {
      await api.createTransaction(transactionData);
      setSuccessMsg(transactionData.transaction_type === 'topup' ? 'Top-up successful!' : 'Purchase recorded!');
      setIsTransactionModalOpen(false);
      setSelectedResident(null);
      fetchResidents();
      fetchSummary();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      throw err;
    }
  };

  const handleViewHistory = (resident) => {
    navigate(`/resident-history/${resident.id}`);
  };

  // Filter residents by search query
  const filteredResidents = residents.filter(r => {
    const searchLower = searchQuery.toLowerCase();
    return (
      r.name?.toLowerCase().includes(searchLower) ||
      r.residence_number?.toLowerCase().includes(searchLower)
    );
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        cartCount={0}
        onCartClick={() => navigate('/shopping-cart')}
        onAccountClick={() => {}}
        onSearch={() => {}}
        onLogout={handleLogout}
      />
      <main className="pt-16">
        {/* Page Header */}
        <section className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-6 lg:py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-heading font-bold flex items-center gap-3">
                  <Icon name="Wallet" size={32} />
                  Resident Prepaid Balance
                </h1>
                <p className="text-sm opacity-80 mt-1 font-body">
                  Manage prepaid balances for Oakmere and Willowmere residents
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAddResident}
                  data-testid="add-resident-btn"
                  className="inline-flex items-center space-x-2 px-5 py-2.5 bg-white text-emerald-600 rounded-lg font-body font-semibold hover:bg-white/90 transition-all duration-200 shadow-sm"
                >
                  <Icon name="UserPlus" size={18} />
                  <span>Add Resident</span>
                </button>
                <button
                  onClick={() => navigate('/transaction-report')}
                  data-testid="view-reports-btn"
                  className="inline-flex items-center space-x-2 px-4 py-2.5 bg-white/10 text-white rounded-lg font-body hover:bg-white/20 transition-all duration-200"
                >
                  <Icon name="FileText" size={18} />
                  <span className="hidden sm:inline">Reports</span>
                </button>
                <button
                  onClick={handleLogout}
                  data-testid="logout-btn"
                  className="inline-flex items-center space-x-2 px-4 py-2.5 bg-white/10 text-white rounded-lg font-body hover:bg-white/20 transition-all duration-200"
                >
                  <Icon name="LogOut" size={18} />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            {/* Summary Cards */}
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <Icon name="PoundSterling" size={20} className="text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Balance</p>
                      <p className="text-xl font-bold text-gray-900">£{summary.total_balance?.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Icon name="Users" size={20} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Residents</p>
                      <p className="text-xl font-bold text-gray-900">{summary.total_residents}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Icon name="CheckCircle" size={20} className="text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">With Balance</p>
                      <p className="text-xl font-bold text-gray-900">{summary.residents_with_balance}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <Icon name="AlertCircle" size={20} className="text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Zero Balance</p>
                      <p className="text-xl font-bold text-gray-900">{summary.residents_zero_balance}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Icon name="Search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name or residence number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">All Locations</option>
                {LOCATIONS.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>

            {/* Success / Error Messages */}
            {successMsg && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center space-x-2">
                <Icon name="CheckCircle" size={18} className="text-green-600" />
                <p className="text-sm font-body text-green-700">{successMsg}</p>
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center space-x-2">
                <Icon name="AlertCircle" size={18} className="text-red-600" />
                <p className="text-sm font-body text-red-700">{error}</p>
              </div>
            )}

            {/* Residents Grid */}
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-500"></div>
              </div>
            ) : filteredResidents.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
                <Icon name="Users" size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-600">No residents found</h3>
                <p className="text-gray-400 mt-1">Add your first resident to get started</p>
                <button
                  onClick={handleAddResident}
                  className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Add Resident
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredResidents.map(resident => (
                  <ResidentCard
                    key={resident.id}
                    resident={resident}
                    onEdit={handleEditResident}
                    onDelete={handleDeleteResident}
                    onTopUp={handleTopUp}
                    onPurchase={handlePurchase}
                    onViewHistory={handleViewHistory}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Resident Modal */}
      {isResidentModalOpen && (
        <ResidentModal
          resident={editingResident}
          locations={LOCATIONS}
          onSave={handleSaveResident}
          onClose={() => {
            setIsResidentModalOpen(false);
            setEditingResident(null);
          }}
        />
      )}

      {/* Transaction Modal */}
      {isTransactionModalOpen && selectedResident && (
        <TransactionModal
          resident={selectedResident}
          transactionType={transactionType}
          paymentMethod={paymentMethod}
          onSave={handleSaveTransaction}
          onClose={() => {
            setIsTransactionModalOpen(false);
            setSelectedResident(null);
          }}
        />
      )}
    </div>
  );
};

export default ResidentBalance;
