import { t as translateText, getLocale } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState } from "react";
import { foodSafetyApi } from "../../food-safety/api/food-safety.api";
import { parentEvaluationSummaryApi } from "../../parent-evaluations/api/parent-evaluation-summary.api";
import { schoolDate } from "../../menus/utils/published-menus";
import {
  Feedback,
  SchoolPage,
  State,
  useSchoolResource,
  useSchoolAction,
} from "../../school/components/SchoolUI";

const value = (n: unknown) => (n == null ? "Chưa có dữ liệu" : String(n));
export function NutritionReportsPage({
  kind,
}: {
  kind: "safety" | "evaluations";
}) {
  useLanguage();
  const [date, setDate] = useState(schoolDate),
    [month, setMonth] = useState(() => schoolDate().slice(0, 7));
  const safety = kind === "safety",
    params = {
      month: Number(month.slice(5, 7)),
      year: Number(month.slice(0, 4)),
    };
  const resource = useSchoolResource<any>(
    () =>
      safety
        ? foodSafetyApi.getComplianceReport(date)
        : parentEvaluationSummaryApi.getSummaryReport(params),
    [kind, date, month],
  );
  const action = useSchoolAction(),
    report = resource.error ? null : resource.data;
  const exportReport = () =>
    action.run(async () => {
      const data = safety
        ? await foodSafetyApi.exportComplianceDossier(date)
        : await parentEvaluationSummaryApi.exportSummaryReport(params);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `bao-cao-${kind}-${safety ? date : month}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }, "Đã xuất báo cáo.");
  return (
    <SchoolPage
      title={
        translateText(safety ? "Báo cáo an toàn thực phẩm" : "Báo cáo đánh giá phụ huynh")
      }
      description={
        translateText(safety
          ? "Tra cứu kiểm thực, ảnh minh chứng và mẫu lưu thực tế. Chỉ số chưa có nguồn ghi nhận được để trống."
          : "Tổng hợp đánh giá, tỷ lệ phản hồi và các ý kiến đã nhận từ phụ huynh.")
      }
      actions={
        <>
          <button
            className="kp-button"
            disabled={resource.loading}
            onClick={resource.reload}
          >{translateText("Làm mới")}</button>
          <button
            className="kp-button primary"
            disabled={action.busy || !report}
            onClick={() => void exportReport()}
          >{translateText("Xuất báo cáo")}</button>
        </>
      }
    >
      <Feedback error={action.error} message={action.message} />
      <div className="kp-filters">
        {safety ? (
          <label>{translateText("Ngày kiểm thực")}<input
              aria-label={translateText("Ngày báo cáo an toàn")}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        ) : (
          <label>{translateText("Tháng báo cáo")}<input
              aria-label={translateText("Tháng báo cáo đánh giá")}
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </label>
        )}
      </div>
      <State resource={resource} />
      {report &&
        (safety ? (
          <>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                [
                  translateText("Biên bản trong tháng"),
                  report.inspection3Step.photoAuditTrail.totalInspections,
                ],
                [
                  translateText("Biên bản có ảnh"),
                  report.inspection3Step.photoAuditTrail.withPhotoCount,
                ],
                [
                  translateText("Mẫu lưu ngày chọn"),
                  report.sampleRetention24h.totalSamplesStored,
                ],
              ].map(([label, n]) => (
                <article key={label} className="border rounded-xl bg-white p-5">
                  <p className="text-sm text-slate-500">{translateText(label)}</p>
                  <strong className="text-2xl">{translateText(value(n))}</strong>
                </article>
              ))}
            </div>
            <h2 className="font-bold">{translateText("Ảnh minh chứng ngày chọn")}</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {report.inspection3Step.photoAuditTrail.samplePhotos.map(
                (p: any, i: number) => (
                  <a
                    className="bg-white border rounded-xl p-3"
                    href={p.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    key={i}
                  >
                    <img
                      src={p.imageUrl}
                      className="w-full h-40 object-contain"
                      alt={translateText(p.title)}
                    />
                    <p className="text-sm mt-2">{translateText(p.step)}</p>
                  </a>
                ),
              )}
            </div>
            {!report.inspection3Step.photoAuditTrail.samplePhotos.length && (
              <p className="text-sm text-slate-500">{translateText("Chưa có ảnh minh chứng cho ngày chọn.")}</p>
            )}
            <h2 className="font-bold">{translateText("Mẫu lưu đã ghi nhận")}</h2>
            <div className="space-y-3">
              {report.sampleRetention24h.samples.map((s: any) => (
                <article
                  className="border rounded-xl bg-white p-4 text-sm"
                  key={s.id}
                >
                  <strong>{s.dishName}</strong>
                  <p>
                    {s.sampleCode} · {translateText(s.weightOrVolume)} · {translateText(s.status)}
                  </p>
                  <p>{translateText("Lưu lúc:")}{" "}
                    {translateText(s.storedAt
                      ? new Date(s.storedAt).toLocaleString(getLocale())
                      : "Chưa ghi nhận")}
                  </p>
                </article>
              ))}
            </div>
            {!report.sampleRetention24h.samples.length && (
              <p className="text-sm text-slate-500">{translateText("Chưa có mẫu lưu cho ngày chọn.")}</p>
            )}
          </>
        ) : (
          <>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                [translateText("Đánh giá đã nhận"), report.overallCsat.totalEvaluations],
                [translateText("Điểm trung bình"), report.overallCsat.averageRating],
                [translateText("Đánh giá chưa phản hồi"), report.slaPerformance.pendingCount],
              ].map(([label, n]) => (
                <article className="border rounded-xl bg-white p-5" key={label}>
                  <p className="text-sm text-slate-500">{translateText(label)}</p>
                  <strong className="text-2xl">{translateText(value(n))}</strong>
                </article>
              ))}
            </div>
            <h2 className="font-bold">{translateText("Ý kiến gần đây")}</h2>
            {report.recentFeedbacks.map((r: any) => (
              <article
                className="bg-white border rounded-xl p-5 space-y-2"
                key={r.evaluationId}
              >
                <h3 className="font-semibold">
                  {r.studentName} · {r.className}
                </h3>
                <p className="text-xs text-slate-500">
                  {translateText(r.rating)}{translateText(" sao · ")}{translateText(r.status)} ·{" "}
                  {translateText(new Date(r.createdAt).toLocaleString(getLocale()))}
                </p>
                <p className="text-sm">
                  {translateText(r.comment || "Không có nội dung nhận xét.")}
                </p>
                {r.responseContent && (
                  <p className="bg-teal-50 text-sm p-3 rounded-lg">
                    {r.respondedByName}: {r.responseContent}
                  </p>
                )}
              </article>
            ))}
            {!report.recentFeedbacks.length && (
              <p className="text-sm text-slate-500">{translateText("Chưa có đánh giá trong kỳ chọn.")}</p>
            )}
          </>
        ))}
    </SchoolPage>
  );
}
