import React, { useState, useEffect } from 'react';
import {
  SnackServiceItem,
  AvailableStudentItem,
  CheckAllergyResponse,
} from '../types/snackServices';
import {
  fetchAvailableStudents,
  checkSnackAllergy,
  registerSnackService,
  confirmSnackPayment,
} from '../api/snackServicesApi';

interface RegisterSnackServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedPeriodId?: string;
  periods: SnackServiceItem[];
}

export const RegisterSnackServiceModal: React.FC<RegisterSnackServiceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  selectedPeriodId,
  periods,
}) => {
  const [periodId, setPeriodId] = useState<string>('');
  const [studentId, setStudentId] = useState<string>('');
  const [acceptRisk, setAcceptRisk] = useState<boolean>(false);
  const [dietaryNote, setDietaryNote] = useState<string>('');
  const [markAsPaid, setMarkAsPaid] = useState<boolean>(true); // Default true for School Manager role
  const [students, setStudents] = useState<AvailableStudentItem[]>([]);
  const [loadingStudents, setLoadingStudents] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Allergy check state
  const [checkingAllergy, setCheckingAllergy] = useState<boolean>(false);
  const [allergyResult, setAllergyResult] = useState<CheckAllergyResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter only OPEN periods
  const openPeriods = periods.filter((p) => p.status === 'OPEN' || p.isActive);

  useEffect(() => {
    if (isOpen) {
      const initialPeriod = selectedPeriodId || (openPeriods[0]?.id ? String(openPeriods[0].id) : '');
      setPeriodId(initialPeriod);
      setStudentId('');
      setAcceptRisk(false);
      setDietaryNote('');
      setAllergyResult(null);
      setErrorMsg(null);
    }
  }, [isOpen, selectedPeriodId, periods]);

  // Load students when period changes
  useEffect(() => {
    if (isOpen && periodId) {
      setLoadingStudents(true);
      fetchAvailableStudents(periodId)
        .then((res) => {
          if (res.success && res.data) {
            setStudents(res.data);
          }
        })
        .catch((err) => {
          console.error('Error fetching students:', err);
        })
        .finally(() => {
          setLoadingStudents(false);
        });
    }
  }, [isOpen, periodId]);

  // Trigger allergy check whenever student or period changes
  useEffect(() => {
    if (periodId && studentId) {
      setCheckingAllergy(true);
      setErrorMsg(null);
      checkSnackAllergy(Number(periodId), Number(studentId))
        .then((res) => {
          setAllergyResult(res);
        })
        .catch((err) => {
          console.error('Error checking allergy:', err);
          setAllergyResult(null);
        })
        .finally(() => {
          setCheckingAllergy(false);
        });
    } else {
      setAllergyResult(null);
    }
  }, [periodId, studentId]);

  if (!isOpen) return null;

  const currentPeriod = periods.find((p) => String(p.id) === String(periodId));
  const currentStudent = students.find((s) => String(s.id) === String(studentId));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodId || !studentId) {
      setErrorMsg('Vui lòng chọn đợt dịch vụ và học sinh đăng ký.');
      return;
    }

    // Edge case check: Dangerous allergy conflict without accepting risk
    if (allergyResult?.isConflict && !acceptRisk) {
      setErrorMsg(`Thực đơn không phù hợp với hồ sơ dị ứng của trẻ: ${allergyResult.conflictingAllergens.join(', ')}. Vui lòng xác nhận chấp nhận rủi ro nếu vẫn muốn tiếp tục.`);
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const res = await registerSnackService({
        periodId: Number(periodId),
        studentId: Number(studentId),
        acceptRisk,
        dietaryNote: dietaryNote.trim() || undefined,
        markAsPaid,
        paymentMethod: markAsPaid ? 'CASH' : 'VNPAY',
      });

      if (res.success) {
        let msg = res.message;
        if (res.warning) {
          msg += `\n\n⚠️ Lưu ý: ${res.warning}`;
        }
        alert(msg);
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.message || 'Đăng ký không thành công.');
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.message || 'Có lỗi xảy ra khi xử lý đăng ký.';
      setErrorMsg(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4 flex items-center justify-between text-white">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Đăng Ký Dịch Vụ Suất Ăn Sáng (Kiểm Tra Dị Ứng)
            </h3>
            <p className="text-xs text-orange-100 mt-1">
              Phụ huynh & Quản lý trường đăng ký suất ăn sáng với quy tắc an toàn thực phẩm tự động
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1.5 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Error Alert */}
          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-3">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1 font-medium">{errorMsg}</div>
            </div>
          )}

          {/* 1. Chọn Đợt Suất Ăn Sáng */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              1. Chọn Đợt Suất Ăn Sáng <span className="text-red-500">*</span>
            </label>
            <select
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
              required
            >
              <option value="">-- Chọn đợt phục vụ --</option>
              {openPeriods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({Number(p.pricePerUnit).toLocaleString('vi-VN')} đ/suất - {p.registrationPeriod})
                </option>
              ))}
            </select>
            {currentPeriod && (
              <div className="mt-2 text-xs bg-orange-50 p-2.5 rounded-lg border border-orange-100 flex items-center justify-between text-orange-800">
                <span>🗓️ Thời gian: <strong>{currentPeriod.registrationPeriod}</strong></span>
                <span>💰 Đơn giá: <strong>{Number(currentPeriod.pricePerUnit).toLocaleString('vi-VN')} đ/ngày</strong></span>
                <span>👥 Đã đăng ký: <strong>{currentPeriod.registeredCount || 0} bé</strong></span>
              </div>
            )}
          </div>

          {/* 2. Chọn Học Sinh */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              2. Chọn Học Sinh Tham Gia <span className="text-red-500">*</span>
            </label>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              disabled={loadingStudents || !periodId}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm disabled:bg-gray-100"
              required
            >
              <option value="">
                {loadingStudents ? 'Đang tải danh sách học sinh...' : '-- Chọn học sinh trong trường --'}
              </option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.studentCode} - {s.fullName} ({s.className}) {s.hasAllergy ? '⚠️ [Có dị ứng]' : ''} {s.isRegistered ? '✓ [Đã đăng ký]' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Khung Kiểm Tra Dị Ứng Tự Động (Allergy Safety Check) */}
          {checkingAllergy && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 text-xs flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin text-orange-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              Hệ thống đang đối chiếu hồ sơ dị ứng của trẻ với thực đơn bữa xế...
            </div>
          )}

          {allergyResult && !checkingAllergy && (
            <div className={`p-4 rounded-xl border transition-all ${
              !allergyResult.hasAllergy
                ? 'bg-green-50 border-green-200 text-green-800'
                : allergyResult.isConflict
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">
                  {!allergyResult.hasAllergy ? '✅' : allergyResult.isConflict ? '🚫' : '⚠️'}
                </span>
                <div className="space-y-1 text-sm flex-1">
                  <div className="font-bold flex items-center justify-between">
                    <span>
                      {!allergyResult.hasAllergy
                        ? 'ĐỦ ĐIỀU KIỆN AN TOÀN TUYỆT ĐỐI'
                        : allergyResult.isConflict
                        ? 'CẢNH BÁO NGUY CƠ DỊ ỨNG THỰC PHẨM'
                        : 'LƯU Ý HỒ SƠ DỊ ỨNG'}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold uppercase bg-white/70">
                      Mức độ: {allergyResult.severity}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed">
                    {allergyResult.statusMessage}
                  </p>
                  {allergyResult.warning && (
                    <p className="text-xs font-semibold mt-1">
                      🔔 {allergyResult.warning}
                    </p>
                  )}
                  {allergyResult.allergyNames.length > 0 && (
                    <div className="text-xs pt-1 flex flex-wrap gap-1.5">
                      <span className="text-gray-500">Chất dị ứng của bé:</span>
                      {allergyResult.allergyNames.map((name, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-white font-medium shadow-xs">
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Edge Case: Chấp nhận rủi ro nếu có xung đột */}
              {allergyResult.isConflict && (
                <div className="mt-3 pt-3 border-t border-red-200">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acceptRisk}
                      onChange={(e) => setAcceptRisk(e.target.checked)}
                      className="mt-1 h-4 w-4 text-red-600 rounded border-gray-300 focus:ring-red-500"
                    />
                    <span className="text-xs font-semibold text-red-900 leading-tight">
                      Xác nhận chấp nhận rủi ro: Phụ huynh / Quản lý cam kết và yêu cầu nhà bếp chuẩn bị suất ăn thay thế không chứa chất gây dị ứng.
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* 4. Ghi Chú Khẩu Phần */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              3. Ghi Chú Khẩu Phần Riêng Cho Bếp (Tùy chọn)
            </label>
            <input
              type="text"
              value={dietaryNote}
              onChange={(e) => setDietaryNote(e.target.value)}
              placeholder="VD: Bé ăn ít cay, uống ấm, không dùng hành..."
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
            />
          </div>

          {/* 5. Tùy Chọn Thanh Toán (School Manager) */}
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-800">
                Xác nhận đã thu phí ngay (PAID)
              </div>
              <div className="text-xs text-gray-500">
                (Dành cho School Manager thu tiền mặt / chuyển khoản trực tiếp)
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={markAsPaid}
                onChange={(e) => setMarkAsPaid(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
            </label>
          </div>

          {/* Actions Footer */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting || (allergyResult?.isConflict && !acceptRisk)}
              className="px-5 py-2 text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  Đang ghi nhận...
                </>
              ) : (
                'Xác Nhận Đăng Ký'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

