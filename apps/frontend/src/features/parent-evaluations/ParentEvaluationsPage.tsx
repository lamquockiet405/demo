import { downloadExcel } from '../../core/utils/excel-export';
import { t as translateText, getLocale } from '../../core/i18n/language';
import { useLanguage } from '../../core/i18n/useLanguage';
import React, { useState, useEffect, useCallback } from "react";
import { EvaluationSummaryCards } from "./components/EvaluationSummaryCards";
import { EvaluationFilterBar } from "./components/EvaluationFilterBar";
import {
  EvaluationCard,
  formatCleanClassName,
  formatCleanMealTitle,
  formatCleanDateTime,
} from "./components/EvaluationCard";
import { ImagePreviewModal } from "./components/ImagePreviewModal";
import { SurveyConfigModal } from "./components/SurveyConfigModal";
import { EvaluationExportModal } from "./components/EvaluationExportModal";
import { parentEvaluationApi } from "./api/parentEvaluationApi";
import {
  ParentEvaluationItem,
  ParentEvaluationResponse,
} from "./types";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Loader2,
  Star,
  Clock,
  Edit3,
  CornerDownRight,
  Send,
  X,
} from "lucide-react";
import { useAuthStore } from "../../core/stores/auth.store";

export const ParentEvaluationsPage: React.FC = () => {
  useLanguage();
  const { user } = useAuthStore();

  // Filter States
  const [search, setSearch] = useState<string>("");
  const [statusTab, setStatusTab] = useState<string>("ALL");
  const [ratingFilter, setRatingFilter] = useState<number>(0);
  const [mealFilter, setMealFilter] = useState<string>("ALL");
  const [classFilter, setClassFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>("NEWEST");

  // Pagination States (10 items per page so users see all feedbacks without constant paging)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize] = useState<number>(10);

  // Data & Loading States
  const [data, setData] = useState<ParentEvaluationResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Quick Reply Modal State (used when clicking Reply from Table view)
  const [activeReplyItem, setActiveReplyItem] = useState<ParentEvaluationItem | null>(null);
  const [modalReplyText, setModalReplyText] = useState<string>("");
  const [modalSending, setModalSending] = useState<boolean>(false);

  // Modals & Toast State
  const [activePhoto, setActivePhoto] = useState<{
    url: string;
    caption: string;
  } | null>(null);
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const resetAllFilters = () => {
    setSearch("");
    setStatusTab("ALL");
    setRatingFilter(0);
    setMealFilter("ALL");
    setClassFilter("ALL");
    setSortBy("NEWEST");
    setCurrentPage(1);
  };

  // Fetch real data from backend
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await parentEvaluationApi.getEvaluations({
        search: search.trim() || undefined,
        status: statusTab !== "ALL" ? statusTab : undefined,
        rating: ratingFilter > 0 ? ratingFilter : undefined,
        mealType: mealFilter !== "ALL" ? mealFilter : undefined,
        className: classFilter !== "ALL" ? classFilter : undefined,
        sortBy,
        page: currentPage,
        limit: pageSize,
      });
      setData(res);
    } catch (err) {
      console.error("Lỗi khi tải danh sách đánh giá từ database:", err);
    } finally {
      setIsLoading(false);
    }
  }, [
    search,
    statusTab,
    ratingFilter,
    mealFilter,
    classFilter,
    sortBy,
    currentPage,
    pageSize,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Respond to Parent Evaluation
  const handleRespond = async (
    id: string,
    responseContent: string,
    pushNotification: boolean,
  ) => {
    try {
      const updated = await parentEvaluationApi.respondToEvaluation(id, {
        responseContent,
        pushNotification,
        respondedByName: user?.fullName || "Ban Giám Hiệu",
        status: "RESPONDED",
        isDrafting: false,
      });

      setData((prev) => {
        if (!prev) return prev;
        const newItems = prev.items.map((it) => (it.id === id ? updated : it));
        return {
          ...prev,
          items: newItems,
          summaryStats: {
            ...prev.summaryStats,
            pendingCount: Math.max(0, prev.summaryStats.pendingCount - 1),
            respondedCount: prev.summaryStats.respondedCount + 1,
          },
        };
      });

      setToastMessage("Đã lưu và gửi phản hồi của Ban Giám Hiệu.");
      setTimeout(() => setToastMessage(null), 4000);
      fetchData();
    } catch (err) {
      console.error("Lỗi khi gửi phản hồi:", err);
      alert(translateText("Không thể lưu phản hồi. Vui lòng kiểm tra kết nối cơ sở dữ liệu!"));
    }
  };

  // Export to Excel / CSV
  const handleExport = () => {
    if (!data?.items?.length) return;
    void downloadExcel(
      `Bao_Cao_Y_Kien_Phu_Huynh_${new Date().toISOString().slice(0, 10)}.xlsx`,
      [
        [
          "STT",
          "Phụ huynh",
          "Học sinh",
          "Lớp",
          "Bữa ăn",
          "Số sao",
          "Nội dung ý kiến",
          "Trạng thái",
          "Phản hồi từ BGH",
          "Thời gian",
        ],
        ...data.items.map((it, i) => [
          i + 1,
          it.parentNameCustom,
          it.childNameCustom,
          formatCleanClassName(it.classNameCustom),
          formatCleanMealTitle(it.mealTitle, it.mealType),
          it.rating,
          it.content,
          it.status === "PENDING" ? "Chờ phản hồi" : "Đã phản hồi",
          it.responseContent || "",
          formatCleanDateTime(it.feedbackDate, it.feedbackTimeLabel),
        ]),
      ],
      "Báo cáo ý kiến phụ huynh",
    );
  };

  // Helper Pagination calculation
  const totalItems = data?.pagination?.totalItems ?? 0;
  const totalPages = data?.pagination?.totalPages ?? 1;
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const renderPaginationButtons = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else if (currentPage <= 3) {
      pages.push(1, 2, 3, "...", totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(1, "...", totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, "...", currentPage, "...", totalPages);
    }

    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className="w-8 h-8 rounded-xl flex items-center justify-center border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition text-xs cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {pages.map((p, idx) =>
          typeof p === "number" ? (
            <button
              key={idx}
              onClick={() => setCurrentPage(p)}
              className={`w-8 h-8 rounded-xl font-bold text-xs transition cursor-pointer ${
                currentPage === p
                  ? "bg-teal-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {p}
            </button>
          ) : (
            <span
              key={idx}
              className="w-8 h-8 flex items-center justify-center text-slate-400 text-xs"
            >
              ...
            </span>
          ),
        )}

        <button
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
          className="w-8 h-8 rounded-xl flex items-center justify-center border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition text-xs cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4 w-full">
      {/* 1. Interactive KPI Cards (Click to filter directly) */}
      <EvaluationSummaryCards
        stats={data?.summaryStats}
        activeStatus={statusTab}
        onSelectStatus={(tab) => {
          setStatusTab(tab);
          setCurrentPage(1);
        }}
      />

      {/* 2. Compact Action & Filter Toolbar */}
      <EvaluationFilterBar
        onExport={handleExport}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenConfig={() => setIsSurveyModalOpen(true)}
        search={search}
        onSearchChange={(val) => {
          setSearch(val);
          setCurrentPage(1);
        }}
        statusTab={statusTab}
        onStatusTabChange={(tab) => {
          setStatusTab(tab);
          setCurrentPage(1);
        }}
        ratingFilter={ratingFilter}
        onRatingChange={(r) => {
          setRatingFilter(r);
          setCurrentPage(1);
        }}
        mealFilter={mealFilter}
        onMealChange={(m) => {
          setMealFilter(m);
          setCurrentPage(1);
        }}
        classFilter={classFilter}
        onClassChange={(c) => {
          setClassFilter(c);
          setCurrentPage(1);
        }}
        sortBy={sortBy}
        onSortByChange={(s) => {
          setSortBy(s);
          setCurrentPage(1);
        }}
        stats={data?.summaryStats}
        onResetFilters={resetAllFilters}
      />

      {/* 3. Evaluations Table List */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-teal-600 animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500">
            {translateText("Đang tải danh sách ý kiến phụ huynh...")}
          </p>
        </div>
      ) : !data?.items || data.items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
          <p className="font-bold text-sm text-slate-700">
            {translateText("Không tìm thấy ý kiến đánh giá nào phù hợp")}
          </p>
          <p className="text-xs text-slate-400">
            {translateText("Vui lòng thử từ khóa khác hoặc đặt lại bộ lọc tìm kiếm.")}
          </p>
          <button
            type="button"
            onClick={resetAllFilters}
            className="mt-3 px-4 py-2 bg-teal-50 text-teal-700 hover:bg-teal-100 font-bold rounded-xl text-xs transition cursor-pointer"
          >
            {translateText("Đặt lại bộ lọc")}
          </button>
        </div>
      ) : (
        /* TABLE LIST VIEW */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/95 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">{translateText("Phụ huynh & Học sinh")}</th>
                  <th className="py-3 px-3">{translateText("Bữa ăn & Ngày")}</th>
                  <th className="py-3 px-3 text-center">{translateText("Đánh giá")}</th>
                  <th className="py-3 px-4 min-w-[260px]">{translateText("Nội dung ý kiến")}</th>
                  <th className="py-3 px-4 min-w-[240px]">{translateText("Phản hồi từ BGH")}</th>
                  <th className="py-3 px-3 text-center">{translateText("Trạng thái")}</th>
                  <th className="py-3 px-4 text-right">{translateText("Thao tác")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {data.items.map((item, idx) => {
                  const isPending = item.status === "PENDING" || !item.responseContent;
                  const cleanClass = formatCleanClassName(item.classNameCustom);
                  const cleanMeal = formatCleanMealTitle(item.mealTitle, item.mealType);
                  const cleanDate = formatCleanDateTime(item.feedbackDate, item.feedbackTimeLabel);
                  const rowNum = (currentPage - 1) * pageSize + idx + 1;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 transition align-middle ${
                        isPending ? "bg-rose-50/15" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center font-bold text-slate-400">
                        {rowNum}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <strong className="font-bold text-slate-900 block text-xs">
                          {item.parentNameCustom || "Phụ huynh"}
                        </strong>
                        <span className="text-teal-700 font-semibold block mt-0.5 text-[11px]">
                          {item.childNameCustom} · {cleanClass}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className="font-semibold text-slate-800 block">{cleanMeal}</span>
                        <span className="text-slate-400 text-[11px] block mt-0.5">{cleanDate}</span>
                      </td>
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-bold">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>{item.rating.toFixed(1)}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="text-slate-800 font-medium leading-relaxed line-clamp-2">
                          {item.content}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        {isPending ? (
                          <span className="text-slate-400 italic text-[11px]">
                            {translateText("Chưa có nội dung phản hồi")}
                          </span>
                        ) : (
                          <p className="text-slate-700 leading-relaxed line-clamp-2">
                            {item.responseContent}
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[11px]">
                            <Clock className="w-3 h-3" />
                            <span>{translateText("Chờ phản hồi")}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[11px]">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{translateText("Đã phản hồi")}</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveReplyItem(item);
                            setModalReplyText(item.responseContent || "");
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                            isPending
                              ? "bg-teal-600 hover:bg-teal-700 text-white shadow-2xs"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                          }`}
                        >
                          {isPending ? (
                            <>
                              <CornerDownRight className="w-3.5 h-3.5" />
                              <span>{translateText("Phản hồi")}</span>
                            </>
                          ) : (
                            <>
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>{translateText("Sửa")}</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Pagination Section */}
      {data && data.items.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 text-xs text-slate-500">
          <div>
            {translateText("Đang hiển thị")}{" "}
            <span className="font-bold text-slate-800">
              {startItem} - {endItem}
            </span>{" "}
            {translateText("trên tổng số")}{" "}
            <span className="font-bold text-slate-800">{totalItems}</span>{" "}
            {translateText("ý kiến phụ huynh")}
          </div>

          {totalPages > 1 && renderPaginationButtons()}
        </div>
      )}

      {/* Quick Reply Modal for Table View */}
      {activeReplyItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {translateText("Phản hồi ý kiến Phụ huynh")}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeReplyItem.parentNameCustom} · {activeReplyItem.childNameCustom} ·{" "}
                  {formatCleanClassName(activeReplyItem.classNameCustom)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveReplyItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs text-slate-700">
              <span className="font-bold text-slate-900 block mb-1">
                {translateText("Nội dung phụ huynh gửi:")}
              </span>
              “{activeReplyItem.content}”
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Kính gửi gia đình, Ban Giám Hiệu nhà trường xin chân thành cảm ơn ý kiến đóng góp quý báu của Quý Phụ huynh.",
                  "BGH đã trao đổi trực tiếp với Bếp trưởng để điều chỉnh định lượng và gia vị phù hợp cho các con.",
                  "Bộ phận dinh dưỡng đã kiểm tra quy trình lưu mẫu và khẩu phần thực tế hôm nay.",
                ].map((tpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setModalReplyText(tpl)}
                    className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-[11px] font-semibold cursor-pointer"
                  >
                    + {translateText(`Mẫu phản hồi ${i + 1}`)}
                  </button>
                ))}
              </div>
              <textarea
                rows={4}
                value={modalReplyText}
                onChange={(e) => setModalReplyText(e.target.value)}
                placeholder={translateText("Nhập nội dung phản hồi từ Ban Giám Hiệu...")}
                className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveReplyItem(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                {translateText("Đóng")}
              </button>
              <button
                type="button"
                disabled={modalSending || !modalReplyText.trim()}
                onClick={async () => {
                  setModalSending(true);
                  try {
                    await handleRespond(activeReplyItem.id, modalReplyText.trim(), true);
                    setActiveReplyItem(null);
                  } finally {
                    setModalSending(false);
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{translateText(modalSending ? "Đang gửi..." : "Gửi phản hồi")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      <ImagePreviewModal
        isOpen={!!activePhoto}
        photo={activePhoto}
        onClose={() => setActivePhoto(null)}
      />

      {/* Excel Export Reports Modal */}
      <EvaluationExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        currentFilteredItems={data?.items || []}
        summaryStats={data?.summaryStats}
        totalItemsCount={data?.pagination?.totalItems || data?.items?.length || 0}
      />

      {/* Survey Config Modal */}
      <SurveyConfigModal
        isOpen={isSurveyModalOpen}
        onClose={() => setIsSurveyModalOpen(false)}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-slideUp text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{translateText(toastMessage)}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
