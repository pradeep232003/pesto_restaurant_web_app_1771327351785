import React from 'react';
import CleaningSchedulePage from '../../components/CleaningSchedulePage';

const AdminDailyCleaning = () => (
  <CleaningSchedulePage
    kind="daily-cleaning"
    title="Daily Cleaning Schedule"
    subtitle="Tick off tasks as you complete them each day"
    iconColor="#5AC8FA"
  />
);

export default AdminDailyCleaning;
