import React from 'react';
import { useNavigate } from 'react-router-dom';
import SpecialistCatalogPicker from '../_shared/CatalogPicker';

const WashingPick = () => {
  const navigate = useNavigate();
  return (
    <SpecialistCatalogPicker
      title="Pick item · Washing"
      backTo="/jkhive/food-washing"
      favKey="jkhive.washing.favs"
      testid="washing-pick"
      onPick={({ category, item }) => navigate('/jkhive/food-washing/record', { state: { item_name: `${category} (${item})`, item_category: category } })}
    />
  );
};

export default WashingPick;
