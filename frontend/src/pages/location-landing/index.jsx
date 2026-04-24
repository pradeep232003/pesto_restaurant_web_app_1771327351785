import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocation2 } from '../../contexts/LocationContext';

const SLUG_TO_LOCATION = {
  handforth: 'oakmere-handforth',
  middlewich: 'willowmere-middlewich',
  timperley: 'timperley-altrincham',
  atherton: 'howe-bridge-atherton',
  chaddesden: 'chaddesden-derby',
};

const LocationLanding = () => {
  const navigate = useNavigate();
  const { locations, setSelectedLocation, setSelectedCafeLocation } = useLocation2();
  const slug = window.location.pathname.replace('/', '');

  useEffect(() => {
    const locationId = SLUG_TO_LOCATION[slug];
    if (!locationId) {
      navigate('/jklocations', { replace: true });
      return;
    }

    const location = locations.find(l => l.id === locationId);
    if (location) {
      setSelectedLocation(location);
      setSelectedCafeLocation(location);
      navigate('/menu-catalog', { replace: true });
    } else if (locations.length > 0) {
      // Locations loaded but this one not found
      navigate('/jklocations', { replace: true });
    }
    // If locations haven't loaded yet, wait
  }, [slug, locations, setSelectedLocation, setSelectedCafeLocation, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#FBFBFD' }}>
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm" style={{ color: '#86868B', fontFamily: 'Outfit, sans-serif' }}>Loading menu...</p>
      </div>
    </div>
  );
};

export default LocationLanding;
