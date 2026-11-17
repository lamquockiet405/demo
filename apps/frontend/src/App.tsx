import { useLanguage } from './core/i18n/useLanguage';
import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AdminDashboardLayout } from "./layouts/AdminDashboardLayout";
import { AcademicYearsPage } from "./features/academic-years/AcademicYearsPage";
import { NutritionistLayout } from "./layouts/NutritionistLayout";
import { TeacherPortalLayout } from "./layouts/TeacherPortalLayout";
import { TeacherClassesPage, TeacherMealsPage, TeacherReadPage, TeacherPortionsPage, TeacherNotesPage, TeacherGrowthPage } from "./features/teacher/TeacherWorkspace";
import { KitchenDisplayLayout } from "./layouts/KitchenDisplayLayout";
import { KitchenPortalLayout } from "./layouts/KitchenPortalLayout";
import { PublishedMenusBrowser } from "./features/menus/components/PublishedMenusBrowser";
import { ParentPublishedMenusPage } from "./features/parent-evaluations/ParentPublishedMenusPage";
import {
  KitchenAllergiesPage,
  KitchenAllergyAlertsPage,
} from "./features/kitchen/pages/KitchenAllergiesPage";
import { KitchenCatalogPage } from "./features/kitchen/pages/KitchenCatalogPage";
import { KitchenSnackRosterPage } from "./features/kitchen/pages/KitchenSnackRosterPage";
import { KitchenPortionsPage } from "./features/kitchen/pages/KitchenPortionsPage";
import { KitchenNotesPage } from "./features/kitchen/pages/KitchenNotesPage";
import { KitchenInspectionsPage } from "./features/kitchen/pages/KitchenInspectionsPage";
import { KitchenSamplesPage } from "./features/kitchen/pages/KitchenSamplesPage";

import { LoginPage } from "./features/auth/pages/LoginPage";
import { ForgotPasswordPage } from "./features/auth/pages/ForgotPasswordPage";
import { WeeklyMenuManagementPage } from "./features/menus/pages/WeeklyMenuManagementPage";
import { NutritionRulesPage } from "./features/menus/pages/NutritionRulesPage";
import { NutritionistAllergyManagementPage } from "./features/menus/pages/NutritionistAllergyManagementPage";
import { SchoolSettingsPage } from "./features/tenant/pages/SchoolSettingsPage";
import { StaffManagementPage } from "./features/staff/pages/StaffManagementPage";
import { PrincipalMenuApprovalPage } from "./features/menus/pages/PrincipalMenuApprovalPage";

import { ChildGrowthMonitoringPage } from "./features/growth/pages/ChildGrowthMonitoringPage";
import { ParentEvaluationsPage } from "./features/parent-evaluations/ParentEvaluationsPage";
import {
  PrincipalOverviewPage,
  PrincipalPortionsPage,
} from "./features/school/pages/PrincipalOverviewPage";
import { SnackRosterPage } from "./features/attendance/SnackRosterPage";
import { MonitorChildMenuConsumptionPage } from "./features/parent-evaluations/MonitorChildMenuConsumptionPage";
import { SubmitMealEvaluationPage } from "./features/parent-evaluations/SubmitMealEvaluationPage";
import { ParentAllergyDeclarationPage } from "./features/children/pages/ParentAllergyDeclarationPage";
import { ParentGrowthMonitoringPage } from "./features/growth/pages/ParentGrowthMonitoringPage";
import { ParentChildAlertsPage } from "./features/dashboard/pages/ParentChildAlertsPage";
import { HomePage } from "./features/home/HomePage";
import { AuditLogsPage } from "./features/audit-logs/pages/AuditLogsPage";
import { FoodGroupRulesPage } from "./features/menus/pages/FoodGroupRulesPage";
import { ParentSnackPaymentPage } from "./features/payments/pages/ParentSnackPaymentPage";
import { VnpayReturnPage } from "./features/payments/pages/VnpayReturnPage";
import { PrincipalSnackServicesPage as SnackServicesPage } from "./features/school/pages/PrincipalSnackServicesPage";
import { FoodIngredientsPage } from "./features/foods/components/FoodIngredientsPage";
import { DishesPage } from "./features/dishes/components/DishesPage";
import { ParentManagementPage } from "./features/parents/pages/ParentManagementPage";
import { ClassManagementPage } from "./features/school/pages/ClassManagementPage";
import { StudentManagementPage } from "./features/school/pages/StudentManagementPage";
import {
  PrincipalGrowthPage,
} from "./features/school/pages/PrincipalGrowthPage";
import { PrincipalInspectionSafetyPage } from "./features/school/pages/PrincipalInspectionSafetyPage";
import { PrincipalPaymentsPage } from "./features/school/pages/PrincipalPaymentsPage";
import { PrincipalMenuVersionsPage } from "./features/school/pages/PrincipalMenuVersionsPage";
import { NutritionStudentsPage } from "./features/nutrition/pages/NutritionStudentsPage";
import { PickyEatingPage } from "./features/nutrition/pages/PickyEatingPage";
import { MenuEvaluationPage } from "./features/nutrition/pages/MenuEvaluationPage";
import {
  NutritionOverviewPage,
  NutritionAlertsPage,
} from "./features/nutrition/pages/NutritionOverviewPage";
import { NutritionReportsPage } from "./features/nutrition/pages/NutritionReportsPage";

import { ProtectedRoute } from "./core/components/ProtectedRoute";
import { useAuthStore } from "./core/stores/auth.store";
import { isJwtExpired } from "./core/utils/jwt";

/**
 * Lấy đường dẫn phân hệ tương ứng với Role của tài khoản
 */
export const getPortalPathForRoles = (roles?: any[]): string => {
  if (!roles || roles.length === 0) return "/dashboard";
  const roleStrings = roles.map((r: any) =>
    typeof r === "string"
      ? r.toUpperCase()
      : (r?.code || r?.name || "").toUpperCase(),
  );

  if (
    roleStrings.includes("KITCHEN_STAFF") ||
    roleStrings.includes("KITCHEN_MANAGER")
  ) {
    return "/kitchen";
  }
  if (roleStrings.includes("NUTRITIONIST")) {
    return "/nutritionist/dashboard";
  }
  if (roleStrings.includes("TEACHER")) {
    return "/teacher/classes";
  }
  if (roleStrings.includes("PARENT")) {
    return "/child-menu-consumption";
  }
  if (
    roleStrings.includes("PRINCIPAL") ||
    roleStrings.includes("SUPER_ADMIN") ||
    roleStrings.includes("SCHOOL_MANAGEMENT") ||
    roleStrings.includes("SCHOOL_MANAGER")
  ) {
    return "/dashboard";
  }
  return "/dashboard";
};

/**
 * Component điều hướng thông minh theo Role người dùng khi muốn vào đúng Cổng
 */
const RoleBasedRedirect: React.FC = () => {
  useLanguage();
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
  useLanguage();
  const { isAuthenticated, accessToken, user } = useAuthStore();

  if (isAuthenticated && accessToken && !isJwtExpired(accessToken)) {
    const targetPath = getPortalPathForRoles(user?.roles);
    return <Navigate to={targetPath} replace />;
  }

  return <HomePage />;
};

export const App: React.FC = () => {
  useLanguage();
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
            <ProtectedRoute allowedRoles={["NUTRITIONIST", "SUPER_ADMIN"]}>
              <NutritionistLayout />
            </ProtectedRoute>
          }
        >
          <Route
            index
            element={<Navigate to="/nutritionist/dashboard" replace />}
          />
          <Route path="dashboard" element={<NutritionOverviewPage />} />
          <Route
            path="menu-evaluation"
            element={<Navigate to="/nutritionist/menus" replace />}
          />
          <Route path="menus" element={<WeeklyMenuManagementPage />} />
          <Route path="rules" element={<Navigate to="/nutritionist/dashboard" replace />} />
          <Route path="food-group-rules" element={<Navigate to="/nutritionist/dashboard" replace />} />
          <Route
            path="allergens"
            element={<NutritionistAllergyManagementPage />}
          />
          <Route path="foods" element={<FoodIngredientsPage />} />
          <Route path="dishes" element={<DishesPage />} />
          <Route path="children" element={<NutritionStudentsPage />} />
          <Route path="picky-eating" element={<PickyEatingPage />} />
          <Route
            path="samples"
            element={<Navigate to="/nutritionist/dashboard" replace />}
          />
          <Route
            path="gross-weight"
            element={<Navigate to="/nutritionist/menus" replace />}
          />
          <Route
            path="food-safety"
            element={<Navigate to="/nutritionist/dashboard" replace />}
          />
          <Route
            path="inspections"
            element={<Navigate to="/nutritionist/dashboard" replace />}
          />
          <Route
            path="food-safety-report"
            element={<Navigate to="/nutritionist/dashboard" replace />}
          />
          <Route path="growth" element={<ChildGrowthMonitoringPage />} />
          <Route
            path="nutrition-physical"
            element={<Navigate to="/nutritionist/dashboard" replace />}
          />
          <Route path="alerts" element={<NutritionAlertsPage />} />
          <Route
            path="meal-operations"
            element={<Navigate to="/nutritionist/dashboard" replace />}
          />
          <Route
            path="parent-evaluations"
            element={<Navigate to="/nutritionist/dashboard" replace />}
          />
          <Route
            path="evaluations"
            element={<Navigate to="/nutritionist/dashboard" replace />}
          />
          <Route
            path="growth-notifications"
            element={<Navigate to="/nutritionist/growth" replace />}
          />
          <Route
            path="snack-services"
            element={<Navigate to="/nutritionist/dashboard" replace />}
          />
          <Route
            path="services"
            element={<Navigate to="/nutritionist/dashboard" replace />}
          />
          <Route
            path="reports"
            element={<Navigate to="/nutritionist/dashboard" replace />}
          />
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
              <Navigate to="/nutrition-standards" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/food-group-rules"
          element={
            <ProtectedRoute
              allowedRoles={["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_MANAGEMENT", "SCHOOL_MANAGER"]}
            >
              <Navigate to="/nutrition-standards" replace />
            </ProtectedRoute>
          }
        />

        {/* ─── 2. PHÂN HỆ CỔNG BAN GIÁM HIỆU / ADMIN ─── */}
        <Route
          element={
            <ProtectedRoute
              allowedRoles={[
                "PRINCIPAL",
                "SUPER_ADMIN",
                "SCHOOL_MANAGEMENT",
                "SCHOOL_MANAGER",
              ]}
            >
              <AdminDashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<PrincipalOverviewPage />} />
          <Route path="/tenant/settings" element={<SchoolSettingsPage />} />
          <Route path="/settings" element={<SchoolSettingsPage />} />
          <Route path="/classes" element={<ClassManagementPage />} />
          <Route path="/academic-years" element={<AcademicYearsPage />} />
          <Route path="/students" element={<StudentManagementPage />} />
          <Route path="/meal-portions" element={<PrincipalPortionsPage />} />
          <Route
            path="/food-samples"
            element={<KitchenSamplesPage audience="principal" />}
          />
          <Route
            path="/inspection-approval"
            element={<PrincipalInspectionSafetyPage />}
          />
          <Route path="/staff" element={<StaffManagementPage />} />
          <Route
            path="/parents"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "SCHOOL_MANAGER",
                  "PRINCIPAL",
                  "SUPER_ADMIN",
                  "SCHOOL_MANAGEMENT",
                ]}
              >
                <ParentManagementPage />
              </ProtectedRoute>
            }
          />
          <Route path="/nutrition-standards" element={<NutritionRulesPage />} />
          <Route
            path="/menu-evaluation"
            element={<Navigate to="/menu-approval" replace />}
          />
          <Route
            path="/menu-versions"
            element={<Navigate to="/menu-approval" replace />}
          />
          <Route
            path="/menu-approval"
            element={<PrincipalMenuApprovalPage />}
          />
          <Route
            path="/menu-planning"
            element={<Navigate to="/menu-approval" replace />}
          />
          <Route path="/services" element={<ParentEvaluationsPage />} />
          <Route path="/snack-roster" element={<SnackRosterPage />} />
          <Route path="/snack-services" element={<SnackServicesPage />} />
          <Route
            path="/food-safety"
            element={<Navigate to="/inspection-approval" replace />}
          />
          <Route
            path="/food-safety-report"
            element={<Navigate to="/inspection-approval" replace />}
          />
          <Route
            path="/food-safety-compliance"
            element={<Navigate to="/inspection-approval" replace />}
          />
          <Route path="/audit-logs" element={<AuditLogsPage />} />
          <Route
            path="/parent-evaluation-report"
            element={<NutritionReportsPage kind="evaluations" />}
          />
          <Route
            path="/parent-evaluations"
            element={<NutritionReportsPage kind="evaluations" />}
          />
          <Route
            path="/children"
            element={<Navigate to="/students" replace />}
          />
          <Route path="/growth" element={<PrincipalGrowthPage />} />
          <Route
            path="/growth-notifications"
            element={<Navigate to="/growth" replace />}
          />
          <Route
            path="/growth-alerts"
            element={<Navigate to="/growth" replace />}
          />
          <Route
            path="/nutrition-physical-dashboard"
            element={<PrincipalOverviewPage />}
          />
          <Route
            path="/nutrition-dashboard"
            element={<PrincipalOverviewPage />}
          />
          <Route
            path="/child-alerts"
            element={<Navigate to="/dashboard" replace />}
          />
          <Route path="/payments" element={<PrincipalPaymentsPage />} />
        </Route>

        {/* ─── 3. PHÂN HỆ TABLET GIÁO VIÊN ─── */}
        <Route path="/teacher" element={<ProtectedRoute allowedRoles={["TEACHER", "SUPER_ADMIN"]}><TeacherPortalLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/teacher/classes" replace />} />
          <Route path="classes" element={<TeacherClassesPage />} />
          <Route path="students" element={<StudentManagementPage />} />
          <Route path="nutrition-profiles" element={<NutritionStudentsPage />} />
          <Route path="allergies" element={<TeacherReadPage kind="allergies" />} />
          <Route path="snack-roster" element={<TeacherReadPage kind="roster" />} />
          <Route path="portions" element={<TeacherPortionsPage />} />
          <Route path="notes" element={<TeacherNotesPage />} />
          <Route path="meals" element={<TeacherMealsPage />} />
          <Route path="history" element={<TeacherReadPage kind="history" />} />
          <Route path="picky-eating" element={<PickyEatingPage />} />
          <Route path="growth" element={<TeacherGrowthPage />} />
          <Route path="notifications" element={<Navigate to="/teacher/growth" replace />} />
          <Route path="alerts" element={<Navigate to="/teacher/classes" replace />} />
          <Route path="report" element={<Navigate to="/teacher/classes" replace />} />
        </Route>
        <Route path="/tablet/*" element={<ProtectedRoute allowedRoles={["TEACHER", "SUPER_ADMIN"]}><Navigate to="/teacher/meals" replace /></ProtectedRoute>} />

        {/* ─── 4. PHÂN HỆ MÀN HÌNH BẾP (KDS) & KITCHEN ─── */}
        <Route
          path="/kds"
          element={
            <ProtectedRoute
              allowedRoles={[
                "KITCHEN_STAFF",
                "KITCHEN_MANAGER",
                "SUPER_ADMIN",
                "PRINCIPAL",
              ]}
            >
              <Navigate to="/kitchen" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/kitchen"
          element={
            <ProtectedRoute
              allowedRoles={[
                "KITCHEN_STAFF",
                "KITCHEN_MANAGER",
                "SUPER_ADMIN",
                "PRINCIPAL",
              ]}
            >
              <KitchenPortalLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<KitchenDisplayLayout />} />
          <Route path="allergies" element={<KitchenAllergiesPage />} />
          <Route path="allergy-alerts" element={<KitchenAllergyAlertsPage />} />
          <Route
            path="foods"
            element={<KitchenCatalogPage key="foods" kind="foods" />}
          />
          <Route
            path="dishes"
            element={<KitchenCatalogPage key="dishes" kind="dishes" />}
          />
          <Route path="snack-roster" element={<KitchenSnackRosterPage />} />
          <Route path="portions" element={<KitchenPortionsPage />} />
          <Route
            path="menus"
            element={<PublishedMenusBrowser audience="kitchen" />}
          />
          <Route path="notes" element={<KitchenNotesPage />} />
          <Route path="inspections" element={<KitchenInspectionsPage />} />
          <Route path="samples" element={<KitchenSamplesPage />} />
          <Route path="reports" element={<Navigate to="/kitchen" replace />} />
        </Route>

        {/* ─── 5. PHÂN HỆ CỔNG PHỤ HUYNH (PARENT PORTAL) ─── */}
        <Route
          path="/parent/menus"
          element={
            <ProtectedRoute
              allowedRoles={[
                "PARENT",
                "SUPER_ADMIN",
                "PRINCIPAL",
                "SCHOOL_MANAGEMENT",
                "SCHOOL_MANAGER",
                "TEACHER",
              ]}
            >
              <ParentPublishedMenusPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/child-menu-consumption"
          element={
            <ProtectedRoute
              allowedRoles={[
                "PARENT",
                "SUPER_ADMIN",
                "PRINCIPAL",
                "SCHOOL_MANAGEMENT",
                "SCHOOL_MANAGER",
                "TEACHER",
              ]}
            >
              <MonitorChildMenuConsumptionPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/submit-evaluation"
          element={
            <ProtectedRoute
              allowedRoles={[
                "PARENT",
                "SUPER_ADMIN",
                "PRINCIPAL",
                "SCHOOL_MANAGEMENT",
                "SCHOOL_MANAGER",
                "TEACHER",
              ]}
            >
              <SubmitMealEvaluationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/declare-allergy"
          element={
            <ProtectedRoute
              allowedRoles={[
                "PARENT",
                "SUPER_ADMIN",
                "PRINCIPAL",
                "SCHOOL_MANAGEMENT",
                "SCHOOL_MANAGER",
                "TEACHER",
              ]}
            >
              <ParentAllergyDeclarationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/parent/growth"
          element={
            <ProtectedRoute
              allowedRoles={[
                "PARENT",
                "SUPER_ADMIN",
                "PRINCIPAL",
                "SCHOOL_MANAGEMENT",
                "SCHOOL_MANAGER",
                "TEACHER",
              ]}
            >
              <ParentGrowthMonitoringPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/parent/alerts"
          element={
            <ProtectedRoute
              allowedRoles={[
                "PARENT",
                "SUPER_ADMIN",
                "PRINCIPAL",
                "SCHOOL_MANAGEMENT",
                "SCHOOL_MANAGER",
                "TEACHER",
              ]}
            >
              <ParentChildAlertsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/parent-snack-payment"
          element={
            <ProtectedRoute
              allowedRoles={[
                "PARENT",
                "SUPER_ADMIN",
                "PRINCIPAL",
                "SCHOOL_MANAGEMENT",
                "SCHOOL_MANAGER",
                "TEACHER",
              ]}
            >
              <ParentSnackPaymentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/parent-breakfast"
          element={<Navigate to="/parent-snack-payment" replace />}
        />
        <Route path="/payments/vnpay-return" element={<VnpayReturnPage />} />
        {/* Catch-all: Điều hướng về /home */}
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
