import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';

const TransactionModal = ({ resident, transactionType, paymentMethod = 'cash', onSave, onClose }) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [sendReceipt, setSendReceipt] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isTopUp = transactionType === 'topup';
  const isCash = paymentMethod === 'cash';
  const currentBalance = resident.balance || 0;
  const hasEmail = !!resident.email;

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
      const transactionDescription = isTopUp 
        ? description || `${isCash ? 'Cash' : 'Card'} top-up`
        : description || null;
      
      await onSave({
        resident_id: resident.id,
        transaction_type: transactionType,
        amount: amountValue,
        description: transactionDescription,
        send_receipt: sendReceipt && hasEmail,
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

  // Header colors based on transaction type and payment method
  const headerGradient = !isTopUp 
    ? 'bg-gradient-to-r from-rose-600 to-red-600'
    : isCash 
      ? 'bg-gradient-to-r from-emerald-600 to-green-600'
      : 'bg-gradient-to-r from-blue-600 to-indigo-600';

  const buttonColor = !isTopUp 
    ? 'bg-rose-600 hover:bg-rose-700'
    : isCash 
      ? 'bg-emerald-600 hover:bg-emerald-700'
      : 'bg-blue-600 hover:bg-blue-700';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm -z-10" onClick={onClose}></div>
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden z-10">
        {/* Header */}
        <div className={`px-6 py-4 text-white ${headerGradient}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              {isTopUp ? (
                <>
                  <Icon name={isCash ? 'Banknote' : 'CreditCard'} size={24} />
                  {isCash ? 'Cash Top Up' : 'Card Top Up'}
                </>
              ) : (
                <>
                  <Icon name="ShoppingCart" size={24} />
                  Record Purchase
                </>
              )}
            </h2>
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
              <Icon name="X" size={20} />
            </button>
          </div>
        </div>

        {/* Payment Method Badge for Top Up */}
        {isTopUp && (
          <div className="px-6 py-2 bg-gray-100 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                isCash ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
              }`}>
                <Icon name={isCash ? 'Banknote' : 'CreditCard'} size={14} />
                {isCash ? 'Cash Payment' : 'Card Payment'}
              </span>
              {!isCash && (
                <span className="text-xs text-gray-500">(Stripe integration coming soon)</span>
              )}
            </div>
          </div>
        )}

        {/* Resident Info */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
              <Icon name="User" size={24} className="text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{resident.name}</p>
              <p className="text-sm text-gray-500">#{resident.residence_number}</p>
              {resident.email && (
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <Icon name="Mail" size={12} />
                  {resident.email}
                </p>
              )}
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
                data-testid="transaction-amount-input"
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
              placeholder={isTopUp ? `e.g. ${isCash ? 'Cash' : 'Card'} top-up` : 'e.g. Lunch purchase'}
              data-testid="transaction-description-input"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {/* Email Receipt Checkbox */}
          <div className={`p-3 rounded-lg border ${hasEmail ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={sendReceipt}
                onChange={(e) => setSendReceipt(e.target.checked)}
                disabled={!hasEmail}
                data-testid="send-receipt-checkbox"
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
              />
              <div className="flex-1">
                <span className={`font-medium ${hasEmail ? 'text-gray-900' : 'text-gray-400'}`}>
                  Send email receipt
                </span>
                {hasEmail ? (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Receipt will be sent to {resident.email}
                  </p>
                ) : (
                  <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                    <Icon name="AlertTriangle" size={12} />
                    No email address on file
                  </p>
                )}
              </div>
              <Icon name="Mail" size={20} className={hasEmail ? 'text-blue-500' : 'text-gray-300'} />
            </label>
          </div>

          {/* Balance Preview */}
          {amount && parseFloat(amount) > 0 && (
            <div className={`p-4 rounded-lg ${isTopUp ? (isCash ? 'bg-emerald-50' : 'bg-blue-50') : 'bg-rose-50'}`}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Current Balance</span>
                <span className="font-medium">£{currentBalance.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-gray-600">
                  {isTopUp ? `${isCash ? 'Cash' : 'Card'} Top Up` : 'Purchase'}
                </span>
                <span className={`font-medium ${isTopUp ? (isCash ? 'text-emerald-600' : 'text-blue-600') : 'text-rose-600'}`}>
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
              data-testid="transaction-submit-btn"
              className={`flex-1 px-4 py-2.5 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 ${buttonColor}`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Icon name={isTopUp ? (isCash ? 'Banknote' : 'CreditCard') : 'Check'} size={18} />
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
