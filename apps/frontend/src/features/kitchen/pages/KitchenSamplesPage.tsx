import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState } from "react";
import { Download, Eye, Plus, Camera, Image as ImageIcon, X } from "lucide-react";
import { apiClient } from "../../../core/api/axios";
import { useAuthStore } from "../../../core/stores/auth.store";
import { useSchoolBranding } from "../../../core/hooks/useSchoolBranding";
import { getSchoolDate, normalizeSearch } from "../utils/kds-data";
import {
  downloadCsv,
  formatDateTime,
  formatNumber,
  getSampleState,
  sampleDueAt,
  rowsOf,
  prepareProofImage,
} from "../utils/kitchen-operations";
import {
  Modal,
  Notice,
  PageTitle,
  ReloadButton,
  ResourceState,
  useKitchenAction,
  useKitchenResource,
} from "../components/KitchenUI";

export function KitchenSamplesPage({
  audience = "kitchen",
}: {
  audience?: "kitchen" | "principal" | "nutritionist";
}) {
  useLanguage();
  const { user } = useAuthStore();
  const schoolBranding = useSchoolBranding();
  const retentionHours = schoolBranding.operationalSettings?.foodRetentionHours || 24;

  const labels: Record<string, string> = {
    STORED: "Đang lưu",
    DUE: `Đủ ${retentionHours} giờ, chờ hủy`,
    DISPOSED: "Đã hủy",
    UNKNOWN: "Chưa rõ thời gian lưu",
  };
  const canDispose = (user?.roles || []).some((role) =>
    [
      "KITCHEN_STAFF",
      "KITCHEN_MANAGER",
      "SUPER_ADMIN",
      "PRINCIPAL",
      "SCHOOL_MANAGER",
      "SCHOOL_MANAGEMENT",
    ].includes(role),
  );
  const resource = useKitchenResource(
    async () => ({
      items: rowsOf((await apiClient.get("/inspections/samples")).data),
      loadedAt: Date.now(),
    }),
    [],
  );
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("");
  const [create, setCreate] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [dispose, setDispose] = useState<any>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [form, setForm] = useState({
    dishName: "",
    date: getSchoolDate(),
    sampleCode: "",
    sampleWeightG: "",
    storageTemp: "",
    fridgeUnit: "",
    note: "",
    imageUrl: "",
  });
  const action = useKitchenAction();
  const now = resource.data?.loadedAt ?? Date.now();
  const all = resource.data?.items || [];
  const due = all.filter((r) => getSampleState(r, now, retentionHours) === "DUE");
  const rows = all.filter(
    (r) =>
      (!date || (r.mealDate || r.date) === date) &&
      (!status || getSampleState(r, now, retentionHours) === status) &&
      normalizeSearch(
        `${r.sampleCode || r.code} ${r.dishName} ${r.collectorName}`,
      ).includes(normalizeSearch(search)),
  );
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    await action.run(async () => {
      if (
        !form.dishName.trim() ||
        !form.storageTemp.trim() ||
        !Number.isFinite(Number(form.sampleWeightG)) ||
        Number(form.sampleWeightG) <= 0 ||
        !Number.isFinite(Number(form.storageTemp))
      )
        throw new Error("Nhập tên món, khối lượng dương và nhiệt độ hợp lệ.");
      await apiClient.post("/inspections/samples", {
        ...form,
        dishName: form.dishName.trim(),
        sampleCode: form.sampleCode || undefined,
        sampleWeightG: Number(form.sampleWeightG),
        storageTemp: Number(form.storageTemp),
        collectorName: user?.fullName || "Nhân viên bếp",
        imageUrl: form.imageUrl || undefined,
      });
      setCreate(false);
      await resource.reload();
    }, "Đã lưu thông tin niêm phong mẫu.");
  };
  const destroy = async () => {
    await action.run(async () => {
      if (!canDispose)
        throw new Error("Tài khoản chưa được cấp quyền hủy mẫu.");
      const current = (
        await apiClient.get(`/inspections/samples/${dispose.id}`)
      ).data;
      if (getSampleState(current, Date.now(), retentionHours) !== "DUE")
        throw new Error(
          `Mẫu chưa đủ thời gian lưu ${retentionHours} giờ hoặc đã được hủy. Vui lòng tải lại.`,
        );
      await apiClient.patch(`/inspections/samples/${dispose.id}/dispose`);
      setDispose(null);
      await resource.reload();
    }, "Đã ghi nhận hủy mẫu lưu.");
  };
  return (
    <>
      <PageTitle
        eyebrow={
          translateText(audience === "principal"
            ? "BAN GIÁM HIỆU"
            : audience === "nutritionist"
              ? "CHUYÊN GIA DINH DƯỠNG"
              : undefined)
        }
        title={translateText(`Lưu mẫu thực phẩm ${retentionHours} giờ`)}
        description={translateText(`Quản lý mẫu niêm phong, tra cứu thời gian lưu và xác nhận hủy khi đủ ${retentionHours} giờ. Thời hạn được kiểm tra khi tải dữ liệu.`)}
      >
        <ReloadButton loading={resource.loading} reload={resource.reload} />
        <button
          className="kp-button"
          disabled={!rows.length}
          onClick={() =>
            downloadCsv("bao-cao-luu-mau-an-toan.csv", [
              [
                "Mã mẫu",
                "Món",
                "Ngày",
                "Khối lượng (g)",
                "Nhiệt độ (°C)",
                "Lưu lúc",
                `Đủ ${retentionHours} giờ lúc`,
                "Trạng thái",
                "Người lấy",
                "Tủ lưu",
              ],
              ...rows.map((r) => [
                r.sampleCode || r.code,
                r.dishName,
                r.mealDate || r.date,
                r.sampleWeight,
                r.storageTemp ?? r.temperatureC,
                formatDateTime(r.storedAt),
                r.storedAt ? formatDateTime(sampleDueAt(r.storedAt, retentionHours)) : "",
                labels[getSampleState(r, now, retentionHours)],
                r.collectorName,
                r.fridgeUnit,
              ]),
            ])
          }
        >
          <Download size={15} />{translateText("Xuất báo cáo an toàn")}</button>
        <button className="kp-button primary" onClick={() => setCreate(true)}>
          <Plus size={16} />{translateText("Niêm phong mẫu")}</button>
      </PageTitle>
      <Notice error={action.error} message={action.message} />
      {due.length > 0 && (
        <div className="kp-notice error" role="status">
          <span>
            <b>{due.length}{translateText(` mẫu đã đủ ${retentionHours} giờ, cần kiểm tra trước khi hủy.`)}</b>{" "}
            <button
              className="underline"
              onClick={() => {
                setStatus("DUE");
                setDate("");
                setSearch("");
              }}
            >{translateText("Xem mẫu chờ hủy")}</button>
          </span>
        </div>
      )}
      <div className="kp-filters">
        <input
          type="search"
          aria-label={translateText("Tìm mẫu lưu")}
          placeholder={translateText("Tìm mã mẫu, món, người lấy…")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label>{translateText("Ngày lấy mẫu")}<input
            type="date"
            aria-label={translateText("Ngày mẫu lưu")}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <select
          aria-label={translateText("Trạng thái mẫu lưu")}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">{translateText("Tất cả trạng thái")}</option>
          {Object.entries(labels).map(([id, label]) => (
            <option key={id} value={id}>
              {translateText(label)}
            </option>
          ))}
        </select>
        <button
          className="kp-button"
          onClick={() => {
            setSearch("");
            setDate("");
            setStatus("");
          }}
        >{translateText("Xóa bộ lọc")}</button>
      </div>
      <ResourceState resource={resource} empty={!rows.length} />
      <div className="kp-table-wrap">
        <table className="kp-table">
          <thead>
            <tr>
              <th>{translateText("Mẫu / món")}</th>
              <th>{translateText("Khối lượng / nhiệt độ")}</th>
              <th>{translateText("Thời điểm lưu")}</th>
              <th>{translateText("Đủ 24 giờ")}</th>
              <th>{translateText("Trạng thái")}</th>
              <th>{translateText("Thao tác")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const state = getSampleState(r, now);
              return (
                <tr key={r.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      {r.imageUrl ? (
                        <img
                          src={r.imageUrl}
                          alt={r.dishName}
                          className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 cursor-pointer shadow-sm hover:scale-105 transition"
                          onClick={() => setDetail(r)}
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 cursor-pointer"
                          onClick={() => setDetail(r)}
                        >
                          <ImageIcon size={18} />
                        </div>
                      )}
                      <div>
                        <strong>{r.sampleCode || r.code}</strong>
                        <small>{r.dishName}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    {translateText(formatNumber(r.sampleWeight))}{translateText(" g")}<small>
                      {translateText(formatNumber(r.storageTemp ?? r.temperatureC))}{translateText(" °C")}</small>
                  </td>
                  <td>
                    {translateText(formatDateTime(r.storedAt))}
                    <small>{r.collectorName}</small>
                  </td>
                  <td>
                    {translateText(r.storedAt && Number.isFinite(Date.parse(r.storedAt))
                      ? formatDateTime(sampleDueAt(r.storedAt, retentionHours))
                      : "—")}
                  </td>
                  <td>
                    <span
                      className={`kp-tag ${state === "DUE" ? "red" : state === "DISPOSED" ? "gray" : ""}`}
                    >
                      {translateText(labels[state])}
                    </span>
                  </td>
                  <td>
                    <div className="kp-actions">
                      <button
                        className="kp-button"
                        disabled={action.busy}
                        aria-label={translateText(`Chi tiết mẫu ${r.sampleCode || r.code}`)}
                        onClick={() =>
                          void action.run(
                            async () =>
                              setDetail(
                                (
                                  await apiClient.get(
                                    `/inspections/samples/${r.id}`,
                                  )
                                ).data,
                              ),
                            "Đã tải chi tiết mẫu.",
                          )
                        }
                      >
                        <Eye size={14} />{translateText("Chi tiết")}</button>
                      {canDispose && (
                        <button
                          className="kp-button danger"
                          disabled={state !== "DUE" || action.busy}
                          onClick={() => setDispose(r)}
                        >{translateText("Hủy mẫu")}</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {create && (
        <Modal
          title={translateText("Niêm phong mẫu lưu")}
          busy={action.busy}
          onClose={() => setCreate(false)}
        >
          <Notice error={action.error} />
          <form onSubmit={save}>
            <div className="kp-form-grid">
              <label className="kp-field full">{translateText("Tên món")}<input
                  className="kp-input"
                  required
                  maxLength={200}
                  value={form.dishName}
                  onChange={(e) =>
                    setForm({ ...form, dishName: e.target.value })
                  }
                />
              </label>
              <label className="kp-field">{translateText("Ngày lấy mẫu")}<input
                  className="kp-input"
                  required
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </label>
              <label className="kp-field">{translateText("Mã mẫu (để trống để tạo tự động)")}<input
                  className="kp-input"
                  maxLength={80}
                  value={form.sampleCode}
                  onChange={(e) =>
                    setForm({ ...form, sampleCode: e.target.value })
                  }
                />
              </label>
              <label className="kp-field">{translateText("Khối lượng mẫu (g)")}<input
                  className="kp-input"
                  type="number"
                  required
                  min={0.1}
                  step="any"
                  value={form.sampleWeightG}
                  onChange={(e) =>
                    setForm({ ...form, sampleWeightG: e.target.value })
                  }
                />
              </label>
              <label className="kp-field">{translateText("Nhiệt độ tủ lưu (°C)")}<input
                  className="kp-input"
                  type="number"
                  required
                  step="any"
                  value={form.storageTemp}
                  onChange={(e) =>
                    setForm({ ...form, storageTemp: e.target.value })
                  }
                />
              </label>
              <label className="kp-field full">{translateText("Vị trí / tủ lưu")}<input
                  className="kp-input"
                  required
                  value={form.fridgeUnit}
                  onChange={(e) =>
                    setForm({ ...form, fridgeUnit: e.target.value })
                  }
                />
              </label>
              <label className="kp-field full">{translateText("Ghi chú")}<textarea
                  className="kp-input"
                  maxLength={1000}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </label>
              <label className="kp-field full">
                <span><Camera size={13} className="inline mr-1" />{translateText("Ảnh chụp mẫu lưu & tem niêm phong")}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const photo = await prepareProofImage(file);
                      setForm({ ...form, imageUrl: photo });
                    } catch (err: any) {
                      action.run(async () => {
                        throw err;
                      });
                    }
                  }}
                />
                {form.imageUrl && (
                  <div className="mt-2 relative w-32 h-20 rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                    <img
                      src={form.imageUrl}
                      alt="Sample Preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      className="absolute top-1 right-1 bg-rose-600 text-white rounded-full p-0.5 hover:bg-rose-700"
                      onClick={() => setForm({ ...form, imageUrl: "" })}
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </label>
            </div>
            <div className="kp-form-actions">
              <button className="kp-button primary" disabled={action.busy}>{translateText("Lưu mẫu niêm phong")}</button>
            </div>
          </form>
        </Modal>
      )}
      {detail && (
        <Modal title={translateText("Chi tiết mẫu lưu")} onClose={() => setDetail(null)}>
          {photoError && <Notice error={photoError} />}
          <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm">
            <div className="relative group aspect-video sm:aspect-[21/9] max-h-60 w-full bg-slate-900 flex items-center justify-center overflow-hidden">
              {detail.imageUrl ? (
                <img
                  src={detail.imageUrl}
                  alt={detail.dishName}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 gap-2 p-6">
                  <ImageIcon size={40} />
                  <span className="text-xs">{translateText("Chưa có ảnh mẫu lưu")}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent flex flex-col justify-end p-3 text-white pointer-events-none">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-600/90 text-white backdrop-blur">
                    {translateText("Tem niêm phong đạt chuẩn BYT")}
                  </span>
                  <span className="text-[11px] text-white/90">
                    {formatDateTime(detail.storedAt)}
                  </span>
                </div>
              </div>
            </div>
            <div className="p-3 bg-white flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
              <span className="text-xs font-medium text-slate-600">
                {translateText("Ảnh minh chứng lưu mẫu thực phẩm 24h")}
              </span>
              <label className="kp-button text-xs py-1 px-3 cursor-pointer flex items-center gap-1.5 hover:bg-slate-100 font-medium">
                <Camera size={14} className="text-emerald-600" />
                <span>
                  {translateText(
                    uploadingPhoto ? "Đang xử lý ảnh…" : "Cập nhật ảnh mẫu"
                  )}
                </span>
                <input
                  type="file"
                  className="hidden"
                  disabled={uploadingPhoto}
                  accept="image/jpeg,image/png,image/webp"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    e.target.value = "";
                    setPhotoError("");
                    setUploadingPhoto(true);
                    try {
                      const photo = await prepareProofImage(file);
                      await apiClient.patch(
                        `/inspections/samples/${detail.id}/photo`,
                        { imageUrl: photo }
                      );
                      setDetail({ ...detail, imageUrl: photo });
                      await resource.reload();
                    } catch (err: any) {
                      setPhotoError(err?.message || "Lỗi khi xử lý ảnh mẫu.");
                    } finally {
                      setUploadingPhoto(false);
                    }
                  }}
                />
              </label>
            </div>
          </div>
          <dl className="kp-detail-list">
            {[
              [translateText("Mã mẫu"), detail.sampleCode || detail.code],
              [translateText("Món"), detail.dishName],
              [translateText("Người lấy"), detail.collectorName],
              [translateText("Vị trí"), detail.storageLocation || detail.fridgeUnit],
              [translateText("Lưu lúc"), formatDateTime(detail.storedAt)],
              [translateText("Trạng thái"), labels[getSampleState(detail, now, retentionHours)]],
              [translateText("Khối lượng"), `${formatNumber(detail.sampleWeight)} g`],
              [
                translateText("Nhiệt độ"),
                `${formatNumber(detail.storageTemp ?? detail.temperatureC)} °C`,
              ],
              [translateText("Ghi chú"), detail.note],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{translateText(label)}</dt>
                <dd>{translateText(value || "—")}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}
      {dispose && (
        <Modal
          title={translateText("Xác nhận hủy mẫu lưu")}
          busy={action.busy}
          onClose={() => setDispose(null)}
        >
          <Notice error={action.error} />
          <p className="text-sm leading-7">{translateText("Xác nhận đã kiểm tra và thực hiện hủy mẫu")}{" "}
            <b>
              {dispose.sampleCode || dispose.code} · {dispose.dishName}
            </b>{translateText("? Thao tác ghi nhận mẫu đã hủy.")}</p>
          <div className="kp-form-actions">
            <button
              className="kp-button"
              disabled={action.busy}
              onClick={() => setDispose(null)}
            >{translateText("Quay lại")}</button>
            <button
              className="kp-button danger"
              disabled={action.busy}
              onClick={() => void destroy()}
            >{translateText("Xác nhận đã hủy")}</button>
          </div>
        </Modal>
      )}
    </>
  );
}
