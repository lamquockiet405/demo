import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useMemo, useState, useEffect } from "react";
import {
  Download,
  ShieldCheck,
  Users,
  ClipboardList,
  ShieldAlert,
  School,
  BellRing,
  UtensilsCrossed,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  Check,
  Layers,
  Sparkles,
  FileSpreadsheet,
  X,
} from "lucide-react";
import { apiClient } from "../../../core/api/axios";
import { attendanceApi } from "../../attendance/api/attendanceApi";
import { useSchoolBranding } from "../../../core/hooks/useSchoolBranding";
import {
  getSchoolDate,
  normalizeKitchenData,
  normalizeSearch,
  KitchenAlert,
} from "../utils/kds-data";
import { downloadExcel, rowsOf } from "../utils/kitchen-operations";
import {
  PageTitle,
  Pager,
  ReloadButton,
  ResourceState,
  useKitchenResource,
} from "../components/KitchenUI";
import { KitchenSummaryCards } from "../components/KitchenSummaryCards";

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
  useLanguage();
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
      <div className="kp-filters">
        <input
          type="search"
          aria-label={translateText("Tìm học sinh hoặc dị nguyên")}
          placeholder={translateText("Tên trẻ, mã, thực phẩm cần tránh…")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label={translateText("Lọc lớp dị ứng")}
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{translateText("Tất cả lớp")}</option>
          {classes.map(([id, name]) => (
            <option key={id} value={id}>
              {translateText(name)}
            </option>
          ))}
        </select>
        <select
          aria-label={translateText("Mức độ dị ứng")}
          value={severity}
          onChange={(e) => {
            setSeverity(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{translateText("Tất cả mức độ")}</option>
          {["LOW", "MEDIUM", "HIGH", "SEVERE", "ANAPHYLACTIC"].map((s) => (
            <option key={s} value={s}>
              {translateText(severityLabel(s))}
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
        >{translateText("Xóa bộ lọc")}</button>
        <ReloadButton loading={resource.loading} reload={resource.reload} />
        <button
          className="kp-button"
          disabled={!rows.length}
          onClick={() =>
            downloadExcel("danh-sach-che-do-an.xlsx", [
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
          <Download size={15} />{translateText("Xuất danh sách")}
        </button>
      </div>
      <ResourceState resource={resource} empty={!rows.length} />
      {resource.data && (
        <>
          <div className="kp-table-wrap">
            <table className="kp-table">
              <thead>
                <tr>
                  <th>{translateText("Học sinh")}</th>
                  <th>{translateText("Lớp")}</th>
                  <th>{translateText("Thực phẩm cần tránh")}</th>
                  <th>{translateText("Mức độ / chế độ")}</th>
                  <th>{translateText("Hướng dẫn đã khai báo")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice((page - 1) * 12, page * 12).map((row, index) => (
                  <tr key={`${row.id}-${index}`}>
                    <td>
                      <strong>{row.childName}</strong>
                      <small>{translateText(row.code)}</small>
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
                        {translateText(severityLabel(row.severity))}
                      </span>
                      <small>
                        {translateText(row.allergyType === "INTOLERANCE"
                          ? "Không dung nạp"
                          : row.allergyType === "ALLERGY"
                            ? "Dị ứng thực phẩm"
                            : row.allergyType || "Chế độ ăn riêng")}
                      </small>
                    </td>
                    <td>
                      <p className="kp-note-text">
                        {translateText(row.note ||
                          row.symptoms ||
                          "Chưa có hướng dẫn bổ sung")}
                      </p>
                      {row.reactionTreatment && (
                        <small>{translateText("Hướng dẫn xử trí đã khai báo: ")}{row.reactionTreatment}
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
  useLanguage();
  const schoolBranding = useSchoolBranding();
  const [date, setDate] = useState(getSchoolDate);
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedAllergen, setSelectedAllergen] = useState("");
  const [prepFilter, setPrepFilter] = useState<"ALL" | "PENDING" | "PREPARED">("ALL");
  const [viewMode, setViewMode] = useState<"STUDENT" | "CLASS" | "DETAILED">("STUDENT");

  // Quản lý trạng thái chuẩn bị khay ăn trong ngày (lưu vào localStorage theo ngày)
  const [preparedMap, setPreparedMap] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(`kds_prep_trays_${date}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`kds_prep_trays_${date}`);
      setPreparedMap(saved ? JSON.parse(saved) : {});
    } catch {
      setPreparedMap({});
    }
  }, [date]);

  const togglePrepared = (trayKey: string) => {
    setPreparedMap((prev) => {
      const next = { ...prev, [trayKey]: !prev[trayKey] };
      try {
        localStorage.setItem(`kds_prep_trays_${date}`, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const markAllPreparedInClass = (className: string, mark = true) => {
    setPreparedMap((prev) => {
      const next = { ...prev };
      childTrays
        .filter((t) => t.className === className)
        .forEach((t) => {
          next[t.key] = mark;
        });
      try {
        localStorage.setItem(`kds_prep_trays_${date}`, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const resource = useKitchenResource(
    async () => normalizeKitchenData(await attendanceApi.getKitchenKdsData(date)),
    [date],
  );

  const rawAlerts = resource.data?.alerts || [];

  // Helper tách tên thực phẩm dị ứng sạch
  const cleanAllergen = (instruction?: string): string => {
    if (!instruction) return "Thực phẩm cấm kỵ";
    const match = instruction.match(/(?:1\s*suất\s*)?(?:không\s*)?([^(]+?)(?:\s*\(.*?\))?$/i);
    return match && match[1].trim() ? match[1].trim() : instruction.trim();
  };

  // Nhóm theo từng bé (1 bé có thể có 2-3 món dị ứng gom chung vào 1 khay ăn)
  const childTrays = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        childName: string;
        className: string;
        allergens: string[];
        rawInstructions: string[];
        replacementMeals: string[];
        notes: string[];
        severity: string;
        urgent: boolean;
        isPrepared: boolean;
      }
    >();

    rawAlerts.forEach((alert) => {
      const key = `${alert.className}__${alert.childName}`;
      const alg = cleanAllergen(alert.allergen);

      if (!map.has(key)) {
        map.set(key, {
          key,
          childName: alert.childName || "Học sinh ăn riêng",
          className: alert.className || "Chưa rõ lớp",
          allergens: [alg],
          rawInstructions: alert.allergen ? [alert.allergen] : [],
          replacementMeals: alert.replacementMeal ? [alert.replacementMeal] : [],
          notes: alert.notes ? [alert.notes] : [],
          severity: alert.severity || "Cần kiểm tra",
          urgent: Boolean(alert.urgent),
          isPrepared: Boolean(preparedMap[key]),
        });
      } else {
        const item = map.get(key)!;
        if (!item.allergens.includes(alg)) {
          item.allergens.push(alg);
        }
        if (alert.allergen && !item.rawInstructions.includes(alert.allergen)) {
          item.rawInstructions.push(alert.allergen);
        }
        if (alert.replacementMeal && !item.replacementMeals.includes(alert.replacementMeal)) {
          item.replacementMeals.push(alert.replacementMeal);
        }
        if (alert.notes && !item.notes.includes(alert.notes)) {
          item.notes.push(alert.notes);
        }
        if (alert.urgent) item.urgent = true;
      }
    });

    return Array.from(map.values()).map((t) => ({
      ...t,
      isPrepared: Boolean(preparedMap[t.key]),
    }));
  }, [rawAlerts, preparedMap]);

  // Danh sách các lớp học có cảnh báo
  const availableClasses = useMemo(
    () => Array.from(new Set(rawAlerts.map((a) => a.className).filter(Boolean))).sort(),
    [rawAlerts],
  );

  // Danh sách các dị nguyên có trong ngày
  const availableAllergens = useMemo(() => {
    const set = new Set<string>();
    childTrays.forEach((t) => t.allergens.forEach((a) => set.add(a)));
    return Array.from(set).sort();
  }, [childTrays]);

  // Bộ lọc danh sách khay ăn của bé
  const filteredChildTrays = useMemo(() => {
    return childTrays.filter((tray) => {
      if (selectedClass && tray.className !== selectedClass) return false;
      if (selectedAllergen && !tray.allergens.includes(selectedAllergen)) return false;
      if (prepFilter === "PREPARED" && !tray.isPrepared) return false;
      if (prepFilter === "PENDING" && tray.isPrepared) return false;
      if (search.trim()) {
        const q = normalizeSearch(search);
        const text = normalizeSearch(
          `${tray.childName} ${tray.className} ${tray.allergens.join(" ")} ${tray.notes.join(" ")}`,
        );
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [childTrays, selectedClass, selectedAllergen, prepFilter, search]);

  // Nhóm theo lớp học
  const classGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        className: string;
        trays: typeof filteredChildTrays;
        preparedCount: number;
      }
    >();

    filteredChildTrays.forEach((tray) => {
      if (!map.has(tray.className)) {
        map.set(tray.className, {
          className: tray.className,
          trays: [tray],
          preparedCount: tray.isPrepared ? 1 : 0,
        });
      } else {
        const g = map.get(tray.className)!;
        g.trays.push(tray);
        if (tray.isPrepared) g.preparedCount++;
      }
    });

    return Array.from(map.values()).sort((a, b) => a.className.localeCompare(b.className));
  }, [filteredChildTrays]);

  // Bộ lọc chi tiết từng cảnh báo
  const filteredAlerts = useMemo(() => {
    return rawAlerts.filter((a) => {
      if (selectedClass && a.className !== selectedClass) return false;
      if (selectedAllergen && !cleanAllergen(a.allergen).includes(selectedAllergen)) return false;
      if (search.trim()) {
        const q = normalizeSearch(search);
        const text = normalizeSearch(`${a.childName} ${a.className} ${a.allergen}`);
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [rawAlerts, selectedClass, selectedAllergen, search]);

  const preparedCount = childTrays.filter((t) => t.isPrepared).length;

  // In tem dán khay ăn A4
  const handlePrintStickers = (traysToPrint = filteredChildTrays) => {
    if (!traysToPrint.length) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const formattedDate = date ? date.split("-").reverse().join("/") : "";
    const schoolName = schoolBranding?.name || "TRƯỜNG MẦM NON";

    const stickersHtml = traysToPrint
      .map(
        (tray) => `
      <div class="sticker">
        <div class="sticker-header">
          <div class="school">${schoolName}</div>
          <div class="badge-red">KHAY ĂN RIÊNG</div>
        </div>
        <div class="child-title">
          <div class="name">${tray.childName}</div>
          <div class="class-info">${tray.className} • Ngày: ${formattedDate}</div>
        </div>
        <div class="warning-box">
          <div class="warning-title">⚠️ TUYỆT ĐỐI CẤM / KIÊNG KỴ:</div>
          <div class="allergen-tags">
            ${tray.allergens.map((alg) => `<span class="tag">🚫 ${alg}</span>`).join("")}
          </div>
        </div>
        ${tray.replacementMeals.length
            ? `<div class="sub-info">✓ Suất thay thế: <strong>${tray.replacementMeals.join(", ")}</strong></div>`
            : ""
          }
        <div class="signatures">
          <span>Bếp kiểm tra: [ &nbsp; ] Đạt</span>
          <span>Giáo viên nhận: [ &nbsp; ] Đạt</span>
        </div>
      </div>
    `,
      )
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Tem Dán Khay Ăn Riêng - ${formattedDate}</title>
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            * { box-sizing: border-box; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background: #fff; color: #0f172a; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8mm; }
            .sticker {
              border: 2.5px solid #dc2626;
              border-radius: 12px;
              padding: 12px 14px;
              background: #fff;
              page-break-inside: avoid;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              min-height: 220px;
            }
            .sticker-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px dashed #f87171; padding-bottom: 6px; margin-bottom: 8px; }
            .school { font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; }
            .badge-red { background: #dc2626; color: #fff; font-size: 11px; font-weight: 900; padding: 2px 8px; border-radius: 6px; letter-spacing: 0.5px; }
            .child-title .name { font-size: 19px; font-weight: 900; color: #0f172a; line-height: 1.2; }
            .child-title .class-info { font-size: 13px; font-weight: 700; color: #047857; margin-top: 3px; }
            .warning-box { background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 8px; padding: 8px 10px; margin: 8px 0; }
            .warning-title { font-size: 10px; font-weight: 900; color: #991b1b; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px; }
            .allergen-tags { display: flex; flex-wrap: wrap; gap: 5px; }
            .tag { background: #fee2e2; color: #b91c1c; font-size: 13px; font-weight: 900; padding: 3px 8px; border-radius: 6px; border: 1px solid #f87171; }
            .sub-info { font-size: 12px; color: #065f46; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 4px 8px; margin-bottom: 6px; }
            .signatures { display: flex; justify-content: space-between; font-size: 11px; color: #64748b; font-weight: 600; border-top: 1px solid #e2e8f0; padding-top: 6px; margin-top: 4px; }
          </style>
        </head>
        <body>
          <div class="grid">${stickersHtml}</div>
          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Xuất Excel danh sách
  const handleExportExcel = () => {
    if (!filteredChildTrays.length) return;
    const data = [
      [
        "STT",
        "Học sinh",
        "Lớp học",
        "Thực phẩm cần tránh",
        "Suất thay thế chỉ định",
        "Mức độ cảnh báo",
        "Trạng thái chuẩn bị",
        "Ghi chú",
      ],
      ...filteredChildTrays.map((tray, idx) => [
        idx + 1,
        tray.childName,
        tray.className,
        tray.allergens.join(", "),
        tray.replacementMeals.join(", ") || "Chế biến khẩu phần riêng",
        tray.severity,
        tray.isPrepared ? "Đã chuẩn bị khay riêng" : "Chưa chuẩn bị",
        tray.notes.join("; "),
      ]),
    ];
    downloadExcel(`canh-bao-di-ung-${date}.xlsx`, data);
  };

  return (
    <div className="space-y-6">
      {/* ─── 1. BẢNG THỐNG KÊ KPI TỔNG QUAN ─── */}
      {resource.data && !resource.error && (
        <KitchenSummaryCards
          metrics={[
            {
              label: "Tổng cảnh báo",
              value: rawAlerts.length,
              icon: BellRing,
              tone: "danger",
            },
            {
              label: "Học sinh cần lưu ý",
              value: childTrays.length,
              icon: Users,
              tone: "warning",
            },
            {
              label: "Lớp có cảnh báo",
              value: availableClasses.length,
              icon: School,
              tone: "neutral",
            },
            {
              label: "Có suất thay thế",
              value: rawAlerts.filter((alert) => Boolean(alert.replacementMeal)).length,
              icon: UtensilsCrossed,
              tone: "success",
            },
          ]}
        />
      )}

      {/* ─── 2. HEADER TIÊU ĐỀ & CÁC NÚT HÀNH ĐỘNG NHANH ─── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">{translateText("Bếp Bán Trú • KDS")}</span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-semibold text-slate-500">{translateText("Kiểm tra định lượng & tem dán khay ăn riêng")}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0" />
            <span>{translateText("Cảnh Báo Dị Ứng & Suất Ăn Riêng Của Bé")}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            {translateText(
              "Tách riêng suất ăn đặc biệt cho từng học sinh có hồ sơ dị ứng trước giờ chia khay. In tem dán khay chống nhầm lẫn trước khi bàn giao cho giáo viên.",
            )}
          </p>
        </div>

        {/* Nút hành động */}
        <div className="flex flex-wrap items-center gap-2">
          <ReloadButton loading={resource.loading} reload={resource.reload} />

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={!filteredChildTrays.length}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 shadow-2xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>{translateText("Xuất Excel")}</span>
          </button>

          <button
            type="button"
            onClick={() => handlePrintStickers(filteredChildTrays)}
            disabled={!filteredChildTrays.length}
            className="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>{translateText("In tem dán khay ăn")}</span>
          </button>
        </div>
      </div>

      {/* ─── 3. THANH TÌM KIẾM & BỘ LỌC ĐA NĂNG ─── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Ngày phục vụ */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
              {translateText("Ngày phục vụ")}
            </label>
            <input
              type="date"
              aria-label={translateText("Ngày phục vụ")}
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none transition"
            />
          </div>

          {/* Ô tìm kiếm */}
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
              {translateText("Tìm kiếm học sinh / dị nguyên")}
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="search"
                aria-label={translateText("Tìm kiếm")}
                placeholder={translateText("Tìm tên trẻ, lớp, thực phẩm kiêng cữ...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-8 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none transition"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Lọc theo Lớp */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
              {translateText("Lớp học")}
            </label>
            <select
              aria-label={translateText("Lọc theo lớp")}
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none transition cursor-pointer"
            >
              <option value="">{translateText("Tất cả lớp")}</option>
              {availableClasses.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/\s*\([^)]*\)/g, '').trim()}
                </option>
              ))}
            </select>
          </div>

          {/* Lọc theo Dị nguyên */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
              {translateText("Thực phẩm kiêng cữ")}
            </label>
            <select
              aria-label={translateText("Lọc theo thực phẩm")}
              value={selectedAllergen}
              onChange={(e) => setSelectedAllergen(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none transition cursor-pointer"
            >
              <option value="">{translateText("Tất cả dị nguyên")}</option>
              {availableAllergens.map((alg) => (
                <option key={alg} value={alg}>
                  {alg}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Chế độ xem & Tiến độ chuẩn bị */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
            <button
              type="button"
              onClick={() => setViewMode("STUDENT")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${viewMode === "STUDENT"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-500 hover:text-slate-900"
                }`}
            >
              <Users className="w-3.5 h-3.5 text-amber-600" />
              <span>{translateText("Theo học sinh & khay")}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold">{filteredChildTrays.length}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("CLASS")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${viewMode === "CLASS"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-500 hover:text-slate-900"
                }`}
            >
              <School className="w-3.5 h-3.5 text-indigo-600" />
              <span>{translateText("Theo lớp học")}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-800 font-bold">{classGroups.length}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("DETAILED")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${viewMode === "DETAILED"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-500 hover:text-slate-900"
                }`}
            >
              <Layers className="w-3.5 h-3.5 text-rose-600" />
              <span>{translateText("Tất cả yêu cầu")}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-800 font-bold">{filteredAlerts.length}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">{translateText("Lọc tiến độ:")}</span>
            <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200">
              <button
                type="button"
                onClick={() => setPrepFilter("ALL")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition flex items-center gap-1 ${prepFilter === "ALL"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
                  }`}
              >
                <span>{translateText("Tất cả")}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700 font-bold">{childTrays.length}</span>
              </button>
              <button
                type="button"
                onClick={() => setPrepFilter("PENDING")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition flex items-center gap-1 ${prepFilter === "PENDING"
                  ? "bg-white text-amber-800 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
                  }`}
              >
                <span>{translateText("Chờ chuẩn bị")}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold">{childTrays.filter((t) => !t.isPrepared).length}</span>
              </button>
              <button
                type="button"
                onClick={() => setPrepFilter("PREPARED")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition flex items-center gap-1 ${prepFilter === "PREPARED"
                  ? "bg-white text-emerald-800 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
                  }`}
              >
                <span>{translateText("Đã chuẩn bị")}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold">{preparedCount}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <ResourceState resource={resource} empty={!rawAlerts.length} />

      {/* ─── 4. KHU VỰC HIỂN THỊ CHÍNH ─── */}

      {/* CHẾ ĐỘ 1: THEO HỌC SINH & KHAY ĂN (GOM CHUNG CÁC DỊ NGUYÊN CỦA CÙNG 1 BÉ) */}
      {viewMode === "STUDENT" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>{translateText("Hiển thị")} <strong>{filteredChildTrays.length}</strong> {translateText("học sinh có chế độ ăn kiêng cữ")}</span>
            <span>{translateText("Tiến độ:")} <strong>{preparedCount}</strong> / <strong>{childTrays.length}</strong> {translateText("khay đã chuẩn bị")}</span>
          </div>

          {!filteredChildTrays.length ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
              <h3 className="text-base font-bold text-slate-800">{translateText("Không tìm thấy cảnh báo dị ứng phù hợp")}</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">{translateText("Không có học sinh nào trùng khớp với bộ lọc đã chọn. Hãy thử xóa bớt điều kiện lọc hoặc chọn ngày khác.")}</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/95 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4 w-12 text-center">#</th>
                      <th className="py-3 px-4">{translateText("Học sinh")}</th>
                      <th className="py-3 px-3">{translateText("Lớp học")}</th>
                      <th className="py-3 px-4 min-w-[220px]">{translateText("Tuyệt đối kiêng cữ / Dị ứng")}</th>
                      <th className="py-3 px-4 min-w-[200px]">{translateText("Suất thay thế & Ghi chú")}</th>
                      <th className="py-3 px-3 text-center">{translateText("Trạng thái khay")}</th>
                      <th className="py-3 px-4 text-right">{translateText("Thao tác")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredChildTrays.map((tray, idx) => {
                      const initials = tray.childName
                        .split(" ")
                        .map((w) => w[0])
                        .slice(-2)
                        .join("");
                      const cleanClass = tray.className.replace(/\s*\([^)]*\)/g, "").trim();

                      return (
                        <tr
                          key={tray.key}
                          className={`hover:bg-slate-50/80 transition align-middle ${
                            tray.isPrepared ? "bg-emerald-50/20" : ""
                          }`}
                        >
                          <td className="py-3.5 px-4 text-center font-bold text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 uppercase ${
                                  tray.isPrepared
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                    : "bg-amber-100 text-amber-800 border border-amber-300"
                                }`}
                              >
                                {initials || "BÉ"}
                              </div>
                              <strong className="font-bold text-slate-900 text-xs block">
                                {tray.childName}
                              </strong>
                            </div>
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap font-semibold text-slate-700">
                            {cleanClass}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1.5">
                              {tray.allergens.map((alg, aIdx) => (
                                <span
                                  key={aIdx}
                                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200"
                                >
                                  <span>🚫</span>
                                  <span>{alg}</span>
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 max-w-xs">
                            {tray.replacementMeals.length > 0 ? (
                              <span className="font-semibold text-emerald-800 block">
                                {tray.replacementMeals.join(", ")}
                              </span>
                            ) : (
                              <span className="text-slate-500">
                                {tray.allergens.length} {translateText("món cần loại trừ")}
                              </span>
                            )}
                            {tray.notes.length > 0 && (
                              <span className="text-[11px] text-slate-400 italic block mt-0.5 line-clamp-1">
                                {tray.notes.join(" • ")}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-center whitespace-nowrap">
                            {tray.isPrepared ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Check className="w-3 h-3" /> {translateText("Đã chuẩn bị")}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                {translateText("Chờ chuẩn bị")}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handlePrintStickers([tray])}
                                className="p-1.5 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition border border-slate-200 cursor-pointer"
                                title={translateText("In tem dán khay ăn riêng cho bé này")}
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => togglePrepared(tray.key)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                                  tray.isPrepared
                                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                    : "bg-amber-500 hover:bg-amber-600 text-white"
                                }`}
                              >
                                {tray.isPrepared ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>{translateText("Đã chuẩn bị")}</span>
                                  </>
                                ) : (
                                  <>
                                    <ShieldAlert className="w-3.5 h-3.5" />
                                    <span>{translateText("Xác nhận")}</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CHẾ ĐỘ 2: THEO LỚP HỌC (CHIA XE ĐẨY / BÀN GIAO) */}
      {viewMode === "CLASS" && (
        <div className="space-y-5">
          {!classGroups.length ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
              <h3 className="text-base font-bold text-slate-800">{translateText("Không có lớp nào có cảnh báo")}</h3>
            </div>
          ) : (
            classGroups.map((group) => (
              <div
                key={group.className}
                className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 space-y-4"
              >
                {/* Header lớp */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-black">
                      <School className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base text-slate-900">{group.className.replace(/\s*\([^)]*\)/g, '').trim()}</h3>
                      <p className="text-xs text-slate-500 font-medium">{translateText("Có")} <strong>{group.trays.length}</strong> {translateText("học sinh ăn riêng • Đã chuẩn bị:")}{" "}
                        <strong>{group.preparedCount}</strong> / {group.trays.length} khay
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => markAllPreparedInClass(group.className, true)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer"
                    >{translateText("Đánh dấu xong cả lớp")}</button>
                    <button
                      type="button"
                      onClick={() => handlePrintStickers(group.trays)}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>{translateText("In tem lớp này")}</span>
                    </button>
                  </div>
                </div>

                {/* Danh sách các bé trong lớp */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.trays.map((tray) => (
                    <div
                      key={tray.key}
                      className={`p-3.5 rounded-2xl border transition ${tray.isPrepared
                        ? "bg-emerald-50/40 border-emerald-200"
                        : "bg-slate-50/70 border-slate-200"
                        }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <strong className="text-sm font-bold text-slate-900">{tray.childName}</strong>
                        <button
                          type="button"
                          onClick={() => togglePrepared(tray.key)}
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-bold cursor-pointer transition ${tray.isPrepared
                            ? "bg-emerald-600 text-white"
                            : "bg-amber-100 text-amber-800 hover:bg-amber-200"
                            }`}
                        >
                          {tray.isPrepared ? "✓ Đã xong" : "Chờ làm"}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {tray.allergens.map((alg, aIdx) => (
                          <span
                            key={aIdx}
                            className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200"
                          >
                            🚫 {alg}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* CHẾ ĐỘ 3: DANH SÁCH CHI TIẾT TỪNG CẢNH BÁO */}
      {viewMode === "DETAILED" && (
        <div className="space-y-4">
          {!filteredAlerts.length ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
              <h3 className="text-base font-bold text-slate-800">{translateText("Không có cảnh báo nào")}</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                      <strong className="text-sm font-bold text-slate-900">{alert.childName}</strong>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                      {alert.severity}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 font-medium">{translateText("Lớp:")} <span className="font-bold text-slate-700">{alert.className.replace(/\s*\([^)]*\)/g, '').trim()}</span>
                  </div>

                  <div className="text-xs text-slate-800 bg-rose-50/70 border border-rose-200/70 rounded-xl p-2.5">
                    <span className="font-bold text-rose-900">{translateText("Nội dung yêu cầu:")} </span>
                    <span>{(alert.allergen || "Đối chiếu hồ sơ trước khi chế biến.").replace(/\s*\([^)]*\)/g, '').trim()}</span>
                  </div>

                  {alert.replacementMeal && (
                    <div className="text-xs text-emerald-800 bg-emerald-50/70 border border-emerald-200/70 rounded-xl p-2">
                      <span className="font-bold">{translateText("Suất thay thế:")} </span>
                      <span>{alert.replacementMeal}</span>
                    </div>
                  )}

                  {alert.notes && <p className="text-[11px] text-slate-500 italic">{alert.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
