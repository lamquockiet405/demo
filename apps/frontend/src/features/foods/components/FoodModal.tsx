import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useEffect, useState } from 'react';
import { apiClient } from '@/core/api/axios';
import { X, Save, AlertTriangle, Lock, Sparkles, Info, CheckCircle2 } from 'lucide-react';

interface FoodModalProps {
  isOpen: boolean;
  mode: 'create' | 'view' | 'edit';
  foodId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface FoodCategory {
  id: string;
  name: string;
}

export const FoodModal: React.FC<FoodModalProps> = ({
  isOpen,
  mode,
  foodId,
  onClose,
  onSuccess,
}) => {
  useLanguage();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<FoodCategory[]>([]);
  const [servingWeight, setServingWeight] = useState<number | ''>(100);
  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
    category: '',
    energyKcal: '' as any,
    proteinG: '' as any,
    fatG: '' as any,
    carbG: '' as any,
    calciumMg: '' as any,
    ironMg: '' as any,
    zincMg: '' as any,
    defaultUnit: 'g',
    refuseRatePercent: 0,
    allergens: [] as string[],
    imageUrl: '',
    description: '',
    status: 'ACTIVE',
  });
  const [allergenInput, setAllergenInput] = useState('');

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await apiClient.get('/foods/categories');
        const raw = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.items || []);
        setCategories(raw);
      } catch (err) {
        console.error('Error fetching categories in FoodModal:', err);
      }
    };
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'create') {
        setServingWeight(100);
        setFormData({
          name: '',
          categoryId: '',
          category: '',
          energyKcal: '' as any,
          proteinG: '' as any,
          fatG: '' as any,
          carbG: '' as any,
          calciumMg: '' as any,
          ironMg: '' as any,
          zincMg: '' as any,
          defaultUnit: 'g',
          refuseRatePercent: 0,
          allergens: [],
          imageUrl: '',
          description: '',
          status: 'ACTIVE',
        });
        setAllergenInput('');
      } else if (foodId) {
        fetchFoodDetails(foodId);
      }
    }
  }, [isOpen, mode, foodId]);

  const fetchFoodDetails = async (id: string) => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/foods/${id}`);
      const catId = res.data.categoryId ? String(res.data.categoryId) : (res.data.category?.id ? String(res.data.category.id) : '');
      setFormData({
        name: res.data.name || '',
        categoryId: catId,
        category: typeof res.data.category === 'object' && res.data.category !== null ? (res.data.category.name || res.data.category.code || '') : (res.data.categoryName || res.data.category || ''),
        energyKcal: res.data.energyKcal ?? res.data.energyKcal100g ?? '',
        proteinG: res.data.proteinG ?? '',
        fatG: res.data.fatG ?? '',
        carbG: res.data.carbG ?? '',
        calciumMg: res.data.calciumMg ?? '',
        ironMg: res.data.ironMg ?? '',
        zincMg: res.data.zincMg ?? '',
        defaultUnit: res.data.unit || res.data.defaultUnit || 'g',
        refuseRatePercent: Number(res.data.refuseRatePercent ?? res.data.refuse_rate_percent ?? 0),
        allergens: Array.isArray(res.data.allergens)
          ? res.data.allergens.map((a: any) => typeof a === 'object' && a !== null ? (a.name || a.allergenName || String(a.id)) : String(a))
          : [],
        imageUrl: res.data.imageUrl || '',
        description: res.data.description || '',
        status: res.data.status || 'ACTIVE',
      });
      setAllergenInput(res.data.allergens?.join(', ') || '');
    } catch (error) {
      console.error('Error fetching food details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: ['energyKcal', 'proteinG', 'fatG', 'carbG', 'calciumMg', 'ironMg', 'zincMg', 'refuseRatePercent'].includes(name)
        ? (value === '' ? '' : Number(value))
        : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'view') return;

    try {
      setLoading(true);

      if (mode === 'create') {
        if (!formData.name.trim()) {
          alert(translateText('Vui lòng nhập tên nguyên liệu / sản phẩm!'));
          setLoading(false);
          return;
        }
        if (!formData.categoryId) {
          alert(translateText('Vui lòng chọn nhóm thực phẩm!'));
          setLoading(false);
          return;
        }
        const servingWeightNum = Number(servingWeight) || 0;
        if (servingWeightNum <= 0) {
          alert(translateText('Khối lượng bao bì ghi trên nhãn phải lớn hơn 0!'));
          setLoading(false);
          return;
        }
        if (formData.energyKcal === '' || Number(formData.energyKcal) <= 0) {
          alert(translateText('Vui lòng nhập Năng lượng (kcal) ghi trên bao bì (bắt buộc > 0)!'));
          setLoading(false);
          return;
        }
        if (formData.proteinG === '' || Number(formData.proteinG) < 0) {
          alert(translateText('Vui lòng nhập hàm lượng Đạm / Protein (g) ghi trên bao bì!'));
          setLoading(false);
          return;
        }
        if (formData.fatG === '' || Number(formData.fatG) < 0) {
          alert(translateText('Vui lòng nhập hàm lượng Chất béo / Fat (g) ghi trên bao bì!'));
          setLoading(false);
          return;
        }
        if (formData.carbG === '' || Number(formData.carbG) < 0) {
          alert(translateText('Vui lòng nhập hàm lượng Carbohydrate / Tinh bột (g) ghi trên bao bì!'));
          setLoading(false);
          return;
        }
        if (Number(formData.refuseRatePercent) < 0 || Number(formData.refuseRatePercent) > 100) {
          alert(translateText('Tỉ lệ thải bỏ phải nằm trong khoảng từ 0% đến 100%!'));
          setLoading(false);
          return;
        }

        const factor = 100 / servingWeightNum;
        const createPayload = {
          name: formData.name.trim(),
          categoryId: Number(formData.categoryId),
          unit: formData.defaultUnit === 'gram' ? 'g' : formData.defaultUnit,
          // Đã tự động quy đổi về mốc chuẩn 100g ăn được
          energyKcal100g: Number((Number(formData.energyKcal || 0) * factor).toFixed(1)),
          energyKcal: Number((Number(formData.energyKcal || 0) * factor).toFixed(1)),
          proteinG: Number((Number(formData.proteinG || 0) * factor).toFixed(2)),
          fatG: Number((Number(formData.fatG || 0) * factor).toFixed(2)),
          carbG: Number((Number(formData.carbG || 0) * factor).toFixed(2)),
          calciumMg: formData.calciumMg !== '' && formData.calciumMg !== undefined ? Number((Number(formData.calciumMg || 0) * factor).toFixed(1)) : 0,
          ironMg: formData.ironMg !== '' && formData.ironMg !== undefined ? Number((Number(formData.ironMg || 0) * factor).toFixed(2)) : 0,
          zincMg: formData.zincMg !== '' && formData.zincMg !== undefined ? Number((Number(formData.zincMg || 0) * factor).toFixed(2)) : 0,
          refuseRatePercent: Number(formData.refuseRatePercent || 0),
          status: formData.status || 'ACTIVE',
          phosphorusMg: 0,
          sodiumMg: 0,
          vitaminAMcg: 0,
          vitaminCMg: 0,
          sourceMetadata: {
            description: formData.description?.trim() || undefined,
            allergens: allergenInput ? allergenInput.split(',').map((a) => a.trim()).filter(Boolean) : [],
          },
        };

        await apiClient.post('/foods', createPayload);
      } else if (mode === 'edit' && foodId) {
        const payload = {
          ...formData,
          categoryId: formData.categoryId ? Number(formData.categoryId) : undefined,
          allergens: allergenInput ? allergenInput.split(',').map((a) => a.trim()).filter(Boolean) : [],
          imageUrl: formData.imageUrl,
          description: formData.description,
          status: formData.status,
        };
        const updatePayload = { ...payload, energyKcal100g: Number(formData.energyKcal), unit: formData.defaultUnit === 'gram' ? 'g' : formData.defaultUnit,
          sourceMetadata: { description: formData.description, allergens: payload.allergens } };
        await apiClient.put(`/foods/${foodId}`, updatePayload);
      }
      
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving food:', error);
      const msg = error?.response?.data?.message || error?.message || translateText('Đã xảy ra lỗi khi lưu nguyên liệu!');
      alert(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isReadOnly = mode === 'view';
  const isNutritionReadOnly = mode === 'view';

  const servingWeightNum = Number(servingWeight) || 100;
  const factor = servingWeightNum > 0 ? 100 / servingWeightNum : 1;
  const rawEnergy = Number(formData.energyKcal) || 0;
  const rawProtein = Number(formData.proteinG) || 0;
  const rawFat = Number(formData.fatG) || 0;
  const rawCarb = Number(formData.carbG) || 0;
  const rawCalcium = Number(formData.calciumMg) || 0;
  const rawIron = Number(formData.ironMg) || 0;
  const rawZinc = Number(formData.zincMg) || 0;

  const normEnergy = Number((rawEnergy * factor).toFixed(1));
  const normProtein = Number((rawProtein * factor).toFixed(2));
  const normFat = Number((rawFat * factor).toFixed(2));
  const normCarb = Number((rawCarb * factor).toFixed(2));
  const normCalcium = Number((rawCalcium * factor).toFixed(1));
  const normIron = Number((rawIron * factor).toFixed(2));
  const normZinc = Number((rawZinc * factor).toFixed(2));

  return (
    <div className="fixed !m-0 inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800">
            {translateText(mode === 'create' ? 'Thêm nguyên liệu mới' : mode === 'edit' ? 'Cập nhật nguyên liệu' : 'Chi tiết nguyên liệu')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading && mode !== 'create' ? (
            <div className="flex justify-center items-center py-20 text-slate-500">{translateText("Đang tải dữ liệu...")}</div>
          ) : (
            <form id="food-form" onSubmit={handleSubmit} className="space-y-6">
              
              {mode === 'create' && (
                <div className="p-3.5 bg-blue-50/90 border border-blue-200/90 rounded-2xl flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="text-xs text-blue-900 leading-relaxed">
                    <strong className="font-bold">{translateText("Khai báo sản phẩm mới (Sữa, Bánh, Đồ ăn đóng gói...):")}</strong>
                    <p className="mt-0.5 text-blue-800">{translateText("Hệ thống đã có sẵn các nguyên liệu tươi sống (thịt, cá, rau củ...). Tại đây, bạn nhập các chỉ số dinh dưỡng ")}<strong>{translateText("ghi trên nhãn bao bì")}</strong>{translateText(" (VD: hộp sữa 180ml hoặc gói bánh 25g). Hệ thống sẽ ")}<strong>{translateText("tự động quy đổi về mốc chuẩn 100g")}</strong>.
                    </p>
                  </div>
                </div>
              )}

              <div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{translateText("Tên nguyên liệu *")}</label>
                  <input
                    type="text"
                    name="name"
                    required
                    readOnly={isReadOnly}
                    value={formData.name}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 rounded-xl border ${isReadOnly ? 'bg-slate-100 border-transparent text-slate-600' : 'border-slate-200 focus:ring-2 focus:ring-emerald-500'} outline-none`}
                    placeholder={translateText("VD: Sữa tươi tiệt trùng ít đường TH True Milk 180ml")}
                  />
                </div>
              </div>

              {mode === 'create' && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-800">{translateText("Khối lượng / Thể tích 1 khẩu phần ghi trên nhãn bao bì ")}<span className="text-rose-500">*</span>
                      </label>
                      <p className="text-[11px] text-slate-500">{translateText("Nhập đúng khối lượng ghi trên bao bì sản phẩm (VD: 1 hộp sữa 180ml, 1 gói bánh 25g, hoặc 100g)")}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-slate-400 font-medium">{translateText("Chọn nhanh:")}</span>
                      {[
                        { label: translateText('100g (Chuẩn)'), value: 100 },
                        { label: translateText('180ml (Hộp sữa)'), value: 180 },
                        { label: translateText('110ml (Hộp nhỏ)'), value: 110 },
                        { label: translateText('65ml (Sữa chua)'), value: 65 },
                        { label: translateText('25g (Gói bánh)'), value: 25 },
                      ].map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setServingWeight(preset.value)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
                            Number(servingWeight) === preset.value
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {translateText(preset.label)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="relative w-48 shrink-0">
                      <input
                        type="number"
                        min="1"
                        max="5000"
                        step="1"
                        placeholder={"100"}
                        value={servingWeight}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') {
                            setServingWeight('');
                          } else {
                            const parsed = Number(val);
                            setServingWeight(isNaN(parsed) ? '' : Math.max(0, parsed));
                          }
                        }}
                        onBlur={() => {
                          if (servingWeight === '' || Number(servingWeight) <= 0) {
                            setServingWeight(100);
                          }
                        }}
                        className="w-full px-3 py-2 pr-12 rounded-xl border border-slate-200 bg-white font-black text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        {translateText(formData.defaultUnit === 'ml' || formData.defaultUnit === 'l' ? 'ml' : 'g')}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 flex items-center gap-2">
                      {Number(servingWeight) === 100 ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg font-semibold text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />{translateText("Mốc chuẩn 100g (Dữ liệu dinh dưỡng được giữ nguyên)")}</span>
                      ) : Number(servingWeight) > 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg font-semibold text-xs">
                          <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />{translateText("Tự động quy đổi từ ")}{translateText(servingWeight)}{translateText(formData.defaultUnit === 'ml' || formData.defaultUnit === 'l' ? 'ml' : 'g')}{translateText(" về chuẩn 100g")}</span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">{translateText("Nhập khối lượng khẩu phần (VD: 180ml hoặc 25g)")}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{translateText("Nhóm thực phẩm *")}</label>
                  <select
                    name="categoryId"
                    required
                    disabled={isReadOnly}
                    value={formData.categoryId}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 rounded-xl border text-sm ${isReadOnly ? 'bg-slate-100 border-transparent text-slate-600 appearance-none' : 'border-slate-200 focus:ring-2 focus:ring-emerald-500'} outline-none`}
                  >
                    <option value="">{translateText("-- Chọn nhóm thực phẩm --")}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{translateText("Đơn vị tính *")}</label>
                  <select
                    name="defaultUnit"
                    required
                    disabled={isReadOnly}
                    value={formData.defaultUnit === 'gram' ? 'g' : formData.defaultUnit}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 rounded-xl border text-sm ${isReadOnly ? 'bg-slate-100 border-transparent text-slate-600 appearance-none' : 'border-slate-200 focus:ring-2 focus:ring-emerald-500'} outline-none`}
                  >
                    <option value="g">{translateText("Gam (g)")}</option>
                    <option value="kg">{translateText("Kilogram (kg)")}</option>
                    <option value="ml">{translateText("Millilit (ml)")}</option>
                    <option value="l">{translateText("Lít (l)")}</option>
                    <option value="hộp">{translateText("Hộp (hộp)")}</option>
                    <option value="gói">{translateText("Gói (gói)")}</option>
                    <option value="hũ">{translateText("Hũ (hũ)")}</option>
                    <option value="chai">{translateText("Chai (chai)")}</option>
                    <option value="cái">{translateText("Cái (cái)")}</option>
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-slate-700">{translateText("Tỉ lệ thải bỏ (%) ")}{mode === 'create' && <span className="text-[11px] text-slate-400 font-normal">{translateText("(Mặc định 0%)")}</span>}
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      name="refuseRatePercent"
                      min="0"
                      max="100"
                      step="0.1"
                      readOnly={isReadOnly}
                      value={formData.refuseRatePercent}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 rounded-xl border text-sm font-bold outline-none select-none ${
                        mode !== 'view'
                          ? 'bg-white border-slate-200 focus:ring-2 focus:ring-emerald-500 text-slate-800'
                          : 'bg-slate-100 border-slate-200 text-slate-800 cursor-default'
                      }`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium pointer-events-none">
                      %
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-800 text-sm">
                    {translateText(mode === 'create'
                      ? `Thành phần dinh dưỡng ghi trên bao bì (theo ${servingWeight}${formData.defaultUnit === 'ml' || formData.defaultUnit === 'l' ? 'ml' : 'g'})`
                      : 'Thành phần dinh dưỡng chính (trên 100g ăn được)')}
                  </h3>
                  {mode === 'create' ? (
                    <span className="text-[11px] text-rose-600 font-bold bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">{translateText("* Bắt buộc 4 chỉ số chính")}</span>
                  ) : mode === 'edit' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                      {translateText("Nguyên liệu tự thêm")}</span>
                  ) : null}
                </div>

                {mode !== 'create' && (
                  /* Thanh thông tin quy chuẩn sơ chế FCT */
                  <div className="mb-4 p-2.5 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      <span className="text-xs text-slate-600 font-medium">{translateText("Tỉ lệ sơ chế:")}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-slate-600">{translateText("Tỉ lệ thải bỏ: ")}<strong className="text-amber-800 font-black">{formData.refuseRatePercent}%</strong>
                      </span>
                      <span className="text-slate-300">|</span>
                      <span className="text-slate-600">{translateText("Tỉ lệ phần ăn được: ")}<strong className="text-emerald-700 font-black">{Math.max(0, 100 - formData.refuseRatePercent)}%</strong>
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">{translateText("Năng lượng (kcal) ")}{mode === 'create' && <span className="text-rose-500 font-bold">*</span>}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      required={mode === 'create'}
                      name="energyKcal"
                      readOnly={isNutritionReadOnly}
                      value={formData.energyKcal}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 rounded-lg border text-sm ${
                        isNutritionReadOnly
                          ? 'bg-slate-100 border-slate-200 text-slate-700 font-bold cursor-default'
                          : 'border-slate-200 focus:ring-2 focus:ring-emerald-500 bg-white font-bold'
                      } outline-none`}
                      placeholder={translateText(mode === 'create' ? 'VD: 126' : '')}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">{translateText("Đạm (g) ")}{mode === 'create' && <span className="text-rose-500 font-bold">*</span>}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      required={mode === 'create'}
                      name="proteinG"
                      readOnly={isNutritionReadOnly}
                      value={formData.proteinG}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 rounded-lg border text-sm ${
                        isNutritionReadOnly
                          ? 'bg-slate-100 border-slate-200 text-slate-700 font-bold cursor-default'
                          : 'border-slate-200 focus:ring-2 focus:ring-emerald-500 bg-white font-bold'
                      } outline-none`}
                      placeholder={translateText(mode === 'create' ? 'VD: 5.4' : '')}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">{translateText("Béo (g) ")}{mode === 'create' && <span className="text-rose-500 font-bold">*</span>}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      required={mode === 'create'}
                      name="fatG"
                      readOnly={isNutritionReadOnly}
                      value={formData.fatG}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 rounded-lg border text-sm ${
                        isNutritionReadOnly
                          ? 'bg-slate-100 border-slate-200 text-slate-700 font-bold cursor-default'
                          : 'border-slate-200 focus:ring-2 focus:ring-emerald-500 bg-white font-bold'
                      } outline-none`}
                      placeholder={translateText(mode === 'create' ? 'VD: 6.0' : '')}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">{translateText("Carb (g) ")}{mode === 'create' && <span className="text-rose-500 font-bold">*</span>}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      required={mode === 'create'}
                      name="carbG"
                      readOnly={isNutritionReadOnly}
                      value={formData.carbG}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 rounded-lg border text-sm ${
                        isNutritionReadOnly
                          ? 'bg-slate-100 border-slate-200 text-slate-700 font-bold cursor-default'
                          : 'border-slate-200 focus:ring-2 focus:ring-emerald-500 bg-white font-bold'
                      } outline-none`}
                      placeholder={translateText(mode === 'create' ? 'VD: 12.6' : '')}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between mb-3 mt-2">
                  <h3 className="font-bold text-slate-800 text-sm">{translateText("Vi chất khoáng bổ trợ ")}{mode === 'create' && <span className="text-xs text-slate-400 font-normal">{translateText("(Không bắt buộc)")}</span>}
                  </h3>
                  {mode === 'edit' && (
                    <span className="text-[10px] text-slate-400 italic">{translateText("Chỉnh sửa nguyên liệu của bạn")}</span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{translateText("Canxi (mg)")}</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      name="calciumMg"
                      readOnly={isNutritionReadOnly}
                      value={formData.calciumMg}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 rounded-lg border text-sm ${
                        isNutritionReadOnly
                          ? 'bg-slate-100 border-slate-200 text-slate-700 font-bold cursor-default'
                          : 'border-slate-200 focus:ring-2 focus:ring-emerald-500 bg-white'
                      } outline-none`}
                      placeholder={translateText("VD: 180")}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{translateText("Sắt (mg)")}</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      name="ironMg"
                      readOnly={isNutritionReadOnly}
                      value={formData.ironMg}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 rounded-lg border text-sm ${
                        isNutritionReadOnly
                          ? 'bg-slate-100 border-slate-200 text-slate-700 font-bold cursor-default'
                          : 'border-slate-200 focus:ring-2 focus:ring-emerald-500 bg-white'
                      } outline-none`}
                      placeholder={translateText("VD: 0.5")}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{translateText("Kẽm (mg)")}</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      name="zincMg"
                      readOnly={isNutritionReadOnly}
                      value={formData.zincMg}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 rounded-lg border text-sm ${
                        isNutritionReadOnly
                          ? 'bg-slate-100 border-slate-200 text-slate-700 font-bold cursor-default'
                          : 'border-slate-200 focus:ring-2 focus:ring-emerald-500 bg-white'
                      } outline-none`}
                      placeholder={translateText("VD: 0.8")}
                    />
                  </div>
                </div>

                {/* Bảng so sánh quy đổi chuẩn 100g khi tạo mới */}
                {mode === 'create' && Number(servingWeight) !== 100 && Number(servingWeight) > 0 && (
                  <div className="mt-4 p-3.5 bg-white rounded-xl border border-emerald-200 shadow-2xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />{translateText("Bảng so sánh quy đổi chuẩn 100g ăn được")}</span>
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 font-bold px-2 py-0.5 rounded border border-emerald-200">{translateText("Chuẩn FCT 100g")}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <div className="text-[10px] text-slate-400">{translateText("Năng lượng")}</div>
                        <div className="text-slate-500 text-[11px] line-through">{rawEnergy}{translateText(" kcal")}</div>
                        <div className="font-black text-emerald-800 text-sm">
                          {normEnergy} <span className="text-[10px] font-normal">{translateText("kcal")}</span>
                        </div>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <div className="text-[10px] text-slate-400">{translateText("Đạm (P)")}</div>
                        <div className="text-slate-500 text-[11px] line-through">{rawProtein}{translateText("g")}</div>
                        <div className="font-black text-emerald-800 text-sm">{normProtein}{translateText("g")}</div>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <div className="text-[10px] text-slate-400">{translateText("Béo (L)")}</div>
                        <div className="text-slate-500 text-[11px] line-through">{rawFat}{translateText("g")}</div>
                        <div className="font-black text-emerald-800 text-sm">{normFat}{translateText("g")}</div>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <div className="text-[10px] text-slate-400">{translateText("Carb (G)")}</div>
                        <div className="text-slate-500 text-[11px] line-through">{rawCarb}{translateText("g")}</div>
                        <div className="font-black text-emerald-800 text-sm">{normCarb}{translateText("g")}</div>
                      </div>
                    </div>
                    {(rawCalcium > 0 || rawIron > 0 || rawZinc > 0) && (
                      <div className="grid grid-cols-3 gap-2 text-center text-xs mt-2.5 pt-2 border-t border-slate-100">
                        {rawCalcium > 0 && (
                          <div className="text-[11px] text-slate-600">{translateText("Canxi: ")}<span className="line-through text-slate-400">{rawCalcium}{translateText("mg")}</span> ➔{' '}
                            <strong className="text-emerald-700">{normCalcium}{translateText("mg")}</strong>
                          </div>
                        )}
                        {rawIron > 0 && (
                          <div className="text-[11px] text-slate-600">{translateText("Sắt: ")}<span className="line-through text-slate-400">{rawIron}{translateText("mg")}</span> ➔{' '}
                            <strong className="text-emerald-700">{normIron}{translateText("mg")}</strong>
                          </div>
                        )}
                        {rawZinc > 0 && (
                          <div className="text-[11px] text-slate-600">{translateText("Kẽm: ")}<span className="line-through text-slate-400">{rawZinc}{translateText("mg")}</span> ➔{' '}
                            <strong className="text-emerald-700">{normZinc}{translateText("mg")}</strong>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1">
                  <AlertTriangle className="w-4 h-4 text-red-500" />{translateText("Cảnh báo dị ứng (Phân cách bằng dấu phẩy)")}</label>
                <input
                  type="text"
                  readOnly={isReadOnly}
                  value={allergenInput}
                  onChange={(e) => setAllergenInput(e.target.value)}
                  className={`w-full px-4 py-2 rounded-xl border ${isReadOnly ? 'bg-slate-100 border-transparent text-slate-600' : 'border-slate-200 focus:ring-2 focus:ring-red-500'} outline-none`}
                  placeholder={translateText("VD: Sữa bò, Đậu phộng...")}
                />
              </div>



              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{translateText("Mô tả quy cách / Yêu cầu thêm")}</label>
                <textarea
                  name="description"
                  readOnly={isReadOnly}
                  value={formData.description}
                  onChange={(e) => handleInputChange(e as unknown as React.ChangeEvent<HTMLInputElement>)}
                  rows={3}
                  className={`w-full px-4 py-2 rounded-xl border ${isReadOnly ? 'bg-slate-100 border-transparent text-slate-600' : 'border-slate-200 focus:ring-2 focus:ring-emerald-500'} outline-none resize-none`}
                  placeholder={translateText("VD: Thịt phải cắt miếng vừa ăn cho trẻ...")}
                />
              </div>

            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition"
          >{translateText("Đóng")}</button>
          {!isReadOnly && (
            <button
              type="submit"
              form="food-form"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {translateText(mode === 'create' ? 'Tạo mới' : 'Lưu thay đổi')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
