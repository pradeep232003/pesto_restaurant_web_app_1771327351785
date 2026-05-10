import React from 'react';
import { useNavigate } from 'react-router-dom';
import SpecialistCatalogPicker from '../_shared/CatalogPicker';

const WashingPick = () => {
  const navigate = useNavigate();
  return (
    <SpecialistCatalogPicker
      title="Chemical Food Washing"
      backTo="/jkhive/food-washing"
      favKey="jkhive.washing.favs"
      testid="washing-pick"
      onPick={({ category, item, icon }) => navigate('/jkhive/food-washing/chemical', {
        state: { item_name: item, item_category: category, item_icon: icon || '🥬' },
      })}
    />
  );
};

export default WashingPick;
