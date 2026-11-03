import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminDashboardLayout } from './layouts/AdminDashboardLayout';
import { NutritionistLayout } from './layouts/NutritionistLayout';
import { TeacherTabletLayout } from './layouts/TeacherTabletLayout';
import { KitchenDisplayLayout } from './layouts/KitchenDisplayLayout';

import { LoginPage } from './features/auth/pages/LoginPage';
import { ForgotPasswordPage } from './features/auth/pages/ForgotPasswordPage';
import { WeeklyMenuManagementPage } from './features/menus/pages/WeeklyMenuManagementPage';
import { NutritionistDashboardPage } from './features/menus/pages/NutritionistDashboardPage';
import { NutritionRulesPage } from './features/menus/pages/NutritionRulesPage';
import { NutritionistAllergyManagementPage } from './features/menus/pages/NutritionistAllergyManagementPage';
import { SchoolSettingsPage } from './features/tenant/pages/SchoolSettingsPage';
import { StaffManagementPage } from './features/staff/pages/StaffManagementPage';
import { PrincipalMenuApprovalPage } from './features/menus/pages/PrincipalMenuApprovalPage';

import { ChildGrowthMonitoringPage } from './features/growth/pages/ChildGrowthMonitoringPage';
import { AttendancePage } from './features/attendance/AttendancePage';
import { ParentEvaluationsPage } from './features/parent-evaluations/ParentEvaluationsPage';
import { BghMealPortionsOverviewPage } from './features/attendance/pages/BghMealPortionsOverviewPage';
import { SnackRosterPage } from './features/attendance/SnackRosterPage';
import { MonitorChildMenuConsumptionPage } from './features/parent-evaluations/MonitorChildMenuConsumptionPage';
import { SubmitMealEvaluationPage } from './features/parent-evaluations/SubmitMealEvaluationPage';
import { ParentAllergyDeclarationPage } from './features/children/pages/ParentAllergyDeclarationPage';
import { HomePage } from './features/home/HomePage';
import { AuditLogsPage } from './features/audit-logs/pages/AuditLogsPage';
import { FoodGroupRulesPage } from './features/menus/pages/FoodGroupRulesPage';
import { NutritionPhysicalDashboardPage } from './features/dashboard/pages/NutritionPhysicalDashboardPage';
import { RoleSpecificChildAlertsPage } from './features/dashboard/pages/RoleSpecificChildAlertsPage';
import { MealOperationsReportPage } from './features/kitchen/pages/MealOperationsReportPage';
import { FoodSafetyComplianceReportPage } from './features/food-safety/pages/FoodSafetyComplianceReportPage';
import { SnackServiceRevenueReportPage } from './features/finances/pages/SnackServiceRevenueReportPage';
import { ParentEvaluationSummaryReportPage } from './features/parent-evaluations/pages/ParentEvaluationSummaryReportPage';
import { RoleBasedGrowthNotificationsPage } from './features/growth/pages/RoleBasedGrowthNotificationsPage';
import { ParentSnackPaymentPage } from './features/payments/pages/ParentSnackPaymentPage';
import { VnpayReturnPage } from './features/payments/pages/VnpayReturnPage';
import { SnackBillingPaymentPage } from './features/payments/pages/SnackBillingPaymentPage';
import { SnackServicesPage } from './features/snack-services/pages/SnackServicesPage';
import { FoodIngredientsPage } from './features/foods/components/FoodIngredientsPage';
import { DishesPage } from './features/dishes/components/DishesPage';
import { ParentManagementPage } from './features/parents/pages/ParentManagementPage';

import { ProtectedRoute } from './core/components/ProtectedRoute';
import { useAuthStore } from './core/stores/auth.store';
import { isJwtExpired } from './core/utils/jwt';

/**
 * Lấy đường dẫn phân hệ tương ứng với Role của tài khoản
 */
export const getPortalPathForRoles = (roles?: any[]): string => {
  if (!roles || roles.length === 0) return '/dashboard';
  const roleStrings = roles.map((r: any) =>
    typeof r === 'string' ? r.toUpperCase() : (r?.code || r?.name || '').toUpperCase()
  );

  if (roleStrings.includes('KITCHEN_STAFF') || roleStrings.includes('KITCHEN_MANAGER')) {
    return '/kitchen';
  }
  if (roleStrings.includes('NUTRITIONIST')) {
    return '/nutritionist/menus';
  }
  if (roleStrings.includes('TEACHER')) {
    return '/tablet';
  }
  if (roleStrings.includes('PARENT')) {
    return '/child-menu-consumption';
  }
  if (
    roleStrings.includes('PRINCIPAL') ||
    roleStrings.includes('SUPER_ADMIN') ||
    roleStrings.includes('SCHOOL_MANAGEMENT') ||
    roleStrings.includes('SCHOOL_MANAGER')
  ) {
    return '/dashboard';
  }
  return '/dashboard';
};

/**
 * Component điều hướng thông minh theo Role người dùng khi muốn vào đúng Cổng
 */
const RoleBasedRedirect: React.FC = () => {
  const { user } = useAuthStore();
  const targetPath = getPortalPathForRoles(user?.roles);
  return <Navigate to={targetPath} replace />;
};

/**
 * Component xử lý khi người dùng vào trang gốc (/) hoặc (/home):
 * - Nếu CÒN Access Token (và chưa hết hạn) -> Vào THẲNG trang quản lý của tài khoản đó.
 * - Nếu CHƯA ĐĂNG NHẬP / ĐÃ ĐĂNG XUẤT / HẾT HẠN TOKEN -> Vào trang HomePage.
 */
const HomeOrPortalRedirect: React.FC = () => {
  const { isAuthenticated, accessToken, user } = useAuthStore();

  if (isAuthenticated && accessToken && !isJwtExpired(accessToken)) {
    const targetPath = getPortalPathForRoles(user?.roles);
    return <Navigate to={targetPath} replace />;
  }

  return <HomePage />;
};

export const App: React.FC = () => {
  const { hydrate, refreshProfile } = useAuthStore();

  // Hydrate auth state từ localStorage 1 lần khi app mount & kiểm tra token hết hạn
  useEffect(() => {
    hydrate();
    void refreshProfile();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <BrowserRouter>
      <Routes>
        {/* Điểm vào:
            - Nếu còn Access Token hợp lệ -> Vào THẲNG trang quản lý của tài khoản đó.
            - Nếu chưa đăng nhập / đã đăng xuất / hết hạn token -> Vào HomePage.
        */}
        <Route path="/" element={<HomeOrPortalRedirect />} />
        <Route path="/home" element={<HomeOrPortalRedirect />} />
        <Route path="/landing" element={<HomePage />} />

        {/* Public: Login Page & Forgot Password */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* Cổng mặc định theo Role */}
        <Route
          path="/portal"
          element={
            <ProtectedRoute>
              <RoleBasedRedirect />
            </ProtectedRoute>
          }
        />

        {/* ─── 1. PHÂN HỆ CỔNG CHUYÊN GIA DINH DƯỠNG (NUTRITIONIST PORTAL) ─── */}
        <Route
          path="/nutritionist"
          element={
            <ProtectedRoute allowedRoles={['NUTRITIONIST', 'SUPER_ADMIN', 'PRINCIPAL']}>
              <NutritionistLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/nutritionist/menus" replace />} />
          <Route path="dashboard" element={<NutritionistDashboardPage />} />
          <Route path="menus" element={<WeeklyMenuManagementPage />} />
          <Route path="rules" element={<NutritionRulesPage />} />
          <Route path="food-group-rules" element={<FoodGroupRulesPage />} />
          <Route path="allergens" element={<NutritionistAllergyManagementPage />} />
          <Route path="foods" element={<FoodIngredientsPage />} />
          <Route path="dishes" element={<DishesPage />} />
          <Route path="children" element={<Navigate to="/nutritionist/allergens" replace />} />
          <Route path="food-safety" element={<FoodSafetyComplianceReportPage />} />
          <Route path="food-safety-report" element={<FoodSafetyComplianceReportPage />} />
          <Route path="growth" element={<ChildGrowthMonitoringPage />} />
          <Route path="nutrition-physical" element={<NutritionPhysicalDashboardPage />} />
          <Route path="alerts" element={<RoleSpecificChildAlertsPage />} />
          <Route path="meal-operations" element={<MealOperationsReportPage />} />
          <Route path="parent-evaluations" element={<ParentEvaluationSummaryReportPage />} />
          <Route path="evaluations" element={<ParentEvaluationSummaryReportPage />} />
          <Route path="growth-notifications" element={<RoleBasedGrowthNotificationsPage />} />
          <Route path="snack-services" element={<SnackServicesPage />} />
          <Route path="services" element={<SnackServicesPage />} />
          <Route path="reports" element={<Navigate to="/nutritionist/dashboard" replace />} />
        </Route>

        {/* Tương thích ngược đường dẫn cũ /menus -> chuyển sang Cổng Dinh Dưỡng */}
        <Route
          path="/menus"
          element={
            <ProtectedRoute>
              <Navigate to="/nutritionist/menus" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/nutrition-rules"
          element={
            <ProtectedRoute>
              <Navigate to="/nutritionist/rules" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/food-group-rules"
          element={
            <ProtectedRoute allowedRoles={['NUTRITIONIST', 'SUPER_ADMIN', 'PRINCIPAL']}>
              <Navigate to="/nutritionist/food-group-rules" replace />
            </ProtectedRoute>
          }
        />

        {/* ─── 2. PHÂN HỆ CỔNG BAN GIÁM HIỆU / ADMIN ─── */}
        <Route
          element={
            <ProtectedRoute allowedRoles={['PRINCIPAL', 'SUPER_ADMIN', 'SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'TEACHER', 'NUTRITIONIST', 'KITCHEN_STAFF']}>
              <AdminDashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<SchoolSettingsPage />} />
          <Route path="/tenant/settings" element={<SchoolSettingsPage />} />
          <Route path="/settings" element={<SchoolSettingsPage />} />
          <Route path="/classes" element={<Navigate to="/settings" replace />} />
          <Route path="/staff" element={<StaffManagementPage />} />
          <Route
            path="/parents"
            element={
              <ProtectedRoute allowedRoles={['SCHOOL_MANAGER', 'PRINCIPAL', 'SUPER_ADMIN', 'SCHOOL_MANAGEMENT']}>
                <ParentManagementPage />
              </ProtectedRoute>
            }
          />
          <Route path="/inventory" element={<NutritionRulesPage />} />
          <Route path="/menu-approval" element={<PrincipalMenuApprovalPage />} />
          <Route path="/menu-planning" element={<WeeklyMenuManagementPage />} />
          <Route path="/services" element={<ParentEvaluationsPage />} />
          <Route path="/snack-roster" element={<SnackRosterPage />} />
          <Route path="/snack-services" element={<SnackServicesPage />} />
          <Route path="/food-safety" element={<FoodSafetyComplianceReportPage />} />
          <Route path="/food-safety-report" element={<FoodSafetyComplianceReportPage />} />
          <Route path="/food-safety-compliance" element={<FoodSafetyComplianceReportPage />} />
          <Route path="/audit-logs" element={<AuditLogsPage />} />
          <Route path="/finances" element={<SnackServiceRevenueReportPage />} />
          <Route path="/snack-revenue-report" element={<SnackServiceRevenueReportPage />} />
          <Route path="/snack-revenue" element={<SnackServiceRevenueReportPage />} />
          <Route path="/parent-evaluation-report" element={<ParentEvaluationSummaryReportPage />} />
          <Route path="/parent-evaluations" element={<ParentEvaluationSummaryReportPage />} />
          <Route path="/children" element={<BghMealPortionsOverviewPage />} />
          <Route path="/growth" element={<ChildGrowthMonitoringPage />} />
          <Route path="/growth-notifications" element={<RoleBasedGrowthNotificationsPage />} />
          <Route path="/growth-alerts" element={<RoleBasedGrowthNotificationsPage />} />
          <Route path="/nutrition-physical-dashboard" element={<NutritionPhysicalDashboardPage />} />
          <Route path="/nutrition-dashboard" element={<NutritionPhysicalDashboardPage />} />
          <Route path="/child-alerts" element={<RoleSpecificChildAlertsPage />} />
          <Route path="/meal-operations-report" element={<MealOperationsReportPage />} />
          <Route path="/meal-operations" element={<MealOperationsReportPage />} />
          <Route path="/payments" element={<SnackBillingPaymentPage />} />
        </Route>

        {/* ─── 3. PHÂN HỆ TABLET GIÁO VIÊN ─── */}
        <Route
          path="/tablet"
          element={
            <ProtectedRoute allowedRoles={['TEACHER', 'SUPER_ADMIN', 'PRINCIPAL']}>
              <TeacherTabletLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AttendancePage />} />
          <Route path="record" element={<Navigate to="/tablet?tab=evaluation" replace />} />
        </Route>

        {/* ─── 4. PHÂN HỆ MÀN HÌNH BẾP (KDS) & KITCHEN ─── */}
        <Route
          path="/kds"
          element={
            <ProtectedRoute allowedRoles={['KITCHEN_STAFF', 'SUPER_ADMIN', 'PRINCIPAL']}>
              <KitchenDisplayLayout />
            </ProtectedRoute>
          }
        />
        <Route
          path="/kitchen"
          element={
            <ProtectedRoute allowedRoles={['KITCHEN_STAFF', 'SUPER_ADMIN', 'PRINCIPAL']}>
              <KitchenDisplayLayout />
            </ProtectedRoute>
          }
        />

        {/* ─── 5. PHÂN HỆ CỔNG PHỤ HUYNH (PARENT PORTAL) ─── */}
        <Route
          path="/child-menu-consumption"
          element={
            <ProtectedRoute allowedRoles={['PARENT', 'SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'TEACHER']}>
              <MonitorChildMenuConsumptionPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/submit-evaluation"
          element={
            <ProtectedRoute allowedRoles={['PARENT', 'SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'TEACHER']}>
              <SubmitMealEvaluationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/declare-allergy"
          element={
            <ProtectedRoute allowedRoles={['PARENT', 'SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'TEACHER']}>
              <ParentAllergyDeclarationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/parent-snack-payment"
          element={
            <ProtectedRoute allowedRoles={['PARENT', 'SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'TEACHER']}>
              <ParentSnackPaymentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/parent-breakfast"
          element={
            <ProtectedRoute allowedRoles={['PARENT', 'SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_MANAGEMENT', 'SCHOOL_MANAGER', 'TEACHER']}>
              <ParentSnackPaymentPage />
            </ProtectedRoute>
          }
        />
        <Route path="/payments/vnpay-return" element={<VnpayReturnPage />} />
        {/* Catch-all: Điều hướng về /home */}
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
