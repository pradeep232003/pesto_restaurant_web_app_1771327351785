import React from 'react';
import { useNavigate } from 'react-router-dom';
import SpecialistCatalogPicker from '../_shared/CatalogPicker';

const AcidityPick = () => {
  const navigate = useNavigate();
  return (
    <SpecialistCatalogPicker
      title="Pick item · Acidity"
      backTo="/jkhive/acidity"
      favKey="jkhive.acidity.favs"
      testid="acidity-pick"
      onPick={({ category, item }) => navigate('/jkhive/acidity/record', { state: { item_name: `${category} (${item})`, item_category: category } })}
    />
  );
};

export default AcidityPick;
