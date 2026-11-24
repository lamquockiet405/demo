import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useEffect, useState } from "react";
import { Download, Save, StickyNote, School, UtensilsCrossed, CircleCheck, Clock3 } from "lucide-react";
import { apiClient } from "../../../core/api/axios";
import { getSchoolDate, normalizeSearch } from "../utils/kds-data";
import { downloadExcel, formatDateTime, formatNumber, rowsOf } from "../utils/kitchen-operations";
import { KitchenSummaryCards } from "../components/KitchenSummaryCards";
import {
  Modal,
  Notice,
  PageTitle,
  ReloadButton,
  ResourceState,
  useKitchenAction,
  useKitchenResource,
} from "../components/KitchenUI";

export function KitchenPortionsPage() {
  useLanguage();
  const [date, setDate] = useState(getSchoolDate);
  const [meal, setMeal] = useState("LUNCH");
  const [search, setSearch] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [selectedClassNotes, setSelectedClassNotes] = useState<any>(null);
  const resource = useKitchenResource(
    async () =>
      rowsOf(
        (await apiClient.get("/meal-portions", { params: { date } })).data,
      ),
    [date],
  );
  const action = useKitchenAction();
  useEffect(() => {
    const refresh = () => { if (!document.hidden && !action.busy) void resource.reload(); };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [resource.reload, action.busy]);
  const mealLabels: Record<string, string> = {
    BREAKFAST: 'Buổi sáng (09:00)',
    MORNING_SNACK: 'Buổi sáng (09:00)',
    LUNCH: 'Bữa trưa chính (11:00)',
    AFTERNOON_SNACK: 'Buổi phụ (14:30)',
    LATE_SNACK: 'Buổi chiều xế (17:00)',
  };
  const field =
    meal === "BREAKFAST"
      ? "breakfast"
      : meal === "MORNING_SNACK"
        ? "morningSnack"
        : meal === "LUNCH"
          ? "lunch"
          : meal === "LATE_SNACK"
            ? "lateSnack"
            : "afternoonSnack";
  const items = (resource.data || []).filter((r) =>
    normalizeSearch(r.className || "").includes(normalizeSearch(search)),
  );
  const plannedPortions = items.reduce((sum, row) => sum + (Number(row[field]?.planned) || 0), 0);
  const issuedPortions = items.reduce((sum, row) => sum + (Number(row[field]?.actual) || 0), 0);
  const allNotes = (resource.data || []).flatMap((row) =>
    (Array.isArray(row[field]?.notes) ? row[field].notes : [])
      .filter((entry: any) => typeof entry.note === "string" && entry.note.trim())
      .map((entry: any) => ({ ...entry, className: row.className, classId: row.classId })),
  );
  const save = async (item: any) => {
    if (item[field]?.actual != null) return;
    const raw = String(item[field]?.planned ?? "");
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
    }, `Đã xuất ${quantity} suất cho ${item.className}.`);
  };
  return (
    <>
      {showNotes && (
        <Modal title={translateText("Tất cả ghi chú")} onClose={() => setShowNotes(false)}>
          <p className="mb-4 text-sm text-slate-500">{date} · {translateText(mealLabels[meal])} · {allNotes.length} {translateText("ghi chú")}</p>
          <p className="mb-4 text-xs text-slate-500">{translateText("Ghi chú của tất cả các lớp theo ngày và bữa ăn đang chọn.")}</p>
          {allNotes.length ? (
            <div className="kp-table-wrap">
              <table className="kp-table">
                <thead><tr><th>{translateText("Lớp")}</th><th>{translateText("Họ tên bé")}</th><th>{translateText("Ghi chú")}</th></tr></thead>
                <tbody>{allNotes.map((entry, index) => (
                  <tr key={`${entry.classId}-${index}`}>
                    <td><strong>{entry.className}</strong></td>
                    <td>{entry.fullName || "—"}</td>
                    <td className="whitespace-pre-wrap break-words">{entry.note}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p className="py-6 text-center text-slate-500">{translateText("Chưa có ghi chú cho ngày và bữa ăn này.")}</p>}
        </Modal>
      )}
      <Notice error={action.error} message={action.message} />
      {resource.data && !resource.error && (
        <KitchenSummaryCards metrics={[
          { label: 'Lớp trong kế hoạch', value: items.length, icon: School },
          { label: 'Suất theo kế hoạch', value: plannedPortions, icon: UtensilsCrossed },
          { label: 'Suất đã xuất', value: issuedPortions, icon: CircleCheck, tone: 'success' },
          { label: 'Lớp chờ xuất', value: items.filter((row) => row[field]?.planned != null && row[field]?.actual == null).length, icon: Clock3, tone: 'warning' },
        ]} />
      )}
      <div className="kp-filters">
        <label>{translateText("Ngày phục vụ")}<input
            type="date"
            aria-label={translateText("Ngày kế hoạch")}
            disabled={action.busy}
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
          />
        </label>
        <select
          aria-label={translateText("Bữa lập kế hoạch")}
          disabled={action.busy}
          value={meal}
          onChange={(e) => setMeal(e.target.value)}
        >
          <option value="BREAKFAST">{translateText("Buổi sáng (09:00)")}</option>
          <option value="LUNCH">{translateText("Bữa trưa chính (11:00)")}</option>
          <option value="AFTERNOON_SNACK">{translateText("Buổi phụ (14:30)")}</option>
          <option value="LATE_SNACK">{translateText("Buổi chiều xế (17:00)")}</option>
        </select>
        <input
          type="search"
          aria-label={translateText("Tìm lớp lập kế hoạch")}
          placeholder={translateText("Tìm tên lớp…")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ReloadButton loading={resource.loading} reload={resource.reload} />
        <button className="kp-button" disabled={resource.loading || !!resource.error}
          onClick={() => setShowNotes(true)}>
          <StickyNote size={15} />{translateText("Xem tất cả ghi chú")} ({allNotes.length})
        </button>
        <button
          className="kp-button"
          disabled={!items.length}
          onClick={() =>
            downloadExcel(`ke-hoach-suat-an-${date}.xlsx`, [
              ["Ngày", "Lớp", "Bé đã đóng tiền ăn xế", "Bữa", "Số suất yêu cầu", "Giáo viên gửi lúc"],
              ...items.map((r) => [
                date,
                r.className,
                r.paidSnackCount ?? 0,
                mealLabels[meal],
                r[field]?.planned,
                formatDateTime(r[field]?.submittedAt),
              ]),
            ])
          }
        >
          <Download size={15} />{translateText("Xuất kế hoạch")}</button>
      </div>
      <ResourceState resource={resource} empty={!items.length} />
      {resource.data && (
        <div className="kp-table-wrap">
          <table className="kp-table">
            <thead>
              <tr>
                <th>{translateText("Lớp")}</th>
                <th>{translateText("Độ tuổi")}</th>
                <th>{translateText("Bé đã đóng tiền ăn xế")}</th>
                <th>{translateText("Số suất yêu cầu")}</th>
                <th>{translateText("Giáo viên chốt điểm danh")}</th>
                <th>{translateText("Xuất món")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.classId}>
                  <td>
                    <strong>{r.className}</strong>
                  </td>
                  <td>{translateText(r.ageGroup || "—")}</td>
                  <td>
                    <strong className="text-emerald-700">{translateText(formatNumber(r.paidSnackCount ?? 0, 0))}</strong>
                    <span className="text-xs text-slate-500"> {translateText("bé")}</span>
                  </td>
                  <td>{translateText(formatNumber(r[field]?.planned, 0))}</td>
                  <td>
                    {r[field]?.submittedAt ? <>
                      <strong className="text-emerald-700">{translateText("Đã nhận · ")}{translateText(formatDateTime(r[field].submittedAt))}</strong>
                      <p className="text-xs mt-1">{translateText("Có mặt: ")}<b>{r[field].present}</b>{translateText(" · Vắng: ")}<b>{r[field].absent}</b></p>
                      {Array.isArray(r[field].notes) && r[field].notes.length > 0 && (
                        <div className="hidden mt-1.5 flex flex-wrap gap-1">
                          {r[field].notes.map((item: any, i: number) => (
                            <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-300">
                              📝 {item.fullName}: {item.note}
                            </span>
                          ))}
                        </div>
                      )}
                    </> : <span className="text-amber-700">{translateText("Chưa nhận điểm danh cho ngày/bữa này")}</span>}
                  </td>
                  <td>
                    {Array.isArray(r[field]?.notes) && r[field].notes.length > 0 && (
                      <button
                        type="button"
                        className="kp-button mr-2"
                        title={translateText("Xem ghi chú của lớp")}
                        onClick={() => setShowNotes(true)}
                      >
                        <StickyNote size={14} />{translateText("Ghi chú (")}{r[field].notes.length})
                      </button>
                    )}
                    <button
                      className="kp-button primary"
                      disabled={action.busy || resource.loading || r[field]?.planned == null || r[field]?.actual != null}
                      onClick={() => void save(r)}
                    >
                      <Save size={14} />{r[field]?.actual != null ? translateText("Đã xuất món") : translateText("Xuất món")}</button>
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
