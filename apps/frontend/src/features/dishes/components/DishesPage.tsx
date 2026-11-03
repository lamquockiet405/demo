import React, { useEffect, useState } from 'react';
import { apiClient } from '@/core/api/axios';
import {
  Search,
  Plus,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Eye,
  PenSquare,
  Ban,
  UtensilsCrossed,
  Coffee,
  Layers,
  FileSpreadsheet,
  LayoutGrid,
  ListOrdered,
  Sun,
  X,
  ChevronLeft,
  ChevronRight,
  Flame,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
} from 'lucide-react';
import { DishModal } from './DishModal';

interface DishNutrition {
  energyKcal: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  fiberG: number;
  calciumMg: number;
  ironMg: number;
  zincMg: number;
}

interface Dish {
  id: string;
  code: string;
  name: string;
  dishType: string;
  categoryCode?: string;
  categoryName?: string;
  targetAgeGroup: string;
  totalCalories: number;
  totalProteinG: number;
  totalFatG: number;
  totalCarbG: number;
  totalFiberG?: number;
  totalCalciumMg?: number;
  totalIronMg?: number;
  totalZincMg?: number;
  nutrition?: DishNutrition;
  nutritionAvailable?: boolean;
  nutritionStatus?: 'VERIFIED' | 'REFERENCE' | 'MISSING';
  referenceNutrition?: DishNutrition;
  standardServingSizeG?: number;
  photoUrl?: string;
  isActive: boolean;
  status?: string;
  recipeCount?: number;
  recipeItems?: any[];
  allergens?: any[];
}

interface Stats {
  totalDishes: number;
  mainDishes: number;
  sideDishes: number;
  allergenDishesCount: number;
}

export const DishesPage: React.FC = () => {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [dishTypeFilter, setDishTypeFilter] = useState('');
  const [ageGroupFilter, setAgeGroupFilter] = useState('');
  const [allergenFilter, setAllergenFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('true');
  const [categories, setCategories] = useState<{ id: string; code: string; name: string }[]>([]);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [total, setTotal] = useState(0);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'view' | 'edit'>('create');
  const [selectedDishId, setSelectedDishId] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get('/dishes/categories')
      .then((res) => setCategories(res.data || []))
      .catch(console.error);
  }, []);

  const fetchDishes = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/dishes', {
        params: {
          search: searchTerm || undefined,
          dishType: dishTypeFilter || undefined,
          targetAgeGroup: ageGroupFilter || undefined,
          allergenFilter: allergenFilter || undefined,
          isActive: statusFilter === '' ? undefined : statusFilter === 'true',
          page,
          limit,
        },
      });
      setDishes(res.data.items || []);
      setTotal(res.data.total || 0);
      if (res.data.stats) {
        setStats(res.data.stats);
      }
    } catch (error) {
      console.error('Error fetching dishes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDishes();
  }, [page, limit, searchTerm, dishTypeFilter, ageGroupFilter, allergenFilter, statusFilter]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setDishTypeFilter('');
    setAgeGroupFilter('');
    setAllergenFilter('');
    setStatusFilter('true');
    setPage(1);
  };

  const handleToggleStatus = async (dish: Dish) => {
    const isCurrentlyActive = dish.isActive && dish.status !== 'INACTIVE';
    const nextStatus = isCurrentlyActive ? 'INACTIVE' : 'ACTIVE';
    const confirmMessage = isCurrentlyActive
      ? `Bạn có chắc muốn TẠM NGƯNG món ăn "${dish.name}"?\n(Món ăn sẽ chuyển sang trạng thái tạm ngưng và không đưa vào thực đơn mới)`
      : `Bạn có chắc muốn PHỤC VỤ LẠI món ăn "${dish.name}" để tiếp tục sử dụng trong thực đơn?`;

    if (window.confirm(confirmMessage)) {
      try {
        await apiClient.put(`/dishes/${dish.id}`, {
          status: nextStatus,
          isActive: nextStatus === 'ACTIVE',
        });
        fetchDishes();
      } catch (error) {
        console.error('Lỗi khi cập nhật trạng thái món ăn:', error);
        alert('Không thể cập nhật trạng thái món ăn. Vui lòng thử lại!');
      }
    }
  };

  const formatExact = (val: any): string => {
    if (val === null || val === undefined || val === '') return '0';
    const n = Number(val);
    if (isNaN(n)) return '0';
    return String(Math.round(n * 100) / 100);
  };

  const getDishNutrition = (dish: Dish) => {
    if (dish.nutritionAvailable === false && !dish.referenceNutrition) {
      return { calories: '—', protein: '—', fat: '—', carb: '—', fiber: '—', calcium: '—', iron: '—', zinc: '—' };
    }
    const nutrition = dish.referenceNutrition || dish.nutrition;
    const calories = formatExact(dish.totalCalories ?? nutrition?.energyKcal);
    const protein = formatExact(dish.totalProteinG ?? nutrition?.proteinG);
    const fat = formatExact(dish.totalFatG ?? nutrition?.fatG);
    const carb = formatExact(dish.totalCarbG ?? nutrition?.carbG);
    const fiber = formatExact(dish.totalFiberG ?? nutrition?.fiberG);
    const calcium = formatExact(dish.totalCalciumMg ?? nutrition?.calciumMg);
    const iron = formatExact(dish.totalIronMg ?? nutrition?.ironMg);
    const zinc = formatExact(dish.totalZincMg ?? nutrition?.zincMg);

    return { calories, protein, fat, carb, fiber, calcium, iron, zinc };
  };

  const getTypeBadge = (type: string, categoryName?: string) => {
    const label = categoryName || categories.find((c) => c.code === type || c.name === type)?.name || type;
    const t = (type || '').toUpperCase();
    switch (t) {
      case 'MAIN':
      case 'MAIN_COURSE':
        return <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md text-[10px] font-bold">{label || 'Món chính'}</span>;
      case 'SOUP':
        return <span className="bg-teal-100 text-teal-800 px-2 py-0.5 rounded-md text-[10px] font-bold">{label || 'Canh / Súp'}</span>;
      case 'SIDE':
      case 'SIDE_VEGETABLE':
        return <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md text-[10px] font-bold">{label || 'Món phụ'}</span>;
      case 'RICE':
      case 'RICE_STAPLE':
        return <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md text-[10px] font-bold">{label || 'Cơm / Cháo'}</span>;
      case 'DESSERT':
        return <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md text-[10px] font-bold">{label || 'Tráng miệng'}</span>;
      case 'SNACK_MORNING':
        return <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md text-[10px] font-bold">{label || 'Xế sáng'}</span>;
      case 'SNACK':
      case 'SNACK_AFTERNOON':
        return <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md text-[10px] font-bold">{label || 'Xế chiều'}</span>;
      case 'DRINK':
        return <span className="bg-sky-100 text-sky-800 px-2 py-0.5 rounded-md text-[10px] font-bold">{label || 'Thức uống'}</span>;
      default:
        return <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-bold">{label || 'Khác'}</span>;
    }
  };

  const checkAllergens = (dish: Dish): { hasAllergens: boolean; allergenNames: string[] } => {
    const allergensFound = new Set<string>();

    if (dish.allergens && Array.isArray(dish.allergens)) {
      dish.allergens.forEach((a: any) => {
        if (typeof a === 'string') allergensFound.add(a);
        else if (a?.name) allergensFound.add(a.name);
        else if (a?.code) allergensFound.add(a.code);
      });
    }

    if (dish.recipeItems && Array.isArray(dish.recipeItems)) {
      for (const ri of dish.recipeItems) {
        if (ri.food?.allergens && Array.isArray(ri.food.allergens)) {
          ri.food.allergens.forEach((a: string) => allergensFound.add(a));
        }
      }
    }

    return {
      hasAllergens: allergensFound.size > 0,
      allergenNames: Array.from(allergensFound),
    };
  };

  // Filter dishes locally by allergen if selected
  const displayedDishes = dishes.filter((dish) => {
    if (!allergenFilter) return true;
    const { hasAllergens } = checkAllergens(dish);
    if (allergenFilter === 'WARNING') return hasAllergens;
    if (allergenFilter === 'SAFE') return !hasAllergens;
    return true;
  });

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="bg-slate-50/70 min-h-screen pb-12 font-sans">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200/80 px-6 sm:px-8 py-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Danh Mục Món Ăn Học Đường
              </h1>
              <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-wide uppercase">
                Thực đơn Mầm non
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full text-xs font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Chuẩn VN-RDA 2024 (Viện Dinh Dưỡng)
              </span>
            </div>
            <p className="text-slate-500 text-xs sm:text-sm mt-1 leading-relaxed max-w-3xl">
              Quản lý định lượng khẩu phần, năng lượng Kcal, cơ cấu dưỡng chất P:L:G và kiểm soát dị nguyên học đường theo tiêu chuẩn Thông tư 28/2016/TT-BGDĐT.
            </p>
          </div>

          {/* Action Tools */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {/* View Switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  viewMode === 'grid'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Dạng lưới thẻ"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">Lưới thẻ</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  viewMode === 'table'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Dạng bảng danh sách"
              >
                <ListOrdered className="w-4 h-4" />
                <span className="hidden sm:inline">Bảng chi tiết</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedDishId(null);
                setModalMode('create');
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 bg-emerald-600 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-black shadow-md shadow-emerald-600/25 transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm món ăn mới</span>
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 sm:px-8 mt-6 max-w-7xl mx-auto space-y-6">
        {/* Stats KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Tổng số món */}
          <div className="bg-emerald-50/60 bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white rounded-2xl p-5 border border-emerald-200/80 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-emerald-800 text-[11px] font-black uppercase tracking-wider">
                Tổng số món ăn
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-700 flex items-center justify-center shadow-2xs">
                <UtensilsCrossed className="w-4 h-4" />
              </div>
            </div>
            <div className="my-2">
              <span className="text-3xl font-black text-slate-900">{stats?.totalDishes ?? 100}</span>
              <span className="text-xs font-bold text-slate-500 ml-1.5">món ăn</span>
            </div>
            <p className="text-[11px] text-emerald-700 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Đang hoạt động trong kho thực đơn
            </p>
          </div>

          {/* Card 2: Dị nguyên */}
          <div className="bg-rose-50/60 bg-gradient-to-br from-rose-50 via-amber-50/40 to-white rounded-2xl p-5 border border-rose-200/80 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-rose-800 text-[11px] font-black uppercase tracking-wider">
                Chứa dị nguyên học đường
              </span>
              <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-700 flex items-center justify-center shadow-2xs">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="my-2">
              <span className="text-3xl font-black text-slate-900">{stats?.allergenDishesCount ?? 46}</span>
              <span className="text-xs font-bold text-slate-500 ml-1.5">món lưu ý</span>
            </div>
            <p className="text-[11px] text-rose-700 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              {stats?.totalDishes ? Math.round((stats.allergenDishesCount / stats.totalDishes) * 100) : 46}% tỷ trọng cần kiểm soát dị ứng
            </p>
          </div>

          {/* Card 3: Bữa chính trưa */}
          <div className="bg-blue-50/60 bg-gradient-to-br from-blue-50 via-sky-50/40 to-white rounded-2xl p-5 border border-blue-200/80 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-blue-800 text-[11px] font-black uppercase tracking-wider">
                Bữa chính trưa
              </span>
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-700 flex items-center justify-center shadow-2xs">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="my-2">
              <span className="text-3xl font-black text-slate-900">{stats?.mainDishes ?? 26}</span>
              <span className="text-xs font-bold text-slate-500 ml-1.5">món trưa</span>
            </div>
            <p className="text-[11px] text-blue-700 font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Mặn, canh, rau xào & cơm dẻo
            </p>
          </div>

          {/* Card 4: Sáng & Xế */}
          <div className="bg-purple-50/60 bg-gradient-to-br from-purple-50 via-fuchsia-50/30 to-white rounded-2xl p-5 border border-purple-200/80 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-purple-800 text-[11px] font-black uppercase tracking-wider">
                Điểm tâm sáng & Xế
              </span>
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-700 flex items-center justify-center shadow-2xs">
                <Sun className="w-4 h-4" />
              </div>
            </div>
            <div className="my-2">
              <span className="text-3xl font-black text-slate-900">{stats?.sideDishes ?? 27}</span>
              <span className="text-xs font-bold text-slate-500 ml-1.5">món sáng/xế</span>
            </div>
            <p className="text-[11px] text-purple-700 font-bold flex items-center gap-1.5">
              <Coffee className="w-3.5 h-3.5" />
              Cháo, bún, bánh & thức uống
            </p>
          </div>
        </div>

        {/* Filters Panel */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm món ăn theo tên (ví dụ: Cháo sườn, Cá lóc sốt cà, Canh chua, Bánh canh...)"
                className="w-full pl-10 pr-9 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/60"
                value={searchTerm}
                onChange={handleSearchChange}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Bữa ăn */}
              <div>
                <select
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20"
                  value={dishTypeFilter}
                  onChange={(e) => {
                    setDishTypeFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Tất cả bữa ăn</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cảnh báo dị ứng */}
              <div>
                <select
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20"
                  value={allergenFilter}
                  onChange={(e) => {
                    setAllergenFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Tất cả an toàn dị ứng</option>
                  <option value="SAFE">An toàn (Không dị nguyên)</option>
                  <option value="WARNING">Có nguyên liệu dị ứng</option>
                </select>
              </div>

              {/* Trạng thái */}
              <div>
                <select
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="true">Đang phục vụ</option>
                  <option value="false">Tạm ngưng</option>
                </select>
              </div>
            </div>

            {/* Clear button */}
            {(searchTerm || dishTypeFilter || ageGroupFilter || allergenFilter || statusFilter !== 'true') && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-600 transition whitespace-nowrap self-end md:self-auto cursor-pointer"
              >
                ⟳ Xóa lọc
              </button>
            )}
          </div>
        </div>

        {/* Content View: Grid or Table */}
        {loading ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs">
            <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
            <p className="text-xs sm:text-sm font-bold text-slate-600">Đang tải danh mục món ăn học đường...</p>
          </div>
        ) : displayedDishes.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <UtensilsCrossed className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Không tìm thấy món ăn nào phù hợp</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Không có món ăn nào thỏa mãn bộ lọc hiện tại. Vui lòng thử tìm từ khóa khác hoặc bấm nút xóa bộ lọc.
            </p>
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Xem toàn bộ món ăn</span>
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* GRID VIEW */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {displayedDishes.map((dish) => {
              const { hasAllergens, allergenNames } = checkAllergens(dish);
              const { calories, protein, fat, carb, fiber, calcium, iron, zinc } = getDishNutrition(dish);

              return (
                <div
                  key={dish.id}
                  className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition duration-200 flex flex-col justify-between group"
                >
                  {/* Card Visual Header */}
                  <div className="h-36 relative bg-slate-100 bg-gradient-to-tr from-slate-100 to-slate-200 overflow-hidden">
                    {dish.photoUrl ? (
                      <img
                        src={`http://localhost:3000${dish.photoUrl}`}
                        alt={dish.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-emerald-50/40 bg-gradient-to-br from-emerald-50/50 via-teal-50/30 to-amber-50/40">
                        <UtensilsCrossed className="w-9 h-9 text-emerald-600/40 mb-1" />
                        <span className="text-[10px] font-bold text-slate-400">Hình ảnh tiêu chuẩn</span>
                      </div>
                    )}

                    {/* Top Badges */}
                    <div className="absolute top-2.5 left-2.5">
                      {getTypeBadge(dish.dishType || dish.categoryCode || '', dish.categoryName)}
                    </div>

                    <div className="absolute top-2.5 right-2.5 bg-white/90 backdrop-blur-xs text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-black shadow-2xs border border-white/50">
                      {dish.code || `MA${String(dish.id).padStart(4, '0')}`}
                    </div>

                    {!dish.isActive && (
                      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center z-10">
                        <span className="bg-white text-slate-900 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider shadow-md">
                          Tạm ngưng
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Body */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <h3
                        className="font-black text-slate-900 text-sm leading-snug line-clamp-2 group-hover:text-emerald-700 transition"
                        title={dish.name}
                      >
                        {dish.name}
                      </h3>
                      {dish.nutritionAvailable === false && (
                        <p className="mt-1 text-xs text-amber-700">{dish.nutritionStatus === 'REFERENCE' ? 'Công thức tham khảo — chưa xác minh thực tế' : 'Chưa có công thức định lượng được xác nhận'}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span>{dish.targetAgeGroup === 'TODDLER_18_36M' ? 'Nhà trẻ (18-36T)' : 'Mẫu giáo (3-6T)'}</span>
                        {dish.standardServingSizeG ? (
                          <>
                            <span>•</span>
                            <span>{formatExact(dish.standardServingSizeG)}g</span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    {/* Nutrition Box */}
                    <div className="bg-slate-50/90 rounded-xl p-2.5 border border-slate-100 text-xs">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                          <Flame className="w-3 h-3 text-amber-500" />
                          Năng lượng
                        </span>
                        <span className="text-sm font-black text-emerald-800">
                          {calories}{' '}
                          <span className="text-[10px] font-normal text-slate-500">Kcal</span>
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-slate-200/60 text-center text-[10.5px]">
                        <div>
                          <span className="text-slate-400 block text-[9.5px]">Đạm (P)</span>
                          <span className="font-bold text-slate-800">{protein}g</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9.5px]">Béo (L)</span>
                          <span className="font-bold text-slate-800">{fat}g</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9.5px]">Đường (G)</span>
                          <span className="font-bold text-slate-800">{carb}g</span>
                        </div>
                      </div>
                      {/* Vi chất dinh dưỡng từ DB */}
                      <div className="grid grid-cols-4 gap-1 pt-1.5 mt-1.5 border-t border-dashed border-slate-200 text-center text-[9.5px] bg-emerald-50/50 rounded-lg p-1">
                        <div title={`Chất xơ: ${fiber}g`}>
                          <span className="text-slate-400 block text-[8.5px]">Xơ</span>
                          <span className="font-bold text-emerald-700">{fiber}g</span>
                        </div>
                        <div title={`Canxi: ${calcium}mg`}>
                          <span className="text-slate-400 block text-[8.5px]">Canxi</span>
                          <span className="font-bold text-emerald-700">{calcium}mg</span>
                        </div>
                        <div title={`Sắt: ${iron}mg`}>
                          <span className="text-slate-400 block text-[8.5px]">Sắt</span>
                          <span className="font-bold text-emerald-700">{iron}mg</span>
                        </div>
                        <div title={`Kẽm: ${zinc}mg`}>
                          <span className="text-slate-400 block text-[8.5px]">Kẽm</span>
                          <span className="font-bold text-emerald-700">{zinc}mg</span>
                        </div>
                      </div>
                    </div>

                    {/* Allergen Tag */}
                    <div>
                      {hasAllergens ? (
                        <div
                          className="bg-rose-50 text-rose-700 border border-rose-200/80 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 truncate"
                          title={allergenNames.join(', ')}
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span className="truncate">Lưu ý dị ứng: {allergenNames.slice(0, 2).join(', ')}</span>
                        </div>
                      ) : (
                        <div className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>An toàn (Không có dị nguyên)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="px-4 py-2.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDishId(dish.id);
                        setModalMode('view');
                        setIsModalOpen(true);
                      }}
                      className="text-slate-600 hover:text-emerald-700 flex items-center gap-1 transition cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Chi tiết</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDishId(dish.id);
                        setModalMode('edit');
                        setIsModalOpen(true);
                      }}
                      className="text-slate-600 hover:text-blue-700 flex items-center gap-1 transition cursor-pointer"
                    >
                      <PenSquare className="w-3.5 h-3.5" />
                      <span>Sửa</span>
                    </button>

                    {dish.isActive && dish.status !== 'INACTIVE' ? (
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(dish)}
                        className="text-slate-400 hover:text-amber-600 flex items-center gap-1 transition cursor-pointer"
                        title="Tạm ngưng phục vụ món ăn này"
                      >
                        <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Tạm ngưng</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(dish)}
                        className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition cursor-pointer"
                        title="Phục vụ lại món ăn này"
                      >
                        <PlayCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Phục vụ lại</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* TABLE VIEW */
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3 px-3 w-12 text-center">STT</th>
                    <th className="py-3 px-4">Tên món ăn</th>
                    <th className="py-3 px-3 text-center">Loại bữa</th>
                    <th className="py-3 px-3 text-center">Khẩu phần</th>
                    <th className="py-3 px-3 text-center">Năng lượng</th>
                    <th className="py-3 px-3 text-center">Đạm (P)</th>
                    <th className="py-3 px-3 text-center">Béo (L)</th>
                    <th className="py-3 px-3 text-center">Carb (G)</th>
                    <th className="py-3 px-3 text-center">Vi chất (Ca / Fe / Zn / Xơ)</th>
                    <th className="py-3 px-4 text-center">Kiểm soát dị nguyên</th>
                    <th className="py-3 px-3 text-center">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {displayedDishes.map((dish, idx) => {
                    const { hasAllergens, allergenNames } = checkAllergens(dish);
                    const { calories, protein, fat, carb, fiber, calcium, iron, zinc } = getDishNutrition(dish);
                    const stt = (page - 1) * limit + idx + 1;

                    return (
                      <tr key={dish.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-3 text-center text-slate-400 font-bold">{stt}</td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{dish.name}</div>
                          <span className="text-[10px] text-slate-400 font-semibold">{dish.code || `MA${String(dish.id).padStart(4, '0')}`}</span>
                        </td>
                        <td className="py-3 px-3 text-center">{getTypeBadge(dish.dishType || dish.categoryCode || '', dish.categoryName)}</td>
                        <td className="py-3 px-3 text-center font-bold text-slate-600">
                          {formatExact(dish.standardServingSizeG || 100)}g
                        </td>
                        <td className="py-3 px-3 text-center font-black text-emerald-800">
                          {calories} Kcal
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-700">
                          {protein}g
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-700">
                          {fat}g
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-700">
                          {carb}g
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="text-[10px] font-semibold text-slate-700 whitespace-nowrap">
                            Ca: <span className="font-bold text-emerald-700">{calcium}mg</span> | Fe: <span className="font-bold text-emerald-700">{iron}mg</span>
                          </div>
                          <div className="text-[9.5px] text-slate-500 whitespace-nowrap">
                            Zn: <span className="font-bold text-emerald-700">{zinc}mg</span> | Xơ: <span className="font-bold text-emerald-700">{fiber}g</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {hasAllergens ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertTriangle className="w-3 h-3 text-rose-500" />
                              {allergenNames.slice(0, 2).join(', ')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              An toàn
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              dish.isActive
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {dish.isActive ? 'Đang phục vụ' : 'Tạm ngưng'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDishId(dish.id);
                                setModalMode('view');
                                setIsModalOpen(true);
                              }}
                              className="px-2 py-1 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer flex items-center gap-1 text-[11px] font-bold shadow-2xs"
                              title="Xem chi tiết món ăn"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span className="hidden xl:inline">Xem chi tiết</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDishId(dish.id);
                                setModalMode('edit');
                                setIsModalOpen(true);
                              }}
                              className="p-1 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition cursor-pointer"
                              title="Chỉnh sửa món ăn"
                            >
                              <PenSquare className="w-3.5 h-3.5" />
                            </button>
                            {dish.isActive && dish.status !== 'INACTIVE' ? (
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(dish)}
                                className="px-2 py-1 rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition cursor-pointer flex items-center gap-1 text-[11px] font-bold shadow-2xs"
                                title="Tạm ngưng phục vụ món ăn này"
                              >
                                <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                                <span>Tạm ngưng</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(dish)}
                                className="px-2 py-1 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer flex items-center gap-1 text-[11px] font-bold shadow-2xs"
                                title="Kích hoạt phục vụ lại món ăn này"
                              >
                                <PlayCircle className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Phục vụ lại</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 font-medium">
            Hiển thị <strong className="text-slate-800">{Math.min((page - 1) * limit + 1, total)}</strong> -{' '}
            <strong className="text-slate-800">{Math.min(page * limit, total)}</strong> trong tổng số{' '}
            <strong className="text-slate-900">{total}</strong> món ăn
          </div>

          <div className="flex items-center gap-3">
            {/* Limit selector */}
            <div className="flex items-center gap-1.5 text-slate-600 font-bold">
              <span>Số món/trang:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none text-xs font-bold text-slate-800 cursor-pointer"
              >
                <option value={8}>8 món</option>
                <option value={12}>12 món</option>
                <option value={24}>24 món</option>
                <option value={48}>48 món</option>
              </select>
            </div>

            {/* Page navigation */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 font-bold text-slate-800 text-xs">
                Trang {page} / {totalPages}
              </span>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <DishModal
        isOpen={isModalOpen}
        mode={modalMode}
        dishId={selectedDishId}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          fetchDishes();
        }}
      />
    </div>
  );
};
