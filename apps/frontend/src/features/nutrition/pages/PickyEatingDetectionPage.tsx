import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Search,
  RefreshCw,
  Send,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronDown,
  TrendingDown,
  Utensils,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react';
import {
  nutritionAdviceApi,
  PickyEatingChildItem,
  PickyEatingDetectResponse,
  PickyEatingClassOption,
} from '../api/nutritionAdviceApi';
import { SendNutritionAdviceModal } from '../components/SendNutritionAdviceModal';

export const PickyEatingDetectionPage: React.FC = () => {
  const [data, setData] = useState<PickyEatingDetectResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [classId, setClassId] = useState<string>('ALL');

  // Modal State
  const [selectedChild, setSelectedChild] = useState<PickyEatingChildItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await nutritionAdviceApi.detectPickyEating(classId, search);
      setData(res);
    } catch (err) {
      console.error('Error detecting picky eating:', err);
    } finally {
      setIsLoading(false);
    }
  }, [classId, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenAdviceModal = (child: PickyEatingChildItem) => {
    setSelectedChild(child);
    setIsModalOpen(true);
  };

  const handleSuccess = () => {
    setToastMessage('Đã gửi phác đồ tư vấn dinh dưỡng tại nhà thành công đến tài khoản phụ huynh!');
    setTimeout(() => setToastMessage(null), 4500);
    loadData();
  };

  const summary = data?.summary || {
    totalDetected: 0,
    severeCount: 0,
    moderateCount: 0,
    mildCount: 0,
    advisedCount: 0,
    confirmedCount: 0,
  };

  const items = data?.items || [];
  const classesList: PickyEatingClassOption[] = data?.classes || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 pb-36 text-slate-800 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-900 text-xs font-bold flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 text-sm font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Can thiệp Dinh dưỡng Học đường</span>
            <span className="text-amber-400">•</span>
            <span className="normal-case font-medium">Viện Dinh Dưỡng Quốc Gia</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Phát Hiện Trẻ Kén Ăn &amp; Tư Vấn Bổ Sung Dinh Dưỡng Tại Nhà
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Phân tích tự động từ nhật ký ăn bán trú thực tế (bỏ bữa, ăn chậm, lượng ăn &lt; 50%) và phối hợp gửi phác đồ dinh dưỡng cho phụ huynh
          </p>
        </div>

        <button
          onClick={loadData}
          className="self-start sm:self-auto px-4 py-2.5 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition shadow-xs flex items-center gap-2 cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Làm mới phân tích</span>
        </button>
      </div>

      {/* 4 Thẻ KPI Thống kê chuẩn chỉnh */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between min-h-[105px]">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Tổng số trẻ kén ăn phát hiện</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-slate-900">{summary.totalDetected}</p>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Dựa trên 14 ngày ăn gần nhất</p>
          </div>
        </div>

        <div className="bg-rose-50/40 p-4 rounded-2xl border border-rose-200 shadow-xs flex flex-col justify-between min-h-[105px]">
          <div className="flex items-center justify-between text-xs font-bold text-rose-700">
            <span>Nguy cơ cao (Cần can thiệp)</span>
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-rose-700">{summary.severeCount}</p>
            <p className="text-[11px] text-rose-600 mt-0.5 font-medium">Ăn &lt; 25% hoặc bỏ bữa liên tiếp</p>
          </div>
        </div>

        <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-200 shadow-xs flex flex-col justify-between min-h-[105px]">
          <div className="flex items-center justify-between text-xs font-bold text-amber-700">
            <span>Mức độ vừa (Ăn chậm, kén rau)</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-amber-700">{summary.moderateCount}</p>
            <p className="text-[11px] text-amber-600 mt-0.5 font-medium">Ăn chậm, để thừa 50% khẩu phần</p>
          </div>
        </div>

        <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-200 shadow-xs flex flex-col justify-between min-h-[105px]">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
            <span>Đã gửi tư vấn tại nhà</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-emerald-800">{summary.advisedCount}</p>
            <p className="text-[11px] text-emerald-600 mt-0.5 font-medium">{summary.confirmedCount} phụ huynh đã xác nhận</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo tên học sinh hoặc mã học sinh..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs sm:text-sm pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none bg-slate-50/70 focus:bg-white transition"
          />
        </div>

        <div className="w-full sm:w-64 relative shrink-0">
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="w-full appearance-none text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none bg-slate-50/70 focus:bg-white font-semibold text-slate-700 pr-9 cursor-pointer transition"
          >
            <option value="ALL">Tất cả các lớp</option>
            {classesList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.ageGroup ? `(${c.ageGroup})` : ''}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Table Danh Sách Phát Hiện Trẻ Kén Ăn */}
      <div className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                <th className="py-4 px-4 min-w-[180px]">Học Sinh</th>
                <th className="py-4 px-3 min-w-[130px]">Lớp / Độ Tuổi</th>
                <th className="py-4 px-3 min-w-[160px]">Mức Độ Kén Ăn</th>
                <th className="py-4 px-4 min-w-[260px]">Triệu Chứng Ghi Nhận Tại Bữa Ăn</th>
                <th className="py-4 px-3 min-w-[120px]">Dị Ứng / Lưu Ý</th>
                <th className="py-4 px-3 min-w-[160px]">Trạng Thái Tư Vấn</th>
                <th className="py-4 px-4 min-w-[130px] text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-semibold">
                    {isLoading ? 'Đang phân tích dữ liệu thực từ PostgreSQL...' : 'Không phát hiện trẻ kén ăn nào theo bộ lọc.'}
                  </td>
                </tr>
              ) : (
                items.map((kid) => {
                  const isSevere = kid.severityLevel === 'SEVERE';
                  const isModerate = kid.severityLevel === 'MODERATE';

                  return (
                    <tr
                      key={kid.studentId}
                      className={`hover:bg-slate-50/80 transition ${
                        isSevere ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      {/* Học sinh */}
                      <td className="py-4 px-4 align-middle">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs ${
                              isSevere
                                ? 'bg-rose-100 text-rose-700 ring-2 ring-rose-200'
                                : 'bg-teal-100 text-teal-800 ring-2 ring-teal-200'
                            }`}
                          >
                            {kid.fullName.split(' ').slice(-1)[0][0]}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 leading-tight">{kid.fullName}</p>
                            <span className="text-[11px] text-slate-500 font-mono mt-0.5 inline-block">
                              {kid.studentCode}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Lớp / Tuổi */}
                      <td className="py-4 px-3 align-middle font-semibold text-slate-700">
                        <p className="leading-snug">{kid.className}</p>
                        <span className="text-[11px] text-slate-500 font-normal">{kid.ageLabel}</span>
                      </td>

                      {/* Mức độ kén ăn */}
                      <td className="py-4 px-3 align-middle">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              isSevere
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : isModerate
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            <TrendingDown className="w-3.5 h-3.5 shrink-0" />
                            <span>{kid.severityLabel}</span>
                          </span>
                          <p className="text-[11px] text-slate-500 font-medium">
                            Ăn TB: <strong className="text-slate-800">{kid.averageConsumptionRate}%</strong> khẩu phần
                          </p>
                        </div>
                      </td>

                      {/* Triệu chứng */}
                      <td className="py-4 px-4 align-middle">
                        <ul className="space-y-1 text-[11px] text-slate-600 font-medium">
                          {kid.pickySymptoms.slice(0, 2).map((sym, idx) => (
                            <li key={idx} className="flex items-start gap-1.5" title={sym}>
                              <span className="text-amber-500 shrink-0">•</span>
                              <span className="line-clamp-2">{sym}</span>
                            </li>
                          ))}
                        </ul>
                      </td>

                      {/* Dị ứng */}
                      <td className="py-4 px-3 align-middle">
                        {kid.allergies && kid.allergies.length > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-[11px] font-bold">
                            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                            <span>{kid.allergies.join(', ')}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">Không dị ứng</span>
                        )}
                      </td>

                      {/* Trạng thái tư vấn */}
                      <td className="py-4 px-3 align-middle">
                        {kid.adviceStatus === 'PARENT_CONFIRMED' ? (
                          <div>
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-100/80 border border-emerald-300 px-2.5 py-1 rounded-full">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>Đã phản hồi</span>
                            </span>
                            {kid.latestAdvice?.parentFeedback && (
                              <p
                                className="text-[10px] text-slate-600 italic mt-1 line-clamp-2 max-w-[160px] font-medium"
                                title={kid.latestAdvice.parentFeedback}
                              >
                                &ldquo;{kid.latestAdvice.parentFeedback}&rdquo;
                              </p>
                            )}
                          </div>
                        ) : kid.adviceStatus === 'SENT' ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-800 bg-amber-100/80 border border-amber-300 px-2.5 py-1 rounded-full">
                            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>Đã gửi tư vấn</span>
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-slate-400">
                            Chưa tư vấn
                          </span>
                        )}
                      </td>

                      {/* Thao tác */}
                      <td className="py-4 px-4 align-middle text-right">
                        <button
                          onClick={() => handleOpenAdviceModal(kid)}
                          className="whitespace-nowrap px-3.5 py-2 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{kid.adviceStatus !== 'NOT_SENT' ? 'Gửi phác đồ mới' : 'Soạn tư vấn'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Soạn Tư Vấn */}
      <SendNutritionAdviceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        child={selectedChild}
        onSuccess={handleSuccess}
      />
    </div>
  );
};
