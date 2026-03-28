import React from "react";
import { BrowserRouter, Routes as RouterRoutes, Route } from "react-router-dom";
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
import AdminMenuManagement from './pages/admin-menu';
import { LocationProvider } from './contexts/LocationContext';

const Routes = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <ScrollToTop />
      <LocationProvider>
      <RouterRoutes>
        {/* Define your route here */}
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
        <Route path="/admin-menu" element={<AdminMenuManagement />} />
        <Route path="*" element={<NotFound />} />
      </RouterRoutes>
      </LocationProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default Routes;