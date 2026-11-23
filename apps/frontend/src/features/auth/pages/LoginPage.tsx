import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  Shield,
  Phone,
  UtensilsCrossed,
  ShieldCheck,
  HeartPulse,
  ClipboardCheck,
  ArrowRight,
  Building2,
  MapPin,
  AlertCircle,
} from "lucide-react";
import { useAuthStore } from "../../../core/stores/auth.store";
import {
  fetchTenants,
  loginApi,
  LoginResponse,
} from "../../../core/api/auth.api";
import { ForgotPasswordModal } from "../components/ForgotPasswordModal";
import { LanguageSwitcher } from '../../../core/components/LanguageSwitcher';
import { useSchoolBranding } from '../../../core/hooks/useSchoolBranding';

export const LoginPage: React.FC = () => {
  useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth, setTenantId, isAuthenticated, user } = useAuthStore();
  const schoolBranding = useSchoolBranding();

  const getPortalPath = (roles?: any[]): string => {
    if (!roles || roles.length === 0) return "/dashboard";
    const roleStrings = roles.map((r: any) =>
      typeof r === "string"
        ? r.toUpperCase()
        : (r?.code || r?.name || "").toUpperCase(),
    );
    if (
      roleStrings.includes("KITCHEN_STAFF") ||
      roleStrings.includes("KITCHEN_MANAGER")
    )
      return "/kitchen";
    if (roleStrings.includes("NUTRITIONIST")) return "/nutritionist/dashboard";
    if (roleStrings.includes("TEACHER")) return "/teacher/classes";
    if (
      roleStrings.includes("SCHOOL_MANAGEMENT") ||
      roleStrings.includes("SCHOOL_MANAGER") ||
      roleStrings.includes("PRINCIPAL") ||
      roleStrings.includes("SUPER_ADMIN")
    ) {
      return "/dashboard";
    }
    if (roleStrings.includes("PARENT")) return "/child-menu-consumption";
    return "/dashboard";
  };

  // Form state
  const [email, setEmail] = useState<string>(
    () => (location.state as any)?.email || "",
  );
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [show2Fa, setShow2Fa] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      navigate(getPortalPath(user?.roles), { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    if (isAuthenticated) return;
    let cancelled = false;
    fetchTenants()
      .then((data) => {
        if (!cancelled && data.length > 0) {
          const defaultTenant = data[0];
          setTenantId(String(defaultTenant.id));
        }
      })
      .catch(() => {
        setTenantId("1");
      });
    return () => {
      cancelled = true;
    };
  }, [setTenantId, isAuthenticated]);

  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setLoading(true);

      try {
        const rawResult = await loginApi({
          email,
          password,
          ...(show2Fa && twoFactorCode ? { twoFactorCode } : {}),
        });

        const payload: any = (rawResult as any)?.data || rawResult;

        if (payload && "require2Fa" in payload && payload.require2Fa) {
          setShow2Fa(true);
          setLoading(false);
          return;
        }

        const loginResult = payload as LoginResponse;
        if (
          !loginResult ||
          !loginResult.user ||
          !loginResult.accessToken ||
          !loginResult.refreshToken
        ) {
          throw new Error("Dữ liệu người dùng phản hồi không hợp lệ.");
        }

        const rawRoles = loginResult.user.roles || [];
        const normalizedRoles = Array.isArray(rawRoles)
          ? rawRoles.map((r: any) =>
            typeof r === "string" ? r : r?.code || r?.name,
          )
          : [];

        const sanitizedUser = {
          ...loginResult.user,
          roles: normalizedRoles,
          tenantId: String(loginResult.user.tenantId || "1"),
        };

        setAuth(
          sanitizedUser,
          loginResult.accessToken,
          loginResult.refreshToken,
        );
        navigate(getPortalPath(normalizedRoles), { replace: true });
      } catch (err: any) {
        console.error("Login error:", err);
        const message =
          err?.response?.data?.message ||
          err?.message ||
          "Đăng nhập thất bại. Vui lòng kiểm tra lại email hoặc mật khẩu.";
        setError(typeof message === "string" ? message : message[0]);
      } finally {
        setLoading(false);
      }
    },
    [email, password, twoFactorCode, show2Fa, setAuth, navigate],
  );

  const features = [
    {
      icon: UtensilsCrossed,
      title: "Thực đơn & Dinh dưỡng chuẩn Bộ Y tế",
      desc: "Cân đối năng lượng, vi chất và khẩu phần theo từng lứa tuổi mầm non.",
    },
    {
      icon: ShieldCheck,
      title: "Kiểm soát Dị ứng & An toàn thực phẩm",
      desc: "Cảnh báo dị nguyên tự động tới bếp, kiểm thực 3 bước và lưu mẫu 24 giờ.",
    },
    {
      icon: HeartPulse,
      title: "Theo dõi Thể chất & Sức ăn hằng ngày",
      desc: "Cập nhật biểu đồ tăng trưởng, nhận xét bữa ăn và kết nối trực tiếp phụ huynh.",
    },
    {
      icon: ClipboardCheck,
      title: "Quản lý Suất ăn xế & Thanh toán điện tử",
      desc: "Đối soát tự động qua VNPAY và xuất biên lai điện tử minh bạch.",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:grid lg:grid-cols-12 font-sans text-slate-800">
      {/* ─── CỘT TRÁI: BRANDING & GIỚI THIỆU HỆ THỐNG (6 COLS TRÊN DESKTOP) ─── */}
      <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 bg-gradient-to-br from-[#064e3b] via-[#065f46] to-[#0f766e] text-white p-10 xl:p-14 flex-col justify-between relative overflow-hidden">
        {/* Họa tiết nền tinh tế */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.35) 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-teal-300/10 blur-3xl pointer-events-none" />

        {/* Top: Logo & Tên Trường */}
        <div className="relative z-10 flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-white/95 p-1 flex items-center justify-center shadow-lg shrink-0 overflow-hidden">
            {schoolBranding.logoUrl ? (
              <img
                src={schoolBranding.logoUrl}
                alt={schoolBranding.name}
                className="w-full h-full object-contain rounded-xl"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            ) : (
              <UtensilsCrossed className="w-6 h-6 text-emerald-700" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-tight text-white">
                Kid<span className="text-emerald-300">Meal</span>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-800/80 border border-emerald-600/60 text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                {translateText("Bán trú thông minh")}
              </span>
            </div>
            <p className="text-xs text-emerald-100/90 font-semibold mt-0.5">
              {schoolBranding.name || translateText("KidMeal")}
            </p>
          </div>
        </div>

        {/* Center: Logo Trường cỡ lớn ở chính giữa thay thế nội dung chữ */}
        <div className="relative z-10 my-auto py-8 flex flex-col items-center justify-center text-center space-y-6">
          <div className="w-56 h-56 xl:w-64 xl:h-64 rounded-[2.5rem] bg-white p-6 flex items-center justify-center shadow-2xl shadow-black/25 ring-8 ring-white/15 overflow-hidden">
            {schoolBranding.logoUrl ? (
              <img
                src={schoolBranding.logoUrl}
                alt={schoolBranding.name}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            ) : (
              <UtensilsCrossed className="w-24 h-24 text-emerald-700" />
            )}
          </div>
          <div className="space-y-1.5">
            <h2 className="text-2xl xl:text-3xl font-black tracking-tight text-white">
              {schoolBranding.name || translateText("KidMeal")}
            </h2>
            <p className="text-sm font-medium text-emerald-200/90">
              {translateText("Hệ thống Quản lý Bán trú & Dinh dưỡng Học đường")}
            </p>
          </div>
        </div>

        {/* Bottom: Thông tin liên hệ trường */}
        <div className="relative z-10 pt-6 border-t border-white/15 flex flex-wrap items-center justify-between gap-4 text-xs text-emerald-100/80">
          <div className="flex flex-wrap items-center gap-4">
            {schoolBranding.address && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                <span>{schoolBranding.address}</span>
              </span>
            )}
            {schoolBranding.phone && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-white">
                <Phone className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                <span>Hotline: {schoolBranding.phone}</span>
              </span>
            )}
          </div>
          <span>© {new Date().getFullYear()} KidMeal</span>
        </div>
      </div>

      {/* ─── CỘT PHẢI: KHUNG ĐĂNG NHẬP SẠCH SẼ & HIỆN ĐẠI (6 COLS TRÊN DESKTOP) ─── */}
      <div className="flex-1 lg:col-span-6 xl:col-span-5 flex flex-col justify-between bg-white min-h-screen">
        {/* Top bar (Mobile logo + Language switcher) */}
        <header className="px-6 py-4 flex items-center justify-between border-b border-slate-100 lg:border-b-0">
          <div className="flex items-center gap-2.5 lg:invisible">
            <div className="w-9 h-9 rounded-xl bg-teal-700 text-white flex items-center justify-center shadow-xs overflow-hidden shrink-0">
              {schoolBranding.logoUrl ? (
                <img
                  src={schoolBranding.logoUrl}
                  alt={schoolBranding.name}
                  className="w-full h-full object-cover bg-white"
                />
              ) : (
                <UtensilsCrossed className="w-4 h-4" />
              )}
            </div>
            <span className="text-sm font-bold text-slate-900 truncate max-w-[200px]">
              {schoolBranding.name || "KidMeal"}
            </span>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <LanguageSwitcher />
          </div>
        </header>

        {/* Main Form Container */}
        <main className="flex-1 flex items-center justify-center px-6 py-8 sm:px-10">
          <div className="w-full max-w-md space-y-6">
            {/* School & System Header */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200/80 text-teal-800 text-xs font-bold">
                <Building2 className="w-3.5 h-3.5 text-teal-600" />
                <span>
                  {schoolBranding.name || translateText("KidMeal")}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {translateText("Đăng nhập hệ thống")}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                {translateText(
                  "Nhập thông tin tài khoản để truy cập cổng quản lý và sổ theo dõi bán trú.",
                )}
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 animate-shake"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{translateText(error)}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email Input */}
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                >
                  {translateText("Email")}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    id="login-email"
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={translateText("hieutruong@huongduong.edu.vn")}
                    autoComplete="email"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10 transition outline-none"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-bold text-slate-700"
                  >
                    {translateText("Mật khẩu")}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-xs text-teal-700 font-bold hover:text-teal-800 hover:underline transition cursor-pointer"
                  >
                    {translateText("Quên mật khẩu?")}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    minLength={6}
                    className="w-full pl-10 pr-11 py-2.5 bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10 transition outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    aria-label={translateText(showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu")}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* 2FA Code (conditional) */}
              {show2Fa && (
                <div className="animate-fadeIn">
                  <label
                    htmlFor="login-2fa"
                    className="block text-xs font-bold text-slate-700 mb-1.5"
                  >
                    {translateText("Mã xác thực 2FA")}
                  </label>
                  <div className="relative">
                    <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      id="login-2fa"
                      type="text"
                      value={twoFactorCode}
                      onChange={(e) =>
                        setTwoFactorCode(
                          e.target.value.replace(/\D/g, "").slice(0, 6),
                        )
                      }
                      placeholder={translateText("Nhập 6 chữ số từ ứng dụng xác thực")}
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      maxLength={6}
                      className="w-full pl-10 pr-4 py-2.5 bg-amber-50/70 border border-amber-300 rounded-xl text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Remember Me */}
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 accent-teal-600 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-600">
                    {translateText("Duy trì trạng thái đăng nhập")}
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                id="login-submit"
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm rounded-xl shadow-sm hover:shadow transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    <span>{translateText("Đang xác thực...")}</span>
                  </>
                ) : (
                  <>
                    <span>{translateText("Đăng nhập")}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </main>

        {/* Bottom Footer */}
        <footer className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
          <span>
            © {new Date().getFullYear()} {schoolBranding.name || "KidMeal"}
          </span>
          <div className="flex items-center gap-3">
            {schoolBranding.phone && (
              <span className="text-slate-600 font-semibold">
                {translateText("Hỗ trợ:")} {schoolBranding.phone}
              </span>
            )}
          </div>
        </footer>
      </div>

      {/* Modal Quên & Đặt lại mật khẩu (OTP Email) */}
      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
        initialEmail={email}
        onSuccessLogin={(resetEmail) => {
          setEmail(resetEmail);
          setPassword("");
          setError("");
          setShowForgotPassword(false);
        }}
      />
    </div>
  );
};
