import React from 'react';
import { useSearchParams } from 'react-router-dom';
import RoutineTempWizard from './RoutineTempWizard';

const OpeningFridgeTemp = () => {
  const [params] = useSearchParams();
  const backTo = params.get('back') || '/jkhive/opening';
  return <RoutineTempWizard period="opening" title="Fridge / Freezer Temp" backTo={backTo} />;
};

export default OpeningFridgeTemp;
