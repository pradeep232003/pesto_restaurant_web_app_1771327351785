import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';

const TransactionModal = ({ resident, transactionType, onSave, onClose }) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isTopUp = transactionType === 'topup';
  const currentBalance = resident.balance || 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!isTopUp && amountValue > currentBalance) {
      setError(`Insufficient balance. Current balance: £${currentBalance.toFixed(2)}`);
      return;
    }

    setLoading(true);
    try {
      await onSave({
        resident_id: resident.id,
        transaction_type: transactionType,
        amount: amountValue,
        description: description || null,
      });
    } catch (err) {
      setError(err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  const newBalance = isTopUp 
    ? currentBalance + (parseFloat(amount) || 0)
    : currentBalance - (parseFloat(amount) || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm -z-10" onClick={onClose}></div>
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden z-10">
        {/* Header */}
        <div className={`px-6 py-4 text-white ${isTopUp ? 'bg-gradient-to-r from-emerald-600 to-green-600' : 'bg-gradient-to-r from-rose-600 to-red-600'}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Icon name={isTopUp ? 'PlusCircle' : 'ShoppingCart'} size={24} />
              {isTopUp ? 'Top Up Balance' : 'Record Purchase'}
            </h2>
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
              <Icon name="X" size={20} />
            </button>
          </div>
        </div>

        {/* Resident Info */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
              <Icon name="User" size={24} className="text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{resident.name}</p>
              <p className="text-sm text-gray-500">#{resident.residence_number}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-gray-500">Current Balance</p>
              <p className="text-lg font-bold text-emerald-600">£{currentBalance.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <Icon name="AlertCircle" size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount (£) *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">£</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0.01"
                required
                autoFocus
                className="w-full pl-8 pr-4 py-3 text-2xl font-bold border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isTopUp ? 'e.g. Cash top-up' : 'e.g. Lunch purchase'}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {/* Balance Preview */}
          {amount && parseFloat(amount) > 0 && (
            <div className={`p-4 rounded-lg ${isTopUp ? 'bg-emerald-50' : 'bg-rose-50'}`}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Current Balance</span>
                <span className="font-medium">£{currentBalance.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-gray-600">{isTopUp ? 'Top Up' : 'Purchase'}</span>
                <span className={`font-medium ${isTopUp ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {isTopUp ? '+' : '-'}£{parseFloat(amount).toFixed(2)}
                </span>
              </div>
              <div className="border-t border-gray-200 mt-2 pt-2 flex items-center justify-between">
                <span className="font-medium text-gray-900">New Balance</span>
                <span className={`text-lg font-bold ${newBalance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  £{newBalance.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (!isTopUp && parseFloat(amount) > currentBalance)}
              className={`flex-1 px-4 py-2.5 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 ${
                isTopUp ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Icon name={isTopUp ? 'PlusCircle' : 'Check'} size={18} />
                  <span>{isTopUp ? 'Add Funds' : 'Confirm Purchase'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransactionModal;
