import { t as translateText, getLocale } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  Lock,
  Printer,
  FileSpreadsheet,
  Clock,
  Sparkles,
  AlertCircle,
  User,
  Calendar,
  Layers,
  Search,
  Filter,
  ShieldCheck,
  RotateCcw,
  Eye,
  X,
  ChevronRight,
  Info,
  ShieldAlert,
} from "lucide-react";
import { useAuthStore } from "../../../core/stores/auth.store";
import {
  weeklyMenusApi,
  WeeklyMenu,
  MenuStatistics,
  ExportDataResponse,
} from "../api/weekly-menus.api";
import { MenuStatsCards } from "../components/MenuStatsCards";
import { WeeklyGridTable } from "../components/WeeklyGridTable";
import { ApprovalModal } from "../components/ApprovalModal";
import { PrintPreviewModal } from "../components/PrintPreviewModal";
import { RespondEditRequestModal } from "../components/RespondEditRequestModal";

export const PrincipalMenuApprovalPage: React.FC = () => {
  useLanguage();
  const { user } = useAuthStore();

  // Dữ liệu & Trạng thái tải
  const [menus, setMenus] = useState<WeeklyMenu[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<WeeklyMenu | null>(null);
  const [stats, setStats] = useState<MenuStatistics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Bộ lọc bảng
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL_SUBMITTED");
  const [ageGroupFilter, setAgeGroupFilter] = useState<string>("ALL");

  // Popup Right Slide-over Drawer xem chi tiết
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Modals
  const [isApprovalModalOpen, setIsApprovalModalOpen] =
    useState<boolean>(false);
  const [isRespondEditModalOpen, setIsRespondEditModalOpen] =
    useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [printData, setPrintData] = useState<ExportDataResponse | null>(null);

  const showNotify = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // 1. Tải danh sách thực đơn & Thống kê
  const fetchAllData = async (preferredMenuId?: string) => {
    try {
      setLoading(true);
      const [statsRes, menusRes] = await Promise.all([
        weeklyMenusApi.getStatistics(),
        weeklyMenusApi.getMenus({
          search: searchTerm,
          status: statusFilter,
          targetAgeGroup: ageGroupFilter,
          includeDeleted: false,
          submittedOnly: true,
        }),
      ]);

      const menusListRaw = Array.isArray(menusRes)
        ? menusRes
        : (menusRes as any)?.items || (menusRes as any)?.data || [];
      const menusList = menusListRaw.filter(
        (m: WeeklyMenu) => m.status !== "DRAFT" && Boolean(m.submittedAt),
      );
      setStats(statsRes);
      setMenus(menusList);

      // Ưu tiên chọn:
      // 1. preferredMenuId nếu được chỉ định
      // 2. Thực đơn đang SUBMITTED_FOR_REVIEW (Chờ BGH duyệt)
      // 3. Thực đơn đang APPROVED (Chờ công bố)
      // 4. Thực đơn đang ACTIVE
      // 5. Thực đơn đầu tiên
      let target: WeeklyMenu | undefined;

      if (preferredMenuId) {
        target = menusList.find((m: any) => m.id === preferredMenuId);
      }

      if (!target) {
        target =
          menusList.find(
            (m: any) =>
              m.status === "SUBMITTED_FOR_REVIEW" || m.status === "PENDING",
          ) ||
          menusList.find((m: any) => m.status === "APPROVED") ||
          menusList.find(
            (m: any) => m.status === "ACTIVE" || m.status === "PUBLISHED",
          ) ||
          menusList[0];
      }

      if (target) {
        await handleSelectMenu(target.id, false);
      } else {
        setSelectedMenu(null);
      }
    } catch (err) {
      showNotify("error", "Không thể tải danh sách thực đơn.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [statusFilter, ageGroupFilter]);

  // Tìm kiếm debounce nhẹ
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAllData(selectedMenu?.id);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // 2. Chọn một thực đơn để thẩm định
  const handleSelectMenu = async (
    menuId: string,
    openDrawer: boolean = false,
  ) => {
    try {
      const detail = await weeklyMenusApi.getMenuById(menuId);
      setSelectedMenu(detail);
      if (openDrawer) {
        setIsDrawerOpen(true);
      }
    } catch (err) {
      showNotify("error", "Không thể tải chi tiết thực đơn.");
    }
  };

  // 3. Hiệu trưởng phê duyệt thực đơn
  const handleApprove = async (id: string, notes?: string) => {
    try {
      setActionLoading(true);
      const updated = await weeklyMenusApi.approveMenu(id, notes);
      showNotify("success", `Đã phê duyệt thực đơn: ${updated.title}`);
      await fetchAllData(updated.id);
    } catch (err: any) {
      showNotify(
        "error",
        err?.response?.data?.message || "Không thể phê duyệt thực đơn.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Hiệu trưởng từ chối thực đơn (kèm lý do)
  const handleReject = async (id: string, reason: string) => {
    try {
      setActionLoading(true);
      const updated = await weeklyMenusApi.rejectMenu(id, reason);
      showNotify(
        "success",
        `Đã từ chối thực đơn. Ý kiến chỉ đạo đã được gửi về Chuyên viên Dinh dưỡng.`,
      );
      await fetchAllData(updated.id);
    } catch (err: any) {
      showNotify(
        "error",
        err?.response?.data?.message || "Không thể từ chối thực đơn.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  // 4.1. Hiệu trưởng chấp thuận yêu cầu xin phép chỉnh sửa (mở khóa về DRAFT)
  const handleApproveEditRequest = async (id: string, notes?: string) => {
    try {
      setActionLoading(true);
      const updated = await weeklyMenusApi.approveEditRequest(id, notes);
      showNotify(
        "success",
        `Đã chấp thuận yêu cầu chỉnh sửa cho thực đơn: ${updated.title}. Thực đơn đã mở khóa về Bản dự thảo.`,
      );
      await fetchAllData(updated.id);
    } catch (err: any) {
      showNotify(
        "error",
        err?.response?.data?.message ||
        "Không thể chấp thuận yêu cầu chỉnh sửa.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  // 4.2. Hiệu trưởng từ chối yêu cầu xin phép chỉnh sửa
  const handleRejectEditRequest = async (id: string, reason: string) => {
    try {
      setActionLoading(true);
      const updated = await weeklyMenusApi.rejectEditRequest(id, reason);
      showNotify("success", `Đã từ chối yêu cầu xin chỉnh sửa thực đơn.`);
      await fetchAllData(updated.id);
    } catch (err: any) {
      showNotify(
        "error",
        err?.response?.data?.message || "Không thể từ chối yêu cầu chỉnh sửa.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Hiệu trưởng Khóa & Công bố thực đơn toàn trường
  const handlePublish = async (menuId?: string) => {
    const target = menuId
      ? menus.find((menu) => menu.id === menuId)
      : selectedMenu;
    if (!target) return;
    if (
      !window.confirm(
        translateText(`Xác nhận Khóa & Công bố thực đơn "${target.title}" cho toàn trường? Bếp, giáo viên và phụ huynh sẽ xem được thực đơn đã công bố.`),
      )
    ) {
      return;
    }

    try {
      setActionLoading(true);
      const published = await weeklyMenusApi.publishMenu(target.id);
      showNotify(
        "success",
        `Đã Khóa & Công bố thực đơn thành công: ${published.title}`,
      );
      await fetchAllData(published.id);
    } catch (err: any) {
      showNotify(
        "error",
        err?.response?.data?.message || "Không thể công bố thực đơn.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Mở bản in A4
  const handleOpenPrintPreview = async (menuId?: string) => {
    const id = menuId || selectedMenu?.id;
    if (!id) return;
    try {
      const data = await weeklyMenusApi.getExportData(id);
      setPrintData(data);
      setIsPrintModalOpen(true);
    } catch (err) {
      showNotify("error", "Không thể lấy dữ liệu in ấn.");
    }
  };

  // 7. Tải file Excel
  const handleDownloadExcel = async (menu?: WeeklyMenu | null) => {
    const target = menu || selectedMenu;
    if (!target) return;
    try {
      await weeklyMenusApi.downloadExcel(
        target.id,
        `Thuc_don_${target.title.replace(/\s+/g, "_")}.xlsx`,
      );
      showNotify("success", "Đã tải xuống file Excel thực đơn tuần.");
    } catch (err) {
      showNotify("error", "Không thể tải file Excel.");
    }
  };

  // Helpers hiển thị
  const getAgeGroupLabel = (group: string) => {
    switch (group) {
      case "TODDLER_18_36M":
        return "Nhà trẻ (18 - 36T)";
      case "KINDERGARTEN_3_4Y":
        return "Mầm (3 - 4 tuổi)";
      case "KINDERGARTEN_4_5Y":
        return "Chồi (4 - 5 tuổi)";
      case "KINDERGARTEN_5_6Y":
        return "Lá (5 - 6 tuổi)";
      case "ALL_AGES":
        return "Toàn trường (Mẫu giáo chung)";
      default:
        return group || "Mẫu giáo chung";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUBMITTED_FOR_REVIEW":
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>{translateText("Chờ BGH duyệt")}</span>
        );
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-blue-100 text-blue-900 border border-blue-300 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />{translateText("Đã duyệt (Chờ công bố)")}</span>
        );
      case "ACTIVE":
      case "PUBLISHED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
            <Lock className="w-3.5 h-3.5 text-emerald-700" />{translateText("Đang áp dụng (Khóa)")}</span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-rose-100 text-rose-900 border border-rose-300 shadow-2xs">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />{translateText("Bị từ chối")}</span>
        );
      case "DRAFT":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">{translateText("Bản dự thảo (Chưa gửi)")}</span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
            {translateText(status)}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-16 font-sans text-slate-800">
      {/* Thông báo Alert */}
      {notification && (
        <div className="fixed top-20 right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold ${notification.type === "success"
              ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/30"
              : "bg-rose-600 text-white border-rose-500 shadow-rose-600/30"
              }`}
          >
            {notification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span>{translateText(notification.message)}</span>
          </div>
        </div>
      )}



      {/* ─── 2. CÁC Ô THỐNG KÊ (5 KPI CARDS ĐẦU GIAO DIỆN) ─── */}
      <MenuStatsCards stats={stats} loading={loading} isPrincipal={true} />

      {/* ─── 3. BẢNG DANH SÁCH CÁC THỰC ĐƠN TUẦN ─── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Header Bảng: Tìm kiếm & Bộ lọc trạng thái */}
        <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            {/* Ô tìm kiếm */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={translateText("Tìm theo tên thực đơn tuần...")}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition shadow-inner"
              />
            </div>

            {/* Lọc Trạng thái */}
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{translateText("Trạng thái:")}</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              >
                <option value="ALL_SUBMITTED">{translateText("Tất cả đã gửi BGH (")}{stats?.submitted || 0}{translateText(" chờ duyệt)")}</option>
                <option value="SUBMITTED_FOR_REVIEW">{translateText("Chờ BGH duyệt (")}{stats?.submitted || 0})
                </option>
                <option value="APPROVED">{translateText("Đã duyệt (")}{stats?.approved || 0})
                </option>
                <option value="ACTIVE">{translateText("Đang áp dụng (")}{stats?.active || 0})
                </option>
                <option value="REJECTED">{translateText("Bị từ chối (")}{stats?.rejected || 0})
                </option>
              </select>
            </div>

          </div>

          <div className="text-xs font-semibold text-slate-500">{translateText("Hiển thị ")}<strong className="text-slate-800">{menus.length}</strong>{" "}{translateText("thực đơn tuần")}</div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4 w-12 text-center">{translateText("STT")}</th>
                <th className="py-3.5 px-4">{translateText("Tên thực đơn tuần")}</th>
                <th className="py-3.5 px-4">{translateText("Thời gian áp dụng")}</th>
                <th className="py-3.5 px-4">{translateText("Người lập hồ sơ")}</th>
                <th className="py-3.5 px-4 text-center">{translateText("Thời gian gửi")}</th>
                <th className="py-3.5 px-4 text-center">{translateText("Trạng thái")}</th>
                <th className="py-3.5 px-4 text-right">{translateText("Thao tác")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium">
              {menus.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-50" />
                    <p className="font-bold text-slate-700">{translateText("Không tìm thấy thực đơn nào!")}</p>
                    <p className="text-xs mt-0.5">{translateText("Vui lòng điều chỉnh lại bộ lọc hoặc từ khóa tìm kiếm.")}</p>
                  </td>
                </tr>
              ) : (
                menus.map((menu, idx) => {
                  const isSelected = selectedMenu?.id === menu.id;
                  const isPending =
                    menu.status === "SUBMITTED_FOR_REVIEW" ||
                    menu.status === "PENDING";
                  const isApproved = menu.status === "APPROVED";

                  return (
                    <tr
                      key={menu.id}
                      onClick={() => handleSelectMenu(menu.id, false)}
                      className={`transition-colors cursor-pointer group ${isSelected
                        ? "bg-teal-50/70 border-l-4 border-l-teal-600 font-semibold"
                        : isPending
                          ? "bg-amber-50/30 hover:bg-amber-50/60"
                          : "hover:bg-slate-50/80"
                        }`}
                    >
                      {/* STT */}
                      <td className="py-3.5 px-4 text-center text-slate-400 font-mono text-xs">
                        {idx + 1}
                      </td>

                      {/* Tên thực đơn & Version */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 group-hover:text-teal-700 transition">
                            {menu.title}
                          </span>
                          <span className="bg-slate-100 text-slate-700 text-[10px] font-black px-1.5 py-0.2 rounded border border-slate-200">{translateText("v")}{menu.version}.0
                          </span>
                          {isPending && (
                            <span className="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded uppercase animate-pulse">{translateText("Cần duyệt")}</span>
                          )}
                          {menu.editRequestStatus === "PENDING" && (
                            <span className="bg-purple-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded uppercase animate-pulse">{translateText("Xin sửa")}</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 font-normal mt-0.5">{translateText("Mã:")}{" "}
                          <code className="text-[10px]">
                            {translateText(menu.id.slice(0, 8))}
                          </code>{" "}{translateText("• Tuần ")}{menu.cycleWeekNumber}
                        </p>
                      </td>

                      {/* Thời gian */}
                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>
                            {translateText(menu.startDate?.split("T")[0])} →{" "}
                            {translateText(menu.endDate?.split("T")[0])}
                          </span>
                        </div>
                      </td>

                      {/* Người lập hồ sơ */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-xs text-slate-700">
                          <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="font-bold">
                            {translateText(menu.submittedByName ||
                              menu.createdByName ||
                              "BS. Hoàng Mai Trang")}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{translateText("Chuyên viên Dinh dưỡng")}</p>
                      </td>

                      {/* Cột riêng: Thời gian gửi BGH */}
                      <td className="py-3.5 px-4 text-center">
                        {menu.submittedAt ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="font-bold text-slate-800 text-xs flex items-center gap-1">
                              <Clock className="w-3 h-3 text-teal-600" />
                              {translateText(new Date(menu.submittedAt).toLocaleTimeString(
                                getLocale(),
                                { hour: "2-digit", minute: "2-digit" },
                              ))}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium mt-0.5">
                              {translateText(new Date(menu.submittedAt).toLocaleDateString(
                                getLocale(),
                              ))}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">{translateText("Chưa gửi BGH")}</span>
                        )}
                      </td>

                      {/* Trạng thái */}
                      <td className="py-3.5 px-4 text-center">
                        {getStatusBadge(menu.status)}
                      </td>

                      {/* Thao tác */}
                      <td className="py-3.5 px-4 text-right">
                        <div
                          className="flex items-center justify-end gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Nút Xem chi tiết (Mở Drawer bên phải) */}
                          <button
                            onClick={() => handleSelectMenu(menu.id, true)}
                            className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold flex items-center gap-1 transition shadow-2xs border border-teal-200"
                            title={translateText("Xem chi tiết ma trận món ăn và thẩm định")}
                          >
                            <Eye className="w-3.5 h-3.5 text-teal-600" />
                            <span>{translateText("Xem chi tiết")}</span>
                          </button>

                          {/* Nút Duyệt xin sửa nếu có yêu cầu */}
                          {menu.editRequestStatus === "PENDING" && (
                            <button
                              onClick={() => {
                                handleSelectMenu(menu.id, false);
                                setIsRespondEditModalOpen(true);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1 transition shadow-xs animate-pulse cursor-pointer"
                              title={translateText("Hiệu trưởng duyệt yêu cầu xin phép chỉnh sửa thực đơn")}
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                              <span>{translateText("Duyệt xin sửa")}</span>
                            </button>
                          )}

                          {/* Nút Duyệt nhanh nếu đang chờ duyệt */}
                          {isPending && (
                            <button
                              onClick={() => {
                                handleSelectMenu(menu.id, false);
                                setIsApprovalModalOpen(true);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1 transition shadow-xs cursor-pointer"
                              title={translateText("Hiệu trưởng phê duyệt thực đơn")}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{translateText("Duyệt")}</span>
                            </button>
                          )}

                          {/* Nút Công bố nhanh nếu đã duyệt */}
                          {isApproved && (
                            <button
                              onClick={() => {
                                void handlePublish(menu.id);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 transition shadow-xs cursor-pointer"
                              title={translateText("Khóa & Công bố thực đơn toàn trường")}
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span>{translateText("Công bố")}</span>
                            </button>
                          )}

                          {/* In phiếu thực đơn */}
                          <button
                            onClick={() => handleOpenPrintPreview(menu.id)}
                            className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                            title={translateText("In phiếu A4")}
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── 4. POPUP BÊN PHẢI (RIGHT SLIDE-OVER DRAWER) LÀM MỜ PHẦN CÒN LẠI ─── */}
      {isDrawerOpen &&
        selectedMenu &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9999] overflow-hidden flex justify-end">
            {/* Nền mờ Backdrop Blur toàn màn hình 100vw x 100vh */}
            <div
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-md transition-opacity"
              style={{
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
              }}
              onClick={() => setIsDrawerOpen(false)}
            />

            {/* Popup Drawer trượt từ bên phải */}
            <div className="relative w-full max-w-5xl lg:max-w-6xl xl:max-w-7xl bg-white h-full shadow-2xl z-10 flex flex-col overflow-hidden">
              {/* Header Drawer */}
              <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-600/25">
                    <FileCheck2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-black text-slate-900 tracking-tight">{translateText("Hồ sơ Thẩm định Thực đơn Tuần")}</h2>
                      <span className="bg-teal-100 text-teal-800 text-[10px] font-black px-2 py-0.2 rounded">{translateText("v")}{selectedMenu.version}.0
                      </span>
                      {getStatusBadge(selectedMenu.status)}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {translateText(selectedMenu.title)}{translateText(" • Tuần ")}{selectedMenu.cycleWeekNumber}{" "}
                      ({translateText(selectedMenu.startDate?.split("T")[0])} →{" "}
                      {translateText(selectedMenu.endDate?.split("T")[0])})
                    </p>
                  </div>
                </div>

                {/* Nút Đóng Popup */}
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-2 rounded-2xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Nội dung chi tiết cuộn được */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Banner YÊU CẦU XIN PHÉP CHỈNH SỬA nếu có */}
                {selectedMenu.editRequestStatus === "PENDING" && (
                  <div className="p-4 bg-gradient-to-r from-amber-50 via-purple-50/50 to-white border border-amber-300 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-sm animate-in fade-in">
                    <div className="flex items-start gap-3 flex-1 min-w-[280px]">
                      <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-md shadow-amber-500/25 shrink-0 mt-0.5">
                        <ShieldAlert className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-amber-950 text-sm">{translateText("YÊU CẦU XIN PHÉP CHỈNH SỬA THỰC ĐƠN")}</span>
                          <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase">{translateText("Chờ BGH duyệt")}</span>
                        </div>
                        <p className="text-xs text-amber-900 mt-1 font-semibold">{translateText("Lý do xin sửa: \"")}{translateText(selectedMenu.editRequestReason)}"
                        </p>
                        <p className="text-[11px] text-amber-700 mt-0.5">{translateText("Gửi lúc:")}{" "}
                          {translateText(selectedMenu.editRequestAt
                            ? new Date(
                              selectedMenu.editRequestAt,
                            ).toLocaleString(getLocale())
                            : "Mới đây")}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsRespondEditModalOpen(true)}
                      className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-600 to-purple-600 hover:from-amber-700 hover:to-purple-700 text-white text-xs font-bold shadow-md shadow-amber-600/30 flex items-center gap-1.5 transition shrink-0 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{translateText("Duyệt yêu cầu xin sửa")}</span>
                    </button>
                  </div>
                )}

                {/* Ghi chú lý do từ chối nếu có */}
                {selectedMenu.status === "REJECTED" &&
                  selectedMenu.rejectionReason && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 shadow-xs">
                      <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs font-bold text-rose-900 block">{translateText("Lý do Hiệu trưởng từ chối:")}</span>
                        <p className="text-xs text-rose-800 mt-0.5">
                          {translateText(selectedMenu.rejectionReason)}
                        </p>
                        {selectedMenu.rejectedAt && (
                          <span className="text-[10px] text-rose-600 mt-1 block">{translateText("Từ chối lúc:")}{" "}
                            {translateText(new Date(selectedMenu.rejectedAt).toLocaleString(
                              getLocale(),
                            ))}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                {/* Ghi chú phê duyệt nếu có */}
                {(selectedMenu.status === "APPROVED" ||
                  selectedMenu.status === "PUBLISHED" ||
                  selectedMenu.status === "ACTIVE") &&
                  selectedMenu.approvalNotes && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 shadow-xs">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs font-bold text-emerald-900 block">{translateText("Ý kiến chỉ đạo của Hiệu trưởng:")}</span>
                        <p className="text-xs text-emerald-800 mt-0.5">
                          {selectedMenu.approvalNotes}
                        </p>
                        {selectedMenu.approvedAt && (
                          <span className="text-[10px] text-emerald-600 mt-1 block">{translateText("Phê duyệt lúc:")}{" "}
                            {translateText(new Date(selectedMenu.approvedAt).toLocaleString(
                              getLocale(),
                            ))}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                {/* Thẻ thẩm định nhanh 4 tiêu chí */}
                {/* Thẻ thẩm định nhanh 4 tiêu chí */}
                {(() => {
                  const selCal = Number(selectedMenu.dailyAverageCalories) || 0;
                  const selP = Number(selectedMenu.dailyAverageProteinG) || 0;
                  const selL = Number(selectedMenu.dailyAverageFatG) || 0;
                  const selG = Number(selectedMenu.dailyAverageCarbG) || 0;
                  const selPPct =
                    selCal > 0 ? Math.round(((selP * 4) / selCal) * 100) : 16;
                  const selLPct =
                    selCal > 0 ? Math.round(((selL * 9) / selCal) * 100) : 30;
                  const selGPct = Math.max(0, 100 - selPPct - selLPct);

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-emerald-50/80 border border-emerald-200/80 p-3.5 rounded-2xl text-center shadow-2xs">
                        <span className="text-[10px] uppercase font-bold text-emerald-800 block">{translateText("Cơ cấu P : L : G")}</span>
                        <span className="text-lg font-black text-emerald-950 mt-0.5 block">
                          {selPPct}% : {selLPct}% : {selGPct}%
                        </span>
                        <span className="text-[10px] text-emerald-700 font-medium">{translateText("P: ")}{translateText(selP.toFixed(1))}{translateText("g | L: ")}{translateText(selL.toFixed(1))}{translateText("g | G:")}{" "}
                          {translateText(selG.toFixed(1))}{translateText("g")}</span>
                      </div>

                      <div className="bg-purple-50/80 border border-purple-200/80 p-3.5 rounded-2xl text-center shadow-2xs">
                        <span className="text-[10px] uppercase font-bold text-purple-800 block">{translateText("Người gửi hồ sơ")}</span>
                        <span className="text-sm font-black text-purple-950 mt-1 block truncate">
                          {translateText(selectedMenu.submittedByName ||
                            selectedMenu.createdByName ||
                            "BS. Hoàng Mai Trang")}
                        </span>
                        <span className="text-[10px] text-purple-700 font-medium">
                          {translateText(selectedMenu.submittedAt
                            ? `Gửi lúc: ${new Date(selectedMenu.submittedAt).toLocaleTimeString(getLocale(), { hour: "2-digit", minute: "2-digit" })} • ${new Date(selectedMenu.submittedAt).toLocaleDateString(getLocale())}`
                            : "Chuyên viên Dinh dưỡng")}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Thanh Quyết Định Của Hiệu Trưởng Trong Drawer */}
                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <span>{translateText("Trạng thái hiện tại:")}</span>
                    {getStatusBadge(selectedMenu.status)}
                  </div>

                  <div className="flex items-center gap-2">
                    {(selectedMenu.status === "SUBMITTED_FOR_REVIEW" ||
                      selectedMenu.status === "PENDING") && (
                        <button
                          onClick={() => setIsApprovalModalOpen(true)}
                          className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/25 flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{translateText("Phê duyệt / Từ chối")}</span>
                        </button>
                      )}

                    {selectedMenu.status === "APPROVED" && (
                      <button
                        onClick={() => void handlePublish()}
                        className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md shadow-emerald-700/25 flex items-center gap-1.5 transition"
                      >
                        <Lock className="w-4 h-4" />
                        <span>{translateText("Khóa & Công bố toàn trường")}</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleOpenPrintPreview()}
                      className="p-2.5 rounded-xl border border-slate-200 hover:bg-white text-slate-700 transition"
                      title={translateText("In phiếu A4")}
                    >
                      <Printer className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDownloadExcel()}
                      className="p-2.5 rounded-xl border border-slate-200 hover:bg-white text-slate-700 transition"
                      title={translateText("Xuất Excel")}
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    </button>
                  </div>
                </div>

                {/* Ma trận thực đơn chi tiết */}
                <div className="overflow-x-auto">
                  <h3 className="text-sm font-extrabold text-slate-900 mb-2 flex items-center gap-2">
                    <span>{translateText("Ma trận phân bổ thực đơn 5 ngày x 5 bữa ăn")}</span>
                    <span className="text-[11px] font-normal text-slate-400">{translateText("(Chế độ xem Thẩm định)")}</span>
                  </h3>
                  <div className="w-full">
                    <WeeklyGridTable
                      menu={selectedMenu}
                      readOnly={true}
                      onOpenDishDrawer={() => { }}
                      onRemoveDish={async () => { }}
                    />
                  </div>
                </div>
              </div>

              {/* Footer Drawer */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 shrink-0">
                <span>{translateText("Hệ thống KidMeal • Dinh dưỡng Bán trú Mầm non")}</span>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold transition shadow-xs"
                >{translateText("Đóng lại")}</button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Modal Phê duyệt / Từ chối (BGH) */}
      <ApprovalModal
        isOpen={isApprovalModalOpen}
        onClose={() => setIsApprovalModalOpen(false)}
        menu={selectedMenu}
        onApprove={handleApprove}
        onReject={handleReject}
      />

      {/* Modal Hiệu trưởng Duyệt / Từ chối yêu cầu xin phép chỉnh sửa */}
      <RespondEditRequestModal
        isOpen={isRespondEditModalOpen}
        onClose={() => setIsRespondEditModalOpen(false)}
        menu={selectedMenu}
        onApprove={handleApproveEditRequest}
        onReject={handleRejectEditRequest}
      />

      {/* Modal Xem trước & In ấn (Print Preview) */}
      <PrintPreviewModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        data={printData}
        onDownloadExcel={handleDownloadExcel}
      />
    </div>
  );
};
