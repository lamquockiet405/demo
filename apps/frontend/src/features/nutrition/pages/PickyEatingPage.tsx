import React, { useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
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

export function PickyEatingPage() {
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
      {/* Top Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-teal-700 to-emerald-900 p-7 md:p-9 text-white shadow-xl">
        <div className="absolute -top-12 -right-12 h-64 w-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold uppercase tracking-wider text-emerald-100">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              Sàng lọc biếng ăn & Khẩu phần ăn
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Theo dõi Trẻ kén ăn & Tư vấn dinh dưỡng
            </h1>
            <p className="text-emerald-100/90 text-sm md:text-base leading-relaxed">
              Phát hiện sớm trẻ bỏ bữa, ăn ít rau, lượng calo nạp thấp qua nhật ký suất ăn lớp mầm non. 
              Chuyên gia dinh dưỡng rà soát yếu tố dị ứng và đồng hành cùng phụ huynh xây dựng phác đồ bổ sung tại nhà.
            </p>
          </div>
          <div className="flex items-center gap-3 self-start md:self-auto">
            <button
              onClick={() => resource.reload()}
              disabled={resource.loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white text-emerald-900 hover:bg-emerald-50 text-sm font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${resource.loading ? "animate-spin" : ""}`} />
              Phân tích lại
            </button>
          </div>
        </div>
      </section>

      {/* KPI Stats */}
      {isTeacherPortal ? (
        <TeacherStatsOverview />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Trẻ kén ăn
              </span>
              <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
                <Baby className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-black text-slate-800">
              {summary.totalDetected}
            </div>
            <p className="text-xs text-slate-400 mt-1">Được phát hiện từ bữa ăn</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-rose-600 uppercase tracking-wide">
                Cần can thiệp gấp
              </span>
              <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-black text-rose-600">
              {summary.severeCount}
            </div>
            <p className="text-xs text-rose-500 mt-1">Bỏ cữ liên tục & ăn &lt; 30%</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
                Theo dõi vừa & nhẹ
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-black text-amber-600">
              {summary.moderateCount + summary.mildCount}
            </div>
            <p className="text-xs text-amber-500 mt-1">Kén rau, thịt hoặc ăn chậm</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">
                Phụ huynh xác nhận
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-black text-emerald-600">
              {summary.confirmedCount} / {summary.totalDetected || 1}
            </div>
            <p className="text-xs text-emerald-600 mt-1">Đã tiếp nhận phác đồ</p>
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
            placeholder="Tìm theo tên học sinh, mã hồ sơ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">Tất cả các lớp</option>
            {(resource.data?.classes || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="ALL">Tất cả mức độ</option>
            <option value="SEVERE">Nghiêm trọng (SEVERE)</option>
            <option value="MODERATE">Trung bình (MODERATE)</option>
            <option value="MILD">Nhẹ (MILD)</option>
          </select>

          <select
            value={adviceStatusFilter}
            onChange={(e) => setAdviceStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="ALL">Tất cả trạng thái tư vấn</option>
            <option value="NOT_SENT">Chưa gửi tư vấn</option>
            <option value="SENT">Đã gửi tư vấn</option>
            <option value="PARENT_CONFIRMED">Phụ huynh đã xác nhận</option>
          </select>
        </div>
      </div>

      <State resource={resource} empty={!allRows.length} />

      {/* Grid of Children */}
      {filteredRows.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRows.map((child) => {
            const isSevere = child.severityLevel === "SEVERE";
            const isModerate = child.severityLevel === "MODERATE";
            const consumption = child.averageConsumptionRate ?? 50;

            return (
              <div
                key={child.studentId}
                className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
              >
                {/* Header */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                        {child.fullName.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 group-hover:text-teal-700 transition-colors">
                          {child.fullName}
                        </h3>
                        <p className="text-xs text-slate-400">
                          {child.studentCode} · {child.className}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide ${
                        isSevere
                          ? "bg-rose-50 text-rose-600 border border-rose-100"
                          : isModerate
                          ? "bg-amber-50 text-amber-700 border border-amber-100"
                          : "bg-blue-50 text-blue-700 border border-blue-100"
                      }`}
                    >
                      {child.severityLabel || child.severityLevel}
                    </span>
                  </div>

                  {/* Consumption Progress */}
                  <div className="p-3 rounded-2xl bg-slate-50 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-medium">
                        Lượng ăn trung bình:
                      </span>
                      <span className="font-bold text-slate-700">{consumption}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          consumption < 40
                            ? "bg-rose-500"
                            : consumption < 70
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(5, consumption))}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1">
                      <span>Theo dõi: {child.totalMealsTracked} bữa</span>
                      <span className="text-rose-600 font-medium">
                        {child.lowIntakeMealsCount} bữa ăn ít / bỏ
                      </span>
                    </div>
                  </div>

                  {/* Picky Symptoms */}
                  {child.pickySymptoms?.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Dấu hiệu kén ăn
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {child.pickySymptoms.map((sym, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-lg bg-orange-50 text-orange-700 font-medium border border-orange-100"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                            {sym}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Allergies Warning */}
                  {child.allergies?.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-rose-50/80 border border-rose-100 flex items-start gap-2 text-xs text-rose-700 font-medium">
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>
                        Dị ứng đã ghi nhận: <strong>{child.allergies.join(", ")}</strong>
                      </span>
                    </div>
                  )}

                  {/* Latest Advice Status */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {child.latestAdvice?.adviceDate || "Chưa có phác đồ"}
                    </span>
                    <span
                      className={`font-semibold ${
                        child.adviceStatus === "PARENT_CONFIRMED"
                          ? "text-emerald-600"
                          : child.adviceStatus === "SENT"
                          ? "text-teal-600"
                          : "text-slate-400"
                      }`}
                    >
                      {child.adviceStatusLabel || "Chưa gửi tư vấn"}
                    </span>
                  </div>
                </div>

                {/* Action button */}
                <button
                  onClick={() => openModal(child)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-teal-700 text-white font-medium text-xs tracking-wide shadow-sm transition-all"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  {child.latestAdvice ? "Xem & Cập nhật tư vấn" : "Soạn tư vấn dinh dưỡng"}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center max-w-xl mx-auto shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-4 shadow-inner">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">
            Không có trẻ nào có biểu hiện kén ăn cần can thiệp
          </h3>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            Hệ thống đối soát tự động nhật ký hoàn thành suất ăn do giáo viên cập nhật hàng ngày.
            Hiện tại các lớp học sinh đều đạt tỷ lệ tiêu thụ dinh dưỡng an toàn theo quy chuẩn.
          </p>
        </div>
      )}

      {/* Consultation Modal */}
      {selected && (
        <Modal
          title={`Tư vấn dinh dưỡng · ${selected.fullName}`}
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
                    {selected.studentCode} · {selected.className} · Phụ huynh: {selected.parentName || "Chưa cập nhật"} ({selected.parentPhone || "N/A"})
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                  {selected.severityLabel}
                </span>
                <p className="text-[11px] text-slate-400 mt-1">
                  {selected.lowIntakeMealsCount} / {selected.totalMealsTracked} bữa ăn ít
                </p>
              </div>
            </div>

            {/* Allergen Red Alert Warning */}
            {selected.allergies?.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800 text-sm">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">LƯU Ý DỊ ỨNG QUAN TRỌNG:</strong>
                  <p className="text-xs text-rose-700 mt-0.5">
                    Học sinh bị dị ứng với: <strong>{selected.allergies.join(", ")}</strong>. Tuyệt đối không đề xuất các món có chứa thành phần này trong phác đồ dinh dưỡng gia đình.
                  </p>
                </div>
              </div>
            )}

            {/* Quick Templates */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Gợi ý mẫu phác đồ chuẩn chuyên gia
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {TEMPLATE_SUGGESTIONS.map((tpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className="p-3 rounded-xl border border-slate-200 bg-white hover:border-teal-500 hover:bg-teal-50/50 text-left transition-all text-xs group"
                  >
                    <div className="font-bold text-slate-800 group-hover:text-teal-700 line-clamp-1">
                      {tpl.title}
                    </div>
                    <div className="text-slate-400 text-[11px] line-clamp-2 mt-1">
                      {tpl.advice}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Form */}
            <form className="space-y-4" onSubmit={send}>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tiêu đề thông điệp tư vấn <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={255}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Phác đồ dinh dưỡng cải thiện khẩu vị cho bé..."
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Vi chất cần tập trung bổ sung
                </label>
                <div className="flex flex-wrap gap-2">
                  {["Kẽm", "Sắt", "Canxi", "Vitamin A", "Vitamin D3", "Chất xơ", "Lysine", "Omega-3"].map((nut) => {
                    const active = micronutrients.includes(nut);
                    return (
                      <button
                        type="button"
                        key={nut}
                        onClick={() => toggleMicronutrient(nut)}
                        className={`px-3 py-1 text-xs font-medium rounded-lg border transition-all ${
                          active
                            ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                            : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {active ? "✓ " : "+ "}
                        {nut}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Hướng dẫn chăm sóc & thực đơn tại nhà <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  maxLength={5000}
                  rows={4}
                  value={advice}
                  onChange={(e) => setAdvice(e.target.value)}
                  placeholder="Nhập chi tiết phác đồ chăm sóc, cách tương tác trong bữa ăn, thời gian biểu chia nhỏ cữ ăn..."
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Món ăn bổ sung khuyên dùng (mỗi món 1 dòng)
                </label>
                <textarea
                  maxLength={3000}
                  rows={3}
                  value={dishes}
                  onChange={(e) => setDishes(e.target.value)}
                  placeholder="Ví dụ:&#10;Cháo tôm bí đỏ hạt sen&#10;Sinh tố bơ chuối sữa chua"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 transition font-mono text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={action.busy}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {action.busy ? "Đang gửi..." : "Gửi tư vấn cho phụ huynh"}
                </button>
              </div>
            </form>

            {/* History */}
            <section className="border-t border-slate-100 pt-5">
              <h4 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                Lịch sử tư vấn đã gửi
              </h4>
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
                        {r.createdAt
                          ? new Date(r.createdAt).toLocaleDateString("vi-VN")
                          : r.adviceDate}
                      </span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">{r.homeSupplementAdvice}</p>
                    {r.parentFeedback && (
                      <div className="mt-2 p-2 rounded-xl bg-teal-50 border border-teal-100 text-teal-800">
                        <strong>Phản hồi từ phụ huynh:</strong> {r.parentFeedback}
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
