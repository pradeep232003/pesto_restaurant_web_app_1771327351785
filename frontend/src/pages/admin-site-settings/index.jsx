import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Icon from '../../components/AppIcon';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const AdminSiteSettings = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, loading: authLoading } = useAuth();
  const { locations, refreshLocations } = useLocation2();
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [editingLocation, setEditingLocation] = useState(null);
  const [editHours, setEditHours] = useState({});

  // Add location form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationAddress, setNewLocationAddress] = useState('');
  const [newLocationWallet, setNewLocationWallet] = useState(false);
  const [addingLocation, setAddingLocation] = useState(false);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) navigate('/admin-login');
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.adminGetSiteSettings();
      setSettings(data);
    } catch (err) {
      if (err.message?.includes('401')) { navigate('/admin-login'); return; }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleToggle = async (locationId) => {
    setError('');
    try {
      await api.adminToggleOrdering(locationId);
      showSuccess('Ordering status updated');
      await fetchSettings();
    } catch (err) {
      setError(err.message);
    }
  };

  const startEditHours = (setting) => {
    setEditingLocation(setting.location_id);
    setEditHours(JSON.parse(JSON.stringify(setting.opening_hours || {})));
  };

  const handleHourChange = (day, field, value) => {
    setEditHours(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }));
  };

  const saveHours = async (locationId) => {
    setError('');
    try {
      await api.adminUpdateSiteSettings(locationId, { opening_hours: editHours });
      showSuccess('Opening hours updated');
      setEditingLocation(null);
      await fetchSettings();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleOverrideToggle = async (locationId, currentOverride) => {
    setError('');
    try {
      await api.adminUpdateSiteSettings(locationId, { manual_override: !currentOverride });
      showSuccess(currentOverride ? 'Auto-schedule enabled' : 'Manual override enabled');
      await fetchSettings();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleWalletToggle = async (locationId, currentValue) => {
    setError('');
    try {
      await api.adminUpdateLocation(locationId, { wallet_enabled: !currentValue });
      showSuccess(`Resident wallet ${!currentValue ? 'enabled' : 'disabled'}`);
      await refreshLocations();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddLocation = async (e) => {
    e.preventDefault();
    if (!newLocationName.trim()) return;
    setAddingLocation(true);
    setError('');
    try {
      await api.adminCreateLocation({
        name: newLocationName.trim(),
        address: newLocationAddress.trim() || newLocationName.trim(),
        wallet_enabled: newLocationWallet,
      });
      showSuccess('Location added successfully');
      setShowAddForm(false);
      setNewLocationName('');
      setNewLocationAddress('');
      setNewLocationWallet(false);
      await refreshLocations();
      await fetchSettings();
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingLocation(false);
    }
  };

  const handleDeleteLocation = async (locationId) => {
    if (!window.confirm('Are you sure you want to deactivate this location? It will be hidden from the public site.')) return;
    setError('');
    try {
      await api.adminDeleteLocation(locationId);
      showSuccess('Location deactivated');
      await refreshLocations();
      await fetchSettings();
    } catch (err) {
      setError(err.message);
    }
  };

  if (authLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div></div>;
  if (!isAuthenticated || !isAdmin) return null;

  const locationName = (id) => locations.find(l => l.id === id)?.name || id;
  const locationData = (id) => locations.find(l => l.id === id);

  return (
    <div className="min-h-screen bg-background">
      <main>
        <section className="bg-primary text-primary-foreground py-6 lg:py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-heading font-bold">Site Settings</h1>
                <p className="text-sm opacity-80 mt-1">Manage locations, ordering hours, and resident wallets</p>
              </div>
              <button
                data-testid="add-location-btn"
                onClick={() => setShowAddForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-body font-medium transition-all"
              >
                <Icon name="Plus" size={16} />
                Add Location
              </button>
            </div>
          </div>
        </section>

        <section className="py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            {successMsg && (
              <div data-testid="success-message" className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
                <Icon name="CheckCircle" size={18} color="#16a34a" />
                <p className="text-sm text-green-700">{successMsg}</p>
              </div>
            )}
            {error && (
              <div data-testid="error-message" className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 flex items-center gap-2">
                <Icon name="AlertCircle" size={18} color="var(--color-destructive)" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Add Location Form */}
            {showAddForm && (
              <div data-testid="add-location-form" className="bg-card rounded-xl shadow-warm p-6 border-2 border-primary/20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-heading font-bold text-lg text-foreground">Add New Location</h3>
                  <button onClick={() => setShowAddForm(false)} className="text-muted-foreground hover:text-foreground">
                    <Icon name="X" size={20} />
                  </button>
                </div>
                <form onSubmit={handleAddLocation} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-body font-medium text-foreground mb-1">Location Name *</label>
                      <input
                        data-testid="new-location-name"
                        type="text"
                        value={newLocationName}
                        onChange={(e) => setNewLocationName(e.target.value)}
                        placeholder="e.g. Hale, Altrincham"
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-body"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-body font-medium text-foreground mb-1">Address</label>
                      <input
                        data-testid="new-location-address"
                        type="text"
                        value={newLocationAddress}
                        onChange={(e) => setNewLocationAddress(e.target.value)}
                        placeholder="e.g. 15 Ashley Road, Hale WA15 9SG"
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-body"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      data-testid="new-location-wallet-toggle"
                      onClick={() => setNewLocationWallet(!newLocationWallet)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        newLocationWallet ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        newLocationWallet ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                    <span className="text-sm font-body text-foreground">Enable Resident Wallet</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      data-testid="submit-add-location"
                      type="submit"
                      disabled={addingLocation || !newLocationName.trim()}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-body font-medium hover:bg-primary/90 transition-all disabled:opacity-50"
                    >
                      {addingLocation ? 'Adding...' : 'Add Location'}
                    </button>
                    <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 border border-border rounded-lg text-sm font-body text-foreground hover:bg-muted transition-all">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-card rounded-xl shadow-warm p-6 animate-pulse">
                    <div className="h-6 bg-muted rounded w-1/3 mb-4"></div>
                    <div className="h-4 bg-muted rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {settings.map(setting => {
                  const loc = locationData(setting.location_id);
                  return (
                    <div key={setting.location_id} data-testid={`site-card-${setting.location_id}`} className="bg-card rounded-xl shadow-warm overflow-hidden">
                      <div className="p-6">
                        {/* Header */}
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                          <div>
                            <h3 className="font-heading font-bold text-lg text-foreground">{locationName(setting.location_id)}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {setting.manual_override ? 'Manual override active' : 'Following auto-schedule'}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            {/* Wallet toggle */}
                            <div className="flex items-center gap-2">
                              <button
                                data-testid={`wallet-toggle-${setting.location_id}`}
                                onClick={() => handleWalletToggle(setting.location_id, loc?.wallet_enabled)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                  loc?.wallet_enabled ? 'bg-emerald-500' : 'bg-gray-300'
                                }`}
                              >
                                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                                  loc?.wallet_enabled ? 'translate-x-6' : 'translate-x-1'
                                }`} />
                              </button>
                              <span className={`text-xs font-body font-medium ${loc?.wallet_enabled ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                Wallet
                              </span>
                            </div>
                            {/* Override toggle */}
                            <button
                              data-testid={`override-toggle-${setting.location_id}`}
                              onClick={() => handleOverrideToggle(setting.location_id, setting.manual_override)}
                              className={`px-3 py-1.5 rounded-full text-xs font-body font-medium transition-all ${
                                setting.manual_override ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {setting.manual_override ? 'Manual' : 'Auto'}
                            </button>
                            {/* Main ordering toggle */}
                            <button
                              data-testid={`ordering-toggle-${setting.location_id}`}
                              onClick={() => handleToggle(setting.location_id)}
                              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                                setting.ordering_enabled ? 'bg-green-500' : 'bg-gray-300'
                              }`}
                            >
                              <span className={`inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${
                                setting.ordering_enabled ? 'translate-x-7' : 'translate-x-1'
                              }`} />
                            </button>
                            <span className={`text-sm font-body font-medium ${setting.ordering_enabled ? 'text-green-600' : 'text-red-500'}`}>
                              {setting.ordering_enabled ? 'Open' : 'Closed'}
                            </span>
                            {/* Delete button */}
                            <button
                              data-testid={`delete-location-${setting.location_id}`}
                              onClick={() => handleDeleteLocation(setting.location_id)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-all"
                              title="Deactivate location"
                            >
                              <Icon name="Trash2" size={16} />
                            </button>
                          </div>
                        </div>

                        {/* Opening Hours */}
                        {editingLocation === setting.location_id ? (
                          <div className="border-t border-border pt-4">
                            <p className="text-sm font-body font-semibold text-foreground mb-3">Edit Opening Hours</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {DAYS.map(day => (
                                <div key={day} className="flex items-center gap-2">
                                  <span className="w-24 text-sm text-muted-foreground capitalize font-body">{day}</span>
                                  <input
                                    type="time"
                                    value={editHours[day]?.open || ''}
                                    onChange={(e) => handleHourChange(day, 'open', e.target.value)}
                                    className="px-2 py-1.5 rounded border border-border bg-background text-sm font-mono"
                                  />
                                  <span className="text-muted-foreground text-xs">to</span>
                                  <input
                                    type="time"
                                    value={editHours[day]?.close || ''}
                                    onChange={(e) => handleHourChange(day, 'close', e.target.value)}
                                    className="px-2 py-1.5 rounded border border-border bg-background text-sm font-mono"
                                  />
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2 mt-4">
                              <button onClick={() => saveHours(setting.location_id)} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-body font-medium hover:bg-primary/90 transition-all">Save Hours</button>
                              <button onClick={() => setEditingLocation(null)} className="px-4 py-2 border border-border rounded-lg text-sm font-body text-foreground hover:bg-muted transition-all">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="border-t border-border pt-4">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-body font-semibold text-foreground">Opening Hours</p>
                              <button
                                data-testid={`edit-hours-${setting.location_id}`}
                                onClick={() => startEditHours(setting)}
                                className="text-xs text-primary font-body font-medium hover:underline"
                              >
                                Edit Hours
                              </button>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {DAYS.map(day => {
                                const h = setting.opening_hours?.[day];
                                return (
                                  <div key={day} className="text-xs font-body">
                                    <span className="capitalize text-muted-foreground">{day.slice(0, 3)}: </span>
                                    <span className="text-foreground font-medium">{h ? `${h.open}-${h.close}` : 'Closed'}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default AdminSiteSettings;
