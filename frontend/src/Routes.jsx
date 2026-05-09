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
import AdminDailyChecks from './pages/admin-daily-checks';
import AdminKitchenClosedown from './pages/admin-kitchen-closedown';
import AdminCookedTemp from './pages/admin-cooked-temp';
import AdminDeliveryRecords from './pages/admin-delivery-records';
import AdminProbeCalibration from './pages/admin-probe-calibration';
import AdminLegionella from './pages/admin-legionella';
import AdminDailyCleaning from './pages/admin-daily-cleaning';
import AdminWeeklyCleaning from './pages/admin-weekly-cleaning';
import AdminCompliance from './pages/admin-compliance';
import AdminStaff from './pages/admin-staff';
import JKHiveLayout from './pages/jkhive/Layout';
import JKHiveIntelligence from './pages/jkhive/Intelligence';
import JKHiveRoutines from './pages/jkhive/Routines';
import JKHiveMoreRoutines from './pages/jkhive/MoreRoutines';
import JKHiveProfile from './pages/jkhive/Profile';
import JKHiveDailySales from './pages/jkhive-daily-sales';
import JKHiveSalesSummary from './pages/jkhive-sales-summary';
import JKHiveCompliance from './pages/jkhive-compliance';
import JKHiveMenu from './pages/jkhive-menu';
import JKHiveDailyChecks from './pages/jkhive-daily-checks';
import JKHiveKitchenClosedown from './pages/jkhive-kitchen-closedown';
import JKHiveTempMonitor from './pages/jkhive-temp-monitor';
import JKHiveCookedTemp from './pages/jkhive-cooked-temp';
import JKHiveOpeningRoutine from './pages/jkhive/OpeningRoutine';
import JKHiveOpeningFridgeTemp from './pages/jkhive/OpeningFridgeTemp';
import JKHiveClosingRoutine from './pages/jkhive/ClosingRoutine';
import JKHiveClosingFridgeTemp from './pages/jkhive/ClosingFridgeTemp';
import JKHiveRoutineUnits from './pages/jkhive/RoutineUnits';
import JKHiveWorkforce from './pages/jkhive/Workforce';
import JKHiveManager from './pages/jkhive/Manager';
import CoolingHome from './pages/jkhive/cooling/CoolingHome';
import CoolingPickItem from './pages/jkhive/cooling/CoolingPickItem';
import CoolingStartTemp from './pages/jkhive/cooling/CoolingStartTemp';
import CoolingRecordTemp from './pages/jkhive/cooling/CoolingRecordTemp';
import CoolingComment from './pages/jkhive/cooling/CoolingComment';
import ReheatingHome from './pages/jkhive/reheating/ReheatingHome';
import ReheatingPickItem from './pages/jkhive/reheating/ReheatingPickItem';
import ReheatingRecordTemp from './pages/jkhive/reheating/ReheatingRecordTemp';
import ReheatingComment from './pages/jkhive/reheating/ReheatingComment';
import CookedHome from './pages/jkhive/cooked/CookedHome';
import CookedPickItem from './pages/jkhive/cooked/CookedPickItem';
import CookedRecordTemp from './pages/jkhive/cooked/CookedRecordTemp';
import CookedComment from './pages/jkhive/cooked/CookedComment';
import ChecklistsHome from './pages/jkhive/checklists/ChecklistsHome';
import ChecklistRun from './pages/jkhive/checklists/ChecklistRun';
import ChecklistEditor from './pages/jkhive/checklists/ChecklistEditor';
import DeliveriesHome from './pages/jkhive/deliveries/DeliveriesHome';
import DeliveriesPickSupplier from './pages/jkhive/deliveries/PickSupplier';
import DeliveriesAddSupplier from './pages/jkhive/deliveries/AddSupplier';
import DeliveriesEditSupplier from './pages/jkhive/deliveries/EditSupplier';
import DeliveriesPickItem from './pages/jkhive/deliveries/PickItem';
import DeliveriesRecordTemp from './pages/jkhive/deliveries/RecordTemp';
import DeliveriesCommentSubmit from './pages/jkhive/deliveries/CommentSubmit';
import DeliveriesAskAddInventory from './pages/jkhive/deliveries/AskAddInventory';
import DeliveriesAddStockAmount from './pages/jkhive/deliveries/AddStockAmount';
import DeliveriesAddStockBatch from './pages/jkhive/deliveries/AddStockBatch';
import DeliveriesReview from './pages/jkhive/deliveries/ReviewDelivery';
import InventoryHome from './pages/jkhive/inventory/InventoryHome';
import InventoryPickItem from './pages/jkhive/inventory/InventoryPickItem';
import InvAddStockAmount from './pages/jkhive/inventory/InvAddStockAmount';
import InvAddStockBatch from './pages/jkhive/inventory/InvAddStockBatch';
import InventoryItemDetail from './pages/jkhive/inventory/InventoryItemDetail';
import InPrepHome from './pages/jkhive/wastage/InPrepHome';
import InPrepPickItem from './pages/jkhive/wastage/InPrepPickItem';
import InPrepAmount from './pages/jkhive/wastage/InPrepAmount';
import InPrepComment from './pages/jkhive/wastage/InPrepComment';
import InServiceHome from './pages/jkhive/wastage/InServiceHome';
import InServicePick from './pages/jkhive/wastage/InServicePick';
import InServiceComment from './pages/jkhive/wastage/InServiceComment';
import ProbePick from './pages/jkhive/probes/PickProbe';
import ProbeAdd from './pages/jkhive/probes/AddProbe';
import ProbeEdit from './pages/jkhive/probes/EditProbe';
import ProbeBoiling from './pages/jkhive/probes/BoilingTemp';
import ProbeIced from './pages/jkhive/probes/IcedTemp';
import ProbeCommentSubmit from './pages/jkhive/probes/CommentSubmit';
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
import { useAuth } from './contexts/AuthContext';
import { LocationProvider } from './contexts/LocationContext';
import { CustomerProvider } from './contexts/CustomerContext';

const AdminRoute = ({ children }) => (
  <AdminLayout>{children}</AdminLayout>
);

/** Admin guard that does NOT wrap in AdminLayout — for pages already inside another layout. */
const AdminOnly = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return <Navigate to="/jkhive" replace />;
  }
  return children;
};

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
      <Route path="/admin/daily-checks" element={<AdminRoute><AdminDailyChecks /></AdminRoute>} />
      <Route path="/admin/kitchen-closedown" element={<AdminRoute><AdminKitchenClosedown /></AdminRoute>} />
      <Route path="/admin/cooked-temp" element={<AdminRoute><AdminCookedTemp /></AdminRoute>} />
      <Route path="/admin/delivery-records" element={<AdminRoute><AdminDeliveryRecords /></AdminRoute>} />
      <Route path="/admin/probe-calibration" element={<AdminRoute><AdminProbeCalibration /></AdminRoute>} />
      <Route path="/admin/legionella" element={<AdminRoute><AdminLegionella /></AdminRoute>} />
      <Route path="/admin/daily-cleaning" element={<AdminRoute><AdminDailyCleaning /></AdminRoute>} />
      <Route path="/admin/weekly-cleaning" element={<AdminRoute><AdminWeeklyCleaning /></AdminRoute>} />
      <Route path="/admin/compliance" element={<AdminRoute><AdminCompliance /></AdminRoute>} />
      <Route path="/admin/staff" element={<AdminRoute><AdminStaff /></AdminRoute>} />

      {/* JKHive — unified mobile-first hub (any authenticated user) */}
      <Route path="/jkhive" element={<JKHiveLayout />}>
        <Route index element={<JKHiveIntelligence />} />
        <Route path="routines" element={<JKHiveRoutines />} />
        <Route path="routines/more" element={<JKHiveMoreRoutines />} />
        <Route path="workforce" element={<JKHiveWorkforce />} />
        <Route path="manager" element={<AdminOnly><JKHiveManager /></AdminOnly>} />
        <Route path="profile" element={<JKHiveProfile />} />
        <Route path="daily-sales" element={<JKHiveDailySales />} />
        <Route path="sales-summary" element={<JKHiveSalesSummary />} />
        <Route path="compliance" element={<JKHiveCompliance />} />
        <Route path="menu" element={<JKHiveMenu />} />
        <Route path="daily-checks" element={<JKHiveDailyChecks />} />
        <Route path="kitchen-closedown" element={<JKHiveKitchenClosedown />} />
        <Route path="temp-monitor" element={<JKHiveTempMonitor />} />
        <Route path="cooked-temp" element={<CookedHome />} />
        <Route path="cooked-temp/new" element={<CookedPickItem />} />
        <Route path="cooked-temp/record" element={<CookedRecordTemp />} />
        <Route path="cooked-temp/comment" element={<CookedComment />} />
        <Route path="checklists" element={<ChecklistsHome />} />
        <Route path="checklists/new" element={<ChecklistEditor />} />
        <Route path="checklists/:id/run" element={<ChecklistRun />} />
        <Route path="checklists/:id/edit" element={<ChecklistEditor />} />
        <Route path="delivery-records" element={<DeliveriesHome />} />
        <Route path="delivery-records/supplier" element={<DeliveriesPickSupplier />} />
        <Route path="delivery-records/supplier/new" element={<DeliveriesAddSupplier />} />
        <Route path="delivery-records/supplier/:id/edit" element={<DeliveriesEditSupplier />} />
        <Route path="delivery-records/item" element={<DeliveriesPickItem />} />
        <Route path="delivery-records/record" element={<DeliveriesRecordTemp />} />
        <Route path="delivery-records/comment" element={<DeliveriesCommentSubmit />} />
        <Route path="delivery-records/inventory-prompt" element={<DeliveriesAskAddInventory />} />
        <Route path="delivery-records/add-stock/amount" element={<DeliveriesAddStockAmount />} />
        <Route path="delivery-records/add-stock/batch" element={<DeliveriesAddStockBatch />} />
        <Route path="delivery-records/review" element={<DeliveriesReview /> } />
        <Route path="inventory" element={<InventoryHome />} />
        <Route path="inventory/pick" element={<InventoryPickItem />} />
        <Route path="inventory/add/amount" element={<InvAddStockAmount />} />
        <Route path="inventory/add/batch" element={<InvAddStockBatch />} />
        <Route path="inventory/item/:id" element={<InventoryItemDetail />} />
        <Route path="in-prep-wastage" element={<InPrepHome />} />
        <Route path="in-prep-wastage/pick" element={<InPrepPickItem />} />
        <Route path="in-prep-wastage/amount" element={<InPrepAmount />} />
        <Route path="in-prep-wastage/comment" element={<InPrepComment />} />
        <Route path="in-service-wastage" element={<InServiceHome />} />
        <Route path="in-service-wastage/pick" element={<InServicePick />} />
        <Route path="in-service-wastage/comment" element={<InServiceComment />} />
        <Route path="probe-calibration" element={<ProbePick />} />
        <Route path="probe-calibration/new" element={<ProbeAdd />} />
        <Route path="probe-calibration/:id/edit" element={<ProbeEdit />} />
        <Route path="probe-calibration/:probeId/boiling" element={<ProbeBoiling />} />
        <Route path="probe-calibration/:probeId/iced" element={<ProbeIced />} />
        <Route path="probe-calibration/:probeId/comment" element={<ProbeCommentSubmit />} />
        <Route path="opening" element={<JKHiveOpeningRoutine />} />
        <Route path="opening/fridge-temp" element={<JKHiveOpeningFridgeTemp />} />
        <Route path="closing" element={<JKHiveClosingRoutine />} />
        <Route path="closing/fridge-temp" element={<JKHiveClosingFridgeTemp />} />
        <Route path="cooking-cooling" element={<CoolingHome />} />
        <Route path="cooking-cooling/new" element={<CoolingPickItem />} />
        <Route path="cooking-cooling/start" element={<CoolingStartTemp />} />
        <Route path="cooking-cooling/:id/record" element={<CoolingRecordTemp />} />
        <Route path="cooking-cooling/:id/comment" element={<CoolingComment />} />
        <Route path="reheating" element={<ReheatingHome />} />
        <Route path="reheating/new" element={<ReheatingPickItem />} />
        <Route path="reheating/record" element={<ReheatingRecordTemp />} />
        <Route path="reheating/comment" element={<ReheatingComment />} />
        <Route path="manager/routine-units" element={<AdminOnly><JKHiveRoutineUnits /></AdminOnly>} />
      </Route>

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
