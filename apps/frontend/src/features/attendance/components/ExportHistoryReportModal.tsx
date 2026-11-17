import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState } from 'react';
import { X, Printer, Download, FileSpreadsheet, FileText, CheckCircle2 } from 'lucide-react';
import { AttendanceHistoryResponse } from '../types';
import { attendanceApi } from '../api/attendanceApi';
import { downloadExcel } from '../../../core/utils/excel-export';

interface ExportHistoryReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: AttendanceHistoryResponse | null;
  query?: Parameters<typeof attendanceApi.getHistoryList>[0];
}

export const ExportHistoryReportModal: React.FC<ExportHistoryReportModalProps> = ({
  isOpen,
  onClose,
  data,
  query,
}) => {
  useLanguage();
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeWater, setIncludeWater] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportedSuccess, setExportedSuccess] = useState(false);

  if (!isOpen || !data) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportedSuccess(false);
    try {
      const items: AttendanceHistoryResponse['items'] = [];
      let page = 1;
      while (true) {
        const response: AttendanceHistoryResponse = await attendanceApi.getHistoryList({
          classId: data.classInfo.id, startDate: data.period.startDate, endDate: data.period.endDate,
          ...query, page, limit: 100,
        });
        items.push(...response.items);
        if (!response.items.length || page >= response.pagination.totalPages) break;
        page++;
      }
      const ok = await downloadExcel(`Lich_su_diem_danh_${data.period.startDate}_${data.period.endDate}.xlsx`, [
        ['Ngày', 'Mã học sinh', 'Họ và tên', 'Bữa ăn', 'Điểm danh', 'Mức ăn', 'Món ăn', ...(includeWater ? ['Lượng nước uống'] : []), ...(includeNotes ? ['Ghi chú giáo viên'] : [])],
        ...items.map(item => [item.date, item.child.studentCode, item.child.fullName, item.mealSession, item.attendanceStatusLabel,
          ({ ALL: 'Ăn hết', HALF: 'Ăn một nửa', NONE: 'Không ăn', ABSENT: 'Vắng' } as Record<string, string>)[item.portionConsumed] || item.portionConsumed,
          item.dishesServed.join('\n'), ...(includeWater ? [item.waterIntake] : []), ...(includeNotes ? [item.teacherNote] : [])]),
      ], `Lịch sử điểm danh và sức ăn - ${data.classInfo.name}`);
      setExportedSuccess(ok);
    } catch (error: any) {
      alert(translateText(error.response?.data?.message || error.message || 'Không thể tải dữ liệu lịch sử để xuất Excel.'));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed !m-0 inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 lg:p-8 shadow-2xl border border-slate-100 space-y-6 max-h-[92vh] overflow-y-auto">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 print:hidden">
          <div>
            <h3 className="text-lg font-black text-slate-900">{translateText("Xuất Báo Cáo Lịch Sử Điểm Danh & Sức Ăn")}</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {data.classInfo.name} • {translateText(data.period.displayRange)} ({translateText(data.period.weekLabel)})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options */}
        <div className="space-y-4 print:hidden">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6" />
            <span>{translateText('Bảng tính Excel (.xlsx) có logo và thông tin trường')}</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase">{translateText("Nội dung xuất file")}</label>
            <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={includeNotes}
                  onChange={(e) => setIncludeNotes(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span>{translateText("Kèm nhận xét chi tiết và ghi chú đặc biệt của giáo viên chủ nhiệm")}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={includeWater}
                  onChange={(e) => setIncludeWater(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span>{translateText("Kèm thống kê lượng nước uống & sữa cữ phụ của từng học sinh")}</span>
              </label>
            </div>
          </div>
        </div>

        {/* Report Preview Summary Card */}
        <div className="border border-slate-200 p-5 rounded-2xl bg-white space-y-3 text-xs">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <span className="font-bold text-slate-800 uppercase">{translateText("Tóm tắt dữ liệu xuất:")}</span>
            <span className="text-[11px] text-teal-700 font-bold">
              {data.pagination?.totalWeekMeals || data.pagination?.totalItems || data.items.length}{translateText(" lượt ăn / ")}{data.classInfo?.totalStudents || 32}{translateText(" học sinh")}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[11px]">
            <div className="p-2 bg-slate-50 rounded-lg">
              <p className="text-slate-500">{translateText("Chuyên cần")}</p>
              <p className="font-black text-slate-800 text-sm mt-0.5">{data.summary.attendanceRate}%</p>
            </div>
            <div className="p-2 bg-teal-50 rounded-lg">
              <p className="text-teal-700">{translateText("Ăn hết suất")}</p>
              <p className="font-black text-teal-800 text-sm mt-0.5">{data.summary.allEatenRate}%</p>
            </div>
            <div className="p-2 bg-amber-50 rounded-lg">
              <p className="text-amber-700">{translateText("Lưu ý dinh dưỡng")}</p>
              <p className="font-black text-amber-800 text-sm mt-0.5">{data.summary.specialCareCount}{translateText(" bé")}</p>
            </div>
            <div className="p-2 bg-sky-50 rounded-lg">
              <p className="text-sky-700">{translateText("Suất ăn riêng")}</p>
              <p className="font-black text-sky-800 text-sm mt-0.5">{data.summary.specialDietCount}{translateText(" suất")}</p>
            </div>
          </div>
        </div>

        {/* Success Alert */}
        {exportedSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{translateText("Đã tạo file báo cáo thành công! Quá trình tải xuống tự động bắt đầu.")}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 print:hidden">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold transition"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>{translateText("Xem trước bản in")}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition"
            >{translateText("Hủy bỏ")}</button>

            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow transition disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{translateText(isExporting ? 'Đang xuất file...' : 'Tải xuống báo cáo')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
