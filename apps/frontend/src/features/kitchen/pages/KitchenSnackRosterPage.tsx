import React, { useState } from "react";
import { Download, Eye } from "lucide-react";
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
import { downloadCsv, formatNumber } from "../utils/kitchen-operations";
import { getSchoolDate } from "../utils/kds-data";

export function KitchenSnackRosterPage() {
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
      <PageTitle
        title="Danh sách đăng ký ăn phụ"
        description="Tra cứu đăng ký, tình trạng phí và yêu cầu ăn phụ để chuẩn bị suất theo từng lớp."
      >
        <ReloadButton loading={resource.loading} reload={resource.reload} />
        <button
          className="kp-button"
          disabled={!resource.data?.items?.length}
          onClick={() =>
            downloadCsv(`an-phu-${date}-trang-${page}.csv`, [
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
          <Download size={15} />
          Xuất trang hiện tại
        </button>
      </PageTitle>
      <div className="kp-stats">
        {[
          ["Đã đăng ký", stats?.totalRegistered],
          ["Đủ điều kiện", stats?.totalEligible],
          ["Suất hôm nay", stats?.todayTotalPortions],
          ["Suất ăn riêng", stats?.specialDietPortions],
        ].map(([label, value]) => (
          <div className="kp-stat" key={String(label)}>
            <span>{label}</span>
            <strong>{formatNumber(value, 0)}</strong>
          </div>
        ))}
      </div>
      <div className="kp-filters">
        <label>
          Ngày
          <input
            type="date"
            aria-label="Ngày ăn phụ"
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
          aria-label="Tìm đăng ký ăn phụ"
          placeholder="Tìm học sinh hoặc mã…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="Lớp ăn phụ"
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tất cả lớp</option>
          {resource.data?.classes?.map((c: any) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Trạng thái phí ăn phụ"
          value={payment}
          onChange={(e) => {
            setPayment(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tất cả tình trạng phí</option>
          <option value="PAID">Đã thanh toán</option>
          <option value="UNPAID">Chưa thanh toán</option>
        </select>
        <button
          className="kp-button"
          onClick={() => {
            setSearch("");
            setClassId("");
            setPayment("");
            setPage(1);
          }}
        >
          Xóa bộ lọc
        </button>
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
                  <th>Học sinh</th>
                  <th>Lớp</th>
                  <th>Tình trạng phí</th>
                  <th>Suất ăn phụ</th>
                  <th>Ghi chú bếp</th>
                  <th>Chi tiết</th>
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
                        {r.paymentStatusLabel || r.paymentStatus}
                      </span>
                    </td>
                    <td>{r.snackDietBadgeText || "—"}</td>
                    <td>{r.kitchenNotes || "—"}</td>
                    <td>
                      <button
                        className="kp-button"
                        aria-label={`Chi tiết đăng ký ${r.fullName}`}
                        onClick={() => setDetail(r)}
                      >
                        <Eye size={14} />
                        Chi tiết
                      </button>
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
