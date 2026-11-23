import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState } from "react";
import { Download, Eye, Users, CircleCheck, UtensilsCrossed, ShieldCheck } from "lucide-react";
import { attendanceApi } from "../../attendance/api/attendanceApi";
import { SnackRosterDetailModal } from "../../attendance/components/SnackRosterDetailModal";
import { SnackRosterItem } from "../../attendance/types";
import {
  PageTitle,
  Pager,
  ReloadButton,
  ResourceState,
  useKitchenResource,
} from "../components/KitchenUI";
import { downloadExcel, formatNumber } from "../utils/kitchen-operations";
import { KitchenSummaryCards } from "../components/KitchenSummaryCards";
import { getSchoolDate } from "../utils/kds-data";

export function KitchenSnackRosterPage() {
  useLanguage();
  const [date, setDate] = useState(getSchoolDate);
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [payment, setPayment] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<SnackRosterItem | null>(null);
  const resource = useKitchenResource(
    () =>
      attendanceApi.getSnackRoster({
        date,
        search: search || undefined,
        classId: classId || undefined,
        paymentStatus: payment || undefined,
        page,
        limit: 12,
      }),
    [date, search, classId, payment, page],
  );
  const stats = resource.data?.stats;
  return (
    <>
      {stats && !resource.error && (
        <KitchenSummaryCards metrics={[
          { label: 'Đã đăng ký', value: Number(stats.totalRegistered || 0), icon: Users },
          { label: 'Đủ điều kiện', value: Number(stats.totalEligible || 0), icon: CircleCheck, tone: 'success' },
          { label: 'Suất hôm nay', value: Number(stats.todayTotalPortions || 0), icon: UtensilsCrossed },
          { label: 'Suất ăn riêng', value: Number(stats.specialDietPortions || 0), icon: ShieldCheck, tone: 'warning' },
        ]} />
      )}
      <div className="kp-filters">
        <label>{translateText("Ngày")}<input
            type="date"
            aria-label={translateText("Ngày ăn sáng")}
            value={date}
            onChange={(e) => {
              if (e.target.value) {
                setDate(e.target.value);
                setPage(1);
              }
            }}
          />
        </label>
        <input
          type="search"
          aria-label={translateText("Tìm đăng ký ăn sáng")}
          placeholder={translateText("Tìm học sinh hoặc mã…")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label={translateText("Lớp ăn sáng")}
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{translateText("Tất cả lớp")}</option>
          {resource.data?.classes?.map((c: any) => (
            <option key={c.id} value={c.id}>
              {String(c.name || "").replace(/\s*\([^)]*\)/g, "").trim()}
            </option>
          ))}
        </select>
        <select
          aria-label={translateText("Trạng thái phí ăn sáng")}
          value={payment}
          onChange={(e) => {
            setPayment(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{translateText("Tất cả tình trạng phí")}</option>
          <option value="PAID">{translateText("Đã thanh toán")}</option>
          <option value="PENDING">{translateText("Chưa thanh toán")}</option>
        </select>
        <button
          className="kp-button"
          onClick={() => {
            setSearch("");
            setClassId("");
            setPayment("");
            setPage(1);
          }}
        >{translateText("Xóa bộ lọc")}</button>
        <ReloadButton loading={resource.loading} reload={resource.reload} />
        <button
          className="kp-button"
          disabled={!resource.data?.items?.length}
          onClick={() =>
            downloadExcel(`an-xe-${date}-trang-${page}.xlsx`, [
              [
                "Học sinh",
                "Mã",
                "Lớp",
                "Tình trạng phí",
                "Chế độ ăn",
                "Ghi chú",
              ],
              ...resource.data.items.map((r: any) => [
                r.fullName,
                r.studentCode,
                r.className,
                r.paymentStatusLabel,
                r.snackDietBadgeText,
                r.kitchenNotes,
              ]),
            ])
          }
        >
          <Download size={15} />{translateText("Xuất trang hiện tại")}</button>
      </div>
      <ResourceState
        resource={resource}
        empty={!resource.data?.items?.length}
      />
      {resource.data && (
        <>
          <div className="kp-table-wrap">
            <table className="kp-table">
              <thead>
                <tr>
                  <th>{translateText("Học sinh")}</th>
                  <th>{translateText("Lớp")}</th>
                  <th>{translateText("Tình trạng phí")}</th>
                  <th>{translateText("Suất ăn sáng")}</th>
                  <th>{translateText("Ghi chú bếp")}</th>
                  <th>{translateText("Chi tiết")}</th>
                </tr>
              </thead>
              <tbody>
                {resource.data.items?.map((r: any) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.fullName}</strong>
                      <small>{r.studentCode}</small>
                    </td>
                    <td>{r.className}</td>
                    <td>
                      <span
                        className={`kp-tag ${r.paymentStatus === "PAID" ? "" : "amber"}`}
                      >
                        {translateText(r.paymentStatusLabel || r.paymentStatus)}
                      </span>
                    </td>
                    <td>{translateText(r.snackDietBadgeText || "—")}</td>
                    <td>{r.kitchenNotes || "—"}</td>
                    <td>
                      <button
                        className="kp-button"
                        aria-label={translateText(`Chi tiết đăng ký ${r.fullName}`)}
                        onClick={() => setDetail(r)}
                      >
                        <Eye size={14} />{translateText("Chi tiết")}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager
            page={page}
            total={resource.data.pagination?.totalItems || 0}
            onChange={setPage}
          />
        </>
      )}
      <SnackRosterDetailModal
        isOpen={!!detail}
        item={detail}
        onClose={() => setDetail(null)}
      />
    </>
  );
}
