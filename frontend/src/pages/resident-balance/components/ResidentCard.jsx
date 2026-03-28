import React from 'react';
import Icon from '../../../components/AppIcon';

const LOCATION_NAMES = {
  'oakmere-handforth': 'Oakmere',
  'willowmere-middlewich': 'Willowmere',
};

const ResidentCard = ({ resident, onEdit, onDelete, onTopUp, onPurchase, onViewHistory }) => {
  const balance = resident.balance || 0;
  const isLowBalance = balance < 10 && balance > 0;
  const isZeroBalance = balance === 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded">
              #{resident.residence_number}
            </span>
            <span className="text-xs text-gray-500">
              {LOCATION_NAMES[resident.location] || resident.location}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(resident)}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Edit resident"
            >
              <Icon name="Pencil" size={14} />
            </button>
            <button
              onClick={() => onDelete(resident.id)}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Delete resident"
            >
              <Icon name="Trash2" size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">{resident.name}</h3>
        {resident.about && (
          <p className="text-sm text-gray-500 mb-3 line-clamp-2">{resident.about}</p>
        )}
        
        {/* Balance Display */}
        <div className={`flex items-center gap-2 p-3 rounded-lg mb-4 ${
          isZeroBalance ? 'bg-gray-100' : isLowBalance ? 'bg-amber-50' : 'bg-emerald-50'
        }`}>
          <Icon 
            name="Wallet" 
            size={24} 
            className={isZeroBalance ? 'text-gray-400' : isLowBalance ? 'text-amber-500' : 'text-emerald-500'} 
          />
          <div>
            <p className="text-xs text-gray-500">Current Balance</p>
            <p className={`text-2xl font-bold ${
              isZeroBalance ? 'text-gray-400' : isLowBalance ? 'text-amber-600' : 'text-emerald-600'
            }`}>
              £{balance.toFixed(2)}
            </p>
          </div>
          {isLowBalance && (
            <span className="ml-auto px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded">
              Low
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onTopUp(resident)}
            data-testid={`topup-btn-${resident.id}`}
            className="flex flex-col items-center gap-1 p-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Icon name="Plus" size={18} />
            <span className="text-xs font-medium">Top Up</span>
          </button>
          <button
            onClick={() => onPurchase(resident)}
            data-testid={`purchase-btn-${resident.id}`}
            className="flex flex-col items-center gap-1 p-2.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
          >
            <Icon name="ShoppingCart" size={18} />
            <span className="text-xs font-medium">Purchase</span>
          </button>
          <button
            onClick={() => onViewHistory(resident)}
            data-testid={`history-btn-${resident.id}`}
            className="flex flex-col items-center gap-1 p-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Icon name="History" size={18} />
            <span className="text-xs font-medium">History</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResidentCard;
