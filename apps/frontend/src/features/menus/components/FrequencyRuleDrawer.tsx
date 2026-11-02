import React, { useState, useEffect } from 'react';
import { X, Sparkles, Scale, AlertCircle, Check } from 'lucide-react';
import { DishFrequencyRule } from '../api/nutrition-rule-engine.api';

interface FrequencyRuleDrawerProps {
  isOpen: boolean;
  rule: DishFrequencyRule | null;
  catalog: {
    dishCategories: Array<{ id: number; code: string; name: string; isRequiredInMeal: boolean }>;
    standardFoodGroups: Array<{ code: string; name: string }>;
  } | null;
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (payload: Partial<DishFrequencyRule>, id?: number) => Promise<void>;
}

const DEFAULT_FORM: Partial<DishFrequencyRule> = {
  ruleName: '',
  mealSlot: 'LUNCH',
  targetType: 'DISH_CATEGORY',
  targetCode: 'MAIN',
  targetName: 'Món mặn (Món chính)',
  ageGroup: 'MAU_GIAO',
  periodType: 'PER_CYCLE_4_WEEKS',
  minOccurrences: 0,
  maxOccurrences: 2,
  isRequiredInMeal: true,
  severity: 'WARNING',
  isActive: true,
  note: '',
};

export const FrequencyRuleDrawer: React.FC<FrequencyRuleDrawerProps> = ({
  isOpen,
  rule,
  catalog,
  isLoading,
  onClose,
  onSubmit,
}) => {
  const isEditMode = Boolean(rule);
  const [form, setForm] = useState<Partial<DishFrequencyRule>>(DEFAULT_FORM);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);
    if (rule) {
      setForm({ ...rule });
    } else {
      setForm({ ...DEFAULT_FORM });
    }
  }, [isOpen, rule]);

  if (!isOpen) return null;

  const handleTargetChange = (code: string) => {
    if (form.targetType === 'DISH_CATEGORY') {
      const found = catalog?.dishCategories.find((c) => c.code === code);
      setForm((prev) => ({
        ...prev,
        targetCode: code,
        targetName: found?.name || code,
        isRequiredInMeal: found?.isRequiredInMeal || false,
      }));
    } else {
      const found = catalog?.standardFoodGroups.find((g) => g.code === code);
      setForm((prev) => ({
        ...prev,
        targetCode: code,
        targetName: found?.name || code,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!form.ruleName?.trim()) {
      setErrorMessage('Vui lòng nhập tên quy tắc');
      return;
    }
    if ((form.minOccurrences ?? 0) > (form.maxOccurrences ?? 1)) {
      setErrorMessage('Số lần tối thiểu không được lớn hơn số lần tối đa');
      return;
    }

    try {
      await onSubmit(form, rule?.id);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || err?.message || 'Có lỗi xảy ra khi lưu quy tắc');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col justify-between overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-emerald-50/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">
                {isEditMode ? 'Chỉnh sửa Quy tắc Tần suất' : 'Thêm mới Quy tắc Tần suất'}
              </h3>
              <p className="text-xs text-slate-500">
                Cấu hình số lần xuất hiện cho loại món (Món mặn, cơm, canh...) hoặc 10 nhóm thực phẩm
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form id="freq-rule-form" onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-5">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Tên quy tắc */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Tên quy tắc <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.ruleName || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, ruleName: e.target.value }))}
              placeholder="VD: Món mặn bữa trưa tối đa 2 lần/chu kỳ 4 tuần"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          {/* Loại mục tiêu & Khung giờ */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Loại mục tiêu
              </label>
              <select
                value={form.targetType}
                onChange={(e) => {
                  const type = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    targetType: type,
                    targetCode: type === 'DISH_CATEGORY' ? 'MAIN' : 'MEAT',
                    targetName: type === 'DISH_CATEGORY' ? 'Món mặn (Món chính)' : 'VII. Thịt và sản phẩm chế biến',
                  }));
                }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="DISH_CATEGORY">Loại món ăn (Cơm, Món mặn, Canh...)</option>
                <option value="FOOD_GROUP">10 Nhóm thực phẩm (Phụ lục 7)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Khung giờ bữa ăn
              </label>
              <select
                value={form.mealSlot}
                onChange={(e) => setForm((prev) => ({ ...prev, mealSlot: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="ALL">Tất cả khung giờ</option>
                <option value="MORNING_SNACK">Phụ sáng (09:30)</option>
                <option value="LUNCH">Bữa trưa chính (11:00)</option>
                <option value="AFTERNOON_SNACK">Phụ chiều / Xế (14:30)</option>
              </select>
            </div>
          </div>

          {/* Chọn đối tượng cụ thể */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Đối tượng áp dụng ({form.targetType === 'DISH_CATEGORY' ? 'Loại món' : 'Nhóm nguyên liệu'})
            </label>
            <select
              value={form.targetCode}
              onChange={(e) => handleTargetChange(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-medium"
            >
              {form.targetType === 'DISH_CATEGORY' ? (
                <>
                  <option value="MAIN">🥩 Món mặn (Món chính - Thịt, cá, tôm...)</option>
                  <option value="RICE">🍚 Cơm / Cháo (Tinh bột nền tảng)</option>
                  <option value="SOUP">🍲 Canh / Súp</option>
                  <option value="SIDE">🥗 Món phụ / Rau xào</option>
                  <option value="DESSERT">🍉 Tráng miệng (Trái cây, sữa chua)</option>
                  <option value="SNACK_AFTERNOON">🥣 Món xế chiều (Chè, súp, bún...)</option>
                  <option value="SNACK_MORNING">🥛 Xế sáng / Sữa tươi</option>
                  <option value="DRINK">🥤 Thức uống</option>
                </>
              ) : (
                catalog?.standardFoodGroups.map((g) => (
                  <option key={g.code} value={g.code}>
                    {g.name}
                  </option>
                )) || <option value="MEAT">VII. Thịt và sản phẩm chế biến</option>
              )}
            </select>
          </div>

          {/* Lứa tuổi & Chu kỳ */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Lứa tuổi áp dụng
              </label>
              <select
                value={form.ageGroup}
                onChange={(e) => setForm((prev) => ({ ...prev, ageGroup: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="ALL">Tất cả khối lớp</option>
                <option value="MAU_GIAO">Mẫu giáo (3 - 6 tuổi)</option>
                <option value="NHA_TRE">Nhà trẻ (1 - 3 tuổi)</option>
                <option value="PRIMARY_6_7">Tiểu học (6 - 7 tuổi)</option>
                <option value="PRIMARY_8_9">Tiểu học (8 - 9 tuổi)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Phạm vi chu kỳ
              </label>
              <select
                value={form.periodType}
                onChange={(e) => setForm((prev) => ({ ...prev, periodType: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="PER_CYCLE_4_WEEKS">Theo chu kỳ 4 tuần</option>
                <option value="PER_WEEK">Theo từng tuần (T2 - T6)</option>
                <option value="PER_DAY">Theo ngày</option>
              </select>
            </div>
          </div>

          {/* Số lần Tối thiểu - Tối đa */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Số lần tối thiểu (Min)
              </label>
              <input
                type="number"
                min="0"
                value={form.minOccurrences ?? 0}
                onChange={(e) => setForm((prev) => ({ ...prev, minOccurrences: parseInt(e.target.value, 10) || 0 }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              />
              <span className="text-[10px] text-slate-500">0 = Không bắt buộc</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Số lần tối đa (Max)
              </label>
              <input
                type="number"
                min="1"
                value={form.maxOccurrences ?? 2}
                onChange={(e) => setForm((prev) => ({ ...prev, maxOccurrences: parseInt(e.target.value, 10) || 1 }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                required
              />
              <span className="text-[10px] text-slate-500">Giới hạn không vượt quá</span>
            </div>
          </div>

          {/* Tùy chọn bắt buộc & Mức độ */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="isRequiredInMeal"
                checked={form.isRequiredInMeal ?? false}
                onChange={(e) => setForm((prev) => ({ ...prev, isRequiredInMeal: e.target.checked }))}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="isRequiredInMeal" className="text-xs font-medium text-slate-700 cursor-pointer">
                Bắt buộc có trong bữa
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mức độ nghiêm ngặt
              </label>
              <select
                value={form.severity}
                onChange={(e) => setForm((prev) => ({ ...prev, severity: e.target.value }))}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="WARNING">Cảnh báo (WARNING)</option>
                <option value="ERROR">Chặn lưu (ERROR)</option>
                <option value="INFO">Thông tin (INFO)</option>
              </select>
            </div>
          </div>

          {/* Ghi chú */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Ghi chú nghiệp vụ
            </label>
            <textarea
              rows={2}
              value={form.note || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
              placeholder="VD: Tuân thủ Thông tư 28 về cân đối đạm động vật và thực vật"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            form="freq-rule-form"
            disabled={isLoading}
            className="px-5 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            {isLoading ? <Sparkles className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            <span>{isEditMode ? 'Lưu thay đổi' : 'Tạo quy tắc'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

