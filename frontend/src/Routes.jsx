import React from "react";
import { BrowserRouter, Routes as RouterRoutes, Route, Navigate, useLocation } from "react-router-dom";
import ScrollToTop from "components/ScrollToTop";
import ErrorBoundary from "components/ErrorBoundary";
import NotFound from "pages/NotFound";
import ShoppingCart from './pages/shopping-cart';
import HomeLanding from './pages/home-landing';
import LoginPage from './pages/login';
import UserAccount from './pages/user-account';
import ProfileDetails from './pages/profile-details';
import Register from './pages/register';
import MenuCatalog from './pages/menu-catalog';
import TableReservation from './pages/table-reservation';
import OrderTracking from './pages/order-tracking';
import AdminLogin from './pages/admin-login';
import AdminDashboard from './pages/admin-dashboard';
import AdminMenuManagement from './pages/admin-menu';
import AdminOrders from './pages/admin-orders';
import AdminSiteSettings from './pages/admin-site-settings';
import AdminUsers from './pages/admin-users';
import AdminDailySales from './pages/admin-daily-sales';
import AdminSalesSummary from './pages/admin-sales-summary';
import AdminIncome from './pages/admin-income';
import AdminExpenses from './pages/admin-expenses';
import AdminEditLog from './pages/admin-edit-log';
import AdminLoyaltyScanner from './pages/admin-loyalty-scanner';
import AdminLoyalty from './pages/admin-loyalty';
import LoyaltyCard from './pages/loyalty-card';
import AdminTempMonitor from './pages/admin-temp-monitor';
import ResidentBalance from './pages/resident-balance';
import ResidentHistory from './pages/resident-history';
import TransactionReport from './pages/transaction-report';
import CustomerAuth from './pages/customer-auth';
import GoogleAuthCallback from './pages/customer-auth/GoogleAuthCallback';
import GoogleAccessTokenCallback from './pages/customer-auth/GoogleAccessTokenCallback';
import OrderStatus from './pages/order-status';
import ContactUs from './pages/contact-us';
import JKLocations from './pages/jk-locations';
import LocationLanding from './pages/location-landing';
import AdminLayout from './components/AdminLayout';
import { LocationProvider } from './contexts/LocationContext';
import { CustomerProvider } from './contexts/CustomerContext';

const AdminRoute = ({ children }) => (
  <AdminLayout>{children}</AdminLayout>
);

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
const AppRouter = () => {
  const location = useLocation();

  // Check URL fragment synchronously for session_id (Google OAuth callback - legacy)
  if (location.hash?.includes('session_id=')) {
    return <GoogleAuthCallback />;
  }

  // Handle Google OAuth access_token redirect (mobile - popup becomes redirect)
  if (location.hash?.includes('access_token=')) {
    return <GoogleAccessTokenCallback />;
  }

  return (
    <RouterRoutes>
      {/* Public Routes */}
      <Route path="/" element={<HomeLanding />} />
      <Route path="/shopping-cart" element={<ShoppingCart />} />
      <Route path="/home-landing" element={<HomeLanding />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/user-account" element={<UserAccount />} />
      <Route path="/profile-details" element={<ProfileDetails />} />
      <Route path="/register" element={<Register />} />
      <Route path="/menu-catalog" element={<MenuCatalog />} />
      <Route path="/table-reservation" element={<TableReservation />} />
      <Route path="/order-tracking" element={<OrderTracking />} />
      <Route path="/customer-auth" element={<CustomerAuth />} />
      <Route path="/order-status" element={<OrderStatus />} />
      <Route path="/contact-us" element={<ContactUs />} />
      <Route path="/jklocations" element={<JKLocations />} />
      <Route path="/jklocations.html" element={<Navigate to="/jklocations" replace />} />
      <Route path="/handforth" element={<LocationLanding />} />
      <Route path="/middlewich" element={<LocationLanding />} />
      <Route path="/timperley" element={<LocationLanding />} />
      <Route path="/atherton" element={<LocationLanding />} />
      <Route path="/chaddesden" element={<LocationLanding />} />
      
      {/* Admin Login (no layout) */}
      <Route path="/admin-login" element={<AdminLogin />} />
      
      {/* Admin Routes (with sidebar layout) */}
      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/admin/menu" element={<AdminRoute><AdminMenuManagement /></AdminRoute>} />
      <Route path="/admin/orders" element={<AdminRoute><AdminOrders /></AdminRoute>} />
      <Route path="/admin/site-settings" element={<AdminRoute><AdminSiteSettings /></AdminRoute>} />
      <Route path="/admin/residents" element={<AdminRoute><ResidentBalance /></AdminRoute>} />
      <Route path="/admin/residents/:residentId" element={<AdminRoute><ResidentHistory /></AdminRoute>} />
      <Route path="/admin/transactions" element={<AdminRoute><TransactionReport /></AdminRoute>} />
      <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
      <Route path="/admin/daily-sales" element={<AdminRoute><AdminDailySales /></AdminRoute>} />
      <Route path="/admin/sales-summary" element={<AdminRoute><AdminSalesSummary /></AdminRoute>} />
      <Route path="/admin/income" element={<AdminRoute><AdminIncome /></AdminRoute>} />
      <Route path="/admin/expenses" element={<AdminRoute><AdminExpenses /></AdminRoute>} />
      <Route path="/admin/edit-log" element={<AdminRoute><AdminEditLog /></AdminRoute>} />
      <Route path="/admin/loyalty-scanner" element={<AdminRoute><AdminLoyaltyScanner /></AdminRoute>} />
      <Route path="/admin/loyalty" element={<AdminRoute><AdminLoyalty /></AdminRoute>} />
      <Route path="/admin/temp-monitor" element={<AdminRoute><AdminTempMonitor /></AdminRoute>} />

      {/* Customer loyalty card */}
      <Route path="/loyalty-card" element={<LoyaltyCard />} />

      {/* Legacy admin routes - redirect to new paths */}
      <Route path="/admin-menu" element={<AdminRoute><AdminMenuManagement /></AdminRoute>} />
      <Route path="/admin-orders" element={<AdminRoute><AdminOrders /></AdminRoute>} />
      <Route path="/admin-site-settings" element={<AdminRoute><AdminSiteSettings /></AdminRoute>} />
      <Route path="/resident-balance" element={<AdminRoute><ResidentBalance /></AdminRoute>} />
      <Route path="/resident-history/:residentId" element={<AdminRoute><ResidentHistory /></AdminRoute>} />
      <Route path="/transaction-report" element={<AdminRoute><TransactionReport /></AdminRoute>} />
      
      <Route path="*" element={<NotFound />} />
    </RouterRoutes>
  );
};

const Routes = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <ScrollToTop />
      <LocationProvider>
      <CustomerProvider>
        <AppRouter />
      </CustomerProvider>
      </LocationProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default Routes;
