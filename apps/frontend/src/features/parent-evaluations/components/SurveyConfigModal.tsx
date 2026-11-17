import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState } from 'react';
import { X, Check } from 'lucide-react';

interface SurveyConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SurveyConfigModal: React.FC<SurveyConfigModalProps> = ({ isOpen, onClose }) => {
  useLanguage();
  const [autoReminder, setAutoReminder] = useState(true);
  const [frequency, setFrequency] = useState('WEEKLY');
  const [time, setTime] = useState('16:30');

  if (!isOpen) return null;

  return (
    <div className="fixed !m-0 inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="font-bold text-base text-slate-900">{translateText("Cấu hình Khảo sát Ý kiến Định kỳ")}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">{translateText("Tần suất gửi khảo sát tới Phụ huynh:")}</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
            >
              <option value="DAILY">{translateText("Hàng ngày sau bữa trưa/bữa xế")}</option>
              <option value="WEEKLY">{translateText("Hàng tuần vào chiều Thứ Sáu")}</option>
              <option value="MONTHLY">{translateText("Hàng tháng (Tổng kết thực đơn tháng)")}</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">{translateText("Thời gian gửi thông báo:")}</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
            >
            </input>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="auto-remind"
              checked={autoReminder}
              onChange={(e) => setAutoReminder(e.target.checked)}
              className="w-4 h-4 text-teal-600 rounded accent-teal-600 cursor-pointer"
            />
            <label htmlFor="auto-remind" className="cursor-pointer text-slate-700 font-medium">{translateText("Tự động gửi thông báo đẩy nhắc nhở phụ huynh gửi phản hồi")}</label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 p-4 border-t border-slate-100 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 bg-white text-slate-700 rounded-xl font-semibold hover:bg-slate-100"
          >{translateText("Hủy")}</button>
          <button
            onClick={() => {
              alert(translateText('Đã lưu cấu hình khảo sát thành công!'));
              onClose();
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-xs"
          >
            <Check className="w-4 h-4" />
            <span>{translateText("Lưu cấu hình")}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
