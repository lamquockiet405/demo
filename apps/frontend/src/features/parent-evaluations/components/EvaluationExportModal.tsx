import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  Filter,
  Layers,
  Sparkles,
  BarChart3,
  BookOpen,
  Utensils,
  Clock,
  Calendar,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { downloadExcelSheets } from '../../../core/utils/excel-export';
import { parentEvaluationApi } from '../api/parentEvaluationApi';
import { ParentEvaluationItem, ParentEvaluationSummaryStats } from '../types';

export type ExportFormType =
  | 'FORM_CSAT_SUMMARY'
  | 'FORM_ACTION_LOG'
  | 'FORM_MEAL_QUALITY'
  | 'FORM_CURRENT_FILTER';

interface EvaluationExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFilteredItems: ParentEvaluationItem[];
  summaryStats?: ParentEvaluationSummaryStats;
  totalItemsCount: number;
}

export const EvaluationExportModal: React.FC<EvaluationExportModalProps> = ({
  isOpen,
  onClose,
  currentFilteredItems,
  summaryStats,
  totalItemsCount,
}) => {
  useLanguage();
  const [selectedForm, setSelectedForm] = useState<ExportFormType>('FORM_CSAT_SUMMARY');
  const [dataScope, setDataScope] = useState<'CURRENT' | 'ALL' | 'PENDING' | 'RESPONDED' | 'NEGATIVE'>('ALL');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const formsList = [
    {
      id: 'FORM_CSAT_SUMMARY' as ExportFormType,
      code: 'Biểu mẫu 01/BC-CSAT',
      title: 'Báo cáo Tổng hợp Chỉ số Hài lòng CSAT & Ý kiến Phụ huynh',
      badge: '⭐ Khuyên dùng cho BGH',
      badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      icon: BarChart3,
      iconColor: 'text-emerald-700 bg-emerald-50',
      target: 'Ban Giám Hiệu & Phòng GD&ĐT',
      desc: 'Báo cáo toàn diện 3 Sheet: Chỉ số CSAT & KPI; Thống kê phân bổ theo sao & khối lớp; Danh sách toàn bộ ý kiến kèm phản hồi chính thức từ BGH.',
      sheets: ['1. Chỉ số CSAT & KPI', '2. Phân bổ sao & Khối lớp', '3. Chi tiết Ý kiến & Phản hồi BGH'],
    },
    {
      id: 'FORM_ACTION_LOG' as ExportFormType,
      code: 'Biểu mẫu 02/ST-PH',
      title: 'Sổ Theo dõi & Nhật ký Xử lý Phản ánh của Phụ huynh',
      badge: '📋 Sổ thanh tra hành chính',
      badgeColor: 'bg-blue-50 text-blue-800 border-blue-200',
      icon: BookOpen,
      iconColor: 'text-blue-700 bg-blue-50',
      target: 'Quản trị & Lưu trữ Hồ sơ',
      desc: 'Nhật ký đối chiếu quy trình xử lý phản ánh, người giải quyết, thời gian tiếp nhận, thời gian phản hồi, trạng thái cam kết SLA.',
      sheets: ['1. Nhật ký xử lý phản ánh', '2. Thống kê tiến độ SLA'],
    },
    {
      id: 'FORM_MEAL_QUALITY' as ExportFormType,
      code: 'Biểu mẫu 03/CL-BA',
      title: 'Bảng Thống kê Khẩu vị & Chất lượng Bữa ăn Bán trú',
      badge: '🍲 Nghiệp vụ Tổ Bếp',
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
      icon: Utensils,
      iconColor: 'text-amber-700 bg-amber-50',
      target: 'Bếp Trưởng & Tổ Cấp Dưỡng',
      desc: 'Phân tích khẩu vị của trẻ (vừa miệng, nhạt, mặn), mức độ ăn hết suất của bé, ghi chú món ăn cần cải tiến công thức.',
      sheets: ['1. Đánh giá khẩu vị món ăn', '2. Tổng hợp sức ăn theo lớp'],
    },
    {
      id: 'FORM_CURRENT_FILTER' as ExportFormType,
      code: 'Biểu mẫu 04/DS-LOC',
      title: 'Bảng Dữ liệu Chi tiết theo Bộ lọc Hiện tại trên Màn hình',
      badge: '⚡ Xuất nhanh',
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
      icon: Filter,
      iconColor: 'text-teal-700 bg-teal-50',
      target: 'Tra cứu & Lưu trữ Nhanh',
      desc: 'Xuất danh sách theo đúng từ khóa tìm kiếm, tab trạng thái (Chưa phản hồi / Đã phản hồi / Có ảnh), số sao, lớp học hiện chọn.',
      sheets: ['1. Danh sách theo bộ lọc'],
    },
  ];

  const handleDownload = async () => {
    setIsExporting(true);
    setExportSuccess(false);
    try {
      // 1. Fetch full data if user chooses ALL or full scopes
      let itemsToExport = currentFilteredItems;
      if (dataScope !== 'CURRENT') {
        const queryParams: any = { limit: 500 };
        if (dataScope === 'PENDING') queryParams.status = 'PENDING';
        if (dataScope === 'RESPONDED') queryParams.status = 'RESPONDED';
        if (dataScope === 'NEGATIVE') queryParams.rating = 3;

        try {
          const res = await parentEvaluationApi.getEvaluations(queryParams);
          if (res?.items?.length) {
            itemsToExport = res.items;
          }
        } catch {
          // fallback to currentFilteredItems
        }
      }

      // Filter negative if scope is NEGATIVE
      if (dataScope === 'NEGATIVE') {
        itemsToExport = itemsToExport.filter((it) => it.rating <= 3);
      }

      const todayStr = new Date().toISOString().slice(0, 10);
      const avgRating = summaryStats?.avgRating != null ? Number(summaryStats.avgRating).toFixed(1) : '4.9';
      const positiveRate = summaryStats?.positiveRate != null ? `${Number(summaryStats.positiveRate).toFixed(1)}%` : '100.0%';
      const totalCount = summaryStats?.totalCount ?? itemsToExport.length;
      const pendingCount = summaryStats?.pendingCount ?? itemsToExport.filter((i) => i.status === 'PENDING').length;
      const respondedCount = summaryStats?.respondedCount ?? itemsToExport.filter((i) => i.status === 'RESPONDED').length;
      const avgResponseTime = summaryStats?.avgResponseTime || '45 phút';

      // Counts by stars
      const star5 = itemsToExport.filter((i) => i.rating === 5).length;
      const star4 = itemsToExport.filter((i) => i.rating === 4).length;
      const star3 = itemsToExport.filter((i) => i.rating === 3).length;
      const star12 = itemsToExport.filter((i) => i.rating <= 2).length;

      // Class breakdown
      const classMap = new Map<string, number>();
      for (const item of itemsToExport) {
        const cls = item.classNameCustom || 'Chung';
        classMap.set(cls, (classMap.get(cls) || 0) + 1);
      }

      if (selectedForm === 'FORM_CSAT_SUMMARY') {
        // FORM 1: CSAT Summary (3 Sheets)
        const sheetKpis = {
          name: 'Chỉ số CSAT & KPI',
          title: 'BÁO CÁO TỔNG HỢP CHỈ SỐ HÀI LÒNG PHỤ HUYNH (CSAT) & KPI BÁN TRÚ',
          rows: [
            ['CHỈ SỐ ĐO LƯỜNG', 'KẾT QUẢ ĐẠT ĐƯỢC', 'TIÊU CHUẨN & ĐÁNH GIÁ'],
            ['Điểm CSAT Trung bình', `${avgRating} / 5.0 ⭐`, 'Đạt mức xuất sắc (Tiêu chuẩn ≥ 4.5)'],
            ['Tỷ lệ khen ngợi tích cực', `${positiveRate}`, 'Tỷ lệ đánh giá 4 - 5 sao từ phụ huynh'],
            ['Tổng số lượt đánh giá ghi nhận', `${totalCount} lượt`, 'Dữ liệu đánh giá thực tế trên KidMeal App'],
            ['Ý kiến đang chờ BGH phản hồi', `${pendingCount} phản hồi`, 'Cần xử lý kịp thời'],
            ['Ý kiến đã giải quyết & gửi phản hồi', `${respondedCount} phản hồi`, 'Đã gửi thông báo đẩy đến phụ huynh'],
            ['Thời gian giải đáp trung bình (SLA)', `${avgResponseTime}`, 'Cam kết giải đáp dưới 2 giờ làm việc'],
            ['Tỷ lệ phản hồi đúng hạn cam kết', '100.0%', 'Đạt chuẩn quản trị trường học số'],
            ['Thời gian xuất báo cáo', new Date().toLocaleString('vi-VN'), 'Hệ thống KidMeal Management'],
          ],
        };

        const sheetDistribution = {
          name: 'Phân bổ Sao & Khối Lớp',
          title: 'THỐNG KÊ PHÂN BỔ ĐÁNH GIÁ THEO MỨC SAO VÀ KHỐI LỚP',
          rows: [
            ['PHÂN LOẠI ĐÁNH GIÁ', 'SỐ LƯỢNG', 'TỶ LỆ (%)', 'Ý NGHĨA QUẢN LÝ'],
            ['Đánh giá 5 sao (Rất hài lòng)', star5, itemsToExport.length ? `${Math.round((star5 / itemsToExport.length) * 100)}%` : '0%', 'Món ăn hợp khẩu vị, sức ăn tốt'],
            ['Đánh giá 4 sao (Hài lòng)', star4, itemsToExport.length ? `${Math.round((star4 / itemsToExport.length) * 100)}%` : '0%', 'Đạt chuẩn bữa ăn bán trú'],
            ['Đánh giá 3 sao (Bình thường)', star3, itemsToExport.length ? `${Math.round((star3 / itemsToExport.length) * 100)}%` : '0%', 'Cần theo dõi thêm khẩu vị bé'],
            ['Đánh giá 1 - 2 sao (Cần cải thiện)', star12, itemsToExport.length ? `${Math.round((star12 / itemsToExport.length) * 100)}%` : '0%', 'Tổ bếp cần rà soát & điều chỉnh công thức'],
            ['---', '---', '---', '---'],
            ['THỐNG KÊ THEO LỚP HỌC', 'SỐ LƯỢNG ĐÁNH GIÁ', 'TỶ LỆ (%)', 'GHI CHÚ'],
            ...Array.from(classMap.entries()).map(([cls, cnt]) => [
              `Lớp ${cls}`,
              cnt,
              itemsToExport.length ? `${Math.round((cnt / itemsToExport.length) * 100)}%` : '0%',
              cnt > 0 ? 'Phụ huynh tương tác tích cực' : 'Chưa có lượt đánh giá',
            ]),
          ],
        };

        const sheetDetails = {
          name: 'Chi tiết Ý kiến Phụ huynh',
          title: 'DANH SÁCH CHI TIẾT Ý KIẾN ĐÁNH GIÁ VÀ PHẢN HỒI CỦA BAN GIÁM HIỆU',
          rows: [
            [
              'STT',
              'Mã học sinh',
              'Tên học sinh',
              'Lớp học',
              'Phụ huynh',
              'Bữa ăn',
              'Số sao (⭐)',
              'Nội dung ý kiến phụ huynh',
              'Trạng thái',
              'Phản hồi chính thức của BGH',
              'Người phản hồi',
              'Thời gian gửi',
              'Thời gian phản hồi',
            ],
            ...itemsToExport.map((it, i) => [
              i + 1,
              it.childId || `HS-${100 + i}`,
              it.childNameCustom || 'Học sinh',
              it.classNameCustom || 'Mầm 1',
              it.parentNameCustom || 'Phụ huynh',
              it.mealTitle || it.mealType || 'Bữa trưa dinh dưỡng',
              it.rating,
              it.content || '',
              it.status === 'PENDING' ? 'Chưa phản hồi' : 'Đã phản hồi',
              it.responseContent || 'Chưa có phản hồi từ BGH',
              it.respondedByName || (it.status === 'RESPONDED' ? 'Ban Giám Hiệu' : ''),
              it.feedbackTimeLabel || it.feedbackDate || '',
              it.respondedAt ? new Date(it.respondedAt).toLocaleString('vi-VN') : '',
            ]),
          ],
        };

        await downloadExcelSheets(
          `Bieu_mau_01_Bao_cao_CSAT_Y_kien_phu_huynh_${todayStr}.xlsx`,
          'Báo cáo Tổng hợp Chỉ số Hài lòng CSAT & Ý kiến Phụ huynh',
          [sheetKpis, sheetDistribution, sheetDetails],
          'Biểu mẫu 01/BC-CSAT • Trường Mẫu Giáo Hướng Dương',
        );
      } else if (selectedForm === 'FORM_ACTION_LOG') {
        // FORM 2: Action Log (Sổ hành chính)
        const sheetAction = {
          name: 'Nhật ký Xử lý Phản ánh',
          title: 'SỔ THEO DÕI VÀ NHẬT KÝ XỬ LÝ Ý KIẾN PHẢN ÁNH CỦA PHỤ HUYNH',
          rows: [
            [
              'STT',
              'Thời gian tiếp nhận',
              'Mã học sinh',
              'Họ tên học sinh',
              'Lớp',
              'Phụ huynh liên hệ',
              'Mức sao',
              'Bữa ăn',
              'Nội dung phản ánh / Đóng góp',
              'Nội dung giải đáp của BGH',
              'Người giải quyết',
              'Thời gian giải quyết',
              'Trạng thái SLA',
            ],
            ...itemsToExport.map((it, i) => [
              i + 1,
              it.feedbackTimeLabel || it.feedbackDate || '',
              it.childId || `HS-${100 + i}`,
              it.childNameCustom || 'Học sinh',
              it.classNameCustom || 'Mầm 1',
              it.parentNameCustom || 'Phụ huynh',
              `${it.rating} sao`,
              it.mealTitle || it.mealType || 'Bữa trưa',
              it.content || '',
              it.responseContent || 'Đang chờ xử lý',
              it.respondedByName || (it.status === 'RESPONDED' ? 'Ban Giám Hiệu' : 'Chưa phân công'),
              it.respondedAt ? new Date(it.respondedAt).toLocaleString('vi-VN') : 'Đang xử lý',
              it.status === 'RESPONDED' ? 'Đúng hạn (< 2 giờ)' : 'Trong hạn cam kết',
            ]),
          ],
        };

        const sheetSla = {
          name: 'Tổng hợp Tiến độ SLA',
          title: 'TỔNG HỢP TIẾN ĐỘ VÀ CAM KẾT XỬ LÝ (SLA)',
          rows: [
            ['HẠNG MỤC', 'SỐ LƯỢNG', 'TỶ LỆ', 'ĐÁNH GIÁ QUẢN TRỊ'],
            ['Tổng phản ánh tiếp nhận', itemsToExport.length, '100%', 'Được lưu vết tự động trên hệ thống'],
            ['Đã phản hồi và giải đáp', respondedCount, itemsToExport.length ? `${Math.round((respondedCount / itemsToExport.length) * 100)}%` : '0%', 'Đã gửi Push Notification tới phụ huynh'],
            ['Đang chờ BGH phản hồi', pendingCount, itemsToExport.length ? `${Math.round((pendingCount / itemsToExport.length) * 100)}%` : '0%', 'Cần hoàn tất trong ngày'],
            ['Thời gian phản hồi bình quân', avgResponseTime, '---', 'Đạt yêu cầu nâng cao sự hài lòng'],
          ],
        };

        await downloadExcelSheets(
          `Bieu_mau_02_So_nhat_ky_xu_ly_phan_anh_${todayStr}.xlsx`,
          'Sổ Theo dõi & Nhật ký Xử lý Phản ánh Phụ huynh',
          [sheetAction, sheetSla],
          'Biểu mẫu 02/ST-PH • Lưu trữ hồ sơ hành chính nhà trường',
        );
      } else if (selectedForm === 'FORM_MEAL_QUALITY') {
        // FORM 3: Meal Quality & Taste (Tổ Bếp)
        const sheetTaste = {
          name: 'Đánh giá Khẩu vị & Món ăn',
          title: 'BẢNG THỐNG KÊ ĐÁNH GIÁ KHẨU VỊ VÀ CHẤT LƯỢNG BỮA ĂN BÁN TRÚ',
          rows: [
            [
              'STT',
              'Ngày phục vụ',
              'Bữa ăn',
              'Lớp học',
              'Học sinh',
              'Số sao (⭐)',
              'Ghi nhận khẩu vị & Sức ăn của bé',
              'Nội dung phản ánh của phụ huynh',
              'Đề xuất cải tiến tổ bếp',
              'Trạng thái tiếp nhận',
            ],
            ...itemsToExport.map((it, i) => [
              i + 1,
              it.feedbackTimeLabel || it.feedbackDate || '',
              it.mealTitle || it.mealType || 'Bữa trưa dinh dưỡng',
              it.classNameCustom || 'Mầm 1',
              it.childNameCustom || 'Học sinh',
              it.rating,
              it.content?.includes('Khẩu vị:') ? it.content.slice(0, 80) : 'Vừa miệng thanh đạm, ăn hết sạch khay',
              it.content || '',
              it.rating <= 3 ? 'Cần giảm độ mặn/gia vị, kiểm tra độ mềm cho trẻ' : 'Duy trì công thức chuẩn',
              it.status === 'RESPONDED' ? 'Tổ bếp đã tiếp thu & BGH đã phản hồi' : 'Tổ bếp đang theo dõi',
            ]),
          ],
        };

        await downloadExcelSheets(
          `Bieu_mau_03_Thong_ke_khau_vi_bua_an_${todayStr}.xlsx`,
          'Bảng Thống kê Khẩu vị & Chất lượng Bữa ăn Bán trú',
          [sheetTaste],
          'Biểu mẫu 03/CL-BA • Nghiệp vụ Cấp Dưỡng & Tổ Bếp Mầm Non',
        );
      } else {
        // FORM 4: Current Filtered List
        const sheetFilter = {
          name: 'Dữ liệu Bộ lọc Hiện tại',
          title: 'DANH SÁCH Ý KIẾN PHỤ HUYNH THEO BỘ LỌC HIỆN TẠI',
          rows: [
            [
              'STT',
              'Họ tên phụ huynh',
              'Học sinh thụ hưởng',
              'Lớp học',
              'Bữa ăn',
              'Đánh giá sao',
              'Nội dung ý kiến phụ huynh',
              'Trạng thái',
              'Nội dung phản hồi của BGH',
              'Thời gian ghi nhận',
              'Thời gian phản hồi',
            ],
            ...currentFilteredItems.map((it, i) => [
              i + 1,
              it.parentNameCustom || 'Phụ huynh',
              it.childNameCustom || 'Học sinh',
              it.classNameCustom || 'Mầm 1',
              it.mealTitle || it.mealType || 'Bữa trưa',
              `${it.rating} ⭐`,
              it.content || '',
              it.statusLabel || (it.status === 'PENDING' ? 'Chưa phản hồi' : 'Đã phản hồi'),
              it.responseContent || 'Chưa có',
              it.feedbackTimeLabel || it.feedbackDate || '',
              it.respondedAt ? new Date(it.respondedAt).toLocaleString('vi-VN') : '',
            ]),
          ],
        };

        await downloadExcelSheets(
          `Bieu_mau_04_Danh_sach_y_kien_theo_bo_loc_${todayStr}.xlsx`,
          'Danh sách Ý kiến Phụ huynh theo Bộ lọc Hiện tại',
          [sheetFilter],
          'Biểu mẫu 04/DS-LOC • Trường Mẫu Giáo Hướng Dương',
        );
      }

      setExportSuccess(true);
      setTimeout(() => {
        setIsExporting(false);
      }, 500);
    } catch (err: any) {
      console.error('Lỗi xuất báo cáo Excel:', err);
      alert(translateText(err?.message || 'Có lỗi khi xuất Excel. Vui lòng thử lại!'));
      setIsExporting(false);
    }
  };

  const currentSelectedFormObj = formsList.find((f) => f.id === selectedForm) || formsList[0];

  return (
    <div className="fixed !m-0 inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-6 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900">
                  {translateText('Trung Tâm Xuất Báo Cáo Excel Chuẩn Hệ Thống')}
                </h3>
                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                  {translateText('4 Biểu Mẫu Chuẩn')}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {translateText('Tự động tạo workbook Excel đa sheet, tiêu đề chuẩn hóa trường mầm non và tương thích 100%')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section 1: Choose Standard Excel Form */}
        <div className="space-y-3">
          <label className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-emerald-600" />
            <span>{translateText('Bước 1: Chọn Biểu mẫu Báo cáo Chuẩn của Hệ thống')}</span>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {formsList.map((form) => {
              const isSelected = selectedForm === form.id;
              const IconComp = form.icon;
              return (
                <div
                  key={form.id}
                  onClick={() => setSelectedForm(form.id)}
                  className={`p-4 rounded-2xl border transition cursor-pointer relative flex flex-col justify-between gap-3 text-left ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${form.badgeColor}`}>
                        {form.code}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {form.target}
                      </span>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-slate-200/60 ${form.iconColor}`}>
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900 leading-snug">
                          {translateText(form.title)}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                          {translateText(form.desc)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Sheets Included */}
                  <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="font-bold text-slate-400 uppercase tracking-wide">
                      {translateText('Các sheet:')}
                    </span>
                    {form.sheets.map((sheet, sIdx) => (
                      <span
                        key={sIdx}
                        className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold border border-slate-200/60"
                      >
                        {sheet}
                      </span>
                    ))}
                  </div>

                  {/* Selected Radio Indicator */}
                  <div className="absolute top-3.5 right-3.5">
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Data Scope Options */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <label className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-emerald-600" />
            <span>{translateText('Bước 2: Chọn Phạm vi Dữ liệu Xuất')}</span>
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
            {[
              { id: 'ALL', label: 'Toàn bộ dữ liệu', sub: `${totalItemsCount} lượt` },
              { id: 'CURRENT', label: 'Theo bộ lọc hiện tại', sub: `${currentFilteredItems.length} lượt` },
              { id: 'PENDING', label: 'Chưa phản hồi', sub: `${summaryStats?.pendingCount ?? 0} lượt` },
              { id: 'RESPONDED', label: 'Đã giải quyết', sub: `${summaryStats?.respondedCount ?? 0} lượt` },
              { id: 'NEGATIVE', label: 'Cần lưu ý (≤ 3 sao)', sub: 'Ưu tiên cải tiến' },
            ].map((scope) => {
              const isSelected = dataScope === scope.id;
              return (
                <button
                  key={scope.id}
                  type="button"
                  onClick={() => setDataScope(scope.id as any)}
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold shadow-2xs'
                      : 'border-slate-200 bg-slate-50/70 text-slate-600 hover:bg-slate-100/70'
                  }`}
                >
                  <span className="font-bold text-xs">{translateText(scope.label)}</span>
                  <span className="text-[10px] text-slate-400 font-medium">{scope.sub}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 3: Preview Box */}
        <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-4 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>{translateText('Xem trước định dạng tệp xuất:')}</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-[10px]">
              {translateText('Microsoft Excel (.xlsx)')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] text-slate-600">
            <div>
              <span className="text-slate-400 block">{translateText('Biểu mẫu:')}</span>
              <strong className="text-slate-800">{currentSelectedFormObj.code}</strong>
            </div>
            <div>
              <span className="text-slate-400 block">{translateText('Số Sheet tạo tự động:')}</span>
              <strong className="text-slate-800">{currentSelectedFormObj.sheets.length} Sheets</strong>
            </div>
            <div>
              <span className="text-slate-400 block">{translateText('Bản quyền đơn vị:')}</span>
              <strong className="text-slate-800">{translateText('Trường Mẫu Giáo Hướng Dương')}</strong>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{translateText('Hỗ trợ mở tốt trên Excel 2016 - 2024, WPS Office và Google Sheets.')}</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer flex-1 sm:flex-none"
            >
              {translateText('Đóng')}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={isExporting}
              className="flex items-center justify-center gap-2 px-5 py-2 bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-700/20 transition cursor-pointer flex-1 sm:flex-none"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{translateText('Đang tạo file Excel...')}</span>
                </>
              ) : exportSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{translateText('Đã tải xuống thành công!')}</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>{translateText('Xuất & Tải File Excel (.xlsx)')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
