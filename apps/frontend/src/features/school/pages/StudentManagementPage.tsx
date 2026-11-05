import React, { useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import { childrenApi } from "../../children/api/children.api";
import { fetchKitchenCollection } from "../../kitchen/api/kitchen.api";
import { schoolDate } from "../../menus/utils/published-menus";
import { validateStudentRows } from "../utils/student-import";
import {
  SchoolPage,
  Feedback,
  Field,
  State,
  Modal,
  useSchoolAction,
  useSchoolResource,
} from "../components/SchoolUI";
import { TeacherStatsOverview } from "../../teacher/components/TeacherStatsOverview";

export function StudentManagementPage() {
  const isTeacherPortal = useLocation().pathname.startsWith("/teacher/");
  const [params] = useSearchParams();
  const [search, setSearch] = useState(""),
    [classId, setClassId] = useState(params.get("classId") || ""),
    [page, setPage] = useState(1);
  const [editing, setEditing] = useState<any>(null),
    [detailId, setDetailId] = useState("");
  const [importRows, setImportRows] = useState<any[] | null>(null),
    [importError, setImportError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const resource = useSchoolResource(
    () =>
      childrenApi.getChildren({
        search,
        classId: classId || undefined,
        page,
        limit: 25,
      }),
    [search, classId, page],
  );
  const classes = useSchoolResource(
    () => fetchKitchenCollection("/classes"),
    [],
  );
  const detail = useSchoolResource(
    async () => (detailId ? childrenApi.getChild(detailId) : null),
    [detailId],
  );
  const action = useSchoolAction();
  const rows = resource.error ? [] : resource.data?.items || [],
    total = resource.data?.total ?? 0;

  const openForm = (row?: any) =>
    setEditing({
      id: row?.id,
      fullName: row?.fullName || "",
      studentCode: row?.studentCode || "",
      dateOfBirth: row?.dateOfBirth?.slice(0, 10) || "",
      gender: row?.gender || "MALE",
      classId: row?.classId ? String(row.classId) : classId,
      parentName: row?.parentName || row?.emergencyContactName || "",
      parentEmail: row?.parentEmail || "",
      parentPhone: row?.parentPhone || row?.emergencyContactPhone || "",
      parentRelationship: row?.parentRelationship || "FATHER",
      emergencyContactName: row?.parentName || row?.emergencyContactName || "",
      emergencyContactPhone: row?.parentPhone || row?.emergencyContactPhone || "",
      medicalNotes: row?.medicalNotes || "",
    });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    await action.run(async () => {
      const { id, ...form } = editing;
      const validated = validateStudentRows(
        [form],
        (classes.data || []).map((c) => String(c.id)),
        schoolDate(),
      )[0];
      if (id) await childrenApi.updateChild(id, validated as any);
      else await childrenApi.createChild(validated as any);
      setEditing(null);
      await resource.reload();
    }, "Đã lưu hồ sơ học sinh thành công.");
  };

  const readFile = async (file?: File) => {
    setImportError("");
    setImportRows(null);
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("Tệp tối đa 5 MB.");
      const workbook = XLSX.read(await file.arrayBuffer(), {
        type: "array",
        raw: true,
      });
      const raw = XLSX.utils.sheet_to_json<Record<string, any>>(
        workbook.Sheets[workbook.SheetNames[0]],
        { raw: false, defval: "" },
      );
      setImportRows(
        validateStudentRows(
          raw,
          (classes.data || []).map((c) => String(c.id)),
          schoolDate(),
        ),
      );
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Không đọc được tệp.");
    }
    if (input.current) input.current.value = "";
  };

  const importFile = async () =>
    action.run(async () => {
      if (!importRows?.length)
        throw new Error("Chưa có dữ liệu hợp lệ để nhập.");
      const result = await childrenApi.importChildren(importRows);
      setImportRows(null);
      await resource.reload();
      if (result.errors?.length || result.success === false)
        throw new Error(
          `Đã nhập ${result.importedCount ?? 0} học sinh. ${result.errors?.join(" ") || result.message}`,
        );
    }, "Đã nhập danh sách học sinh.");

  return (
    <SchoolPage
      title={isTeacherPortal ? "Hồ sơ học sinh lớp phụ trách" : "Hồ sơ học sinh"}
      description="Quản lý danh sách học sinh thuộc lớp phụ trách, thông tin cá nhân và tài khoản phụ huynh liên kết."
      actions={
        <>
          <button
            className="kp-button"
            disabled={resource.loading}
            onClick={resource.reload}
          >
            Làm mới
          </button>
          <button
            className="kp-button"
            disabled={classes.loading || !!classes.error}
            onClick={() => input.current?.click()}
          >
            Nhập Excel/CSV
          </button>
          <button
            className="kp-button primary"
            disabled={classes.loading || !!classes.error || (isTeacherPortal && !classes.data?.length)}
            onClick={() => openForm()}
          >
            {isTeacherPortal ? "Thêm học sinh vào lớp" : "Thêm học sinh"}
          </button>
        </>
      }
    >
      <input
        ref={input}
        hidden
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={(e) => void readFile(e.target.files?.[0])}
      />
      <Feedback
        error={importError || action.error || classes.error}
        message={action.message}
      />

      {isTeacherPortal && <TeacherStatsOverview classes={classes.data} />}

      <details className="text-sm bg-white border rounded-xl p-4">
        <summary className="cursor-pointer font-semibold">
          Cấu trúc tệp nhập Excel/CSV
        </summary>
        <p className="mt-3 break-words">
          Tên cột bắt buộc: fullName, dateOfBirth (YYYY-MM-DD), gender (MALE/FEMALE), classId.
          Cột bổ sung: studentCode, parentName, parentEmail, parentPhone, parentRelationship, medicalNotes.
          Mã học sinh đã tồn tại sẽ được cập nhật theo nội dung tệp.
        </p>
        <ul className="mt-2">
          {(classes.data || []).map((c) => (
            <li key={c.id}>
              {c.name}: Mã lớp {c.id}
            </li>
          ))}
        </ul>
      </details>

      <div className="kp-filters">
        <input
          type="search"
          aria-label="Tìm học sinh"
          value={search}
          placeholder="Tìm tên hoặc mã học sinh…"
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="Lớp học"
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{isTeacherPortal ? "Tất cả lớp được phân công" : "Tất cả lớp"}</option>
          {(classes.data || []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {isTeacherPortal && !classes.loading && !classes.error && classes.data?.length === 0 && (
        <Feedback message="Tài khoản chưa được phân công lớp. Vui lòng liên hệ Ban Giám Hiệu để kiểm tra phân công giáo viên." />
      )}

      <State resource={resource} empty={!rows.length} />

      {!resource.loading && !!rows.length && (
        <div className="overflow-auto bg-white border rounded-xl shadow-xs">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {[
                  "Mã học sinh",
                  "Họ tên học sinh",
                  "Ngày sinh",
                  "Lớp",
                  "Phụ huynh",
                  "Tài khoản phụ huynh",
                  "Thao tác",
                ].map((h) => (
                  <th className="p-3 whitespace-nowrap font-bold text-slate-700" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t hover:bg-slate-50/60 transition">
                  <td className="p-3 font-mono font-medium text-slate-700">{row.studentCode || "—"}</td>
                  <td className="p-3 font-semibold text-slate-900">{row.fullName}</td>
                  <td className="p-3 text-slate-600">
                    {row.dateOfBirth?.slice(0, 10) || "—"}
                  </td>
                  <td className="p-3 text-slate-700">
                    {row.className ||
                      row.class?.name ||
                      (classes.data || []).find(
                        (c) => String(c.id) === String(row.classId),
                      )?.name ||
                      "Chưa phân lớp"}
                  </td>
                  <td className="p-3">
                    <strong className="text-slate-900 block">
                      {row.parentName || row.emergencyContactName || "Chưa cập nhật"}
                    </strong>
                    {row.parentRelationship && (
                      <span className="text-xs text-slate-500">
                        ({row.parentRelationship})
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    {row.parentEmail ? (
                      <span className="font-mono text-xs text-emerald-800 font-semibold block">
                        {row.parentEmail}
                      </span>
                    ) : null}
                    {row.parentPhone || row.emergencyContactPhone ? (
                      <span className="text-xs text-slate-600 block">
                        {row.parentPhone || row.emergencyContactPhone}
                      </span>
                    ) : (
                      !row.parentEmail && <span className="text-slate-400 italic text-xs">Chưa có tài khoản</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        className="kp-button text-xs"
                        onClick={() => setDetailId(String(row.id))}
                      >
                        Chi tiết
                      </button>
                      <button
                        className="kp-button text-xs"
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

      <div className="flex gap-3 items-center text-sm mt-4">
        <span>
          {total} học sinh · Trang {page}/{Math.max(1, Math.ceil(total / 25))}
        </span>
        <button
          className="kp-button"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          Trước
        </button>
        <button
          className="kp-button"
          disabled={page * 25 >= total}
          onClick={() => setPage(page + 1)}
        >
          Sau
        </button>
      </div>

      {/* ─── MODAL THÊM / CẬP NHẬT HỒ SƠ HỌC SINH ─── */}
      {editing && (
        <Modal
          title={editing.id ? "Cập nhật hồ sơ học sinh" : "Thêm hồ sơ học sinh mới"}
          onClose={() => setEditing(null)}
          busy={action.busy}
        >
          <form onSubmit={save} className="space-y-4">
            <Feedback error={action.error} />

            <div className="border-b pb-3 space-y-3">
              <h3 className="font-bold text-sm text-emerald-900 uppercase tracking-wide">
                1. Thông tin học sinh
              </h3>
              <Field label="Họ và tên học sinh">
                <input
                  className="kp-input"
                  required
                  placeholder="VD: Nguyễn Gia Huy"
                  value={editing.fullName}
                  onChange={(e) =>
                    setEditing({ ...editing, fullName: e.target.value })
                  }
                />
              </Field>
              <Field label="Mã học sinh">
                <input
                  className="kp-input"
                  placeholder="VD: HD-2023-01 (tự động sinh nếu để trống)"
                  value={editing.studentCode}
                  onChange={(e) =>
                    setEditing({ ...editing, studentCode: e.target.value })
                  }
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ngày sinh">
                  <input
                    className="kp-input"
                    type="date"
                    required
                    max={schoolDate()}
                    value={editing.dateOfBirth}
                    onChange={(e) =>
                      setEditing({ ...editing, dateOfBirth: e.target.value })
                    }
                  />
                </Field>
                <Field label="Giới tính">
                  <select
                    className="kp-input"
                    required
                    value={editing.gender}
                    onChange={(e) =>
                      setEditing({ ...editing, gender: e.target.value })
                    }
                  >
                    <option value="MALE">Nam</option>
                    <option value="FEMALE">Nữ</option>
                  </select>
                </Field>
              </div>
              <Field label="Lớp học">
                <select
                  className="kp-input"
                  required
                  value={editing.classId}
                  onChange={(e) =>
                    setEditing({ ...editing, classId: e.target.value })
                  }
                >
                  <option value="">Chọn lớp</option>
                  {(classes.data || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="border-b pb-3 space-y-3">
              <h3 className="font-bold text-sm text-emerald-900 uppercase tracking-wide">
                2. Thông tin & Tài khoản phụ huynh
              </h3>
              <Field label="Họ tên phụ huynh">
                <input
                  className="kp-input"
                  placeholder="VD: Nguyễn Gia Bảo"
                  value={editing.parentName}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      parentName: e.target.value,
                      emergencyContactName: e.target.value,
                    })
                  }
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tài khoản phụ huynh (Email đăng nhập)">
                  <input
                    className="kp-input font-mono text-xs"
                    type="email"
                    placeholder="VD: phuhuynh.huy@gmail.com"
                    value={editing.parentEmail}
                    onChange={(e) =>
                      setEditing({ ...editing, parentEmail: e.target.value })
                    }
                  />
                </Field>
                <Field label="Điện thoại phụ huynh">
                  <input
                    className="kp-input"
                    type="tel"
                    placeholder="VD: 0908111222"
                    value={editing.parentPhone}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        parentPhone: e.target.value,
                        emergencyContactPhone: e.target.value,
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="Mối quan hệ">
                <select
                  className="kp-input"
                  value={editing.parentRelationship}
                  onChange={(e) =>
                    setEditing({ ...editing, parentRelationship: e.target.value })
                  }
                >
                  <option value="FATHER">Bố</option>
                  <option value="MOTHER">Mẹ</option>
                  <option value="GUARDIAN">Người giám hộ</option>
                </select>
              </Field>
            </div>

            <Field label="Ghi chú y tế & sức khỏe">
              <textarea
                className="kp-input"
                placeholder="VD: Tiền sử sốt co giật; Dị ứng nhẹ..."
                value={editing.medicalNotes}
                onChange={(e) =>
                  setEditing({ ...editing, medicalNotes: e.target.value })
                }
              />
            </Field>

            <button
              className="kp-button primary w-full"
              disabled={action.busy || classes.loading || !!classes.error}
            >
              {action.busy ? "Đang lưu…" : editing.id ? "Cập nhật hồ sơ học sinh" : "Lưu hồ sơ học sinh"}
            </button>
          </form>
        </Modal>
      )}

      {/* ─── MODAL XEM CHI TIẾT HỒ SƠ HỌC SINH ─── */}
      {detailId && (
        <Modal title="Chi tiết hồ sơ học sinh" onClose={() => setDetailId("")}>
          <State resource={detail} />
          {!detail.loading && !detail.error && detail.data && (
            <div className="space-y-4">
              <div className="border-b pb-3">
                <h2 className="font-bold text-xl text-slate-900">{detail.data.fullName}</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Mã học sinh: <b className="text-slate-800">{detail.data.studentCode || "—"}</b> · Ngày sinh:{" "}
                  <b className="text-slate-800">{detail.data.dateOfBirth?.slice(0, 10) || "—"}</b> · Giới tính:{" "}
                  <b className="text-slate-800">{detail.data.gender === "MALE" ? "Nam" : "Nữ"}</b>
                </p>
                <p className="text-sm text-slate-500">
                  Lớp học: <b className="text-slate-800">{detail.data.className || "Chưa phân lớp"}</b>
                </p>
              </div>

              <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-xl p-4 space-y-2">
                <h3 className="font-bold text-sm text-emerald-900 uppercase tracking-wide">
                  Thông tin & Tài khoản phụ huynh
                </h3>
                <p className="text-sm text-slate-800">
                  Họ tên phụ huynh:{" "}
                  <strong>{detail.data.parentName || detail.data.emergencyContactName || "Chưa cập nhật"}</strong>
                  {detail.data.parentRelationship && ` (${detail.data.parentRelationship})`}
                </p>
                <p className="text-sm text-slate-800">
                  Tài khoản đăng nhập (Email):{" "}
                  <strong className="font-mono text-emerald-800">
                    {detail.data.parentEmail || "Chưa tạo tài khoản"}
                  </strong>
                </p>
                <p className="text-sm text-slate-800">
                  Điện thoại liên hệ:{" "}
                  <strong>{detail.data.parentPhone || detail.data.emergencyContactPhone || "—"}</strong>
                </p>
              </div>

              <div className="space-y-1 text-sm bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p>
                  <strong>Ghi chú y tế:</strong>{" "}
                  {detail.data.medicalNotes || "Bình thường / Chưa có ghi nhận đặc biệt"}
                </p>
              </div>

              <div className="border-t pt-3">
                <h3 className="font-semibold text-sm mb-2 text-slate-800">Dị ứng đã ghi nhận</h3>
                {detail.data.allergies
                  ?.filter((a: any) => a.isActive !== false)
                  .map((a: any) => (
                    <p key={a.id} className="text-sm text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg mb-1 border border-rose-200">
                      ⚠️ <b>{a.customAllergenName || a.allergen?.nameVi || "Dị ứng thực phẩm"}</b> ({a.severity})
                      {a.note ? ` — ${a.note}` : ""}
                    </p>
                  ))}
                {!detail.data.allergies?.some((a: any) => a.isActive !== false) && (
                  <p className="text-sm text-slate-500 italic">Chưa có khai báo dị ứng (Chế độ ăn tiêu chuẩn).</p>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* ─── MODAL XÁC NHẬN IMPORT EXCEL ─── */}
      {importRows && (
        <Modal
          title="Xác nhận nhập danh sách học sinh"
          onClose={() => setImportRows(null)}
          busy={action.busy}
        >
          <p className="mb-4 text-sm text-slate-600">
            {importRows.length} dòng hợp lệ. Mã học sinh đã tồn tại sẽ được cập nhật.
          </p>
          <div className="max-h-72 overflow-auto text-xs space-y-1">
            {importRows.map((r, i) => (
              <p key={i} className="py-1.5 px-2 bg-slate-50 rounded border border-slate-100">
                {i + 1}. <b>{r.fullName}</b> · Ngày sinh: {r.dateOfBirth} · Lớp {r.classId}
                {r.parentName ? ` · Phụ huynh: ${r.parentName}` : ""}
                {r.parentEmail ? ` (${r.parentEmail})` : ""}
              </p>
            ))}
          </div>
          <Feedback error={action.error} />
          <button
            className="kp-button primary mt-4 w-full"
            disabled={action.busy}
            onClick={() => void importFile()}
          >
            {action.busy ? "Đang nhập…" : "Xác nhận nhập"}
          </button>
        </Modal>
      )}
    </SchoolPage>
  );
}
