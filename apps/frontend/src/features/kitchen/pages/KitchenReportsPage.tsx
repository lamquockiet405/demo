import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState } from "react";
import { Download, Printer } from "lucide-react";
import { mealOperationsApi } from "../api/meal-operations.api";
import { getSchoolDate } from "../utils/kds-data";
import {
  downloadCsv,
  formatDateTime,
  formatNumber,
} from "../utils/kitchen-operations";
import {
  PageTitle,
  ReloadButton,
  ResourceState,
  useKitchenResource,
} from "../components/KitchenUI";

import { sanitizeInspectionNote } from "../utils/inspection-note";

export function KitchenReportsPage() {
  useLanguage();
  const [date, setDate] = useState(getSchoolDate);
  const [tab, setTab] = useState("portions");
  const resource = useKitchenResource(
    () => mealOperationsApi.getDailyReport(date),
    [date],
  );
  const report = resource.data;
  const reconciliation = report?.reconciliation;
  const safety = report?.foodSafetyInspection;
  const consumption = report?.consumptionAndPlateWaste;
  const exportRows = () => {
    if (!report) return;
    const rows: unknown[][] = [
      ["Báo cáo vận hành bữa ăn", date, report.schoolName],
      ["Tổng học sinh", reconciliation?.totalEnrolledStudents],
      ["Suất trưa", reconciliation?.actualLunchCount],
      ["Suất phụ", reconciliation?.actualSnackCount],
      ["Suất riêng", reconciliation?.specialDietCount],
      [],
      [
        "Lớp",
        "Sĩ số",
        "Trưa",
        "Phụ",
        "Vắng phép",
        "Vắng không phép",
        "Ăn riêng",
      ],
      ...(reconciliation?.classBreakdown || []).map((c) => [
        c.className,
        c.enrolled,
        c.presentLunch,
        c.presentSnack,
        c.excusedAbsence,
        c.unexcusedAbsence,
        c.specialDiet,
      ]),
      [],
      ["Kiểm thực", "Kết quả", "Người kiểm", "Thời gian", "Ghi chú"].map(translateText),
    ];
    if (safety)
      for (const [name, step] of [
        ["Bước 1", safety.step1RawCheck],
        ["Bước 2", safety.step2ProcessingCheck],
        ["Bước 3", safety.step3PreServingCheck],
      ] as const)
        rows.push([
          translateText(name),
          translateText(step?.result),
          step?.inspectorName,
          step?.checkedAt,
          sanitizeInspectionNote(step?.notes),
        ]);
    rows.push(
      [],
      ["Món", "Nhóm", "Tỷ lệ thức ăn thừa (%)", "Cảnh báo"].map(translateText),
      ...(consumption?.dishWasteIndex || []).map((d) => [
        d.dishName,
        d.dishCategory,
        d.wastePercent,
        d.warning,
      ]),
    );
    downloadCsv(`bao-cao-van-hanh-${date}.csv`, rows);
  };
  return (
    <>
      <PageTitle
        title={translateText("Báo cáo vận hành bữa ăn")}
        description={translateText("Đối chiếu suất ăn, kiểm thực và phản hồi sau bữa của ngày được chọn.")}
      >
        <ReloadButton loading={resource.loading} reload={resource.reload} />
        <button className="kp-button" disabled={!report} onClick={exportRows}>
          <Download size={15} />{translateText("Xuất báo cáo")}</button>
        <button
          className="kp-button"
          disabled={!report}
          onClick={() => window.print()}
        >
          <Printer size={15} />{translateText("In báo cáo")}</button>
      </PageTitle>
      <div className="kp-filters">
        <label>{translateText("Ngày báo cáo")}<input
            type="date"
            aria-label={translateText("Ngày báo cáo bếp")}
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
          />
        </label>
        <span className="text-xs text-slate-500">{report?.schoolName}</span>
      </div>
      <ResourceState resource={resource} />
      {report && (
        <>
          <div className="kp-stats">
            {[
              [translateText("Tổng học sinh"), reconciliation?.totalEnrolledStudents],
              [translateText("Suất trưa thực tế"), reconciliation?.actualLunchCount],
              [translateText("Suất ăn sáng"), reconciliation?.actualSnackCount],
              [translateText("Suất chế độ riêng"), reconciliation?.specialDietCount],
            ].map(([label, value]) => (
              <div className="kp-stat" key={String(label)}>
                <span>{translateText(label)}</span>
                <strong>{translateText(formatNumber(value, 0))}</strong>
              </div>
            ))}
          </div>
          <div className="kp-tabs" role="tablist" aria-label={translateText("Nội dung báo cáo")}>
            {[
              ["portions", translateText("Cân đối suất ăn")],
              ["safety", translateText("Kiểm thực & lưu mẫu")],
              ["consumption", translateText("Tiêu thụ & phản hồi")],
            ].map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                className={tab === id ? "active" : ""}
                onClick={() => setTab(id)}
              >
                {translateText(label)}
              </button>
            ))}
          </div>
          {tab === "portions" && (
            <div className="kp-table-wrap">
              <table className="kp-table">
                <thead>
                  <tr>
                    <th>{translateText("Lớp")}</th>
                    <th>{translateText("Sĩ số")}</th>
                    <th>{translateText("Trưa")}</th>
                    <th>{translateText("Ăn phụ")}</th>
                    <th>{translateText("Vắng có phép")}</th>
                    <th>{translateText("Vắng không phép")}</th>
                    <th>{translateText("Ăn riêng")}</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciliation?.classBreakdown?.map((c) => (
                    <tr key={c.classId}>
                      <td>
                        <strong>{c.className}</strong>
                        <small>{translateText(c.ageGroup)}</small>
                      </td>
                      {[
                        c.enrolled,
                        c.presentLunch,
                        c.presentSnack,
                        c.excusedAbsence,
                        c.unexcusedAbsence,
                        c.specialDiet,
                      ].map((v, i) => (
                        <td key={i}>{translateText(formatNumber(v, 0))}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {tab === "safety" && (
            <>
              <div className="kp-card-grid">
                {safety &&
                  [
                    [translateText("Bước 1 · Nguyên liệu"), safety.step1RawCheck],
                    [translateText("Bước 2 · Chế biến"), safety.step2ProcessingCheck],
                    [translateText("Bước 3 · Trước khi ăn"), safety.step3PreServingCheck],
                  ].map(([label, step]: [string, any]) => (
                    <section className="kp-panel" key={label}>
                      <h2>{translateText(label)}</h2>
                      <span className="kp-tag">
                        {translateText(step?.result || "Chưa có kết quả")}
                      </span>
                      <p>{translateText("Người kiểm: ")}{step?.inspectorName || "—"}
                        <br />{translateText("Thời gian: ")}{translateText(formatDateTime(step?.checkedAt))}
                        <br />
                        {sanitizeInspectionNote(step?.notes) || translateText("Không có ghi chú thêm.")}
                      </p>
                      {step?.supplierName && (
                        <p>{translateText("Nhà cung cấp: ")}{step.supplierName}</p>
                      )}
                      {step?.equipmentHygiene && (
                        <p>{translateText("Vệ sinh thiết bị: ")}{translateText(step.equipmentHygiene)}</p>
                      )}
                      {step?.sensoryColorSmell && (
                        <p>{translateText("Cảm quan: ")}{translateText(step.sensoryColorSmell)}</p>
                      )}
                      {(step?.transportTempC != null ||
                        step?.coreBoilingTempC != null) && (
                        <p>{translateText("Nhiệt độ ghi nhận:")}{" "}
                          {translateText(formatNumber(
                            step.transportTempC ?? step.coreBoilingTempC,
                          ))}{" "}{translateText("°C")}</p>
                      )}
                    </section>
                  ))}
              </div>
              <section className="kp-panel mt-4">
                <h2>{translateText("Lưu mẫu 24 giờ")}</h2>
                <p>
                  {translateText(safety?.sampleRetention24h?.fridgeUnit ||
                    "Chưa có dữ liệu tủ lưu")}{" "}
                  · {translateText(formatNumber(safety?.sampleRetention24h?.storageTempC))}{translateText(" °C · ")}{translateText(formatNumber(safety?.sampleRetention24h?.sampleCount, 0))}{" "}{translateText("mẫu")}</p>
                <div className="kp-table-wrap">
                  <table className="kp-table">
                    <thead>
                      <tr>
                        <th>{translateText("Mẫu")}</th>
                        <th>{translateText("Món")}</th>
                        <th>{translateText("Khối lượng / thể tích")}</th>
                        <th>{translateText("Lưu lúc")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {safety?.sampleRetention24h?.samples?.map((s, i) => (
                        <tr key={i}>
                          <td>{s.sampleCode}</td>
                          <td>{s.dishName}</td>
                          <td>{translateText(s.weightOrVolume)}</td>
                          <td>{translateText(formatDateTime(s.storedAt))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
          {tab === "consumption" && (
            <>
              <section className="kp-panel">
                <h2>{translateText("Mức tiêu thụ toàn trường")}</h2>
                <p>{translateText("Tỷ lệ tiêu thụ bình quân:")}{" "}
                  <b>
                    {translateText(formatNumber(consumption?.schoolAverageConsumptionRate))}%
                  </b>
                </p>
                <div className="kp-table-wrap">
                  <table className="kp-table">
                    <thead>
                      <tr>
                        <th>{translateText("Món")}</th>
                        <th>{translateText("Nhóm")}</th>
                        <th>{translateText("Thức ăn thừa")}</th>
                        <th>{translateText("Ghi nhận")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consumption?.dishWasteIndex?.map((d, i) => (
                        <tr key={i}>
                          <td>{d.dishName}</td>
                          <td>{translateText(d.dishCategory)}</td>
                          <td>{translateText(formatNumber(d.wastePercent))}%</td>
                          <td>{translateText(d.warning || "—")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="kp-panel">
                <h2>{translateText("Phản hồi giáo viên")}</h2>
                <div className="kp-table-wrap">
                  <table className="kp-table">
                    <thead>
                      <tr>
                        <th>{translateText("Lớp")}</th>
                        <th>{translateText("Nhiệt độ")}</th>
                        <th>{translateText("Hương vị")}</th>
                        <th>{translateText("Vệ sinh")}</th>
                        <th>{translateText("Khay nhận")}</th>
                        <th>{translateText("Nhận xét")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consumption?.teacherSensoryFeedback?.map((f, i) => (
                        <tr key={i}>
                          <td>{f.className}</td>
                          <td>{translateText(f.temperature)}</td>
                          <td>{translateText(f.taste)}</td>
                          <td>{translateText(f.cleanliness)}</td>
                          <td>{translateText(formatNumber(f.trayCountReceived, 0))}</td>
                          <td>{translateText(f.comment || "—")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </>
      )}
    </>
  );
}
