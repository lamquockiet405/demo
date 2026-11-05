import React, { useState, useEffect } from "react";
import {
  X,
  Building,
  Phone,
  Mail,
  Globe,
  Calendar,
  ShieldCheck,
  UserCheck,
  Loader2,
  Hash,
  Users,
} from "lucide-react";
import {
  TenantProfile,
  tenantApi,
  UpdateTenantProfileInput,
} from "../../../core/api/tenant.api";

interface EditSchoolInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: TenantProfile;
  onSaved: (updated: TenantProfile) => void;
}

export const EditSchoolInfoModal: React.FC<EditSchoolInfoModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSaved,
}) => {
  const [form, setForm] = useState({
    name: "",
    code: "",
    domain: "",
    maxChildren: "" as string | number,
    address: "",
    phone: "",
    contactEmail: "",
    educationDepartmentCode: "",
    schoolIdentifierSgd: "",
    licenseNumber: "",
    issueDate: "",
    expiryDate: "",
    issuingAuthority: "",
    repName: "",
    repTitle: "Hiệu trưởng",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && profile) {
      setForm({
        name: profile.name || "",
        code: profile.code || "",
        domain: profile.domain || "",
        maxChildren: profile.maxChildren ?? "",
        address: profile.address || "",
        phone: profile.phone || "",
        contactEmail: profile.contactEmail || "",
        educationDepartmentCode: profile.educationDepartmentCode || "",
        schoolIdentifierSgd: profile.schoolIdentifierSgd || "",
        licenseNumber: profile.foodSafetyLicense?.number || "",
        issueDate: profile.foodSafetyLicense?.issueDate || "",
        expiryDate: profile.foodSafetyLicense?.expiryDate || "",
        issuingAuthority: profile.foodSafetyLicense?.issuingAuthority || "",
        repName: profile.legalRepresentative?.name || "",
        repTitle: profile.legalRepresentative?.title || "Hiệu trưởng",
      });
      setError(null);
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const setField = (key: keyof typeof form, val: string | number) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Tên trường mầm non không được để trống.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload: UpdateTenantProfileInput = {
      name: form.name.trim(),
      code: form.code.trim() || undefined,
      domain: form.domain.trim(),
      maxChildren:
        form.maxChildren === "" ? undefined : Number(form.maxChildren),
      address: form.address.trim(),
      phone: form.phone.trim(),
      contactEmail: form.contactEmail.trim(),
      educationDepartmentCode: form.educationDepartmentCode.trim(),
      schoolIdentifierSgd: form.schoolIdentifierSgd.trim(),
      foodSafetyLicense: {
        number: form.licenseNumber.trim(),
        issueDate: form.issueDate.trim(),
        expiryDate: form.expiryDate.trim(),
        issuingAuthority: form.issuingAuthority.trim(),
      },
      legalRepresentative: {
        name: form.repName.trim(),
        title: form.repTitle.trim() || "Hiệu trưởng",
      },
    };

    try {
      const updated = await tenantApi.updateProfile(payload);
      if (updated?.name) localStorage.setItem("school_name", updated.name);
      window.dispatchEvent(
        new CustomEvent("tenant-profile-updated", { detail: updated }),
      );
      onSaved(updated);
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(
        Array.isArray(msg)
          ? msg.join(", ")
          : msg || "Không thể lưu thông tin trường học.",
      );
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150 my-8">
        <div className="bg-gradient-to-r from-teal-700 to-teal-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Building className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <h3 className="font-bold text-base">
                Cập nhật thông tin Trường mầm non
              </h3>
              <p className="text-xs text-teal-200">
                Chỉnh sửa hồ sơ cơ sở, mã định danh Bộ GD&ĐT và giấy chứng nhận
                ATTP
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4 max-h-[80vh] overflow-y-auto"
        >
          {error && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-teal-600" /> Tên trường
                mầm non *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                required
                className={inputCls}
                placeholder="Nhập tên trường mầm non"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-teal-600" /> Mã trường
              </label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setField("code", e.target.value)}
                className={`${inputCls} font-mono`}
                placeholder="VD: MN_SAOMAI"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-teal-600" /> Địa chỉ cơ sở
              trường *
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setField("address", e.target.value)}
              required
              className={inputCls}
              placeholder="Nhập địa chỉ trường học"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-teal-600" /> Số điện thoại /
                Hotline *
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
                required
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-teal-600" /> Email liên hệ nhà
                trường *
              </label>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(e) => setField("contactEmail", e.target.value)}
                required
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-teal-600" /> Website / Tên
                miền
              </label>
              <input
                type="text"
                value={form.domain}
                onChange={(e) => setField("domain", e.target.value)}
                className={inputCls}
                placeholder="VD: saomai.kidsnutri.vn"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-teal-600" /> Quy mô học sinh
                tối đa (chỗ)
              </label>
              <input
                type="number"
                min={1}
                max={5000}
                value={form.maxChildren}
                onChange={(e) =>
                  setField("maxChildren", Number(e.target.value))
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Mã Phòng / Sở GD&ĐT
              </label>
              <input
                type="text"
                value={form.educationDepartmentCode}
                onChange={(e) =>
                  setField("educationDepartmentCode", e.target.value)
                }
                className={`${inputCls} font-mono`}
                placeholder="VD: GD-MN-79-03-0042"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Mã định danh CSDL Ngành (Bộ GD&ĐT)
              </label>
              <input
                type="text"
                value={form.schoolIdentifierSgd}
                onChange={(e) =>
                  setField("schoolIdentifierSgd", e.target.value)
                }
                className={`${inputCls} font-mono`}
                placeholder="VD: MN-HCM-Q3-0042"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-teal-600" /> Người đại
                diện pháp lý *
              </label>
              <input
                type="text"
                value={form.repName}
                onChange={(e) => setField("repName", e.target.value)}
                required
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Chức vụ pháp lý
              </label>
              <input
                type="text"
                value={form.repTitle}
                onChange={(e) => setField("repTitle", e.target.value)}
                required
                className={inputCls}
              />
            </div>
          </div>

          <div className="p-4 bg-teal-50/50 rounded-2xl border border-teal-100 space-y-3">
            <h4 className="text-xs font-bold text-teal-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600" /> Giấy chứng nhận
              Cơ sở đủ điều kiện ATTP
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-teal-950 mb-1">
                  Số giấy chứng nhận ATTP
                </label>
                <input
                  type="text"
                  value={form.licenseNumber}
                  onChange={(e) => setField("licenseNumber", e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-teal-200 bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-teal-950 mb-1">
                  Cơ quan cấp phép
                </label>
                <input
                  type="text"
                  value={form.issuingAuthority}
                  onChange={(e) => setField("issuingAuthority", e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-teal-200 bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-teal-950 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-teal-600" /> Ngày cấp
                </label>
                <input
                  type="date"
                  value={form.issueDate}
                  onChange={(e) => setField("issueDate", e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-teal-200 bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-teal-950 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-teal-600" /> Ngày hết hạn
                </label>
                <input
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setField("expiryDate", e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-teal-200 bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-md shadow-teal-600/20 transition flex items-center gap-1.5"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Lưu thay đổi vào CSDL
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
