import { downloadExcel, downloadExcelSheets, studentHeaderRow } from '../../../core/utils/excel-export';
import { formatDateDMY } from '../../../core/utils/date';
import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import { Download, Upload, FileSpreadsheet } from "lucide-react";
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
import { useAcademicYearFilter } from '../../academic-years/useAcademicYearFilter';
import { academicYearsApi } from '../../academic-years/academic-years.api';

export function StudentManagementPage() {
  useLanguage();
  const isTeacherPortal = useLocation().pathname.startsWith("/teacher/");
  const yearFilter = useAcademicYearFilter(!isTeacherPortal);
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
        academicYearId: yearFilter.yearId || undefined,
        allAcademicYears: !isTeacherPortal && !yearFilter.loading && !yearFilter.error && !yearFilter.yearId || undefined,
        classId: classId || undefined,
        page,
        limit: 25,
      }),
    [search, classId, page, yearFilter.yearId, yearFilter.loading, yearFilter.error],
  );
  const classes = useSchoolResource(
    async () => yearFilter.yearId ? (await academicYearsApi.detail(yearFilter.yearId)).classes : fetchKitchenCollection("/classes"),
    [yearFilter.yearId],
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
      medicalNotes: row?.medicalNotes || "",
      parentName: row?.parentName || "",
      parentPhone: row?.parentPhone || "",
      parentEmail: row?.parentEmail || "",
      parentRelationship: row?.parentRelationship || "FATHER",
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
      const payload = {
        ...validated,
        medicalNotes: form.medicalNotes?.trim() || undefined,
        parentName: form.parentName?.trim() || undefined,
        parentPhone: form.parentPhone?.trim() || undefined,
        parentEmail: form.parentEmail?.trim() || undefined,
        parentRelationship: form.parentRelationship || undefined,
      };
      if (id) await childrenApi.updateChild(id, payload as any);
      else await childrenApi.createChild(payload as any);
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
        cellDates: false,
      });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const headerRow = studentHeaderRow(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, range: 0, defval: '' }));
      if (headerRow < 0) throw new Error('Không tìm thấy dòng tiêu đề họ tên và ngày sinh học sinh.');
      const raw = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { range: headerRow, raw: true, defval: '' });
      setImportRows(
        validateStudentRows(
          raw,
          (classes.data || []).map((c) => String(c.id)),
          schoolDate(),
          headerRow + 2,
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

  const handleDownloadTemplate = () => {
    const headers = [
      "Họ và tên (*)",
      "Ngày sinh (YYYY-MM-DD) (*)",
      "Giới tính (Nam/Nữ) (*)",
      "Mã lớp (*)",
      "Tên lớp (Tham khảo)",
    ];

    const sampleClasses = classes.data || [];
    const c1 = sampleClasses[0] || { id: 1, name: "Lớp Mầm 1" };
    const c2 = sampleClasses[1] || c1;

    const sampleRows = [
      ["Nguyễn Hoàng Khang", "2021-04-12", "Nam", c1.id, c1.name],
      ["Trần Thảo Linh", "2021-08-20", "Nữ", c2.id, c2.name],
      ["Lê Minh Quân", "2021-02-15", "Nam", c1.id, c1.name],
    ];

    void downloadExcelSheets('Mau_Nhap_Danh_Sach_Hoc_Sinh.xlsx', 'Mẫu nhập danh sách học sinh', [
      { name: 'Danh_Sach_Hoc_Sinh', translateHeaders: false, rows: [headers, ...sampleRows] },
      {
        name: 'Danh_Muc_Lop_Hoc', rows: [
          ['Mã lớp', 'Tên lớp', 'Độ tuổi'],
          ...sampleClasses.map((c: any) => [c.id, c.name, c.ageGroup || c.grade || '']),
        ]
      },
    ]);
  };

  const handleExportStudents = async () => {
    if (!students.length) return;
    const headers = [
      'STT',
      'Mã học sinh',
      'Họ và tên',
      'Lớp học',
      'Ngày sinh',
      'Giới tính',
      'Ghi chú dị ứng',
      'Phụ huynh',
      'Số điện thoại',
    ];
    const rows = students.map((s, idx) => [
      idx + 1,
      s.code,
      s.name,
      s.className || 'Chưa phân lớp',
      s.dateOfBirth ? formatDateDMY(s.dateOfBirth) : '',
      s.gender === 'FEMALE' ? 'Nữ' : 'Nam',
      s.allergies?.join('; ') || '',
      s.parentName || '',
      s.parentPhone || '',
    ]);
    await downloadExcel(
      `Danh_sach_hoc_sinh_${new Date().toISOString().slice(0, 10)}.xlsx`,
      [headers, ...rows],
      'Danh sách học sinh'
    );
  };

  return (
    <SchoolPage
      title={translateText(isTeacherPortal ? "Hồ sơ học sinh lớp phụ trách" : "Hồ sơ học sinh")}
      description={translateText("Quản lý danh sách học sinh thuộc lớp phụ trách và hồ sơ cá nhân của học sinh.")}
    >
      <input
        ref={input}
        hidden
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={(e) => void readFile(e.target.files?.[0])}
      />
      <Feedback
        error={importError || action.error || classes.error || yearFilter.error}
        message={action.message}
      />

      {isTeacherPortal && <TeacherStatsOverview classes={classes.data} />}

      <div className="kp-filters flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {!isTeacherPortal && (
            <label className="flex items-center gap-2 text-sm text-slate-600">{translateText("Năm học")}<select aria-label={translateText("Năm học")} value={yearFilter.yearId} onChange={(e) => {
                yearFilter.setYearId(e.target.value); setClassId(''); setPage(1);
              }}>
                <option value="">{translateText("Tất cả năm học")}</option>
                {yearFilter.years.map(year => <option key={year.id} value={year.id}>{year.name}{year.status === 'ACTIVE' ? ' (đang áp dụng)' : ''}</option>)}
              </select>
            </label>
          )}
          <input
            type="search"
            aria-label={translateText("Tìm học sinh")}
            value={search}
            placeholder={translateText("Tìm tên hoặc mã học sinh…")}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <select
            aria-label={translateText("Lớp học")}
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{translateText(isTeacherPortal ? "Tất cả lớp được phân công" : "Tất cả lớp")}</option>
            {(classes.data || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className="kp-button"
            disabled={resource.loading}
            onClick={resource.reload}
          >{translateText("Làm mới")}</button>
          <button
            type="button"
            className="kp-button inline-flex items-center gap-1.5"
            onClick={handleExportStudents}
            title={translateText("Xuất toàn bộ danh sách học sinh ra file Excel")}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>{translateText("Xuất Excel")}</span>
          </button>
          <button
            type="button"
            className="kp-button inline-flex items-center gap-1.5"
            onClick={handleDownloadTemplate}
            title={translateText("Tải file Excel mẫu để nhập danh sách học sinh")}
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>{translateText("Tải file mẫu")}</span>
          </button>
          <button
            type="button"
            className="kp-button inline-flex items-center gap-1.5"
            disabled={classes.loading || !!classes.error}
            onClick={() => input.current?.click()}
          >
            <Upload className="w-4 h-4 text-blue-600" />
            <span>{translateText("Nhập Excel/CSV")}</span>
          </button>
          <button
            type="button"
            className="kp-button primary"
            disabled={classes.loading || !!classes.error || (isTeacherPortal && !classes.data?.length)}
            onClick={() => openForm()}
          >
            {translateText(isTeacherPortal ? "Thêm học sinh vào lớp" : "Thêm học sinh")}
          </button>
        </div>
      </div>

      {isTeacherPortal && !classes.loading && !classes.error && classes.data?.length === 0 && (
        <Feedback message="Tài khoản chưa được phân công lớp. Vui lòng liên hệ Ban Giám Hiệu để kiểm tra phân công giáo viên." />
      )}

      <State resource={resource} empty={!rows.length} />

      {!resource.loading && !!rows.length && (
        <div className="overflow-auto bg-white border rounded-xl shadow-xs">
          <table className="w-full text-sm text-left">
            <thead className="bg-teal-600 text-white border-b border-teal-700/60">
              <tr>
                {[
                  translateText("Mã học sinh"),
                  translateText("Họ tên học sinh"),
                  translateText("Ngày sinh"),
                  translateText("Giới tính"),
                  translateText("Lớp"),
                  translateText("Phụ huynh liên kết"),
                  translateText("Thao tác"),
                ].map((h) => (
                  <th className="p-3 whitespace-nowrap font-bold text-white text-xs uppercase tracking-wider" key={h}>
                    {translateText(h)}
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
                    {translateText(formatDateDMY(row.dateOfBirth) || "—")}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${row.gender === "FEMALE" ? "bg-pink-50 text-pink-700 border border-pink-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
                      {row.gender === "FEMALE" ? translateText("Nữ") : translateText("Nam")}
                    </span>
                  </td>
                  <td className="p-3 text-slate-700">
                    {row.className ||
                      row.class?.name ||
                      (classes.data || []).find(
                        (c) => String(c.id) === String(row.classId),
                      )?.name ||
                      translateText("Chưa phân lớp")}
                  </td>
                  <td className="p-3">
                    {row.parentName ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {row.parentName}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 italic">{translateText("Chưa liên kết")}</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        className="kp-button text-xs"
                        onClick={() => setDetailId(String(row.id))}
                      >{translateText("Chi tiết")}</button>
                      <button
                        className="kp-button text-xs"
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

      <div className="flex gap-3 items-center text-sm mt-4">
        <span>
          {total}{translateText(" học sinh · Trang ")}{page}/{Math.max(1, Math.ceil(total / 25))}
        </span>
        <button
          className="kp-button"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >{translateText("Trước")}</button>
        <button
          className="kp-button"
          disabled={page * 25 >= total}
          onClick={() => setPage(page + 1)}
        >{translateText("Sau")}</button>
      </div>

      {/* ─── MODAL THÊM / CẬP NHẬT HỒ SƠ HỌC SINH ─── */}
      {editing && (
        <Modal
          title={translateText(editing.id ? "Cập nhật hồ sơ học sinh" : "Thêm hồ sơ học sinh mới")}
          onClose={() => setEditing(null)}
          busy={action.busy}
        >
          <form onSubmit={save} className="space-y-4">
            <Feedback error={action.error} />

            <div className="border-b pb-3 space-y-3">
              <h3 className="font-bold text-sm text-emerald-900 uppercase tracking-wide">{translateText("Thông tin học sinh")}</h3>
              <Field label={translateText("Họ và tên học sinh")}>
                <input
                  className="kp-input"
                  required
                  placeholder={translateText("VD: Nguyễn Gia Huy")}
                  value={editing.fullName}
                  onChange={(e) =>
                    setEditing({ ...editing, fullName: e.target.value })
                  }
                />
              </Field>
              <Field label={translateText("Mã học sinh (*)")}>
                <input
                  className="kp-input"
                  required
                  placeholder={translateText("VD: HD-2026-01 (Bắt buộc, không trùng lặp)")}
                  value={editing.studentCode}
                  onChange={(e) =>
                    setEditing({ ...editing, studentCode: e.target.value })
                  }
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={translateText("Ngày sinh")}>
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
                <Field label={translateText("Giới tính")}>
                  <select
                    className="kp-input"
                    required
                    value={editing.gender}
                    onChange={(e) =>
                      setEditing({ ...editing, gender: e.target.value })
                    }
                  >
                    <option value="MALE">{translateText("Nam")}</option>
                    <option value="FEMALE">{translateText("Nữ")}</option>
                  </select>
                </Field>
              </div>
              <Field label={translateText("Lớp học")}>
                <select
                  className="kp-input"
                  required
                  value={editing.classId}
                  onChange={(e) =>
                    setEditing({ ...editing, classId: e.target.value })
                  }
                >
                  <option value="">{translateText("Chọn lớp")}</option>
                  {(classes.data || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label={translateText("Ghi chú y tế & sức khỏe")}>
              <textarea
                className="kp-input"
                placeholder={translateText("VD: Tiền sử sốt co giật; Dị ứng nhẹ...")}
                value={editing.medicalNotes}
                onChange={(e) =>
                  setEditing({ ...editing, medicalNotes: e.target.value })
                }
              />
            </Field>

            <div className="border-t border-slate-200 pt-3 mt-3 space-y-3">
              <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider">
                {translateText("Thông tin phụ huynh liên kết")}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label={translateText("Họ tên phụ huynh")}>
                  <input
                    className="kp-input"
                    placeholder={translateText("VD: Nguyễn Văn Nam")}
                    value={editing.parentName || ""}
                    onChange={(e) =>
                      setEditing({ ...editing, parentName: e.target.value })
                    }
                  />
                </Field>
                <Field label={translateText("Số điện thoại phụ huynh")}>
                  <input
                    className="kp-input"
                    placeholder={translateText("VD: 0912345678")}
                    value={editing.parentPhone || ""}
                    onChange={(e) =>
                      setEditing({ ...editing, parentPhone: e.target.value })
                    }
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label={translateText("Email phụ huynh (để đăng nhập App)")}>
                  <input
                    className="kp-input"
                    type="email"
                    placeholder={translateText("VD: phuhuynh@gmail.com")}
                    value={editing.parentEmail || ""}
                    onChange={(e) =>
                      setEditing({ ...editing, parentEmail: e.target.value })
                    }
                  />
                </Field>
                <Field label={translateText("Mối quan hệ")}>
                  <select
                    className="kp-input"
                    value={editing.parentRelationship || "FATHER"}
                    onChange={(e) =>
                      setEditing({ ...editing, parentRelationship: e.target.value })
                    }
                  >
                    <option value="FATHER">{translateText("Bố")}</option>
                    <option value="MOTHER">{translateText("Mẹ")}</option>
                    <option value="GUARDIAN">{translateText("Người giám hộ")}</option>
                  </select>
                </Field>
              </div>
            </div>

            <button
              className="kp-button primary w-full"
              disabled={action.busy || classes.loading || !!classes.error}
            >
              {translateText(action.busy ? "Đang lưu…" : editing.id ? "Cập nhật hồ sơ học sinh" : "Lưu hồ sơ học sinh")}
            </button>
          </form>
        </Modal>
      )}

      {/* ─── MODAL XEM CHI TIẾT HỒ SƠ HỌC SINH ─── */}
      {detailId && (
        <Modal title={translateText("Chi tiết hồ sơ học sinh")} onClose={() => setDetailId("")}>
          <State resource={detail} />
          {!detail.loading && !detail.error && detail.data && (
            <div className="space-y-4">
              <div className="border-b pb-3">
                <h2 className="font-bold text-xl text-slate-900">{detail.data.fullName}</h2>
                <p className="text-sm text-slate-500 mt-1">{translateText("Mã học sinh: ")}<b className="text-slate-800">{detail.data.studentCode || "—"}</b>{translateText(" · Ngày sinh:")}{" "}
                  <b className="text-slate-800">{translateText(formatDateDMY(detail.data.dateOfBirth) || "—")}</b>{translateText(" · Giới tính:")}{" "}
                  <b className="text-slate-800">{translateText(detail.data.gender === "MALE" ? "Nam" : "Nữ")}</b>
                </p>
                <p className="text-sm text-slate-500">{translateText("Lớp học: ")}<b className="text-slate-800">{detail.data.className || translateText("Chưa phân lớp")}</b>
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1 text-sm">
                <p className="text-slate-700">
                  <span className="font-semibold">{translateText("Phụ huynh liên kết:")}</span>{" "}
                  {detail.data.parentName ? (
                    <span className="text-emerald-800 font-semibold">
                      {detail.data.parentName} {detail.data.parentRelationship ? `(${translateText(detail.data.parentRelationship)})` : ""}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">{translateText("Chưa có phụ huynh liên kết")}</span>
                  )}
                </p>
              </div>

              <div className="space-y-1 text-sm bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p>
                  <strong>{translateText("Ghi chú y tế:")}</strong>{" "}
                  {detail.data.medicalNotes || translateText("Bình thường / Chưa có ghi nhận đặc biệt")}
                </p>
              </div>

              <div className="border-t pt-3">
                <h3 className="font-semibold text-sm mb-2 text-slate-800">{translateText("Dị ứng đã ghi nhận")}</h3>
                {detail.data.allergies
                  ?.filter((a: any) => a.isActive !== false)
                  .map((a: any) => (
                    <p key={a.id} className="text-sm text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg mb-1 border border-rose-200">
                      ⚠️ <b>{translateText(a.customAllergenName || a.allergen?.nameVi || "Dị ứng thực phẩm")}</b> ({translateText(a.severity)})
                      {translateText(a.note ? ` — ${a.note}` : "")}
                    </p>
                  ))}
                {!detail.data.allergies?.some((a: any) => a.isActive !== false) && (
                  <p className="text-sm text-slate-500 italic">{translateText("Chưa có khai báo dị ứng (Chế độ ăn tiêu chuẩn).")}</p>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* ─── MODAL XÁC NHẬN IMPORT EXCEL ─── */}
      {importRows && (
        <Modal
          title={translateText("Xác nhận nhập danh sách học sinh")}
          onClose={() => setImportRows(null)}
          busy={action.busy}
        >
          <p className="mb-4 text-sm text-slate-600">
            {importRows.length}{translateText(" dòng hợp lệ. Mã học sinh sẽ được hệ thống tự sinh khi nhập.")}</p>
          <div className="max-h-72 overflow-auto text-xs space-y-1">
            {importRows.map((r, i) => (
              <p key={i} className="py-1.5 px-2 bg-slate-50 rounded border border-slate-100">
                {i + 1}. <b>{r.fullName}</b>{translateText(" · Ngày sinh: ")}{translateText(formatDateDMY(r.dateOfBirth))}{translateText(" · Giới tính: ")}{translateText(r.gender === "FEMALE" ? "Nữ" : "Nam")}{translateText(" · Mã lớp: ")}{translateText(r.classId)}
              </p>
            ))}
          </div>
          <Feedback error={action.error} />
          <button
            className="kp-button primary mt-4 w-full"
            disabled={action.busy}
            onClick={() => void importFile()}
          >
            {translateText(action.busy ? "Đang nhập…" : "Xác nhận nhập")}
          </button>
        </Modal>
      )}
    </SchoolPage>
  );
}
