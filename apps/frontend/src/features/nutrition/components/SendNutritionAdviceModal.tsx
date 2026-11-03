import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  Sparkles,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  Utensils,
  Pill,
  CheckCircle2,
} from 'lucide-react';
import { PickyEatingChildItem, nutritionAdviceApi } from '../api/nutritionAdviceApi';

interface SendNutritionAdviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  child: PickyEatingChildItem | null;
  onSuccess: () => void;
}

export const SendNutritionAdviceModal: React.FC<SendNutritionAdviceModalProps> = ({
  isOpen,
  onClose,
  child,
  onSuccess,
}) => {
  const [adviceTitle, setAdviceTitle] = useState('');
  const [homeAdvice, setHomeAdvice] = useState('');
  const [selectedDishes, setSelectedDishes] = useState<string[]>([]);
  const [selectedNutrients, setSelectedNutrients] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (child) {
      const initialTitle =
        child.latestAdvice?.adviceTitle ||
        child.suggestedAdviceTitle ||
        `Phác đồ tư vấn bổ sung vi chất tại nhà cho bé ${child.fullName}`;
      const initialHomeAdvice =
        child.latestAdvice?.homeSupplementAdvice ||
        child.suggestedHomeAdvice ||
        '';
      setAdviceTitle(initialTitle);
      setHomeAdvice(initialHomeAdvice);
      setSelectedDishes(child.recommendedDishes || []);
      setSelectedNutrients(child.micronutrientsFocus || []);
      setError(null);
    }
  }, [child]);

  if (!isOpen || !child) return null;

  const handleResetToSuggestion = () => {
    if (!child) return;
    if (child.suggestedAdviceTitle) setAdviceTitle(child.suggestedAdviceTitle);
    if (child.suggestedHomeAdvice) setHomeAdvice(child.suggestedHomeAdvice);
    if (child.recommendedDishes) setSelectedDishes([...child.recommendedDishes]);
    if (child.micronutrientsFocus) setSelectedNutrients([...child.micronutrientsFocus]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!homeAdvice.trim()) {
      setError('Vui lòng nhập nội dung phác đồ tư vấn bổ sung dinh dưỡng tại nhà.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await nutritionAdviceApi.sendAdvice({
        studentId: child.studentId,
        severityLevel: child.severityLevel,
        adviceTitle: adviceTitle.trim() || `Tư vấn dinh dưỡng cho bé ${child.fullName}`,
        pickySymptoms: child.pickySymptoms,
        homeSupplementAdvice: homeAdvice.trim(),
        recommendedDishes: selectedDishes,
        micronutrientsFocus: selectedNutrients,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Lỗi khi gửi tư vấn');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSevere = child.severityLevel === 'SEVERE';
  const hasAllergy = child.allergies && child.allergies.length > 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-800 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/15 rounded-xl">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base font-black">Soạn Tư Vấn Bổ Sung Dinh Dưỡng Tại Nhà</h2>
              <p className="text-xs text-emerald-200">
                Phân tích cá nhân hóa cho bé <strong className="text-white">{child.fullName}</strong> ({child.className} • {child.ageLabel})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-bold">
              {error}
            </div>
          )}

          {/* Dấu hiệu kén ăn & Tình trạng thực tế của bé từ Database */}
          <div className={`p-4 rounded-2xl border ${isSevere ? 'bg-rose-50/60 border-rose-200' : 'bg-amber-50/70 border-amber-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-black text-xs text-slate-800">
                <AlertTriangle className={`w-4 h-4 ${isSevere ? 'text-rose-600' : 'text-amber-600'}`} />
                <span>Hồ sơ ăn uống thực tế tại lớp:</span>
              </div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${isSevere ? 'bg-rose-200 text-rose-900' : 'bg-amber-200 text-amber-900'}`}>
                Sức ăn TB: {child.averageConsumptionRate}% khẩu phần
              </span>
            </div>

            <ul className="text-xs text-slate-700 space-y-1 font-medium">
              {child.pickySymptoms.map((s, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-amber-500 font-bold">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>

            {hasAllergy && (
              <div className="mt-2.5 pt-2 border-t border-rose-200/80 flex items-center gap-2 text-rose-700 font-bold text-xs">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
                <span>CẢNH BÁO DỊ ỨNG: Bé dị ứng {child.allergies.join(', ')} (Đã tự động loại trừ khỏi món ăn gợi ý).</span>
              </div>
            )}
          </div>

          {/* Tiêu đề tư vấn */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Tiêu đề thông báo gửi phụ huynh
            </label>
            <input
              type="text"
              value={adviceTitle}
              onChange={(e) => setAdviceTitle(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-none font-semibold text-slate-800"
              required
            />
          </div>

          {/* Phác đồ tư vấn tại nhà */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">
                Nội dung phác đồ tư vấn &amp; dặn dò phụ huynh tại nhà
              </label>
              <button
                type="button"
                onClick={handleResetToSuggestion}
                className="text-[11px] text-teal-700 hover:text-teal-900 font-bold flex items-center gap-1 transition cursor-pointer"
                title="Tự động điền lại phác đồ phân tích riêng theo tình trạng của bé"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Tải lại gợi ý của bé</span>
              </button>
            </div>
            <textarea
              rows={7}
              value={homeAdvice}
              onChange={(e) => setHomeAdvice(e.target.value)}
              className="w-full text-xs p-3.5 rounded-xl border border-slate-200 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-none leading-relaxed text-slate-800 font-mono"
              placeholder="Nhập phác đồ dinh dưỡng, cách chế biến món ăn và lời dặn dò cho gia đình..."
              required
            />
          </div>

          {/* Vi chất tập trung bổ sung */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Pill className="w-3.5 h-3.5 text-indigo-600" />
              <span>Vi chất dinh dưỡng trọng tâm cần bổ sung (Kích thích vị giác &amp; Bù đắp vi lượng):</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {selectedNutrients.map((nutr, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-bold rounded-xl flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{nutr}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Món ăn gợi ý tại nhà */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Utensils className="w-3.5 h-3.5 text-emerald-600" />
              <span>Gợi ý món ăn tối &amp; bổ sung tại nhà (An toàn, loại trừ dị ứng):</span>
            </label>
            <div className="space-y-1.5">
              {selectedDishes.map((dish, idx) => (
                <div
                  key={idx}
                  className="px-3.5 py-2 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs text-slate-800 font-semibold flex items-center gap-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>{dish}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <span className="text-[11px] text-slate-500">
              Phác đồ sẽ gửi trực tiếp đến ứng dụng của phụ huynh {child.parentName} ({child.parentRelationship}).
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white text-xs font-bold rounded-xl transition shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Đang gửi...' : 'Gửi tư vấn về Phụ huynh'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
