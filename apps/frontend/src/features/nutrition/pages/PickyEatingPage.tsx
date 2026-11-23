import { t as translateText, getLocale } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { downloadExcel } from '../../../core/utils/excel-export';
import {
  nutritionAdviceApi,
  PickyEatingChildItem,
} from "../api/nutritionAdviceApi";
import { TeacherStatsOverview } from "../../teacher/components/TeacherStatsOverview";
import {
  UtensilsCrossed,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Send,
  Sparkles,
  HeartPulse,
  Baby,
  ShieldAlert,
  MessageSquare,
  FileText,
  User,
  Phone,
  Calendar,
  X,
  ChevronRight,
  TrendingDown,
  Info,
  FileSpreadsheet,
} from "lucide-react";
import {
  Feedback,
  Modal,
  State,
  useSchoolAction,
  useSchoolResource,
} from "../../school/components/SchoolUI";

const TEMPLATE_SUGGESTIONS = [
  {
    title: "Tăng cường kẽm & kích thích vị giác tự nhiên",
    advice:
      "Gia đình nên bổ sung thực phẩm giàu kẽm tự nhiên như lòng đỏ trứng, hạt bí ngô nghiền nhỏ, đậu lăng. Cho trẻ ăn đúng giờ, không ép ăn khi trẻ kháng cự, tạo tâm lý vui vẻ trong bữa ăn.",
    dishes: "Cháo tôm bí đỏ hạt sen\nSinh tố bơ chuối sữa chua\nCanh thịt bằm nấu rau ngót",
  },
  {
    title: "Tập làm quen rau củ bằng phương pháp gián tiếp",
    advice:
      "Bé có biểu hiện từ chối rau xanh dạng sợi thô. Khuyến nghị ba mẹ xay nhuyễn rau củ vào nước dùng, sốt mì Ý hoặc làm chả trứng rau củ đầy màu sắc bắt mắt để trẻ hào hứng khám phá.",
    dishes: "Trứng cuộn ngũ sắc (cà rốt, đậu cô ve)\nMì Ý sốt bò bằm rau củ\nSúp kem bí đỏ thịt gà",
  },
  {
    title: "Chia nhỏ bữa ăn và bổ sung năng lượng cao",
    advice:
      "Trẻ có dung tích dạ dày nhỏ và ăn chậm. Khuyến khích chia thành 5 bữa nhỏ trong ngày: 3 bữa chính vừa phải và 2 cữ phụ giàu năng lượng, uống nước cách xa bữa chính 30 phút.",
    dishes: "Sữa hạt sen macca tự nấu\nBánh flan caramen ít đường\nCháo lươn khoai môn nghiền",
  },
];

const stripParens = (text?: string | null) =>
  String(text || "")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s*\[[^\]]*\]\s*/g, "")
    .trim();

export function PickyEatingPage() {
  useLanguage();
  const isTeacherPortal = useLocation().pathname.startsWith("/teacher/");
  const [classId, setClassId] = useState("");
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [adviceStatusFilter, setAdviceStatusFilter] = useState("ALL");
  const [selected, setSelected] = useState<PickyEatingChildItem | null>(null);

  const [title, setTitle] = useState("");
  const [advice, setAdvice] = useState("");
  const [dishes, setDishes] = useState("");
  const [micronutrients, setMicronutrients] = useState<string[]>([]);

  const resource = useSchoolResource(
    () => nutritionAdviceApi.detectPickyEating(classId, search),
    [classId, search],
  );
  const action = useSchoolAction();

  const allRows = useMemo(() => {
    return resource.error ? [] : resource.data?.items || [];
  }, [resource.error, resource.data?.items]);

  const summary = resource.data?.summary || {
    totalDetected: allRows.length,
    severeCount: allRows.filter((r) => r.severityLevel === "SEVERE").length,
    moderateCount: allRows.filter((r) => r.severityLevel === "MODERATE").length,
    mildCount: allRows.filter((r) => r.severityLevel === "MILD").length,
    advisedCount: allRows.filter((r) => r.adviceStatus !== "NOT_SENT").length,
    confirmedCount: allRows.filter((r) => r.adviceStatus === "PARENT_CONFIRMED").length,
  };

  const filteredRows = useMemo(() => {
    return allRows.filter((r) => {
      if (severityFilter !== "ALL" && r.severityLevel !== severityFilter) {
        return false;
      }
      if (adviceStatusFilter !== "ALL" && r.adviceStatus !== adviceStatusFilter) {
        return false;
      }
      return true;
    });
  }, [allRows, severityFilter, adviceStatusFilter]);

  const history = useSchoolResource(
    () => nutritionAdviceApi.getHistory(selected?.studentId),
    [selected?.studentId],
  );

  const openModal = (child: PickyEatingChildItem) => {
    setSelected(child);
    setTitle(
      child.latestAdvice?.adviceTitle ||
        child.suggestedAdviceTitle ||
        `Tư vấn chế độ dinh dưỡng hỗ trợ bé ${child.fullName}`,
    );
    setAdvice(
      child.latestAdvice?.homeSupplementAdvice ||
        child.suggestedHomeAdvice ||
        "",
    );
    setDishes((child.recommendedDishes || []).join("\n"));
    setMicronutrients(child.micronutrientsFocus || ["Kẽm", "Chất xơ"]);
  };

  const applyTemplate = (tpl: typeof TEMPLATE_SUGGESTIONS[0]) => {
    setTitle(tpl.title);
    setAdvice(tpl.advice);
    setDishes(tpl.dishes);
  };

  const handleExportExcel = async () => {
    if (!filteredRows.length) return alert(translateText("Chưa có danh sách trẻ kén ăn để xuất Excel."));
    await downloadExcel(
      `Theo_doi_tre_ken_an_${new Date().toISOString().slice(0, 10)}.xlsx`,
      [
        ["Mã học sinh", "Họ và tên", "Lớp", "Mức độ kén ăn", "Tỷ lệ ăn trung bình", "Nhóm thực phẩm từ chối", "Trạng thái tư vấn"],
        ...filteredRows.map(c => [
          c.studentCode || '',
          c.fullName || '',
          c.className || '',
          c.severityLevel === 'SEVERE' ? 'Nghiêm trọng' : c.severityLevel === 'MODERATE' ? 'Trung bình' : 'Nhẹ',
          `${c.averageConsumptionRate ?? 0}%`,
          (c.rejectedFoodCategories || []).join(', ') || 'Chưa phân loại',
          c.adviceStatus === 'PARENT_CONFIRMED' ? 'Phụ huynh đã xác nhận' : c.adviceStatus === 'SENT' ? 'Đã gửi tư vấn' : 'Chưa gửi tư vấn',
        ]),
      ],
      "Trẻ kén ăn"
    );
  };

  const toggleMicronutrient = (nutrient: string) => {
    setMicronutrients((prev) =>
      prev.includes(nutrient)
        ? prev.filter((n) => n !== nutrient)
        : [...prev, nutrient],
    );
  };

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    void action.run(async () => {
      if (!selected || !title.trim() || !advice.trim()) {
        throw new Error("Vui lòng nhập đầy đủ tiêu đề và nội dung tư vấn.");
      }
      const response = await nutritionAdviceApi.sendAdvice({
        studentId: selected.studentId,
        severityLevel: selected.severityLevel,
        adviceTitle: title.trim(),
        homeSupplementAdvice: advice.trim(),
        pickySymptoms: selected.pickySymptoms,
        micronutrientsFocus: micronutrients,
        recommendedDishes: dishes
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      if (response?.success === false) {
        throw new Error(response.message || "Chưa gửi được tư vấn.");
      }
      await resource.reload();
      await history.reload();
      setSelected(null);
    }, "Đã lưu tư vấn dinh dưỡng và gửi thông báo tới phụ huynh thành công.");
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Action Toolbar */}
      <div className="flex justify-end">
        <button
          onClick={() => resource.reload()}
          disabled={resource.loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 text-xs font-bold shadow-2xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${resource.loading ? "animate-spin text-teal-600" : "text-slate-500"}`} />
          {translateText("Phân tích lại")}
        </button>
      </div>

      {/* KPI Stats */}
      {isTeacherPortal ? (
        <TeacherStatsOverview />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{translateText("Trẻ kén ăn")}</span>
              <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
                <Baby className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-black text-slate-800">
              {summary.totalDetected}
            </div>
            <p className="text-xs text-slate-400 mt-1">{translateText("Được phát hiện từ bữa ăn")}</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-rose-600 uppercase tracking-wide">{translateText("Cần can thiệp gấp")}</span>
              <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-black text-rose-600">
              {summary.severeCount}
            </div>
            <p className="text-xs text-rose-500 mt-1">{translateText("Bỏ cữ liên tục & ăn < 30%")}</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">{translateText("Theo dõi vừa & nhẹ")}</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-black text-amber-600">
              {summary.moderateCount + summary.mildCount}
            </div>
            <p className="text-xs text-amber-500 mt-1">{translateText("Kén rau, thịt hoặc ăn chậm")}</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">{translateText("Phụ huynh xác nhận")}</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-black text-emerald-600">
              {summary.confirmedCount} / {summary.totalDetected || 1}
            </div>
            <p className="text-xs text-emerald-600 mt-1">{translateText("Đã tiếp nhận phác đồ")}</p>
          </div>
        </div>
      )}

      <Feedback error={action.error} message={action.message} />

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            placeholder={translateText("Tìm theo tên học sinh, mã hồ sơ...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
          >
            <option value="">{translateText("Tất cả các lớp")}</option>
            {(resource.data?.classes || []).map((c) => (
              <option key={c.id} value={c.id}>
                {stripParens(c.name)}
              </option>
            ))}
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
          >
            <option value="ALL">{translateText("Tất cả mức độ")}</option>
            <option value="SEVERE">{translateText("Nguy cơ cao")}</option>
            <option value="MODERATE">{translateText("Trung bình")}</option>
            <option value="MILD">{translateText("Nhẹ")}</option>
          </select>

          <select
            value={adviceStatusFilter}
            onChange={(e) => setAdviceStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
          >
            <option value="ALL">{translateText("Tất cả trạng thái tư vấn")}</option>
            <option value="NOT_SENT">{translateText("Chưa gửi tư vấn")}</option>
            <option value="SENT">{translateText("Đã gửi tư vấn")}</option>
            <option value="PARENT_CONFIRMED">{translateText("Phụ huynh đã xác nhận")}</option>
          </select>

          <button
            type="button"
            className="px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition cursor-pointer flex items-center gap-1.5"
            onClick={() => void resource.reload()}
            disabled={resource.loading}
            title={translateText("Làm mới danh sách")}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${resource.loading ? "animate-spin" : "text-slate-500"}`} />
            <span>{translateText("Làm mới")}</span>
          </button>

          <button
            type="button"
            className="px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition cursor-pointer flex items-center gap-1.5"
            disabled={!filteredRows.length}
            onClick={() => void handleExportExcel()}
            title={translateText("Xuất danh sách trẻ kén ăn ra Excel")}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>{translateText("Xuất Excel")}</span>
          </button>
        </div>
      </div>

      <State resource={resource} empty={!allRows.length} />

      {/* Table List of Children */}
      {filteredRows.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/95 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">{translateText("Học sinh & Lớp")}</th>
                  <th className="py-3 px-3 text-center">{translateText("Mức độ")}</th>
                  <th className="py-3 px-4 min-w-[190px]">{translateText("Lượng ăn trung bình")}</th>
                  <th className="py-3 px-4 min-w-[280px]">{translateText("Dấu hiệu kén ăn & Lưu ý")}</th>
                  <th className="py-3 px-3 text-center">{translateText("Trạng thái tư vấn")}</th>
                  <th className="py-3 px-4 text-right">{translateText("Thao tác")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredRows.map((child, idx) => {
                  const isSevere = child.severityLevel === "SEVERE";
                  const isModerate = child.severityLevel === "MODERATE";
                  const consumption = child.averageConsumptionRate ?? 50;
                  const cleanClass = stripParens(child.className);
                  const cleanSeverity =
                    stripParens(child.severityLabel) ||
                    (isSevere ? "Nguy cơ cao" : isModerate ? "Trung bình" : "Nhẹ");

                  return (
                    <tr
                      key={child.studentId}
                      className="hover:bg-slate-50/80 transition align-middle"
                    >
                      <td className="py-3.5 px-4 text-center font-bold text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Học sinh & Lớp */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-teal-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {child.fullName.charAt(0)}
                          </div>
                          <div>
                            <strong className="font-bold text-slate-900 block text-xs">
                              {child.fullName}
                            </strong>
                            <span className="text-slate-500 font-medium text-[11px] block mt-0.5">
                              {child.studentCode}
                              {cleanClass ? ` · ${cleanClass}` : ""}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Mức độ */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isSevere
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : isModerate
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}
                        >
                          {translateText(cleanSeverity)}
                        </span>
                      </td>

                      {/* Lượng ăn trung bình */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1.5 max-w-[180px]">
                          <div className="flex items-center justify-between text-[11px]">
                            <strong className="text-slate-800 font-black">{consumption}%</strong>
                            <span className="text-rose-600 font-semibold">
                              {child.lowIntakeMealsCount}/{child.totalMealsTracked}{" "}
                              {translateText("bữa ăn ít")}
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                consumption < 40
                                  ? "bg-rose-500"
                                  : consumption < 70
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                              }`}
                              style={{ width: `${Math.min(100, Math.max(5, consumption))}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Dấu hiệu kén ăn & Lưu ý */}
                      <td className="py-3.5 px-4 max-w-sm">
                        <div className="space-y-1">
                          {child.pickySymptoms?.length > 0 ? (
                            child.pickySymptoms.map((sym, i) => (
                              <div
                                key={i}
                                className="flex items-start gap-1.5 text-[11.5px] text-slate-700 leading-snug"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0 mt-1.5" />
                                <span className="line-clamp-1">{translateText(stripParens(sym))}</span>
                              </div>
                            ))
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">
                              {translateText("Chưa có ghi nhận chi tiết")}
                            </span>
                          )}

                          {child.allergies?.length > 0 && (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-[10.5px] font-bold">
                              <ShieldAlert className="w-3 h-3 text-rose-600 shrink-0" />
                              <span>
                                {translateText("Dị ứng:")} {child.allergies.join(", ")}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Trạng thái tư vấn */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex flex-col items-center gap-0.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              child.adviceStatus === "PARENT_CONFIRMED"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : child.adviceStatus === "SENT"
                                  ? "bg-teal-50 text-teal-700 border border-teal-200"
                                  : "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}
                          >
                            {translateText(child.adviceStatusLabel || "Chưa gửi tư vấn")}
                          </span>
                          {child.latestAdvice?.adviceDate && (
                            <span className="text-[10.5px] text-slate-400">
                              {child.latestAdvice.adviceDate}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Thao tác */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openModal(child)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                            child.latestAdvice
                              ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                              : "bg-teal-600 hover:bg-teal-700 text-white shadow-2xs"
                          }`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>
                            {translateText(
                              child.latestAdvice ? "Cập nhật tư vấn" : "Soạn tư vấn",
                            )}
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center max-w-xl mx-auto shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-4 shadow-inner">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">{translateText("Không có trẻ nào có biểu hiện kén ăn cần can thiệp")}</h3>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">{translateText("Chưa có hồ sơ cần tư vấn trong bộ lọc hiện tại.")}</p>
        </div>
      )}

      {/* Consultation Modal */}
      {selected && (
        <Modal
          title={translateText(`Tư vấn dinh dưỡng · ${selected.fullName}`)}
          onClose={() => setSelected(null)}
          busy={action.busy}
        >
          <div className="space-y-6">
            {/* Child Profile Highlight */}
            <div className="bg-slate-50 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-600 text-white font-bold flex items-center justify-center">
                  {selected.fullName.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-slate-800">{selected.fullName}</h4>
                  <p className="text-xs text-slate-500">
                    {selected.studentCode} · {selected.className}{translateText(" · Phụ huynh: ")}{selected.parentName || translateText("Chưa cập nhật")} ({selected.parentPhone || translateText("N/A")})
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                  {translateText(selected.severityLabel)}
                </span>
                <p className="text-[11px] text-slate-400 mt-1">
                  {selected.lowIntakeMealsCount} / {selected.totalMealsTracked}{translateText(" bữa ăn ít")}</p>
              </div>
            </div>

            {/* Allergen Red Alert Warning */}
            {selected.allergies?.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800 text-sm">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">{translateText("LƯU Ý DỊ ỨNG QUAN TRỌNG:")}</strong>
                  <p className="text-xs text-rose-700 mt-0.5">{translateText("Học sinh bị dị ứng với: ")}<strong>{translateText(selected.allergies.join(", "))}</strong>{translateText(". Tuyệt đối không đề xuất các món có chứa thành phần này trong phác đồ dinh dưỡng gia đình.")}</p>
                </div>
              </div>
            )}



            {/* Form */}
            <form className="space-y-4" onSubmit={send}>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">{translateText("Tiêu đề thông điệp tư vấn ")}<span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={255}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={translateText("Ví dụ: Phác đồ dinh dưỡng cải thiện khẩu vị cho bé...")}
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">{translateText("Gợi ý chăm sóc và dinh dưỡng tại nhà ")}<span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  maxLength={5000}
                  rows={4}
                  value={advice}
                  onChange={(e) => setAdvice(e.target.value)}
                  placeholder={translateText("Nhập nhận xét tình hình ăn uống và lời khuyên chăm sóc cho gia đình...")}
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">{translateText("Món ăn bổ sung khuyên dùng (mỗi món 1 dòng)")}</label>
                <textarea
                  maxLength={3000}
                  rows={3}
                  value={dishes}
                  onChange={(e) => setDishes(e.target.value)}
                  placeholder={translateText("Ví dụ:&#10;Cháo tôm bí đỏ hạt sen&#10;Sinh tố bơ chuối sữa chua")}
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 transition font-mono text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >{translateText("Đóng")}</button>
                <button
                  type="submit"
                  disabled={action.busy}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {translateText(action.busy ? "Đang gửi..." : "Gửi tư vấn cho phụ huynh")}
                </button>
              </div>
            </form>

            {/* History */}
            <section className="border-t border-slate-100 pt-5">
              <h4 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />{translateText("Lịch sử tư vấn đã gửi")}</h4>
              <State resource={history} />
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {(Array.isArray(history.data)
                  ? history.data
                  : history.data?.items || history.data?.data || []
                ).map((r: any) => (
                  <div
                    key={r.id}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <strong className="text-slate-800 font-bold">{r.adviceTitle}</strong>
                      <span className="text-slate-400 text-[11px]">
                        {translateText(r.createdAt
                          ? new Date(r.createdAt).toLocaleDateString(getLocale())
                          : r.adviceDate)}
                      </span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">{r.homeSupplementAdvice}</p>
                    {r.parentFeedback && (
                      <div className="mt-2 p-2 rounded-xl bg-teal-50 border border-teal-100 text-teal-800">
                        <strong>{translateText("Phản hồi từ phụ huynh:")}</strong> {r.parentFeedback}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </Modal>
      )}
    </div>
  );
}
