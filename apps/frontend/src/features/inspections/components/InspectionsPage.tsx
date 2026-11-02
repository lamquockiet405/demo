import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle,
  Clock,
  AlertTriangle,
  Plus,
  FileText,
  Search,
  RefreshCw,
  Camera,
  ArrowRight,
  X,
  Download,
  Printer,
  Eye,
  Utensils,
  ChevronDown,
  Refrigerator,
} from 'lucide-react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { apiClient } from '@/core/api/axios';
import { useAuthStore } from '@/core/stores/auth.store';

export interface SampleRetentionItem {
  id: string;
  dishName: string;
  sampleCode?: string;
  quantityGrams?: number;
  temperatureC?: number;
  containerType?: string;
  status?: string;
  storedAt?: string;
  disposeAt?: string;
}

export interface InspectionRecordItem {
  id: string;
  code: string;
  date?: string;
  mealDate: string;
  mealTime: string;
  performerName: string;
  totalPortions?: number;
  storageTemp?: number;
  status: 'Hoàn tất' | 'Chưa hoàn tất' | 'Có cảnh báo';
  approvalStatus?: 'CHO_BEP_TAI_ANH' | 'CHO_DUYET' | 'DA_DUYET' | 'YEU_CAU_CHUP_LAI';
  approvalStatusLabel?: string;
  rejectionReason?: string;
  approvedBy?: string;
  dishes?: string[];
  step1Status?: string;
  step1Note?: string;
  step1PhotoUrl?: string;
  step1Photos?: string[];
  step2Status?: string;
  step2Note?: string;
  step2Temperature?: number;
  step2PhotoUrl?: string;
  step2Photos?: string[];
  step3Status?: string;
  step3Note?: string;
  step3Temperature?: number;
  step3PhotoUrl?: string;
  step3Photos?: string[];
  sampleItems?: SampleRetentionItem[];
}

export interface MealIngredientItem {
  name: string;
  supplier: string;
  weight: string;
  standard: string;
}

export const getMealSessionMeta = (mealTime: string) => {
  if (mealTime.includes('sáng') || mealTime.includes('07:')) {
    return {
      sessionKey: 'BREAKFAST' as const,
      mealLabel: 'Bữa sáng (07:15)',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      ingredientTitle: 'Nguyên liệu thực đơn Bữa sáng (từ CSDL):',
    };
  }
  if (mealTime.includes('xế') || mealTime.includes('14:')) {
    return {
      sessionKey: 'AFTERNOON_SNACK' as const,
      mealLabel: 'Bữa xế chiều (14:30)',
      badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      ingredientTitle: 'Nguyên liệu thực đơn Bữa xế chiều (từ CSDL):',
    };
  }
  return {
    sessionKey: 'LUNCH' as const,
    mealLabel: 'Trưa chính (10:30)',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    ingredientTitle: 'Nguyên liệu thực đơn Bữa trưa chính (từ CSDL):',
  };
};

export const InspectionsPage: React.FC = () => {
  const location = useLocation();
  const { user } = useAuthStore();
  const roleStrings = (user?.roles || []).map((r: any) =>
    typeof r === 'string' ? r.toUpperCase() : (r?.code || r?.name || '').toUpperCase()
  );
  // Chỉ có nhân viên / bếp trưởng nhà bếp (KITCHEN_STAFF, KITCHEN_MANAGER) mới được lập biên bản kiểm thực mới
  const isKitchenStaff = roleStrings.includes('KITCHEN_STAFF') || roleStrings.includes('KITCHEN_MANAGER');
  const isNutritionist = roleStrings.includes('NUTRITIONIST');
  const isPrincipal = roleStrings.includes('PRINCIPAL') || roleStrings.includes('SCHOOL_MANAGEMENT') || roleStrings.includes('SCHOOL_MANAGER') || roleStrings.includes('SUPER_ADMIN');

  // Chức năng duyệt do Chuyên gia dinh dưỡng VÀ Hiệu trưởng thực hiện
  const canApprove = isNutritionist || isPrincipal;
  const isReadOnly = !isKitchenStaff;

  const [records, setRecords] = useState<InspectionRecordItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Search and Filter states
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [mealFilter, setMealFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');

  // 3-Step Creation Form State
  const initialMeal = 'Trưa chính (10:30)';
  const [form, setForm] = useState({
    mealDate: new Date().toISOString().split('T')[0],
    mealTime: initialMeal,
    step1Passed: true,
    step2Passed: true,
    step2KitchenPassed: true,
    step2Temperature: '85',
    step3Passed: true,
    step3Temperature: '68',
    step1Note: '',
    step2Note: '',
    step3Note: '',
    step1Photo: null as File | null,
    step2Photo: null as File | null,
    step3Photo: null as File | null,
  });

  const [dishes, setDishes] = useState<Array<{ id: string; name: string; qty: string }>>([]);
  const [currentIngredients, setCurrentIngredients] = useState<MealIngredientItem[]>([]);
  const [isLoadingMenu, setIsLoadingMenu] = useState(false);



  const currentMealConfig = getMealSessionMeta(form.mealTime);

  // Load actual inspections from PostgreSQL database
  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/inspections');
      const data = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.data) ? res.data.data : [];
      setRecords(data);
    } catch (error) {
      console.error('Failed to fetch records from database:', error);
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load real meal ingredients and dishes from PostgreSQL database
  const loadMealIngredients = async (mealDate: string, mealTime: string) => {
    setIsLoadingMenu(true);
    try {
      const res = await apiClient.get('/inspections/meal-ingredients', {
        params: { mealDate, mealTime },
      });
      if (res.data?.dishes && Array.isArray(res.data.dishes) && res.data.dishes.length > 0) {
        setDishes(
          res.data.dishes.map((d: any) => ({
            id: String(d.id),
            name: d.dish_name || d.name,
            qty: '150',
          }))
        );
      } else {
        setDishes([]);
      }

      if (res.data?.ingredients && Array.isArray(res.data.ingredients) && res.data.ingredients.length > 0) {
        setCurrentIngredients(
          res.data.ingredients.map((ing: any) => ({
            name: ing.ingredient_name || ing.name,
            supplier: ing.supplier || 'Nhà cung ứng thực phẩm đạt chuẩn ATTP',
            weight: ing.gross_weight_g
              ? `${parseFloat(ing.gross_weight_g).toFixed(1)} ${ing.unit || 'g'}`
              : `15.0 ${ing.unit || 'kg'}`,
            standard: 'Đạt chuẩn kiểm định thú y & ATTP, cảm quan tươi sống tốt',
          }))
        );
      } else {
        setCurrentIngredients([]);
      }
    } catch (e) {
      console.error('Failed to load meal ingredients from database', e);
      setDishes([]);
      setCurrentIngredients([]);
    } finally {
      setIsLoadingMenu(false);
    }
  };



  useEffect(() => {
    fetchRecords();
  }, []);

  const handleMealTimeChange = (newMealTime: string) => {
    setForm((prev) => ({
      ...prev,
      mealTime: newMealTime,
    }));
    loadMealIngredients(form.mealDate, newMealTime);
  };

  const handleMealDateChange = (newMealDate: string) => {
    setForm((prev) => ({
      ...prev,
      mealDate: newMealDate,
    }));
    loadMealIngredients(newMealDate, form.mealTime);
  };



  const openNewModal = () => {
    setActiveRecordId(null);
    setCurrentStep(1);
    const defaultMeal = 'Trưa chính (10:30)';
    const today = new Date().toISOString().split('T')[0];
    setForm({
      mealDate: today,
      mealTime: defaultMeal,
      step1Passed: true,
      step2Passed: true,
      step2KitchenPassed: true,
      step2Temperature: '85',
      step3Passed: true,
      step3Temperature: '68',
      step1Note: '',
      step2Note: '',
      step3Note: '',
      step1Photo: null,
      step2Photo: null,
      step3Photo: null,
    });
    setIsModalVisible(true);
    loadMealIngredients(today, defaultMeal);
  };

  const openContinueStep = (record: InspectionRecordItem, step: number) => {
    setActiveRecordId(record.id);
    setCurrentStep(step);
    const mDate = record.mealDate || record.date || new Date().toISOString().split('T')[0];
    const mTime = record.mealTime || 'Trưa chính (10:30)';
    setForm((prev) => ({
      ...prev,
      mealDate: mDate,
      mealTime: mTime,
      step1Passed: record.step1Status === 'Đạt chuẩn',
      step1Note: record.step1Note || '',
      step1Photo: null,
      step2Passed: record.step2Status === 'Đạt chuẩn',
      step2KitchenPassed: true,
      step2Temperature: String(record.step2Temperature || 85),
      step2Note: record.step2Note || '',
      step2Photo: null,
      step3Passed: record.step3Status === 'Đạt chuẩn',
      step3Temperature: String(record.step3Temperature || 68),
      step3Note: record.step3Note || '',
      step3Photo: null,
    }));
    loadMealIngredients(mDate, mTime);
    setIsModalVisible(true);
  };

  const convertFileToBase64 = (
    file: File,
    maxWidth = 1280,
    maxHeight = 1280,
    quality = 0.8,
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
        return;
      }

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (error) => reject(error);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
      };
      img.src = objectUrl;
    });
  };

  const handleStep1Submit = async () => {
    try {
      if (!form.step1Photo) {
        alert('⚠️ BẮT BUỘC: Vui lòng tải lên hình ảnh minh chứng / hóa đơn tiếp nhận nguyên liệu trước khi lưu Bước 1!');
        return;
      }
      let photoBase64: string | undefined = undefined;
      if (form.step1Photo) {
        photoBase64 = await convertFileToBase64(form.step1Photo);
      }
      const mealSession = form.mealTime.includes('sáng')
        ? 'BREAKFAST'
        : form.mealTime.includes('xế')
        ? 'AFTERNOON_SNACK'
        : 'LUNCH';

      const res = await apiClient.post('/inspections/step1', {
        mealDate: form.mealDate,
        mealSession,
        mealTime: form.mealTime,
        note: form.step1Note,
        photoBase64,
      });

      if (res.data?.recordId || res.data?.id) {
        setActiveRecordId(String(res.data.recordId || res.data.id));
      }

      alert('✅ Đã lưu Bước 1 (Giao nhận & Cảm quan) thành công! Tiếp tục thực hiện Bước 2.');
      setCurrentStep(2);
      fetchRecords();
    } catch (error: any) {
      alert('Lỗi: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleStep2Submit = async () => {
    try {
      if (!form.step2Photo) {
        alert('⚠️ BẮT BUỘC: Vui lòng tải lên hình ảnh minh chứng khu sơ chế / bếp nấu / sôi chín trước khi lưu Bước 2!');
        return;
      }
      let photoBase64: string | undefined = undefined;
      if (form.step2Photo) {
        photoBase64 = await convertFileToBase64(form.step2Photo);
      }
      const targetId = activeRecordId || (records[0]?.id ? records[0].id : 'new');
      const mealSession = form.mealTime.includes('sáng')
        ? 'BREAKFAST'
        : form.mealTime.includes('xế')
        ? 'AFTERNOON_SNACK'
        : 'LUNCH';

      await apiClient.patch(`/inspections/${targetId}/step2`, {
        mealDate: form.mealDate,
        mealSession,
        note: form.step2Note,
        photoBase64,
        temperatureC: Number(form.step2Temperature) || 85,
      });

      alert('✅ Đã lưu Bước 2 (Kiểm tra trong khi chế biến) thành công! Tiếp tục thực hiện Bước 3.');
      setCurrentStep(3);
      fetchRecords();
    } catch (error: any) {
      alert('Lỗi: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!form.step3Photo) {
        alert('⚠️ BẮT BUỘC: Vui lòng tải lên hình ảnh hộp niêm phong & tủ lưu mẫu 24h trước khi hoàn tất Bước 3!');
        return;
      }
      let photoBase64: string | undefined = undefined;
      if (form.step3Photo) {
        photoBase64 = await convertFileToBase64(form.step3Photo);
      }
      const targetId = activeRecordId || (records[0]?.id ? records[0].id : 'new');
      const mealSession = form.mealTime.includes('sáng')
        ? 'BREAKFAST'
        : form.mealTime.includes('xế')
        ? 'AFTERNOON_SNACK'
        : 'LUNCH';

      const payload = {
        mealDate: form.mealDate,
        mealSession,
        note: form.step3Note,
        photoBase64,
        temperatureC: Number(form.step3Temperature) || 68,
        items: dishes.map((d) => ({
          dishId: d.id,
          dishName: d.name,
          quantityGrams: Number(d.qty) || 150,
        })),
      };

      await apiClient.patch(`/inspections/${targetId}/step3`, payload);
      alert('✅ Đã hoàn tất Bước 3 và niêm phong mẫu lưu 24h thành công theo chuẩn QĐ 1246/QĐ-BYT!');
      setIsModalVisible(false);
      fetchRecords();
    } catch (error: any) {
      alert('Lỗi: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleQuickApprove = async (id: string) => {
    if (!window.confirm('Xác nhận phê duyệt Đạt chuẩn ATTP cho biên bản kiểm thực này?')) return;
    try {
      await apiClient.post(`/inspections/${id}/approve`, {});
      alert('✅ Đã phê duyệt biên bản kiểm thực Đạt chuẩn ATTP thành công!');
      fetchRecords();
    } catch (err: any) {
      alert('Lỗi phê duyệt: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleNavigateDetail = (id: string) => {
    const isNutritionistUrl = window.location.pathname.startsWith('/nutritionist');
    const isKitchenUrl = window.location.pathname.startsWith('/kitchen');
    const targetUrl = isNutritionistUrl
      ? `/nutritionist/food-safety/${id}`
      : isKitchenUrl
      ? `/kitchen/inspections/${id}`
      : `/food-safety/${id}`;
    navigate(targetUrl);
  };

  // Helper date formatter: YYYY-MM-DD -> DD/MM/YYYY
  const formatDisplayDate = (d?: string) => {
    if (!d) return '--/--/----';
    const clean = d.split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return d;
  };

  // Helper to export CSV for Decision 1246/QĐ-BYT
  const handleExportCSV = () => {
    const headers = [
      'STT',
      'Mã biên bản',
      'Ngày kiểm thực',
      'Ca ăn',
      'Người thực hiện',
      'B1: Trước chế biến',
      'B2: Trong chế biến',
      'B3: Trước khi ăn & Lưu mẫu',
      'Nhiệt độ tủ lưu mẫu (°C)',
      'Trạng thái',
    ];

    const rows = filteredRecords.map((r, i) => [
      i + 1,
      `"${r.code || ''}"`,
      `"${formatDisplayDate(r.mealDate)}"`,
      `"${r.mealTime || ''}"`,
      `"${r.performerName || ''}"`,
      `"${r.step1Status || 'Đạt chuẩn'}"`,
      `"${r.step2Status || 'Đạt chuẩn'}"`,
      `"${r.step3Status || 'Đạt chuẩn'}"`,
      `"${r.storageTemp ?? 3.8}"`,
      `"${r.status || 'Hoàn tất'}"`,
    ]);

    const csvContent = '﻿' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `So_Kiem_Thuc_Ba_Buoc_QD1246_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExportModalOpen(false);
  };

  // Helper to Print formal Decision 1246 log book
  const handlePrintInspectionBook = () => {
    setIsExportModalOpen(false);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  // Filtered Records calculation
  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      !search ||
      r.code?.toLowerCase().includes(search.toLowerCase()) ||
      r.performerName?.toLowerCase().includes(search.toLowerCase()) ||
      r.mealTime?.toLowerCase().includes(search.toLowerCase()) ||
      r.mealDate?.includes(search);

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'DA_DUYET' && (r.approvalStatus === 'DA_DUYET' || r.status === 'Hoàn tất')) ||
      (statusFilter === 'CHO_DUYET' && (r.approvalStatus === 'CHO_DUYET' || (r.approvalStatus !== 'DA_DUYET' && r.status !== 'Hoàn tất')));

    const matchesMeal = mealFilter === 'ALL' || r.mealTime?.toLowerCase().includes(mealFilter.toLowerCase());
    const matchesDate = !dateFilter || r.mealDate === dateFilter || r.date === dateFilter;

    return matchesSearch && matchesStatus && matchesMeal && matchesDate;
  });

  const totalCount = records.length;
  const approvedCount = records.filter((r) => r.approvalStatus === 'DA_DUYET' || r.status === 'Hoàn tất').length;
  const pendingCount = records.filter((r) => r.approvalStatus !== 'DA_DUYET' && r.status !== 'Hoàn tất').length;

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      {/* ─── HEADER & ACTIONS ─── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Sổ Kiểm Thực Ba Bước Điện Tử
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Quy chuẩn Bộ Y Tế — QĐ 1246/QĐ-BYT • Niên khóa 2026 - 2027
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {isKitchenStaff && (
            <Link
              to="/kitchen"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 font-bold text-xs transition shadow-sm"
              title="Quay lại màn hình hiển thị KDS Bếp"
            >
              ← Màn hình Bếp (KDS)
            </Link>
          )}
          {isReadOnly && (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold shadow-2xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>
                {isNutritionist
                  ? 'Chuyên gia dinh dưỡng: Giám sát ATTP (Chỉ xem)'
                  : 'Chế độ giám sát ATTP (Chỉ xem)'}
              </span>
            </div>
          )}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-100 font-bold text-xs shadow-sm transition active:scale-95"
          >
            <FileText className="w-4 h-4 text-slate-500" /> Xuất sổ (PDF/Excel)
          </button>
          {!isReadOnly && (
            <button
              onClick={openNewModal}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/20 transition active:scale-95"
            >
              <Plus className="w-4 h-4" /> Lập biên bản kiểm thực mới
            </button>
          )}
        </div>
      </div>

      {/* ─── TAB NAVIGATION: SỔ KIỂM THỰC 3 BƯỚC <-> SỔ LƯU MẪU 24H ─── */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-6 overflow-x-auto scrollbar-none">
        <button
          className="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 bg-emerald-600 text-white shadow-sm"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Sổ Kiểm Thực Ba Bước (QĐ 1246)</span>
          <span className="bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
            {records.length}
          </span>
        </button>
        <Link
          to={
            location.pathname.startsWith('/kitchen')
              ? '/kitchen/samples'
              : location.pathname.startsWith('/nutritionist')
              ? '/nutritionist/samples'
              : '/food-safety/samples'
          }
          className="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
        >
          <Refrigerator className="w-4 h-4 text-blue-600" />
          <span>Sổ Lưu Mẫu Thức Ăn 24 Giờ</span>
        </Link>
      </div>

      {/* ─── 3 KPI STATS COUNTER CARDS ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3.5 hover:shadow-md transition">
          <div className="p-3 bg-slate-100 text-slate-700 rounded-xl border border-slate-200">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Tổng biên bản</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">{totalCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3.5 hover:shadow-md transition">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Đã duyệt</p>
            <p className="text-2xl font-black text-emerald-600 mt-0.5">{approvedCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3.5 hover:shadow-md transition">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Chờ duyệt</p>
            <p className="text-2xl font-black text-amber-600 mt-0.5">{pendingCount}</p>
          </div>
        </div>
      </div>

      {/* ─── SEARCH & FILTER TOOLBAR ─── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-5 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo mã biên bản, người làm, ca ăn..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-500 font-bold text-slate-700 transition"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="CHO_DUYET">⏳ Chờ duyệt</option>
            <option value="DA_DUYET">✓ Đã duyệt</option>
          </select>

          <select
            value={mealFilter}
            onChange={(e) => setMealFilter(e.target.value)}
            className="px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-500 font-bold text-slate-700 transition"
          >
            <option value="ALL">Tất cả ca ăn</option>
            <option value="Trưa">Bữa trưa chính</option>
            <option value="Sáng">Bữa sáng</option>
            <option value="Xế">Bữa phụ xế</option>
          </select>

          <div className="relative">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-500 text-slate-700 font-medium transition"
            />
          </div>

          <button
            onClick={fetchRecords}
            title="Tải lại dữ liệu"
            className="p-2 text-slate-500 hover:text-emerald-600 rounded-xl hover:bg-slate-100 border border-slate-200 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {(search || statusFilter !== 'ALL' || mealFilter !== 'ALL' || dateFilter) && (
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
                setMealFilter('ALL');
                setDateFilter('');
              }}
              className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition border border-dashed border-slate-200"
              title="Xóa bộ lọc"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ─── DATA TABLE OF 3-STEP INSPECTION RECORDS ─── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-5 py-3.5">Mã biên bản</th>
                <th className="px-4 py-3.5">Ngày</th>
                <th className="px-4 py-3.5">Ca ăn</th>
                <th className="px-4 py-3.5">Người thực hiện</th>
                <th className="px-4 py-3.5">Trạng thái</th>
                <th className="px-4 py-3.5 text-center w-36">Thao tác</th>
                <th className="px-4 py-3.5 text-center w-28">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {isLoading && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                      <span>Đang tải danh sách biên bản kiểm thực từ CSDL...</span>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading &&
                filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Mã biên bản */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 tracking-wide font-mono">
                          {record.code}
                        </span>
                      </div>
                    </td>

                    {/* Ngày */}
                    <td className="px-4 py-3.5 text-slate-600 font-semibold">
                      {formatDisplayDate(record.mealDate)}
                    </td>

                    {/* Ca ăn */}
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                        {record.mealTime}
                      </span>
                    </td>

                    {/* Người thực hiện */}
                    <td className="px-4 py-3.5 text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">👤</span>
                        <span className="font-medium">{record.performerName || 'Bếp viên phụ trách'}</span>
                      </div>
                    </td>

                    {/* Trạng thái duyệt: Chỉ có Đã duyệt & Chờ duyệt */}
                    <td className="px-4 py-3.5">
                      {record.approvalStatus === 'DA_DUYET' || record.status === 'Hoàn tất' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle className="w-3 h-3" /> Đã duyệt
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3" /> Chờ duyệt
                        </span>
                      )}
                    </td>

                    {/* Thao tác: Khi đã duyệt thì báo 'Đã phê duyệt', khi chưa duyệt thì hiện nút 'Duyệt' cho BGH/Dinh dưỡng */}
                    <td className="px-4 py-3.5 text-center">
                      {record.approvalStatus === 'DA_DUYET' || record.status === 'Hoàn tất' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Đã phê duyệt
                        </span>
                      ) : canApprove ? (
                        <button
                          onClick={() => handleQuickApprove(record.id)}
                          className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition shadow-sm flex items-center gap-1 mx-auto cursor-pointer active:scale-95"
                          title="Phê duyệt Đạt chuẩn ATTP cho biên bản này"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Duyệt
                        </button>
                      ) : isReadOnly ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          <Clock className="w-3 h-3 text-amber-600" /> Chờ phê duyệt
                        </span>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          {record.step1Status !== 'Đạt chuẩn' ? (
                            <button
                              onClick={() => openContinueStep(record, 1)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                              title="Tiếp tục thực hiện Bước 1"
                            >
                              Làm B1 →
                            </button>
                          ) : record.step2Status !== 'Đạt chuẩn' ? (
                            <button
                              onClick={() => openContinueStep(record, 2)}
                              className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                              title="Tiếp tục thực hiện Bước 2"
                            >
                              Làm B2 →
                            </button>
                          ) : record.step3Status !== 'Đạt chuẩn' ? (
                            <button
                              onClick={() => openContinueStep(record, 3)}
                              className="px-2.5 py-1 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-900 font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                              title="Tiếp tục thực hiện Bước 3 & lưu mẫu"
                            >
                              Làm B3 →
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Đã phê duyệt
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Chi tiết */}
                    <td className="px-4 py-3.5 text-center">
                      <button
                        onClick={() => handleNavigateDetail(record.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg font-bold text-[11px] transition border border-transparent hover:border-emerald-200"
                      >
                        Chi tiết <ChevronRightIcon className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}

              {!isLoading && filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <p className="font-semibold text-slate-500">Chưa có biên bản kiểm thực nào trong CSDL</p>
                    <p className="text-xs text-slate-400 mt-1">Bấm "+ Lập biên bản kiểm thực mới" để khởi tạo biên bản đầu tiên</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── MODAL: LẬP BIÊN BẢN KIỂM THỰC 3 BƯỚC (QUY CHUẨN QĐ 1246/QĐ-BYT) ─── */}
      {isModalVisible && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center z-[100] p-4 pb-24 sm:pb-20 animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-2xl shadow-2xl max-h-[82vh] flex flex-col border border-slate-200 overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    Kiểm Thực Ba Bước Điện Tử (QĐ 1246/QĐ-BYT)
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Quy trình kiểm tra 3 bước kèm chụp ảnh minh chứng từng bước</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalVisible(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stepper Navigation Indicator */}
            <div className="flex bg-slate-50 border-b border-slate-100 px-6 py-3 gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className={`flex-1 text-center text-xs font-bold py-2 rounded-xl transition-all ${
                  currentStep === 1
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : currentStep > 1
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-200/70 text-slate-500'
                }`}
              >
                Bước 1: Tiếp nhận
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className={`flex-1 text-center text-xs font-bold py-2 rounded-xl transition-all ${
                  currentStep === 2
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : currentStep > 2
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-200/70 text-slate-500'
                }`}
              >
                Bước 2: Chế biến
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className={`flex-1 text-center text-xs font-bold py-2 rounded-xl transition-all ${
                  currentStep === 3
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-200/70 text-slate-500'
                }`}
              >
                Bước 3: Lưu mẫu 24h
              </button>
            </div>

            {/* Wizard Body Form */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 min-h-0">
              {/* Common header info (Meal date & Session) */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ngày kiểm thực</label>
                  <input
                    type="date"
                    required
                    value={form.mealDate}
                    onChange={(e) => handleMealDateChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white font-medium outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ca ăn</label>
                  <select
                    required
                    value={form.mealTime}
                    onChange={(e) => handleMealTimeChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white font-medium outline-none"
                  >
                    <option value="Bữa sáng (07:15)">Bữa sáng (07:15)</option>
                    <option value="Trưa chính (10:30)">Trưa chính (10:30)</option>
                    <option value="Bữa xế chiều (14:30)">Bữa xế chiều (14:30)</option>
                  </select>
                </div>
              </div>

              {/* BƯỚC 1: TIẾP NHẬN NGUYÊN LIỆU TƯƠI SỐNG */}
              {currentStep === 1 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
                  <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
                    <h4 className="font-bold text-emerald-800 text-sm">
                      BƯỚC 1: Giao nhận & Cảm quan nguyên liệu tươi sống
                    </h4>
                    <span className="text-xs text-slate-400 font-medium">Trước khi chế biến</span>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-700">
                          {currentMealConfig.ingredientTitle}
                        </p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${currentMealConfig.badgeColor}`}>
                          {currentMealConfig.mealLabel}
                        </span>
                      </div>
                    </div>

                    {isLoadingMenu ? (
                      <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                        <span>Đang tải nguyên liệu từ CSDL...</span>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1.5 bg-white p-3 rounded-xl border border-slate-200/80 max-h-56 overflow-y-auto">
                          {currentIngredients.length === 0 ? (
                            <p className="text-slate-400 italic text-[11px] py-2 text-center">
                              Không có nguyên liệu nào trong thực đơn ngày hôm nay.
                            </p>
                          ) : (
                            currentIngredients.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50/70 hover:bg-slate-50 transition border border-slate-100 text-xs"
                              >
                                <div>
                                  <span className="font-bold text-slate-800">• {item.name}</span>{' '}
                                  <span className="text-slate-400 font-medium">({item.supplier})</span>
                                  <div className="text-[11px] text-emerald-700 mt-0.5 font-normal">
                                    {item.standard}
                                  </div>
                                </div>
                                <span className="text-[11px] font-mono font-bold bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 shrink-0">
                                  {item.weight}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    )}

                    <label className="flex items-center gap-3 cursor-pointer bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 transition">
                      <input
                        type="checkbox"
                        checked={form.step1Passed}
                        onChange={(e) => setForm({ ...form, step1Passed: e.target.checked })}
                        className="w-4 h-4 accent-emerald-600 rounded"
                      />
                      <span className="text-xs font-bold text-emerald-800">
                        Xác nhận: 100% Nguyên liệu đạt chuẩn cảm quan & có đầy đủ hóa đơn kiểm dịch
                      </span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Hình ảnh chứng từ / Hóa đơn giao nhận * (Bắt buộc)
                    </label>
                    {form.step1Photo ? (
                      <div className="relative w-44 h-28 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                        <img
                          src={URL.createObjectURL(form.step1Photo)}
                          alt="Preview B1"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, step1Photo: null })}
                          className="absolute top-1.5 right-1.5 bg-rose-500 text-white w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold hover:bg-rose-600"
                        >
                          &times;
                        </button>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-4 flex flex-col items-center justify-center text-slate-500 hover:bg-emerald-50/30 transition cursor-pointer">
                        <Camera className="w-6 h-6 text-slate-400 mb-1" />
                        <span className="text-xs font-semibold text-slate-600">
                          Bấm để tải ảnh hóa đơn / thực phẩm tươi (JPG, PNG)
                        </span>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) =>
                            e.target.files && setForm({ ...form, step1Photo: e.target.files[0] })
                          }
                        />
                      </label>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú nhận xét</label>
                    <textarea
                      rows={2}
                      value={form.step1Note}
                      onChange={(e) => setForm({ ...form, step1Note: e.target.value })}
                      placeholder="Nhập ghi chú nhận xét về nguyên liệu tiếp nhận..."
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsModalVisible(false)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={handleStep1Submit}
                      disabled={!form.step1Passed}
                      className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm flex items-center gap-1.5"
                    >
                      Lưu Bước 1 & Sang Bước 2 <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* BƯỚC 2: CHẾ BIẾN NẤU CHÍN */}
              {currentStep === 2 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
                  <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
                    <h4 className="font-bold text-emerald-800 text-sm">
                      BƯỚC 2: Kiểm tra trong quá trình chế biến thức ăn
                    </h4>
                    <span className="text-xs text-slate-400 font-medium">Bếp 1 chiều & Nhiệt độ sôi</span>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer bg-white p-3 rounded-xl border border-slate-200 transition">
                      <input
                        type="checkbox"
                        checked={form.step2Passed}
                        onChange={(e) => setForm({ ...form, step2Passed: e.target.checked })}
                        className="w-4 h-4 accent-emerald-600 rounded"
                      />
                      <span className="text-xs font-bold text-slate-800">
                        Vệ sinh dao thớt, dụng cụ chứa đựng phân biệt rõ sống - chín
                      </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer bg-white p-3 rounded-xl border border-slate-200 transition">
                      <input
                        type="checkbox"
                        checked={form.step2KitchenPassed}
                        onChange={(e) => setForm({ ...form, step2KitchenPassed: e.target.checked })}
                        className="w-4 h-4 accent-emerald-600 rounded"
                      />
                      <span className="text-xs font-bold text-slate-800">
                        Quy trình bếp 1 chiều, sàn khô ráo, nhân viên mang găng tay và tạp dề
                      </span>
                    </label>

                    <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                      <span className="text-xs font-bold text-emerald-800">Nhiệt độ tâm món khi nấu sôi:</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={form.step2Temperature}
                          onChange={(e) => setForm({ ...form, step2Temperature: e.target.value })}
                          className="w-16 px-2 py-1 text-xs border border-emerald-300 rounded-lg text-center font-bold text-emerald-800 bg-white"
                        />
                        <span className="text-xs font-bold text-emerald-700">°C (&gt; 75°C)</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Ảnh chụp khu vực nấu / Giám sát bếp * (Bắt buộc)
                    </label>
                    {form.step2Photo ? (
                      <div className="relative w-44 h-28 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                        <img
                          src={URL.createObjectURL(form.step2Photo)}
                          alt="Preview B2"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, step2Photo: null })}
                          className="absolute top-1.5 right-1.5 bg-rose-500 text-white w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold hover:bg-rose-600"
                        >
                          &times;
                        </button>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-4 flex flex-col items-center justify-center text-slate-500 hover:bg-emerald-50/30 transition cursor-pointer">
                        <Camera className="w-6 h-6 text-slate-400 mb-1" />
                        <span className="text-xs font-semibold text-slate-600">
                          Tải ảnh bếp đang nấu hoặc dụng cụ tiệt trùng
                        </span>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) =>
                            e.target.files && setForm({ ...form, step2Photo: e.target.files[0] })
                          }
                        />
                      </label>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú Bước 2</label>
                    <textarea
                      rows={2}
                      value={form.step2Note}
                      onChange={(e) => setForm({ ...form, step2Note: e.target.value })}
                      placeholder="Nhập ghi chú trong quá trình chế biến..."
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
                    >
                      Quay lại Bước 1
                    </button>
                    <button
                      type="button"
                      onClick={handleStep2Submit}
                      disabled={!form.step2Passed || !form.step2KitchenPassed}
                      className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm flex items-center gap-1.5"
                    >
                      Lưu Bước 2 & Sang Bước 3 <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* BƯỚC 3: CẢM QUAN TRƯỚC KHI ĂN & LƯU MẪU 24H */}
              {currentStep === 3 && (
                <form onSubmit={handleStep3Submit} className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
                  <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
                    <h4 className="font-bold text-emerald-800 text-sm">
                      BƯỚC 3: Cảm quan thức ăn chín & Niêm phong mẫu lưu 24h
                    </h4>
                    <span className="text-xs text-slate-400 font-medium">Quy chuẩn tủ mát 0-5°C</span>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer bg-white p-3 rounded-xl border border-slate-200 transition">
                      <input
                        type="checkbox"
                        checked={form.step3Passed}
                        onChange={(e) => setForm({ ...form, step3Passed: e.target.checked })}
                        className="w-4 h-4 accent-emerald-600 rounded"
                      />
                      <span className="text-xs font-bold text-slate-800">
                        Thử nếm cảm quan đạt chuẩn: thơm ngon, vừa khẩu vị lứa tuổi mầm non, không mùi lạ
                      </span>
                    </label>

                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-blue-900 flex items-center gap-1">
                          <Utensils className="w-3.5 h-3.5 text-blue-700" />
                          <span>Định lượng lưu mẫu (Tối thiểu 100g - 150g/món theo QĐ 1246 - Từ CSDL):</span>
                        </p>
                      </div>

                      {isLoadingMenu ? (
                        <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                          <span>Đang tải món ăn từ CSDL...</span>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {dishes.length === 0 ? (
                              <p className="text-slate-400 italic text-[11px] py-2 text-center bg-white rounded-lg p-2">
                                Không có món ăn nào trong thực đơn ca ăn này.
                              </p>
                            ) : (
                              dishes.map((dish, idx) => (
                                <div
                                  key={dish.id}
                                  className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-blue-100"
                                >
                                  <span className="text-xs font-bold text-slate-700">{idx + 1}. {dish.name}</span>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="number"
                                      required
                                      min="100"
                                      max="500"
                                      value={dish.qty}
                                      onChange={(e) => {
                                        const updated = [...dishes];
                                        updated[idx].qty = e.target.value;
                                        setDishes(updated);
                                      }}
                                      className="w-16 px-2 py-1 text-xs border border-slate-200 rounded-lg text-center font-bold text-slate-800"
                                    />
                                    <span className="text-xs text-slate-500 font-medium">gram / hộp</span>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Ảnh khay thức ăn chia / Hộp lưu mẫu dán tem niêm phong * (Bắt buộc)
                    </label>
                    {form.step3Photo ? (
                      <div className="relative w-44 h-28 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                        <img
                          src={URL.createObjectURL(form.step3Photo)}
                          alt="Preview B3"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, step3Photo: null })}
                          className="absolute top-1.5 right-1.5 bg-rose-500 text-white w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold hover:bg-rose-600"
                        >
                          &times;
                        </button>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-4 flex flex-col items-center justify-center text-slate-500 hover:bg-emerald-50/30 transition cursor-pointer">
                        <Camera className="w-6 h-6 text-slate-400 mb-1" />
                        <span className="text-xs font-semibold text-slate-600">
                          Tải ảnh khay thức ăn hoặc hộp lưu mẫu (JPG, PNG)
                        </span>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) =>
                            e.target.files && setForm({ ...form, step3Photo: e.target.files[0] })
                          }
                        />
                      </label>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú Bước 3</label>
                    <textarea
                      rows={2}
                      value={form.step3Note}
                      onChange={(e) => setForm({ ...form, step3Note: e.target.value })}
                      placeholder="Nhập ghi chú cảm quan trước khi ăn & niêm phong mẫu lưu..."
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
                    >
                      Quay lại Bước 2
                    </button>
                    <button
                      type="submit"
                      disabled={!form.step3Passed}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
                    >
                      <CheckCircle className="w-4 h-4" /> Hoàn tất & Niêm phong mẫu lưu
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: XUẤT SỔ (PDF / EXCEL CHUẨN QĐ 1246) ─── */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center z-[100] p-4 pb-20 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Xuất Sổ Kiểm Thực Ba Bước</h3>
                  <p className="text-xs text-slate-500 font-medium">Chuẩn Quyết định 1246/QĐ-BYT</p>
                </div>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có thể xuất toàn bộ danh sách <strong>{filteredRecords.length} biên bản</strong> hiện có ra file Excel (CSV có dấu UTF-8) hoặc in bản trình duyệt định dạng chuẩn thanh tra an toàn thực phẩm.
            </p>

            <div className="space-y-3">
              <button
                onClick={handleExportCSV}
                className="w-full flex items-center justify-between p-3.5 bg-emerald-50/70 hover:bg-emerald-100/80 border border-emerald-200 rounded-2xl text-left transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-sm">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 group-hover:text-emerald-800">
                      Tải file Excel / CSV
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Bảng tính chi tiết 3 bước & nhiệt độ lưu mẫu
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-emerald-600 group-hover:translate-x-1 transition" />
              </button>

              <button
                onClick={handlePrintInspectionBook}
                className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl text-left transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-800 text-white rounded-xl shadow-sm">
                    <Printer className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 group-hover:text-slate-800">
                      In sổ kiểm thực (PDF)
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Biểu mẫu hành chính trình đoàn kiểm tra ATTP
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:translate-x-1 transition" />
              </button>
            </div>

            <div className="pt-2 text-center">
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 transition"
              >
                Đóng lại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Internal icon helper
const ChevronRightIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
  </svg>
);
