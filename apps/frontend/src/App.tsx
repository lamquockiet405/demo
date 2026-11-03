import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
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
import { MenuPlanningPage } from './features/menus/pages/MenuPlanningPage';

import { TeacherTabletPage } from './features/attendance/pages/TeacherTabletPage';
import { ChildGrowthMonitoringPage } from './features/growth/pages/ChildGrowthMonitoringPage';
import { AttendancePage } from './features/attendance/AttendancePage';
import { MealEvaluationPage } from './features/attendance/MealEvaluationPage';
import { MonitorChildMenuConsumptionPage } from './features/parent-evaluations/MonitorChildMenuConsumptionPage';
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

import { ProtectedRoute } from './core/components/ProtectedRoute';
import { useAuthStore } from './core/stores/auth.store';
import { isJwtExpired } from './core/utils/jwt';
import { ChefHat, Tablet, LayoutDashboard, Sparkles, LogOut, Users, Scale, UtensilsCrossed, Home } from 'lucide-react';

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
  const { hydrate, refreshProfile, isAuthenticated, logout, user } = useAuthStore();

  // Hydrate auth state từ localStorage 1 lần khi app mount & kiểm tra token hết hạn
  useEffect(() => {
    hydrate();
    void refreshProfile();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const roles = user?.roles || [];
  const isNutritionist = roles.includes('NUTRITIONIST');
  const isPrincipal = roles.includes('PRINCIPAL') || roles.includes('SUPER_ADMIN');

  return (
    <BrowserRouter>
      {/* Quick Navigation Floating Bar — chỉ hiện khi đã login */}
      {isAuthenticated && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-3 border border-slate-700 text-xs font-semibold">
          <Link to="/landing" className="flex items-center gap-1 text-slate-300 hover:text-white transition" title="Xem trang giới thiệu giải pháp">
            <Home className="w-3.5 h-3.5" /> Giới thiệu
          </Link>
          <span className="text-slate-600">|</span>

          <span className="text-slate-300 flex items-center gap-1.5 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            {user?.fullName} ({isNutritionist ? 'Dinh dưỡng' : isPrincipal ? 'Hiệu trưởng' : 'Nhân sự'})
          </span>

          <span className="text-slate-600">|</span>

          {/* Nút dành riêng cho Chuyên gia Dinh dưỡng */}
          {isNutritionist && (
            <>
              <Link to="/nutritionist/menus" className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition font-bold">
                <UtensilsCrossed className="w-3.5 h-3.5" /> Cổng Dinh Dưỡng
              </Link>
              <span className="text-slate-600">|</span>
              <Link to="/nutritionist/rules" className="flex items-center gap-1 hover:text-teal-300 transition">
                <Scale className="w-3.5 h-3.5" /> Quy chuẩn & Dị ứng
              </Link>
              <span className="text-slate-600">|</span>
            </>
          )}

          {/* Nút dành riêng cho Ban Giám Hiệu */}
          {isPrincipal && (
            <>
              <Link to="/dashboard" className="flex items-center gap-1 text-teal-400 hover:text-teal-300 transition font-bold">
                <LayoutDashboard className="w-3.5 h-3.5" /> Cổng BGH
              </Link>
              <span className="text-slate-600">|</span>
              <Link to="/staff" className="flex items-center gap-1 hover:text-teal-300 transition">
                <Users className="w-3.5 h-3.5" /> Nhân sự & Bếp
              </Link>
              <span className="text-slate-600">|</span>
              <Link to="/menu-approval" className="flex items-center gap-1 hover:text-emerald-300 transition">
                <UtensilsCrossed className="w-3.5 h-3.5" /> Duyệt thực đơn DD
              </Link>
              <span className="text-slate-600">|</span>
            </>
          )}

          {/* Các cổng khác */}
          <Link to="/tablet" className="flex items-center gap-1 hover:text-emerald-300 transition">
            <Tablet className="w-3.5 h-3.5" /> Tablet GV
          </Link>
          <span className="text-slate-600">|</span>
          <Link to="/kitchen" className="flex items-center gap-1 hover:text-amber-300 transition">
            <ChefHat className="w-3.5 h-3.5" /> KDS Bếp
          </Link>

          <span className="text-slate-600">|</span>
          <button
            onClick={() => {
              logout();
              window.location.href = '/home';
            }}
            className="flex items-center gap-1 text-rose-400 hover:text-rose-300 transition font-bold"
          >
            <LogOut className="w-3.5 h-3.5" /> Thoát
          </button>
        </div>
      )}

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
          <Route path="children" element={<NutritionistDashboardPage />} />
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
          <Route path="reports" element={<NutritionistDashboardPage />} />
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
          <Route path="/classes" element={<SchoolSettingsPage />} />
          <Route path="/staff" element={<StaffManagementPage />} />
          <Route path="/inventory" element={<NutritionRulesPage />} />
          <Route path="/menu-approval" element={<PrincipalMenuApprovalPage />} />
          <Route path="/menu-planning" element={<MenuPlanningPage />} />
          <Route path="/services" element={<SnackServicesPage />} />
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
          <Route path="/children" element={<WeeklyMenuManagementPage />} />
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
          <Route path="record" element={<MealEvaluationPage />} />
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

        {/* Catch-all: Điều hướng về /home */}
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
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
