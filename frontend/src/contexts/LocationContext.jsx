import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../lib/api';

const LocationContext = createContext(null);

export const LocationProvider = ({ children }) => {
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocationState] = useState(null);
  const [selectedCafeLocation, setSelectedCafeLocationState] = useState(null);
  const [adminLocationId, setAdminLocationIdState] = useState(() => localStorage.getItem('adminLocationId') || '');
  const [loading, setLoading] = useState(true);

  const setSelectedLocation = (loc) => {
    setSelectedLocationState(loc);
    if (loc?.id) {
      localStorage.setItem('selectedLocationId', loc.id);
    }
  };

  const setSelectedCafeLocation = (loc) => {
    setSelectedCafeLocationState(loc);
    if (loc?.id) {
      localStorage.setItem('selectedCafeLocationId', loc.id);
    } else if (loc === null) {
      localStorage.removeItem('selectedCafeLocationId');
    }
  };

  const setAdminLocationId = (id) => {
    setAdminLocationIdState(id || '');
    if (id) localStorage.setItem('adminLocationId', id);
    else localStorage.removeItem('adminLocationId');
  };

  const fetchLocations = useCallback(async () => {
    try {
      const data = await api.getLocations();
      setLocations(data);
      if (!selectedLocation && data.length > 0) {
        const savedId = localStorage.getItem('selectedLocationId');
        const saved = savedId && data.find(l => l.id === savedId);
        setSelectedLocationState(saved || data[0]);
      }
      // Restore selectedCafeLocation
      const savedCafeId = localStorage.getItem('selectedCafeLocationId');
      if (savedCafeId && data.length > 0) {
        const savedCafe = data.find(l => l.id === savedCafeId);
        if (savedCafe) setSelectedCafeLocationState(savedCafe);
      }
    } catch (err) {
      console.error('Failed to fetch locations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  return (
    <LocationContext.Provider value={{
      locations,
      selectedLocation,
      setSelectedLocation,
      selectedCafeLocation,
      setSelectedCafeLocation,
      adminLocationId,
      setAdminLocationId,
      loading,
      refreshLocations: fetchLocations,
    }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation2 = () => {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation2 must be used within a LocationProvider');
  return ctx;
};

export default LocationContext;
