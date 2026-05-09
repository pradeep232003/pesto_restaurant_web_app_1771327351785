import React from 'react';
import { useNavigate } from 'react-router-dom';
import SpecialistCatalogPicker from '../_shared/CatalogPicker';

const SousVidePick = () => {
  const navigate = useNavigate();
  return (
    <SpecialistCatalogPicker
      title="Pick item · Sous Vide"
      backTo="/jkhive/sous-vide"
      favKey="jkhive.sousvide.favs"
      testid="sous-vide-pick"
      onPick={({ category, item }) => navigate('/jkhive/sous-vide/record', { state: { item_name: `${category} (${item})`, item_category: category } })}
    />
  );
};

export default SousVidePick;
