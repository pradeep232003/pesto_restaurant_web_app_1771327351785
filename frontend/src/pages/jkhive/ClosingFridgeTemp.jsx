import React from 'react';
import { useSearchParams } from 'react-router-dom';
import RoutineTempWizard from './RoutineTempWizard';

const ClosingFridgeTemp = () => {
  const [params] = useSearchParams();
  const backTo = params.get('back') || '/jkhive/closing';
  return <RoutineTempWizard period="closing" title="Fridge / Freezer Temp" backTo={backTo} />;
};

export default ClosingFridgeTemp;
