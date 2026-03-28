import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Icon from '../../components/AppIcon';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';
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
  const { user, isAuthenticated, isAdmin, loading: authLoading, signOut } = useAuth();
  const { locations } = useLocation2();
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Redirect to login if not authenticated as admin
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      navigate('/admin-login');
    }
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  // Set initial location once loaded
  useEffect(() => {
    if (locations?.length > 0 && !selectedLocationId) {
      setSelectedLocationId(locations[0].id);
    }
  }, [locations, selectedLocationId]);

  const handleLogout = async () => {
    await signOut();
    navigate('/admin-login');
  };

  const fetchMenuItems = useCallback(async (locationSlug) => {
    setLoading(true);
    setError(null);
    try {
      // Use admin endpoint to get all items including unavailable ones
      const data = await api.adminGetMenuItems(locationSlug);
      setMenuItems(data || []);
    } catch (err) {
      // If unauthorized, redirect to login
      if (err.message?.includes('401') || err.message?.includes('Not authenticated')) {
        navigate('/admin-login');
        return;
      }
      setError(err?.message);
      setMenuItems([]);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

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
        visitor_price: formData?.visitorPrice ? parseFloat(formData?.visitorPrice) : null,
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
        show_image: formData?.showImage !== false,
      };

      let savedItem;
      if (editingItem) {
        savedItem = await api.adminUpdateMenuItem(editingItem?.id, payload);
        setSuccessMsg('Item updated successfully!');
      } else {
        savedItem = await api.adminCreateMenuItem(payload);
        setSuccessMsg('Item added successfully!');
      }

      // Upload image file if selected
      const itemId = savedItem?.id || editingItem?.id;
      if (formData?.imageFile && itemId) {
        await api.adminUploadMenuImage(itemId, formData.imageFile);
        setSuccessMsg(editingItem ? 'Item updated with new image!' : 'Item added with image!');
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

  const handleUploadImage = async (itemId, file) => {
    setError(null);
    try {
      await api.adminUploadMenuImage(itemId, file);
      setSuccessMsg('Image uploaded successfully!');
      await fetchMenuItems(selectedLocationId);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err?.message);
    }
  };

  const handleToggleImage = async (item) => {
    setError(null);
    try {
      await api.adminToggleImageVisibility(item?.id);
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

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!isAuthenticated || !isAdmin) {
    return null;
  }

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
      <main>
        {/* Page Header */}
        <section className="py-6 lg:py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight" style={{ color: '#1D1D1F', fontFamily: 'Outfit, sans-serif' }}>Menu</h1>
                <p className="text-sm mt-1" style={{ color: '#86868B' }}>
                  {user?.email}
                </p>
              </div>
              <button
                onClick={handleAddNew}
                data-testid="add-menu-item-btn"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200"
                style={{ background: '#1D1D1F', color: '#FFFFFF', fontFamily: 'Outfit, sans-serif' }}
              >
                <Icon name="Plus" size={16} />
                Add Item
              </button>
            </div>
          </div>
        </section>

        <section className="pb-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto space-y-5">

            {/* Messages */}
            {successMsg && (
              <div className="p-4 rounded-2xl text-sm flex items-center gap-2" style={{ background: 'rgba(52,199,89,0.08)', color: '#34C759' }}>
                <Icon name="CheckCircle" size={16} />
                {successMsg}
              </div>
            )}
            {error && (
              <div className="p-4 rounded-2xl text-sm flex items-center gap-2" style={{ background: 'rgba(255,59,48,0.08)', color: '#FF3B30' }}>
                <Icon name="AlertCircle" size={16} />
                {error}
              </div>
            )}

            {/* Location + Category */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e?.target?.value)}
                className="appearance-none px-4 py-2.5 rounded-full text-sm font-medium cursor-pointer outline-none sm:max-w-xs"
                style={{ background: '#FFFFFF', color: '#1D1D1F', border: 'none', fontFamily: 'Outfit, sans-serif' }}
              >
                {locations?.map(loc => (
                  <option key={loc?.id} value={loc?.id}>{loc?.name}</option>
                ))}
              </select>
              <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'rgba(0,122,255,0.08)', color: '#007AFF' }}>
                {menuItems?.length} items
              </span>
            </div>

            {/* Category Pills */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveCategory('all')}
                className="px-4 py-2 rounded-full text-sm font-medium transition-all duration-200"
                style={{
                  background: activeCategory === 'all' ? '#1D1D1F' : 'transparent',
                  color: activeCategory === 'all' ? '#FFFFFF' : '#86868B',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                All <span className="ml-1 opacity-60">{categoryCounts?.all}</span>
              </button>
              {MENU_CATEGORIES?.map(cat => (
                <button
                  key={cat?.id}
                  onClick={() => setActiveCategory(cat?.id)}
                  className="px-4 py-2 rounded-full text-sm font-medium transition-all duration-200"
                  style={{
                    background: activeCategory === cat?.id ? '#1D1D1F' : 'transparent',
                    color: activeCategory === cat?.id ? '#FFFFFF' : '#86868B',
                    fontFamily: 'Outfit, sans-serif',
                  }}
                >
                  {cat?.name} <span className="ml-1 opacity-60">{categoryCounts?.[cat?.id] || 0}</span>
                </button>
              ))}
            </div>

            {/* Menu Table */}
            <AdminMenuTable
              items={filteredItems}
              loading={loading}
              onEdit={handleEditItem}
              onDelete={handleDeleteItem}
              onToggleAvailability={handleToggleAvailability}
              onUploadImage={handleUploadImage}
              onToggleImage={handleToggleImage}
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
