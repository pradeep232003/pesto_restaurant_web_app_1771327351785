// JKHive-flavored Daily Sales — reuses the admin-daily-sales page component
// inside the JKHive layout (so the JKHive top bar + footer wrap it).
import React from 'react';
import AdminDailySales from '../admin-daily-sales';

const JKHiveDailySales = () => <AdminDailySales />;
export default JKHiveDailySales;
