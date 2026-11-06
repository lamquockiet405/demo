import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../../core/api/axios";
import { fetchKitchenCollection } from "../../kitchen/api/kitchen.api";
import { rowsOf } from "../../kitchen/utils/kitchen-operations";
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
  useLanguage();
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
    async () => {
      try {
        const staff = await fetchKitchenCollection("/users/staff", {
          roleCode: "TEACHER",
          status: "ACTIVE",
        });
        if (Array.isArray(staff) && staff.length > 0) return staff;
      } catch (e) {
        console.warn("fetchKitchenCollection /users/staff failed:", e);
      }
      const res = (
        await apiClient.get("/users/staff", {
          params: { roleCode: "TEACHER", status: "ACTIVE", limit: 200 },
        })
      ).data;
      return rowsOf(res);
    },
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
      title={translateText("Quản lý lớp học")}
      description={translateText("Xem, tìm kiếm, tạo và cập nhật lớp học, giáo viên chủ nhiệm và danh sách học sinh.")}
      actions={
        <>
          <button
            className="kp-button"
            onClick={resource.reload}
            disabled={resource.loading}
          >{translateText("Làm mới")}</button>
          <button className="kp-button primary" onClick={() => openForm()}>{translateText("Tạo lớp học")}</button>
        </>
      }
    >
      <Feedback error={action.error} message={action.message} />
      <div className="kp-filters">
        <input
          type="search"
          aria-label={translateText("Tìm lớp học")}
          placeholder={translateText("Tìm tên lớp…")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label={translateText("Nhóm tuổi")}
          value={age}
          onChange={(e) => setAge(e.target.value)}
        >
          <option value="">{translateText("Tất cả nhóm tuổi")}</option>
          <option value="NHA_TRE">{translateText("Nhà trẻ")}</option>
          <option value="MAU_GIAO">{translateText("Mẫu giáo")}</option>
        </select>
        <select
          aria-label={translateText("Trạng thái lớp")}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">{translateText("Tất cả trạng thái")}</option>
          <option value="ACTIVE">{translateText("Hoạt động")}</option>
          <option value="INACTIVE">{translateText("Ngừng hoạt động")}</option>
        </select>
      </div>
      <State resource={resource} empty={!rows.length} />
      {!resource.loading && !!rows.length && (
        <div className="overflow-auto bg-white border rounded-xl">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50">
              <tr>
                {[
                  translateText("Lớp học"),
                  translateText("Nhóm tuổi"),
                  translateText("Năm học"),
                  translateText("Giáo viên chủ nhiệm"),
                  translateText("Sĩ số"),
                  translateText("Trạng thái"),
                  translateText("Thao tác"),
                ].map((h) => (
                  <th key={h} className="p-3 whitespace-nowrap">
                    {translateText(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr className="border-t" key={row.id}>
                  <td className="p-3 font-semibold">{row.name}</td>
                  <td className="p-3">
                    {translateText(row.ageGroup === "NHA_TRE"
                      ? "Nhà trẻ"
                      : row.ageGroup === "MAU_GIAO"
                        ? "Mẫu giáo"
                        : row.ageGroup || "—")}
                  </td>
                  <td className="p-3">{translateText(row.schoolYear || "—")}</td>
                  <td className="p-3">
                    {row.homeroomTeacher?.fullName || translateText("Chưa phân công")}
                  </td>
                  <td className="p-3">{translateText(row.studentCount ?? "—")}</td>
                  <td className="p-3">
                    {translateText(row.status === "ACTIVE" ? "Hoạt động" : "Ngừng hoạt động")}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        className="kp-button"
                        onClick={() => setDetailId(String(row.id))}
                      >{translateText("Chi tiết")}</button>
                      <button
                        className="kp-button"
                        onClick={() => openForm(row)}
                      >{translateText("Sửa")}</button>
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
          title={translateText(editing.id ? "Cập nhật lớp học" : "Tạo lớp học")}
          onClose={() => setEditing(null)}
          busy={action.busy}
        >
          <form onSubmit={save} className="space-y-4">
            <Feedback error={action.error} />
            <Field label={translateText("Tên lớp")}>
              <input
                className="kp-input"
                required
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </Field>
            <Field label={translateText("Nhóm tuổi")}>
              <select
                className="kp-input"
                required
                value={editing.ageGroup}
                onChange={(e) =>
                  setEditing({ ...editing, ageGroup: e.target.value })
                }
              >
                <option value="">{translateText("Chọn nhóm tuổi")}</option>
                <option value="NHA_TRE">{translateText("Nhà trẻ")}</option>
                <option value="MAU_GIAO">{translateText("Mẫu giáo")}</option>
              </select>
            </Field>
            <Field label={translateText("Năm học (YYYY-YYYY)")}>
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
            <Field label={translateText("Giáo viên chủ nhiệm")}>
              <select
                className="kp-input"
                value={editing.homeroomTeacherId}
                onChange={(e) =>
                  setEditing({ ...editing, homeroomTeacherId: e.target.value })
                }
              >
                <option value="">{translateText("Chưa phân công")}</option>
                {(teachers.data || []).map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName}{t.phone ? ` (${t.phone})` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Feedback error={teachers.error} />
            <Field label={translateText("Trạng thái")}>
              <select
                className="kp-input"
                value={editing.status}
                onChange={(e) =>
                  setEditing({ ...editing, status: e.target.value })
                }
              >
                <option value="ACTIVE">{translateText("Hoạt động")}</option>
                <option value="INACTIVE">{translateText("Ngừng hoạt động")}</option>
              </select>
            </Field>
            <button
              className="kp-button primary"
              disabled={action.busy || teachers.loading}
            >
              {translateText(action.busy ? "Đang lưu…" : "Lưu lớp học")}
            </button>
          </form>
        </Modal>
      )}
      {detailId && (
        <Modal title={translateText("Chi tiết lớp học")} onClose={() => setDetailId("")}>
          <State resource={detail} />
          {!detail.loading && !detail.error && detail.data && (
            <div className="space-y-4">
              <h2 className="font-bold">{detail.data.name}</h2>
              <p>{translateText("Giáo viên:")}{" "}
                {detail.data.homeroomTeacher?.fullName || translateText("Chưa phân công")}{translateText(" · Sĩ số: ")}{translateText(detail.data.studentCount ?? "—")}
              </p>
              <Link
                className="text-teal-700 underline"
                to={`/students?classId=${detailId}`}
              >{translateText("Quản lý học sinh của lớp")}</Link>
              <ul className="divide-y">
                {(detail.data.students || []).map((s: any) => (
                  <li className="py-3" key={s.id}>
                    {s.studentCode} · {s.fullName}
                  </li>
                ))}
              </ul>
              {!detail.data.students?.length && (
                <p>{translateText("Chưa có học sinh trong lớp.")}</p>
              )}
            </div>
          )}
        </Modal>
      )}
    </SchoolPage>
  );
}
