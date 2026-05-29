// JKHive-flavored Income — reuses the admin-income page component inside
// the JKHive mobile layout. Back-link logic in admin-income/index.jsx
// detects `/jkhive` and routes back to /jkhive/manager.
import React from 'react';
import AdminIncome from '../admin-income';

const JKHiveIncome = () => <AdminIncome />;
export default JKHiveIncome;
