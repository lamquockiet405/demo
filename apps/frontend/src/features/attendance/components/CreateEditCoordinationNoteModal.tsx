import React, { useState, useEffect } from 'react';
import { X, Save, AlertTriangle, ShieldAlert, Users, ChefHat } from 'lucide-react';
import {
  CoordinationNoteItem,
  CreateCoordinationNotePayload,
  UpdateCoordinationNotePayload,
} from '../types';

interface CreateEditCoordinationNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteToEdit: CoordinationNoteItem | null;
  selectedClassId: string;
  availableClasses: Array<{
    id: string;
    name: string;
    gradeLevel: string;
    totalStudents: number;
  }>;
  availableChildren: Array<{
    id: string;
    fullName: string;
    studentCode: string;
    allergy?: string;
  }>;
  onSave: (payload: CreateCoordinationNotePayload | UpdateCoordinationNotePayload, noteId?: string) => Promise<void>;
}

export const CreateEditCoordinationNoteModal: React.FC<CreateEditCoordinationNoteModalProps> = ({
  isOpen,
  onClose,
  noteToEdit,
  selectedClassId,
  availableClasses,
  availableChildren,
  onSave,
}) => {
  const [classId, setClassId] = useState(selectedClassId);
  const [childId, setChildId] = useState('');
  const [mealDate, setMealDate] = useState(new Date().toISOString().split('T')[0]);
  const [mealSession, setMealSession] = useState('LUNCH');
  const [noteType, setNoteType] = useState('PORTION_ADJUSTMENT');
  const [priority, setPriority] = useState('NORMAL');
  const [targetRole, setTargetRole] = useState('KITCHEN');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const currentLoggedInTeacher = localStorage.getItem('user_full_name') || localStorage.getItem('user_name') || 'Cô Nguyễn Lan Anh';
  const [teacherName, setTeacherName] = useState(currentLoggedInTeacher);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (noteToEdit) {
      setClassId(noteToEdit.classId);
      setChildId(noteToEdit.child?.id || '');
      setMealDate(noteToEdit.mealDate);
      setMealSession(noteToEdit.mealSession);
      setNoteType(noteToEdit.noteType);
      setPriority(noteToEdit.priority);
      setTargetRole(noteToEdit.targetRole || 'KITCHEN');
      setTitle(noteToEdit.title);
      setContent(noteToEdit.content);
      setTeacherName(noteToEdit.teacherName || currentLoggedInTeacher);
    } else {
      const effectiveClassId = selectedClassId || availableClasses[0]?.id || '';
      setClassId(effectiveClassId);
      setChildId('');
      setMealDate(new Date().toISOString().split('T')[0]);
      setMealSession('LUNCH');
      setNoteType('PORTION_ADJUSTMENT');
      setPriority('NORMAL');
      setTargetRole('KITCHEN');
      setTitle('');
      setContent('');
      setTeacherName(currentLoggedInTeacher);
    }
    setErrorMsg('');
  }, [noteToEdit, selectedClassId, availableClasses, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Vui lòng nhập tiêu đề ghi chú điều phối');
      return;
    }
    if (!content.trim()) {
      setErrorMsg('Vui lòng nhập nội dung dặn dò chi tiết');
      return;
    }

    const targetClassId = classId || selectedClassId || availableClasses[0]?.id;
    if (!targetClassId) {
      setErrorMsg('Vui lòng chọn lớp học');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');

      if (noteToEdit) {
        await onSave(
          {
            title: title.trim(),
            content: content.trim(),
            priority,
            noteType,
            mealSession,
          },
          noteToEdit.id,
        );
      } else {
        await onSave({
          classId: targetClassId,
          childId: childId && childId.trim() !== '' ? childId : undefined,
          mealDate,
          mealSession,
          noteType,
          priority,
          title: title.trim(),
          content: content.trim(),
          targetRole,
          teacherName,
        });
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi lưu ghi chú điều phối vào cơ sở dữ liệu');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0 bg-white">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {noteToEdit ? 'Chỉnh sửa Ghi chú Điều phối' : 'Tạo mới Ghi chú Điều phối Suất ăn'}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Đồng bộ trực tiếp giữa Giáo viên chủ nhiệm, Nhà bếp và Y tế trường học
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body (Scrollable if screen is short) */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto flex-1 px-5 py-3.5 space-y-3 text-xs">
            {errorMsg && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Row 1: Class & Child selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Lớp học <span className="text-red-500">*</span>
                </label>
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  disabled={!!noteToEdit}
                  className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:border-teal-500 text-xs"
                >
                  {availableClasses.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} ({cls.totalStudents} trẻ)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Học sinh liên quan
                </label>
                <select
                  value={childId}
                  onChange={(e) => setChildId(e.target.value)}
                  disabled={!!noteToEdit}
                  className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:border-teal-500 text-xs"
                >
                  <option value="">-- Áp dụng cho toàn thể lớp học --</option>
                  {availableChildren.map((kid) => (
                    <option key={kid.id} value={kid.id}>
                      {kid.fullName} ({kid.studentCode}){kid.allergy ? ` - ⚠️ ${kid.allergy}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Date, Meal Session & Note Type */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Ngày phục vụ <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={mealDate}
                  onChange={(e) => setMealDate(e.target.value)}
                  disabled={!!noteToEdit}
                  className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:border-teal-500 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Bữa ăn <span className="text-red-500">*</span>
                </label>
                <select
                  value={mealSession}
                  onChange={(e) => setMealSession(e.target.value)}
                  className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:border-teal-500 text-xs"
                >
                  <option value="LUNCH">Bữa trưa chính (10:30)</option>
                  <option value="BREAKFAST">Bữa sáng (07:30)</option>
                  <option value="AFTERNOON_SNACK">Bữa xế chiều (14:30)</option>
                  <option value="ALL_DAY">Cả ngày (Tất cả bữa)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Phân loại điều phối <span className="text-red-500">*</span>
                </label>
                <select
                  value={noteType}
                  onChange={(e) => setNoteType(e.target.value)}
                  className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:border-teal-500 text-xs"
                >
                  <option value="PORTION_ADJUSTMENT">Cắt suất / Tăng giảm cơm</option>
                  <option value="ALLERGY_WARNING">Cảnh báo dị ứng khẩn cấp</option>
                  <option value="SPECIAL_DIET">Chế độ ăn riêng (Cháo mềm)</option>
                  <option value="MEDICATION_FEEDING">Dặn dò uống thuốc</option>
                  <option value="KITCHEN_REQUEST">Yêu cầu phối hợp nhà bếp</option>
                  <option value="PARENT_DIRECTIVE">Dặn dò từ phụ huynh</option>
                </select>
              </div>
            </div>

            {/* Row 3: Priority & Target Role */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mức độ ưu tiên <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPriority('NORMAL')}
                    className={`py-1.5 px-2 rounded-lg font-bold border transition text-center text-xs ${
                      priority === 'NORMAL'
                        ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Tiêu chuẩn
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriority('HIGH')}
                    className={`py-1.5 px-2 rounded-lg font-bold border transition text-center text-xs ${
                      priority === 'HIGH'
                        ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                        : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                    }`}
                  >
                    ⚠️ Quan trọng
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriority('URGENT')}
                    className={`py-1.5 px-2 rounded-lg font-bold border transition text-center text-xs ${
                      priority === 'URGENT'
                        ? 'bg-red-600 text-white border-red-600 shadow-xs ring-2 ring-red-500/20'
                        : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                    }`}
                  >
                    🚨 Khẩn cấp
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nơi tiếp nhận xử lý <span className="text-red-500">*</span>
                </label>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:border-teal-500 text-xs"
                >
                  <option value="KITCHEN">Bếp Bán Trú & Tiếp Phẩm</option>
                  <option value="HEALTH_OFFICER">Phòng Y Tế & Chuyên viên DD</option>
                  <option value="PRINCIPAL">Ban Giám Hiệu</option>
                  <option value="PARENT">Phối hợp cùng Phụ Huynh</option>
                </select>
              </div>
            </div>

            {/* Row 4: Title */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Tiêu đề tóm tắt <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Cắt 1 suất trưa do đón sớm / Đổi sang cháo hạt sen..."
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-900 focus:outline-none focus:border-teal-500 focus:bg-white text-xs"
              />
            </div>

            {/* Row 5: Detailed Content */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Nội dung dặn dò chi tiết <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={2.5}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Nhập chi tiết yêu cầu, lời dặn của phụ huynh, triệu chứng của bé hoặc yêu cầu chuẩn bị..."
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-teal-500 focus:bg-white leading-relaxed text-xs resize-none"
              />
            </div>

            {/* Kitchen Response (Read-only for Teacher if Kitchen has already replied) */}
            {noteToEdit?.kitchenResponse && (
              <div className="p-2.5 bg-teal-50 border border-teal-200 rounded-lg text-xs space-y-1">
                <div className="font-bold text-teal-900 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ChefHat className="w-3.5 h-3.5 text-teal-600" />
                    Phản hồi từ Nhà Bếp: {noteToEdit.kitchenAcknowledgedBy || 'Bếp Bán Trú'}
                  </span>
                  {noteToEdit.kitchenAcknowledgedAt && (
                    <span className="text-[11px] text-teal-700 font-normal">
                      {noteToEdit.kitchenAcknowledgedAt}
                    </span>
                  )}
                </div>
                <p className="text-slate-800 bg-white p-2 rounded border border-teal-100">
                  {noteToEdit.kitchenResponse}
                </p>
              </div>
            )}

            {/* Teacher Signature */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Giáo viên ký gửi
              </label>
              <input
                type="text"
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                className="w-full py-1.5 px-3 bg-slate-100 border border-slate-200 rounded-lg font-medium text-slate-700 text-xs"
              />
            </div>
          </div>

          {/* Fixed Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 px-5 py-2.5 border-t border-slate-100 bg-slate-50/70 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-lg transition"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Đang lưu...' : noteToEdit ? 'Lưu thay đổi' : 'Gửi ghi chú'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
