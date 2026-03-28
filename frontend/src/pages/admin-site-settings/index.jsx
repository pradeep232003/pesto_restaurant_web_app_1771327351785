import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Icon from '../../components/AppIcon';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { LOCATIONS } from '../../contexts/LocationContext';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const AdminSiteSettings = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, loading: authLoading, signOut } = useAuth();
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [editingLocation, setEditingLocation] = useState(null);
  const [editHours, setEditHours] = useState({});

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

  const handleToggle = async (locationId) => {
    setError('');
    try {
      await api.adminToggleOrdering(locationId);
      setSuccessMsg('Ordering status updated');
      setTimeout(() => setSuccessMsg(''), 3000);
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
      setSuccessMsg('Opening hours updated');
      setTimeout(() => setSuccessMsg(''), 3000);
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
      setSuccessMsg(currentOverride ? 'Auto-schedule enabled' : 'Manual override enabled');
      setTimeout(() => setSuccessMsg(''), 3000);
      await fetchSettings();
    } catch (err) {
      setError(err.message);
    }
  };

  if (authLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div></div>;
  if (!isAuthenticated || !isAdmin) return null;

  const locationName = (id) => LOCATIONS.find(l => l.id === id)?.name || id;

  return (
    <div className="min-h-screen bg-background">
      <main>
        <section className="bg-primary text-primary-foreground py-6 lg:py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-heading font-bold">Site Settings</h1>
                <p className="text-sm opacity-80 mt-1">Manage ordering hours and availability per location</p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            {successMsg && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
                <Icon name="CheckCircle" size={18} color="#16a34a" />
                <p className="text-sm text-green-700">{successMsg}</p>
              </div>
            )}
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 flex items-center gap-2">
                <Icon name="AlertCircle" size={18} color="var(--color-destructive)" />
                <p className="text-sm text-destructive">{error}</p>
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
                {settings.map(setting => (
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
                        <div className="flex items-center gap-3">
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
                          {/* Main toggle */}
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
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default AdminSiteSettings;
