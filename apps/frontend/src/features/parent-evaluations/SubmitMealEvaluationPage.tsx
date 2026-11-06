import { t as translateText } from '../../core/i18n/language';
import { useLanguage } from '../../core/i18n/useLanguage';
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { schoolDate } from "../menus/utils/published-menus";
import { parentEvaluationApi } from "./api/parentEvaluationApi";
import {
  ParentPortalData,
  SubmitEvaluationPayload,
  ParentHistoryItem,
  SavedMealEvaluation,
} from "./types";
import { ParentPortalTopNav } from "./components/ParentPortalTopNav";
import { ChildInfoStrip } from "./components/ChildInfoStrip";
import { NutritionStandardBanner } from "./components/NutritionStandardBanner";
import { PortalFooter } from "./components/PortalFooter";
import {
  Star,
  Utensils,
  Megaphone,
  MessageSquareQuote,
  CheckCircle2,
  Clock,
  Sparkles,
  Heart,
  Scale,
  ShieldCheck,
  Send,
  Calendar,
  ThumbsUp,
  Award,
  Upload,
  AlertCircle,
  User,
  ChefHat,
  Headphones,
  Check,
  Loader2,
  Quote,
  FileText,
} from "lucide-react";
import { useAuthStore } from "../../core/stores/auth.store";

export const SubmitMealEvaluationPage: React.FC = () => {
  useLanguage();
  const { user } = useAuthStore();
  const [params] = useSearchParams();
  const requestedChildId = params.get("childId") || undefined;
  const feedbackDate = params.get("date") || schoolDate();
  const mealType = params.get("mealType") || "LUNCH";
  const [data, setData] = useState<ParentPortalData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const currentEvaluation = data?.currentEvaluation;
  const evaluationReadOnly =
    !!currentEvaluation && !currentEvaluation.isDrafting && !isEditing;
  const requestRef = useRef(0);

  // Active Main Tab: 'EVALUATION' | 'PROPOSAL' | 'HISTORY'
  const [activeTab, setActiveTab] = useState<
    "EVALUATION" | "PROPOSAL" | "HISTORY"
  >("EVALUATION");

  // Tab 1: Quick Meal Evaluation Form State
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [tastePreference, setTastePreference] = useState<string>(
    "Vừa miệng thanh đạm",
  );
  const [childAppetite, setChildAppetite] =
    useState<string>("Ăn hết sạch khay");
  const [portionFit, setPortionFit] = useState<string>("Vừa vặn thể trạng");
  const [allergySafe, setAllergySafe] = useState<string>(
    "Tuyệt đối an tâm 100%",
  );
  const [selectedQuickTags, setSelectedQuickTags] = useState<string[]>([]);
  const [evalMessage, setEvalMessage] = useState<string>("");
  const [evalToast, setEvalToast] = useState<string | null>(null);

  // Tab 2: School Proposal Form State
  const [proposalCategory, setProposalCategory] = useState<string>(
    "Đề xuất món mới bé yêu thích",
  );
  const [proposalPriority, setProposalPriority] = useState<"NORMAL" | "URGENT">(
    "NORMAL",
  );
  const [proposalTitle, setProposalTitle] = useState<string>("");
  const [proposalContent, setProposalContent] = useState<string>("");
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [proposalToast, setProposalToast] = useState<string | null>(null);

  // Tab 3: History Filter
  const [historyFilter, setHistoryFilter] = useState<
    "ALL" | "RESOLVED" | "PENDING"
  >("ALL");

  // Load real database data for portal
  const fillEvaluation = useCallback((saved?: SavedMealEvaluation | null) => {
    const attributes = saved?.attributes || {};
    setRating(saved?.rating ?? 5);
    setHoverRating(0);
    setTastePreference(attributes.taste || "Vừa miệng thanh đạm");
    setChildAppetite(attributes.appetite || "Ăn hết sạch khay");
    setPortionFit(attributes.portion || "Vừa vặn thể trạng");
    setAllergySafe(attributes.allergy || "Tuyệt đối an tâm 100%");
    setSelectedQuickTags(
      Array.isArray(attributes.tags)
        ? attributes.tags
        : attributes.tags
          ? attributes.tags.split(", ")
          : [],
    );
    setEvalMessage(saved?.content || "");
    setIsEditing(false);
  }, []);

  const loadPortalData = useCallback(async () => {
    const request = ++requestRef.current;
    try {
      setLoading(true);
      setError(null);
      const res = await parentEvaluationApi.getPortalData(
        requestedChildId,
        feedbackDate,
        mealType,
      );
      if (request !== requestRef.current) return;
      setData(res);
      fillEvaluation(res.currentEvaluation);
    } catch (err: any) {
      console.error("Error fetching portal data:", err);
      if (request === requestRef.current)
        setError(err.message || "Không thể tải dữ liệu từ máy chủ.");
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [requestedChildId, feedbackDate, mealType, fillEvaluation]);

  useEffect(() => {
    void loadPortalData();
    return () => {
      requestRef.current++;
    };
  }, [loadPortalData]);

  const getRatingLabel = (score: number) => {
    switch (score) {
      case 5:
        return "🌟 Rất Ngon Miệng — Bé ăn hết sạch phần cơm & canh!";
      case 4:
        return "😋 Hài Lòng — Bé ăn ngoan, hợp khẩu vị của con.";
      case 3:
        return "🙂 Tạm Ổn — Bé ăn vừa đủ, chưa thật sự hào hứng.";
      case 2:
        return "🤔 Cần Nêm Nhạt Hơn — Bé ăn ít, để lại nhiều thức ăn.";
      case 1:
        return "😕 Chưa Phù Hợp — Bé chưa quen khẩu vị món ăn này.";
      default:
        return "🌟 Rất Ngon Miệng (5/5 sao)";
    }
  };

  const quickTagOptions = [
    "👍 Bé khen món thịt rất mềm dễ nhai",
    "🥣 Con húp cạn bát canh rau",
    "🥦 Hôm nay con đã chịu ăn rau nhiều hơn",
    "🧂 Đề xuất giảm chút muối/đường trong món canh",
    "🥛 Con uống hết sạch phần sữa bữa xế",
    "🥰 Cảm ơn cô giáo đã dỗ con ăn ngoan",
  ];

  const toggleQuickTag = (tag: string) => {
    setSelectedQuickTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  // Submit Quick Meal Evaluation
  const handleQuickEvaluationSubmit = async (isDrafting: boolean = false) => {
    if (!data || loading || isSubmitting || evaluationReadOnly) return;
    const currentChild = data.child || (data as any).childProfile;
    if (!currentChild?.id) return;

    setIsSubmitting(true);
    setEvalError(null);
    try {
      const compiledContent = evalMessage.trim()
        ? evalMessage.trim()
        : selectedQuickTags.length > 0
          ? selectedQuickTags.join(". ")
          : `Phụ huynh chấm ${rating}/5 sao cho bữa trưa của bé. Khẩu vị: ${tastePreference}, Sức ăn: ${childAppetite}.`;

      const payload: SubmitEvaluationPayload = {
        childId: currentChild.id,
        evaluationType: "QUICK_EVALUATION",
        rating,
        content: compiledContent,
        isDrafting,
        parentNameCustom: currentChild.parentName,
        childNameCustom: currentChild.name,
        classNameCustom: currentChild.className,
        attributes: {
          taste: tastePreference,
          allergy: allergySafe,
          portion: portionFit,
          appetite: childAppetite,
          tags: selectedQuickTags.join(", "),
        },
        feedbackDate: data.feedbackDate || feedbackDate,
        mealType: data.mealType || mealType,
      };

      const response = currentEvaluation
        ? await parentEvaluationApi.updateEvaluation(
            currentEvaluation.id,
            payload,
          )
        : await parentEvaluationApi.submitEvaluation(payload);
      const saved = response.data || response;
      setData((previous) =>
        previous ? { ...previous, currentEvaluation: saved } : previous,
      );
      fillEvaluation(saved);
      setEvalToast(
        isDrafting
          ? "Đã lưu bản nháp đánh giá vào hệ thống thành công!"
          : currentEvaluation
            ? "Đã cập nhật đánh giá bữa ăn thành công!"
            : "Đã gửi đánh giá bữa ăn thành công đến Cô giáo chủ nhiệm & Tổ bếp!",
      );
      setTimeout(() => setEvalToast(null), 4500);
      await loadPortalData();
    } catch (err: any) {
      if (err.response?.status === 409) await loadPortalData();
      setEvalError(
        err.response?.data?.message ||
          err.message ||
          "Không thể lưu đánh giá. Vui lòng thử lại.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit School Proposal
  const handleProposalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposalContent.trim()) {
      alert(translateText("Vui lòng nhập nội dung đề xuất hoặc góp ý của bạn."));
      return;
    }

    if (!data) return;
    const currentChild = data.child ||
      (data as any).childProfile || {
        id: "1",
        name: "Hồ sơ của bé",
        parentName: user?.fullName || "Phụ huynh",
        className: "Lớp mầm non",
      };

    setIsSubmitting(true);
    try {
      const payload: SubmitEvaluationPayload = {
        childId: currentChild.id,
        evaluationType: "SCHOOL_PROPOSAL",
        category: proposalCategory,
        title: proposalTitle.trim() || `Góp ý: ${proposalCategory}`,
        content: proposalContent.trim(),
        isAnonymous,
        photos: uploadedPhotos,
        parentNameCustom: isAnonymous
          ? "Phụ huynh ẩn danh"
          : currentChild.parentName,
        childNameCustom: isAnonymous ? "Bé ẩn danh" : currentChild.name,
        classNameCustom: currentChild.className,
      };

      await parentEvaluationApi.submitEvaluation(payload);
      setProposalToast(
        "Đã gửi kiến nghị thành công! Ban Giám Hiệu & Chuyên gia Dinh dưỡng sẽ tiếp nhận và giải trình trong vòng 24 giờ.",
      );
      setProposalTitle("");
      setProposalContent("");
      setUploadedFileName(null);
      setUploadedPhotos([]);
      setTimeout(() => setProposalToast(null), 5000);
      await loadPortalData();
    } catch (err: any) {
      alert(translateText("Lỗi gửi góp ý: " + (err.message || "Vui lòng thử lại")));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedFileName(file.name);
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setUploadedPhotos([ev.target.result as string]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-10 h-10 text-teal-600 animate-spin mb-3" />
        <p className="text-sm font-bold text-slate-700">{translateText("Đang tải dữ liệu thực từ cơ sở dữ liệu KidMeal...")}</p>
        <p className="text-xs text-slate-500 mt-1">{translateText("Vui lòng chờ trong giây lát")}</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="p-5 bg-red-50 border border-red-200 rounded-2xl max-w-md">
          <p className="text-sm font-bold text-red-800">{translateText("Không thể kết nối đến máy chủ")}</p>
          <p className="text-xs text-red-600 mt-1">{translateText(error)}</p>
          <button
            onClick={loadPortalData}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition cursor-pointer"
          >{translateText("Thử lại")}</button>
        </div>
      </div>
    );
  }

  const child = data?.child || (data as any)?.childProfile;
  if (!child)
    return (
      <div className="p-8 text-slate-600">{translateText("Ch?a c? h? s? h?c sinh li?n k?t v?i t?i kho?n.")}</div>
    );
  const rawHistory: ParentHistoryItem[] = data?.history || [];

  const filteredHistory = rawHistory.filter((item) => {
    if (historyFilter === "RESOLVED")
      return item.status === "RESOLVED" || item.status === "RESPONDED";
    if (historyFilter === "PENDING") return item.status === "PENDING";
    return true;
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col antialiased">
      {/* 1. Top Navigation Bar (Tuition Tab Removed) */}
      <ParentPortalTopNav child={child} activeTab="evaluation" />

      {/* 2. Sub-Header Child Profile & Health Strip */}
      <ChildInfoStrip child={child} />

      {/* Main Content Container with pb-32 to avoid floating bottom nav collision */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 pb-32">
        {/* 3. Hero Header with Quote & KPI Highlights */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-50 border border-teal-200 text-teal-800 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{translateText("Lắng nghe & Đồng hành cùng Gia Đình")}</span>
                <span className="text-teal-400">•</span>
                <span className="normal-case font-medium">{translateText("Học kỳ I (2026 - 2027)")}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{translateText("Đánh Giá & Góp Ý Suất Ăn Bán Trú")}</h1>
              <p className="text-xs md:text-sm text-slate-600 mt-1">{translateText("Kênh kết nối trực tiếp hai chiều giữa Phụ huynh, Ban Giám Hiệu, Chuyên gia Dinh dưỡng & Tổ Bếp")}</p>
            </div>

            {/* Quick Hotline Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 rounded-2xl shadow-xs text-xs font-semibold text-slate-700">
              <Headphones className="w-4 h-4 text-teal-600" />
              <span>{translateText("Hotline Dinh Dưỡng:")}{" "}
                <strong className="text-teal-700">{translateText("1900 6868 (Phím 2)")}</strong>
              </span>
            </div>
          </div>

          {/* Hero Quote & 2 KPI Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left: Principal Quote Banner */}
            <div className="lg:col-span-8 bg-gradient-to-r from-teal-50/80 via-emerald-50/50 to-white border border-teal-100 rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-center">
              <div className="absolute top-2 right-4 text-teal-200/50 pointer-events-none select-none">
                <Quote className="w-24 h-24 rotate-180" />
              </div>

              <div className="relative z-10 flex gap-4">
                <span className="text-4xl font-serif text-teal-600 leading-none select-none">
                  “
                </span>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700 leading-relaxed italic">{translateText("Mọi ý kiến đóng góp của Ba Mẹ đều là động lực quý giá để KidMeal không ngừng hoàn thiện từng bữa cơm dinh dưỡng, an toàn và ngập tràn niềm vui cho các thiên thần nhỏ.")}</p>
                  <p className="text-xs font-bold text-teal-900">{translateText("Ban Giám Hiệu & Ban Điều hành Tổ Dinh dưỡng")}</p>
                </div>
              </div>
            </div>

            {/* Right: 2 KPI Highlight Cards */}
            <div className="lg:col-span-4 grid grid-cols-2 gap-3">
              <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900">{translateText("Độ Hài Lòng")}</span>
                  <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                </div>
                <div className="my-1">
                  <span className="text-2xl lg:text-3xl font-black text-slate-900">
                    4.9
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    {" "}
                    / 5.0
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 font-medium">{translateText("Từ hơn 480 phụ huynh đánh giá tích cực")}</p>
              </div>

              <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900">{translateText("Giải Quyết 24H")}</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="my-1">
                  <span className="text-2xl lg:text-3xl font-black text-emerald-700">
                    100%
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 font-medium">{translateText("Phản hồi minh bạch & giải pháp cụ thể")}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Segmented Control Switcher */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-200/70 rounded-2xl mb-6 max-w-xl">
          <button
            type="button"
            onClick={() => setActiveTab("EVALUATION")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === "EVALUATION"
                ? "bg-white text-teal-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Utensils className="w-3.5 h-3.5 text-teal-600" />
            <span>{translateText("Đánh giá bữa ăn")}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("PROPOSAL")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === "PROPOSAL"
                ? "bg-white text-amber-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Megaphone className="w-3.5 h-3.5 text-amber-600" />
            <span>{translateText("Đề xuất & Góp ý")}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("HISTORY")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === "HISTORY"
                ? "bg-white text-blue-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <MessageSquareQuote className="w-3.5 h-3.5 text-blue-600" />
            <span>{translateText("Nhật ký & Phản hồi")}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
              {rawHistory.length}
            </span>
          </button>
        </div>

        {/* ─── TAB 1: ĐÁNH GIÁ BỮA ĂN HÔM NAY ─── */}
        {activeTab === "EVALUATION" && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 md:p-7">
              {/* Card Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0">
                    <Utensils className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base md:text-lg font-bold text-slate-900">{translateText("Đánh giá bữa ăn bán trú")}</h2>
                    <p className="text-xs text-slate-500 font-medium">{translateText("Bé ")}{child?.name || translateText("của phụ huynh")}
                      {child?.className ? ` • ${child.className}` : ""}
                    </p>
                  </div>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    {translateText(data?.todayMeal?.dateLabel || "Trưa Thứ Ba, 13/10/2026")}
                  </span>
                </div>
              </div>

              {/* Meal Details Box */}
              <div className="bg-slate-50/90 rounded-2xl p-4 md:p-5 border border-slate-200 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                  {/* Photo */}
                  <div className="md:col-span-5 relative rounded-xl overflow-hidden group shadow-xs">
                    <img
                      src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80"
                      alt={translateText("Khay ăn mầm non thực tế")}
                      className="w-full h-44 object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute bottom-2 left-2 px-2.5 py-1 bg-black/75 backdrop-blur-xs text-white text-[11px] font-medium rounded-lg">{translateText("📸 Khay ăn thực tế lưu mẫu lúc 10:45")}</div>
                  </div>

                  {/* Dishes List */}
                  <div className="md:col-span-7 space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-teal-800 font-bold uppercase tracking-wider text-[11px]">
                      <span>{translateText("📋 THỰC ĐƠN BỮA TRƯA DINH DƯỠNG TIÊU CHUẨN")}</span>
                      <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 font-bold">{translateText("~540 kcal")}</span>
                    </div>

                    <div className="space-y-1.5 text-slate-700 font-medium pt-1">
                      <div className="flex items-baseline gap-2">
                        <span className="w-2 h-2 rounded-full bg-teal-500 shrink-0"></span>
                        <span className="font-bold text-slate-900 min-w-[85px]">{translateText("Món mặn:")}</span>
                        <span>{translateText("Sườn non ram mặn sốt me đậm đà (Thịt nạc tươi ngon mềm)")}</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="w-2 h-2 rounded-full bg-teal-500 shrink-0"></span>
                        <span className="font-bold text-slate-900 min-w-[85px]">{translateText("Món canh:")}</span>
                        <span>{translateText("Canh cải ngọt nấu thịt thăn bằm thanh đạm")}</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="w-2 h-2 rounded-full bg-teal-500 shrink-0"></span>
                        <span className="font-bold text-slate-900 min-w-[85px]">{translateText("Tinh bột:")}</span>
                        <span>{translateText("Cơm trắng dẻo thơm giống lúa ST25")}</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="w-2 h-2 rounded-full bg-teal-500 shrink-0"></span>
                        <span className="font-bold text-slate-900 min-w-[85px]">{translateText("Tráng miệng:")}</span>
                        <span>{translateText("Chuối tiêu chín tự nhiên / Thanh long đỏ")}</span>
                      </div>
                    </div>

                    <div className="pt-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-semibold">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{translateText("Kiểm soát dị ứng:")}</span>
                        <strong className="text-emerald-900">{translateText("An toàn tuyệt đối (Không chứa hải sản dị ứng)")}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Interactive Star Rating */}
              {currentEvaluation && !currentEvaluation.isDrafting && (
                <div
                  className="mb-4 rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900"
                  role="status"
                >{translateText("Bạn đã đánh giá bữa ăn này. Bạn có thể chỉnh sửa nội dung đã gửi.")}</div>
              )}
              <fieldset
                disabled={evaluationReadOnly || isSubmitting || loading}
              >
                <div className="bg-amber-50/50 rounded-2xl p-4 md:p-5 border border-amber-200/70 mb-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="text-xs md:text-sm font-bold text-slate-800">{translateText("Mức độ hài lòng chung của con về bữa ăn:")}</span>
                    <span className="text-xs font-bold text-amber-800 bg-amber-100/80 px-2.5 py-0.5 rounded-full">
                      {translateText(getRatingLabel(hoverRating || rating))}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 py-1">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const active = star <= (hoverRating || rating);
                      return (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="p-1 hover:scale-115 active:scale-95 transition cursor-pointer"
                          title={translateText(`${star} sao`)}
                        >
                          <Star
                            className={`w-9 h-9 md:w-10 md:h-10 transition-colors ${
                              active
                                ? "text-amber-400 fill-amber-400 drop-shadow-sm"
                                : "text-slate-300 hover:text-amber-200"
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4 In-Depth Evaluation Criteria */}
                <div className="mb-6">
                  <label className="block text-xs font-bold text-slate-800 mb-2">{translateText("Đánh giá chi tiết 4 tiêu chí cảm quan:")}</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Criteria 1: Khẩu vị */}
                    <div className="p-3.5 rounded-2xl border border-teal-200 bg-teal-50/50 flex flex-col justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-teal-800 mb-2">
                        <Heart className="w-3.5 h-3.5 fill-teal-600 text-teal-600" />
                        <span>{translateText("Khẩu vị món ăn")}</span>
                      </div>
                      <div className="space-y-1 text-xs">
                        {[translateText("Vừa miệng thanh đạm"), translateText("Hơi đậm đà"), translateText("Hơi nhạt")].map(
                          (opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setTastePreference(opt)}
                              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center justify-between ${
                                tastePreference === opt
                                  ? "bg-teal-600 text-white shadow-2xs"
                                  : "bg-white hover:bg-teal-100 text-slate-700"
                              }`}
                            >
                              <span>{translateText(opt)}</span>
                              {tastePreference === opt && (
                                <Check className="w-3 h-3 text-white" />
                              )}
                            </button>
                          ),
                        )}
                      </div>
                    </div>

                    {/* Criteria 2: Sức ăn của bé */}
                    <div className="p-3.5 rounded-2xl border border-sky-200 bg-sky-50/50 flex flex-col justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-sky-800 mb-2">
                        <ThumbsUp className="w-3.5 h-3.5 text-sky-600" />
                        <span>{translateText("Sức ăn của bé")}</span>
                      </div>
                      <div className="space-y-1 text-xs">
                        {[
                          translateText("Ăn hết sạch khay"),
                          translateText("Ăn 2/3 khẩu phần"),
                          translateText("Cần cô giáo dỗ thêm"),
                        ].map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setChildAppetite(opt)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center justify-between ${
                              childAppetite === opt
                                ? "bg-sky-600 text-white shadow-2xs"
                                : "bg-white hover:bg-sky-100 text-slate-700"
                            }`}
                          >
                            <span>{translateText(opt)}</span>
                            {childAppetite === opt && (
                              <Check className="w-3 h-3 text-white" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Criteria 3: Định lượng khẩu phần */}
                    <div className="p-3.5 rounded-2xl border border-indigo-200 bg-indigo-50/50 flex flex-col justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-800 mb-2">
                        <Scale className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{translateText("Định lượng phần ăn")}</span>
                      </div>
                      <div className="space-y-1 text-xs">
                        {[
                          translateText("Vừa vặn thể trạng"),
                          translateText("Cần tăng thêm cơm"),
                          translateText("Cần thêm nước canh"),
                        ].map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setPortionFit(opt)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center justify-between ${
                              portionFit === opt
                                ? "bg-indigo-600 text-white shadow-2xs"
                                : "bg-white hover:bg-indigo-100 text-slate-700"
                            }`}
                          >
                            <span>{translateText(opt)}</span>
                            {portionFit === opt && (
                              <Check className="w-3 h-3 text-white" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Criteria 4: An toàn & Vệ sinh */}
                    <div className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/50 flex flex-col justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 mb-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{translateText("Độ an toàn vệ sinh")}</span>
                      </div>
                      <div className="space-y-1 text-xs">
                        {[
                          translateText("Tuyệt đối an tâm 100%"),
                          translateText("Đạt chuẩn tươi sạch"),
                          translateText("Cần lưu ý thêm"),
                        ].map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setAllergySafe(opt)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center justify-between ${
                              allergySafe === opt
                                ? "bg-emerald-600 text-white shadow-2xs"
                                : "bg-white hover:bg-emerald-100 text-slate-700"
                            }`}
                          >
                            <span>{translateText(opt)}</span>
                            {allergySafe === opt && (
                              <Check className="w-3 h-3 text-white" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1-Click Quick Tags */}
                <div className="mb-6">
                  <label className="block text-xs font-bold text-slate-800 mb-2">{translateText("Nhãn nhận xét nhanh 1-chạm (Bấm để chọn nhiều nhãn):")}</label>
                  <div className="flex flex-wrap gap-2">
                    {quickTagOptions.map((tag) => {
                      const isSelected = selectedQuickTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleQuickTag(tag)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? "bg-teal-700 text-white shadow-xs"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                          }`}
                        >
                          {isSelected && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                          <span>{translateText(tag)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Message Box */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-800">{translateText("Lời nhắn gửi Cô giáo chủ nhiệm & Tổ bếp cấp dưỡng:")}</label>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {evalMessage.length}{translateText("/300 ký tự")}</span>
                  </div>
                  <textarea
                    rows={3}
                    maxLength={300}
                    value={evalMessage}
                    onChange={(e) => setEvalMessage(e.target.value)}
                    placeholder={translateText("Nhập cảm nhận thêm của bé hoặc lời dặn dò riêng cho cô giáo và tổ bếp...")}
                    className="w-full text-xs p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition resize-none text-slate-800 font-medium"
                  />
                </div>
              </fieldset>
              {evalError && (
                <div
                  className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
                  role="alert"
                >
                  {translateText(evalError)}
                </div>
              )}
              {/* Success Toast */}
              {evalToast && (
                <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{translateText(evalToast)}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100">
                {evaluationReadOnly ? (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="px-6 py-2.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl"
                  >{translateText("Chỉnh sửa đánh giá")}</button>
                ) : (
                  <>
                    {(!currentEvaluation || currentEvaluation.isDrafting) && (
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleQuickEvaluationSubmit(true)}
                        className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
                      >{translateText("Lưu bản nháp")}</button>
                    )}
                    {isEditing && (
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => {
                          fillEvaluation(currentEvaluation);
                          setEvalError(null);
                        }}
                        className="px-4 py-2.5 text-xs font-bold text-slate-700 border border-slate-200 rounded-xl"
                      >{translateText("Hủy chỉnh sửa")}</button>
                    )}

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleQuickEvaluationSubmit(false)}
                      className="px-6 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 active:scale-95 shadow-sm rounded-xl transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      <span>
                        {translateText(isSubmitting
                          ? "Đang gửi..."
                          : currentEvaluation && !currentEvaluation.isDrafting
                            ? "Cập nhật đánh giá"
                            : "Gửi đánh giá bữa ăn")}
                      </span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 2: ĐỀ XUẤT & GÓP Ý NHÀ TRƯỜNG ─── */}
        {activeTab === "PROPOSAL" && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 md:p-7">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-5">
                <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base md:text-lg font-bold text-slate-900">{translateText("Đề xuất & Kiến nghị trực tiếp đến Nhà trường")}</h2>
                  <p className="text-xs text-slate-500 font-medium">{translateText("Ban Giám Hiệu & Bác Sĩ Dinh Dưỡng tiếp nhận và giải quyết trong vòng 24 giờ")}</p>
                </div>
              </div>

              <form onSubmit={handleProposalSubmit} className="space-y-5">
                {/* Category Selection Cards */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-2">{translateText("Chọn chủ đề góp ý:")}</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {[
                      {
                        id: translateText("Đề xuất món mới bé yêu thích"),
                        icon: "🍲",
                        desc: translateText("Món ăn con yêu thích ở nhà"),
                      },
                      {
                        id: translateText("Chất lượng & độ tươi nguyên liệu"),
                        icon: "🥦",
                        desc: translateText("Kiểm soát vệ sinh nguồn thực phẩm"),
                      },
                      {
                        id: translateText("Khẩu phần & thời gian ăn"),
                        icon: "⚖️",
                        desc: translateText("Định lượng và tốc độ ăn của bé"),
                      },
                      {
                        id: translateText("Dị ứng & an toàn thực phẩm"),
                        icon: "🛡️",
                        desc: translateText("Dặn dò đặc biệt về cơ địa bé"),
                      },
                      {
                        id: translateText("Lời khen & Tri ân thầy cô, tổ bếp"),
                        icon: "💖",
                        desc: translateText("Động viên cô giáo và đầu bếp"),
                      },
                      {
                        id: translateText("Ý kiến khác"),
                        icon: "💡",
                        desc: translateText("Các vấn đề bán trú khác"),
                      },
                    ].map((cat) => (
                      <div
                        key={cat.id}
                        onClick={() => setProposalCategory(cat.id)}
                        className={`p-3 rounded-2xl border transition cursor-pointer flex items-center gap-3 ${
                          proposalCategory === cat.id
                            ? "border-amber-400 bg-amber-50/70 text-amber-950 shadow-2xs"
                            : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <span className="text-2xl">{translateText(cat.icon)}</span>
                        <div>
                          <p className="text-xs font-bold">{translateText(cat.id)}</p>
                          <p className="text-[11px] text-slate-500">
                            {translateText(cat.desc)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Priority Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">{translateText("Mức độ ưu tiên tiếp nhận:")}</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setProposalPriority("NORMAL")}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        proposalPriority === "NORMAL"
                          ? "bg-teal-600 text-white font-bold"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >{translateText("Bình thường (Phản hồi định kỳ)")}</button>
                    <button
                      type="button"
                      onClick={() => setProposalPriority("URGENT")}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        proposalPriority === "URGENT"
                          ? "bg-rose-600 text-white font-bold"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >{translateText("Cần giải đáp sớm trước ngày mai ⚡")}</button>
                  </div>
                </div>

                {/* Proposal Title */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">{translateText("Tiêu đề ý kiến (Tóm tắt ngắn gọn):")}</label>
                  <input
                    type="text"
                    value={proposalTitle}
                    onChange={(e) => setProposalTitle(e.target.value)}
                    placeholder={translateText("Ví dụ: Đề xuất bổ sung thêm canh cua rau đay vào thực đơn mùa hè...")}
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition font-medium text-slate-800"
                  />
                </div>

                {/* Proposal Detailed Content */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">{translateText("Nội dung góp ý chi tiết:")}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={proposalContent}
                    onChange={(e) => setProposalContent(e.target.value)}
                    placeholder={translateText("Mô tả cụ thể mong muốn của gia đình để Ban Giám Hiệu và Tổ Dinh dưỡng có phương án phối hợp tốt nhất...")}
                    className="w-full text-xs p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition resize-none text-slate-800 font-medium"
                  />
                </div>

                {/* File / Image Attachment */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">{translateText("Đính kèm hình ảnh minh họa (nếu có):")}</label>
                  <div className="flex items-center gap-3">
                    <label className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer transition flex items-center gap-2">
                      <Upload className="w-3.5 h-3.5 text-slate-600" />
                      <span>
                        {translateText(uploadedFileName
                          ? "Thay đổi ảnh"
                          : "Chọn ảnh từ thiết bị")}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                    {uploadedFileName && (
                      <span className="text-xs text-teal-700 font-medium truncate max-w-xs">
                        📎 {translateText(uploadedFileName)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Anonymous Option Checkbox */}
                <div className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <input
                    type="checkbox"
                    id="anonymousCheck"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="w-4 h-4 text-teal-600 rounded-md focus:ring-teal-500 border-slate-300 cursor-pointer"
                  />
                  <label
                    htmlFor="anonymousCheck"
                    className="text-xs text-slate-700 font-medium cursor-pointer"
                  >
                    <strong>{translateText("Gửi ẩn danh:")}</strong>{translateText(" Bảo mật danh tính gia đình và bé, chỉ Ban Giám Hiệu tiếp nhận nội dung để xử lý.")}</label>
                </div>

                {/* Success Toast */}
                {proposalToast && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{translateText(proposalToast)}</span>
                  </div>
                )}

                {/* Submit Button */}
                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting || !proposalContent.trim()}
                    className="px-6 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 active:scale-95 shadow-sm rounded-xl transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>
                      {translateText(isSubmitting
                        ? "Đang gửi..."
                        : "Gửi kiến nghị đến Nhà trường")}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── TAB 3: NHẬT KÝ & CÂU TRẢ LỜI TỪ TRƯỜNG ─── */}
        {activeTab === "HISTORY" && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 md:p-7">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
                    <MessageSquareQuote className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base md:text-lg font-bold text-slate-900">{translateText("Nhật ký Góp ý & Câu trả lời từ Ban Giám Hiệu")}</h2>
                    <p className="text-xs text-slate-500 font-medium">{translateText("Lịch sử tương tác và văn bản giải trình chính thức từ Trường Mẫu Giáo Hướng Dương")}</p>
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setHistoryFilter("ALL")}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      historyFilter === "ALL"
                        ? "bg-white text-slate-900 shadow-2xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >{translateText("Tất cả (")}{rawHistory.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryFilter("RESOLVED")}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      historyFilter === "RESOLVED"
                        ? "bg-white text-emerald-800 shadow-2xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >{translateText("Đã phản hồi (")}{
                      rawHistory.filter(
                        (i) =>
                          i.status === "RESOLVED" || i.status === "RESPONDED",
                      ).length
                    }
                    )
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryFilter("PENDING")}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      historyFilter === "PENDING"
                        ? "bg-white text-amber-800 shadow-2xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >{translateText("Đang xử lý (")}{rawHistory.filter((i) => i.status === "PENDING").length})
                  </button>
                </div>
              </div>

              {/* History List */}
              <div className="space-y-5">
                {filteredHistory.map((item) => {
                  const isResolved =
                    item.status === "RESOLVED" || item.status === "RESPONDED";

                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 transition hover:border-slate-300"
                    >
                      {/* Top Meta */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="px-2.5 py-0.5 rounded-md font-bold text-[11px] bg-sky-100 text-sky-800">
                            {translateText(item.category || "Món ăn & Dinh dưỡng")}
                          </span>
                          <span className="font-bold text-slate-800 text-xs">
                            {translateText(item.title || item.code)}
                          </span>
                          <span className="text-slate-400">{translateText("• Ngày gửi: ")}{translateText(item.date)}
                          </span>
                        </div>

                        {/* Status badge */}
                        <div>
                          {isResolved ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>
                                {translateText(item.statusLabel || "Đã Xử Lý Thỏa Đáng")}
                              </span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>
                                {translateText(item.status === "DRAFT"
                                  ? "Bản nháp chưa gửi"
                                  : "Đang xử lý cùng Tổ Bếp")}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Parent message box */}
                      <div className="bg-white rounded-xl p-3.5 border border-slate-200 text-xs text-slate-800 font-medium leading-relaxed mb-3 flex items-start gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 mt-0.5">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <p className="italic text-slate-700">
                          “{item.content}”
                        </p>
                      </div>

                      {/* School Official Response Quote */}
                      {item.responseContent ? (
                        <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-4 ml-2 sm:ml-4 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-teal-700 text-white font-black text-xs flex items-center justify-center shrink-0">
                                <ChefHat className="w-4 h-4 text-white" />
                              </div>
                              <div className="text-xs">
                                <span className="font-bold text-teal-950">
                                  {item.respondedByName ||
                                    translateText("Ban Giám Hiệu Nhà Trường")}
                                </span>
                                <span className="text-teal-700 font-normal ml-1">{translateText("• Phản hồi chính thức")}</span>
                              </div>
                            </div>

                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-200/80 text-teal-900">{translateText("Cam kết thực hiện")}</span>
                          </div>

                          <p className="text-xs text-slate-700 leading-relaxed pl-9 font-medium">
                            “{item.responseContent}”
                          </p>
                        </div>
                      ) : (
                        <div className="bg-slate-100/70 rounded-xl p-3 ml-2 sm:ml-4 text-xs text-slate-500 italic border border-slate-200 flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          <span>{translateText("Ban Giám Hiệu & Tổ Dinh dưỡng đang kiểm tra quy trình và sẽ phản hồi đến Ba Mẹ trong 24 giờ.")}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 5. Middle National Nutrition Standard Banner (TT 28/2016/TT-BGDĐT) */}
        <NutritionStandardBanner todayMeal={data?.todayMeal} />
      </main>

      {/* 6. Footer */}
      <PortalFooter />
    </div>
  );
};
