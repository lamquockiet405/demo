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

export function KitchenReportsPage() {
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
      ["Kiểm thực", "Kết quả", "Người kiểm", "Thời gian", "Ghi chú"],
    ];
    if (safety)
      for (const [name, step] of [
        ["Bước 1", safety.step1RawCheck],
        ["Bước 2", safety.step2ProcessingCheck],
        ["Bước 3", safety.step3PreServingCheck],
      ] as const)
        rows.push([
          name,
          step?.result,
          step?.inspectorName,
          step?.checkedAt,
          step?.notes,
        ]);
    rows.push(
      [],
      ["Món", "Nhóm", "Tỷ lệ thức ăn thừa (%)", "Cảnh báo"],
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
        title="Báo cáo vận hành bữa ăn"
        description="Đối chiếu suất ăn, kiểm thực và phản hồi sau bữa của ngày được chọn."
      >
        <ReloadButton loading={resource.loading} reload={resource.reload} />
        <button className="kp-button" disabled={!report} onClick={exportRows}>
          <Download size={15} />
          Xuất báo cáo
        </button>
        <button
          className="kp-button"
          disabled={!report}
          onClick={() => window.print()}
        >
          <Printer size={15} />
          In báo cáo
        </button>
      </PageTitle>
      <div className="kp-filters">
        <label>
          Ngày báo cáo
          <input
            type="date"
            aria-label="Ngày báo cáo bếp"
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
              ["Tổng học sinh", reconciliation?.totalEnrolledStudents],
              ["Suất trưa thực tế", reconciliation?.actualLunchCount],
              ["Suất ăn phụ", reconciliation?.actualSnackCount],
              ["Suất chế độ riêng", reconciliation?.specialDietCount],
            ].map(([label, value]) => (
              <div className="kp-stat" key={String(label)}>
                <span>{label}</span>
                <strong>{formatNumber(value, 0)}</strong>
              </div>
            ))}
          </div>
          <div className="kp-tabs" role="tablist" aria-label="Nội dung báo cáo">
            {[
              ["portions", "Cân đối suất ăn"],
              ["safety", "Kiểm thực & lưu mẫu"],
              ["consumption", "Tiêu thụ & phản hồi"],
            ].map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                className={tab === id ? "active" : ""}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "portions" && (
            <div className="kp-table-wrap">
              <table className="kp-table">
                <thead>
                  <tr>
                    <th>Lớp</th>
                    <th>Sĩ số</th>
                    <th>Trưa</th>
                    <th>Ăn phụ</th>
                    <th>Vắng có phép</th>
                    <th>Vắng không phép</th>
                    <th>Ăn riêng</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciliation?.classBreakdown?.map((c) => (
                    <tr key={c.classId}>
                      <td>
                        <strong>{c.className}</strong>
                        <small>{c.ageGroup}</small>
                      </td>
                      {[
                        c.enrolled,
                        c.presentLunch,
                        c.presentSnack,
                        c.excusedAbsence,
                        c.unexcusedAbsence,
                        c.specialDiet,
                      ].map((v, i) => (
                        <td key={i}>{formatNumber(v, 0)}</td>
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
                    ["Bước 1 · Nguyên liệu", safety.step1RawCheck],
                    ["Bước 2 · Chế biến", safety.step2ProcessingCheck],
                    ["Bước 3 · Trước khi ăn", safety.step3PreServingCheck],
                  ].map(([label, step]: [string, any]) => (
                    <section className="kp-panel" key={label}>
                      <h2>{label}</h2>
                      <span className="kp-tag">
                        {step?.result || "Chưa có kết quả"}
                      </span>
                      <p>
                        Người kiểm: {step?.inspectorName || "—"}
                        <br />
                        Thời gian: {formatDateTime(step?.checkedAt)}
                        <br />
                        {step?.notes || "Không có ghi chú thêm."}
                      </p>
                      {step?.supplierName && (
                        <p>Nhà cung cấp: {step.supplierName}</p>
                      )}
                      {step?.equipmentHygiene && (
                        <p>Vệ sinh thiết bị: {step.equipmentHygiene}</p>
                      )}
                      {step?.sensoryColorSmell && (
                        <p>Cảm quan: {step.sensoryColorSmell}</p>
                      )}
                      {(step?.transportTempC != null ||
                        step?.coreBoilingTempC != null) && (
                        <p>
                          Nhiệt độ ghi nhận:{" "}
                          {formatNumber(
                            step.transportTempC ?? step.coreBoilingTempC,
                          )}{" "}
                          °C
                        </p>
                      )}
                    </section>
                  ))}
              </div>
              <section className="kp-panel mt-4">
                <h2>Lưu mẫu 24 giờ</h2>
                <p>
                  {safety?.sampleRetention24h?.fridgeUnit ||
                    "Chưa có dữ liệu tủ lưu"}{" "}
                  · {formatNumber(safety?.sampleRetention24h?.storageTempC)} °C
                  · {formatNumber(safety?.sampleRetention24h?.sampleCount, 0)}{" "}
                  mẫu
                </p>
                <div className="kp-table-wrap">
                  <table className="kp-table">
                    <thead>
                      <tr>
                        <th>Mẫu</th>
                        <th>Món</th>
                        <th>Khối lượng / thể tích</th>
                        <th>Lưu lúc</th>
                      </tr>
                    </thead>
                    <tbody>
                      {safety?.sampleRetention24h?.samples?.map((s, i) => (
                        <tr key={i}>
                          <td>{s.sampleCode}</td>
                          <td>{s.dishName}</td>
                          <td>{s.weightOrVolume}</td>
                          <td>{formatDateTime(s.storedAt)}</td>
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
                <h2>Mức tiêu thụ toàn trường</h2>
                <p>
                  Tỷ lệ tiêu thụ bình quân:{" "}
                  <b>
                    {formatNumber(consumption?.schoolAverageConsumptionRate)}%
                  </b>
                </p>
                <div className="kp-table-wrap">
                  <table className="kp-table">
                    <thead>
                      <tr>
                        <th>Món</th>
                        <th>Nhóm</th>
                        <th>Thức ăn thừa</th>
                        <th>Ghi nhận</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consumption?.dishWasteIndex?.map((d, i) => (
                        <tr key={i}>
                          <td>{d.dishName}</td>
                          <td>{d.dishCategory}</td>
                          <td>{formatNumber(d.wastePercent)}%</td>
                          <td>{d.warning || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="kp-panel">
                <h2>Phản hồi giáo viên</h2>
                <div className="kp-table-wrap">
                  <table className="kp-table">
                    <thead>
                      <tr>
                        <th>Lớp</th>
                        <th>Nhiệt độ</th>
                        <th>Hương vị</th>
                        <th>Vệ sinh</th>
                        <th>Khay nhận</th>
                        <th>Nhận xét</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consumption?.teacherSensoryFeedback?.map((f, i) => (
                        <tr key={i}>
                          <td>{f.className}</td>
                          <td>{f.temperature}</td>
                          <td>{f.taste}</td>
                          <td>{f.cleanliness}</td>
                          <td>{formatNumber(f.trayCountReceived, 0)}</td>
                          <td>{f.comment || "—"}</td>
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
