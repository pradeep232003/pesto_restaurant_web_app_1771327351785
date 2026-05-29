// JKHive-flavored Expenses — reuses the admin-expenses page component inside
// the JKHive mobile layout. Back-link logic in admin-expenses/index.jsx
// detects `/jkhive` and routes back to /jkhive/manager.
import React from 'react';
import AdminExpenses from '../admin-expenses';

const JKHiveExpenses = () => <AdminExpenses />;
export default JKHiveExpenses;
