import { t as translateText, getLocale } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
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
  useLanguage();
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
      title={translateText("Lịch sử thanh toán & nhắc phí")}
      description={translateText("Tra cứu hóa đơn, thời điểm thanh toán và gửi nhắc phí cho hóa đơn đang chờ thanh toán.")}
      actions={
        <button
          className="kp-button"
          disabled={resource.loading}
          onClick={resource.reload}
        >{translateText("Làm mới")}</button>
      }
    >
      <Feedback error={action.error} message={action.message} />
      <div className="kp-filters">
        <input
          aria-label={translateText("Tìm hóa đơn")}
          placeholder={translateText("Tên học sinh, phụ huynh, lớp, mã hóa đơn…")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label={translateText("Trạng thái thanh toán")}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">{translateText("Tất cả trạng thái")}</option>
          <option value="PENDING">{translateText("Chờ thanh toán")}</option>
          <option value="PAID">{translateText("Đã thanh toán")}</option>
          <option value="SUCCESS">{translateText("Thành công")}</option>
          <option value="FAILED">{translateText("Thất bại")}</option>
        </select>
        <label>{translateText("Ngày thanh toán")}<input
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
                  translateText("Hóa đơn"),
                  translateText("Học sinh / lớp"),
                  translateText("Phụ huynh"),
                  translateText("Gói dịch vụ"),
                  translateText("Số tiền"),
                  translateText("Trạng thái"),
                  translateText("Thanh toán lúc"),
                  translateText("Thao tác"),
                ].map((s) => (
                  <th key={s} className="p-3 whitespace-nowrap">
                    {translateText(s)}
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
                    {translateText(r.packageName || r.periodName || "—")}
                  </td>
                  <td className="p-3">
                    {translateText(r.amount == null
                      ? "—"
                      : Number(r.amount).toLocaleString(getLocale()) + " ₫")}
                  </td>
                  <td className="p-3">{translateText(r.status)}</td>
                  <td className="p-3">
                    {translateText(r.paidAt
                      ? new Date(r.paidAt).toLocaleString(getLocale())
                      : "Chưa thanh toán")}
                  </td>
                  <td className="p-3">
                    {r.status === "PENDING" && (
                      <button
                        className="kp-button"
                        disabled={action.busy}
                        onClick={() => void remind(String(r.id))}
                      >{translateText("Nhắc phí")}</button>
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
