import React, { useEffect, useState } from "react";
import { Download, Save } from "lucide-react";
import { apiClient } from "../../../core/api/axios";
import { getSchoolDate, normalizeSearch } from "../utils/kds-data";
import { downloadCsv, formatDateTime, formatNumber, rowsOf } from "../utils/kitchen-operations";
import {
  Notice,
  PageTitle,
  ReloadButton,
  ResourceState,
  useKitchenAction,
  useKitchenResource,
} from "../components/KitchenUI";

export function KitchenPortionsPage() {
  const [date, setDate] = useState(getSchoolDate);
  const [meal, setMeal] = useState("LUNCH");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const resource = useKitchenResource(
    async () =>
      rowsOf(
        (await apiClient.get("/meal-portions", { params: { date } })).data,
      ),
    [date],
  );
  const action = useKitchenAction();
  useEffect(() => {
    setDraft({});
  }, [date, meal]);
  useEffect(() => {
    const refresh = () => { if (!document.hidden && !action.busy) void resource.reload(); };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [resource.reload, action.busy]);
  const mealLabels: Record<string, string> = { BREAKFAST: 'Buổi sáng (09:00)', MORNING_SNACK: 'Buổi sáng (09:00)', LUNCH: 'Bữa trưa', AFTERNOON_SNACK: 'Ăn phụ chiều' };
  const field =
    meal === "BREAKFAST"
      ? "breakfast"
      : meal === "MORNING_SNACK" ? "morningSnack"
      : meal === "LUNCH"
        ? "lunch"
        : "afternoonSnack";
  const items = (resource.data || []).filter((r) =>
    normalizeSearch(r.className || "").includes(normalizeSearch(search)),
  );
  const save = async (item: any) => {
    const raw = draft[item.classId] ?? String(item[field]?.actual ?? "");
    if (!raw.trim() || !Number.isSafeInteger(Number(raw)) || Number(raw) < 0) {
      await action.run(async () => {
        throw new Error("Số suất phải là số nguyên không âm.");
      });
      return;
    }
    const quantity = Number(raw);
    const capturedDate = date;
    const capturedMeal = meal;
    await action.run(async () => {
      await apiClient.put("/meal-portions", {
        classId: Number(item.classId),
        date: capturedDate,
        mealType: capturedMeal,
        actualQuantity: quantity,
      });
      resource.setData(
        (previous) =>
          previous?.map((row) =>
            row.classId === item.classId
              ? { ...row, [field]: { ...row[field], actual: quantity } }
              : row,
          ) || null,
      );
    }, `Đã đăng ký ${quantity} suất cho ${item.className}.`);
  };
  return (
    <>
      <PageTitle
        title="Kế hoạch suất ăn hằng ngày"
        description="Nhận số suất giáo viên chốt theo lớp, ngày và bữa ăn; ghi nhận số suất bếp chuẩn bị. Tự làm mới mỗi 30 giây."
      >
        <ReloadButton loading={resource.loading} reload={resource.reload} />
        <button
          className="kp-button"
          disabled={!items.length}
          onClick={() =>
            downloadCsv(`ke-hoach-suat-an-${date}.csv`, [
              ["Ngày", "Lớp", "Bữa", "Số suất yêu cầu", "Bếp chuẩn bị", "Giáo viên gửi lúc"],
              ...items.map((r) => [
                date,
                r.className,
                mealLabels[meal],
                r[field]?.planned,
                r[field]?.actual,
                formatDateTime(r[field]?.submittedAt),
              ]),
            ])
          }
        >
          <Download size={15} />
          Xuất kế hoạch
        </button>
      </PageTitle>
      <Notice error={action.error} message={action.message} />
      <div className="kp-filters">
        <label>
          Ngày phục vụ
          <input
            type="date"
            aria-label="Ngày kế hoạch"
            disabled={action.busy}
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
          />
        </label>
        <select
          aria-label="Bữa lập kế hoạch"
          disabled={action.busy}
          value={meal}
          onChange={(e) => setMeal(e.target.value)}
        >
          <option value="BREAKFAST">Buổi sáng (09:00)</option>
          <option value="LUNCH">Bữa trưa chính</option>
          <option value="AFTERNOON_SNACK">Bữa phụ xế</option>
        </select>
        <input
          type="search"
          aria-label="Tìm lớp lập kế hoạch"
          placeholder="Tìm tên lớp…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <ResourceState resource={resource} empty={!items.length} />
      {resource.data && (
        <div className="kp-table-wrap">
          <table className="kp-table">
            <thead>
              <tr>
                <th>Lớp</th>
                <th>Độ tuổi</th>
                <th>Số suất yêu cầu</th>
                <th>Giáo viên chốt điểm danh</th>
                <th>Đã đăng ký bếp chuẩn bị</th>
                <th>Số suất chuẩn bị</th>
                <th>Lưu</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.classId}>
                  <td>
                    <strong>{r.className}</strong>
                  </td>
                  <td>{r.ageGroup || "—"}</td>
                  <td>{formatNumber(r[field]?.planned, 0)}</td>
                  <td>
                    {r[field]?.submittedAt ? <>
                      <strong className="text-emerald-700">Đã nhận · {formatDateTime(r[field].submittedAt)}</strong>
                      <p className="text-xs mt-1">Có mặt: {r[field].present} · Vắng: {r[field].absent}</p>
                      {(r[field].notes || []).map((item: any, i: number) => <p className="text-xs mt-1" key={i}>{item.fullName}: {item.note}</p>)}
                    </> : <span className="text-amber-700">Chưa nhận điểm danh cho ngày/bữa này</span>}
                  </td>
                  <td>{formatNumber(r[field]?.actual, 0)}</td>
                  <td>
                    <input
                      className="kp-input"
                      type="number"
                      min={0}
                      step={1}
                      disabled={action.busy || resource.loading || r[field]?.planned == null}
                      aria-label={`Số suất ${r.className}`}
                      value={draft[r.classId] ?? r[field]?.actual ?? ""}
                      onChange={(e) =>
                        setDraft({ ...draft, [r.classId]: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <button
                      className="kp-button primary"
                      disabled={action.busy || resource.loading || r[field]?.planned == null}
                      onClick={() => void save(r)}
                    >
                      <Save size={14} />
                      Đăng ký
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
