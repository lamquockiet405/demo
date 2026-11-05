import React, { useMemo, useState } from "react";
import { Download, ShieldCheck } from "lucide-react";
import { apiClient } from "../../../core/api/axios";
import { attendanceApi } from "../../attendance/api/attendanceApi";
import {
  getSchoolDate,
  normalizeKitchenData,
  normalizeSearch,
} from "../utils/kds-data";
import { downloadCsv, rowsOf } from "../utils/kitchen-operations";
import {
  PageTitle,
  Pager,
  ReloadButton,
  ResourceState,
  useKitchenResource,
} from "../components/KitchenUI";

async function loadChildren() {
  const first = (
    await apiClient.get("/children", {
      params: { page: 1, limit: 200, allergyRisk: "YES" },
    })
  ).data;
  const children = rowsOf(first);
  const pages = Math.ceil(Number(first?.total || children.length) / 200);
  const results = await Promise.allSettled(
    Array.from({ length: Math.max(0, pages - 1) }, (_, i) =>
      apiClient.get("/children", {
        params: { page: i + 2, limit: 200, allergyRisk: "YES" },
      }),
    ),
  );
  for (const result of results) {
    if (result.status === "rejected") throw result.reason;
    children.push(...rowsOf(result.value.data));
  }
  return children;
}
const severityLabel = (value: string) =>
  ({
    LOW: "Nhẹ",
    MEDIUM: "Trung bình",
    HIGH: "Cao",
    SEVERE: "Nặng",
    ANAPHYLACTIC: "Nguy cơ phản vệ",
  })[value] ||
  value ||
  "Chưa phân loại";

export function KitchenAllergiesPage() {
  const resource = useKitchenResource(loadChildren, []);
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [severity, setSeverity] = useState("");
  const [page, setPage] = useState(1);
  const rows = useMemo(
    () =>
      (resource.data || [])
        .flatMap((child) =>
          rowsOf(child.allergies)
            .filter((a) => a.isActive !== false)
            .map((allergy) => ({
              ...allergy,
              childName: child.fullName,
              code: child.studentCode,
              classId: String(child.classId || ""),
              className: child.className || "Chưa có lớp",
            })),
        )
        .filter(
          (item) =>
            (!classId || item.classId === classId) &&
            (!severity || item.severity === severity) &&
            normalizeSearch(
              `${item.childName} ${item.code} ${item.allergenName} ${item.note || ""}`,
            ).includes(normalizeSearch(search)),
        ),
    [resource.data, classId, severity, search],
  );
  const classes = [
    ...new Map(
      (resource.data || [])
        .filter((c) => c.classId)
        .map((c) => [String(c.classId), c.className]),
    ).entries(),
  ];
  return (
    <>
      <PageTitle
        title="Dị ứng & chế độ ăn"
        description="Đối chiếu thực phẩm cần tránh, mức độ phản ứng và hướng dẫn ăn riêng đã khai báo cho từng trẻ."
      >
        <ReloadButton loading={resource.loading} reload={resource.reload} />
        <button
          className="kp-button"
          disabled={!rows.length}
          onClick={() =>
            downloadCsv("danh-sach-che-do-an.csv", [
              [
                "Học sinh",
                "Mã",
                "Lớp",
                "Thực phẩm cần tránh",
                "Mức độ",
                "Loại",
                "Ghi chú",
              ],
              ...rows.map((r) => [
                r.childName,
                r.code,
                r.className,
                r.allergenName,
                severityLabel(r.severity),
                r.allergyType,
                r.note,
              ]),
            ])
          }
        >
          <Download size={15} />
          Xuất danh sách
        </button>
      </PageTitle>
      <div className="kp-filters">
        <input
          type="search"
          aria-label="Tìm học sinh hoặc dị nguyên"
          placeholder="Tên trẻ, mã, thực phẩm cần tránh…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="Lọc lớp dị ứng"
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tất cả lớp</option>
          {classes.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="Mức độ dị ứng"
          value={severity}
          onChange={(e) => {
            setSeverity(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tất cả mức độ</option>
          {["LOW", "MEDIUM", "HIGH", "SEVERE", "ANAPHYLACTIC"].map((s) => (
            <option key={s} value={s}>
              {severityLabel(s)}
            </option>
          ))}
        </select>
        <button
          className="kp-button"
          onClick={() => {
            setSearch("");
            setClassId("");
            setSeverity("");
            setPage(1);
          }}
        >
          Xóa bộ lọc
        </button>
      </div>
      <ResourceState resource={resource} empty={!rows.length} />
      {resource.data && (
        <>
          <div className="kp-table-wrap">
            <table className="kp-table">
              <thead>
                <tr>
                  <th>Học sinh</th>
                  <th>Lớp</th>
                  <th>Thực phẩm cần tránh</th>
                  <th>Mức độ / chế độ</th>
                  <th>Hướng dẫn đã khai báo</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice((page - 1) * 12, page * 12).map((row, index) => (
                  <tr key={`${row.id}-${index}`}>
                    <td>
                      <strong>{row.childName}</strong>
                      <small>{row.code}</small>
                    </td>
                    <td>{row.className}</td>
                    <td>
                      <span className="kp-tag red">
                        {row.allergenName || row.customAllergenName}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`kp-tag ${["HIGH", "SEVERE", "ANAPHYLACTIC"].includes(row.severity) ? "red" : "amber"}`}
                      >
                        {severityLabel(row.severity)}
                      </span>
                      <small>
                        {row.allergyType === "INTOLERANCE"
                          ? "Không dung nạp"
                          : row.allergyType === "ALLERGY"
                            ? "Dị ứng thực phẩm"
                            : row.allergyType || "Chế độ ăn riêng"}
                      </small>
                    </td>
                    <td>
                      <p className="kp-note-text">
                        {row.note ||
                          row.symptoms ||
                          "Chưa có hướng dẫn bổ sung"}
                      </p>
                      {row.reactionTreatment && (
                        <small>
                          Hướng dẫn xử trí đã khai báo: {row.reactionTreatment}
                        </small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} total={rows.length} onChange={setPage} />
        </>
      )}
    </>
  );
}

export function KitchenAllergyAlertsPage() {
  const [date, setDate] = useState(getSchoolDate);
  const [search, setSearch] = useState("");
  const resource = useKitchenResource(
    async () =>
      normalizeKitchenData(await attendanceApi.getKitchenKdsData(date)),
    [date],
  );
  const alerts = (resource.data?.alerts || []).filter((a) =>
    normalizeSearch(`${a.childName} ${a.className} ${a.allergen}`).includes(
      normalizeSearch(search),
    ),
  );
  return (
    <>
      <PageTitle
        title="Cảnh báo dị ứng"
        description="Danh sách yêu cầu ăn riêng trong ngày. Kiểm tra nhãn và tách riêng suất trước khi bàn giao."
      >
        <ReloadButton loading={resource.loading} reload={resource.reload} />
      </PageTitle>
      <div className="kp-filters">
        <label>
          Ngày phục vụ
          <input
            type="date"
            aria-label="Ngày cảnh báo"
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
          />
        </label>
        <input
          type="search"
          aria-label="Tìm cảnh báo dị ứng"
          placeholder="Tìm trẻ, lớp, yêu cầu ăn riêng…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <ResourceState resource={resource} empty={!alerts.length} />
      <div className="kp-card-grid">
        {alerts.map((alert) => (
          <article className="kp-panel" key={alert.id}>
            <div className="kp-note-header">
              <h2>
                <ShieldCheck size={18} className="inline mr-2 text-red-600" />
                {alert.childName}
              </h2>
              <span className="kp-tag red">{alert.severity}</span>
            </div>
            <span className="kp-tag">{alert.className}</span>
            <p>
              <b>Yêu cầu:</b>{" "}
              {alert.allergen || "Đối chiếu hồ sơ trước khi chế biến."}
            </p>
            {alert.replacementMeal && (
              <p>
                <b>Suất thay thế đã chỉ định:</b> {alert.replacementMeal}
              </p>
            )}
            {alert.notes && <p>{alert.notes}</p>}
          </article>
        ))}
      </div>
    </>
  );
}
