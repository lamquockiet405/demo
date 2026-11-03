import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, ShieldCheck, AlertTriangle, Plus, Trash2, RefreshCw, Search, ChevronDown } from 'lucide-react';
import { apiClient } from '@/core/api/axios';

interface SearchableFoodSelectProps {
  value: string;
  foods: any[];
  onChange: (foodId: string) => void;
  disabled?: boolean;
}

const removeVietnameseTones = (str: string): string => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
};

const SearchableFoodSelect: React.FC<SearchableFoodSelectProps> = ({
  value,
  foods,
  onChange,
  disabled,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedFood = useMemo(() => {
    return foods.find((f) => String(f.id) === String(value));
  }, [foods, value]);

  useEffect(() => {
    if (!isOpen) {
      setQuery(selectedFood?.name || '');
    }
  }, [isOpen, selectedFood]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const filteredFoods = useMemo(() => {
    if (!query || (selectedFood && query === selectedFood.name)) {
      return foods;
    }
    const qRaw = query.toLowerCase().trim();
    const qNoTone = removeVietnameseTones(query.trim());
    return foods.filter((f) => {
      const name = (f.name || '').toLowerCase();
      const nameNoTone = removeVietnameseTones(f.name || '');
      return name.includes(qRaw) || nameNoTone.includes(qNoTone);
    });
  }, [foods, query, selectedFood]);

  if (disabled) {
    return <span className="font-bold text-slate-700">{selectedFood?.name || 'Nguyên liệu'}</span>;
  }

  return (
    <div className="relative w-full min-w-[220px]" ref={wrapperRef}>
      <div className="relative flex items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Nhập chữ tìm hoặc kéo chọn..."
          className="w-full bg-slate-50 border border-slate-200 focus:bg-white rounded-lg pl-2.5 pr-14 py-1.5 text-xs font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
        />
        <div className="absolute right-1.5 flex items-center gap-0.5 text-slate-400">
          {query && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setQuery('');
                onChange('');
                setIsOpen(true);
              }}
              className="hover:text-slate-600 p-0.5"
              title="Xóa lựa chọn"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="hover:text-slate-600 p-0.5"
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180 text-emerald-600' : ''}`}
            />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
          <div className="p-1.5 text-[10px] font-bold text-slate-400 bg-slate-50 uppercase tracking-wider flex justify-between sticky top-0 z-10 border-b border-slate-100">
            <span>Danh sách nguyên liệu ({filteredFoods.length})</span>
            <span className="text-emerald-600 font-normal">Kéo cuộn để xem thêm ↓</span>
          </div>
          {filteredFoods.length === 0 ? (
            <div className="p-3 text-center text-xs text-slate-400 italic">
              Không tìm thấy nguyên liệu nào khớp với "{query}"
            </div>
          ) : (
            filteredFoods.map((f) => {
              const isSelected = String(f.id) === String(value);
              const kcal = Number(f.energyKcal100g || f.energyKcal || 0);
              return (
                <div
                  key={f.id}
                  onClick={() => {
                    onChange(String(f.id));
                    setQuery(f.name);
                    setIsOpen(false);
                  }}
                  className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between hover:bg-emerald-50 transition ${
                    isSelected ? 'bg-emerald-50 font-bold text-emerald-800' : 'text-slate-700'
                  }`}
                >
                  <div className="flex flex-col text-left">
                    <span className="font-semibold text-slate-800">{f.name}</span>
                    <span className="text-[10px] text-slate-400">
                      {kcal > 0 ? `${kcal} Kcal/100g` : ''} {f.unit ? `• Đơn vị: ${f.unit}` : ''}
                    </span>
                  </div>
                  {f.allergens && (Array.isArray(f.allergens) ? f.allergens.length > 0 : Boolean(f.allergens)) && (
                    <span className="text-[9px] bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded font-bold border border-rose-100 whitespace-nowrap ml-2">
                      Dị ứng
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

interface DishModalProps {
  isOpen: boolean;
  mode: 'create' | 'view' | 'edit';
  dishId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const DishModal: React.FC<DishModalProps> = ({ isOpen, mode, dishId, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [foods, setFoods] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [recipeStatus, setRecipeStatus] = useState('MISSING');
  const [foodSearches, setFoodSearches] = useState<Record<number, string>>({}); // search text per row

  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
    dishType: 'MAIN',
    targetAgeGroup: 'KINDERGARTEN_3_5Y',
    photoUrl: '',
    cookingInstructions: '',
    presentationNotes: '',
    isActive: true,
    recipeItems: [] as any[],
  });

  const formatExact = (val: any): string => {
    if (val === null || val === undefined || val === '') return '0';
    const n = Number(val);
    if (isNaN(n)) return '0';
    return String(Math.round(n * 100) / 100);
  };

  const nutrientValue = (food: any, key: string): number => {
    const value = key === 'energyKcal100g' ? food?.energyKcal100g ?? food?.energyKcal : food?.[key];
    return Number(value ?? food?.referenceValues?.[key] ?? 0);
  };

  const [nutritionTotals, setNutritionTotals] = useState({
    totalCalories: 0,
    totalProteinG: 0,
    totalFatG: 0,
    totalCarbG: 0,
    totalFiberG: 0,
    totalCalciumMg: 0,
    totalIronMg: 0,
    totalZincMg: 0,
  });

  const calculateDynamicNutrition = (items: any[]) => {
    let calories = 0;
    let protein = 0;
    let fat = 0;
    let carb = 0;
    let fiber = 0;
    let calcium = 0;
    let iron = 0;
    let zinc = 0;

    items.forEach(item => {
      const food = item.food || foods.find(f => String(f.id) === String(item.foodId));
      if (food) {
        const ratio = (Number(item.netWeightPerPortionG) || 0) / 100;
        calories += nutrientValue(food, 'energyKcal100g') * ratio;
        protein += nutrientValue(food, 'proteinG') * ratio;
        fat += nutrientValue(food, 'fatG') * ratio;
        carb += nutrientValue(food, 'carbG') * ratio;
        fiber += nutrientValue(food, 'fiberG') * ratio;
        calcium += nutrientValue(food, 'calciumMg') * ratio;
        iron += nutrientValue(food, 'ironMg') * ratio;
        zinc += nutrientValue(food, 'zincMg') * ratio;
      }
    });

    setNutritionTotals({
      totalCalories: calories,
      totalProteinG: protein,
      totalFatG: fat,
      totalCarbG: carb,
      totalFiberG: fiber,
      totalCalciumMg: calcium,
      totalIronMg: iron,
      totalZincMg: zinc,
    });
  };

  const fetchCategories = async () => {
    try {
      const res = await apiClient.get('/dishes/categories');
      setCategories(res.data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      fetchFoods();
      if (mode === 'create') {
        setRecipeStatus('MISSING');
        setFormData({
          name: '',
          categoryId: '',
          dishType: 'MAIN',
          targetAgeGroup: 'KINDERGARTEN_3_5Y',
          photoUrl: '',
          cookingInstructions: '',
          presentationNotes: '',
          isActive: true,
          recipeItems: [],
        });
        setNutritionTotals({
          totalCalories: 0,
          totalProteinG: 0,
          totalFatG: 0,
          totalCarbG: 0,
          totalFiberG: 0,
          totalCalciumMg: 0,
          totalIronMg: 0,
          totalZincMg: 0,
        });
      } else if (dishId) {
        fetchDish();
      }
    }
  }, [isOpen, mode, dishId]);

  // Tự động tính lại dinh dưỡng khi recipeItems hoặc foods thay đổi
  useEffect(() => {
    if (formData.recipeItems.length > 0 && foods.length > 0) {
      calculateDynamicNutrition(formData.recipeItems);
    }
  }, [formData.recipeItems, foods]);

  const fetchDish = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/dishes/${dishId}`);
      const data = res.data;
      setRecipeStatus(data.nutritionStatus || 'MISSING');

      const items =
        data.recipeItems && data.recipeItems.length > 0
          ? data.recipeItems
          : (data.recipes || []).map((r: any) => ({
              id: r.id,
              foodId: String(r.ingredientId || r.foodId),
              netWeightPerPortionG: Number(r.netWeightG || r.netWeightPerPortionG || 0),
              grossWeightPerPortionG: Number(r.grossWeightG || r.grossWeightPerPortionG || 0),
              note: r.note,
              food: r.food,
            }));

      setFormData({
        name: data.name,
        categoryId: data.categoryId ? String(data.categoryId) : (data.category?.id ? String(data.category.id) : ''),
        dishType: data.dishType || data.categoryCode || data.category?.code || 'MAIN',
        targetAgeGroup: data.targetAgeGroup || 'KINDERGARTEN_3_5Y',
        photoUrl: data.photoUrl || '',
        cookingInstructions: data.cookingInstructions || '',
        presentationNotes: data.description || data.presentationNotes || '',
        isActive: data.isActive !== false && data.status !== 'INACTIVE',
        recipeItems: items,
      });
      // nutrition sẽ được tự tính lại qua useEffect khi foods load xong
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFoods = async () => {
    try {
      // Fetch all foods for the recipe dropdown
      const res = await apiClient.get('/foods', { params: { limit: 500 } });
      const items = Array.isArray(res.data) ? res.data : (res.data?.items || res.data?.data || []);
      setFoods(items);
    } catch (error) {
      console.error(error);
    }
  };

  const handleRecipeItemChange = (index: number, field: string, value: any) => {
    const updatedItems = [...formData.recipeItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    // If food changes, attach food object for calculation
    if (field === 'foodId') {
      updatedItems[index].food = foods.find(f => String(f.id) === String(value));
    }

    setFormData(prev => ({ ...prev, recipeItems: updatedItems }));
    calculateDynamicNutrition(updatedItems);
  };

  const addRecipeItem = () => {
    setFormData(prev => ({
      ...prev,
      recipeItems: [...prev.recipeItems, { foodId: '', netWeightPerPortionG: 0, shrinkageRatio: 0 }]
    }));
  };

  const removeRecipeItem = (index: number) => {
    const updatedItems = formData.recipeItems.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, recipeItems: updatedItems }));
    calculateDynamicNutrition(updatedItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const validItems = formData.recipeItems.filter(ri => ri.foodId && Number(ri.netWeightPerPortionG) > 0);
      const payload = {
        name: formData.name,
        categoryId: formData.categoryId ? Number(formData.categoryId) : undefined,
        dishType: formData.dishType,
        targetAgeGroup: formData.targetAgeGroup,
        photoUrl: formData.photoUrl,
        cookingInstructions: formData.cookingInstructions,
        description: formData.presentationNotes,
        presentationNotes: formData.presentationNotes,
        isActive: formData.isActive,
        status: formData.isActive ? 'ACTIVE' : 'INACTIVE',
        recipes: validItems.map(ri => ({
          ingredientId: Number(ri.foodId),
          netWeightG: Number(ri.netWeightPerPortionG),
          grossWeightG: Number(ri.grossWeightPerPortionG || ri.netWeightPerPortionG),
          note: ri.prepNotes || ri.note || null,
        })),
        recipeItems: validItems.map(ri => ({
          foodId: String(ri.foodId),
          ingredientId: Number(ri.foodId),
          netWeightPerPortionG: Number(ri.netWeightPerPortionG),
          grossWeightPerPortionG: Number(ri.grossWeightPerPortionG || ri.netWeightPerPortionG),
          shrinkageRatio: Number(ri.shrinkageRatio || 0),
        })),
      };

      if (mode === 'edit' && dishId) {
        await apiClient.put(`/dishes/${dishId}`, payload);
      } else {
        await apiClient.post('/dishes', payload);
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      alert('Có lỗi xảy ra!');
    } finally {
      setSaving(false);
    }
  };

  const [uploadingImage, setUploadingImage] = useState(false);
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    const formDataObj = new FormData();
    formDataObj.append('file', file);
    
    try {
      setUploadingImage(true);
      const res = await apiClient.post('/dishes/upload', formDataObj, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFormData(prev => ({ ...prev, photoUrl: res.data.imageUrl }));
    } catch (error) {
      console.error(error);
      alert('Tải ảnh lên thất bại!');
    } finally {
      setUploadingImage(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm">
      <div className="w-[800px] bg-white h-full shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {mode === 'view' ? 'Chi tiết món ăn' : mode === 'edit' ? 'Chỉnh sửa món ăn & Công thức' : 'Thêm mới món ăn'}
            </h2>
            {recipeStatus === 'REFERENCE' && (
              <p className="mt-1 text-xs text-amber-700">Định lượng và dinh dưỡng tham khảo từ công thức cũ; chưa xác minh thực tế.</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50/50">
          {loading ? (
            <div className="text-center py-10">Đang tải...</div>
          ) : (
            <form id="dish-form" onSubmit={handleSubmit} className="space-y-8">
              
              {/* Thông tin cơ bản */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center text-xs">01</div>
                  <h3 className="font-bold text-slate-800">Thông tin món ăn</h3>
                </div>
                
                <div className="grid grid-cols-1 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tên món ăn học đường *</label>
                    <input 
                      required disabled={mode === 'view'}
                      type="text" value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-emerald-500 outline-none text-sm font-medium"
                      placeholder="VD: Cháo thịt bò rau củ"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Loại bữa ăn (Danh mục chuẩn) *</label>
                      <select 
                        disabled={mode === 'view'} 
                        value={formData.categoryId || categories.find(c => c.code === formData.dishType)?.id || ''} 
                        onChange={e => {
                          const selectedId = e.target.value;
                          const cat = categories.find(c => String(c.id) === String(selectedId));
                          setFormData(prev => ({ 
                            ...prev, 
                            categoryId: selectedId, 
                            dishType: cat?.code || prev.dishType 
                          }));
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-emerald-500 outline-none text-sm font-semibold bg-white disabled:bg-slate-50 disabled:text-slate-700"
                      >
                        <option value="">-- Chọn loại bữa ăn --</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Trạng thái hoạt động *</label>
                      <select 
                        disabled={mode === 'view'} 
                        value={formData.isActive ? 'ACTIVE' : 'INACTIVE'} 
                        onChange={e => {
                          setFormData(prev => ({ 
                            ...prev, 
                            isActive: e.target.value === 'ACTIVE' 
                          }));
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-emerald-500 outline-none text-sm font-semibold bg-white disabled:bg-slate-50 disabled:text-slate-700"
                      >
                        <option value="ACTIVE">Đang phục vụ</option>
                        <option value="INACTIVE">Tạm ngưng</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Mô tả cảm quan & dinh dưỡng</label>
                    <textarea 
                      disabled={mode === 'view'} value={formData.presentationNotes} onChange={e => setFormData(prev => ({ ...prev, presentationNotes: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-emerald-500 outline-none text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Chỉ số dinh dưỡng (Preview) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-4 right-5 text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Tự động tính toán
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center text-xs">02</div>
                  <h3 className="font-bold text-slate-800">Tổng giá trị dinh dưỡng (1 suất ăn chuẩn)</h3>
                </div>
                
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-[#fff9ea] rounded-xl p-3 border border-[#fdebb4] text-center">
                    <div className="text-[10px] font-bold text-[#b58013] mb-1">NĂNG LƯỢNG</div>
                    <div className="text-xl font-black text-slate-800">{formatExact(nutritionTotals.totalCalories)}</div>
                    <div className="text-[10px] text-[#b58013]">kcal / suất</div>
                  </div>
                  <div className="bg-[#f0f7ff] rounded-xl p-3 border border-[#cbe1ff] text-center">
                    <div className="text-[10px] font-bold text-[#2a68c0] mb-1">ĐẠM / PROTEIN</div>
                    <div className="text-xl font-black text-slate-800">{formatExact(nutritionTotals.totalProteinG)}</div>
                    <div className="text-[10px] text-[#2a68c0]">gam ({nutritionTotals.totalCalories ? Math.round((Number(nutritionTotals.totalProteinG) * 4 / Number(nutritionTotals.totalCalories)) * 100) : 0}%)</div>
                  </div>
                  <div className="bg-[#fff0f3] rounded-xl p-3 border border-[#ffcfd8] text-center">
                    <div className="text-[10px] font-bold text-[#c93051] mb-1">BÉO / LIPID</div>
                    <div className="text-xl font-black text-slate-800">{formatExact(nutritionTotals.totalFatG)}</div>
                    <div className="text-[10px] text-[#c93051]">gam ({nutritionTotals.totalCalories ? Math.round((Number(nutritionTotals.totalFatG) * 9 / Number(nutritionTotals.totalCalories)) * 100) : 0}%)</div>
                  </div>
                  <div className="bg-[#f2fcf7] rounded-xl p-3 border border-[#c4ebd6] text-center">
                    <div className="text-[10px] font-bold text-[#1e814a] mb-1">BỘT / CARB</div>
                    <div className="text-xl font-black text-slate-800">{formatExact(nutritionTotals.totalCarbG)}</div>
                    <div className="text-[10px] text-[#1e814a]">gam ({nutritionTotals.totalCalories ? Math.round((Number(nutritionTotals.totalCarbG) * 4 / Number(nutritionTotals.totalCalories)) * 100) : 0}%)</div>
                  </div>
                </div>

                {/* Vi chất dinh dưỡng từ Database */}
                <div className="grid grid-cols-4 gap-3 mt-3">
                  <div className="bg-emerald-50/70 rounded-xl p-2.5 border border-emerald-100 text-center">
                    <div className="text-[9.5px] font-bold text-emerald-800 mb-0.5">CHẤT XƠ (Fiber)</div>
                    <div className="text-base font-black text-slate-800">{formatExact(nutritionTotals.totalFiberG)}</div>
                    <div className="text-[9.5px] text-emerald-600">gam / suất</div>
                  </div>
                  <div className="bg-sky-50/70 rounded-xl p-2.5 border border-sky-100 text-center">
                    <div className="text-[9.5px] font-bold text-sky-800 mb-0.5">CANXI (Calcium)</div>
                    <div className="text-base font-black text-slate-800">{formatExact(nutritionTotals.totalCalciumMg)}</div>
                    <div className="text-[9.5px] text-sky-600">mg / suất</div>
                  </div>
                  <div className="bg-amber-50/70 rounded-xl p-2.5 border border-amber-100 text-center">
                    <div className="text-[9.5px] font-bold text-amber-800 mb-0.5">SẮT (Iron)</div>
                    <div className="text-base font-black text-slate-800">{formatExact(nutritionTotals.totalIronMg)}</div>
                    <div className="text-[9.5px] text-amber-600">mg / suất</div>
                  </div>
                  <div className="bg-purple-50/70 rounded-xl p-2.5 border border-purple-100 text-center">
                    <div className="text-[9.5px] font-bold text-purple-800 mb-0.5">KẼM (Zinc)</div>
                    <div className="text-base font-black text-slate-800">{formatExact(nutritionTotals.totalZincMg)}</div>
                    <div className="text-[9.5px] text-purple-600">mg / suất</div>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-3 italic text-center">
                  * Định lượng tính trên 1 suất ăn chuẩn trẻ mẫu giáo theo tiêu chuẩn Viện Dinh Dưỡng Quốc Gia (Tỷ lệ P:L:C cân đối: 15-20% : 25-30% : 50-60%)
                </p>
              </div>

              {/* Công thức & Nguyên liệu */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center text-xs">03</div>
                    <h3 className="font-bold text-slate-800">Công thức & Định lượng nguyên liệu</h3>
                  </div>
                  <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded">{formData.recipeItems.length} nguyên liệu</span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-visible">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase">
                      <tr>
                        <th className="px-3 py-2 w-72">Nguyên liệu</th>
                        <th className="px-3 py-2 text-center w-28">Định lượng (g)</th>
                        <th className="px-2 py-2 text-center">Kcal</th>
                        <th className="px-2 py-2 text-center">Protein</th>
                        <th className="px-2 py-2 text-center">Lipid</th>
                        <th className="px-2 py-2 text-center">Carb</th>
                        <th className="px-2 py-2 text-center">Dị ứng</th>
                        {mode !== 'view' && <th className="px-2 py-2 text-center w-10"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {formData.recipeItems.map((item, idx) => {
                        const food = item.food || foods.find(f => f.id === item.foodId);
                        const ratio = (item.netWeightPerPortionG || 0) / 100;
                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-3 py-2">
                              <SearchableFoodSelect
                                value={item.foodId}
                                foods={foods}
                                onChange={(foodId) => handleRecipeItemChange(idx, 'foodId', foodId)}
                                disabled={mode === 'view'}
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              {mode === 'view' ? (
                                <span className="font-bold">{item.netWeightPerPortionG} g</span>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <input 
                                    type="number" step="0.1" value={item.netWeightPerPortionG || ''} 
                                    onChange={e => handleRecipeItemChange(idx, 'netWeightPerPortionG', Number(e.target.value))}
                                    className="w-16 bg-slate-100 border border-slate-200 rounded px-1 py-1 text-center font-bold outline-none focus:ring-1 focus:ring-emerald-500"
                                  />
                                  <span className="text-slate-400">g</span>
                                </div>
                              )}
                            </td>
                            <td className="px-2 py-2 text-center text-slate-500 font-semibold">{food ? formatExact(nutrientValue(food, 'energyKcal100g') * ratio) : '-'}</td>
                            <td className="px-2 py-2 text-center text-slate-500">{food ? formatExact(nutrientValue(food, 'proteinG') * ratio) : '-'}</td>
                            <td className="px-2 py-2 text-center text-slate-500">{food ? formatExact(nutrientValue(food, 'fatG') * ratio) : '-'}</td>
                            <td className="px-2 py-2 text-center text-slate-500">{food ? formatExact(nutrientValue(food, 'carbG') * ratio) : '-'}</td>
                            <td className="px-2 py-2 text-center">
                               {food?.allergens?.length > 0 ? (
                                 <span className="text-[9px] bg-red-50 text-red-600 border border-red-100 px-1 py-0.5 rounded">Có</span>
                               ) : (
                                 <span className="text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-1 py-0.5 rounded">An toàn</span>
                               )}
                            </td>
                            {mode !== 'view' && (
                              <td className="px-2 py-2 text-center">
                                <button type="button" onClick={() => removeRecipeItem(idx)} className="text-slate-400 hover:text-red-500">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                      {formData.recipeItems.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-3 py-6 text-center text-slate-400 italic">
                            Chưa có nguyên liệu nào.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  
                  {mode !== 'view' && (
                    <button 
                      type="button" 
                      onClick={addRecipeItem}
                      className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-emerald-600 flex items-center justify-center gap-1 transition"
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm nguyên liệu từ kho chuẩn
                    </button>
                  )}
                </div>
              </div>

            </form>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-200 px-6 py-4 bg-white flex justify-end gap-3">
          {mode === 'view' ? (
            <>
              <button onClick={onClose} className="px-6 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition">Đóng</button>
              {/* Note: User must change mode to 'edit' from the list, or we could add a button here */}
            </>
          ) : (
            <>
              <button type="button" onClick={onClose} className="px-6 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition">Hủy bỏ</button>
              <button 
                type="submit" form="dish-form" disabled={saving}
                className="px-8 py-2 rounded-xl text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 shadow-md transition disabled:opacity-50"
              >
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
