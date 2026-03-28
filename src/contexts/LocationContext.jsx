import React, { createContext, useContext, useState } from 'react';

export const LOCATIONS = [
  { id: 'timperley-altrincham', name: 'Timperley, Altrincham' },
  { id: 'howe-bridge-atherton', name: 'Howe Bridge, Atherton' },
  { id: 'chaddesden-derby', name: 'Chaddesden, Derby' },
  { id: 'oakmere-handforth', name: 'Oakmere, Handforth' },
  { id: 'willowmere-middlewich', name: 'Willowmere, Middlewich' },
];

const LocationContext = createContext(null);

export const LocationProvider = ({ children }) => {
  const [selectedLocation, setSelectedLocation] = useState(LOCATIONS?.[0]);
  const [selectedCafeLocation, setSelectedCafeLocation] = useState(null);

  return (
    <LocationContext.Provider value={{ selectedLocation, setSelectedLocation, locations: LOCATIONS, selectedCafeLocation, setSelectedCafeLocation }}>
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
