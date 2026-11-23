import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState } from 'react';
import { apiClient } from '../../../core/api/axios';
import { downloadExcel } from '../../../core/utils/excel-export';
import { schoolDate } from '../../menus/utils/published-menus';
import { Feedback, Field, Modal, SchoolPage, State, useSchoolAction, useSchoolResource } from '../../school/components/SchoolUI';
import { TeacherStatsOverview } from '../components/TeacherStatsOverview';
import { MessageSquare, Utensils, ChefHat, Save, CheckCircle2, AlertCircle, FileSpreadsheet } from 'lucide-react';

const mealLabels: Record<string, string> = {
  BREAKFAST: 'Buổi sáng',
  LUNCH: 'Bữa trưa chính',
  AFTERNOON_SNACK: 'Buổi phụ',
  LATE_SNACK: 'Buổi xế chiều',
};

const stateLabels: Record<string, string> = {
  FULL: 'Ăn hết',
  MOST: 'Ăn phần lớn (70-90%)',
  HALF: 'Ăn một nửa (50%)',
  LITTLE: 'Ăn ít (< 30%)',
  NONE: 'Không ăn / Bỏ bữa',
};

const get = async (path: string, params?: any) => (await apiClient.get('/teacher/' + path, { params })).data;

export function TeacherNotesPage() {
  useLanguage();
  const classes = useSchoolResource<any[]>(() => get('classes'), []);
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(schoolDate);
  const [meal, setMeal] = useState('LUNCH');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'CHILDREN_NOTES' | 'KITCHEN_NOTES'>('CHILDREN_NOTES');

  // Draft state for inline student meal notes
  const [studentDrafts, setStudentDrafts] = useState<Record<string, { consumptionLevel: string; note: string; isAttended: boolean }>>({});

  // Modal state for coordination note with kitchen
  const [kitchenForm, setKitchenForm] = useState<any>(null);

  const action = useSchoolAction();

  // Resource 1: Student meal attendance and post-meal notes
  const mealAttendanceRes = useSchoolResource<any[]>(
    () => get('meal-attendance', { classId, date, mealType: meal, search }),
    [classId, date, meal, search]
  );

  // Resource 2: Coordination notes with kitchen
  const kitchenNotesRes = useSchoolResource<any[]>(
    () => get('notes', { classId, date }),
    [classId, date]
  );

  const studentRows = mealAttendanceRes.error || mealAttendanceRes.loading ? [] : mealAttendanceRes.data || [];
  const kitchenNotes = kitchenNotesRes.error || kitchenNotesRes.loading ? [] : kitchenNotesRes.data || [];

  const getStudentCurrent = (row: any) => {
    if (studentDrafts[row.studentId]) {
      return studentDrafts[row.studentId];
    }
    return {
      isAttended: row.isAttended ?? true,
      consumptionLevel: row.consumptionLevel || 'FULL',
      note: row.note || '',
    };
  };

  const updateStudentDraft = (studentId: string, updates: Partial<{ consumptionLevel: string; note: string; isAttended: boolean }>) => {
    setStudentDrafts((prev) => {
      const existing = prev[studentId] || {
        isAttended: true,
        consumptionLevel: 'FULL',
        note: '',
      };
      return {
        ...prev,
        [studentId]: { ...existing, ...updates },
      };
    });
  };

  const saveSingleStudentNote = (row: any) =>
    void action.run(async () => {
      const val = getStudentCurrent(row);
      await apiClient.put('/teacher/meal-attendance/' + row.studentId, {
        date,
        mealType: meal,
        isAttended: val.isAttended,
        consumptionLevel: val.isAttended ? val.consumptionLevel : null,
        note: val.note.trim() || null,
      });
      setStudentDrafts((prev) => {
        const next = { ...prev };
        delete next[row.studentId];
        return next;
      });
      await mealAttendanceRes.reload();
    }, `Đã lưu ghi chú sau bữa ăn cho bé ${row.fullName}.`);

  const saveAllStudentNotes = () =>
    void action.run(async () => {
      const promises = studentRows.map((row) => {
        const val = getStudentCurrent(row);
        return apiClient.put('/teacher/meal-attendance/' + row.studentId, {
          date,
          mealType: meal,
          isAttended: val.isAttended,
          consumptionLevel: val.isAttended ? val.consumptionLevel : null,
          note: val.note.trim() || null,
        });
      });
      await Promise.all(promises);
      setStudentDrafts({});
      await mealAttendanceRes.reload();
    }, 'Đã lưu đồng loạt ghi chú sau bữa ăn cho toàn bộ học sinh.');

  const handleExportExcel = async () => {
    if (activeTab === 'CHILDREN_NOTES') {
      if (!studentRows.length) return alert(translateText("Chưa có danh sách học sinh để xuất Excel."));
      await downloadExcel(
        `Ghi_chu_bua_an_${date}_${mealLabels[meal] || meal}.xlsx`,
        [
          ["Mã học sinh", "Họ và tên", "Lớp", "Ngày", "Bữa ăn", "Điểm danh", "Mức ăn", "Ghi chú sau bữa"],
          ...studentRows.map(r => {
            const current = getStudentCurrent(r);
            return [
              r.studentCode || '',
              r.fullName || '',
              r.className || '',
              date,
              mealLabels[meal] || meal,
              current.isAttended ? 'Có mặt' : 'Vắng',
              stateLabels[current.consumptionLevel] || current.consumptionLevel || 'Chưa ghi nhận',
              current.note || '',
            ];
          }),
        ],
        `Ghi chú bữa ăn ${date}`
      );
    } else {
      if (!kitchenNotes.length) return alert(translateText("Chưa có ghi chú bếp để xuất Excel."));
      await downloadExcel(
        `Ghi_chu_gui_bep_${date}.xlsx`,
        [
          ["Lớp", "Ngày", "Bữa ăn", "Tiêu đề", "Nội dung", "Trạng thái", "Phản hồi của bếp"],
          ...kitchenNotes.map(n => [
            n.class?.name || n.className || '',
            n.mealDate || date,
            mealLabels[n.mealSession] || n.mealSession || '',
            n.title || '',
            n.content || '',
            n.status === 'RESOLVED' ? 'Đã xử lý' : n.status === 'ACKNOWLEDGED' ? 'Bếp đã tiếp nhận' : 'Chờ phản hồi',
            n.kitchenResponse || '',
          ]),
        ],
        `Ghi chú gửi bếp ${date}`
      );
    }
  };

  const saveKitchenNote = async (e: React.FormEvent) => {
    e.preventDefault();
    await action.run(async () => {
      const { id, ...body } = kitchenForm;
      if (id) await apiClient.put('/teacher/notes/' + id, body);
      else await apiClient.post('/teacher/notes', body);
      setKitchenForm(null);
      await kitchenNotesRes.reload();
    }, 'Đã gửi ghi chú phối hợp tới nhà bếp.');
  };

  return (
    <SchoolPage
      title={translateText("Ghi chú sau bữa ăn của bé")}
      description={translateText("Ghi nhận tình trạng ăn uống, biểu hiện và nhận xét chi tiết của từng bé sau mỗi bữa ăn (Buổi sáng, Bữa trưa chính, Buổi phụ, Buổi xế chiều) cho lớp phụ trách.")}
    >
      <Feedback error={action.error || classes.error} message={action.message} />

      {/* 4 Thẻ KPI Giáo viên chuẩn */}
      <TeacherStatsOverview classes={classes.data} />

      {/* Bộ lọc Ngày, Lớp, Bữa ăn, Tìm kiếm & Nút thao tác */}
      <div className="kp-filters flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <Field label={translateText("Ngày")}>
            <input
              aria-label={translateText("Ngày ghi chú sau bữa")}
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </Field>
          <select
            aria-label={translateText("Lớp phụ trách")}
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          >
            <option value="">{translateText("Tất cả lớp được phân công")}</option>
            {(classes.data || []).map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            aria-label={translateText("Bữa ăn")}
            value={meal}
            onChange={(e) => setMeal(e.target.value)}
          >
            {Object.entries(mealLabels).map(([code, label]) => (
              <option key={code} value={code}>
                {translateText(label)}
              </option>
            ))}
          </select>
          <input
            aria-label={translateText("Tìm kiếm học sinh")}
            placeholder={translateText("Tìm tên hoặc mã học sinh...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className="kp-button"
            onClick={() => {
              void mealAttendanceRes.reload();
              void kitchenNotesRes.reload();
            }}
          >{translateText("Làm mới")}</button>
          <button
            type="button"
            className="kp-button flex items-center gap-1.5"
            disabled={activeTab === 'CHILDREN_NOTES' ? studentRows.length === 0 : kitchenNotes.length === 0}
            onClick={() => void handleExportExcel()}
            title={translateText("Xuất dữ liệu ra file Excel")}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>{translateText("Xuất Excel")}</span>
          </button>
          {activeTab === 'CHILDREN_NOTES' && (
            <button
              type="button"
              className="kp-button primary"
              disabled={action.busy || studentRows.length === 0}
              onClick={saveAllStudentNotes}
            >
              <Save size={16} className="inline mr-1" />{translateText("Lưu tất cả ghi chú")}</button>
          )}
          {activeTab === 'KITCHEN_NOTES' && (
            <button
              type="button"
              className="kp-button primary"
              onClick={() =>
                setKitchenForm({
                  classId: classId || (classes.data?.length === 1 ? String(classes.data[0].id) : ''),
                  mealDate: date,
                  mealSession: meal,
                  title: '',
                  content: '',
                })
              }
            >
              <ChefHat size={16} className="inline mr-1" />{translateText("Tạo ghi chú gửi bếp")}</button>
          )}
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200 gap-4 mb-4">
        <button
          className={`pb-3 font-bold text-sm border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'CHILDREN_NOTES'
            ? 'border-emerald-600 text-emerald-800'
            : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          onClick={() => setActiveTab('CHILDREN_NOTES')}
        >
          <Utensils size={16} />{translateText("Ghi chú sau bữa ăn từng bé (")}{studentRows.length}{translateText(" học sinh)")}</button>
        <button
          className={`pb-3 font-bold text-sm border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'KITCHEN_NOTES'
            ? 'border-emerald-600 text-emerald-800'
            : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          onClick={() => setActiveTab('KITCHEN_NOTES')}
        >
          <MessageSquare size={16} />{translateText("Ghi chú phối hợp với nhà bếp (")}{kitchenNotes.length})
        </button>
      </div>

      {/* ─── TAB 1: GHI CHÚ SAU BỮA ĂN TỪNG BÉ ─── */}
      {activeTab === 'CHILDREN_NOTES' && (
        <div className="space-y-4">
          <State resource={mealAttendanceRes} empty={!studentRows.length} />
          {studentRows.length > 0 && (
            <div className="kp-table-wrap">
              <table className="kp-table">
                <thead>
                  <tr>
                    <th style={{ width: '22%' }}>{translateText("Học sinh")}</th>
                    <th style={{ width: '13%' }}>{translateText("Lớp")}</th>
                    <th style={{ width: '10%' }}>{translateText("Điểm danh")}</th>
                    <th style={{ width: '20%' }}>{translateText("Mức ăn sau bữa")}</th>
                    <th style={{ width: '25%' }}>{translateText("Ghi chú sau bữa ăn của bé")}</th>
                    <th style={{ width: '10%' }}>{translateText("Thao tác")}</th>
                  </tr>
                </thead>
                <tbody>
                  {studentRows.map((row) => {
                    const currentVal = getStudentCurrent(row);
                    const isModified = !!studentDrafts[row.studentId];

                    return (
                      <tr key={row.studentId} className={isModified ? 'bg-emerald-50/50' : ''}>
                        <td>
                          <strong>{row.fullName}</strong>
                          <span className="block text-xs text-slate-500">{row.studentCode}</span>
                        </td>
                        <td>{row.className}</td>
                        <td>
                          <button
                            type="button"
                            className={`px-2.5 py-1 text-xs rounded-full font-bold cursor-pointer transition ${currentVal.isAttended
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                              }`}
                            onClick={() =>
                              updateStudentDraft(row.studentId, {
                                isAttended: !currentVal.isAttended,
                              })
                            }
                          >
                            {translateText(currentVal.isAttended ? 'Có mặt' : 'Vắng mặt')}
                          </button>
                        </td>
                        <td>
                          {currentVal.isAttended ? (
                            <select
                              aria-label={translateText(`Mức ăn của ${row.fullName}`)}
                              className="kp-input text-xs w-full py-1.5"
                              value={currentVal.consumptionLevel}
                              onChange={(e) =>
                                updateStudentDraft(row.studentId, {
                                  consumptionLevel: e.target.value,
                                })
                              }
                            >
                              {Object.entries(stateLabels).map(([code, label]) => (
                                <option key={code} value={code}>
                                  {translateText(label)}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs text-slate-400 italic">{translateText("Không ăn (Trẻ vắng)")}</span>
                          )}
                        </td>
                        <td>
                          {currentVal.isAttended ? (
                            <input
                              aria-label={translateText(`Ghi chú sau bữa cho ${row.fullName}`)}
                              className="kp-input text-xs w-full py-1.5"
                              placeholder={translateText("VD: Bé tự xúc hết suất; Bé bỏ rau; Bé trớ canh...")}
                              value={currentVal.note}
                              onChange={(e) =>
                                updateStudentDraft(row.studentId, {
                                  note: e.target.value,
                                })
                              }
                            />
                          ) : (
                            <input
                              aria-label={translateText(`Lý do vắng cho ${row.fullName}`)}
                              className="kp-input text-xs w-full py-1.5"
                              placeholder={translateText("Lý do vắng mặt...")}
                              value={currentVal.note}
                              onChange={(e) =>
                                updateStudentDraft(row.studentId, {
                                  note: e.target.value,
                                })
                              }
                            />
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`kp-button text-xs py-1 px-3 ${isModified ? 'primary' : ''
                              }`}
                            disabled={action.busy}
                            onClick={() => saveSingleStudentNote(row)}
                          >{translateText("Lưu")}</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: GHI CHÚ PHỐI HỢP VỚI NHÀ BẾP ─── */}
      {activeTab === 'KITCHEN_NOTES' && (
        <div className="space-y-4">
          <State resource={kitchenNotesRes} empty={!kitchenNotes.length} />
          {kitchenNotes.map((n: any) => (
            <article key={n.id} className="bg-white border rounded-xl p-5 space-y-3 shadow-xs">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-slate-500 font-medium">
                    {n.className}{translateText(" · Ngày: ")}{translateText(n.meal_date)}{translateText(" · Bữa: ")}{translateText(mealLabels[n.meal_session] || n.meal_session)}{translateText(" · Trạng thái:")}{' '}
                    <span className="font-bold text-emerald-700">{translateText(n.status)}</span>
                  </p>
                  <h3 className="font-bold text-base mt-1 text-slate-900">{translateText(n.title)}</h3>
                </div>
                <div className="flex gap-2">
                  <button
                    className="kp-button text-xs"
                    onClick={() =>
                      setKitchenForm({
                        id: n.id,
                        classId: String(n.class_id),
                        mealDate: n.meal_date,
                        mealSession: n.meal_session,
                        childId: n.child_id || undefined,
                        priority: n.priority,
                        noteType: n.note_type,
                        title: n.title,
                        content: n.content,
                      })
                    }
                  >{translateText("Sửa")}</button>
                  <button
                    className="kp-button text-xs"
                    disabled={action.busy}
                    onClick={() => {
                      if (window.confirm(translateText('Xóa ghi chú phối hợp này?'))) {
                        void action.run(async () => {
                          await apiClient.delete('/teacher/notes/' + n.id);
                          await kitchenNotesRes.reload();
                        }, 'Đã xóa ghi chú phối hợp.');
                      }
                    }}
                  >{translateText("Xóa")}</button>
                </div>
              </div>
              <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
                {n.content}
              </p>
              {n.kitchen_response ? (
                <div className="text-sm bg-emerald-50 border border-emerald-200 text-emerald-900 p-3 rounded-lg">
                  <strong>{translateText("Phản hồi từ nhà bếp:")}</strong> {translateText(n.kitchen_response)}
                </div>
              ) : (
                <p className="text-xs text-amber-700 italic">{translateText("Nhà bếp chưa phản hồi.")}</p>
              )}
            </article>
          ))}
        </div>
      )}

      {/* Modal tạo / sửa ghi chú gửi bếp */}
      {kitchenForm && (
        <Modal
          title={translateText(kitchenForm.id ? 'Sửa ghi chú gửi nhà bếp' : 'Tạo ghi chú phối hợp gửi nhà bếp')}
          onClose={() => !action.busy && setKitchenForm(null)}
        >
          <form onSubmit={saveKitchenNote} className="space-y-4">
            <Field label={translateText("Lớp phụ trách")}>
              <select
                aria-label={translateText("Lớp ghi chú")}
                required
                disabled={!!kitchenForm.id}
                value={kitchenForm.classId}
                onChange={(e) => setKitchenForm({ ...kitchenForm, classId: e.target.value })}
              >
                <option value="">{translateText("Chọn lớp")}</option>
                {(classes.data || []).map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={translateText("Ngày")}>
              <input
                aria-label={translateText("Ngày ghi chú")}
                required
                disabled={!!kitchenForm.id}
                type="date"
                value={kitchenForm.mealDate}
                onChange={(e) => setKitchenForm({ ...kitchenForm, mealDate: e.target.value })}
              />
            </Field>
            <Field label={translateText("Bữa ăn")}>
              <select
                aria-label={translateText("Bữa ghi chú")}
                value={kitchenForm.mealSession}
                onChange={(e) => setKitchenForm({ ...kitchenForm, mealSession: e.target.value })}
              >
                {Object.entries(mealLabels).map(([code, label]) => (
                  <option key={code} value={code}>
                    {translateText(label)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={translateText("Tiêu đề trao đổi")}>
              <input
                aria-label={translateText("Tiêu đề ghi chú")}
                required
                placeholder={translateText("VD: Cơm hôm nay hơi khô; Bổ sung thêm rau cho bé;...")}
                value={kitchenForm.title}
                onChange={(e) => setKitchenForm({ ...kitchenForm, title: e.target.value })}
              />
            </Field>
            <Field label={translateText("Nội dung chi tiết")}>
              <textarea
                aria-label={translateText("Nội dung ghi chú")}
                required
                rows={4}
                placeholder={translateText("Nhập nội dung cô muốn trao đổi hoặc phản hồi trực tiếp với bếp...")}
                value={kitchenForm.content}
                onChange={(e) => setKitchenForm({ ...kitchenForm, content: e.target.value })}
              />
            </Field>
            <Feedback error={action.error} />
            <button className="kp-button primary w-full" disabled={action.busy}>
              {translateText(kitchenForm.id ? 'Cập nhật ghi chú' : 'Gửi ghi chú đến nhà bếp')}
            </button>
          </form>
        </Modal>
      )}
    </SchoolPage>
  );
}

