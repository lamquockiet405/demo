import React, { useEffect, useState } from "react";
import {
  X,
  Baby,
  Calendar,
  User,
  Phone,
  ShieldAlert,
  HeartPulse,
  Activity,
  Sparkles,
  School,
  FileText,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { childrenApi, ChildItem } from "../api/children.api";
import { Link } from "react-router-dom";

interface ChildProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  childId?: string | number | null;
}

export const ChildProfileModal: React.FC<ChildProfileModalProps> = ({
  isOpen,
  onClose,
  childId,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [child, setChild] = useState<ChildItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !childId) {
      setChild(null);
      setError(null);
      return;
    }

    const loadChild = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await childrenApi.getChild(String(childId));
        setChild(res);
      } catch (err: any) {
        console.error("Lỗi khi tải chi tiết hồ sơ học sinh:", err);
        setError(err.response?.data?.message || "Không thể tải hồ sơ học sinh.");
      } finally {
        setLoading(false);
      }
    };

    void loadChild();
  }, [isOpen, childId]);

  if (!isOpen) return null;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Chưa cập nhật";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString("vi-VN");
  };

  const calculateAge = (dobStr?: string) => {
    if (!dobStr) return "";
    const dob = new Date(dobStr);
    if (isNaN(dob.getTime())) return "";
    const now = new Date();
    let years = now.getFullYear() - dob.getFullYear();
    let months = now.getMonth() - dob.getMonth();
    if (months < 0) {
      years--;
      months += 12;
    }
    return years > 0 ? `${years} tuổi ${months > 0 ? `${months} tháng` : ""}` : `${months} tháng`;
  };

  const activeAllergies = (child?.allergies || []).filter((a) => a.isActive !== false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 bg-gradient-to-r from-teal-50 via-emerald-50 to-white px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-sm overflow-hidden">
              {child?.avatarUrl ? (
                <img
                  src={child.avatarUrl}
                  alt={child.fullName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Baby className="h-6 w-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-[11px] font-bold text-teal-800">
                  Hồ sơ học sinh • UC26
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                  Mã: {child?.studentCode || "—"}
                </span>
              </div>
              <h2 className="mt-1 text-xl font-black text-slate-900">
                {child?.fullName || "Chi tiết hồ sơ học sinh"}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[75vh] overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
              <p className="text-sm font-semibold">Đang tải hồ sơ của bé...</p>
            </div>
          )}

          {error && !loading && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center text-sm text-rose-800">
              <p className="font-semibold">{error}</p>
            </div>
          )}

          {!loading && !error && child && (
            <>
              {/* Thông tin cơ bản */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-teal-600" /> Thông tin nhân khẩu
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-slate-500 block">Họ và tên</span>
                    <strong className="text-slate-900 font-bold">{child.fullName}</strong>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Giới tính</span>
                    <span className="font-semibold text-slate-800">
                      {child.gender === "FEMALE" ? "Nữ" : "Nam"}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Ngày sinh</span>
                    <span className="font-semibold text-slate-800">
                      {formatDate(child.dateOfBirth)}{" "}
                      {child.dateOfBirth && (
                        <small className="text-slate-500">({calculateAge(child.dateOfBirth)})</small>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Lớp học</span>
                    <strong className="text-teal-700 font-bold">
                      {child.className || child.class?.name || "Chưa phân lớp"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Khối tuổi</span>
                    <span className="font-semibold text-slate-800">
                      {child.ageGroup === "NHA_TRE" ? "Nhà trẻ (12–36T)" : "Mẫu giáo (3–6T)"}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Trạng thái</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                      Đang theo học
                    </span>
                  </div>
                </div>
              </div>

              {/* Dị ứng & Cảnh báo an toàn thực phẩm */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-600" /> Tình trạng dị ứng thực phẩm ({activeAllergies.length})
                  </h3>
                  <Link
                    to="/declare-allergy"
                    onClick={onClose}
                    className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1"
                  >
                    Cập nhật dị ứng <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>

                {activeAllergies.length > 0 ? (
                  <div className="space-y-2.5">
                    {activeAllergies.map((alg) => (
                      <div
                        key={alg.id}
                        className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-950 flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between">
                          <strong className="text-sm font-bold text-amber-950">
                            {alg.allergen?.nameVi || alg.customAllergenName || "Dị ứng"}
                          </strong>
                          <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                            {alg.severity === "ANAPHYLACTIC"
                              ? "Sốc phản vệ"
                              : alg.severity === "SEVERE"
                              ? "Nặng"
                              : alg.severity === "MODERATE"
                              ? "Trung bình"
                              : "Nhẹ"}
                          </span>
                        </div>
                        {alg.symptoms && (
                          <p className="text-amber-900/90">
                            <span className="font-semibold">Triệu chứng:</span> {alg.symptoms}
                          </p>
                        )}
                        {alg.reactionTreatment && (
                          <p className="text-amber-900/90">
                            <span className="font-semibold">Xử trí / Hướng dẫn:</span>{" "}
                            {alg.reactionTreatment}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs font-semibold text-slate-600 text-center">
                    Hồ sơ chưa ghi nhận dị ứng thực phẩm nào.
                  </div>
                )}
              </div>

              {/* Liên hệ phụ huynh & Khẩn cấp */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-teal-600" /> Người liên hệ & Khẩn cấp
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-slate-500 block">Người liên hệ khẩn cấp</span>
                    <strong className="text-slate-900 font-bold">
                      {child.emergencyContactName || "Theo hồ sơ gia đình"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Số điện thoại khẩn cấp</span>
                    <span className="font-semibold text-slate-800">
                      {child.emergencyContactPhone || "—"}
                    </span>
                  </div>
                </div>
                {child.medicalNotes && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <span className="text-xs text-slate-500 block mb-1">Ghi chú y tế & dinh dưỡng đặc biệt</span>
                    <p className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-200 leading-relaxed">
                      {child.medicalNotes}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 flex items-center justify-between">
          <Link
            to="/parent/growth"
            onClick={onClose}
            className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1"
          >
            <Activity className="h-3.5 w-3.5" /> Xem biểu đồ thể chất & Z-score của bé
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

