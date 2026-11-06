import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { schoolDate } from "../../menus/utils/published-menus";
import React, { useState, useEffect, useCallback } from "react";
import {
  UtensilsCrossed,
  ChefHat,
  Users,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  Eye,
  Calendar,
  RotateCcw,
  FileSpreadsheet,
  Building2,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  X,
  Loader2,
} from "lucide-react";
import { attendanceApi } from "../api/attendanceApi";
import { AttendanceResponse, ChildAttendanceItem } from "../types";

interface ClassSummaryItem {
  id: string;
  name: string;
  gradeLevel: string;
  gradeName: string;
  roomNumber: string;
  homeroomTeacher: string;
  enrolled: number;
  maxCapacity: number;
  occupancyPercent: number;
  presentToday: number;
  attendanceRate: number;
  absentToday: number;
  lunchCount: number;
  standardPortions: number;
  snackCount: number;
  allergicCount: number;
  isKitchenLocked: boolean;
}

interface SchoolSummaryData {
  date: string;
  totalEnrolled: number;
  totalPresent: number;
  totalAbsent: number;
  totalLunch: number;
  totalSnack: number;
  totalAllergic: number;
  standardPortions: number;
  lockedClassesCount: number;
  totalClassesCount: number;
  completionPercentage: number;
  classes: ClassSummaryItem[];
}

export const BghMealPortionsOverviewPage: React.FC = () => {
  useLanguage();
  const [selectedDate, setSelectedDate] = useState<string>(schoolDate);
  const [data, setData] = useState<SchoolSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Detail Modal States
  const [selectedClass, setSelectedClass] = useState<ClassSummaryItem | null>(
    null,
  );
  const [classDetailData, setClassDetailData] =
    useState<AttendanceResponse | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);

  // Load summary data from PostgreSQL
  const loadSummary = useCallback(async () => {
    setIsLoading(true);
    try {
      const res: any =
        await attendanceApi.getSchoolHeadcountSummary(selectedDate);
      setData(res?.data || res);
    } catch (err) {
      console.error("Lỗi khi tải tổng hợp suất ăn toàn trường:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // Handle drill-down: open class detail modal
  const handleOpenClassDetail = async (cls: ClassSummaryItem) => {
    setSelectedClass(cls);
    setIsDetailLoading(true);
    try {
      const detail = await attendanceApi.getAttendanceList({
        classId: cls.id,
        date: selectedDate,
      });
      setClassDetailData(detail);
    } catch (err) {
      console.error("Lỗi khi xem chi tiết lớp:", err);
    } finally {
      setIsDetailLoading(false);
    }
  };

  // Handle Admin Override: Lock / Unlock class
  const handleToggleClassLock = async (cls: ClassSummaryItem) => {
    const nextLocked = !cls.isKitchenLocked;
    try {
      await attendanceApi.lockAndSendToKitchen({
        classId: cls.id,
        date: selectedDate,
        isLocked: nextLocked,
        notes: nextLocked
          ? "Ban Giám Hiệu xác nhận chốt số suất ăn gửi Bếp"
          : "Ban Giám Hiệu mở khóa cho giáo viên điều chỉnh số liệu",
      });

      setToastMessage(
        nextLocked
          ? `Đã khóa sổ ${cls.name} gửi sang Bếp thành công!`
          : `Đã mở khóa ${cls.name} cho giáo viên điều chỉnh!`,
      );
      setTimeout(() => setToastMessage(null), 3500);
      loadSummary();
    } catch (err) {
      console.error("Lỗi khi đổi trạng thái khóa:", err);
      alert(translateText("Không thể cập nhật trạng thái khóa. Vui lòng thử lại!"));
    }
  };

  // Export to CSV for kitchen warehouse
  const handleExportCsv = () => {
    if (!data?.classes || data.classes.length === 0) return;
    const headers = [
      "STT",
      "Lớp học",
      "Khối",
      "Giáo viên phụ trách",
      "Sĩ số",
      "Đăng ký ăn trưa",
      "Suất trưa chuẩn",
      "Khay dị ứng",
      "Suất ăn xế",
      "Học sinh nghỉ",
      "Trạng thái gửi Bếp",
    ];

    const rows = data.classes.map((c, idx) => [
      idx + 1,
      `"${c.name}"`,
      `"${c.gradeName}"`,
      `"${c.homeroomTeacher}"`,
      c.enrolled,
      c.lunchCount,
      c.standardPortions,
      c.allergicCount,
      c.snackCount,
      c.absentToday,
      c.isKitchenLocked ? '"Đã khóa gửi Bếp"' : '"Chưa khóa"',
    ]);

    const csvContent =
      "\uFEFF" +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `Ke_Hoach_Suat_An_Toan_Truong_${selectedDate}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 w-full pb-12 font-sans antialiased text-slate-800">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-700 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 font-semibold text-xs border border-emerald-500">
          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
          <span>{translateText(toastMessage)}</span>
        </div>
      )}

      {/* 1. Header Toolbar */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
              <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" />{translateText("CỔNG BAN GIÁM HIỆU • ĐIỀU HÀNH BÁN TRÚ")}</span>
            <span className="text-xs text-slate-500 font-medium">{translateText("Hạn chốt gửi Bếp: 08:45 hàng ngày")}</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{translateText("Kế hoạch Định lượng Suất ăn Bán trú Toàn trường")}</h1>
          <p className="text-xs text-slate-500 mt-1">{translateText("Tổng hợp dữ liệu báo suất ăn từ Giáo viên các lớp gửi xuống Bếp trung tâm • Giám sát tiến độ chốt sổ chuẩn ATTP.")}</p>
        </div>

        {/* Date Selector & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2 shadow-inner">
            <Calendar className="w-4 h-4 text-teal-700" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={loadSummary}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs transition"
            title={translateText("Làm mới dữ liệu từ cơ sở dữ liệu")}
          >
            <RotateCcw
              className={`w-3.5 h-3.5 text-teal-600 ${isLoading ? "animate-spin" : ""}`}
            />
            <span>{translateText("Làm mới")}</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/25 transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{translateText("Xuất báo cáo Bếp")}</span>
          </button>
        </div>
      </div>

      {/* 2. Top 5 KPI Cards (Toàn trường) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Tổng Suất Trưa Chuẩn */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider">
            <span>{translateText("SUẤT TRƯA CHUẨN")}</span>
            <span className="p-1.5 bg-teal-50 text-teal-700 rounded-xl">
              <UtensilsCrossed className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-teal-700">
              {data?.standardPortions ?? 0}
            </span>
            <span className="text-xs font-bold text-slate-400">{translateText("suất nấu")}</span>
          </div>
          <p className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">{translateText("Tổng đăng ký trưa: ")}<strong>{data?.totalLunch ?? 0}</strong>{translateText(" trẻ")}</p>
        </div>

        {/* Card 2: Tổng Suất Ăn Xế */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider">
            <span>{translateText("SUẤT ĂN XẾ CHIỀU")}</span>
            <span className="p-1.5 bg-amber-50 text-amber-700 rounded-xl">
              <ChefHat className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-600">
              {data?.totalSnack ?? 0}
            </span>
            <span className="text-xs font-bold text-slate-400">{translateText("suất xế")}</span>
          </div>
          <p className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">{translateText("Phục vụ vào lúc ")}<strong>14:30</strong>
          </p>
        </div>

        {/* Card 3: Khay Dị Ứng Riêng Biệt */}
        <div className="bg-white rounded-2xl p-4 border border-red-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-red-600 text-[11px] font-bold uppercase tracking-wider">
            <span>{translateText("KHAY DỊ ỨNG RIÊNG")}</span>
            <span className="p-1.5 bg-red-50 text-red-600 rounded-xl">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-red-600">
              {data?.totalAllergic ?? 0}
            </span>
            <span className="text-xs font-bold text-slate-400">{translateText("khay riêng")}</span>
          </div>
          <p className="mt-2 pt-2 border-t border-red-100 text-[11px] text-red-600 font-semibold">{translateText("Bếp dán nhãn nhận diện riêng")}</p>
        </div>

        {/* Card 4: Học Sinh Nghỉ Hôm Nay */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider">
            <span>{translateText("HỌC SINH NGHỈ HÔM NAY")}</span>
            <span className="p-1.5 bg-rose-50 text-rose-600 rounded-xl">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-600">
              {data?.totalAbsent ?? 0}
            </span>
            <span className="text-xs font-bold text-slate-400">{translateText("bé vắng")}</span>
          </div>
          <p className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-emerald-600 font-semibold">{translateText("✓ Đã trừ khỏi định lượng kho")}</p>
        </div>

        {/* Card 5: Tiến Độ Khóa Sổ Báo Bếp */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider">
            <span>{translateText("TIẾN ĐỘ BÁO BẾP")}</span>
            <span className="p-1.5 bg-teal-50 text-teal-700 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">
              {data?.lockedClassesCount ?? 0}/{data?.totalClassesCount ?? 6}
            </span>
            <span className="text-xs font-bold text-slate-400">{translateText("lớp đã khóa")}</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100">
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-teal-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${data?.completionPercentage ?? 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Table: Ma Trận Giám Sát Suất Ăn 6 Lớp Học */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-slate-900">{translateText("Bảng Tổng Hợp Kế Hoạch Suất Ăn Theo Lớp")}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{translateText("Theo dõi dữ liệu thực tế từ cơ sở dữ liệu PostgreSQL • Bấm nút thao tác để xem chi tiết học sinh hoặc mở khóa điều chỉnh.")}</p>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">{translateText("Tổng cộng: ")}{data?.classes?.length ?? 6}{translateText(" lớp học")}</span>
        </div>

        {isLoading ? (
          <div className="p-16 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto" />
            <p className="text-xs font-bold text-slate-500">{translateText("Đang tải dữ liệu suất ăn từ cơ sở dữ liệu...")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">{translateText("Lớp Học")}</th>
                  <th className="py-3.5 px-4">{translateText("Giáo Viên Phụ Trách")}</th>
                  <th className="py-3.5 px-3 text-center">{translateText("Sĩ Số")}</th>
                  <th className="py-3.5 px-3 text-center">{translateText("Đăng Ký Ăn")}</th>
                  <th className="py-3.5 px-3 text-center text-teal-700">{translateText("Suất Chuẩn")}</th>
                  <th className="py-3.5 px-3 text-center text-red-600">{translateText("Khay Dị Ứng")}</th>
                  <th className="py-3.5 px-3 text-center text-amber-700">{translateText("Suất Xế")}</th>
                  <th className="py-3.5 px-3 text-center text-rose-600">{translateText("Nghỉ Học")}</th>
                  <th className="py-3.5 px-4 text-center">{translateText("Trạng Thái Bếp")}</th>
                  <th className="py-3.5 px-4 text-center">{translateText("Thao Tác BGH")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.classes.map((cls) => {
                  const isLocked = cls.isKitchenLocked;
                  return (
                    <tr
                      key={cls.id}
                      className="hover:bg-teal-50/20 transition group"
                    >
                      {/* Lớp Học */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center font-bold text-teal-800 text-xs shrink-0">
                            {cls.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block leading-tight">
                              {cls.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {cls.gradeName} • {translateText(cls.roomNumber)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Giáo Viên Phụ Trách */}
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-700">
                          {translateText(cls.homeroomTeacher)}
                        </span>
                      </td>

                      {/* Sĩ Số */}
                      <td className="py-3.5 px-3 text-center font-bold text-slate-800">
                        {cls.enrolled}
                      </td>

                      {/* Đăng Ký Ăn */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="inline-flex px-2 py-0.5 rounded-lg font-extrabold text-xs bg-slate-100 text-slate-800">
                          {cls.lunchCount}
                        </span>
                      </td>

                      {/* Suất Chuẩn */}
                      <td className="py-3.5 px-3 text-center font-black text-teal-700 text-sm">
                        {cls.standardPortions}
                      </td>

                      {/* Khay Dị Ứng */}
                      <td className="py-3.5 px-3 text-center">
                        {cls.allergicCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-red-50 text-red-600 border border-red-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                            {cls.allergicCount}{translateText(" khay")}</span>
                        ) : (
                          <span className="text-slate-400 text-xs font-medium">
                            0
                          </span>
                        )}
                      </td>

                      {/* Suất Xế */}
                      <td className="py-3.5 px-3 text-center font-black text-amber-700 text-sm">
                        {cls.snackCount}
                      </td>

                      {/* Nghỉ Học */}
                      <td className="py-3.5 px-3 text-center">
                        {cls.absentToday > 0 ? (
                          <span className="inline-flex px-2 py-0.5 rounded-lg font-bold text-xs bg-rose-50 text-rose-600">
                            {cls.absentToday}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs font-medium">
                            0
                          </span>
                        )}
                      </td>

                      {/* Trạng Thái Gửi Bếp */}
                      <td className="py-3.5 px-4 text-center">
                        {isLocked ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{translateText("Đã khóa gửi Bếp")}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>{translateText("Đang điểm danh")}</span>
                          </span>
                        )}
                      </td>

                      {/* Thao Tác BGH */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenClassDetail(cls)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-700 border border-slate-200 transition"
                            title={translateText("Xem danh sách chi tiết học sinh lớp này")}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{translateText("Xem chi tiết")}</span>
                          </button>

                          <button
                            onClick={() => handleToggleClassLock(cls)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition border ${
                              isLocked
                                ? "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200"
                                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200"
                            }`}
                            title={
                              translateText(isLocked
                                ? "Mở khóa cho giáo viên điều chỉnh bổ sung"
                                : "Đặc cách khóa sổ suất ăn gửi Bếp")
                            }
                          >
                            {isLocked ? (
                              <>
                                <Unlock className="w-3.5 h-3.5" />
                                <span>{translateText("Mở khóa")}</span>
                              </>
                            ) : (
                              <>
                                <Lock className="w-3.5 h-3.5" />
                                <span>{translateText("Khóa gửi Bếp")}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Drill-Down Modal: Danh sách học sinh chi tiết của lớp */}
      {selectedClass && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-black text-sm shadow-md">
                  {selectedClass.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">{translateText("Danh Sách Báo Suất Ăn: ")}{selectedClass.name}
                  </h3>
                  <p className="text-xs text-slate-500">{translateText("Giáo viên phụ trách:")}{" "}
                    <strong>{translateText(selectedClass.homeroomTeacher)}</strong>{translateText(" • Ngày:")}{" "}
                    {translateText(selectedDate)}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedClass(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              {isDetailLoading ? (
                <div className="p-12 text-center space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-teal-600 mx-auto" />
                  <p className="text-xs font-medium text-slate-500">{translateText("Đang tải danh sách học sinh của lớp...")}</p>
                </div>
              ) : classDetailData?.children &&
                classDetailData.children.length > 0 ? (
                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                        <th className="py-2.5 px-3">{translateText("STT")}</th>
                        <th className="py-2.5 px-3">{translateText("Họ và Tên Bé")}</th>
                        <th className="py-2.5 px-3 text-center">{translateText("Đăng Ký Ăn")}</th>
                        <th className="py-2.5 px-3">{translateText("Cảnh Báo Dị Ứng")}</th>
                        <th className="py-2.5 px-3">{translateText("Ghi Chú Phụ Huynh / Cô")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {classDetailData.children.map((child, idx) => (
                        <tr key={child.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 font-semibold text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {child.fullName}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                                child.mealOption === "ALL_DAY"
                                  ? "bg-teal-50 text-teal-800"
                                  : child.mealOption === "LUNCH_ONLY"
                                    ? "bg-sky-50 text-sky-800"
                                    : child.mealOption === "SNACK_ONLY"
                                      ? "bg-amber-50 text-amber-800"
                                      : "bg-rose-50 text-rose-700"
                              }`}
                            >
                              {translateText(child.mealOption === "ALL_DAY"
                                ? "Cả ngày (Trưa + Xế)"
                                : child.mealOption === "LUNCH_ONLY"
                                  ? "Chỉ ăn trưa"
                                  : child.mealOption === "SNACK_ONLY"
                                    ? "Chỉ ăn xế"
                                    : "Nghỉ học")}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            {child.dietBadge?.type === "ALLERGY" ? (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700 border border-red-200">
                                ⚠ {translateText(child.dietBadge.title || "Có dị ứng")}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">{translateText("Bình thường")}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 italic">
                            {child.parentNote || translateText("Không có ghi chú")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400">{translateText("Lớp này chưa có dữ liệu học sinh điểm danh trong ngày đã chọn.")}</div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/60 text-xs">
              <span className="text-slate-500 font-medium">{translateText("Trạng thái:")}{" "}
                <strong>
                  {translateText(selectedClass.isKitchenLocked
                    ? "Đã khóa gửi Bếp"
                    : "Chưa khóa")}
                </strong>
              </span>
              <button
                onClick={() => setSelectedClass(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition"
              >{translateText("Đóng")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
