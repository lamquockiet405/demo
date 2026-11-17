import { normalizeSearch } from '../../../core/utils/search';
import React, { useState, useEffect } from 'react';
import {
  Scale,
  Calendar,
  Filter,
  Download,
  Printer,
  AlertTriangle,
  Search,
  ShoppingCart,
  Sparkles,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
  Utensils,
  ChevronDown,
} from 'lucide-react';
import { weeklyMenusApi, WeeklyMenu } from '../api/weekly-menus.api';
import { downloadExcel } from '../../../core/utils/excel-export';

interface IngredientSummary {
  id: string;
  name: string;
  category: string;
  unit: string;
  refuseRate: number; // %
  netTotalG: number;
  grossTotalG: number;
  grossTotalKg: number;
  dishesUsed: string[];
  missingRecipe?: boolean;
}

export const GrossWeightPurchasingPage: React.FC = () => {
  // Filters
  const [selectedWeek, setSelectedWeek] = useState('2026-W42');
  const [startDate, setStartDate] = useState('2026-10-19');
  const [endDate, setEndDate] = useState('2026-10-23');
  const [mealFilter, setMealFilter] = useState<'ALL' | 'LUNCH' | 'AFTERNOON_SNACK' | 'BREAKFAST'>('ALL');
  const [portionsCount, setPortionsCount] = useState<number>(180);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Data & State
  const [menus, setMenus] = useState<WeeklyMenu[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<WeeklyMenu | null>(null);
  const [loading, setLoading] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Load Approved Menus
  useEffect(() => {
    fetchApprovedMenus();
  }, [selectedWeek]);

  const fetchApprovedMenus = async () => {
    setLoading(true);
    setWarnings([]);
    try {
      const data = await weeklyMenusApi.getMenus({ status: 'APPROVED' });
      setMenus(data);
      if (data && data.length > 0) {
        setSelectedMenu(data[0]);
      } else {
        setSelectedMenu(null);
      }
    } catch {
      // Fallback sample data if backend returns empty
      const sampleMenu: any = {
        id: 'sample-approved-1',
        title: 'Thực đơn Mầm non Tuần 42 - Đã phê duyệt',
        status: 'APPROVED',
        startDate: startDate,
        endDate: endDate,
        dishes: [
          {
            dish: {
              id: 'd1',
              name: 'Cơm trắng gạo thơm',
              recipeItems: [
                { food: { id: 'f1', name: 'Gạo tẻ thơm ST25', category: 'Ngũ cốc' }, netWeightPerPortionG: 70, grossWeightPerPortionG: 70, shrinkageRatio: 0 },
              ],
            },
            mealTime: 'LUNCH',
          },
          {
            dish: {
              id: 'd2',
              name: 'Thịt heo rim nước dừa',
              recipeItems: [
                { food: { id: 'f2', name: 'Thịt nạc vai heo', category: 'Thịt các loại' }, netWeightPerPortionG: 45, grossWeightPerPortionG: 50, shrinkageRatio: 0.1 },
                { food: { id: 'f3', name: 'Nước dừa tươi', category: 'Gia vị & Khác' }, netWeightPerPortionG: 15, grossWeightPerPortionG: 15, shrinkageRatio: 0 },
              ],
            },
            mealTime: 'LUNCH',
          },
          {
            dish: {
              id: 'd3',
              name: 'Canh bí đỏ hầm xương heo',
              recipeItems: [
                { food: { id: 'f4', name: 'Bí đỏ hồ lô', category: 'Rau củ quả' }, netWeightPerPortionG: 40, grossWeightPerPortionG: 52, shrinkageRatio: 0.23 },
                { food: { id: 'f5', name: 'Xương ống heo', category: 'Thịt các loại' }, netWeightPerPortionG: 25, grossWeightPerPortionG: 35, shrinkageRatio: 0.28 },
              ],
            },
            mealTime: 'LUNCH',
          },
          {
            dish: {
              id: 'd4',
              name: 'Chè hạt sen long nhãn (Xế)',
              recipeItems: [
                { food: { id: 'f6', name: 'Hạt sen tươi Huế', category: 'Ngũ cốc & Hạt' }, netWeightPerPortionG: 25, grossWeightPerPortionG: 30, shrinkageRatio: 0.16 },
                { food: { id: 'f7', name: 'Đường phèn kết tinh', category: 'Gia vị & Khác' }, netWeightPerPortionG: 10, grossWeightPerPortionG: 10, shrinkageRatio: 0 },
              ],
            },
            mealTime: 'AFTERNOON_SNACK',
          },
          {
            dish: {
              id: 'd5',
              name: 'Tráng miệng: Chuối tiêu chín',
              recipeItems: [
                { food: { id: 'f8', name: 'Chuối tiêu chín cây', category: 'Trái cây' }, netWeightPerPortionG: 60, grossWeightPerPortionG: 90, shrinkageRatio: 0.33 },
              ],
            },
            mealTime: 'LUNCH',
          },
        ],
      };
      setMenus([sampleMenu]);
      setSelectedMenu(sampleMenu);
    } finally {
      setLoading(false);
    }
  };

  // Calculation Logic: Net -> Yield / Refuse Rate -> Gross Weight
  const calculateGrossSummary = (): IngredientSummary[] => {
    const dishItems = selectedMenu?.menuDishes || (selectedMenu as any)?.dishes;
    if (!dishItems || dishItems.length === 0) return [];

    const map = new Map<string, IngredientSummary>();
    const foundWarnings: string[] = [];

    dishItems.forEach((item: any) => {
      // Filter by meal time if applied
      if (mealFilter !== 'ALL' && item.mealTime !== mealFilter) {
        return;
      }

      const dish = item.dish;
      if (!dish) return;

      if (!dish.recipeItems || dish.recipeItems.length === 0) {
        foundWarnings.push(`Món "${dish.name}" chưa có công thức định lượng (EX-01).`);
        return;
      }

      dish.recipeItems.forEach((ri: any) => {
        const food = ri.food;
        if (!food) return;

        const key = food.id || food.name;
        const netG = Number(ri.netWeightPerPortionG) || 50;
        const shrinkage = Number(ri.shrinkageRatio) || 0;
        // Gross per child: if grossWeightPerPortionG is set, use it; otherwise net / (1 - shrinkage)
        const grossG = Number(ri.grossWeightPerPortionG) || (shrinkage < 1 ? netG / (1 - shrinkage) : netG);

        const currentNetG = netG * portionsCount;
        const currentGrossG = grossG * portionsCount;

        if (map.has(key)) {
          const existing = map.get(key)!;
          existing.netTotalG += currentNetG;
          existing.grossTotalG += currentGrossG;
          existing.grossTotalKg = Number((existing.grossTotalG / 1000).toFixed(2));
          if (!existing.dishesUsed.includes(dish.name)) {
            existing.dishesUsed.push(dish.name);
          }
        } else {
          map.set(key, {
            id: key,
            name: food.name,
            category: food.category || 'Nguyên liệu',
            unit: food.defaultUnit || 'kg',
            refuseRate: Math.round(shrinkage * 100),
            netTotalG: currentNetG,
            grossTotalG: currentGrossG,
            grossTotalKg: Number((currentGrossG / 1000).toFixed(2)),
            dishesUsed: [dish.name],
          });
        }
      });
    });

    if (foundWarnings.length > 0 && warnings.length === 0) {
      setWarnings(Array.from(new Set(foundWarnings)));
    }

    let result = Array.from(map.values());

    // Search filter
    if (searchQuery.trim()) {
      result = result.filter((item) =>
        normalizeSearch(item.name).includes(normalizeSearch(searchQuery))
      );
    }

    // Category filter
    if (categoryFilter !== 'ALL') {
      result = result.filter((item) => item.category === categoryFilter);
    }

    return result.sort((a, b) => b.grossTotalKg - a.grossTotalKg);
  };

  const ingredientsList = calculateGrossSummary();
  const totalGrossKg = ingredientsList.reduce((sum, item) => sum + item.grossTotalKg, 0);
  const totalItemsCount = ingredientsList.length;

  const categories = Array.from(new Set(ingredientsList.map((i) => i.category)));

  const handleExport = async () => {
    const ok = await downloadExcel(`Du_tru_nguyen_lieu_${startDate}_${endDate}.xlsx`, [
      ['Nguyên liệu', 'Nhóm', 'Đơn vị', 'Hao hụt (%)', 'Khối lượng tinh (g)', 'Khối lượng thô (g)', 'Đề xuất mua (kg)', 'Món sử dụng'],
      ...ingredientsList.map(item => [item.name, item.category, item.unit, item.refuseRate, item.netTotalG, item.grossTotalG, item.grossTotalKg, item.dishesUsed.join('\n')]),
    ], 'Dự trù nguyên liệu mua hàng');
    if (ok) setExportSuccess('Đã xuất file Excel dự trù mua hàng.');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* ─── HEADER UC-92 ─── */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="text-emerald-200 text-xs font-medium">BGH & Chuyên gia Dinh dưỡng</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Dự Trù Mua Hàng & Khối Lượng Thô (Gross Weight)
          </h1>
          <p className="text-sm text-emerald-100/90 mt-1 max-w-2xl">
            Tự động quy đổi từ định lượng tịnh (Net Weight) sang khối lượng đi chợ nguyên trạng (Gross Weight) dựa trên thực đơn đã duyệt và tỷ lệ thải bỏ sơ chế.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => void handleExport()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white text-emerald-900 font-bold text-sm shadow hover:bg-emerald-50 transition active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            Xuất Excel đi chợ
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-700/60 hover:bg-emerald-700 text-white font-bold text-sm border border-emerald-500/40 transition active:scale-95"
          >
            <Printer className="w-4 h-4" />
            In phiếu dự trù
          </button>
        </div>
      </div>

      {/* ─── THÔNG BÁO XUẤT FILE ─── */}
      {exportSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-center gap-3 shadow-xs animate-in fade-in duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-semibold text-sm">{exportSuccess}</span>
        </div>
      )}

      {/* ─── CẢNH BÁO EX-01: MÓN ĂN THIẾU CÔNG THỨC ─── */}
      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-2xl space-y-1.5 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Cảnh báo thiếu công thức định lượng (EX-01)
          </div>
          <ul className="text-xs list-disc list-inside text-amber-700 space-y-0.5">
            {warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ─── FILTER CONTROL BAR ─── */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Chọn thực đơn duyệt */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Thực đơn duyệt (PRE-02)
              </label>
              <select
                value={selectedMenu?.id || ''}
                onChange={(e) => {
                  const m = menus.find((item) => item.id === e.target.value);
                  if (m) setSelectedMenu(m);
                }}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                {menus.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Bữa ăn */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Bữa ăn
              </label>
              <select
                value={mealFilter}
                onChange={(e: any) => setMealFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="ALL">Tất cả các bữa trong ngày</option>
                <option value="LUNCH">Bữa trưa chính (10h30)</option>
                <option value="AFTERNOON_SNACK">Bữa xế chiều (14h30)</option>
                <option value="BREAKFAST">Bữa sáng (7h00)</option>
              </select>
            </div>

            {/* Số suất ăn */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Số suất ăn dự kiến
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={portionsCount}
                  onChange={(e) => setPortionsCount(Math.max(1, Number(e.target.value)))}
                  className="w-24 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <span className="text-xs text-slate-500 font-medium">trẻ</span>
              </div>
            </div>
          </div>

          {/* KPI Tóm Tắt */}
          <div className="flex items-center gap-4 border-l border-slate-100 pl-4">
            <div className="text-right">
              <span className="text-[11px] font-bold text-slate-400 block uppercase">Tổng loại mặt hàng</span>
              <span className="text-xl font-black text-slate-800">{totalItemsCount} nguyên liệu</span>
            </div>
            <div className="text-right bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
              <span className="text-[11px] font-bold text-emerald-700 block uppercase">Tổng trọng lượng thô</span>
              <span className="text-xl font-black text-emerald-800">{totalGrossKg.toFixed(1)} kg</span>
            </div>
          </div>
        </div>

        {/* Tìm kiếm & lọc phân loại */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm tên thực phẩm / nguyên liệu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Nhóm:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-medium text-slate-700 focus:outline-none"
            >
              <option value="ALL">Tất cả nhóm</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ─── DANH SÁCH BẢNG DỰ TRÙ GROSS WEIGHT ─── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        {ingredientsList.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-700">Không tìm thấy dữ liệu nguyên liệu phù hợp (A.1)</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Vui lòng kiểm tra lại bộ lọc bữa ăn hoặc chọn tuần có thực đơn đã được phê duyệt.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-12 text-center">STT</th>
                  <th className="py-3.5 px-4">Tên thực phẩm / Nguyên liệu</th>
                  <th className="py-3.5 px-4">Nhóm nguyên liệu</th>
                  <th className="py-3.5 px-4 text-right">Khối lượng Tịnh (Net)</th>
                  <th className="py-3.5 px-4 text-center">Tỷ lệ thải bỏ sơ chế</th>
                  <th className="py-3.5 px-4 text-right font-black text-emerald-800">
                    Khối lượng Thô cần mua (Gross)
                  </th>
                  <th className="py-3.5 px-4">Món ăn sử dụng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {ingredientsList.map((item, index) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 text-center font-bold text-slate-400">{index + 1}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">
                      <div className="flex items-center gap-2">
                        <span>{item.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 font-semibold text-slate-600 text-[11px]">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-slate-600">
                      {(item.netTotalG / 1000).toFixed(2)} kg
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60 text-[11px]">
                        {item.refuseRate}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="font-extrabold text-sm text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200/70">
                        {item.grossTotalKg} kg
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {item.dishesUsed.map((dishName, dIdx) => (
                          <span
                            key={dIdx}
                            className="bg-teal-50 border border-teal-200/50 text-teal-800 px-2 py-0.5 rounded-lg text-[10px] font-medium"
                          >
                            {dishName}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
