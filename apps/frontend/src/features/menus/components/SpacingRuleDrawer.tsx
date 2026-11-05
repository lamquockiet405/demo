import React, { useState, useEffect } from 'react';
import { X, Sparkles, Clock, AlertCircle, Check } from 'lucide-react';
import { DishSpacingRule } from '../api/nutrition-rule-engine.api';

interface SpacingRuleDrawerProps {
  isOpen: boolean;
  rule: DishSpacingRule | null;
  catalog: {
    categories: Array<{ id: number; code: string; name: string }>;
    dishes: Array<{ id: number; name: string; categoryCode: string; categoryName: string }>;
  } | null;
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (payload: Partial<DishSpacingRule>, id?: number) => Promise<void>;
}

const DEFAULT_FORM: Partial<DishSpacingRule> = {
  ruleName: '',
  mealSlot: 'LUNCH',
  targetType: 'DISH_CATEGORY',
  targetName: 'Món mặn (Món chính)',
  ageGroup: 'MAU_GIAO',
  minSpacingDays: 14,
  noRepeatInSameWeek: true,
  noRepeatInSameDay: true,
  priorityOrder: 1,
  severity: 'WARNING',
  isActive: true,
  note: '',
};

export const SpacingRuleDrawer: React.FC<SpacingRuleDrawerProps> = ({
  isOpen,
  rule,
  catalog,
  isLoading,
  onClose,
  onSubmit,
}) => {
  const isEditMode = Boolean(rule);
  const [form, setForm] = useState<Partial<DishSpacingRule>>(DEFAULT_FORM);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!form.ruleName?.trim()) {
      setErrorMessage('Vui lòng nhập tên quy tắc giãn cách');
      return;
    }
    if ((form.minSpacingDays ?? 1) < 1) {
      setErrorMessage('Số ngày giãn cách tối thiểu phải >= 1');
      return;
    }

    try {
      await onSubmit(form, rule?.id);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || err?.message || 'Có lỗi xảy ra khi lưu quy tắc giãn cách');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col justify-between overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-blue-50/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">
                {isEditMode ? 'Chỉnh sửa Quy tắc Giãn cách Món' : 'Thêm mới Quy tắc Giãn cách Món'}
              </h3>
              <p className="text-xs text-slate-500">
                Thiết lập số ngày cách ly giữa 2 lần xuất hiện cùng một món ăn để chống ngán
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
        <form id="spacing-rule-form" onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-5">
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
              placeholder="VD: Giãn cách món mặn tối thiểu 14 ngày"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Loại mục tiêu & Khung giờ */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Áp dụng theo
              </label>
              <select
                value={form.targetType}
                onChange={(e) => setForm((prev) => ({ ...prev, targetType: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="DISH_CATEGORY">Toàn bộ loại món (Món mặn, Canh, Món xế...)</option>
                <option value="SPECIFIC_DISH">Món ăn cụ thể trong thực đơn</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Khung giờ bữa ăn
              </label>
              <select
                value={form.mealSlot}
                onChange={(e) => setForm((prev) => ({ ...prev, mealSlot: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="ALL">Tất cả khung giờ</option>
                <option value="BREAKFAST">Buổi sáng (09:00)</option>
                <option value="LUNCH">Bữa trưa chính (11:00)</option>
                <option value="AFTERNOON_SNACK">Phụ chiều / Xế (14:30)</option>
              </select>
            </div>
          </div>

          {/* Chọn mục tiêu */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {form.targetType === 'DISH_CATEGORY' ? 'Chọn loại món ăn' : 'Chọn món ăn cụ thể từ Database'}
            </label>
            {form.targetType === 'DISH_CATEGORY' ? (
              <select
                value={form.targetName || 'Món mặn (Món chính)'}
                onChange={(e) => setForm((prev) => ({ ...prev, targetName: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium"
              >
                <option value="Món mặn (Món chính)">🥩 Món mặn (Món chính - Giãn cách chuẩn 14 ngày)</option>
                <option value="Canh / Súp">🍲 Canh / Súp (Giãn cách chuẩn 7 ngày)</option>
                <option value="Món phụ / Rau xào">🥗 Món phụ / Rau xào (Giãn cách chuẩn 5 ngày)</option>
                <option value="Tráng miệng">🍉 Tráng miệng (Giãn cách chuẩn 3 ngày)</option>
                <option value="Món xế chiều">🥣 Món xế chiều (Giãn cách chuẩn 7 ngày)</option>
              </select>
            ) : (
              <select
                value={form.targetId || ''}
                onChange={(e) => {
                  const id = parseInt(e.target.value, 10);
                  const found = catalog?.dishes.find((d) => d.id === id);
                  setForm((prev) => ({
                    ...prev,
                    targetId: id,
                    targetName: found?.name || '',
                  }));
                }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium"
              >
                <option value="">-- Chọn món ăn từ thư viện món --</option>
                {catalog?.dishes.map((d) => (
                  <option key={d.id} value={d.id}>
                    [{d.categoryCode}] {d.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Số ngày giãn cách tối thiểu */}
          <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-800">
                  Số ngày giãn cách tối thiểu (Min Spacing Days)
                </label>
                <p className="text-[11px] text-slate-500">
                  Cùng 1 món ăn sẽ không được xuất hiện lại trong số ngày này
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={form.minSpacingDays ?? 14}
                  onChange={(e) => setForm((prev) => ({ ...prev, minSpacingDays: parseInt(e.target.value, 10) || 1 }))}
                  className="w-20 px-3 py-2 text-sm font-bold text-blue-700 text-center border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  required
                />
                <span className="text-xs font-semibold text-slate-600">ngày</span>
              </div>
            </div>

            <div className="pt-2 border-t border-blue-200/60 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.noRepeatInSameWeek ?? true}
                  onChange={(e) => setForm((prev) => ({ ...prev, noRepeatInSameWeek: e.target.checked }))}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Tuyệt đối không lặp lại trong cùng 1 tuần (Thứ 2 đến Thứ 6)</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.noRepeatInSameDay ?? true}
                  onChange={(e) => setForm((prev) => ({ ...prev, noRepeatInSameDay: e.target.checked }))}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Không lặp lại trong cùng 1 ngày (VD: Không dùng lại món trưa vào bữa xế)</span>
              </label>
            </div>
          </div>

          {/* Độ ưu tiên & Mức độ */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Độ ưu tiên quy tắc
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={form.priorityOrder ?? 1}
                onChange={(e) => setForm((prev) => ({ ...prev, priorityOrder: parseInt(e.target.value, 10) || 1 }))}
                className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <span className="text-[10px] text-slate-500">1 - 10 (Cao hơn = ưu tiên hơn)</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mức độ nghiêm ngặt
              </label>
              <select
                value={form.severity}
                onChange={(e) => setForm((prev) => ({ ...prev, severity: e.target.value }))}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
              placeholder="VD: Món bò và tôm có giá thành cao, cần giãn cách hợp lý theo tài chính bán trú"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            form="spacing-rule-form"
            disabled={isLoading}
            className="px-5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            {isLoading ? <Sparkles className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            <span>{isEditMode ? 'Lưu thay đổi' : 'Tạo quy tắc'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

