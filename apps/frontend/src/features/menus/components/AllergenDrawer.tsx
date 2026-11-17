import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, AlertCircle, Check } from 'lucide-react';
import {
  AllergenCatalog,
  CreateAllergenPayload,
  UpdateAllergenPayload,
} from '../api/nutrition-rule-engine.api';

interface AllergenDrawerProps {
  isOpen: boolean;
  allergen: AllergenCatalog | null;
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateAllergenPayload | UpdateAllergenPayload, id?: string) => Promise<void>;
}

const EMPTY_FORM = { code: '', nameVi: '', nameEn: '', commonFoods: '', description: '' };

export const AllergenDrawer: React.FC<AllergenDrawerProps> = ({
  isOpen,
  allergen,
  isLoading,
  onClose,
  onSubmit,
}) => {
  useLanguage();
  const isEditMode = Boolean(allergen);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);
    if (allergen) {
      setForm({
        code: allergen.code || '',
        nameVi: allergen.nameVi || (allergen as any).name || '',
        nameEn: allergen.nameEn || '',
        commonFoods: allergen.commonFoods || '',
        description: allergen.description || '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [isOpen, allergen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!form.code.trim()) return setErrorMessage('Vui lòng nhập mã định danh chất dị ứng.');
    if (!form.nameVi.trim()) return setErrorMessage('Vui lòng nhập tên tiếng Việt của chất dị ứng.');

    try {
      await onSubmit(
        {
          code: form.code.trim().toUpperCase(),
          nameVi: form.nameVi.trim(),
          nameEn: form.nameEn.trim() || undefined,
          commonFoods: form.commonFoods.trim() || undefined,
          description: form.description.trim() || undefined,
        },
        allergen?.id,
      );
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Lỗi khi lưu thông tin chất dị ứng.';
      setErrorMessage(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed !m-0 inset-0 z-50 overflow-hidden">
      <div className="fixed !m-0 inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 max-w-lg w-full bg-white shadow-2xl flex flex-col z-50 animate-in slide-in-from-right">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                {translateText(isEditMode ? 'Chỉnh Sửa Chất Gây Dị Ứng' : 'Thêm Chất Gây Dị Ứng Mới')}
              </h2>
              <p className="text-xs text-slate-400 font-medium">{translateText("Cấu hình danh mục chất dị ứng và nguồn thực phẩm cảnh báo")}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form id="allergen-drawer-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-red-700">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{translateText(errorMessage)}</span>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1.5">{translateText("Mã chất dị ứng (Viết hoa, không dấu) ")}<span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              disabled={isEditMode}
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder={translateText("Ví dụ: SESAME, MOLLUSCS, PEANUT")}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono ${
                isEditMode ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200' : 'border-slate-200 focus:ring-2 focus:ring-rose-500'
              }`}
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1.5">{translateText("Tên tiếng Việt ")}<span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              value={form.nameVi}
              onChange={(e) => setForm({ ...form, nameVi: e.target.value })}
              placeholder={translateText("Ví dụ: Mè / Vừng đen")}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1.5">{translateText("Tên tiếng Anh (Tùy chọn)")}</label>
            <input
              type="text"
              value={form.nameEn}
              onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
              placeholder={translateText("Ví dụ: Sesame Seeds")}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1.5">{translateText("Thực phẩm thường gặp")}</label>
            <textarea
              rows={3}
              value={form.commonFoods}
              onChange={(e) => setForm({ ...form, commonFoods: e.target.value })}
              placeholder={translateText("Ví dụ: Dầu mè, chè mè đen, kẹo mè xửng...")}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1.5">{translateText("Mô tả triệu chứng & Hướng dẫn phản vệ")}</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={translateText("Ví dụ: Dị ứng protein gây mẩn ngứa, phù môi, nguy cơ co thắt phế quản...")}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-rose-500"
            />
          </div>
        </form>

        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} disabled={isLoading} className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition">{translateText("Hủy bỏ")}</button>
          <button type="submit" form="allergen-drawer-form" disabled={isLoading} className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/25 transition flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{translateText(isLoading ? 'Đang lưu...' : isEditMode ? 'Lưu Thay Đổi' : 'Thêm Dị Ứng')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
