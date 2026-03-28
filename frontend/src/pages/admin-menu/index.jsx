import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Icon from '../../components/AppIcon';
import api from '../../lib/api';
import { LOCATIONS } from '../../contexts/LocationContext';
import AdminMenuItemModal from './components/AdminMenuItemModal';
import AdminMenuTable from './components/AdminMenuTable';

const MENU_CATEGORIES = [
  { id: 'breakfast', name: 'Breakfast', icon: 'Sunrise' },
  { id: 'lunch', name: 'Lunch', icon: 'Sun' },
  { id: 'dinner', name: 'Dinner', icon: 'Moon' },
  { id: 'dessert', name: 'Dessert', icon: 'Cake' },
  { id: 'beverage', name: 'Beverage', icon: 'Coffee' },
];

const AdminMenuManagement = () => {
  const navigate = useNavigate();
  const [selectedLocationId, setSelectedLocationId] = useState(LOCATIONS?.[0]?.id);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const fetchMenuItems = useCallback(async (locationSlug) => {
    setLoading(true);
    setError(null);
    try {
      // Use admin endpoint to get all items including unavailable ones
      const data = await api.adminGetMenuItems(locationSlug);
      setMenuItems(data || []);
    } catch (err) {
      setError(err?.message);
      setMenuItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMenuItems(selectedLocationId);
  }, [selectedLocationId, fetchMenuItems]);

  const handleSaveItem = async (formData) => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        location_id: selectedLocationId,
        name: formData?.name,
        subtitle: formData?.subtitle || null,
        description: formData?.description || null,
        price: parseFloat(formData?.price),
        original_price: formData?.originalPrice ? parseFloat(formData?.originalPrice) : null,
        image_url: formData?.imageUrl || null,
        image_alt: formData?.imageAlt || null,
        category: formData?.categories?.[0] || 'mains',
        categories: formData?.categories || [],
        dietary: formData?.dietary || [],
        tags: formData?.tags || [],
        featured: formData?.featured || false,
        prep_time: parseInt(formData?.prepTime) || 15,
        is_available: formData?.isAvailable !== false,
      };

      if (editingItem) {
        // Update existing item
        await api.adminUpdateMenuItem(editingItem?.id, payload);
        setSuccessMsg('Item updated successfully!');
      } else {
        // Create new item
        await api.adminCreateMenuItem(payload);
        setSuccessMsg('Item added successfully!');
      }

      await fetchMenuItems(selectedLocationId);
      setIsModalOpen(false);
      setEditingItem(null);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err?.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    setError(null);
    try {
      await api.adminDeleteMenuItem(itemId);
      setSuccessMsg('Item deleted successfully!');
      await fetchMenuItems(selectedLocationId);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err?.message);
    }
  };

  const handleToggleAvailability = async (item) => {
    try {
      await api.adminToggleAvailability(item?.id);
      await fetchMenuItems(selectedLocationId);
    } catch (err) {
      setError(err?.message);
    }
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const filteredItems = activeCategory === 'all'
    ? menuItems
    : menuItems?.filter(item =>
        item?.categories?.includes(activeCategory) || item?.category === activeCategory
      );

  const categoryCounts = {
    all: menuItems?.length,
    ...MENU_CATEGORIES?.reduce((acc, cat) => {
      acc[cat?.id] = menuItems?.filter(item =>
        item?.categories?.includes(cat?.id) || item?.category === cat?.id
      )?.length;
      return acc;
    }, {})
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        cartCount={0}
        onCartClick={() => navigate('/shopping-cart')}
        onAccountClick={(action) => {
          if (action === 'login') navigate('/login');
          if (action === 'account') navigate('/user-account');
        }}
        onSearch={() => {}}
        onLogout={() => {}}
      />
      <main className="pt-16">
        {/* Page Header */}
        <section className="bg-primary text-primary-foreground py-6 lg:py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-heading font-bold">Menu Management</h1>
                <p className="text-sm opacity-80 mt-1 font-body">Add, edit, and manage menu items per cafe location</p>
              </div>
              <button
                onClick={handleAddNew}
                className="inline-flex items-center space-x-2 px-5 py-2.5 bg-white text-primary rounded-lg font-body font-semibold hover:bg-white/90 transition-all duration-200 hover:scale-105 shadow-sm"
              >
                <Icon name="Plus" size={18} />
                <span>Add Menu Item</span>
              </button>
            </div>
          </div>
        </section>

        <section className="py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

            {/* Success / Error Messages */}
            {successMsg && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center space-x-2">
                <Icon name="CheckCircle" size={18} color="#16a34a" />
                <p className="text-sm font-body text-green-700">{successMsg}</p>
              </div>
            )}
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 flex items-center space-x-2">
                <Icon name="AlertCircle" size={18} color="var(--color-destructive)" />
                <p className="text-sm font-body text-destructive">{error}</p>
              </div>
            )}

            {/* Location Selector */}
            <div className="bg-card rounded-xl shadow-warm px-4 py-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center space-x-2 shrink-0">
                  <Icon name="MapPin" size={20} color="var(--color-primary)" />
                  <span className="font-heading font-semibold text-foreground text-base">Cafe Location</span>
                </div>
                <div className="flex-1">
                  <select
                    value={selectedLocationId}
                    onChange={(e) => setSelectedLocationId(e?.target?.value)}
                    className="w-full sm:max-w-sm px-4 py-2.5 rounded-lg border border-border bg-background text-foreground font-body text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors duration-200 cursor-pointer"
                  >
                    {LOCATIONS?.map(loc => (
                      <option key={loc?.id} value={loc?.id}>{loc?.name}</option>
                    ))}
                  </select>
                </div>
                <div className="hidden sm:flex items-center space-x-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-body shrink-0">
                  <Icon name="UtensilsCrossed" size={13} />
                  <span>{menuItems?.length} items</span>
                </div>
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="bg-card rounded-xl shadow-warm px-4 py-3">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveCategory('all')}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-body font-medium transition-all duration-200 ${
                    activeCategory === 'all' ?'bg-primary text-primary-foreground shadow-md' :'bg-muted text-foreground hover:bg-primary/10 hover:text-primary'
                  }`}
                >
                  <Icon name="Grid3X3" size={14} />
                  <span>All</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeCategory === 'all' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/10 text-primary'}`}>
                    {categoryCounts?.all}
                  </span>
                </button>
                {MENU_CATEGORIES?.map(cat => (
                  <button
                    key={cat?.id}
                    onClick={() => setActiveCategory(cat?.id)}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-body font-medium transition-all duration-200 ${
                      activeCategory === cat?.id
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'bg-muted text-foreground hover:bg-primary/10 hover:text-primary'
                    }`}
                  >
                    <Icon name={cat?.icon} size={14} />
                    <span>{cat?.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeCategory === cat?.id ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/10 text-primary'}`}>
                      {categoryCounts?.[cat?.id] || 0}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Menu Table */}
            <AdminMenuTable
              items={filteredItems}
              loading={loading}
              onEdit={handleEditItem}
              onDelete={handleDeleteItem}
              onToggleAvailability={handleToggleAvailability}
              onAddNew={handleAddNew}
              categories={MENU_CATEGORIES}
            />
          </div>
        </section>
      </main>
      {/* Add/Edit Modal */}
      {isModalOpen && (
        <AdminMenuItemModal
          item={editingItem}
          categories={MENU_CATEGORIES}
          onSave={handleSaveItem}
          onClose={() => { setIsModalOpen(false); setEditingItem(null); }}
          saving={saving}
        />
      )}
    </div>
  );
};

export default AdminMenuManagement;
