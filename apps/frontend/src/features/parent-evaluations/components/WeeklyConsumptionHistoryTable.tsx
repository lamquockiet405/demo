import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState } from 'react';
import {
  History,
  CheckCircle2,
  User,
  Eye,
  X,
  Clock,
  Utensils,
  AlertCircle,
  MessageSquare,
} from 'lucide-react';
import { WeeklyConsumptionItem } from '../types';

interface WeeklyConsumptionHistoryTableProps {
  history?: WeeklyConsumptionItem[];
  childName?: string;
}

export const WeeklyConsumptionHistoryTable: React.FC<WeeklyConsumptionHistoryTableProps> = ({
  history = [],
  childName = '',
}) => {
  useLanguage();
  const [selectedDay, setSelectedDay] = useState<WeeklyConsumptionItem | null>(null);

  const getPercentageColor = (pct: number | null) => {
    if (pct === null) return 'bg-slate-300';
    if (pct >= 85) return 'bg-emerald-500';
    if (pct >= 50) return 'bg-teal-500';
    if (pct >= 25) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs mb-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center shrink-0">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              {translateText("Bảng Tổng Hợp Sức Ăn Cả Tuần")}{childName ? ` · ${childName}` : ''}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {translateText("Tỷ lệ ăn cả ngày chỉ hiển thị khi bé đã dùng đủ các buổi ăn trong ngày")}
            </p>
          </div>
        </div>

        <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
          {translateText("5 ngày học trong tuần")}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs parent-table">
          <thead className="bg-emerald-800 text-white">
            <tr className="border-b border-emerald-900/60 bg-emerald-800 text-white font-bold">
              <th className="py-3.5 px-3 rounded-l-xl text-white">{translateText("Ngày & Thứ")}</th>
              <th className="py-3.5 px-3 text-white">{translateText("Thực đơn bữa trưa")}</th>
              <th className="py-3.5 px-3 text-center text-white">{translateText("Tỷ lệ ăn")}</th>
              <th className="py-3.5 px-3 text-center text-white">{translateText("Mức độ")}</th>
              <th className="py-3.5 px-3 min-w-[200px] text-white">{translateText("Nhận xét của giáo viên")}</th>
              <th className="py-3.5 px-3 text-center text-white">{translateText("Trạng thái")}</th>
              <th className="py-3.5 px-3 text-center rounded-r-xl text-white">{translateText("Thao tác")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(Array.isArray(history) ? history : []).map((row) => {
              const isFull = Boolean(row.isAllSessionsDone && row.percentage !== null && row.percentage !== undefined);
              return (
                <tr key={row.date} className="hover:bg-slate-50/60 transition">
                  <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                    <div>{row.dayName}</div>
                    <div className="text-[11px] text-slate-400 font-normal">{translateText(row.dateFormatted)}</div>
                  </td>

                  <td className="py-3 px-3">
                    <p className="font-semibold text-slate-800 line-clamp-2 max-w-xs">{translateText(row.dishes)}</p>
                    <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200">
                      {translateText(row.badgeText)}
                    </span>
                  </td>

                  <td className="py-3 px-3 text-center">
                    {isFull ? (
                      <span className="font-black text-slate-900 text-sm">{row.percentage}%</span>
                    ) : (
                      <span
                        className="inline-block text-slate-400 font-bold text-sm tracking-widest cursor-help"
                        title={translateText("Tỷ lệ ăn sẽ hiển thị khi dùng đủ các buổi trong ngày")}
                      >
                        —
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-3 text-center">
                    {isFull ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>{translateText(row.portionLabel)}</span>
                      </span>
                    ) : (row.recordedSessionsCount ?? 0) > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                        <Clock className="w-3 h-3 text-amber-600" />
                        <span>{translateText(row.portionLabel || "Đang cập nhật")}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500">
                        {translateText("Chờ cập nhật")}
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-3 text-slate-700 italic">
                    <div className="flex items-start gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{row.teacherFeedback ? `“${row.teacherFeedback}”` : translateText('Chưa có nhận xét')}</span>
                    </div>
                  </td>

                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    {isFull ? (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        {translateText("Đã hoàn tất")}
                      </span>
                    ) : (row.recordedSessionsCount ?? 0) > 0 ? (
                      <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                        {translateText(`Đã cập nhật ${row.recordedSessionsCount}/${row.totalSessionsCount || 4} buổi`)}
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                        {translateText("Chờ xử lý")}
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setSelectedDay(row)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs border border-teal-200 shadow-2xs transition hover:scale-105 active:scale-95 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-teal-600" />
                      <span>{translateText("Xem chi tiết")}</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL CHI TIẾT SỨC ĂN TỪNG BUỔI */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-teal-50 via-teal-50/50 to-white border-b border-teal-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
                  <Utensils className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {translateText("Chi tiết sức ăn ngày")} {selectedDay.dayName} ({selectedDay.dateFormatted})
                  </h3>
                  <p className="text-xs text-slate-600 font-medium">
                    {translateText("Học sinh:")} <span className="font-bold text-teal-900">{childName || translateText("Bé")}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Tóm tắt tình trạng cả ngày */}
              {selectedDay.isAllSessionsDone && selectedDay.percentage !== null ? (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-emerald-900">
                        {translateText("Đã hoàn tất đủ 4/4 buổi ăn trong ngày")}
                      </h4>
                      <p className="text-xs text-emerald-700 mt-0.5">
                        {translateText("Giáo viên đã cập nhật đầy đủ sức ăn và điểm danh cho toàn bộ các buổi học.")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 bg-white px-3 py-1.5 rounded-xl border border-emerald-200 shadow-2xs">
                    <div className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider">
                      {translateText("Tỷ lệ ăn cả ngày")}
                    </div>
                    <div className="text-xl font-black text-emerald-900">
                      {selectedDay.percentage}%
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-amber-900">
                        {translateText("Chưa hoàn tất đủ các buổi trong ngày")}
                      </h4>
                      <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                        {translateText(`Đã cập nhật ${selectedDay.recordedSessionsCount || 0}/${selectedDay.totalSessionsCount || 4} buổi`)}
                      </span>
                    </div>
                    <p className="text-xs text-amber-800 mt-1">
                      {translateText("Tỷ lệ ăn cả ngày sẽ tự động tính toán và hiển thị khi giáo viên cập nhật đủ tất cả các buổi ăn trong ngày.")}
                    </p>
                  </div>
                </div>
              )}

              {/* Danh sách từng buổi ăn */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {translateText("Sức ăn chi tiết từng buổi do giáo viên cập nhật")}
                </h4>

                {(selectedDay.sessions && selectedDay.sessions.length > 0
                  ? selectedDay.sessions
                  : [
                    { mealType: 'BREAKFAST', mealLabel: 'Buổi sáng (09:00)', isRecorded: false, isAttended: false, consumptionLevel: null, consumptionLabel: 'Chưa cập nhật', percentage: null, note: '' },
                    { mealType: 'LUNCH', mealLabel: 'Bữa trưa chính (11:00)', isRecorded: false, isAttended: false, consumptionLevel: null, consumptionLabel: 'Chưa cập nhật', percentage: null, note: '' },
                    { mealType: 'AFTERNOON_SNACK', mealLabel: 'Buổi phụ (14:30)', isRecorded: false, isAttended: false, consumptionLevel: null, consumptionLabel: 'Chưa cập nhật', percentage: null, note: '' },
                    { mealType: 'LATE_SNACK', mealLabel: 'Buổi xế chiều (17:00)', isRecorded: false, isAttended: false, consumptionLevel: null, consumptionLabel: 'Chưa cập nhật', percentage: null, note: '' },
                  ]
                ).map((sess, idx) => {
                  return (
                    <div
                      key={sess.mealType || idx}
                      className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition shadow-2xs"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                          <span className="font-bold text-slate-900 text-sm">
                            {translateText(sess.mealLabel)}
                          </span>
                        </div>
                        <div>
                          {!sess.isRecorded ? (
                            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                              {translateText("Chưa cập nhật")}
                            </span>
                          ) : !sess.isAttended ? (
                            <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                              {translateText("Vắng mặt")}
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              {translateText("Đã cập nhật")}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {/* Sức ăn */}
                        <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100">
                          <div className="text-[11px] font-bold text-slate-500 mb-1">
                            {translateText("Sức ăn thực tế:")}
                          </div>
                          {sess.isRecorded ? (
                            sess.isAttended ? (
                              <div>
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="font-bold text-slate-900">
                                    {translateText(sess.consumptionLabel)}
                                  </span>
                                  {sess.percentage !== null && (
                                    <span className="font-black text-teal-800">
                                      {sess.percentage}%
                                    </span>
                                  )}
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                  <div
                                    className={`h-2 rounded-full transition-all duration-300 ${getPercentageColor(sess.percentage)}`}
                                    style={{ width: `${Math.min(100, sess.percentage ?? 0)}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="text-rose-600 font-medium">
                                {translateText("Bé nghỉ học / không ăn buổi này")}
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400 italic">
                              {translateText("Giáo viên chưa cập nhật sau bữa ăn")}
                            </span>
                          )}
                        </div>

                        {/* Ghi chú nhận xét của giáo viên */}
                        <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100">
                          <div className="text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                            <MessageSquare className="w-3 h-3 text-slate-400" />
                            <span>{translateText("Nhận xét của giáo viên:")}</span>
                          </div>
                          {sess.note ? (
                            <p className="font-medium text-slate-800 italic">
                              “{sess.note}”
                            </p>
                          ) : (
                            <p className="text-slate-400 italic">
                              {translateText("Chưa có ghi chú riêng cho buổi này")}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition cursor-pointer"
              >
                {translateText("Đóng")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
