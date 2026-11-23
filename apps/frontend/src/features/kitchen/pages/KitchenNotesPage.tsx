import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState } from 'react';
import { Plus, MessageSquare, CheckCircle, Clock, Trash2, Edit, ClipboardList } from 'lucide-react';
import { apiClient } from '../../../core/api/axios';
import { useAuthStore } from '../../../core/stores/auth.store';
import {
  PageTitle,
  ReloadButton,
  ResourceState,
  Modal,
  Notice,
  useKitchenResource,
  useKitchenAction,
} from '../components/KitchenUI';
import { getSchoolDate } from '../utils/kds-data';
import { formatDateTime } from '../utils/kitchen-operations';
import { KitchenSummaryCards } from '../components/KitchenSummaryCards';
import { normalizeSearch } from '../../../core/utils/search';

const coordinationApi = {
  getCoordinationNotes: async (params?: any) => {
    return (await apiClient.get('/attendance/coordination-notes', { params })).data;
  },
  createCoordinationNote: async (data: any) => {
    return (await apiClient.post('/attendance/coordination-notes', data)).data;
  },
  updateCoordinationNote: async (id: string, data: any) => {
    return (await apiClient.put(`/attendance/coordination-notes/${id}`, data)).data;
  },
  acknowledgeCoordinationNote: async (id: string, data: any) => {
    return (await apiClient.post(`/attendance/coordination-notes/${id}/acknowledge`, data)).data;
  },
  resolveCoordinationNote: async (id: string, data: any) => {
    return (await apiClient.post(`/attendance/coordination-notes/${id}/resolve`, data)).data;
  },
  deleteCoordinationNote: async (id: string) => {
    return (await apiClient.delete(`/attendance/coordination-notes/${id}`)).data;
  },
};

const defaultForm = () => ({
  classId: '',
  mealDate: getSchoolDate(),
  mealSession: 'LUNCH',
  noteType: 'OTHER',
  priority: 'NORMAL',
  title: '',
  content: '',
  kitchenResponse: '',
});

export function KitchenNotesPage() {
  useLanguage();
  const { user } = useAuthStore();
  const [date, setDate] = useState(getSchoolDate);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const resource = useKitchenResource(
    () => coordinationApi.getCoordinationNotes({ date, status: status || undefined }),
    [date, status],
  );

  const action = useKitchenAction();
  const [editingNote, setEditingNote] = useState<any | 'new' | null>(null);
  const [form, setForm] = useState(defaultForm);

  const notesList = (resource.data?.notes || []).filter((n: any) => {
    const matchDate = !date || n.mealDate === date;
    const normSearch = normalizeSearch(search);
    const matchSearch =
      !search ||
      normalizeSearch(`${n.title} ${n.content} ${n.className || ''}`).includes(normSearch);
    return matchDate && matchSearch;
  });

  const openForm = (note: any | 'new') => {
    setEditingNote(note);
    if (note === 'new') {
      setForm({ ...defaultForm(), mealDate: date });
    } else {
      setForm({
        classId: note.classId || '',
        mealDate: note.mealDate || date,
        mealSession: note.mealSession || 'LUNCH',
        noteType: note.noteType || 'OTHER',
        priority: note.priority || 'NORMAL',
        title: note.title || '',
        content: note.content || '',
        kitchenResponse: note.kitchenResponse || '',
      });
    }
  };

  const handleAction = async (work: () => Promise<any>, successMsg: string) => {
    return action.run(async () => {
      await work();
      await resource.reload();
    }, successMsg);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim() || !form.classId) return;

    const ok = await handleAction(
      () =>
        editingNote === 'new'
          ? coordinationApi.createCoordinationNote({
              ...form,
              teacherName: user?.fullName || 'Nhân viên bếp',
              targetRole: 'NUTRITIONIST',
            })
          : coordinationApi.updateCoordinationNote(editingNote.id, {
              title: form.title.trim(),
              content: form.content.trim(),
              mealSession: form.mealSession,
              noteType: form.noteType,
              priority: form.priority,
              kitchenResponse: form.kitchenResponse,
            }),
      'Đã lưu ghi chú phối hợp.',
    );
    if (ok) setEditingNote(null);
  };

  return (
    <>
      <Notice error={action.error} message={action.message} />
      {resource.data && !resource.error && (
        <KitchenSummaryCards metrics={[
          { label: 'Tổng ghi chú', value: notesList.length, icon: ClipboardList },
          { label: 'Chờ xử lý', value: notesList.filter((note: any) => note.status === 'PENDING').length, icon: Clock, tone: 'warning' },
          { label: 'Đang tiếp nhận', value: notesList.filter((note: any) => ['ACKNOWLEDGED', 'PROCESSING'].includes(note.status)).length, icon: MessageSquare },
          { label: 'Đã xử lý', value: notesList.filter((note: any) => note.status === 'RESOLVED').length, icon: CheckCircle, tone: 'success' },
        ]} />
      )}

      <div className="kp-filters">
        <label>
          {translateText('Ngày bữa ăn')}
          <input
            type="date"
            aria-label={translateText('Ngày ghi chú')}
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </label>
        <input
          type="search"
          aria-label={translateText('Tìm ghi chú')}
          placeholder={translateText('Tìm tiêu đề, nội dung, lớp…')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label={translateText('Trạng thái ghi chú')}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">{translateText('Tất cả trạng thái')}</option>
          <option value="PENDING">{translateText('Chờ xử lý')}</option>
          <option value="ACKNOWLEDGED">{translateText('Đã tiếp nhận')}</option>
          <option value="PROCESSING">{translateText('Đang xử lý')}</option>
          <option value="RESOLVED">{translateText('Đã xử lý')}</option>
        </select>
        <ReloadButton loading={resource.loading} reload={resource.reload} />
        <button className="kp-button primary" onClick={() => openForm('new')}>
          <Plus size={16} />
          {translateText('Tạo ghi chú')}
        </button>
      </div>

      <ResourceState resource={resource} empty={!notesList.length} />

      <div className="kp-card-grid">
        {notesList.map((note: any) => (
          <article className="kp-panel" key={note.id}>
            <div className="kp-note-header">
              <h2 className="font-bold text-base text-slate-800">{note.title}</h2>
              <span
                className={`kp-tag ${
                  note.priority === 'URGENT' ? 'red' : note.priority === 'HIGH' ? 'amber' : ''
                }`}
              >
                {note.priorityLabel || note.priority}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 my-2">
              <span className="kp-tag">{note.className}</span>
              <span className="kp-tag gray">{note.mealSessionLabel || note.mealSession}</span>
              <span className="kp-tag">{note.statusLabel || note.status}</span>
            </div>
            <p className="kp-note-text text-sm text-slate-600 mb-2">{note.content}</p>
            {note.child && (
              <p className="text-xs text-slate-500 mb-1">
                <strong>{translateText('Học sinh')}:</strong> {note.child.fullName}
              </p>
            )}
            {note.kitchenResponse && (
              <p className="kp-note-text text-sm bg-emerald-50 text-emerald-800 p-2 rounded-lg my-2">
                <b>{translateText('Phản hồi bếp')}:</b> {note.kitchenResponse}
              </p>
            )}
            <p className="text-xs text-slate-400 mt-2">
              {note.teacherName} · {formatDateTime(note.createdAt)}
            </p>
            <div className="kp-actions mt-3 flex flex-wrap gap-2">
              <button
                className="kp-button"
                disabled={action.busy}
                onClick={() => openForm(note)}
              >
                <Edit size={14} className="inline mr-1" />
                {translateText('Sửa / phản hồi')}
              </button>
              {note.status === 'PENDING' && (
                <button
                  className="kp-button"
                  disabled={action.busy}
                  onClick={() =>
                    void handleAction(
                      () =>
                        coordinationApi.acknowledgeCoordinationNote(note.id, {
                          acknowledgedBy: user?.fullName || 'Bếp',
                        }),
                      'Đã tiếp nhận ghi chú.',
                    )
                  }
                >
                  <Clock size={14} className="inline mr-1" />
                  {translateText('Tiếp nhận')}
                </button>
              )}
              {!['RESOLVED', 'CANCELLED'].includes(note.status) && (
                <button
                  className="kp-button primary"
                  disabled={action.busy}
                  onClick={() =>
                    void handleAction(
                      () =>
                        coordinationApi.resolveCoordinationNote(note.id, {
                          resolutionNote:
                            note.kitchenResponse || 'Bếp đã tiếp nhận và xử lý yêu cầu.',
                        }),
                      'Đã hoàn tất xử lý.',
                    )
                  }
                >
                  <CheckCircle size={14} className="inline mr-1" />
                  {translateText('Hoàn tất')}
                </button>
              )}
              <button
                className="kp-button danger"
                disabled={action.busy}
                onClick={() => {
                  if (window.confirm(`Xóa ghi chú "${note.title}"?`)) {
                    void handleAction(
                      () => coordinationApi.deleteCoordinationNote(note.id),
                      'Đã xóa ghi chú.',
                    );
                  }
                }}
              >
                <Trash2 size={14} className="inline mr-1" />
                {translateText('Xóa')}
              </button>
            </div>
          </article>
        ))}
      </div>

      {editingNote && (
        <Modal
          title={
            editingNote === 'new'
              ? translateText('Tạo ghi chú phối hợp')
              : translateText('Chỉnh sửa / phản hồi ghi chú')
          }
          onClose={() => setEditingNote(null)}
          busy={action.busy}
        >
          <Notice error={action.error} />
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="kp-form-grid">
              <label className="kp-field">
                {translateText('Lớp')}
                <select
                  className="kp-input"
                  required
                  disabled={editingNote !== 'new'}
                  aria-label={translateText('Lớp')}
                  value={form.classId}
                  onChange={(e) => setForm({ ...form, classId: e.target.value })}
                >
                  <option value="">{translateText('Chọn lớp')}</option>
                  {(resource.data?.availableClasses || []).map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="kp-field">
                {translateText('Bữa ăn')}
                <select
                  className="kp-input"
                  value={form.mealSession}
                  onChange={(e) => setForm({ ...form, mealSession: e.target.value })}
                >
                  <option value="LUNCH">{translateText('Trưa chính')}</option>
                  <option value="BREAKFAST">{translateText('Bữa sáng')}</option>
                  <option value="AFTERNOON_SNACK">{translateText('Ăn phụ xế')}</option>
                </select>
              </label>
              <label className="kp-field">
                {translateText('Mức ưu tiên')}
                <select
                  className="kp-input"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                >
                  <option value="NORMAL">{translateText('Bình thường')}</option>
                  <option value="HIGH">{translateText('Ưu tiên cao')}</option>
                  <option value="URGENT">{translateText('Khẩn cấp')}</option>
                </select>
              </label>
            </div>
            <label className="kp-field">
              {translateText('Tiêu đề')}
              <input
                className="kp-input"
                required
                placeholder={translateText('Nhập tiêu đề ghi chú...')}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <label className="kp-field">
              {translateText('Nội dung yêu cầu')}
              <textarea
                className="kp-input"
                rows={3}
                required
                placeholder={translateText('Nhập nội dung phối hợp...')}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
              />
            </label>
            <label className="kp-field">
              {translateText('Phản hồi từ bếp')}
              <textarea
                className="kp-input"
                rows={2}
                placeholder={translateText('Bếp phản hồi lại cho giáo viên...')}
                value={form.kitchenResponse}
                onChange={(e) => setForm({ ...form, kitchenResponse: e.target.value })}
              />
            </label>
            <div className="kp-form-actions flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                className="kp-button"
                onClick={() => setEditingNote(null)}
              >
                {translateText('Hủy')}
              </button>
              <button className="kp-button primary" disabled={action.busy}>
                {translateText('Lưu ghi chú')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
