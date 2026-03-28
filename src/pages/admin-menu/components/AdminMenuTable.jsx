import React from 'react';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';

const CATEGORY_LABELS = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  dessert: 'Dessert',
  beverage: 'Beverage',
  mains: 'Mains',
  appetizers: 'Appetizers',
  desserts: 'Desserts',
  beverages: 'Beverages',
};

const AdminMenuTable = ({ items, loading, onEdit, onDelete, onToggleAvailability, onAddNew, categories }) => {
  if (loading) {
    return (
      <div className="bg-card rounded-xl shadow-warm overflow-hidden">
        <div className="p-8 space-y-4">
          {[...Array(5)]?.map((_, i) => (
            <div key={i} className="flex items-center space-x-4 animate-pulse">
              <div className="w-16 h-16 bg-muted rounded-lg shrink-0"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-1/3"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
              <div className="h-8 bg-muted rounded w-20"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items?.length === 0) {
    return (
      <div className="bg-card rounded-xl shadow-warm p-12 text-center">
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
          <Icon name="UtensilsCrossed" size={32} color="var(--color-muted-foreground)" />
        </div>
        <h3 className="text-lg font-heading font-bold text-foreground mb-2">No menu items found</h3>
        <p className="text-muted-foreground mb-6 text-sm">Add your first menu item for this location and category.</p>
        <button
          onClick={onAddNew}
          className="inline-flex items-center space-x-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-body font-medium hover:bg-primary/90 transition-all duration-200"
        >
          <Icon name="Plus" size={16} />
          <span>Add First Item</span>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-warm overflow-hidden">
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wide">Item</th>
              <th className="text-left px-4 py-3 text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wide">Categories</th>
              <th className="text-left px-4 py-3 text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wide">Price</th>
              <th className="text-left px-4 py-3 text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
              <th className="text-right px-4 py-3 text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items?.map(item => (
              <tr key={item?.id} className="hover:bg-muted/30 transition-colors duration-150">
                <td className="px-4 py-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted shrink-0">
                      <Image
                        src={item?.image_url}
                        alt={item?.image_alt || item?.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="font-body font-semibold text-foreground text-sm truncate max-w-[200px]">{item?.name}</p>
                      {item?.subtitle && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{item?.subtitle}</p>}
                      {item?.featured && (
                        <span className="inline-flex items-center space-x-1 text-xs text-accent font-body">
                          <Icon name="Star" size={10} />
                          <span>Featured</span>
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(item?.categories?.length > 0 ? item?.categories : [item?.category])?.map(cat => (
                      <span key={cat} className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-body capitalize">
                        {CATEGORY_LABELS?.[cat] || cat}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div>
                    <span className="font-heading font-bold text-primary text-sm">£{parseFloat(item?.price)?.toFixed(2)}</span>
                    {item?.original_price && (
                      <span className="text-xs text-muted-foreground line-through ml-1">£{parseFloat(item?.original_price)?.toFixed(2)}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => onToggleAvailability(item)}
                    className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-body font-medium transition-all duration-200 ${
                      item?.is_available
                        ? 'bg-green-100 text-green-700 hover:bg-green-200' :'bg-red-100 text-red-600 hover:bg-red-200'
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${item?.is_available ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span>{item?.is_available ? 'Available' : 'Unavailable'}</span>
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => onEdit(item)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-200"
                      title="Edit item"
                    >
                      <Icon name="Pencil" size={16} />
                    </button>
                    <button
                      onClick={() => onDelete(item?.id)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
                      title="Delete item"
                    >
                      <Icon name="Trash2" size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden divide-y divide-border">
        {items?.map(item => (
          <div key={item?.id} className="p-4">
            <div className="flex items-start space-x-3">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted shrink-0">
                <Image
                  src={item?.image_url}
                  alt={item?.image_alt || item?.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-body font-semibold text-foreground text-sm">{item?.name}</p>
                    <p className="font-heading font-bold text-primary text-sm mt-0.5">£{parseFloat(item?.price)?.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center space-x-1 ml-2">
                    <button onClick={() => onEdit(item)} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-200">
                      <Icon name="Pencil" size={14} />
                    </button>
                    <button onClick={() => onDelete(item?.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200">
                      <Icon name="Trash2" size={14} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(item?.categories?.length > 0 ? item?.categories : [item?.category])?.map(cat => (
                    <span key={cat} className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-body capitalize">
                      {CATEGORY_LABELS?.[cat] || cat}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => onToggleAvailability(item)}
                  className={`mt-2 inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-body font-medium ${
                    item?.is_available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${item?.is_available ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span>{item?.is_available ? 'Available' : 'Unavailable'}</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminMenuTable;
