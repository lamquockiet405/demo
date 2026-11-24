import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, RefreshCw, Thermometer, Upload } from 'lucide-react';
import { apiClient } from '../../../core/api/axios';
import { useAuthStore } from '../../../core/stores/auth.store';
import { getInspectionMenuDishes } from '../api/kitchen.api';
import { inspectionDishNames } from '../utils/inspection-menu';
import { prepareProofImage } from '../utils/kitchen-operations';
import { errorText, Modal, Notice, useKitchenAction, useKitchenResource } from './KitchenUI';

const STEP_LABELS = ['Bước 1: Tiếp nhận', 'Bước 2: Chế biến', 'Bước 3: Lưu mẫu 24h'];
type DishChoice = { id: string; name: string; menus: string[]; sessionLabel?: string };

export function CreateKitchenInspectionModal({ initialDate, onClose, onCreated }: {
  initialDate: string;
  onClose: () => void;
  onCreated: (id: string | null) => Promise<void>;
}) {
  useLanguage();
  const { user } = useAuthStore();
  const action = useKitchenAction();
  const [step, setStep] = useState(1);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [form, setForm] = useState({ mealDate: initialDate, mealSession: 'LUNCH', step1Note: '', step2Note: '', step3Note: '', step2Temperature: '85', step3Temperature: '3.8' });
  const [selected, setSelected] = useState<string[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Record<number, string>>({});
  const [step2Checks, setStep2Checks] = useState({ hygiene: true, oneWay: true });
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState('');

  const menu = useKitchenResource(async () => ({ date: form.mealDate, mealSession: form.mealSession, dishes: await getInspectionMenuDishes(form.mealDate, form.mealSession) }), [form.mealDate, form.mealSession]);
  const ready = menu.data?.date === form.mealDate && menu.data?.mealSession === form.mealSession;
  const choices = (ready && !menu.error ? menu.data?.dishes : []) as DishChoice[];
  const selectedDishes = choices.filter((dish) => selected.includes(dish.id));
  const names = inspectionDishNames(selectedDishes, '');

  useEffect(() => {
    if (ready) {
      const ids = menu.data.dishes.map((dish: DishChoice) => dish.id);
      setSelected(ids);
      setQuantities(Object.fromEntries(ids.map((id: string) => [id, '150'])));
    }
  }, [menu.data, ready]);

  const updateServing = (change: Partial<typeof form>) => { setSelected([]); setQuantities({}); setForm((previous) => ({ ...previous, ...change })); };
  const uploadPhoto = async (targetStep: number, file?: File) => {
    if (!file) return;
    setImageBusy(true); setImageError('');
    try {
      const image = await prepareProofImage(file);
      setPhotos((previous) => ({ ...previous, [targetStep]: image }));
    }
    catch (error) { setImageError(errorText(error)); }
    finally { setImageBusy(false); }
  };
  const photoBox = (targetStep: number, label: string) => (
    <div>
      <label className="block mb-1 text-xs font-bold text-slate-700">{translateText(label)} <span className="text-rose-500">*</span></label>
      <label className="flex flex-col items-center justify-center h-24 gap-1 p-3 text-xs text-center border-2 border-dashed cursor-pointer rounded-xl border-slate-300 text-slate-500 hover:border-emerald-400">
        {photos[targetStep] ? <img src={photos[targetStep]} alt={translateText(label)} className="object-cover w-full h-full rounded-lg" /> : <><Upload className="w-5 h-5 text-emerald-600" /><span>{translateText('Tải ảnh minh chứng lên')}</span></>}
        <input type="file" hidden accept="image/jpeg,image/png,image/webp" disabled={imageBusy || action.busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void uploadPhoto(targetStep, file); }} />
      </label>
    </div>
  );

  const saveStep1 = async (event: React.FormEvent) => {
    event.preventDefault();
    await action.run(async () => {
      if (recordId) { setStep(2); return; }
      if (menu.loading) throw new Error('Đang tải thực đơn, vui lòng chờ một chút.');
      if (!names.length) throw new Error('Chọn ít nhất một món kiểm thực.');
      const response = (await apiClient.post('/inspections/create-session', { mealDate: form.mealDate, mealSession: form.mealSession, dishes: names, note: form.step1Note.trim(), nutritionistName: user?.fullName })).data;
      setRecordId(response.recordId ? String(response.recordId) : null); setStep(2);
    }, 'Đã lưu Bước 1. Tiếp tục kiểm tra trong khi chế biến.');
  };
  const nextStep2 = (event: React.FormEvent) => {
    event.preventDefault();
    if (!step2Checks.hygiene || !step2Checks.oneWay) { setImageError('Vui lòng xác nhận đủ điều kiện vệ sinh và quy trình bếp một chiều.'); return; }
    setImageError(''); setStep(3);
  };
  const finishStep3 = async (event: React.FormEvent) => {
    event.preventDefault();
    await action.run(async () => {
      if (!recordId) throw new Error('Chưa có mã biên bản từ Bước 1.');
      if (!photos[1] || !photos[2] || !photos[3]) throw new Error('Bổ sung ảnh minh chứng cho cả 3 bước.');
      try {
        await apiClient.post(`/inspections/${encodeURIComponent(recordId)}/kitchen-save`, {
          step1Photos: [photos[1]], step1Note: form.step1Note,
          step2Photos: [photos[2]], step2Temperature: Number(form.step2Temperature), step2Note: form.step2Note,
          step3Photos: [photos[3]], step3Temperature: Number(form.step3Temperature), step3Note: form.step3Note,
          dishes: selectedDishes.map((dish) => ({ dishName: dish.name, quantityGrams: Number(quantities[dish.id]) || 150 })),
        });
      } catch (err: any) {
        const msg = err.response?.data?.message || err.message;
        if (typeof msg === 'string' && (msg.includes('phê duyệt') || msg.includes('gửi duyệt'))) {
          throw new Error('Biên bản này đã được gửi duyệt hoặc đã được Ban Giám Hiệu phê duyệt.');
        }
        throw err;
      }
      await onCreated(recordId);
    }, 'Đã hoàn tất Bước 3 và tự động niêm phong mẫu lưu 24 giờ.');
  };

  return <Modal title={translateText("Kiểm thực ba bước điện tử")} busy={action.busy || imageBusy} onClose={onClose}>
    <div className="mb-5"><p className="mb-3 text-xs text-slate-500">{translateText("Quy trình kiểm tra 3 bước kèm chụp ảnh minh chứng từng bước")}</p><div className="grid grid-cols-3 gap-2">{STEP_LABELS.map((label, index) => <button key={label} type="button" disabled={index + 1 > step || action.busy} onClick={() => index + 1 <= step && setStep(index + 1)} className={`rounded-xl px-3 py-2 text-xs font-bold transition ${step === index + 1 ? 'bg-emerald-600 text-white' : index + 1 < step ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>{translateText(label)}</button>)}</div></div>
    <Notice error={action.error || imageError} message={action.message} />

    {step === 1 && <form onSubmit={saveStep1} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="kp-field">{translateText('Ngày kiểm thực')}<input className="kp-input" type="date" required value={form.mealDate} onChange={(event) => updateServing({ mealDate: event.target.value })} /></label><label className="kp-field">{translateText('Bữa ăn')}<select className="kp-input font-bold" value={form.mealSession} onChange={(event) => updateServing({ mealSession: event.target.value })}><option value="BREAKFAST">{translateText('Buổi sáng')}</option><option value="LUNCH">{translateText('Bữa trưa chính')}</option><option value="AFTERNOON_SNACK">{translateText('Buổi phụ')}</option><option value="LATE_SNACK">{translateText('Buổi xế chiều')}</option><option value="ALL_DAY">{translateText('Cả ngày')}</option></select></label></div>
      <fieldset className="kp-inspection-menu kp-field full"><legend className="flex items-center gap-1.5 font-bold"><CalendarDays className="w-4 h-4 text-teal-600" />{translateText('Các món kiểm thực theo thực đơn')}</legend><div className="flex items-center justify-between mb-2"><button type="button" className="kp-button" disabled={menu.loading || action.busy} onClick={() => void menu.reload()}><RefreshCw size={13} className={menu.loading ? 'animate-spin' : ''} />{translateText('Tải lại thực đơn')}</button><span className="text-xs font-semibold text-slate-600">{selectedDishes.length}/{choices.length} {translateText('món')}</span></div><div className="max-h-60 overflow-y-auto space-y-1.5">{choices.map((dish) => <label key={dish.id} className="flex items-start gap-2 p-2 cursor-pointer rounded-lg hover:bg-slate-50"><input type="checkbox" checked={selected.includes(dish.id)} onChange={(event) => setSelected((previous) => event.target.checked ? [...previous, dish.id] : previous.filter((id) => id !== dish.id))} /><span><strong className="block text-xs">{dish.name}</strong><small className="text-[11px] text-slate-500">{dish.sessionLabel} {dish.menus?.join(' · ')}</small></span></label>)}</div></fieldset>
      {photoBox(1, 'Ảnh nguyên liệu và hóa đơn giao nhận')}<label className="kp-field">{translateText('Ghi chú Bước 1')}<textarea className="kp-input" rows={2} value={form.step1Note} onChange={(event) => setForm({ ...form, step1Note: event.target.value })} placeholder={translateText("Nhận xét nguyên liệu tiếp nhận...")} /></label>
      <div className="flex justify-end pt-3 border-t border-slate-100"><button className="kp-button primary" disabled={action.busy || menu.loading || !names.length}>{translateText('Lưu Bước 1 & Sang Bước 2')} <ArrowRight size={14} /></button></div>
    </form>}

    {step === 2 && <form onSubmit={nextStep2} className="space-y-4"><h3 className="text-base font-black text-emerald-800">{translateText('BƯỚC 2: Kiểm tra trong quá trình chế biến thức ăn')}</h3><div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4"><label className="flex items-center gap-2 p-3 text-sm font-bold bg-white border rounded-xl border-slate-200"><input type="checkbox" checked={step2Checks.hygiene} onChange={(event) => setStep2Checks({ ...step2Checks, hygiene: event.target.checked })} />{translateText("Vệ sinh dao thớt, dụng cụ chứa đựng phân biệt rõ sống - chín")}</label><label className="flex items-center gap-2 p-3 text-sm font-bold bg-white border rounded-xl border-slate-200"><input type="checkbox" checked={step2Checks.oneWay} onChange={(event) => setStep2Checks({ ...step2Checks, oneWay: event.target.checked })} />{translateText("Quy trình bếp 1 chiều, sàn khô ráo, nhân viên mang găng tay và tạp dề")}</label><label className="flex items-center gap-2 p-3 text-sm font-bold text-emerald-800 border rounded-xl border-emerald-200 bg-emerald-50"><Thermometer className="w-4 h-4" />{translateText("Nhiệt độ tâm món khi nấu sôi:")}<input className="w-20 kp-input" type="number" min="75" value={form.step2Temperature} onChange={(event) => setForm({ ...form, step2Temperature: event.target.value })} /> °C (≥ 75°C)</label></div>{photoBox(2, 'Ảnh khu vực nấu và giám sát bếp')}<label className="kp-field">{translateText('Ghi chú Bước 2')}<textarea className="kp-input" rows={2} value={form.step2Note} onChange={(event) => setForm({ ...form, step2Note: event.target.value })} placeholder={translateText("Nhập ghi chú trong quá trình chế biến...")} /></label><div className="flex justify-between pt-3 border-t border-slate-100"><button type="button" className="kp-button" onClick={() => setStep(1)}><ArrowLeft size={14} />{translateText('Quay lại Bước 1')}</button><button className="kp-button primary" disabled={action.busy}>{translateText('Lưu Bước 2 & Sang Bước 3')} <ArrowRight size={14} /></button></div></form>}

    {step === 3 && <form onSubmit={finishStep3} className="space-y-4"><h3 className="text-base font-black text-blue-800">{translateText('BƯỚC 3: Cảm quan thức ăn trước khi ăn và lưu mẫu 24h')}</h3><div className="space-y-2 rounded-2xl border border-blue-200 bg-blue-50/50 p-4">{selectedDishes.map((dish) => <label key={dish.id} className="flex items-center justify-between gap-3 p-2 text-sm font-semibold bg-white border rounded-xl border-slate-200"><span>{dish.name}</span><span className="flex items-center gap-2"><input className="w-20 kp-input" type="number" min="100" value={quantities[dish.id] || '150'} onChange={(event) => setQuantities({ ...quantities, [dish.id]: event.target.value })} /><span className="text-xs text-slate-500">{translateText("gram / hộp")}</span></span></label>)}</div>{photoBox(3, 'Ảnh khay thức ăn chia / hộp lưu mẫu dán tem niêm phong')}<div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="kp-field">{translateText('Nhiệt độ tủ lưu mẫu (°C)')}<input className="kp-input font-bold text-blue-800" type="number" step="0.1" value={form.step3Temperature} onChange={(event) => setForm({ ...form, step3Temperature: event.target.value })} /></label><label className="kp-field">{translateText('Ghi chú Bước 3')}<input className="kp-input" value={form.step3Note} onChange={(event) => setForm({ ...form, step3Note: event.target.value })} placeholder={translateText("Cảm quan và niêm phong mẫu lưu...")} /></label></div><div className="flex justify-between pt-3 border-t border-slate-100"><button type="button" className="kp-button" onClick={() => setStep(2)}><ArrowLeft size={14} />{translateText('Quay lại Bước 2')}</button><button className="kp-button primary" disabled={action.busy || imageBusy}><CheckCircle2 size={14} />{translateText('Hoàn tất & Niêm phong mẫu lưu')}</button></div></form>}
  </Modal>;
}
