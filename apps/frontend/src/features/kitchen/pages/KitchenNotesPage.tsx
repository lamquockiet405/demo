import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState } from "react";
import { Plus } from "lucide-react";
import { coordinationApi } from "../../attendance/api/coordinationApi";
import { useAuthStore } from "../../../core/stores/auth.store";
import { CoordinationNoteItem } from "../../attendance/types";
import { getSchoolDate, normalizeSearch } from "../utils/kds-data";
import { formatDateTime } from "../utils/kitchen-operations";
import {
  Modal,
  Notice,
  PageTitle,
  ReloadButton,
  ResourceState,
  useKitchenAction,
  useKitchenResource,
} from "../components/KitchenUI";

const blank = () => ({
  classId: "",
  mealDate: getSchoolDate(),
  mealSession: "LUNCH",
  noteType: "OTHER",
  priority: "NORMAL",
  title: "",
  content: "",
  kitchenResponse: "",
});
export function KitchenNotesPage() {
  useLanguage();
  const { user } = useAuthStore();
  const [date, setDate] = useState(getSchoolDate);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const resource = useKitchenResource(
    () =>
      coordinationApi.getCoordinationNotes({
        date,
        status: status || undefined,
      }),
    [date, status],
  );
  const action = useKitchenAction();
  const [editing, setEditing] = useState<CoordinationNoteItem | "new" | null>(
    null,
  );
  const [form, setForm] = useState(blank);
  const notes = (resource.data?.notes || []).filter(
    (n) =>
      n.mealDate === date &&
      normalizeSearch(`${n.title} ${n.content} ${n.className}`).includes(
        normalizeSearch(search),
      ),
  );
  const open = (note: CoordinationNoteItem | "new") => {
    setEditing(note);
    setForm(
      note === "new"
        ? { ...blank(), mealDate: date }
        : {
            classId: note.classId,
            mealDate: note.mealDate,
            mealSession: note.mealSession,
            noteType: note.noteType,
            priority: note.priority,
            title: note.title,
            content: note.content,
            kitchenResponse: note.kitchenResponse || "",
          },
    );
  };
  const work = async (task: () => Promise<unknown>, message: string) =>
    action.run(async () => {
      await task();
      await resource.reload();
    }, message);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.content.trim() || !form.classId) return;
    const ok = await work(
      () =>
        editing === "new"
          ? coordinationApi.createCoordinationNote({
              ...form,
              teacherName: user?.fullName || "Nhân viên bếp",
              targetRole: "NUTRITIONIST",
            })
          : coordinationApi.updateCoordinationNote(editing!.id, {
              title: form.title.trim(),
              content: form.content.trim(),
              mealSession: form.mealSession,
              noteType: form.noteType,
              priority: form.priority,
              kitchenResponse: form.kitchenResponse,
            }),
      "Đã lưu ghi chú phối hợp.",
    );
    if (ok) setEditing(null);
  };
  return (
    <>
      <PageTitle
        title={translateText("Ghi chú phối hợp bữa ăn")}
        description={translateText("Tiếp nhận yêu cầu từ giáo viên, phản hồi và theo dõi quá trình xử lý của bếp.")}
      >
        <ReloadButton loading={resource.loading} reload={resource.reload} />
        <button className="kp-button primary" onClick={() => open("new")}>
          <Plus size={16} />{translateText("Tạo ghi chú")}</button>
      </PageTitle>
      <Notice error={action.error} message={action.message} />
      <div className="kp-filters">
        <label>{translateText("Ngày bữa ăn")}<input
            type="date"
            aria-label={translateText("Ngày ghi chú")}
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
          />
        </label>
        <input
          type="search"
          aria-label={translateText("Tìm ghi chú")}
          placeholder={translateText("Tìm tiêu đề, nội dung, lớp…")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label={translateText("Trạng thái ghi chú")}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">{translateText("Tất cả trạng thái")}</option>
          <option value="PENDING">{translateText("Chờ xử lý")}</option>
          <option value="ACKNOWLEDGED">{translateText("Đã tiếp nhận")}</option>
          <option value="PROCESSING">{translateText("Đang xử lý")}</option>
          <option value="RESOLVED">{translateText("Đã xử lý")}</option>
        </select>
      </div>
      <ResourceState resource={resource} empty={!notes.length} />
      <div className="kp-card-grid">
        {notes.map((note) => (
          <article className="kp-panel" key={note.id}>
            <div className="kp-note-header">
              <h2>{note.title}</h2>
              <span
                className={`kp-tag ${note.priority === "URGENT" ? "red" : "amber"}`}
              >
                {translateText(note.priorityLabel)}
              </span>
            </div>
            <span className="kp-tag">{note.className}</span>
            <span className="kp-tag gray">{translateText(note.mealSessionLabel)}</span>
            <span className="kp-tag">{translateText(note.statusLabel)}</span>
            <p className="kp-note-text">{note.content}</p>
            {note.child && <p>{translateText("Học sinh: ")}{note.child.fullName}</p>}
            {note.kitchenResponse && (
              <p className="kp-note-text">
                <b>{translateText("Phản hồi bếp:")}</b> {note.kitchenResponse}
              </p>
            )}
            <p>
              {note.teacherName} · {translateText(formatDateTime(note.createdAt))}
            </p>
            <div className="kp-actions">
              <button
                className="kp-button"
                disabled={action.busy}
                onClick={() => open(note)}
              >{translateText("Sửa / phản hồi")}</button>
              {note.status === "PENDING" && (
                <button
                  className="kp-button"
                  disabled={action.busy}
                  onClick={() =>
                    void work(
                      () =>
                        coordinationApi.acknowledgeCoordinationNote(note.id, {
                          acknowledgedBy: user?.fullName,
                        }),
                      "Đã tiếp nhận ghi chú.",
                    )
                  }
                >{translateText("Tiếp nhận")}</button>
              )}
              {!["RESOLVED", "CANCELLED"].includes(note.status) && (
                <button
                  className="kp-button primary"
                  disabled={action.busy}
                  onClick={() =>
                    void work(
                      () =>
                        coordinationApi.resolveCoordinationNote(note.id, {
                          resolutionNote:
                            note.kitchenResponse || "Bếp đã xử lý yêu cầu.",
                        }),
                      "Đã hoàn tất xử lý.",
                    )
                  }
                >{translateText("Hoàn tất")}</button>
              )}
              <button
                className="kp-button danger"
                disabled={action.busy}
                onClick={() => {
                  if (window.confirm(translateText(`Xóa ghi chú “${note.title}”?`)))
                    void work(
                      () => coordinationApi.deleteCoordinationNote(note.id),
                      "Đã xóa ghi chú.",
                    );
                }}
              >{translateText("Xóa")}</button>
            </div>
          </article>
        ))}
      </div>
      {editing && (
        <Modal
          title={
            translateText(editing === "new"
              ? "Tạo ghi chú phối hợp"
              : "Chỉnh sửa / phản hồi ghi chú")
          }
          onClose={() => setEditing(null)}
          busy={action.busy}
        >
          <Notice error={action.error} />
          <form onSubmit={save}>
            <div className="kp-form-grid">
              <label className="kp-field">{translateText("Lớp")}<select
                  className="kp-input"
                  required
                  disabled={editing !== "new"}
                  aria-label={translateText("Lớp")}
                  value={form.classId}
                  onChange={(e) =>
                    setForm({ ...form, classId: e.target.value })
                  }
                >
                  <option value="">{translateText("Chọn lớp")}</option>
                  {resource.data?.availableClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="kp-field">{translateText("Bữa ăn")}<select
                  className="kp-input"
                  value={form.mealSession}
                  onChange={(e) =>
                    setForm({ ...form, mealSession: e.target.value })
                  }
                >
                  <option value="LUNCH">{translateText("Trưa chính")}</option>
                  <option value="AFTERNOON_SNACK">{translateText("Ăn phụ")}</option>
                </select>
              </label>
              <label className="kp-field">{translateText("Mức ưu tiên")}<select
                  className="kp-input"
                  value={form.priority}
                  onChange={(e) =>
                    setForm({ ...form, priority: e.target.value })
                  }
                >
                  <option value="NORMAL">{translateText("Bình thường")}</option>
                  <option value="HIGH">{translateText("Cao")}</option>
                  <option value="URGENT">{translateText("Khẩn cấp")}</option>
                </select>
              </label>
              <label className="kp-field">{translateText("Loại ghi chú")}<select
                  className="kp-input"
                  value={form.noteType}
                  onChange={(e) =>
                    setForm({ ...form, noteType: e.target.value })
                  }
                >
                  <option value="OTHER">{translateText("Điều phối chung")}</option>
                  <option value="ALLERGY_WARNING">{translateText("Cảnh báo dị ứng")}</option>
                  <option value="SPECIAL_DIET">{translateText("Chế độ ăn riêng")}</option>
                  <option value="PORTION_ADJUSTMENT">{translateText("Điều chỉnh suất")}</option>
                </select>
              </label>
              <label className="kp-field full">{translateText("Tiêu đề")}<input
                  className="kp-input"
                  required
                  maxLength={200}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>
              <label className="kp-field full">{translateText("Nội dung")}<textarea
                  className="kp-input"
                  required
                  maxLength={4000}
                  value={form.content}
                  onChange={(e) =>
                    setForm({ ...form, content: e.target.value })
                  }
                />
              </label>
              {editing !== "new" && (
                <label className="kp-field full">{translateText("Phản hồi của bếp")}<textarea
                    className="kp-input"
                    maxLength={2000}
                    value={form.kitchenResponse}
                    onChange={(e) =>
                      setForm({ ...form, kitchenResponse: e.target.value })
                    }
                  />
                </label>
              )}
            </div>
            <div className="kp-form-actions">
              <button
                type="button"
                className="kp-button"
                disabled={action.busy}
                onClick={() => setEditing(null)}
              >{translateText("Hủy")}</button>
              <button className="kp-button primary" disabled={action.busy}>
                {translateText(action.busy ? "Đang lưu…" : "Lưu ghi chú")}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
