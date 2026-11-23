import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  UtensilsCrossed,
  LayoutDashboard,
  ShieldCheck,
  CreditCard,
  ArrowRight,
  CheckCircle2,
  Lock,
  Phone,
  Mail,
  MapPin,
  Building2,
  FileCheck,
  TrendingUp,
  Flame,
  BellRing,
  CalendarCheck,
} from 'lucide-react';
import { useAuthStore } from '../../core/stores/auth.store';
import { useSchoolBranding } from '../../core/hooks/useSchoolBranding';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuthStore();
  const schoolBranding = useSchoolBranding();
  const roles = user?.roles || [];
  const getMyPortalPath = (): string => {
    if (roles.includes('KITCHEN_STAFF') || roles.includes('KITCHEN_MANAGER')) return '/kitchen';
    if (roles.includes('NUTRITIONIST')) return '/nutritionist/menus';
    if (roles.includes('TEACHER')) return '/tablet';
    if (
      roles.includes('PRINCIPAL') ||
      roles.includes('SUPER_ADMIN') ||
      roles.includes('SCHOOL_MANAGEMENT')
    )
      return '/dashboard';
    if (roles.includes('PARENT')) return '/child-menu-consumption';
    return '/dashboard';
  };

  const roleLabel =
    roles.includes('KITCHEN_STAFF') || roles.includes('KITCHEN_MANAGER')
      ? 'Nhân Viên Bếp'
      : roles.includes('NUTRITIONIST')
        ? 'Chuyên Viên Dinh Dưỡng'
        : roles.includes('PRINCIPAL') || roles.includes('SUPER_ADMIN')
          ? 'Ban Giám Hiệu'
          : roles.includes('TEACHER')
            ? 'Giáo Viên Bán Trú'
            : roles.includes('PARENT')
              ? 'Phụ Huynh'
              : 'Nhân Sự';

  const schoolName = schoolBranding.name || 'KidMeal';

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans selection:bg-teal-600 selection:text-white">
      {/* ─────────────────────────────────────────────────────────────
          1. TOP NAVIGATION BAR
      ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 py-3.5 flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-3 group min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-teal-700 to-emerald-500 p-0.5 flex items-center justify-center text-white shadow-sm shrink-0 overflow-hidden">
              {schoolBranding.logoUrl ? (
                <img
                  src={schoolBranding.logoUrl}
                  alt={schoolName}
                  className="w-full h-full object-contain rounded-[14px] bg-white p-0.5"
                />
              ) : (
                <UtensilsCrossed className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-slate-900">
                  Kid<span className="text-teal-600">Meal</span>
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-teal-50 text-teal-800 rounded-md border border-teal-200/80">
                  Bán trú học đường
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 truncate">{schoolName}</p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-7 text-xs font-bold text-slate-600">
            <a href="#standards" className="hover:text-teal-700 transition">
              Quy chuẩn chuyên môn
            </a>
            <a href="#workflow" className="hover:text-teal-700 transition">
              Quy trình vận hành
            </a>
            <a href="#contact" className="hover:text-teal-700 transition">
              Thông tin liên hệ
            </a>
          </nav>

          {/* User Auth Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0">
            {isAuthenticated ? (
              <div className="flex items-center gap-2.5">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-bold text-slate-900">{user?.fullName}</span>
                  <span className="text-[10px] font-semibold text-teal-700">{roleLabel}</span>
                </div>
                <Link
                  to={getMyPortalPath()}
                  className="px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs flex items-center gap-2 transition"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>Vào cổng làm việc</span>
                </Link>
                <button
                  onClick={() => {
                    logout();
                    navigate('/');
                  }}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                  title="Đăng xuất"
                >
                  <Lock className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs flex items-center gap-2 transition group"
              >
                <span>Đăng nhập hệ thống</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. SPLIT-GRID HERO SECTION WITH LIVE DASHBOARD PREVIEW
      ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-12 lg:py-20 bg-gradient-to-b from-white via-teal-50/30 to-[#f8fafc] border-b border-slate-200/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Column (6 cols): Value Proposition & CTAs */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold">
                <Building2 className="w-3.5 h-3.5 text-teal-600" />
                <span>{schoolName} · Hệ sinh thái Bán trú Số</span>
              </div>

              <h1 className="text-3xl sm:text-4xl xl:text-5xl font-black text-slate-900 tracking-tight leading-[1.18]">
                Quản Lý Thực Đơn, Dinh Dưỡng &{' '}
                <span className="text-teal-700">An Toàn Bữa Ăn Mầm Non</span>
              </h1>

              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                Nền tảng điều phối bữa ăn bán trú khép kín: kết nối đồng bộ từ khâu thiết kế thực đơn
                cân đối năng lượng, kiểm soát khay ăn dị ứng tại bếp, lưu mẫu kiểm thực 3 bước đến sổ
                theo dõi sức ăn và thanh toán trực tuyến cho phụ huynh.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  to={isAuthenticated ? getMyPortalPath() : '/login'}
                  className="px-6 py-3.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm shadow-sm flex items-center gap-2 transition"
                >
                  <span>
                    {isAuthenticated ? 'Vào bàn làm việc của bạn' : 'Đăng nhập cổng nhà trường'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Quick Trust Metrics Strip */}
              <div className="pt-4 border-t border-slate-200/80 grid grid-cols-3 gap-4">
                <div>
                  <span className="text-xl sm:text-2xl font-black text-slate-900 block">
                    5 Phân hệ
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    Đồng bộ dữ liệu thời gian thực
                  </span>
                </div>
                <div>
                  <span className="text-xl sm:text-2xl font-black text-teal-700 block">100%</span>
                  <span className="text-xs text-slate-500 font-medium">
                    Chuẩn dinh dưỡng & kiểm thực
                  </span>
                </div>
                <div>
                  <span className="text-xl sm:text-2xl font-black text-slate-900 block">24 Giờ</span>
                  <span className="text-xs text-slate-500 font-medium">
                    Giám sát lưu mẫu thực phẩm
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column (6 cols): Interactive Bento UI Preview */}
            <div className="lg:col-span-6">
              <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-900/5 p-5 sm:p-6 space-y-4">
                {/* Preview Top Header */}
                <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center">
                      <UtensilsCrossed className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        Bảng Điều Phối Bán Trú Hôm Nay
                      </span>
                      <span className="text-[11px] text-slate-500 block">{schoolName}</span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Đang vận hành
                  </span>
                </div>

                {/* Top 2 Metric Mini-Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600">Năng lượng thực đơn</span>
                      <Flame className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-black text-slate-900">735</span>
                      <span className="text-xs font-bold text-slate-500">kcal / ngày</span>
                    </div>
                    <span className="inline-block text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                      Đạt chuẩn khuyến nghị mẫu giáo
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-rose-50/50 border border-rose-200/70 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-900">Cảnh báo khay dị ứng</span>
                      <BellRing className="w-4 h-4 text-rose-600" />
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-black text-rose-600">13</span>
                      <span className="text-xs font-bold text-rose-800">khay suất riêng</span>
                    </div>
                    <span className="inline-block text-[11px] font-semibold text-rose-700 bg-white px-2 py-0.5 rounded-md border border-rose-200">
                      Đã tách món thay thế an toàn
                    </span>
                  </div>
                </div>

                {/* Nutrition Balance Bar Card */}
                <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">
                      Cơ cấu Đạm · Chất béo · Bột đường
                    </span>
                    <span className="text-teal-700 font-bold">Cân đối chuẩn</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5 text-xs">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/70">
                      <span className="text-[11px] text-slate-500 block">Chất đạm</span>
                      <strong className="text-sm font-black text-emerald-700">15.2%</strong>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div className="bg-emerald-500 h-full w-3/4" />
                      </div>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/70">
                      <span className="text-[11px] text-slate-500 block">Chất béo</span>
                      <strong className="text-sm font-black text-amber-600">26.4%</strong>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div className="bg-amber-500 h-full w-4/5" />
                      </div>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/70">
                      <span className="text-[11px] text-slate-500 block">Bột đường</span>
                      <strong className="text-sm font-black text-blue-600">58.4%</strong>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div className="bg-blue-500 h-full w-5/6" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Status Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-teal-600" />
                    Kiểm thực 3 bước & Lưu mẫu 24 giờ hoàn tất
                  </span>
                  <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg">
                    Đồng bộ cổng Phụ huynh
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. QUY CHUẨN CHUYÊN MÔN & AN TOÀN THỰC PHẨM
      ───────────────────────────────────────────────────────────── */}
      <section id="standards" className="py-16 bg-[#f8fafc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-2xl space-y-2">
            <span className="text-xs font-bold text-teal-700 uppercase tracking-wider">
              Quy chuẩn vận hành
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Chuẩn Hóa Toàn Bộ Quy Trình Dinh Dưỡng & An Toàn Thực Phẩm
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: FileCheck,
                color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                title: 'Cân Đối Dinh Dưỡng Mầm Non',
                desc: 'Đảm bảo năng lượng tại trường đạt chuẩn theo từng nhóm tuổi Nhà trẻ và Mẫu giáo, cân đối tỷ lệ chất đạm, chất béo và bột đường.',
              },
              {
                icon: ShieldCheck,
                color: 'bg-amber-50 text-amber-700 border-amber-200',
                title: 'Kiểm Thực 3 Bước & Lưu Mẫu',
                desc: 'Số hóa sổ kiểm tra nguyên liệu đầu vào, quá trình chế biến và trước khi chia thức ăn kèm quản lý mẫu lưu 24 giờ có niêm phong.',
              },
              {
                icon: TrendingUp,
                color: 'bg-sky-50 text-sky-700 border-sky-200',
                title: 'Theo Dõi Thể Chất & Tăng Trưởng',
                desc: 'Đánh giá chiều cao, cân nặng và chỉ số khối cơ thể định kỳ theo chuẩn tăng trưởng, tự động cảnh báo trẻ suy dinh dưỡng hoặc thừa cân.',
              },
              {
                icon: CreditCard,
                color: 'bg-teal-50 text-teal-700 border-teal-200',
                title: 'Thanh Toán & Biên Lai Điện Tử',
                desc: 'Tích hợp thanh toán trực tuyến qua cổng VNPAY, tự động mở lịch ăn xế và cấp biên lai điện tử minh bạch cho phụ huynh.',
              },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition space-y-3"
                >
                  <div
                    className={`w-11 h-11 rounded-xl border flex items-center justify-center ${item.color}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. QUY TRÌNH KHÉP KÍN 6 BƯỚC
      ───────────────────────────────────────────────────────────── */}
      <section id="workflow" className="py-16 bg-white border-t border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-2xl space-y-2">
            <span className="text-xs font-bold text-teal-700 uppercase tracking-wider">
              Luồng dữ liệu liên thông
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              6 Bước Vận Hành Bán Trú Khép Kín Hằng Ngày
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            {[
              {
                step: '01',
                title: 'Lập thực đơn tuần',
                desc: 'Chuyên viên dinh dưỡng xây dựng thực đơn và món thay thế cho trẻ dị ứng.',
              },
              {
                step: '02',
                title: 'BGH phê duyệt',
                desc: 'Hiệu trưởng kiểm duyệt và công bố thực đơn chính thức trên toàn trường.',
              },
              {
                step: '03',
                title: 'Chốt sĩ số lớp',
                desc: 'Giáo viên điểm danh học sinh có mặt và gửi ghi chú ăn riêng đầu giờ sáng.',
              },
              {
                step: '04',
                title: 'Bếp chia khay ăn',
                desc: 'Bếp nhận định lượng suất ăn thực tế và in tem dán khay riêng cho trẻ dị ứng.',
              },
              {
                step: '05',
                title: 'Kiểm thực & Lưu mẫu',
                desc: 'Thực hiện kiểm thực 3 bước và niêm phong mẫu thức ăn lưu trữ đủ 24 giờ.',
              },
              {
                step: '06',
                title: 'Phụ huynh theo dõi',
                desc: 'Phụ huynh xem bữa ăn của con, gửi ý kiến phản hồi và thanh toán phí ăn xế.',
              },
            ].map((w) => (
              <div
                key={w.step}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 hover:border-teal-400 transition"
              >
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-teal-700 text-white font-black text-xs">
                  {w.step}
                </span>
                <h4 className="text-xs font-bold text-slate-900">{w.title}</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">{w.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. FOOTER
      ───────────────────────────────────────────────────────────── */}
      <footer id="contact" className="bg-slate-900 text-slate-400 text-xs py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-8 border-b border-slate-800">
            <div className="md:col-span-6 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-600 flex items-center justify-center text-white">
                  <UtensilsCrossed className="w-4 h-4" />
                </div>
                <span className="text-lg font-black text-white">
                  KidMeal · {schoolName}
                </span>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed max-w-md">
                Hệ thống quản lý thực đơn, dinh dưỡng, an toàn thực phẩm bán trú và sổ liên lạc bữa
                ăn dành cho trường mầm non.
              </p>
            </div>

            <div className="md:col-span-6 space-y-2.5">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Thông Tin Liên Hệ Trường
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                  <span>
                    {schoolBranding.address ||
                      '182 Nguyễn Đình Chiểu, Phường Võ Thị Sáu, Quận 3, TP. Hồ Chí Minh'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span>Hotline: {schoolBranding.phone || '028-3930-1888'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span>Hoạt động: Thứ Hai – Thứ Sáu hằng tuần</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>
              © {new Date().getFullYear()} {schoolName} · Hệ thống KidMeal.
            </span>
            <span>Bảo mật dữ liệu học sinh & an toàn thực phẩm học đường</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
