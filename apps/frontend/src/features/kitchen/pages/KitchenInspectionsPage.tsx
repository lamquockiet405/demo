import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { CreateKitchenInspectionModal } from "../components/CreateKitchenInspectionModal";
import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Download, Eye, FileText, Plus, Upload } from "lucide-react";
import { apiClient } from "../../../core/api/axios";
import { getSchoolDate, normalizeSearch } from "../utils/kds-data";
import { sanitizeInspectionNote } from "../utils/inspection-note";
import {
  downloadExcel,
  formatDateTime,
  newestFirst,
  prepareProofImage,
  rowsOf,
} from "../utils/kitchen-operations";
import {
  errorText,
  Modal,
  Notice,
  PageTitle,
  ReloadButton,
  ResourceState,
  useKitchenAction,
  useKitchenResource,
} from "../components/KitchenUI";

export const stepTitles = ["Trước chế biến", "Trong chế biến", "Trước khi ăn"];

export function InspectionDetail({
  id,
  onClose,
  onSaved,
  mode = "kitchen",
}: {
  id: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
  mode?: "kitchen" | "review";
}) {
  useLanguage();
  const resource = useKitchenResource(
    async () =>
      (await apiClient.get(`/inspections/${encodeURIComponent(id)}`)).data,
    [id],
  );
  const action = useKitchenAction();
  const [photos, setPhotos] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState("");
  const [reason, setReason] = useState("");
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const record = resource.data;
  const approved = record?.approvalStatus === "DA_DUYET";
  const pending = record?.approvalStatus === "CHO_DUYET";
  const submissionLocked = approved || pending;
  const complete =
    record &&
    [1, 2, 3].every(
      (step) =>
        record[`step${step}Status`] === "Đạt chuẩn" &&
        (record[`step${step}Photos`]?.length || record[`step${step}PhotoUrl`]),
    );
  const review = async (decision: "approve" | "reject") => {
    await action.run(
      async () => {
        if (!pending)
          throw new Error(
            "Biên bản hiện không ở trạng thái chờ duyệt. Hãy làm mới danh sách.",
          );
        if (decision === "approve" && (!complete || !reviewConfirmed))
          throw new Error(
            "Kiểm tra đủ kết quả và ảnh của 3 bước, sau đó xác nhận trước khi phê duyệt.",
          );
        if (decision === "reject" && reason.trim().length < 5)
          throw new Error("Nhập lý do yêu cầu bổ sung ít nhất 5 ký tự.");
        const response = await apiClient.post(
          `/inspections/${encodeURIComponent(id)}/${decision}`,
          decision === "reject" ? { reason: reason.trim() } : {},
        );
        if (response.data?.success === false)
          throw new Error(
            response.data.message || "Không lưu được kết quả duyệt.",
          );
        await resource.reload();
        await onSaved();
        setReviewConfirmed(false);
        setReason("");
      },
      decision === "approve"
        ? "Đã phê duyệt biên bản kiểm thực."
        : "Đã gửi yêu cầu bổ sung minh chứng cho bếp.",
    );
  };
  const upload = async (step: number, file?: File) => {
    if (!file) return;
    setImageBusy(true);
    setImageError("");
    try {
      const result = await prepareProofImage(file);
      setPhotos((previous) => ({ ...previous, [step]: result }));
    } catch (error) {
      setImageError(errorText(error));
    } finally {
      setImageBusy(false);
    }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok = await action.run(async () => {
      if (submissionLocked)
        throw new Error("Biên bản đã được gửi duyệt, không thể gửi lại lần nữa.");
      const payload: Record<string, unknown> = {};
      for (const step of [1, 2, 3]) {
        if (!checked[step])
          throw new Error(
            "Xác nhận đã kiểm tra đạt ở đủ 3 bước trước khi gửi.",
          );
        if (
          !photos[step] &&
          !record[`step${step}PhotoUrl`] &&
          !record[`step${step}Photos`]?.length
        )
          throw new Error(`Bổ sung ảnh minh chứng bước ${step}.`);
        payload[`step${step}Note`] =
          notes[step] ?? record[`step${step}Note`] ?? "";
        if (photos[step]) payload[`step${step}Photos`] = [photos[step]];
      }
      await apiClient.post(
        `/inspections/${encodeURIComponent(id)}/kitchen-save`,
        payload,
      );
      setPhotos({});
      await resource.reload();
      await onSaved();
    }, "Đã lưu minh chứng. Bấm Gửi hiệu trưởng duyệt khi đã kiểm tra xong.");
    if (ok) setChecked({});
  };
  return (
    <Modal
      title={translateText("Chi tiết biên bản kiểm thực")}
      busy={action.busy || imageBusy}
      onClose={onClose}
    >
      <ResourceState resource={resource} />
      <Notice error={action.error || imageError} message={action.message} />
      {record && (
        <>
          <dl className="kp-detail-list">
            <div>
              <dt>{translateText("Mã biên bản")}</dt>
              <dd>{translateText(record.code)}</dd>
            </div>
            <div>
              <dt>{translateText("Ngày / bữa")}</dt>
              <dd>
                {translateText(record.mealDate || record.date)} · {translateText(record.mealTime)}
              </dd>
            </div>
            <div>
              <dt>{translateText("Người kiểm tra")}</dt>
              <dd>{record.performerName}</dd>
            </div>
            <div>
              <dt>{translateText("Trạng thái")}</dt>
              <dd>{translateText(record.approvalStatusLabel || record.status)}</dd>
            </div>
            {record.approvedBy && (
              <div>
                <dt>{translateText("Người duyệt")}</dt>
                <dd>{translateText(record.approvedBy)}</dd>
              </div>
            )}
            {record.approvedAt && (
              <div>
                <dt>{translateText("Thời điểm duyệt")}</dt>
                <dd>{translateText(formatDateTime(record.approvedAt))}</dd>
              </div>
            )}
            {record.kitchenSubmittedAt && (
              <div>
                <dt>{translateText("Bếp gửi duyệt lúc")}</dt>
                <dd>{translateText(formatDateTime(record.kitchenSubmittedAt))}</dd>
              </div>
            )}
          </dl>
          {record.rejectionReason && (
            <Notice error={`Yêu cầu bổ sung: ${record.rejectionReason}`} />
          )}
          {record.dishes?.length > 0 && (
            <p className="mb-4 text-xs text-slate-600">{translateText("Món kiểm thực: ")}{translateText(record.dishes.join(", "))}
            </p>
          )}
          <form onSubmit={submit}>
            <div className="kp-step-grid">
              {[1, 2, 3].map((step) => {
                const storedPhotos: string[] = record[`step${step}Photos`]
                  ?.length
                  ? record[`step${step}Photos`]
                  : record[`step${step}PhotoUrl`]
                    ? [record[`step${step}PhotoUrl`]]
                    : [];
                return (
                  <section className="kp-step-card" key={step}>
                    <h3>{translateText("Bước ")}{step} · {translateText(stepTitles[step - 1])}
                    </h3>
                    {step === 3 && (
                      <p className="mt-1 text-[11px] font-semibold text-blue-700">
                        {translateText("Hoàn tất bước này sẽ tự động tạo mẫu lưu 24 giờ.")}
                      </p>
                    )}
                    <span
                      className={`kp-tag ${record[`step${step}Status`] === "Không đạt" ? "red" : ""}`}
                    >
                      {translateText(record[`step${step}Status`] || "Chưa thực hiện")}
                    </span>
                    <p className="text-[10px] text-slate-500 mt-2">
                      {translateText(formatDateTime(record[`step${step}Time`]))}
                    </p>
                    {storedPhotos.map((photo, index) => (
                      <a
                        key={index}
                        href={photo}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          src={photo}
                          alt={translateText(`Minh chứng bước ${step}, ảnh ${index + 1}`)}
                        />
                      </a>
                    ))}
                    {photos[step] && (
                      <img src={photos[step]} alt={translateText(`Ảnh mới bước ${step}`)} />
                    )}
                    {!submissionLocked && mode === "kitchen" && (
                      <>
                        <label className="kp-field">{translateText("Ghi nhận bước ")}{step}
                          <textarea
                            className="kp-input"
                            maxLength={2000}
                            readOnly={
                              step > 1 &&
                              record[`step${step}Status`] !== "Chưa thực hiện"
                            }
                            value={
                              notes[step] ?? record[`step${step}Note`] ?? ""
                            }
                            onChange={(e) =>
                              setNotes({ ...notes, [step]: e.target.value })
                            }
                          />
                        </label>
                        <label className="kp-field">
                          <span>
                            <Upload size={13} className="inline mr-1" />{translateText("Ảnh minh chứng bước ")}{step}
                          </span>
                          <input
                            aria-label={translateText(`Ảnh minh chứng bước ${step}`)}
                            disabled={imageBusy || action.busy}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              e.target.value = "";
                              void upload(step, file);
                            }}
                          />
                        </label>
                        <label className="flex items-start gap-2 mt-4 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            required
                            checked={!!checked[step]}
                            onChange={(e) =>
                              setChecked({
                                ...checked,
                                [step]: e.target.checked,
                              })
                            }
                          />{translateText("Đã kiểm tra và đạt ở bước ")}{step}
                        </label>
                      </>
                    )}
                    {(approved || mode === "review") && (
                      <p className="kp-note-text">
                        {translateText(sanitizeInspectionNote(record[`step${step}Note`]) || "Không có ghi chú thêm.")}
                      </p>
                    )}
                  </section>
                );
              })}
            </div>
            {submissionLocked && mode === "kitchen" && (
              <Notice message="Biên bản đã gửi duyệt. Không thể gửi lại; chỉ được thao tác sau khi có yêu cầu bổ sung." />
            )}
            {!submissionLocked && mode === "kitchen" && (
              <div className="kp-form-actions">
                <button
                  className="kp-button primary"
                  disabled={action.busy || imageBusy}
                >
                  {translateText(imageBusy
                    ? "Đang xử lý ảnh…"
                    : action.busy
                      ? "Đang gửi…"
                      : "Lưu minh chứng")}
                </button>
                {record.approvalStatus === "DA_LUU" && (
                  <button type="button" className="kp-button primary" disabled={action.busy || imageBusy || Object.keys(photos).length > 0}
                    onClick={() => void action.run(async () => {
                      await apiClient.post(`/inspections/${encodeURIComponent(id)}/kitchen-submit`, {});
                      await resource.reload();
                      await onSaved();
                    }, "Đã gửi hiệu trưởng duyệt.")}
                  >{translateText("Gửi hiệu trưởng duyệt")}</button>
                )}
              </div>
            )}
          </form>
          {mode === "review" && pending && (
            <section
              className="mt-5 border-t pt-5 space-y-4"
              aria-label={translateText("Thao tác phê duyệt kiểm thực")}
            >
              {!complete && (
                <Notice error="Biên bản chưa có đủ kết quả đạt và ảnh minh chứng cho 3 bước. Có thể yêu cầu bếp bổ sung." />
              )}
              <label className="flex gap-2 text-sm items-start">
                <input
                  type="checkbox"
                  checked={reviewConfirmed}
                  disabled={!complete || action.busy}
                  onChange={(e) => setReviewConfirmed(e.target.checked)}
                />{translateText("Tôi đã kiểm tra kết quả và ảnh minh chứng của cả 3 bước.")}</label>
              <label className="kp-field">{translateText("Lý do yêu cầu bổ sung")}<textarea
                  className="kp-input"
                  aria-label={translateText("Lý do yêu cầu bổ sung")}
                  maxLength={2000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={translateText("Ghi rõ bước cần bổ sung và nội dung cần điều chỉnh…")}
                />
              </label>
              <div className="kp-form-actions">
                <button
                  type="button"
                  className="kp-button danger"
                  disabled={action.busy || reason.trim().length < 5}
                  onClick={() => void review("reject")}
                >{translateText("Yêu cầu bổ sung")}</button>
                <button
                  type="button"
                  className="kp-button primary"
                  disabled={action.busy || !complete || !reviewConfirmed}
                  onClick={() => void review("approve")}
                >
                  {translateText(action.busy ? "Đang lưu…" : "Phê duyệt biên bản")}
                </button>
              </div>
            </section>
          )}
          {mode === "review" &&
            record.approvalStatus === "YEU_CAU_CHUP_LAI" && (
              <p className="mt-4 text-sm text-amber-800">{translateText("Đang chờ bếp bổ sung minh chứng và gửi duyệt lại.")}</p>
            )}
        </>
      )}
    </Modal>
  );
}

export function KitchenInspectionsPage({
  audience = "kitchen",
}: {
  audience?: "kitchen" | "principal" | "nutritionist";
}) {
  useLanguage();
  const [reviewMode, setReviewMode] = useState(audience !== "kitchen");
  const reviewer = audience !== "kitchen" && reviewMode;
  const resource = useKitchenResource(
    async () => newestFirst(rowsOf((await apiClient.get("/inspections")).data)),
    [],
  );
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState(reviewer ? "CHO_DUYET" : "");
  const [detail, setDetail] = useState<string | null>(null);
  const [create, setCreate] = useState(false);
  const sendAction = useKitchenAction();

  const rows = newestFirst((resource.data || []).filter(
    (r) =>
      (!date || (r.mealDate || r.date) === date) &&
      (!status || r.approvalStatus === status) &&
      normalizeSearch(
        `${r.code} ${r.performerName} ${(r.dishes || []).join(" ")}`,
      ).includes(normalizeSearch(search)),
  ));
  const totalRecords = resource.data?.length || 0;
  const approvedRecords = (resource.data || []).filter((r) => r.approvalStatus === "DA_DUYET").length;
  const pendingRecords = (resource.data || []).filter((r) =>
    ["CHO_BEP_TAI_ANH", "DA_LUU", "CHO_DUYET"].includes(r.approvalStatus),
  ).length;
  const needsUpdateRecords = (resource.data || []).filter((r) => r.approvalStatus === "YEU_CAU_CHUP_LAI").length;

  return (
    <>
      <Notice error={sendAction.error} message={sendAction.message} />
      <PageTitle
        eyebrow={
          translateText(reviewer
            ? audience === "principal"
              ? "BAN GIÁM HIỆU"
              : "CHUYÊN GIA DINH DƯỠNG"
            : undefined)
        }
        title={translateText(reviewer ? "Phê duyệt kiểm thực 3 bước" : "Kiểm thực 3 bước")}
        description={
          translateText(reviewer
            ? "Kiểm tra minh chứng bếp gửi, phê duyệt hoặc yêu cầu bổ sung; tra cứu người duyệt và thời điểm duyệt."
            : "Tạo biên bản, xem kết quả kiểm tra và gửi ảnh minh chứng trước chế biến, trong chế biến, trước khi ăn.")
        }
      >
        <ReloadButton loading={resource.loading} reload={resource.reload} />
        <button
          className="kp-button"
          disabled={!rows.length}
          onClick={() =>
            downloadExcel("nhat-ky-kiem-thuc.xlsx", [
              [
                "Mã",
                "Ngày",
                "Bữa",
                "Người kiểm",
                "Bước 1",
                "Bước 2",
                "Bước 3",
                "Duyệt",
              ],
              ...rows.map((r) => [
                r.code,
                r.mealDate || r.date,
                r.mealTime,
                r.performerName,
                r.step1Status,
                r.step2Status,
                r.step3Status,
                r.approvalStatusLabel || r.status,
              ]),
            ])
          }
        >
          <Download size={15} />{translateText("Xuất nhật ký")}</button>
        {audience === "kitchen" && (
          <button className="kp-button primary" onClick={() => setCreate(true)}>
            <Plus size={16} />{translateText("Tạo biên bản")}</button>
        )}
      </PageTitle>

      <div className="grid grid-cols-1 gap-4 mb-5 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Tổng biên bản", value: totalRecords, icon: FileText, tone: "text-slate-700 bg-slate-100" },
          { label: "Đã duyệt", value: approvedRecords, icon: CheckCircle2, tone: "text-emerald-700 bg-emerald-100" },
          { label: "Chờ xử lý", value: pendingRecords, icon: Clock, tone: "text-amber-700 bg-amber-100" },
          { label: "Cần bổ sung", value: needsUpdateRecords, icon: AlertTriangle, tone: "text-rose-700 bg-rose-100" },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <div className={`p-3 rounded-xl ${tone}`}><Icon className="w-5 h-5" /></div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{translateText(label)}</p>
              <p className="mt-0.5 text-2xl font-black text-slate-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {audience === "nutritionist" && (
        <div
          className="flex gap-2 mb-4"
          role="group"
          aria-label={translateText("Chế độ kiểm thực")}
        >
          <button
            className={`kp-button ${reviewMode ? "primary" : ""}`}
            onClick={() => {
              setReviewMode(true);
              setDetail(null);
              setStatus("CHO_DUYET");
            }}
          >{translateText("Phê duyệt biên bản")}</button>
          <button
            className={`kp-button ${!reviewMode ? "primary" : ""}`}
            onClick={() => {
              setReviewMode(false);
              setDetail(null);
              setStatus("");
            }}
          >{translateText("Xem / bổ sung minh chứng")}</button>
        </div>
      )}

      <div className="kp-filters">
        <input
          type="search"
          aria-label={translateText("Tìm biên bản kiểm thực")}
          placeholder={translateText("Tìm mã biên bản, món, người kiểm…")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label>{translateText("Ngày")}<input
            type="date"
            aria-label={translateText("Lọc ngày kiểm thực")}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <select
          aria-label={translateText("Trạng thái kiểm thực")}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">{translateText("Tất cả trạng thái")}</option>
          <option value="CHO_BEP_TAI_ANH">{translateText("Chờ bếp tải ảnh")}</option>
          <option value="DA_LUU">{translateText("Đã lưu, chưa gửi duyệt")}</option>
          <option value="CHO_DUYET">{translateText("Chờ duyệt")}</option>
          <option value="DA_DUYET">{translateText("Đã duyệt")}</option>
          <option value="YEU_CAU_CHUP_LAI">{translateText("Yêu cầu bổ sung")}</option>
        </select>
        <button
          className="kp-button"
          onClick={() => {
            setDate("");
            setSearch("");
            setStatus("");
          }}
        >{translateText("Xóa bộ lọc")}</button>
      </div>
      <ResourceState resource={resource} empty={!rows.length} />
      <div className="kp-table-wrap">
        <table className="kp-table">
          <thead>
            <tr>
              <th>{translateText("Biên bản")}</th>
              <th>{translateText("Bữa / ngày")}</th>
              <th>{translateText("Bước 1")}</th>
              <th>{translateText("Bước 2")}</th>
              <th>{translateText("Bước 3 · Lưu mẫu 24h")}</th>
              <th>{translateText("Duyệt")}</th>
              <th>{translateText("Chi tiết")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{translateText(r.code)}</strong>
                  <small>{r.performerName}</small>
                </td>
                <td>
                  {translateText(r.mealDate || r.date)}
                  <small>{translateText(r.mealTime)}</small>
                </td>
                {[1, 2, 3].map((step) => (
                  <td key={step}>
                    <span
                      className={`kp-tag ${r[`step${step}Status`] === "Không đạt" ? "red" : r[`step${step}Status`] === "Chưa thực hiện" ? "gray" : ""}`}
                    >
                      {translateText(r[`step${step}Status`])}
                    </span>
                    <small>
                      {translateText(r[`step${step}Photos`]?.length ||
                        (r[`step${step}PhotoUrl`] ? 1 : 0))}{" "}{translateText("ảnh")}</small>
                  </td>
                ))}
                <td>
                  <span
                    className={`kp-tag ${r.approvalStatus === "DA_DUYET" ? "" : "amber"}`}
                  >
                    {translateText(r.approvalStatusLabel || r.status)}
                  </span>
                </td>
                <td>
                  <button
                    className="kp-button"
                    aria-label={translateText(`Xem biên bản ${r.code}`)}
                    onClick={() => setDetail(String(r.id))}
                  >
                    <Eye size={14} />
                    {translateText(reviewer ? "Xem / duyệt" : "Xem / bổ sung ảnh")}
                  </button>
                  {!reviewer && r.approvalStatus === "DA_LUU" && (
                    <button className="kp-button primary" disabled={sendAction.busy}
                      onClick={() => void sendAction.run(async () => {
                        await apiClient.post(`/inspections/${encodeURIComponent(String(r.id))}/kitchen-submit`, {});
                        await resource.reload();
                      }, "Đã gửi hiệu trưởng duyệt.")}
                    >{translateText("Gửi hiệu trưởng duyệt")}</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {create && (
        <CreateKitchenInspectionModal
          initialDate={date || getSchoolDate()}
          onClose={() => { setCreate(false); void resource.reload(); }}
          onCreated={async (id) => {
            setCreate(false);
            setSearch("");
            setDate("");
            setStatus("");
            await resource.reload();
            if (id) setDetail(id);
          }}
        />
      )}
      {detail && (
        <InspectionDetail
          key={detail}
          id={detail}
          onClose={() => setDetail(null)}
          onSaved={resource.reload}
          mode={reviewer ? "review" : "kitchen"}
        />
      )}
    </>
  );
}
