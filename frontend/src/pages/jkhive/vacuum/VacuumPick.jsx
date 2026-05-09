import React from 'react';
import { useNavigate } from 'react-router-dom';
import SpecialistCatalogPicker from '../_shared/CatalogPicker';

const VacuumPick = () => {
  const navigate = useNavigate();
  return (
    <SpecialistCatalogPicker
      title="Pick item · Vacuum"
      backTo="/jkhive/vacuum-packing"
      favKey="jkhive.vacuum.favs"
      testid="vacuum-pick"
      onPick={({ category, item }) => navigate('/jkhive/vacuum-packing/record', { state: { item_name: `${category} (${item})`, item_category: category } })}
    />
  );
};

export default VacuumPick;
