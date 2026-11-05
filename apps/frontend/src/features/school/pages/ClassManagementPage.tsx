import React, { useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../../core/api/axios";
import { fetchKitchenCollection } from "../../kitchen/api/kitchen.api";
import {
  SchoolPage,
  Feedback,
  Field,
  State,
  Modal,
  useSchoolAction,
  useSchoolResource,
} from "../components/SchoolUI";

export function ClassManagementPage() {
  const [search, setSearch] = useState(""),
    [age, setAge] = useState(""),
    [status, setStatus] = useState("");
  const [editing, setEditing] = useState<any>(null),
    [detailId, setDetailId] = useState<string>("");
  const resource = useSchoolResource(
    () =>
      fetchKitchenCollection("/classes", {
        search,
        ageGroup: age || undefined,
        status: status || undefined,
      }),
    [search, age, status],
  );
  const detail = useSchoolResource(
    async () =>
      detailId
        ? (await apiClient.get(`/classes/${encodeURIComponent(detailId)}`)).data
        : null,
    [detailId],
  );
  const teachers = useSchoolResource(
    () =>
      fetchKitchenCollection("/users/staff", {
        roleCode: "TEACHER",
        status: "ACTIVE",
      }),
    [],
  );
  const action = useSchoolAction();
  const rows = resource.error ? [] : resource.data || [];
  const openForm = (row?: any) =>
    setEditing({
      id: row?.id,
      name: row?.name || "",
      ageGroup: row?.ageGroup || "",
      schoolYear: row?.schoolYear || "",
      homeroomTeacherId: row?.homeroomTeacherId
        ? String(row.homeroomTeacherId)
        : "",
      status: row?.status || "ACTIVE",
    });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    await action.run(async () => {
      if (
        !editing.name.trim() ||
        !editing.ageGroup ||
        !/^\d{4}-\d{4}$/.test(editing.schoolYear)
      )
        throw new Error(
          "Nhập tên lớp, nhóm tuổi và năm học theo dạng YYYY-YYYY.",
        );
      const { id, ...form } = editing;
      const payload = {
        ...form,
        name: form.name.trim(),
        homeroomTeacherId: form.homeroomTeacherId
          ? Number(form.homeroomTeacherId)
          : null,
      };
      if (id) await apiClient.patch(`/classes/${id}`, payload);
      else await apiClient.post("/classes", payload);
      setEditing(null);
      await resource.reload();
    }, "Đã lưu lớp học.");
  };
  return (
    <SchoolPage
      title="Quản lý lớp học"
      description="Xem, tìm kiếm, tạo và cập nhật lớp học, giáo viên chủ nhiệm và danh sách học sinh."
      actions={
        <>
          <button
            className="kp-button"
            onClick={resource.reload}
            disabled={resource.loading}
          >
            Làm mới
          </button>
          <button className="kp-button primary" onClick={() => openForm()}>
            Tạo lớp học
          </button>
        </>
      }
    >
      <Feedback error={action.error} message={action.message} />
      <div className="kp-filters">
        <input
          type="search"
          aria-label="Tìm lớp học"
          placeholder="Tìm tên lớp…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Nhóm tuổi"
          value={age}
          onChange={(e) => setAge(e.target.value)}
        >
          <option value="">Tất cả nhóm tuổi</option>
          <option value="NHA_TRE">Nhà trẻ</option>
          <option value="MAU_GIAO">Mẫu giáo</option>
        </select>
        <select
          aria-label="Trạng thái lớp"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">Hoạt động</option>
          <option value="INACTIVE">Ngừng hoạt động</option>
        </select>
      </div>
      <State resource={resource} empty={!rows.length} />
      {!resource.loading && !!rows.length && (
        <div className="overflow-auto bg-white border rounded-xl">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50">
              <tr>
                {[
                  "Lớp học",
                  "Nhóm tuổi",
                  "Năm học",
                  "Giáo viên chủ nhiệm",
                  "Sĩ số",
                  "Trạng thái",
                  "Thao tác",
                ].map((h) => (
                  <th key={h} className="p-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr className="border-t" key={row.id}>
                  <td className="p-3 font-semibold">{row.name}</td>
                  <td className="p-3">
                    {row.ageGroup === "NHA_TRE"
                      ? "Nhà trẻ"
                      : row.ageGroup === "MAU_GIAO"
                        ? "Mẫu giáo"
                        : row.ageGroup || "—"}
                  </td>
                  <td className="p-3">{row.schoolYear || "—"}</td>
                  <td className="p-3">
                    {row.homeroomTeacher?.fullName || "Chưa phân công"}
                  </td>
                  <td className="p-3">{row.studentCount ?? "—"}</td>
                  <td className="p-3">
                    {row.status === "ACTIVE" ? "Hoạt động" : "Ngừng hoạt động"}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        className="kp-button"
                        onClick={() => setDetailId(String(row.id))}
                      >
                        Chi tiết
                      </button>
                      <button
                        className="kp-button"
                        onClick={() => openForm(row)}
                      >
                        Sửa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <Modal
          title={editing.id ? "Cập nhật lớp học" : "Tạo lớp học"}
          onClose={() => setEditing(null)}
          busy={action.busy}
        >
          <form onSubmit={save} className="space-y-4">
            <Feedback error={action.error} />
            <Field label="Tên lớp">
              <input
                className="kp-input"
                required
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </Field>
            <Field label="Nhóm tuổi">
              <select
                className="kp-input"
                required
                value={editing.ageGroup}
                onChange={(e) =>
                  setEditing({ ...editing, ageGroup: e.target.value })
                }
              >
                <option value="">Chọn nhóm tuổi</option>
                <option value="NHA_TRE">Nhà trẻ</option>
                <option value="MAU_GIAO">Mẫu giáo</option>
              </select>
            </Field>
            <Field label="Năm học (YYYY-YYYY)">
              <input
                className="kp-input"
                required
                pattern="\d{4}-\d{4}"
                value={editing.schoolYear}
                onChange={(e) =>
                  setEditing({ ...editing, schoolYear: e.target.value })
                }
              />
            </Field>
            <Field label="Giáo viên chủ nhiệm">
              <select
                className="kp-input"
                value={editing.homeroomTeacherId}
                onChange={(e) =>
                  setEditing({ ...editing, homeroomTeacherId: e.target.value })
                }
              >
                <option value="">Chưa phân công</option>
                {(teachers.data || []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName}
                  </option>
                ))}
              </select>
            </Field>
            <Feedback error={teachers.error} />
            <Field label="Trạng thái">
              <select
                className="kp-input"
                value={editing.status}
                onChange={(e) =>
                  setEditing({ ...editing, status: e.target.value })
                }
              >
                <option value="ACTIVE">Hoạt động</option>
                <option value="INACTIVE">Ngừng hoạt động</option>
              </select>
            </Field>
            <button
              className="kp-button primary"
              disabled={action.busy || teachers.loading}
            >
              {action.busy ? "Đang lưu…" : "Lưu lớp học"}
            </button>
          </form>
        </Modal>
      )}
      {detailId && (
        <Modal title="Chi tiết lớp học" onClose={() => setDetailId("")}>
          <State resource={detail} />
          {!detail.loading && !detail.error && detail.data && (
            <div className="space-y-4">
              <h2 className="font-bold">{detail.data.name}</h2>
              <p>
                Giáo viên:{" "}
                {detail.data.homeroomTeacher?.fullName || "Chưa phân công"} · Sĩ
                số: {detail.data.studentCount ?? "—"}
              </p>
              <Link
                className="text-teal-700 underline"
                to={`/students?classId=${detailId}`}
              >
                Quản lý học sinh của lớp
              </Link>
              <ul className="divide-y">
                {(detail.data.students || []).map((s: any) => (
                  <li className="py-3" key={s.id}>
                    {s.studentCode} · {s.fullName}
                  </li>
                ))}
              </ul>
              {!detail.data.students?.length && (
                <p>Chưa có học sinh trong lớp.</p>
              )}
            </div>
          )}
        </Modal>
      )}
    </SchoolPage>
  );
}
