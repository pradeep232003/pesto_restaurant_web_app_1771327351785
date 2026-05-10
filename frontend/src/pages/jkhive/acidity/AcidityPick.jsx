import React from 'react';
import { useNavigate } from 'react-router-dom';
import SpecialistCatalogPicker from '../_shared/CatalogPicker';

const AcidityPick = () => {
  const navigate = useNavigate();
  return (
    <SpecialistCatalogPicker
      title="Record Food Acidity"
      backTo="/jkhive/acidity"
      favKey="jkhive.acidity.favs"
      testid="acidity-pick"
      onPick={({ category, item, icon }) => navigate('/jkhive/acidity/record', {
        state: { item_name: item, item_category: category, item_icon: icon || '🥬' },
      })}
    />
  );
};

export default AcidityPick;
