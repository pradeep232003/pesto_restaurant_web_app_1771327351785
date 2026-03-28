import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../lib/api';

const LocationContext = createContext(null);

export const LocationProvider = ({ children }) => {
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedCafeLocation, setSelectedCafeLocation] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchLocations = useCallback(async () => {
    try {
      const data = await api.getLocations();
      setLocations(data);
      if (!selectedLocation && data.length > 0) {
        setSelectedLocation(data[0]);
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
