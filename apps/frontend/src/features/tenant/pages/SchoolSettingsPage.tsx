import { getLocale, t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Building2,
  CheckCircle2,
  MapPin,
  Phone,
  Mail,
  Globe,
  Edit3,
  AlertTriangle,
  RotateCw,
  UploadCloud,
  Trash2,
  Users,
  GraduationCap,
  UserCheck,
  ShieldCheck,
  Settings,
  Loader2,
  Clock,
  Utensils,
  Save,
  Image as ImageIcon,
  Calendar,
  Smartphone,
  RefreshCw,
} from "lucide-react";
import {
  tenantApi,
  TenantProfile,
  SchoolBranding,
  OperationalSettings,
} from "../../../core/api/tenant.api";
import { EditSchoolInfoModal } from "../components/EditSchoolInfoModal";

const MEAL_TIME_OPTIONS = [
  { code: "BREAKFAST", label: "Buổi sáng (09:00)" },
  { code: "LUNCH", label: "Bữa trưa chính (11:00)" },
  { code: "AFTERNOON_SNACK", label: "Bữa xế chiều (14:30)" },
];

const COLOR_OPTIONS: Array<{
  code: "TEAL" | "YELLOW" | "ORANGE";
  label: string;
  dot: string;
}> = [
  { code: "TEAL", label: "Xanh Ngọc", dot: "bg-teal-600" },
  { code: "YELLOW", label: "Vàng Mật", dot: "bg-amber-500" },
  { code: "ORANGE", label: "Cam San", dot: "bg-orange-500" },
];

const DEFAULT_OPERATIONAL: OperationalSettings = {
  mealTimes: ["BREAKFAST", "LUNCH", "AFTERNOON_SNACK"],
  standardWeeklyCycleLength: 2,
  foodRetentionHours: 24,
  whoZscoreAutoCalc: true,
};

function formatDateVi(dateStr?: string | null): string {
  if (!dateStr) return "Chưa cập nhật";
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime())
    ? dateStr
    : parsed.toLocaleDateString(getLocale(), {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
}

function getLicenseStatus(number?: string, expiryDate?: string) {
  if (!number && !expiryDate) {
    return {
      label: "Chưa khai báo",
      className: "bg-slate-100 text-slate-600 border-slate-200",
    };
  }
  const exp = expiryDate ? new Date(expiryDate) : null;
  if (!exp || Number.isNaN(exp.getTime())) {
    return {
      label: "Đã khai báo",
      className: "bg-teal-50 text-teal-700 border-teal-200",
    };
  }
  const diffDays = Math.ceil((exp.getTime() - Date.now()) / 86400000);
  if (diffDays < 0) {
    return {
      label: "Đã hết hạn",
      className: "bg-red-50 text-red-700 border-red-200",
    };
  }
  if (diffDays <= 30) {
    return {
      label: `Sắp hết hạn (còn ${diffDays} ngày)`,
      className: "bg-amber-50 text-amber-700 border-amber-200",
    };
  }
  return {
    label: "Còn hiệu lực",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
}

export const SchoolSettingsPage: React.FC = () => {
  useLanguage();
  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [syncingDb, setSyncingDb] = useState(false);

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoSuccessMessage, setLogoSuccessMessage] = useState<string | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [operational, setOperational] =
    useState<OperationalSettings>(DEFAULT_OPERATIONAL);
  const [savingOperational, setSavingOperational] = useState(false);
  const [operationalFeedback, setOperationalFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const applyProfileState = useCallback((data: TenantProfile) => {
    setProfile(data);
    if (data.name) {
      localStorage.setItem("school_name", data.name);
      document.title = `${data.name} · KidMeal`;
    }
    const logoUrl = data.branding?.logoUrl || "";
    localStorage.setItem("school_logo", logoUrl);
    if (data.phone) localStorage.setItem("school_phone", data.phone);
    if (data.address) localStorage.setItem("school_address", data.address);
    if (data.contactEmail) localStorage.setItem("school_email", data.contactEmail);
    if (data.branding?.primaryColor) localStorage.setItem("school_primary_color", data.branding.primaryColor);

    if (logoUrl) {
      let favicon = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!favicon) {
        favicon = document.createElement("link");
        favicon.rel = "icon";
        document.getElementsByTagName("head")[0].appendChild(favicon);
      }
      favicon.href = logoUrl;
    }

    if (data.operationalSettings) {
      setOperational({
        mealTimes: data.operationalSettings.mealTimes?.length
          ? data.operationalSettings.mealTimes
          : DEFAULT_OPERATIONAL.mealTimes,
        standardWeeklyCycleLength:
          Number(data.operationalSettings.standardWeeklyCycleLength) ||
          DEFAULT_OPERATIONAL.standardWeeklyCycleLength,
        foodRetentionHours:
          Number(data.operationalSettings.foodRetentionHours) ||
          DEFAULT_OPERATIONAL.foodRetentionHours,
        whoZscoreAutoCalc: Boolean(
          data.operationalSettings.whoZscoreAutoCalc ??
          DEFAULT_OPERATIONAL.whoZscoreAutoCalc,
        ),
      });
    }
    window.dispatchEvent(
      new CustomEvent("tenant-profile-updated", { detail: data }),
    );
    window.dispatchEvent(
      new CustomEvent("school-branding-updated", { detail: data }),
    );
    window.dispatchEvent(new Event("storage"));
  }, []);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await tenantApi.getProfile();
      applyProfileState(data);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setLoadError(
        Array.isArray(msg)
          ? msg.join(", ")
          : msg || "Không thể tải cấu hình trường học từ máy chủ.",
      );
    } finally {
      setLoading(false);
    }
  }, [applyProfileState]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSyncEducationDb = async () => {
    setSyncingDb(true);
    try {
      const res = await tenantApi.syncEducationDb();
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              isEducationDbSynced: true,
              syncedAt: res.syncedAt || new Date().toISOString(),
            }
          : prev,
      );
      setLogoSuccessMessage(
        res.message || "Đã đồng bộ dữ liệu với CSDL ngành GD&ĐT.",
      );
    } catch (err: any) {
      setUploadError(
        err?.response?.data?.message || "Không thể đồng bộ CSDL ngành.",
      );
    } finally {
      setSyncingDb(false);
    }
  };

  const handleColorChange = async (
    primaryColor: "TEAL" | "YELLOW" | "ORANGE",
  ) => {
    if (!profile) return;
    try {
      const updated = await tenantApi.updateProfile({
        branding: { ...profile.branding, primaryColor },
      });
      applyProfileState(updated);
    } catch {}
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setLogoSuccessMessage(null);
    const validTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/svg+xml",
      "image/webp",
    ];
    if (!validTypes.includes(file.type)) {
      setUploadError(
        `Tệp "${file.name}" không đúng định dạng. Vui lòng chọn PNG, JPG, WEBP hoặc SVG.`,
      );
      e.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError(`Tệp "${file.name}" vượt quá giới hạn 2MB.`);
      e.target.value = "";
      return;
    }

    setUploadError(null);
    setUploadingLogo(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = (ev.target?.result as string) || "";
      try {
        await tenantApi.uploadLogo({
          fileName: file.name,
          fileSizeBytes: file.size,
          mimeType: file.type,
          fileContentBase64: dataUrl,
        });
        const refreshed = await tenantApi.getProfile();
        applyProfileState(refreshed);
        setLogoSuccessMessage("Đã lưu logo trường học vào cơ sở dữ liệu.");
      } catch (err: any) {
        setUploadError(
          err?.response?.data?.message || "Không thể lưu logo lên máy chủ.",
        );
      } finally {
        setUploadingLogo(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    if (!profile) return;
    setUploadingLogo(true);
    setUploadError(null);
    setLogoSuccessMessage(null);
    try {
      const emptyBranding: SchoolBranding = {
        primaryColor: profile.branding?.primaryColor || "TEAL",
        logoUrl: "",
        logoName: "",
        logoSize: "",
      };
      const updated = await tenantApi.updateProfile({
        logo: "",
        branding: emptyBranding,
      });
      applyProfileState(updated);
      setLogoSuccessMessage("Đã xóa logo nhận diện trường học.");
    } catch (err: any) {
      setUploadError(
        err?.response?.data?.message || "Không thể xóa logo trường học.",
      );
    } finally {
      setUploadingLogo(false);
    }
  };

  const toggleMealTime = (code: string) => {
    setOperationalFeedback(null);
    setOperational((prev) => {
      const exists = prev.mealTimes.includes(code);
      if (exists && prev.mealTimes.length <= 1) return prev;
      return {
        ...prev,
        mealTimes: exists
          ? prev.mealTimes.filter((m) => m !== code)
          : [...prev.mealTimes, code],
      };
    });
  };

  const handleSaveOperationalSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingOperational(true);
    setOperationalFeedback(null);
    try {
      const updated = await tenantApi.updateProfile({
        operationalSettings: operational,
      });
      applyProfileState(updated);
      setOperationalFeedback({
        type: "success",
        text: "Đã lưu cấu hình vận hành bán trú vào cơ sở dữ liệu.",
      });
    } catch (err: any) {
      setOperationalFeedback({
        type: "error",
        text:
          err?.response?.data?.message ||
          "Có lỗi xảy ra khi lưu cấu hình vận hành bán trú.",
      });
    } finally {
      setSavingOperational(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center text-slate-500 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        <p className="text-xs font-medium">{translateText("Đang tải thông tin trường học từ cơ sở dữ liệu...")}</p>
      </div>
    );
  }

  if (loadError || !profile) {
    return (
      <div className="max-w-3xl mx-auto my-12 bg-white rounded-3xl p-8 border border-red-200 shadow-xs text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900">{translateText("Không thể tải dữ liệu Cấu hình trường học")}</h2>
          <p className="text-xs text-slate-500 mt-1">{translateText(loadError)}</p>
        </div>
        <button
          onClick={fetchProfile}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white transition"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>{translateText("Thử tải lại")}</span>
        </button>
      </div>
    );
  }

  const licenseStatus = getLicenseStatus(
    profile.foodSafetyLicense?.number,
    profile.foodSafetyLicense?.expiryDate,
  );
  const hasRealLogo = Boolean(profile.branding?.logoUrl?.trim());
  const kpiCards = [
    {
      icon: Users,
      color: "bg-teal-50 text-teal-700 border-teal-100",
      label: "Quy mô học sinh bán trú",
      value: `${profile.stats?.totalChildren ?? 0}`,
      suffix:
        profile.maxChildren == null
          ? "học sinh · Chưa cấu hình chỉ tiêu"
          : `/ ${profile.maxChildren} chỉ tiêu`,
    },
    {
      icon: GraduationCap,
      color: "bg-emerald-50 text-emerald-700 border-emerald-100",
      label: "Lớp học đang vận hành",
      value: `${profile.stats?.totalClasses ?? 0}`,
      suffix: "lớp học",
    },
    {
      icon: UserCheck,
      color: "bg-sky-50 text-sky-700 border-sky-100",
      label: "Nhân sự & Giáo viên",
      value: `${profile.stats?.totalStaff ?? 0}`,
      suffix: "tài khoản hoạt động",
    },
    {
      icon: ShieldCheck,
      color: "bg-amber-50 text-amber-700 border-amber-100",
      label: profile.legalRepresentative?.title || "Người đại diện pháp lý",
      value: profile.legalRepresentative?.name || "Chưa cập nhật",
      suffix: "",
    },
  ];

  return (
    <>
    <div className="w-full space-y-6 pb-12">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
              <span className="w-2 h-2 rounded-full bg-teal-600" />
              {translateText(profile.status === "ACTIVE" ? "ĐANG HOẠT ĐỘNG" : profile.status)}
            </span>
            <span className="text-xs text-slate-500 font-mono bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">{translateText("Mã trường: ")}{translateText(profile.code)}
            </span>
            {profile.isEducationDbSynced && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" />{translateText(" Đã đồng bộ CSDL Bộ GD&ĐT")}</span>
            )}
            {profile.updatedAt && (
              <span className="text-[11px] text-slate-400">{translateText("Cập nhật: ")}{translateText(formatDateVi(profile.updatedAt))}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            {profile.name}
          </h1>
          <p className="text-xs text-slate-500 mt-1">{translateText("Cấu hình thông tin pháp lý nhà trường, giấy phép An toàn thực phẩm (ATTP), logo nhận diện và thông số vận hành bán trú.")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleSyncEducationDb}
            disabled={syncingDb}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs transition"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-teal-600 ${syncingDb ? "animate-spin" : ""}`}
            />
            <span>{translateText("Đồng bộ CSDL Ngành")}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/25 transition"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{translateText("Chỉnh sửa thông tin trường")}</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5"
            >
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center border shrink-0 ${card.color}`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <p className="text-[11px] text-slate-500 font-medium truncate">
                  {translateText(card.label)}
                </p>
                <p className="text-base font-black text-slate-900 truncate">
                  {translateText(card.value)}{" "}
                  {card.suffix && (
                    <span className="text-xs font-semibold text-slate-400">
                      {translateText(card.suffix)}
                    </span>
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Main 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7/12): School Info & Legal */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">{translateText("Hồ sơ cơ sở giáo dục & Pháp lý ATTP")}</h2>
                  <p className="text-xs text-slate-500">{translateText("Thông tin chính thức hiển thị trên thực đơn tuần, sổ kiểm thực 3 bước và báo cáo dinh dưỡng")}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200 transition shrink-0"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{translateText("Sửa hồ sơ")}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">{translateText("Tên trường mầm non")}</label>
                <div className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900">
                  {profile.name || translateText("Chưa cập nhật")}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">{translateText("Mã trường trên hệ thống")}</label>
                <div className="w-full text-xs font-mono font-semibold px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800">
                  {translateText(profile.code || "Chưa cập nhật")}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">{translateText("Địa chỉ cơ sở trường")}</label>
              <div className="relative">
                <div className="w-full text-xs font-medium px-3.5 py-2.5 pl-9 rounded-xl border border-slate-200 bg-slate-50 text-slate-800">
                  {profile.address || translateText("Chưa cập nhật địa chỉ")}
                </div>
                <MapPin className="w-4 h-4 text-teal-600 absolute left-3 top-2.5" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">{translateText("Số điện thoại / Hotline")}</label>
                <div className="relative">
                  <div className="w-full text-xs font-medium px-3.5 py-2.5 pl-9 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 truncate">
                    {profile.phone || translateText("Chưa cập nhật")}
                  </div>
                  <Phone className="w-4 h-4 text-teal-600 absolute left-3 top-2.5" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">{translateText("Email liên hệ")}</label>
                <div className="relative">
                  <div className="w-full text-xs font-medium px-3.5 py-2.5 pl-9 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 truncate">
                    {profile.contactEmail || translateText("Chưa cập nhật")}
                  </div>
                  <Mail className="w-4 h-4 text-teal-600 absolute left-3 top-2.5" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">{translateText("Website / Tên miền")}</label>
                <div className="relative">
                  <div className="w-full text-xs font-medium px-3.5 py-2.5 pl-9 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 truncate">
                    {translateText(profile.domain || "Chưa thiết lập")}
                  </div>
                  <Globe className="w-4 h-4 text-teal-600 absolute left-3 top-2.5" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">{translateText("Mã Phòng / Sở GD&ĐT")}</label>
                <div className="w-full text-xs font-mono px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
                  {profile.educationDepartmentCode || translateText("Chưa khai báo")}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">{translateText("Mã định danh CSDL Ngành (Bộ GD&ĐT)")}</label>
                <div className="w-full text-xs font-mono px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
                  {translateText(profile.schoolIdentifierSgd || "Chưa khai báo")}
                </div>
              </div>
            </div>

            {/* ATTP Block */}
            <div className="rounded-2xl border border-sky-200/90 bg-sky-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-sky-700" />
                  <h3 className="text-xs font-bold text-sky-950">{translateText("Giấy chứng nhận Cơ sở đủ điều kiện An toàn thực phẩm (ATTP)")}</h3>
                </div>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${licenseStatus.className}`}
                >
                  {translateText(licenseStatus.label)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                <div className="bg-white/90 rounded-xl p-2.5 border border-sky-100">
                  <span className="text-[10px] text-slate-400 font-semibold block">{translateText("Số giấy chứng nhận")}</span>
                  <span className="text-xs font-bold text-slate-900 mt-0.5 block">
                    {translateText(profile.foodSafetyLicense?.number || "Chưa cập nhật")}
                  </span>
                </div>
                <div className="bg-white/90 rounded-xl p-2.5 border border-sky-100">
                  <span className="text-[10px] text-slate-400 font-semibold block">{translateText("Cơ quan cấp")}</span>
                  <span className="text-xs font-semibold text-slate-800 mt-0.5 block truncate">
                    {translateText(profile.foodSafetyLicense?.issuingAuthority ||
                      "Chưa cập nhật")}
                  </span>
                </div>
                <div className="bg-white/90 rounded-xl p-2.5 border border-sky-100">
                  <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-sky-600" />{translateText(" Ngày cấp")}</span>
                  <span className="text-xs font-mono font-semibold text-slate-800 mt-0.5 block">
                    {translateText(formatDateVi(profile.foodSafetyLicense?.issueDate))}
                  </span>
                </div>
                <div className="bg-white/90 rounded-xl p-2.5 border border-sky-100">
                  <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-sky-600" />{translateText(" Ngày hết hạn")}</span>
                  <span className="text-xs font-mono font-bold text-slate-900 mt-0.5 block">
                    {translateText(formatDateVi(profile.foodSafetyLicense?.expiryDate))}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-5 mt-6 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">{translateText("Đại diện pháp lý ký duyệt thực đơn:")}</span>
              <span className="font-bold text-slate-900">
                {translateText(profile.legalRepresentative?.title || "Hiệu trưởng")}{" "}
                {profile.legalRepresentative?.name || translateText("(Chưa cập nhật)")}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800 hover:bg-teal-50 px-3 py-1.5 rounded-xl transition"
            >
              <span>{translateText("Chỉnh sửa thông tin")}</span>
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Column (5/12): Logo & Operational Settings */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">{translateText("Logo & Nhận diện trường học")}</h2>
                  <p className="text-xs text-slate-500">{translateText("Hiển thị trên cổng thông tin, thực đơn và báo cáo")}</p>
                </div>
              </div>
            </div>

            {uploadError && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-red-800">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{translateText(uploadError)}</span>
              </div>
            )}

            {logoSuccessMessage && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center gap-2 text-xs text-emerald-800 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{translateText(logoSuccessMessage)}</span>
              </div>
            )}

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".png,.jpg,.jpeg,.svg,.webp"
              className="hidden"
            />

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5 overflow-hidden">
                <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 p-1.5 flex items-center justify-center shadow-xs shrink-0 overflow-hidden">
                  {hasRealLogo ? (
                    <img
                      src={profile.branding.logoUrl}
                      alt={translateText(profile.name)}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-sm font-black text-teal-700">
                      {(profile.name || "KM")
                        .split(" ")
                        .filter(Boolean)
                        .slice(-2)
                        .map((w) => w[0])
                        .join("")
                        .toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="overflow-hidden">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 truncate">
                      {translateText(hasRealLogo
                        ? profile.branding.logoName || "Logo trường học"
                        : "Chưa tải lên logo trường")}
                    </span>
                    {hasRealLogo && (
                      <span className="bg-teal-50 text-teal-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-teal-200 shrink-0">{translateText("Đã lưu CSDL")}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                    {translateText(hasRealLogo
                      ? profile.branding.logoSize || "Đang sử dụng"
                      : "Hỗ trợ PNG, JPG, WEBP, SVG (≤ 2MB)")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={uploadingLogo}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition disabled:opacity-60"
                >
                  {uploadingLogo ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UploadCloud className="w-3.5 h-3.5" />
                  )}
                  <span>{translateText(hasRealLogo ? "Đổi logo" : "Tải logo lên")}</span>
                </button>
                {hasRealLogo && (
                  <button
                    type="button"
                    disabled={uploadingLogo}
                    onClick={handleRemoveLogo}
                    title={translateText("Xóa logo hiện tại")}
                    className="text-slate-400 hover:text-red-600 p-2 rounded-xl hover:bg-white border border-transparent hover:border-red-200 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Primary Color Selector */}
            <div className="pt-1 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-600">{translateText("Màu nhận diện App Phụ Huynh:")}</span>
              <div className="flex items-center gap-1.5">
                {COLOR_OPTIONS.map((c) => {
                  const active =
                    (profile.branding?.primaryColor || "TEAL") === c.code;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => handleColorChange(c.code)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1.5 border transition ${
                        active
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                      <span>{translateText(c.label)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSaveOperationalSettings}
            className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                <Settings className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">{translateText("Cấu hình vận hành bán trú")}</h2>
                <p className="text-xs text-slate-500">{translateText("Thông số áp dụng cho lập thực đơn, lưu mẫu thức ăn và đánh giá dinh dưỡng")}</p>
              </div>
            </div>

            {operationalFeedback && (
              <div
                className={`p-3 rounded-2xl text-xs font-medium flex items-center gap-2 border ${
                  operationalFeedback.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-red-50 text-red-800 border-red-200"
                }`}
              >
                {operationalFeedback.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{translateText(operationalFeedback.text)}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-teal-600" />{translateText(" Các bữa ăn tổ chức tại trường")}</label>
              <div className="grid grid-cols-2 gap-2">
                {MEAL_TIME_OPTIONS.map((meal) => {
                  const active = operational.mealTimes.includes(meal.code);
                  return (
                    <button
                      key={meal.code}
                      type="button"
                      onClick={() => toggleMealTime(meal.code)}
                      className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between transition ${
                        active
                          ? "bg-teal-50/80 border-teal-600 text-teal-900"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <span>{translateText(meal.label)}</span>
                      <span
                        className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] ${
                          active
                            ? "bg-teal-600 text-white"
                            : "bg-white border border-slate-300 text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-teal-600" />{translateText(" Chu kỳ xoay vòng thực đơn")}</label>
                <select
                  value={operational.standardWeeklyCycleLength}
                  onChange={(e) => {
                    setOperationalFeedback(null);
                    setOperational((p) => ({
                      ...p,
                      standardWeeklyCycleLength: Number(e.target.value),
                    }));
                  }}
                  className="w-full text-xs font-medium px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none"
                >
                  <option value={1}>{translateText("Chu kỳ 1 tuần")}</option>
                  <option value={2}>{translateText("Chu kỳ 2 tuần (Khuyến nghị)")}</option>
                  <option value={4}>{translateText("Chu kỳ 4 tuần (Theo tháng)")}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-teal-600" />{translateText(" Thời gian lưu mẫu thức ăn")}</label>
                <select
                  value={operational.foodRetentionHours}
                  onChange={(e) => {
                    setOperationalFeedback(null);
                    setOperational((p) => ({
                      ...p,
                      foodRetentionHours: Number(e.target.value),
                    }));
                  }}
                  className="w-full text-xs font-medium px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none"
                >
                  <option value={24}>{translateText("24 giờ (QĐ 1246/QĐ-BYT)")}</option>
                  <option value={48}>{translateText("48 giờ (Kiểm soát nâng cao)")}</option>
                  <option value={72}>{translateText("72 giờ")}</option>
                </select>
              </div>
            </div>

            <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
              <div className="pr-3">
                <span className="text-xs font-bold text-slate-800 block">{translateText("Tự động phân loại dinh dưỡng theo chuẩn WHO Z-Score")}</span>
                <span className="text-[11px] text-slate-500">{translateText("Tự động tính WAZ, HAZ, BAZ khi giáo viên nhập cân nặng và chiều cao định kỳ")}</span>
              </div>
              <input
                type="checkbox"
                checked={operational.whoZscoreAutoCalc}
                onChange={(e) => {
                  setOperationalFeedback(null);
                  setOperational((p) => ({
                    ...p,
                    whoZscoreAutoCalc: e.target.checked,
                  }));
                }}
                className="w-4 h-4 accent-teal-600 rounded cursor-pointer shrink-0"
              />
            </label>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingOperational}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition disabled:opacity-60"
              >
                {savingOperational ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>{translateText("Lưu cấu hình vận hành")}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

      <EditSchoolInfoModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        profile={profile}
        onSaved={applyProfileState}
      />
    </>
  );
};
