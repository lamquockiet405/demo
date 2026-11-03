import React, { useState, useEffect, useMemo } from 'react';
import {
  Scale,
  Calendar,
  Filter,
  Download,
  Printer,
  Search,
  ShoppingCart,
  Sparkles,
  RefreshCw,
  Utensils,
  Users,
  Layers,
  ChevronDown,
  Info,
  CheckCircle2,
  Trash2,
  AlertCircle,
  Eye,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  purchasingApi,
  DailyPurchasingSuggestionResponse,
  PurchasingIngredient,
  AvailableMenuDay,
} from '../api/purchasing.api';

export const GrossWeightPurchasingPage: React.FC = () => {
  // Query state
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [mealFilter, setMealFilter] = useState<'ALL' | 'LUNCH' | 'AFTERNOON_SNACK' | 'MORNING_SNACK'>('ALL');
  const [customPortionsInput, setCustomPortionsInput] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Data state
  const [data, setData] = useState<DailyPurchasingSuggestionResponse | null>(null);
  const [availableDays, setAvailableDays] = useState<AvailableMenuDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showClassModal, setShowClassModal] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Fetch Available Menu Days on mount
  useEffect(() => {
    purchasingApi
      .getAvailableMenuDays()
      .then((days) => setAvailableDays(days))
      .catch((err) => console.error('Lỗi lấy danh sách ngày thực đơn:', err));
  }, []);

  // Fetch purchasing suggestion when date or mealFilter changes
  const fetchSuggestion = async (portionsOverride?: number) => {
    setLoading(true);
    setError(null);
    try {
      const portions =
        portionsOverride !== undefined
          ? portionsOverride
          : customPortionsInput.trim() !== ''
          ? Number(customPortionsInput)
          : undefined;

      const res = await purchasingApi.getDailySuggestion({
        date: selectedDate,
        mealType: mealFilter,
        customPortions: portions,
      });

      setData(res);
      if (customPortionsInput === '' && !portionsOverride) {
        setCustomPortionsInput(String(res.portionsCount));
      }
    } catch (err: any) {
      console.error('Lỗi tính toán đi chợ:', err);
      setError(
        err.response?.data?.message ||
          'Không thể tải dữ liệu tính toán đi chợ. Vui lòng kiểm tra lại ngày và thực đơn đã phê duyệt.'
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestion();
  }, [selectedDate, mealFilter]);

  // Handle manual portions update
  const handleApplyCustomPortions = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(customPortionsInput);
    if (!isNaN(val) && val > 0) {
      fetchSuggestion(val);
    }
  };

  const handleResetToTotalStudents = () => {
    if (data) {
      setCustomPortionsInput(String(data.totalStudents));
      fetchSuggestion(data.totalStudents);
    }
  };

  // Filtered ingredients
  const filteredIngredients = useMemo(() => {
    if (!data) return [];
    let list = data.ingredients;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q) ||
          i.dishesUsed.some((d) => d.toLowerCase().includes(q))
      );
    }

    if (categoryFilter !== 'ALL') {
      list = list.filter((i) => i.category === categoryFilter);
    }

    return list;
  }, [data, searchQuery, categoryFilter]);

  // Export to Excel using xlsx library
  const handleExportExcel = () => {
    if (!data || filteredIngredients.length === 0) return;

    try {
      // 1. Prepare worksheet rows
      const worksheetData: any[] = [];

      // Header information
      worksheetData.push(['TRƯỜNG MẦM NON BÁN TRÚ HUỚNG DƯƠNG']);
      worksheetData.push(['BẢNG DỰ TRÙ MUA HÀNG & KHỐI LƯỢNG THÔ (GROSS WEIGHT)']);
      worksheetData.push([]);
      worksheetData.push(['Ngày đi chợ:', data.date, '', 'Thứ:', data.dayOfWeekLabel]);
      worksheetData.push(['Thực đơn áp dụng:', data.menuTitle]);
      worksheetData.push(['Ca ăn:', mealFilter === 'ALL' ? 'Tất cả các bữa' : mealFilter]);
      worksheetData.push(['Tổng sĩ số học sinh các lớp:', `${data.totalStudents} học sinh`]);
      worksheetData.push(['Số suất tính toán mua hàng:', `${data.portionsCount} suất`]);
      worksheetData.push([]);

      // Table columns
      worksheetData.push([
        'STT',
        'Tên Nguyên Liệu',
        'Nhóm Thực Phẩm',
        'Đơn Vị',
        'Tỉ Lệ Thải Bỏ (%)',
        'Định Lượng Tinh/Suất (g)',
        'Định Lượng Thô/Suất (g)',
        'Tổng Mua Đi Chợ (kg)',
        'Hao Hụt Sơ Chế (kg)',
        'Món Ăn Sử Dụng',
      ]);

      // Table body
      filteredIngredients.forEach((item, index) => {
        worksheetData.push([
          index + 1,
          item.name,
          item.category,
          item.unit,
          `${item.refuseRatePercent}%`,
          item.netPerPortionG,
          item.grossPerPortionG,
          item.totalGrossKg,
          item.refuseLossKg,
          item.dishesUsed.join(', '),
        ]);
      });

      // Total summary row
      worksheetData.push([]);
      worksheetData.push([
        'TỔNG CỘNG',
        '',
        '',
        '',
        '',
        '',
        '',
        data.summary.totalGrossKg,
        data.summary.totalRefuseLossKg,
        `${data.summary.totalIngredients} loại nguyên liệu`,
      ]);

      // Signatures
      worksheetData.push([]);
      worksheetData.push([]);
      worksheetData.push([
        'NGƯỜI LẬP PHIẾU',
        '',
        '',
        'BẾP TRƯỞNG TIẾP NHẬN',
        '',
        '',
        'BAN GIÁM HIỆU DUYỆT',
      ]);
      worksheetData.push(['(Ký và ghi rõ họ tên)', '', '', '(Ký và ghi rõ họ tên)', '', '', '(Ký và đóng dấu)']);

      // 2. Generate worksheet and workbook
      const ws = XLSX.utils.aoa_to_sheet(worksheetData);

      // Auto-fit column widths
      ws['!cols'] = [
        { wch: 6 }, // STT
        { wch: 30 }, // Tên
        { wch: 25 }, // Nhóm
        { wch: 8 }, // Đơn vị
        { wch: 18 }, // Tỉ lệ
        { wch: 22 }, // Net
        { wch: 22 }, // Gross
        { wch: 20 }, // Tổng kg
        { wch: 18 }, // Hao hụt
        { wch: 40 }, // Món ăn
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'DuTruMuaHang');

      // 3. Trigger download
      const filename = `Bang_Du_Tru_Mua_Hang_${data.date}_${data.portionsCount}_suat.xlsx`;
      XLSX.writeFile(wb, filename);

      setExportNotice(`Đã xuất file thành công: ${filename}`);
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err) {
      console.error('Lỗi xuất file Excel:', err);
      alert('Không thể xuất file Excel. Vui lòng thử lại!');
    }
  };

  // Print Order Form
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* ─── 1. HEADER SECTION ─── */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="bg-emerald-400/25 border border-emerald-400/40 text-emerald-300 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
              <ShoppingCart className="w-3.5 h-3.5" /> BẢNG ĐI CHỢ & MUA HÀNG
            </span>
            <span className="text-emerald-200 text-xs font-medium">Bếp Bán Trú & Dinh Dưỡng</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Tính Khối Lượng Đi Chợ Dự Kiến (Gross Weight)
          </h1>
          <p className="text-sm text-emerald-100/90 mt-1 max-w-3xl leading-relaxed">
            Hệ thống tự động tính toán số kg nguyên liệu thực tế cần mua dựa trên{' '}
            <strong className="text-emerald-300">Tổng số học sinh các lớp</strong>, thực đơn đã phê duyệt và{' '}
            <strong className="text-amber-300">Tỉ lệ thải bỏ sơ chế (%)</strong> theo tiêu chuẩn Viện Dinh Dưỡng.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <button
            onClick={handleExportExcel}
            disabled={!data || loading}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold rounded-2xl shadow-lg transition flex items-center gap-2 text-sm disabled:opacity-50"
            title="Tải bảng dự trù đi chợ ra file Excel (.xlsx)"
          >
            <Download className="w-4 h-4" /> Xuất Excel Đi Chợ
          </button>
          <button
            onClick={handlePrint}
            disabled={!data || loading}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 active:scale-95 border border-white/20 text-white font-semibold rounded-2xl shadow-sm transition flex items-center gap-2 text-sm disabled:opacity-50"
            title="In phiếu mua hàng cho nhà bếp"
          >
            <Printer className="w-4 h-4" /> In Phiếu Mua Hàng
          </button>
        </div>
      </div>

      {/* Export notification popup */}
      {exportNotice && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-2xl flex items-center justify-between text-sm shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{exportNotice}</span>
          </div>
          <button onClick={() => setExportNotice(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ─── 2. BANNER SĨ SỐ HỌC SINH CÁC LỚP & ĐIỀU CHỈNH SUẤT ĂN ─── */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        {/* Khối bên trái: Tổng sĩ số các lớp */}
        <div className="flex items-center gap-4">
          <div className="w-13 h-13 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0 shadow-inner">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Sĩ Số Nền (Tổng Học Sinh Các Lớp)
              </span>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                CSDL Thực Tế
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-3xl font-black text-slate-900">
                {data ? data.totalStudents : '...'}
              </span>
              <span className="text-sm font-semibold text-slate-600">học sinh toàn trường</span>
              {data && (
                <button
                  type="button"
                  onClick={() => setShowClassModal(true)}
                  className="ml-2 text-xs font-bold text-emerald-700 hover:text-emerald-800 underline flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" /> Xem chi tiết 6 lớp
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Hệ thống tự động tính khối lượng mua theo tổng số học sinh đang hoạt động của các lớp.
            </p>
          </div>
        </div>

        {/* Khối bên phải: Tùy chỉnh số suất ăn nếu bếp muốn đệm thêm */}
        <form
          onSubmit={handleApplyCustomPortions}
          className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/80 shrink-0"
        >
          <div className="text-right pr-1">
            <label className="block text-xs font-bold text-slate-700">Số suất ăn đi chợ:</label>
            <span className="text-[11px] text-slate-500">
              {data && data.isCustomPortions ? '(Đã tùy chỉnh)' : '(Chuẩn theo sĩ số)'}
            </span>
          </div>

          <div className="relative">
            <input
              type="number"
              min="1"
              max="999"
              value={customPortionsInput}
              onChange={(e) => setCustomPortionsInput(e.target.value)}
              className="w-24 bg-white border border-slate-300 rounded-xl px-3 py-2 text-base font-black text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition active:scale-95 shadow-xs"
          >
            Tính lại
          </button>

          {data && data.isCustomPortions && (
            <button
              type="button"
              onClick={handleResetToTotalStudents}
              className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition"
              title="Đặt lại theo đúng tổng sĩ số học sinh"
            >
              Về sĩ số ({data.totalStudents})
            </button>
          )}
        </form>
      </div>

      {/* ─── 3. FILTER BAR: NGÀY, CA ĂN, NHÓM THỰC PHẨM & TÌM KIẾM ─── */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Chọn ngày đi chợ */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Ngày đi chợ / nấu ăn:
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 hover:border-slate-400 focus:bg-white focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Chọn ca ăn */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Utensils className="w-3.5 h-3.5 text-emerald-600" /> Ca ăn cần mua:
            </label>
            <select
              value={mealFilter}
              onChange={(e) => setMealFilter(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-300 hover:border-slate-400 focus:bg-white focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="ALL">🍽️ Tất cả các ca ăn (Cả ngày)</option>
              <option value="LUNCH">☀️ Bữa trưa chính (10:30)</option>
              <option value="AFTERNOON_SNACK">🧁 Bữa xế chiều (14:30)</option>
              <option value="MORNING_SNACK">🥛 Bữa phụ sáng (08:30)</option>
            </select>
          </div>

          {/* Nhóm nguyên liệu */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-emerald-600" /> Nhóm thực phẩm:
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 hover:border-slate-400 focus:bg-white focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="ALL">Tất cả nhóm thực phẩm</option>
              {data?.categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Tìm kiếm */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-slate-400" /> Tìm nguyên liệu / món ăn:
            </label>
            <input
              type="text"
              placeholder="Ví dụ: Thịt heo, bí đỏ, cá..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 hover:border-slate-400 focus:bg-white focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Thông tin thực đơn tìm thấy */}
        {data && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700">Thực đơn áp dụng:</span>
              <span className="bg-slate-100 text-slate-800 font-semibold px-2.5 py-1 rounded-lg border border-slate-200">
                {data.menuTitle}
              </span>
              <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                {data.dayOfWeekLabel}
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <span>Các món trong ngày:</span>
              <span className="font-semibold text-slate-700">
                {data.dishesInDay.slice(0, 4).join(', ')}
                {data.dishesInDay.length > 4 ? ` và ${data.dishesInDay.length - 4} món khác` : ''}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ─── 4. METRIC CARDS ─── */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Tổng khối lượng Gross cần mua */}
          <div className="bg-gradient-to-br from-emerald-500 to-teal-700 text-white rounded-3xl p-5 shadow-md flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-100">
                Tổng Mua Đi Chợ (Gross)
              </p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl font-black">{data.summary.totalGrossKg}</span>
                <span className="text-sm font-bold text-emerald-100">kg</span>
              </div>
              <p className="text-[11px] text-emerald-100/90 mt-1">
                Cho {data.portionsCount} suất ăn trong ngày
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
          </div>

          {/* Card 2: Tổng khối lượng Net ăn vào */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Khối Lượng Tinh Tiêu Thụ (Net)
              </p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl font-black text-slate-900">{data.summary.totalNetKg}</span>
                <span className="text-sm font-bold text-slate-500">kg</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Lượng thực phẩm trẻ ăn vào thực tế</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
              <Scale className="w-6 h-6" />
            </div>
          </div>

          {/* Card 3: Hao hụt sơ chế (Refuse loss) */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Hao Hụt Sơ Chế Thải Bỏ
              </p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl font-black text-amber-600">
                  {data.summary.totalRefuseLossKg}
                </span>
                <span className="text-sm font-bold text-slate-500">kg</span>
              </div>
              <p className="text-[11px] text-amber-600 font-semibold mt-1">
                Chiếm ~
                {data.summary.totalGrossKg > 0
                  ? Math.round(
                      (data.summary.totalRefuseLossKg / data.summary.totalGrossKg) * 100
                    )
                  : 0}
                % vỏ, xương, cuống rau bỏ đi
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
              <Trash2 className="w-6 h-6" />
            </div>
          </div>

          {/* Card 4: Số loại nguyên liệu */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Chủng Loại Thực Phẩm
              </p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl font-black text-slate-900">
                  {filteredIngredients.length}
                </span>
                <span className="text-sm font-bold text-slate-500">loại</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Trong {data.summary.categoriesCount} nhóm dinh dưỡng
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shrink-0">
              <Layers className="w-6 h-6" />
            </div>
          </div>
        </div>
      )}

      {/* ─── 5. MAIN DATA TABLE ─── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              Chi Tiết Khối Lượng Nguyên Liệu Cần Mua Hôm Nay
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Công thức: Gross = Net / (1 - Tỉ lệ thải bỏ %). Nhân theo{' '}
              <strong className="text-slate-700">{data?.portionsCount || 0} suất</strong> ăn.
            </p>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Hiển thị <strong>{filteredIngredients.length}</strong> nguyên liệu
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="text-sm font-semibold">Đang truy vấn dữ liệu CSDL và tính toán đi chợ...</p>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Không thể tải dữ liệu</h3>
            <p className="text-xs text-slate-500 max-w-md">{error}</p>
            <button
              onClick={() => fetchSuggestion()}
              className="mt-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Data table */}
        {!loading && !error && data && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-3.5 px-4 text-center w-12">STT</th>
                  <th className="py-3.5 px-4">Tên Nguyên Liệu</th>
                  <th className="py-3.5 px-4">Nhóm Thực Phẩm</th>
                  <th className="py-3.5 px-4 text-center">ĐVT</th>
                  <th className="py-3.5 px-4 text-center">Tỉ Lệ Thải Bỏ</th>
                  <th className="py-3.5 px-4 text-right">Net / Suất</th>
                  <th className="py-3.5 px-4 text-right">Gross / Suất</th>
                  <th className="py-3.5 px-4 text-right bg-emerald-50/80 text-emerald-900 font-black">
                    Tổng Mua (kg)
                  </th>
                  <th className="py-3.5 px-4 text-right text-slate-500">Hao Hụt (kg)</th>
                  <th className="py-3.5 px-4">Món Ăn Sử Dụng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredIngredients.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      Không tìm thấy nguyên liệu nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredIngredients.map((item, index) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-center font-bold text-slate-400 text-xs">
                        {index + 1}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900">{item.name}</span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-block bg-slate-100 text-slate-700 text-[11px] font-semibold px-2 py-0.5 rounded-md">
                          {item.category}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center text-slate-600 font-medium">
                        {item.unit}
                      </td>

                      {/* Tỉ lệ thải bỏ % */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            item.refuseRatePercent === 0
                              ? 'bg-slate-100 text-slate-600'
                              : item.refuseRatePercent <= 15
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {item.refuseRatePercent}%
                        </span>
                      </td>

                      {/* Net mỗi suất */}
                      <td className="py-3 px-4 text-right text-slate-700 font-medium">
                        {item.netPerPortionG} g
                      </td>

                      {/* Gross mỗi suất */}
                      <td className="py-3 px-4 text-right text-slate-800 font-bold">
                        {item.grossPerPortionG} g
                      </td>

                      {/* Cột TỔNG MUA (KG) - Nổi bật nhất */}
                      <td className="py-3 px-4 text-right bg-emerald-50/80 font-black text-emerald-700 text-sm sm:text-base">
                        {item.totalGrossKg}{' '}
                        <span className="text-xs font-semibold text-emerald-600">kg</span>
                      </td>

                      {/* Hao hụt sơ chế */}
                      <td className="py-3 px-4 text-right text-slate-500 font-medium text-xs">
                        {item.refuseLossKg > 0 ? `${item.refuseLossKg} kg` : '0 kg'}
                      </td>

                      {/* Danh sách món ăn */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {item.dishesUsed.map((dish, i) => (
                            <span
                              key={i}
                              className="bg-slate-100 text-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded-md"
                            >
                              {dish}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredIngredients.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100/90 font-black text-slate-900 border-t-2 border-slate-300">
                    <td colSpan={7} className="py-3.5 px-4 text-right uppercase tracking-wider text-xs">
                      TỔNG CỘNG ({filteredIngredients.length} NGUYÊN LIỆU):
                    </td>
                    <td className="py-3.5 px-4 text-right text-emerald-800 text-base font-black bg-emerald-100/80">
                      {data.summary.totalGrossKg} kg
                    </td>
                    <td className="py-3.5 px-4 text-right text-amber-700 text-xs font-bold">
                      {data.summary.totalRefuseLossKg} kg
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* ─── MODAL XEM CHI TIẾT SĨ SỐ 6 LỚP ─── */}
      {showClassModal && data && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Chi Tiết Sĩ Số Các Lớp</h3>
                  <p className="text-xs text-slate-500">Cơ sở dữ liệu học sinh đang hoạt động</p>
                </div>
              </div>
              <button
                onClick={() => setShowClassModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-2 max-h-80 overflow-y-auto">
              {data.classesBreakdown.map((cls, idx) => (
                <div
                  key={cls.classId}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100/80 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center text-xs font-bold text-slate-400">
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{cls.className}</p>
                      <p className="text-[11px] text-slate-500">Khối: {cls.ageGroup}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-emerald-700">
                      {cls.studentCount}
                    </span>
                    <span className="text-xs font-medium text-slate-500 ml-1">học sinh</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-bold uppercase">Tổng Sĩ Số Toàn Trường:</span>
              <span className="text-lg font-black text-emerald-700">
                {data.totalStudents} học sinh
              </span>
            </div>

            <button
              onClick={() => setShowClassModal(false)}
              className="mt-4 w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-xs transition"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
