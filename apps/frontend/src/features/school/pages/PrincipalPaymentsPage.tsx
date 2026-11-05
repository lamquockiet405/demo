import React, { useState } from "react";
import { apiClient } from "../../../core/api/axios";
import { rowsOf } from "../../kitchen/utils/kitchen-operations";
import {
  SchoolPage,
  Feedback,
  State,
  useSchoolResource,
  useSchoolAction,
} from "../components/SchoolUI";
export function PrincipalPaymentsPage() {
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [date, setDate] = useState("");
  const resource = useSchoolResource(
      async () => rowsOf((await apiClient.get("/payments/invoices")).data),
      [],
    ),
    action = useSchoolAction();
  const rows = (resource.error ? [] : resource.data || []).filter(
    (r) =>
      (!status || r.status === status) &&
      (!date || r.paidAt?.slice(0, 10) === date) &&
      `${r.orderCode} ${r.invoiceCode} ${r.childName} ${r.parentName} ${r.className}`
        .toLocaleLowerCase("vi")
        .includes(search.trim().toLocaleLowerCase("vi")),
  );
  const remind = (id: string) =>
    action.run(async () => {
      const res = await apiClient.post(
        `/payments/invoices/${encodeURIComponent(id)}/remind`,
      );
      if (res.data?.success === false)
        throw new Error(res.data.message || "Không gửi được nhắc phí.");
    }, "Đã ghi nhận yêu cầu nhắc phí.");
  return (
    <SchoolPage
      title="Lịch sử thanh toán & nhắc phí"
      description="Tra cứu hóa đơn, thời điểm thanh toán và gửi nhắc phí cho hóa đơn đang chờ thanh toán."
      actions={
        <button
          className="kp-button"
          disabled={resource.loading}
          onClick={resource.reload}
        >
          Làm mới
        </button>
      }
    >
      <Feedback error={action.error} message={action.message} />
      <div className="kp-filters">
        <input
          aria-label="Tìm hóa đơn"
          placeholder="Tên học sinh, phụ huynh, lớp, mã hóa đơn…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Trạng thái thanh toán"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="PENDING">Chờ thanh toán</option>
          <option value="PAID">Đã thanh toán</option>
          <option value="SUCCESS">Thành công</option>
          <option value="FAILED">Thất bại</option>
        </select>
        <label>
          Ngày thanh toán
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>
      <State resource={resource} empty={!rows.length} />
      {!!rows.length && (
        <div className="overflow-auto bg-white border rounded-xl">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50">
              <tr>
                {[
                  "Hóa đơn",
                  "Học sinh / lớp",
                  "Phụ huynh",
                  "Gói dịch vụ",
                  "Số tiền",
                  "Trạng thái",
                  "Thanh toán lúc",
                  "Thao tác",
                ].map((s) => (
                  <th key={s} className="p-3 whitespace-nowrap">
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{r.invoiceCode || r.orderCode}</td>
                  <td className="p-3">
                    {r.childName}
                    <br />
                    {r.className}
                  </td>
                  <td className="p-3">
                    {r.parentName || "—"}
                    <br />
                    {r.parentPhone}
                  </td>
                  <td className="p-3">
                    {r.packageName || r.periodName || "—"}
                  </td>
                  <td className="p-3">
                    {r.amount == null
                      ? "—"
                      : Number(r.amount).toLocaleString("vi-VN") + " ₫"}
                  </td>
                  <td className="p-3">{r.status}</td>
                  <td className="p-3">
                    {r.paidAt
                      ? new Date(r.paidAt).toLocaleString("vi-VN")
                      : "Chưa thanh toán"}
                  </td>
                  <td className="p-3">
                    {r.status === "PENDING" && (
                      <button
                        className="kp-button"
                        disabled={action.busy}
                        onClick={() => void remind(String(r.id))}
                      >
                        Nhắc phí
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SchoolPage>
  );
}
