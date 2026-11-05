import React, { useState, useEffect } from "react";
import {
  X,
  UserPlus,
  UserCheck,
  Mail,
  Phone,
  Lock,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  ChefHat,
  GraduationCap,
  HeartPulse,
  Apple,
  AlertCircle,
  Eye,
  Edit3,
  Calendar,
  Clock,
} from "lucide-react";
import {
  StaffUser,
  StaffRole,
  CreateStaffPayload,
  UpdateStaffPayload,
} from "../api/staff.api";

interface StaffDrawerProps {
  isOpen: boolean;
  mode?: "create" | "edit" | "view";
  staff: StaffUser | null;
  availableRoles: StaffRole[];
  isLoading: boolean;
  onClose: () => void;
  onSwitchToEdit?: () => void;
  onSubmit: (
    payload: CreateStaffPayload | UpdateStaffPayload,
    staffId?: string,
  ) => Promise<void>;
}

export const ROLE_META: Record<
  string,
  { icon: any; label: string; color: string; pill: string; desc: string }
> = {
  PRINCIPAL: {
    icon: ShieldCheck,
    label: "Ban Giám Hiệu",
    color: "border-amber-500 bg-amber-50 text-amber-800",
    pill: "bg-amber-50 text-amber-800 border-amber-200",
    desc: "Quản trị toàn trường, phê duyệt thực đơn & tài chính",
  },
  SCHOOL_MANAGER: {
    icon: ShieldCheck,
    label: "Quản Lý Trường",
    color: "border-amber-500 bg-amber-50 text-amber-800",
    pill: "bg-amber-50 text-amber-800 border-amber-200",
    desc: "Điều hành hoạt động trường mầm non & nhân sự",
  },
  NUTRITIONIST: {
    icon: Apple,
    label: "Chuyên Viên Dinh Dưỡng",
    color: "border-teal-500 bg-teal-50 text-teal-800",
    pill: "bg-teal-50 text-teal-800 border-teal-200",
    desc: "Xây dựng thực đơn, cân đối P:L:G theo chuẩn Bộ GD&ĐT",
  },
  KITCHEN_MANAGER: {
    icon: ChefHat,
    label: "Bếp Trưởng / Quản Lý Bếp",
    color: "border-orange-500 bg-orange-50 text-orange-800",
    pill: "bg-orange-50 text-orange-800 border-orange-200",
    desc: "Tiếp nhận nguyên liệu, kiểm thực 3 bước, lưu mẫu 24h",
  },
  KITCHEN_STAFF: {
    icon: ChefHat,
    label: "Nhân Viên Bếp",
    color: "border-orange-500 bg-orange-50 text-orange-800",
    pill: "bg-orange-50 text-orange-800 border-orange-200",
    desc: "Chế biến suất ăn bán trú, chia khẩu phần theo lớp",
  },
  TEACHER: {
    icon: GraduationCap,
    label: "Giáo Viên Chủ Nhiệm",
    color: "border-blue-500 bg-blue-50 text-blue-800",
    pill: "bg-blue-50 text-blue-800 border-blue-200",
    desc: "Điểm danh suất ăn, báo cáo mức độ ăn của trẻ trên tablet",
  },
  MEDICAL_STAFF: {
    icon: HeartPulse,
    label: "Cán Bộ Y Tế Học Đường",
    color: "border-rose-500 bg-rose-50 text-rose-800",
    pill: "bg-rose-50 text-rose-800 border-rose-200",
    desc: "Theo dõi dị ứng khẩn cấp, biểu đồ WHO và vệ sinh",
  },
};

function generateSecurePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let res = "";
  for (const value of crypto.getRandomValues(new Uint32Array(16)))
    res += chars.charAt(value % chars.length);
  return res;
}

export const StaffDrawer: React.FC<StaffDrawerProps> = ({
  isOpen,
  mode,
  staff,
  availableRoles,
  isLoading,
  onClose,
  onSwitchToEdit,
  onSubmit,
}) => {
  const activeMode = mode || (staff ? "edit" : "create");
  const isViewMode = activeMode === "view";
  const isEditMode = activeMode === "edit";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedRoleCodes, setSelectedRoleCodes] = useState<string[]>([
    "TEACHER",
  ]);
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [password, setPassword] = useState("");
  const [copiedPass, setCopiedPass] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);
    if (staff) {
      setFullName(staff.fullName || "");
      setEmail(staff.email || "");
      setPhone(staff.phone || "");
      setSelectedRoleCodes(
        staff.roles?.length ? staff.roles.map((r) => r.code) : ["TEACHER"],
      );
      setStatus(staff.status === "ACTIVE" ? "ACTIVE" : "INACTIVE");
      setPassword("");
    } else {
      setFullName("");
      setEmail("");
      setPhone("");
      setSelectedRoleCodes(["TEACHER"]);
      setStatus("ACTIVE");
      setPassword(generateSecurePassword());
    }
  }, [isOpen, staff, activeMode]);

  if (!isOpen) return null;

  const handleToggleRole = (code: string) => {
    if (isViewMode) return;
    if (selectedRoleCodes.includes(code)) {
      if (selectedRoleCodes.length === 1) {
        setErrorMessage("Nhân sự phải có ít nhất 1 vai trò chuyên môn.");
        return;
      }
      setSelectedRoleCodes(selectedRoleCodes.filter((c) => c !== code));
    } else {
      setSelectedRoleCodes([...selectedRoleCodes, code]);
    }
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode) return;
    setErrorMessage(null);

    if (!fullName.trim())
      return setErrorMessage("Vui lòng nhập họ và tên nhân sự.");
    if (!isEditMode && !email.trim())
      return setErrorMessage("Vui lòng nhập địa chỉ email công việc.");
    if (!selectedRoleCodes.length)
      return setErrorMessage("Vui lòng chọn ít nhất một vai trò chuyên môn.");

    try {
      if (isEditMode && staff) {
        await onSubmit(
          {
            fullName: fullName.trim(),
            phone: phone.trim() || undefined,
            roleCodes: selectedRoleCodes,
            status,
            newPassword: password.trim() || undefined,
          },
          staff.id,
        );
      } else {
        await onSubmit({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          roleCodes: selectedRoleCodes,
          status,
          password: password.trim() || undefined,
        });
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Có lỗi xảy ra khi lưu thông tin.";
      setErrorMessage(Array.isArray(msg) ? msg.join(", ") : String(msg));
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-lg w-full bg-white shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-600 flex items-center justify-center">
              {isViewMode ? (
                <Eye className="w-5 h-5" />
              ) : isEditMode ? (
                <UserCheck className="w-5 h-5" />
              ) : (
                <UserPlus className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                {isViewMode
                  ? "Chi Tiết Hồ Sơ Nhân Sự"
                  : isEditMode
                    ? "Chỉnh Sửa Thông Tin Nhân Sự"
                    : "Thêm Nhân Sự Mới"}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                {isViewMode
                  ? "Thông tin định danh, quyền hạn và lịch sử hoạt động (UC08)"
                  : isEditMode
                    ? "Cập nhật vai trò chuyên môn và quyền hạn nhân viên (UC10)"
                    : "Tạo tài khoản và phân quyền chức năng trong trường (UC09)"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form
          id="staff-drawer-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-6"
        >
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isViewMode && staff && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">
                  Ngày tham gia
                </span>
                <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-teal-600" />
                  {new Date(staff.createdAt).toLocaleDateString("vi-VN")}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">
                  Đăng nhập gần nhất
                </span>
                <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-teal-600" />
                  {staff.lastLoginAt
                    ? new Date(staff.lastLoginAt).toLocaleString("vi-VN")
                    : "Chưa đăng nhập"}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Thông Tin Định Danh
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Họ và tên nhân sự{" "}
                {!isViewMode && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                required
                disabled={isViewMode}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ví dụ: Cô Nguyễn Thị Hoa"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm disabled:bg-slate-50 disabled:text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Email công việc{" "}
                {!isViewMode && <span className="text-red-500">*</span>}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  disabled={isEditMode || isViewMode}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="giaovien@saomai.edu.vn"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Số điện thoại liên lạc
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  disabled={isViewMode}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ví dụ: 0903111222"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm disabled:bg-slate-50 disabled:text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>

          {/* Roles */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Vai Trò & Chức Năng
              </h3>
              <span className="text-[11px] text-teal-600 font-semibold">
                Đã chọn: {selectedRoleCodes.length} vai trò
              </span>
            </div>

            <div className="space-y-2">
              {availableRoles.map((role) => {
                const cfg = ROLE_META[role.code] || {
                  icon: UserCheck,
                  label: role.name || role.code,
                  color: "border-slate-400 bg-slate-50 text-slate-800",
                  desc: role.description || "Nhân sự nhà trường",
                };
                const Icon = cfg.icon;
                const isSelected = selectedRoleCodes.includes(role.code);

                return (
                  <div
                    key={role.code}
                    onClick={() => handleToggleRole(role.code)}
                    className={`p-3 rounded-2xl border-2 transition-all flex items-start gap-3 ${
                      isViewMode ? "cursor-default" : "cursor-pointer"
                    } ${
                      isSelected
                        ? `${cfg.color} shadow-xs font-semibold`
                        : "border-slate-200/80 bg-white hover:bg-slate-50 text-slate-600"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "bg-white shadow-xs"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">
                          {role.name}
                        </span>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isSelected
                              ? "bg-teal-600 border-teal-600 text-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected && (
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                        {cfg.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status & Password */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Trạng Thái & Bảo Mật
            </h3>

            <div className="grid grid-cols-2 gap-3">
              {(["ACTIVE", "INACTIVE"] as const).map((st) => {
                const active = status === st;
                return (
                  <button
                    key={st}
                    type="button"
                    disabled={isViewMode}
                    onClick={() => setStatus(st)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                      active
                        ? st === "ACTIVE"
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : "border-amber-500 bg-amber-50 text-amber-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${st === "ACTIVE" ? "bg-emerald-500" : "bg-amber-500"}`}
                    />
                    {st === "ACTIVE" ? "Đang hoạt động" : "Tạm khóa tài khoản"}
                  </button>
                );
              })}
            </div>

            {!isViewMode && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    {isEditMode
                      ? "Đặt lại mật khẩu mới (Tùy chọn)"
                      : "Mật khẩu khởi tạo"}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setPassword(generateSecurePassword());
                      setCopiedPass(false);
                    }}
                    className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Sinh ngẫu nhiên
                  </button>
                </div>

                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      isEditMode
                        ? "Để trống nếu không đổi mật khẩu"
                        : "Nhập mật khẩu..."
                    }
                    className="w-full pl-10 pr-24 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  {password && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(password);
                        setCopiedPass(true);
                        setTimeout(() => setCopiedPass(false), 2000);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1"
                    >
                      {copiedPass ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-700">Đã chép</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-500" />
                          <span>Sao chép</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
          >
            Đóng
          </button>
          {isViewMode ? (
            onSwitchToEdit && (
              <button
                type="button"
                onClick={onSwitchToEdit}
                className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/25 transition flex items-center gap-2"
              >
                <Edit3 className="w-4 h-4" />
                <span>Chỉnh sửa nhân sự</span>
              </button>
            )
          ) : (
            <button
              type="submit"
              form="staff-drawer-form"
              disabled={isLoading}
              className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/25 transition flex items-center gap-2"
            >
              {isLoading ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>{isEditMode ? "Lưu Thay Đổi" : "Tạo Tài Khoản"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
