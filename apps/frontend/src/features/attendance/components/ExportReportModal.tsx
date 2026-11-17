import { t as translateText, getLocale } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React from 'react';
import { X, Printer, Download, CheckCircle2 } from 'lucide-react';
import { AttendanceResponse } from '../types';
import { downloadExcel } from '../../../core/utils/excel-export';

interface ExportReportModalProps {
  data: AttendanceResponse | null;
  selectedDate: string;
  onClose: () => void;
}

export const ExportReportModal: React.FC<ExportReportModalProps> = ({
  data,
  selectedDate,
  onClose,
}) => {
  useLanguage();
  if (!data) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed !m-0 inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-3xl w-full p-8 shadow-2xl border border-slate-100 space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 print:hidden">
          <div>
            <h3 className="text-lg font-black text-slate-900">{translateText("Phiếu Báo Suất Ăn Bán Trú Trong Ngày")}</h3>
            <p className="text-xs text-slate-500 font-medium">{translateText("Chuẩn mẫu báo ăn Bếp một chiều - Trường Mầm Non Ban Mai")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void downloadExcel(`Phieu_bao_suat_an_${selectedDate}.xlsx`, [
                ['Mã học sinh', 'Họ và tên', 'Lớp', 'Đăng ký bữa ăn', 'Vắng', 'Chế độ ăn', 'Ghi chú'],
                ...data.children.map(child => [child.studentCode, child.fullName, data.classInfo.name, child.mealOption, child.isAbsent ? 'Vắng' : 'Có mặt', child.dietBadge.title, child.parentNote]),
              ], 'Phiếu báo suất ăn bán trú')}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-xl text-xs font-bold"
            >
              <Download className="w-4 h-4" />{translateText('Xuất Excel')}
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow transition"
            >
              <Printer className="w-4 h-4" />
              <span>{translateText("In phiếu báo")}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Sheet */}
        <div className="border border-slate-300 p-6 rounded-2xl bg-white space-y-6 text-slate-900 text-xs">
          {/* School & Form Header */}
          <div className="flex justify-between items-start border-b border-slate-300 pb-4">
            <div>
              <p className="font-extrabold text-sm uppercase">{translateText("PHÒNG GD&ĐT QUẬN / HUYỆN")}</p>
              <p className="font-bold text-sm uppercase text-teal-800">{translateText("TRƯỜNG MẦM NON BAN MAI - CS01")}</p>
              <p className="text-[11px] text-slate-500">{translateText("Mã đơn vị: BM-MN-01")}</p>
            </div>
            <div className="text-right">
              <p className="font-black text-sm uppercase">{translateText("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM")}</p>
              <p className="font-bold text-[11px]">{translateText("Độc lập - Tự do - Hạnh phúc")}</p>
              <p className="text-[11px] text-slate-500 mt-1">{translateText("Ngày ")}{translateText(new Date(selectedDate).toLocaleDateString(getLocale()))}</p>
            </div>
          </div>

          <div className="text-center space-y-1">
            <h2 className="text-lg font-black uppercase text-slate-900">{translateText("PHIẾU BÁO SUẤT ĂN BÁN TRÚ HÀNG NGÀY")}</h2>
            <p className="font-bold text-teal-700">{data.classInfo.name}{translateText(" • Năm học ")}{translateText(data.classInfo.academicYear)}</p>
          </div>

          {/* Quick Metrics Table */}
          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="border border-slate-300 p-3 rounded-xl">
              <p className="text-[11px] text-slate-500 font-bold">{translateText("Tổng Sĩ Số Lớp")}</p>
              <p className="text-xl font-black text-slate-900 mt-1">{data.summary.totalClassStudents}</p>
            </div>
            <div className="border border-slate-300 p-3 rounded-xl bg-teal-50">
              <p className="text-[11px] text-teal-800 font-bold">{translateText("Ăn Bán Trú")}</p>
              <p className="text-xl font-black text-teal-700 mt-1">{data.summary.registeredToday}</p>
            </div>
            <div className="border border-slate-300 p-3 rounded-xl bg-amber-50">
              <p className="text-[11px] text-amber-800 font-bold">{translateText("Vắng Mặt / Nghỉ Ăn")}</p>
              <p className="text-xl font-black text-amber-700 mt-1">{data.summary.absentCount}</p>
            </div>
            <div className="border border-slate-300 p-3 rounded-xl bg-red-50">
              <p className="text-[11px] text-red-800 font-bold">{translateText("Suất Ăn Kiêng / Dị Ứng")}</p>
              <p className="text-xl font-black text-red-700 mt-1">{data.summary.dietSpecialCount}</p>
            </div>
          </div>

          {/* Special Diet List */}
          <div className="space-y-2">
            <p className="font-bold uppercase text-[11px] text-slate-700">{translateText("1. Danh sách học sinh có chế độ ăn kiêng & Lưu ý dị ứng:")}</p>
            <table className="w-full border-collapse border border-slate-300 text-[11px]">
              <thead className="bg-slate-100">
                <tr>
                  <th className="border border-slate-300 p-2 text-center w-10">{translateText("STT")}</th>
                  <th className="border border-slate-300 p-2">{translateText("Mã HS")}</th>
                  <th className="border border-slate-300 p-2">{translateText("Họ và Tên")}</th>
                  <th className="border border-slate-300 p-2">{translateText("Chế độ kiêng / Dị ứng")}</th>
                  <th className="border border-slate-300 p-2">{translateText("Món thay thế Bếp thực hiện")}</th>
                </tr>
              </thead>
              <tbody>
                {data.children
                  .filter((c) => c.dietBadge.type === 'ALLERGY' || c.dietBadge.type === 'INTOLERANCE' || c.dietBadge.type === 'SPECIAL_CARE')
                  .map((c, idx) => (
                    <tr key={c.id}>
                      <td className="border border-slate-300 p-2 text-center">{idx + 1}</td>
                      <td className="border border-slate-300 p-2 font-bold">{c.studentCode}</td>
                      <td className="border border-slate-300 p-2 font-bold">{c.fullName}</td>
                      <td className="border border-slate-300 p-2 text-red-700 font-bold">{translateText(c.dietBadge.title)}</td>
                      <td className="border border-slate-300 p-2">{c.dietBadge.description || translateText('Chế độ riêng')}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-6 pt-8 text-center text-xs">
            <div>
              <p className="font-bold">{translateText("GIÁO VIÊN CHỦ NHIỆM")}</p>
              <p className="text-[11px] text-slate-400 italic mt-0.5">{translateText("(Ký và ghi rõ họ tên)")}</p>
              <div className="h-16"></div>
              <p className="font-bold text-slate-800">{translateText("Cô Mai Anh")}</p>
            </div>
            <div>
              <p className="font-bold">{translateText("BẾP TRƯỞNG TIẾP NHẬN")}</p>
              <p className="text-[11px] text-slate-400 italic mt-0.5">{translateText("(Ký và ghi rõ họ tên)")}</p>
              <div className="h-16"></div>
              <p className="font-bold text-slate-800">{translateText("Cô Phạm Lan")}</p>
            </div>
            <div>
              <p className="font-bold">{translateText("BAN GIÁM HIỆU DUYỆT")}</p>
              <p className="text-[11px] text-slate-400 italic mt-0.5">{translateText("(Ký và đóng dấu)")}</p>
              <div className="h-16"></div>
              <p className="font-bold text-slate-800">{translateText("Nguyễn Thị Minh Tâm")}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
