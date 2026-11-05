import React, { useState } from "react";
import { apiClient } from "../../../core/api/axios";
import { fetchKitchenCollection } from "../../kitchen/api/kitchen.api";
import {
  Feedback,
  SchoolPage,
  State,
  useSchoolAction,
  useSchoolResource,
} from "../../school/components/SchoolUI";

export function MenuEvaluationPage() {
  const menus = useSchoolResource(() => fetchKitchenCollection("/menus"), []);
  const [menuId, setMenuId] = useState(""),
    [result, setResult] = useState<any>(null);
  const action = useSchoolAction();
  const evaluate = () =>
    action.run(async () => {
      if (!menuId) throw new Error("Chọn thực đơn cần đánh giá.");
      setResult(null);
      setResult(
        (
          await apiClient.post("/rule-engine/evaluate-menu", {
            menuId: Number(menuId),
          })
        ).data,
      );
    }, "Đã hoàn tất đánh giá thực đơn.");
  return (
    <SchoolPage
      title="Đánh giá thực đơn theo 6 tiêu chí"
      description="Đối chiếu thực đơn đã chọn với tiêu chuẩn và quy tắc đang cấu hình. Mục thiếu dữ liệu được ghi rõ, không tự kết luận đạt."
    >
      <Feedback error={action.error} message={action.message} />
      <State resource={menus} />
      <div className="kp-filters">
        <select
          aria-label="Thực đơn cần đánh giá"
          value={menuId}
          onChange={(e) => {
            setMenuId(e.target.value);
            setResult(null);
          }}
        >
          <option value="">Chọn thực đơn</option>
          {(menus.data || []).map((m) => (
            <option key={m.id} value={m.id}>
              {m.title} · v{m.version} · {m.status}
            </option>
          ))}
        </select>
        <button
          className="kp-button primary"
          disabled={!menuId || action.busy}
          onClick={() => void evaluate()}
        >
          {action.busy ? "Đang đánh giá…" : "Kiểm tra 6 tiêu chí"}
        </button>
      </div>
      {result && (
        <>
          <h2 className="font-bold">{result.menuTitle}</h2>
          <p className="text-sm text-slate-500">
            Điểm trên các tiêu chí đã đủ dữ liệu:{" "}
            {result.complianceScore ?? "—"}% · {result.overallStatus}
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {(result.criteria || []).map((c: any) => (
              <article
                key={c.key}
                className={`rounded-xl p-5 border ${c.status === "FAIL" ? "bg-rose-50 border-rose-200" : c.status === "UNKNOWN" ? "bg-amber-50 border-amber-200" : "bg-white"}`}
              >
                <div className="flex gap-3 justify-between">
                  <h3 className="font-semibold">{c.name}</h3>
                  <span className="text-xs">
                    {c.status === "PASS"
                      ? "Đạt"
                      : c.status === "FAIL"
                        ? "Cần điều chỉnh"
                        : "Chưa đủ dữ liệu"}
                  </span>
                </div>
                <ul className="mt-3 text-sm space-y-2">
                  {c.findings.map((s: string, i: number) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </>
      )}
    </SchoolPage>
  );
}
