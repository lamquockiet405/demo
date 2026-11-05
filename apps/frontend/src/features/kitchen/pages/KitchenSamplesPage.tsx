import React, { useState } from "react";
import { Download, Eye, Plus } from "lucide-react";
import { apiClient } from "../../../core/api/axios";
import { useAuthStore } from "../../../core/stores/auth.store";
import { getSchoolDate, normalizeSearch } from "../utils/kds-data";
import {
  downloadCsv,
  formatDateTime,
  formatNumber,
  getSampleState,
  sampleDueAt,
  rowsOf,
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

const labels = {
  STORED: "Đang lưu",
  DUE: "Đủ 24 giờ, chờ hủy",
  DISPOSED: "Đã hủy",
  UNKNOWN: "Chưa rõ thời gian lưu",
};
export function KitchenSamplesPage({
  audience = "kitchen",
}: {
  audience?: "kitchen" | "principal" | "nutritionist";
}) {
  const { user } = useAuthStore();
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
  const [form, setForm] = useState({
    dishName: "",
    date: getSchoolDate(),
    sampleCode: "",
    sampleWeightG: "",
    storageTemp: "",
    fridgeUnit: "",
    note: "",
  });
  const action = useKitchenAction();
  const now = resource.data?.loadedAt ?? Date.now();
  const all = resource.data?.items || [];
  const due = all.filter((r) => getSampleState(r, now) === "DUE");
  const rows = all.filter(
    (r) =>
      (!date || (r.mealDate || r.date) === date) &&
      (!status || getSampleState(r, now) === status) &&
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
      if (getSampleState(current) !== "DUE")
        throw new Error(
          "Mẫu chưa đủ thời gian lưu 24 giờ hoặc đã được hủy. Vui lòng tải lại.",
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
          audience === "principal"
            ? "BAN GIÁM HIỆU"
            : audience === "nutritionist"
              ? "CHUYÊN GIA DINH DƯỠNG"
              : undefined
        }
        title="Lưu mẫu thực phẩm 24 giờ"
        description="Quản lý mẫu niêm phong, tra cứu thời gian lưu và xác nhận hủy khi đủ 24 giờ. Thời hạn được kiểm tra khi tải dữ liệu."
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
                "Đủ 24 giờ lúc",
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
                r.storedAt ? formatDateTime(sampleDueAt(r.storedAt)) : "",
                labels[getSampleState(r, now)],
                r.collectorName,
                r.fridgeUnit,
              ]),
            ])
          }
        >
          <Download size={15} />
          Xuất báo cáo an toàn
        </button>
        <button className="kp-button primary" onClick={() => setCreate(true)}>
          <Plus size={16} />
          Niêm phong mẫu
        </button>
      </PageTitle>
      <Notice error={action.error} message={action.message} />
      {due.length > 0 && (
        <div className="kp-notice error" role="status">
          <span>
            <b>{due.length} mẫu đã đủ 24 giờ, cần kiểm tra trước khi hủy.</b>{" "}
            <button
              className="underline"
              onClick={() => {
                setStatus("DUE");
                setDate("");
                setSearch("");
              }}
            >
              Xem mẫu chờ hủy
            </button>
          </span>
        </div>
      )}
      <div className="kp-filters">
        <input
          type="search"
          aria-label="Tìm mẫu lưu"
          placeholder="Tìm mã mẫu, món, người lấy…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label>
          Ngày lấy mẫu
          <input
            type="date"
            aria-label="Ngày mẫu lưu"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <select
          aria-label="Trạng thái mẫu lưu"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          {Object.entries(labels).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
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
        >
          Xóa bộ lọc
        </button>
      </div>
      <ResourceState resource={resource} empty={!rows.length} />
      <div className="kp-table-wrap">
        <table className="kp-table">
          <thead>
            <tr>
              <th>Mẫu / món</th>
              <th>Khối lượng / nhiệt độ</th>
              <th>Thời điểm lưu</th>
              <th>Đủ 24 giờ</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const state = getSampleState(r, now);
              return (
                <tr key={r.id}>
                  <td>
                    <strong>{r.sampleCode || r.code}</strong>
                    <small>{r.dishName}</small>
                  </td>
                  <td>
                    {formatNumber(r.sampleWeight)} g
                    <small>
                      {formatNumber(r.storageTemp ?? r.temperatureC)} °C
                    </small>
                  </td>
                  <td>
                    {formatDateTime(r.storedAt)}
                    <small>{r.collectorName}</small>
                  </td>
                  <td>
                    {r.storedAt && Number.isFinite(Date.parse(r.storedAt))
                      ? formatDateTime(sampleDueAt(r.storedAt))
                      : "—"}
                  </td>
                  <td>
                    <span
                      className={`kp-tag ${state === "DUE" ? "red" : state === "DISPOSED" ? "gray" : ""}`}
                    >
                      {labels[state]}
                    </span>
                  </td>
                  <td>
                    <div className="kp-actions">
                      <button
                        className="kp-button"
                        disabled={action.busy}
                        aria-label={`Chi tiết mẫu ${r.sampleCode || r.code}`}
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
                        <Eye size={14} />
                        Chi tiết
                      </button>
                      {canDispose && (
                        <button
                          className="kp-button danger"
                          disabled={state !== "DUE" || action.busy}
                          onClick={() => setDispose(r)}
                        >
                          Hủy mẫu
                        </button>
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
          title="Niêm phong mẫu lưu"
          busy={action.busy}
          onClose={() => setCreate(false)}
        >
          <Notice error={action.error} />
          <form onSubmit={save}>
            <div className="kp-form-grid">
              <label className="kp-field full">
                Tên món
                <input
                  className="kp-input"
                  required
                  maxLength={200}
                  value={form.dishName}
                  onChange={(e) =>
                    setForm({ ...form, dishName: e.target.value })
                  }
                />
              </label>
              <label className="kp-field">
                Ngày lấy mẫu
                <input
                  className="kp-input"
                  required
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </label>
              <label className="kp-field">
                Mã mẫu (để trống để tạo tự động)
                <input
                  className="kp-input"
                  maxLength={80}
                  value={form.sampleCode}
                  onChange={(e) =>
                    setForm({ ...form, sampleCode: e.target.value })
                  }
                />
              </label>
              <label className="kp-field">
                Khối lượng mẫu (g)
                <input
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
              <label className="kp-field">
                Nhiệt độ tủ lưu (°C)
                <input
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
              <label className="kp-field full">
                Vị trí / tủ lưu
                <input
                  className="kp-input"
                  required
                  value={form.fridgeUnit}
                  onChange={(e) =>
                    setForm({ ...form, fridgeUnit: e.target.value })
                  }
                />
              </label>
              <label className="kp-field full">
                Ghi chú
                <textarea
                  className="kp-input"
                  maxLength={1000}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </label>
            </div>
            <div className="kp-form-actions">
              <button className="kp-button primary" disabled={action.busy}>
                Lưu mẫu niêm phong
              </button>
            </div>
          </form>
        </Modal>
      )}
      {detail && (
        <Modal title="Chi tiết mẫu lưu" onClose={() => setDetail(null)}>
          <dl className="kp-detail-list">
            {[
              ["Mã mẫu", detail.sampleCode || detail.code],
              ["Món", detail.dishName],
              ["Người lấy", detail.collectorName],
              ["Vị trí", detail.storageLocation || detail.fridgeUnit],
              ["Lưu lúc", formatDateTime(detail.storedAt)],
              ["Trạng thái", labels[getSampleState(detail)]],
              ["Khối lượng", `${formatNumber(detail.sampleWeight)} g`],
              [
                "Nhiệt độ",
                `${formatNumber(detail.storageTemp ?? detail.temperatureC)} °C`,
              ],
              ["Ghi chú", detail.note],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value || "—"}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}
      {dispose && (
        <Modal
          title="Xác nhận hủy mẫu lưu"
          busy={action.busy}
          onClose={() => setDispose(null)}
        >
          <Notice error={action.error} />
          <p className="text-sm leading-7">
            Xác nhận đã kiểm tra và thực hiện hủy mẫu{" "}
            <b>
              {dispose.sampleCode || dispose.code} · {dispose.dishName}
            </b>
            ? Thao tác ghi nhận mẫu đã hủy.
          </p>
          <div className="kp-form-actions">
            <button
              className="kp-button"
              disabled={action.busy}
              onClick={() => setDispose(null)}
            >
              Quay lại
            </button>
            <button
              className="kp-button danger"
              disabled={action.busy}
              onClick={() => void destroy()}
            >
              Xác nhận đã hủy
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
