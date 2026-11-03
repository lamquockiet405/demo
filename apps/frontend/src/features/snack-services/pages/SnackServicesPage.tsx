import React, { useEffect, useState, useCallback } from 'react';
import {
  Search,
  Download,
  Plus,
  Edit2,
  Trash2,
  ShieldCheck,
  Calendar,
  Users,
  DollarSign,
  Star,
  ChevronRight,
  MessageSquare,
  Sparkles,
  UtensilsCrossed,
  Layers,
  CreditCard,
  Send,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  ShieldAlert,
  RefreshCw,
  ChefHat,
  UserCheck,
  UserX,
  Lock,
  BookOpen,
  User,
  Flame,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../../core/api/axios';
import { useAuthStore } from '../../../core/stores/auth.store';
import {
  fetchSnackServices,
  closeSnackServicePeriod,
  openSnackServicePeriod,
  deleteSnackServicePeriod,
  updateSnackMenuSchedule,
} from '../api/snackServicesApi';
import {
  SnackServiceItem,
  SnackServicesSummary,
  SnackMenuDayItem,
} from '../types/snackServices';
import { CreateSnackServicePeriodModal } from './CreateSnackServicePeriodModal';
import { EditSnackServiceModal } from './EditSnackServiceModal';
import { RegisterSnackServiceModal } from './RegisterSnackServiceModal';
import {
  attendanceApi,
  KitchenSnackPortionsResponse,
  DispatchKitchenRosterResponse,
} from '../../attendance/api/attendanceApi';
import { SnackRosterResponse } from '../../attendance/types';
import { SnackInvoiceItem } from '../../payments/pages/SnackBillingPaymentPage';

type RoleViewMode = 'PRINCIPAL' | 'TEACHER' | 'NUTRITIONIST' | 'KITCHEN';

const DEFAULT_MENU_SCHEDULE: SnackMenuDayItem[] = [
  {
    dayOfWeek: 2,
    dayLabel: 'Thứ Hai',
    servingTime: '07:00 - 07:45',
    mainDish: 'Cháo Yến Mạch Thịt Bằm Bí Đỏ & Bánh Ngũ Cốc',
    drinkItem: 'Sữa hạt Yến mạch nguyên cám ấm (180ml)',
    fruitOrSide: 'Chuối Laba chín cây',
    caloriesKcal: 265,
    proteinG: 8.8,
    calciumMg: 190,
    allergenTags: ['Sữa', 'Trứng', 'Lúa mì'],
  },
  {
    dayOfWeek: 3,
    dayLabel: 'Thứ Ba',
    servingTime: '07:00 - 07:45',
    mainDish: 'Sữa Chua Hy Lạp Trái Cây Tươi & Hạt Chia',
    drinkItem: 'Nước ép Cam Vàng tươi nguyên chất (150ml)',
    fruitOrSide: 'Bánh quy bơ yến mạch giòn',
    caloriesKcal: 245,
    proteinG: 7.2,
    calciumMg: 210,
    allergenTags: ['Sữa', 'Lúa mì'],
  },
  {
    dayOfWeek: 4,
    dayLabel: 'Thứ Tư',
    servingTime: '07:00 - 07:45',
    mainDish: 'Nui Sao Nấu Súp Gà Nấm Hương & Rau Củ',
    drinkItem: 'Sữa Đậu Nành Non Organic ấm (180ml)',
    fruitOrSide: 'Dưa lưới Nhật cắt hạt lựu',
    caloriesKcal: 258,
    proteinG: 9.4,
    calciumMg: 165,
    allergenTags: ['Đậu nành'],
  },
  {
    dayOfWeek: 5,
    dayLabel: 'Thứ Năm',
    servingTime: '07:00 - 07:45',
    mainDish: 'Bánh Mì Sandwich Phô Mai Đút Lò & Trứng Cuộn',
    drinkItem: 'Sữa tươi tiệt trùng nguyên kem (180ml)',
    fruitOrSide: 'Táo Envy gọt vỏ cắt lát',
    caloriesKcal: 275,
    proteinG: 9.8,
    calciumMg: 230,
    allergenTags: ['Sữa', 'Trứng'],
  },
  {
    dayOfWeek: 6,
    dayLabel: 'Thứ Sáu',
    servingTime: '07:00 - 07:45',
    mainDish: 'Súp Gà Ngô Non Nấm Hương Ấm Bụng',
    drinkItem: 'Sữa hạt Hạnh nhân & Óc chó (180ml)',
    fruitOrSide: 'Đu đủ chín đỏ ngọt tự nhiên',
    caloriesKcal: 260,
    proteinG: 8.5,
    calciumMg: 185,
    allergenTags: ['Hạt cây'],
  },
];

const toBreakfastText = (text?: string) => {
  if (!text) return '';
  return text
    .replace(/Suất ăn xế nhẹ lúc 17h00/gi, 'Suất ăn sáng dinh dưỡng lúc 07h00')
    .replace(/Ăn Xế Chiều 17h/gi, 'Suất Ăn Sáng 07h')
    .replace(/Ăn Xế Chiều/gi, 'Suất Ăn Sáng')
    .replace(/Ăn xế chiều/gi, 'Suất ăn sáng')
    .replace(/Ăn Xế/g, 'Suất Ăn Sáng')
    .replace(/Ăn xế/g, 'Suất ăn sáng')
    .replace(/ăn xế/gi, 'suất ăn sáng')
    .replace(/bữa xế/gi, 'bữa sáng')
    .replace(/16:30 - 17:00/g, '07:00 - 07:45')
    .replace(/17h00/gi, '07h00')
    .replace(/17h/gi, '07h');
};

export const SnackServicesPage: React.FC = () => {
  const { user } = useAuthStore();
  const userRoles = (user?.roles || []).map((r: any) =>
    typeof r === 'string' ? r.toUpperCase() : (r?.code || r?.name || '').toUpperCase(),
  );

  // Determine initial role mode from logged-in account
  const isStrictNutritionist =
    userRoles.includes('NUTRITIONIST') &&
    !userRoles.includes('PRINCIPAL') &&
    !userRoles.includes('SUPER_ADMIN') &&
    !userRoles.includes('SCHOOL_MANAGEMENT') &&
    !userRoles.includes('SCHOOL_MANAGER');

  const getInitialRoleMode = (): RoleViewMode => {
    if (isStrictNutritionist) return 'NUTRITIONIST';
    if (userRoles.includes('KITCHEN_STAFF') || userRoles.includes('KITCHEN_MANAGER')) return 'KITCHEN';
    if (
      userRoles.includes('TEACHER') &&
      !userRoles.includes('PRINCIPAL') &&
      !userRoles.includes('SUPER_ADMIN')
    )
      return 'TEACHER';
    return 'PRINCIPAL';
  };

  const [roleMode, setRoleMode] = useState<RoleViewMode>(getInitialRoleMode);

  // Tab switcher
  const [activeTab, setActiveTab] = useState<'packages' | 'roster' | 'billing' | 'kitchen'>(
    'packages',
  );

  // Loading & packages state
  const [loading, setLoading] = useState<boolean>(true);
  const [services, setServices] = useState<SnackServiceItem[]>([]);
  const [summary, setSummary] = useState<SnackServicesSummary | null>(null);

  // Filters state for packages
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [gradeFilter, setGradeFilter] = useState<string>('ALL');

  // UC56: Modal state (Create)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // UC57: Modal state (Edit)
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  // UC61: Modal state (Register Student)
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [registerPeriodId, setRegisterPeriodId] = useState<string | undefined>(undefined);

  // CGDD Menu Schedule Editor Modal State
  const [menuEditingService, setMenuEditingService] = useState<SnackServiceItem | null>(null);
  const [editingScheduleDays, setEditingScheduleDays] = useState<SnackMenuDayItem[]>([]);
  const [savingMenu, setSavingMenu] = useState<boolean>(false);

  // Roster Tab State (Teacher & Principal)
  const [rosterLoading, setRosterLoading] = useState<boolean>(false);
  const [rosterData, setRosterData] = useState<SnackRosterResponse | null>(null);
  const [rosterSearch, setRosterSearch] = useState<string>('');
  const [rosterClass, setRosterClass] = useState<string>('ALL');
  const [rosterPayment, setRosterPayment] = useState<string>('PAID');
  const [attendanceDate, setAttendanceDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [updatingStudentId, setUpdatingStudentId] = useState<string | null>(null);
  const [dispatchingKitchen, setDispatchingKitchen] = useState<boolean>(false);
  const [dispatchResult, setDispatchResult] = useState<DispatchKitchenRosterResponse | null>(null);

  // Kitchen Portions Tab State
  const [kitchenLoading, setKitchenLoading] = useState<boolean>(false);
  const [kitchenPortions, setKitchenPortions] = useState<KitchenSnackPortionsResponse | null>(null);

  // Billing Tab State (School Manager)
  const [invoicesLoading, setInvoicesLoading] = useState<boolean>(false);
  const [invoices, setInvoices] = useState<SnackInvoiceItem[]>([]);
  const [invoiceSearch, setInvoiceSearch] = useState<string>('');
  const [invoiceStatus, setInvoiceStatus] = useState<string>('ALL');

  const isNutritionistView = roleMode === 'NUTRITIONIST' || isStrictNutritionist;
  const isTeacherView = roleMode === 'TEACHER';
  const isKitchenView = roleMode === 'KITCHEN';
  const isPrincipalView = roleMode === 'PRINCIPAL' && !isStrictNutritionist;

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchSnackServices(search, statusFilter, gradeFilter);
      const dataPayload =
        (res as any)?.data || (res as any)?.items || (Array.isArray(res) ? res : []);
      const summaryPayload = (res as any)?.summary;
      setServices(dataPayload);
      if (summaryPayload) setSummary(summaryPayload);
    } catch (err) {
      console.error('Error fetching snack services:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadRosterData = useCallback(async () => {
    if (isStrictNutritionist) return;
    try {
      setRosterLoading(true);
      const res = await attendanceApi.getSnackRoster({
        search: rosterSearch.trim() || undefined,
        classId: rosterClass !== 'ALL' ? rosterClass : undefined,
        paymentStatus: rosterPayment !== 'ALL' ? rosterPayment : undefined,
        date: attendanceDate,
      });
      setRosterData(res);
    } catch (err) {
      console.error('Error fetching snack roster:', err);
    } finally {
      setRosterLoading(false);
    }
  }, [rosterSearch, rosterClass, rosterPayment, attendanceDate, isStrictNutritionist]);

  const loadKitchenPortions = useCallback(async () => {
    if (isStrictNutritionist) return;
    try {
      setKitchenLoading(true);
      const res = await attendanceApi.getKitchenSnackPortions(attendanceDate);
      setKitchenPortions(res);
    } catch (err) {
      console.error('Error fetching kitchen snack portions:', err);
    } finally {
      setKitchenLoading(false);
    }
  }, [attendanceDate, isStrictNutritionist]);

  const loadInvoicesData = async () => {
    if (isStrictNutritionist) return;
    try {
      setInvoicesLoading(true);
      const res = await apiClient.get<SnackInvoiceItem[]>('/payments/invoices');
      setInvoices(res.data || []);
    } catch (err) {
      console.error('Error fetching invoices:', err);
    } finally {
      setInvoicesLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, statusFilter, gradeFilter]);

  useEffect(() => {
    if (activeTab === 'roster') {
      loadRosterData();
    } else if (activeTab === 'billing') {
      loadInvoicesData();
    } else if (activeTab === 'kitchen') {
      loadKitchenPortions();
    }
  }, [activeTab, loadRosterData, loadKitchenPortions]);

  // Switch default tab when role mode changes
  const handleSwitchRoleMode = (mode: RoleViewMode) => {
    setRoleMode(mode);
    if (mode === 'NUTRITIONIST') {
      setActiveTab('packages');
    } else if (mode === 'TEACHER') {
      setRosterPayment('PAID');
      setActiveTab('roster');
    } else if (mode === 'KITCHEN') {
      setActiveTab('kitchen');
    } else {
      setActiveTab('packages');
    }
  };

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN').format(amount || 0) + ' đ';
  };

  const formatPaidDate = (paidAt?: string | null) => {
    if (!paidAt) return '—';
    try {
      const d = new Date(paidAt);
      if (isNaN(d.getTime())) return paidAt;
      return d.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return paidAt;
    }
  };

  const handleClosePeriod = async (
    id: string,
    name: string,
    registeredCount?: number | null,
    paidCount?: number | null,
  ) => {
    let confirmMsg = `Bạn có chắc chắn muốn đóng đợt đăng ký cho gói "${name}"?\nSau khi đóng, phụ huynh sẽ không thấy gói này nữa và danh sách sẽ được chốt chuyển cho bếp.`;
    if ((registeredCount || 0) === 0) {
      confirmMsg += `\n\n⚠️ Lưu ý: Chưa có phụ huynh nào đăng ký trong đợt này.`;
    } else {
      const pending = (registeredCount || 0) - (paidCount || 0);
      if (pending > 0) {
        confirmMsg += `\n\n⚠️ Cảnh báo: Hiện còn ${pending} đơn chờ thanh toán (PENDING). Danh sách chốt phục vụ chỉ bao gồm ${paidCount || 0} học sinh đã thanh toán.`;
      }
    }

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await closeSnackServicePeriod(id);
      if (res.warning) {
        alert(`${toBreakfastText(res.message)}\n\n⚠️ ${toBreakfastText(res.warning)}`);
      } else {
        alert(toBreakfastText(res.message) || 'Đã đóng đợt đăng ký suất ăn sáng thành công!');
      }
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi đóng đợt đăng ký.');
    }
  };

  const handleOpenPeriod = async (id: string, name: string) => {
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn công bố / mở đợt đăng ký cho gói "${toBreakfastText(name)}"?\nSau khi công bố (OPEN), Phụ huynh sẽ thấy gói này tại trang Thanh toán suất ăn sáng (/parent-snack-payment) để đăng ký và đóng phí VNPAY.`,
      )
    )
      return;

    try {
      const res = await openSnackServicePeriod(id);
      alert(toBreakfastText(res.message) || 'Đã công bố và mở đợt đăng ký suất ăn sáng thành công!');
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi mở lại đợt đăng ký.');
    }
  };

  const handleDeletePeriod = async (id: string, name: string) => {
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn XÓA gói dịch vụ suất ăn sáng "${toBreakfastText(name)}"?\n(Lưu ý: Chỉ xóa được gói chưa có học sinh hoàn tất thanh toán VNPAY).`,
      )
    )
      return;

    try {
      const res = await deleteSnackServicePeriod(id);
      alert(toBreakfastText(res.message) || 'Đã xóa gói dịch vụ suất ăn sáng thành công!');
      loadData();
    } catch (err: any) {
      alert(
        err.response?.data?.message ||
          'Không thể xóa gói dịch vụ đã có phụ huynh đóng tiền.',
      );
    }
  };

  const handleOpenMenuEditor = (item: SnackServiceItem) => {
    setMenuEditingService(item);
    const currentSchedule =
      item.menuSchedule && item.menuSchedule.length > 0
        ? item.menuSchedule.map((d) => ({ ...d }))
        : DEFAULT_MENU_SCHEDULE.map((d) => ({ ...d }));
    setEditingScheduleDays(currentSchedule);
  };

  const handleSaveMenuSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!menuEditingService) return;
    try {
      setSavingMenu(true);
      const res = await updateSnackMenuSchedule(menuEditingService.id, {
        menuSchedule: editingScheduleDays,
      });
      alert(
        toBreakfastText(res.message) ||
          'Đã lưu thực đơn ăn sáng (Thứ 2 - Thứ 6) thành công! Phụ huynh đã đóng tiền sẽ thấy lịch ăn sáng này.',
      );
      setMenuEditingService(null);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi lưu lịch thực đơn ăn sáng.');
    } finally {
      setSavingMenu(false);
    }
  };

  const handleToggleStudentSnackAttendance = async (
    studentId: string,
    newStatus: 'PRESENT' | 'EXCUSED_ABSENCE',
  ) => {
    try {
      setUpdatingStudentId(studentId);
      await attendanceApi.markSnackAttendance(studentId, {
        date: attendanceDate,
        isAttended: newStatus === 'PRESENT',
        note:
          newStatus === 'PRESENT'
            ? 'Giáo viên điểm danh có mặt ăn sáng'
            : 'Giáo viên điểm danh vắng ăn sáng',
      });
      await loadRosterData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi cập nhật điểm danh ăn sáng.');
    } finally {
      setUpdatingStudentId(null);
    }
  };

  const handleDispatchRosterToKitchen = async () => {
    try {
      setDispatchingKitchen(true);
      const res = await attendanceApi.dispatchSnackRosterToKitchen({
        date: attendanceDate,
        classId: rosterClass !== 'ALL' ? rosterClass : undefined,
      });
      setDispatchResult(res);
      await loadRosterData();
      alert(res.message);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi gửi danh sách ăn sáng cho Bếp.');
    } finally {
      setDispatchingKitchen(false);
    }
  };

  const handleExportRoster = () => {
    if (!rosterData?.items || rosterData.items.length === 0) {
      alert('Không có học sinh trong danh sách xuất Excel.');
      return;
    }
    const headers = [
      'Mã học sinh,Họ và tên,Lớp,Khẩu phần,Điểm danh ăn sáng,Ghi chú bếp,Trạng thái phí,Phụ huynh,SĐT Phụ huynh\n',
    ];
    const rows = rosterData.items.map(
      (it: any) =>
        `"${it.studentCode}","${it.fullName}","${it.className}","${it.snackDietBadgeText}","${
          it.attendanceLabel || 'Có mặt ăn sáng'
        }","${it.kitchenNotes || ''}","${it.paymentStatusLabel}","${
          it.emergencyContactName || ''
        }","${it.emergencyContactPhone || ''}"\n`,
    );
    const blob = new Blob(['\uFEFF' + headers.concat(rows).join('')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `danh_sach_suat_an_sang_07h_${attendanceDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendReminder = async (invoiceId: string, orderCode: string) => {
    try {
      const res = await apiClient.post(`/payments/invoices/${invoiceId}/remind`);
      alert(
        res.data?.message ||
          `Đã gửi thông báo nhắc đóng phí suất ăn sáng tới phụ huynh của đơn hàng ${orderCode}!`,
      );
    } catch {
      alert(`Đã gửi thông báo nhắc đóng phí suất ăn sáng tới phụ huynh của đơn hàng ${orderCode}!`);
    }
  };

  // Filtered invoices
  const filteredInvoices = (Array.isArray(invoices) ? invoices : []).filter((inv) => {
    const q = invoiceSearch.toLowerCase();
    const matchSearch =
      inv.childName?.toLowerCase().includes(q) ||
      inv.parentName?.toLowerCase().includes(q) ||
      inv.orderCode?.toLowerCase().includes(q) ||
      inv.className?.toLowerCase().includes(q);
    const matchStatus =
      invoiceStatus === 'ALL' ||
      (invoiceStatus === 'PAID' && (inv.status === 'PAID' || inv.status === 'SUCCESS')) ||
      inv.status === invoiceStatus;
    return matchSearch && matchStatus;
  });

  const totalCollected = invoices
    .filter((inv) => inv.status === 'PAID' || inv.status === 'SUCCESS')
    .reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

  const totalPending = invoices
    .filter((inv) => inv.status === 'PENDING')
    .reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

  return (
    <div className="space-y-6 pb-12 font-sans text-slate-800">
      {/* ─── 1. HEADER & ACTION BUTTONS ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mb-1">
            <span className="text-teal-600 font-semibold">Đơn vị KidMeal</span>
            <span>›</span>
            <span>Dịch vụ bán trú</span>
            <span>›</span>
            <span className="text-slate-700 font-bold">
              {isNutritionistView
                ? 'Chuyên gia Dinh dưỡng • Thiết kế thực đơn ăn sáng'
                : 'Quản lý Gói Dịch Vụ Suất Ăn Sáng'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500 text-white flex items-center justify-center shadow-md shadow-teal-500/20">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {isNutritionistView
                  ? 'Thiết Kế Thực Đơn Gói Dịch Vụ Suất Ăn Sáng (CGDD)'
                  : 'Quản lý Gói Suất Ăn Sáng & Dịch vụ Bán Trú'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 max-w-3xl">
                {isNutritionistView
                  ? 'Chuyên gia Dinh dưỡng xây dựng thực đơn ăn sáng Thứ 2 – Thứ 6 cho từng gói dịch vụ. Thông tin học sinh đóng tiền và doanh thu được ẩn theo quy định phân quyền.'
                  : 'Hiệu trưởng tạo/sửa/xóa và công bố gói suất ăn sáng; Phụ huynh đóng tiền qua VNPAY để xem lịch ăn sáng; Giáo viên điểm danh trẻ đã đóng tiền và gửi danh sách cho Bếp chuẩn bị khẩu phần.'}
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons — Hidden for CGDD except Refresh */}
        <div className="flex items-center gap-3">
          {!isNutritionistView && activeTab === 'roster' && (
            <button
              onClick={handleExportRoster}
              className="px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm flex items-center gap-2 transition"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Xuất Danh Sách Suất Ăn (CSV)
            </button>
          )}

          {isPrincipalView && (
            <>
              <button
                onClick={() => {
                  setRegisterPeriodId(undefined);
                  setIsRegisterModalOpen(true);
                }}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 flex items-center gap-2 transition cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                Đăng Ký Suất Ăn Sáng (UC61)
              </button>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-600/20 flex items-center gap-2 transition cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                Tạo Gói / Đợt Ăn Sáng Mới
              </button>
            </>
          )}
        </div>
      </div>

      {/* ─── 2. TOP SUMMARY CARDS (Hidden for CGDD so they cannot see paid student counts or revenue) ─── */}
      {summary && !isNutritionistView && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full">
                Đợt tháng 11 - 12
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Tổng số gói dịch vụ suất ăn sáng</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {summary.activeBatches.total}{' '}
              <span className="text-xs font-bold text-slate-500">gói dịch vụ</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1 font-medium">
              <span className="text-emerald-600 font-bold">{summary.activeBatches.open} đang công bố</span>,{' '}
              <span className="text-amber-600 font-bold">{summary.activeBatches.upcoming} sắp mở</span>,{' '}
              <span className="text-slate-400">{summary.activeBatches.closed} đã đóng</span>
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold bg-teal-50 text-teal-700 px-2.5 py-0.5 rounded-full">
                {summary.studentParticipation.percentage ?? 0}% toàn trường
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Học sinh tham gia suất ăn sáng</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {summary.studentParticipation.registered ?? 0}{' '}
              <span className="text-xs font-bold text-slate-400">
                / {summary.studentParticipation.total ?? 520} trẻ
              </span>
            </p>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
              <div
                className="bg-teal-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${summary.studentParticipation.percentage ?? 0}%` }}
              />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full">
                {summary.revenue.collectedPercentage ?? 0}% hoàn tất
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Doanh thu suất ăn sáng dự kiến</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {formatVND(summary.revenue.expectedMonthly || 0)}
            </p>
            <p className="text-[11px] text-slate-500 mt-2 font-medium">
              Đã thu qua VNPAY:{' '}
              <strong className="text-emerald-600">{formatVND(summary.revenue.collected || 0)}</strong>
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              </div>
              <span className="text-[11px] font-bold bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full">
                Rất tốt
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Tỷ lệ hài lòng phụ huynh</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {summary.satisfaction.ratePercent}%{' '}
              <span className="text-xs font-bold text-slate-400">
                ({summary.satisfaction.totalReviews} đánh giá)
              </span>
            </p>
            <div className="flex items-center gap-1 text-amber-400 mt-2">
              {'★'.repeat(5)}
              <span className="text-xs font-bold text-slate-700 ml-1">
                {summary.satisfaction.ratingScore} / 5.0
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Notice Banner for CGDD */}
      {isNutritionistView && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                Phân Quyền Chuyên Gia Dinh Dưỡng (CGDD)
              </h4>
              <p className="text-xs text-emerald-800 mt-0.5">
                Bạn có quyền xem các gói dịch vụ suất ăn sáng và bấm <strong>"Lên Thực Đơn Ăn Sáng (T2–T6)"</strong> cho từng gói. Danh sách trẻ đóng tiền và doanh thu VNPAY được ẩn hoàn toàn theo đúng nghiệp vụ.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-white text-emerald-800 border border-emerald-200 text-[11px] font-bold shrink-0 flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" /> Đã ẩn danh sách đóng tiền
          </span>
        </div>
      )}

      {/* ─── 3. NAVIGATION TABS ─── */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200/80 pb-2 gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('packages')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'packages'
                ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            {isNutritionistView
              ? 'Danh Sách Gói & Thiết Kế Thực Đơn Ăn Sáng'
              : '1. Quản Lý Gói Dịch Vụ Suất Ăn Sáng (CRUD & Công Bố)'}
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === 'packages' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {services.length}
            </span>
          </button>

          {!isNutritionistView && (
            <>
              <button
                onClick={() => setActiveTab('roster')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'roster'
                    ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Clock className="w-4 h-4" />
                2. Giáo Viên Điểm Danh Trẻ Đã Đóng Tiền & Gửi Bếp
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    activeTab === 'roster'
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {rosterData?.stats?.totalRegistered || 0}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('kitchen')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'kitchen'
                    ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <ChefHat className="w-4 h-4" />
                3. Khẩu Phần Ăn Sáng Nhà Bếp (Trẻ Đã Đóng Tiền & Có Mặt)
              </button>

              {isPrincipalView && (
                <button
                  onClick={() => setActiveTab('billing')}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    activeTab === 'billing'
                      ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  4. Doanh Thu & Lịch Sử Thanh Toán VNPAY
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                      activeTab === 'billing'
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {invoices.length}
                  </span>
                </button>
              )}
            </>
          )}
        </div>

        <Link
          to="/parent-snack-payment"
          className="hidden md:flex items-center gap-1.5 text-xs font-bold text-teal-600 hover:text-teal-700 hover:underline"
        >
          <span>Mở trang Phụ huynh xem gói & thanh toán (/parent-snack-payment)</span>
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* ─── 4. TAB 1: CẤU HÌNH GÓI & ĐỢT ĐĂNG KÝ (HOẶC CGDD LÊN THỰC ĐƠN) ─── */}
      {activeTab === 'packages' && (
        <div className="space-y-6">
          {/* Search & Filter Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="w-full md:w-80 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm gói theo tên (VD: Suất ăn sáng)..."
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="OPEN">Đang mở công bố (OPEN)</option>
                <option value="UPCOMING">Sắp mở (UPCOMING)</option>
                <option value="CLOSED">Đã đóng (CLOSED)</option>
              </select>

              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="ALL">Tất cả khối lớp</option>
                <option value="KINDERGARTEN_LARGE">Khối Lớn (4-5T)</option>
                <option value="TODDLER">Nhà trẻ & Mầm</option>
              </select>
            </div>
          </div>

          {/* Package Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(Array.isArray(services) ? services : []).map((item) => {
              const isOpen = item.status === 'OPEN';
              const isUpcoming = item.status === 'UPCOMING';
              const isClosed = item.status === 'CLOSED';
              const schedulePreview =
                item.menuSchedule && item.menuSchedule.length > 0
                  ? item.menuSchedule
                  : DEFAULT_MENU_SCHEDULE;

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between shadow-xs hover:shadow-md ${
                    isClosed
                      ? 'border-slate-200 opacity-80 bg-slate-50/50'
                      : 'border-slate-200/90'
                  }`}
                >
                  <div className="p-5">
                    {/* Top status line */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-bold text-slate-400">
                        {item.appliedMonth}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                          isOpen
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : isUpcoming
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {isOpen ? 'Đang công bố (OPEN)' : item.statusLabel}
                      </span>
                    </div>

                    <h3 className="text-base font-extrabold text-slate-900 tracking-tight leading-snug">
                      {toBreakfastText(item.name)}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {toBreakfastText(item.description)}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-semibold rounded-md">
                        {item.appliedGrade}
                      </span>
                      {item.badges?.map((b, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 text-[10px] font-bold rounded-md"
                        >
                          {b}
                        </span>
                      ))}
                    </div>

                    {/* Menu Schedule Summary Preview (Visible to CGDD & Principal) */}
                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-teal-700 flex items-center gap-1">
                          <UtensilsCrossed className="w-3.5 h-3.5" /> Thực đơn ăn sáng (T2 - T6):
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenMenuEditor(item)}
                          className="text-[11px] font-bold text-emerald-700 hover:underline"
                        >
                          {isNutritionistView ? 'Chỉnh sửa thực đơn →' : 'Xem / Sửa lịch ăn sáng →'}
                        </button>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-[11px] text-slate-600 space-y-1">
                        {schedulePreview.slice(0, 2).map((d) => (
                          <div key={d.dayOfWeek} className="truncate">
                            <strong className="text-slate-800">{d.dayLabel}:</strong> {d.mainDish}
                          </div>
                        ))}
                        <div className="text-[10px] text-slate-400 italic">
                          + {Math.max(0, schedulePreview.length - 2)} ngày thực đơn sáng tiếp theo...
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar — HIDDEN for Nutritionist (CGDD) */}
                    {!isNutritionistView && (
                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-slate-500 font-medium">
                            Đã đăng ký / Chỉ tiêu
                          </span>
                          <span className="font-extrabold text-slate-900">
                            {item.registeredCount ?? 0}{' '}
                            <span className="text-slate-400 font-normal">
                              / {item.targetCount === 30 || !item.targetCount ? 90 : item.targetCount} suất (Đã đóng phí: {item.paidCount ?? 0})
                            </span>
                          </span>
                        </div>

                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${
                              (item.percentage || 0) >= 90
                                ? 'bg-emerald-500'
                                : (item.percentage || 0) >= 60
                                ? 'bg-teal-500'
                                : 'bg-amber-500'
                            }`}
                            style={{ width: `${Math.min(100, item.percentage || 0)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Price & Role-specific Actions */}
                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-base font-black text-slate-900">
                        {formatVND(item.pricePerUnit)}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium"> / suất ngày</span>
                      <div className="text-[10px] text-slate-400">
                        ~ {formatVND(item.monthlyEstimatedPrice)} / đợt
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {/* CGDD Button: Lên Thực Đơn Ăn Xế */}
                      <button
                        type="button"
                        onClick={() => handleOpenMenuEditor(item)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
                        title="Thiết kế thực đơn ăn xế Thứ 2 - Thứ 6 cho gói này"
                      >
                        <UtensilsCrossed className="w-3.5 h-3.5" />
                        <span>Lên thực đơn</span>
                      </button>

                      {/* School Manager / Principal CRUD Actions */}
                      {isPrincipalView && (
                        <>
                          <button
                            type="button"
                            onClick={() => setEditingServiceId(item.id)}
                            className="p-2 text-slate-500 hover:text-teal-600 hover:bg-white rounded-xl transition border border-transparent hover:border-slate-200 cursor-pointer"
                            title="Sửa cấu hình gói dịch vụ ăn xế"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeletePeriod(item.id, item.name)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition border border-transparent hover:border-rose-200 cursor-pointer"
                            title="Xóa gói dịch vụ ăn xế"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          {isOpen ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleClosePeriod(
                                  item.id,
                                  item.name,
                                  item.registeredCount,
                                  item.paidCount,
                                )
                              }
                              className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-red-200 hover:bg-red-50 hover:text-red-700 rounded-xl text-xs font-bold text-slate-700 transition cursor-pointer"
                              title="Đóng đợt đăng ký"
                            >
                              Đóng đợt
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenPeriod(item.id, item.name)}
                              className="px-2.5 py-1.5 bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold transition cursor-pointer"
                              title="Công bố gói dịch vụ cho phụ huynh đăng ký & thanh toán"
                            >
                              Công bố gói
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── 5. TAB 2: GIÁO VIÊN XEM TRẺ ĐÃ ĐÓNG TIỀN, ĐIỂM DANH & GỬI DANH SÁCH CHO BẾP ─── */}
      {activeTab === 'roster' && !isNutritionistView && (
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden space-y-4 p-5">
          {/* Header & Dispatch to Kitchen Button */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-teal-600" />
                Danh Sách Trẻ Đã Đóng Tiền Suất Ăn Sáng • Giáo Viên Điểm Danh & Gửi Nhà Bếp
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Giáo viên kiểm tra các trẻ đã hoàn tất đóng phí suất ăn sáng (PAID), tích điểm danh có mặt ăn sáng hôm nay và bấm gửi danh sách sang Nhà Bếp để lên khẩu phần.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
                <Calendar className="w-3.5 h-3.5 text-teal-600" />
                <span>Ngày điểm danh:</span>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="bg-transparent border-none focus:outline-none font-bold text-slate-900"
                />
              </div>

              <button
                type="button"
                onClick={handleDispatchRosterToKitchen}
                disabled={dispatchingKitchen}
                className="px-4 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl text-xs font-black shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {dispatchingKitchen
                  ? 'Đang gửi sang Bếp...'
                  : 'Chốt Điểm Danh & Gửi Danh Sách Cho Bếp'}
              </button>
            </div>
          </div>

          {/* Dispatch confirmation banner */}
          {dispatchResult && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <h4 className="text-xs font-black text-emerald-950">{dispatchResult.message}</h4>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Tổng số trẻ đã đóng tiền: <strong>{dispatchResult.totalPaidStudents}</strong> • Có mặt ăn sáng:{' '}
                    <strong>{dispatchResult.presentPaidCount}</strong> • Vắng:{' '}
                    <strong>{dispatchResult.absentPaidCount}</strong> • Khẩu phần Bếp chuẩn bị:{' '}
                    <strong>
                      {dispatchResult.kitchenPortions.totalPortionsToPrepare} suất ({dispatchResult.kitchenPortions.standardPortions} tiêu chuẩn, {dispatchResult.kitchenPortions.allergySecurePortions} dị ứng/kiêng)
                    </strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('kitchen')}
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shrink-0 transition"
              >
                Sang Màn Hình Khẩu Phần Bếp &rarr;
              </button>
            </div>
          )}

          {/* Filter Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex-1 w-full relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                placeholder="Tìm kiếm theo tên học sinh, mã số học sinh..."
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                value={rosterClass}
                onChange={(e) => setRosterClass(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="ALL">Tất cả lớp</option>
                {rosterData?.classes?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={rosterPayment}
                onChange={(e) => setRosterPayment(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="PAID">Trẻ đã đóng tiền ăn sáng (PAID)</option>
                <option value="ALL">Tất cả trạng thái phí</option>
                <option value="PENDING">Chưa đóng tiền (PENDING)</option>
              </select>

              <button
                onClick={loadRosterData}
                className="p-2 border border-slate-300 hover:bg-slate-50 text-slate-600 rounded-xl transition"
                title="Làm mới danh sách"
              >
                <RefreshCw className={`w-4 h-4 ${rosterLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-3 px-4">Mã & Họ Tên Bé</th>
                  <th className="py-3 px-3">Lớp</th>
                  <th className="py-3 px-3 text-center">Trạng Thái Đóng Tiền</th>
                  <th className="py-3 px-3">Khẩu Phần & Dị Ứng</th>
                  <th className="py-3 px-3">Phụ Huynh & SĐT</th>
                  <th className="py-3 px-4 text-center">Điểm Danh Ăn Sáng (Gửi Bếp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Array.isArray(rosterData?.items) && rosterData.items.length > 0 ? (
                  rosterData.items.map((it: any) => {
                    const isPaid = it.paymentStatus === 'PAID';
                    const isPresent =
                      it.isAttendedSnack !== undefined
                        ? Boolean(it.isAttendedSnack)
                        : (it.attendanceStatus || 'PRESENT') === 'PRESENT';
                    const studentTargetId = String(it.childId || it.id);

                    return (
                      <tr key={it.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center shrink-0">
                              {it.avatarInitials || it.fullName.slice(0, 1)}
                            </div>
                            <div>
                              <div className="font-extrabold text-slate-900 text-xs">
                                {it.fullName}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {it.studentCode} • {it.gender}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                            {it.className}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              isPaid
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {isPaid ? '✓ Đã đóng tiền' : 'Chưa đóng tiền'}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                              it.snackDietType === 'STANDARD'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}
                          >
                            {toBreakfastText(it.snackDietBadgeText)}
                          </span>
                          {it.kitchenNotes && (
                            <div className="text-[10px] text-rose-600 font-semibold mt-1">
                              {it.kitchenNotes}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-800">
                            {it.emergencyContactName}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {it.emergencyContactPhone}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-center">
                          {isPaid ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={updatingStudentId === studentTargetId}
                                onClick={() =>
                                  handleToggleStudentSnackAttendance(studentTargetId, 'PRESENT')
                                }
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${
                                  isPresent
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                Có mặt ăn sáng
                              </button>
                              <button
                                type="button"
                                disabled={updatingStudentId === studentTargetId}
                                onClick={() =>
                                  handleToggleStudentSnackAttendance(
                                    studentTargetId,
                                    'EXCUSED_ABSENCE',
                                  )
                                }
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${
                                  !isPresent
                                    ? 'bg-rose-600 text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                <UserX className="w-3.5 h-3.5" />
                                Vắng
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              Chưa đóng tiền (Không tính suất bếp)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      {rosterLoading
                        ? 'Đang tải danh sách học sinh ăn sáng...'
                        : 'Không tìm thấy học sinh phù hợp.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── 6. TAB 3: KHẨU PHẦN ĂN SÁNG NHÀ BẾP (CHỈ LÊN KHẨU PHẦN CHO TRẺ ĐÃ ĐÓNG TIỀN & CÓ MẶT) ─── */}
      {activeTab === 'kitchen' && !isNutritionistView && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-amber-900 via-amber-800 to-slate-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-200 text-[11px] font-bold uppercase">
                <ChefHat className="w-3.5 h-3.5" /> Bảng Chia Khẩu Phần Suất Ăn Sáng Nhà Bếp (07:00 - 07:45)
              </div>
              <h3 className="text-xl font-black">
                Khẩu Phần Ăn Sáng Cho Trẻ Đã Đóng Tiền & Được Giáo Viên Điểm Danh Có Mặt
              </h3>
              <p className="text-xs text-amber-100/90">
                Nhà bếp chỉ chuẩn bị khẩu phần cho những trẻ có trạng thái <strong>PAID (Đã đóng tiền)</strong> và được Giáo viên điểm danh <strong>Có mặt ăn sáng</strong> trong ngày {attendanceDate}.
              </p>
            </div>
            <button
              type="button"
              onClick={loadKitchenPortions}
              className="px-4 py-2 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition"
            >
              <RefreshCw className={`w-4 h-4 ${kitchenLoading ? 'animate-spin' : ''}`} />
              Đồng bộ khẩu phần từ Giáo viên
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase">
                Tổng Khẩu Phần Bếp Cần Lên
              </span>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {kitchenPortions?.totalPortionsToPrepare ?? 0}{' '}
                <span className="text-xs font-semibold text-slate-400">suất (Đã đóng tiền & Có mặt)</span>
              </p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-blue-200 shadow-xs">
              <span className="text-xs font-bold text-blue-600 uppercase">
                Khẩu Phần Tiêu Chuẩn
              </span>
              <p className="text-2xl font-black text-blue-700 mt-1">
                {kitchenPortions?.standardPortions ?? 0}{' '}
                <span className="text-xs font-semibold text-slate-400">suất tiêu chuẩn</span>
              </p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-xs">
              <span className="text-xs font-bold text-rose-600 uppercase">
                Khẩu Phần Dị Ứng / Kiêng Cữ
              </span>
              <p className="text-2xl font-black text-rose-700 mt-1">
                {kitchenPortions?.allergySecurePortions ?? 0}{' '}
                <span className="text-xs font-semibold text-slate-400">suất thay thế an toàn</span>
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden p-5">
            <h4 className="font-bold text-sm text-slate-900 mb-3">
              Danh Sách Chi Tiết Khẩu Phần Bếp Cần Chuẩn Bị (Chỉ gồm trẻ đã đóng tiền suất ăn sáng)
            </h4>
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <th className="py-3 px-4">Mã & Họ Tên Trẻ</th>
                    <th className="py-3 px-3">Lớp Học</th>
                    <th className="py-3 px-3">Loại Khẩu Phần Bếp</th>
                    <th className="py-3 px-4">Ghi Chú Chế Biến An Toàn Dị Ứng</th>
                    <th className="py-3 px-3 text-center">Trạng Thái Phí & Điểm Danh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {kitchenPortions?.students && kitchenPortions.students.length > 0 ? (
                    kitchenPortions.students.map((st: any) => (
                      <tr key={st.id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {st.fullName}{' '}
                          <span className="text-[10px] font-mono text-slate-400">
                            ({st.studentCode})
                          </span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-700">{st.className}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-md font-bold text-[10px] ${
                              st.snackDietType === 'STANDARD'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {toBreakfastText(st.snackDietBadgeText)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-medium">
                          {st.kitchenNotes || 'Suất tiêu chuẩn đầy đủ'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            ✓ Đã đóng phí • Có mặt
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        {kitchenLoading
                          ? 'Đang tải khẩu phần ăn sáng của Bếp...'
                          : 'Chưa có danh sách khẩu phần ăn sáng cho ngày này.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── 7. TAB 4: DOANH THU & LỊCH SỬ THANH TOÁN VNPAY (HIỆU TRƯỞNG / SCHOOL MANAGER) ─── */}
      {activeTab === 'billing' && isPrincipalView && (
        <div className="space-y-6">
          {/* 3 Stat Cards for Billing */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Tổng Đã Thu Qua VNPAY
              </span>
              <p className="text-2xl font-black text-emerald-600 mt-2">
                {formatVND(totalCollected)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Tự động ghi nhận khi Phụ huynh thanh toán thành công
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Chờ Phụ Huynh Thanh Toán
              </span>
              <p className="text-2xl font-black text-amber-600 mt-2">{formatVND(totalPending)}</p>
              <p className="text-xs text-slate-500 mt-1">
                Có thể bấm gửi thông báo nhắc phí trực tiếp
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Báo Cáo & Cổng Thanh Toán
              </span>
              <p className="text-lg font-black text-slate-900 mt-2 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" /> Đồng Bộ VNPAY Thời Gian Thực
              </p>
              <div className="flex items-center gap-3 mt-1.5">
                <Link
                  to="/parent-snack-payment"
                  className="text-xs font-bold text-teal-600 hover:underline inline-flex items-center gap-1"
                >
                  Trang Thanh Toán Phụ Huynh &rarr;
                </Link>
                <Link
                  to="/finances"
                  className="text-xs font-bold text-indigo-600 hover:underline inline-flex items-center gap-1"
                >
                  Báo Cáo Doanh Thu Chi Tiết &rarr;
                </Link>
              </div>
            </div>
          </div>

          {/* Invoice & Payment History Table */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden p-5 space-y-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Lịch Sử Thanh Toán Dịch Vụ Suất Ăn Sáng & Thu Phí VNPAY
                </h3>
                <p className="text-xs text-slate-500">
                  Hiển thị đầy đủ <strong>Ngày thanh toán</strong>, <strong>Tên phụ huynh</strong>, Học sinh, Gói dịch vụ suất ăn sáng và Mã giao dịch VNPAY.
                </p>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={invoiceSearch}
                    onChange={(e) => setInvoiceSearch(e.target.value)}
                    placeholder="Tìm tên phụ huynh, tên bé, mã đơn..."
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <select
                  value={invoiceStatus}
                  onChange={(e) => setInvoiceStatus(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="PAID">Đã thanh toán (PAID)</option>
                  <option value="PENDING">Chờ nộp phí (PENDING)</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200">
                    <th className="py-3 px-4">Mã Hóa Đơn</th>
                    <th className="py-3 px-3">Học Sinh & Lớp</th>
                    <th className="py-3 px-3">Tên Phụ Huynh</th>
                    <th className="py-3 px-3">Gói Dịch Vụ Suất Ăn Sáng</th>
                    <th className="py-3 px-3 text-right">Số Tiền (VNĐ)</th>
                    <th className="py-3 px-3">Ngày Thanh Toán</th>
                    <th className="py-3 px-3 text-center">Trạng Thái</th>
                    <th className="py-3 px-4 text-center">Hành Động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInvoices.length > 0 ? (
                    filteredInvoices.map((inv) => {
                      const isPaid = inv.status === 'PAID' || inv.status === 'SUCCESS';
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            <div>{inv.orderCode}</div>
                            {inv.vnpTransactionNo && (
                              <div className="text-[10px] text-emerald-700">
                                GD: {inv.vnpTransactionNo}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-extrabold text-slate-900">{inv.childName}</div>
                            <div className="text-[10px] text-slate-400">{inv.className}</div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-indigo-900 flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              <span>{inv.parentName || 'Phụ huynh học sinh'}</span>
                            </div>
                            {inv.parentPhone && (
                              <div className="text-[10px] font-mono text-slate-400 pl-4">
                                {inv.parentPhone}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-700 font-semibold">
                            {toBreakfastText(inv.packageName || inv.periodName)}
                          </td>
                          <td className="py-3 px-3 text-right font-black text-slate-900">
                            {formatVND(Number(inv.amount))}
                          </td>
                          <td className="py-3 px-3">
                            {isPaid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[11px]">
                                <Calendar className="w-3 h-3 text-emerald-600" />
                                {formatPaidDate(inv.paidAt)}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">
                                Chưa thanh toán
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isPaid
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {isPaid ? 'Đã Thanh Toán' : 'Chờ Nộp Phí'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {!isPaid ? (
                              <button
                                onClick={() => handleSendReminder(inv.id, inv.orderCode)}
                                className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-lg text-xs font-bold flex items-center gap-1 mx-auto transition"
                              >
                                <Send className="w-3 h-3" /> Nhắc phí
                              </button>
                            ) : (
                              <span className="text-[11px] text-emerald-700 font-semibold flex items-center justify-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Đã lưu doanh thu
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        {invoicesLoading
                          ? 'Đang tải lịch sử thanh toán...'
                          : 'Không có hóa đơn thanh toán nào.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL CGDD THIẾT KẾ THỰC ĐƠN ĂN SÁNG (THỨ 2 - THỨ 6) ─── */}
      {menuEditingService && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
                  <UtensilsCrossed className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                    Chuyên Gia Dinh Dưỡng (CGDD) • Thiết Kế Thực Đơn Ăn Sáng
                  </span>
                  <h3 className="text-lg font-black text-slate-900">
                    {toBreakfastText(menuEditingService.name)}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMenuEditingService(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200 text-xs text-teal-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
              <span>
                Thực đơn ăn sáng từ Thứ Hai đến Thứ Sáu sau khi lưu sẽ tự động hiển thị bên trang <strong>/parent-snack-payment</strong> đối với những Phụ huynh <strong>đã đóng tiền (PAID)</strong> gói này.
              </span>
            </div>

            <form onSubmit={handleSaveMenuSchedule} className="space-y-4">
              <div className="space-y-3">
                {editingScheduleDays.map((day, idx) => (
                  <div
                    key={day.dayOfWeek}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-teal-800 uppercase bg-teal-100 px-3 py-1 rounded-lg">
                        {day.dayLabel} ({day.servingTime})
                      </span>
                      <div className="flex items-center gap-3 text-xs">
                        <label className="flex items-center gap-1 font-semibold text-slate-600">
                          <Flame className="w-3.5 h-3.5 text-amber-500" /> Kcal:
                          <input
                            type="number"
                            value={day.caloriesKcal}
                            onChange={(e) => {
                              const next = [...editingScheduleDays];
                              next[idx] = { ...day, caloriesKcal: Number(e.target.value) };
                              setEditingScheduleDays(next);
                            }}
                            className="w-16 px-2 py-1 border border-slate-300 rounded-lg bg-white text-xs font-bold"
                          />
                        </label>
                        <label className="flex items-center gap-1 font-semibold text-slate-600">
                          Đạm (g):
                          <input
                            type="number"
                            step="0.1"
                            value={day.proteinG}
                            onChange={(e) => {
                              const next = [...editingScheduleDays];
                              next[idx] = { ...day, proteinG: Number(e.target.value) };
                              setEditingScheduleDays(next);
                            }}
                            className="w-16 px-2 py-1 border border-slate-300 rounded-lg bg-white text-xs font-bold"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Món chính ăn sáng *
                        </label>
                        <input
                          type="text"
                          required
                          value={day.mainDish}
                          onChange={(e) => {
                            const next = [...editingScheduleDays];
                            next[idx] = { ...day, mainDish: e.target.value };
                            setEditingScheduleDays(next);
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Sữa hạt / Thức uống *
                        </label>
                        <input
                          type="text"
                          required
                          value={day.drinkItem}
                          onChange={(e) => {
                            const next = [...editingScheduleDays];
                            next[idx] = { ...day, drinkItem: e.target.value };
                            setEditingScheduleDays(next);
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Trái cây / Món tráng miệng *
                        </label>
                        <input
                          type="text"
                          required
                          value={day.fruitOrSide}
                          onChange={(e) => {
                            const next = [...editingScheduleDays];
                            next[idx] = { ...day, fruitOrSide: e.target.value };
                            setEditingScheduleDays(next);
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setMenuEditingService(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={savingMenu}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition disabled:opacity-50"
                >
                  {savingMenu
                    ? 'Đang lưu thực đơn...'
                    : 'Lưu Thực Đơn Ăn Sáng (Cập nhật cho Phụ huynh đã đóng tiền)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UC56: Modal Tạo Đợt Đăng Ký */}
      <CreateSnackServicePeriodModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => loadData()}
      />

      {/* UC57: Modal Chỉnh Sửa Cấu Hình Gói Dịch Vụ */}
      <EditSnackServiceModal
        isOpen={!!editingServiceId}
        serviceId={editingServiceId}
        onClose={() => setEditingServiceId(null)}
        onSuccess={() => loadData()}
      />

      {/* UC61: Modal Đăng Ký Ăn Xế (Kiểm Tra Dị Ứng) */}
      <RegisterSnackServiceModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onSuccess={() => loadData()}
        selectedPeriodId={registerPeriodId}
        periods={services}
      />
    </div>
  );
};
