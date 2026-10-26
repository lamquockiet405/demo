import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { TenantProfile, tenantApi, UpdateTenantProfileInput } from '../../../core/api/tenant.api';

interface EditSchoolInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: TenantProfile;
  onSaved: (updated: TenantProfile) => void;
}

/**
 * UC07: Modal chỉnh sửa thông tin trường mầm non & hồ sơ pháp lý ATTP (lưu trực tiếp vào CSDL)
 */
export const EditSchoolInfoModal: React.FC<EditSchoolInfoModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSaved,
}) => {
  const [name, setName] = useState(profile.name || '');
  const [code, setCode] = useState(profile.code || '');
  const [domain, setDomain] = useState(profile.domain || '');
  const [maxChildren, setMaxChildren] = useState<number>(profile.maxChildren || 200);
  const [address, setAddress] = useState(profile.address || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const [contactEmail, setContactEmail] = useState(profile.contactEmail || '');
  const [licenseNumber, setLicenseNumber] = useState(profile.foodSafetyLicense?.number || '');
  const [issueDate, setIssueDate] = useState(profile.foodSafetyLicense?.issueDate || '');
  const [expiryDate, setExpiryDate] = useState(profile.foodSafetyLicense?.expiryDate || '');
  const [issuingAuthority, setIssuingAuthority] = useState(
    profile.foodSafetyLicense?.issuingAuthority || '',
  );
  const [repName, setRepName] = useState(profile.legalRepresentative?.name || '');
  const [repTitle, setRepTitle] = useState(profile.legalRepresentative?.title || 'Hiệu trưởng');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && profile) {
      setName(profile.name || '');
      setCode(profile.code || '');
      setDomain(profile.domain || '');
      setMaxChildren(profile.maxChildren || 200);
      setAddress(profile.address || '');
      setPhone(profile.phone || '');
      setContactEmail(profile.contactEmail || '');
      setLicenseNumber(profile.foodSafetyLicense?.number || '');
      setIssueDate(profile.foodSafetyLicense?.issueDate || '');
      setExpiryDate(profile.foodSafetyLicense?.expiryDate || '');
      setIssuingAuthority(profile.foodSafetyLicense?.issuingAuthority || '');
      setRepName(profile.legalRepresentative?.name || '');
      setRepTitle(profile.legalRepresentative?.title || 'Hiệu trưởng');
      setError(null);
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Tên trường mầm non không được để trống.');
      return;
    }

    setSaving(true);
    setError(null);

    const updatePayload: UpdateTenantProfileInput = {
      name: name.trim(),
      code: code.trim() || undefined,
      domain: domain.trim(),
      maxChildren: Number(maxChildren) || 200,
      address: address.trim(),
      phone: phone.trim(),
      contactEmail: contactEmail.trim(),
      foodSafetyLicense: {
        number: licenseNumber.trim(),
        issueDate: issueDate.trim(),
        expiryDate: expiryDate.trim(),
        issuingAuthority: issuingAuthority.trim(),
      },
      legalRepresentative: {
        name: repName.trim(),
        title: repTitle.trim() || 'Hiệu trưởng',
      },
    };

    try {
      const updated = await tenantApi.updateProfile(updatePayload);
      if (updated?.name) {
        localStorage.setItem('school_name', updated.name);
      }
      window.dispatchEvent(new CustomEvent('tenant-profile-updated', { detail: updated }));
      onSaved(updated);
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(
        Array.isArray(msg)
          ? msg.join(', ')
          : msg || 'Không thể lưu thông tin trường học vào cơ sở dữ liệu.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150 my-8">
        <div className="bg-gradient-to-r from-teal-700 to-teal-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Building className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <h3 className="font-bold text-base">Cập nhật thông tin Trường mầm non</h3>
              <p className="text-xs text-teal-200">
                Chỉnh sửa thông tin cơ sở, người đại diện và giấy chứng nhận ATTP (lưu trực tiếp vào CSDL)
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-medium">
              {error}
            </div>
          )}

          {/* Tên trường & Mã trường */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-teal-600" /> Tên trường mầm non *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                placeholder="Nhập tên trường mầm non"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-teal-600" /> Mã trường
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full text-xs font-mono px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                placeholder="VD: MN_HOAHONG"
              />
            </div>
          </div>

          {/* Địa chỉ cơ sở */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-teal-600" /> Địa chỉ cơ sở trường *
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              placeholder="Nhập địa chỉ trường học"
            />
          </div>

          {/* Điện thoại, Email, Website & Quy mô */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-teal-600" /> Số điện thoại / Hotline *
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                placeholder="Nhập số điện thoại nhà trường"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-teal-600" /> Email liên hệ nhà trường *
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                required
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                placeholder="Nhập email liên hệ"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-teal-600" /> Website / Tên miền
              </label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                placeholder="VD: mnhoahong.kidmeal.vn"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-teal-600" /> Quy mô học sinh tối đa (chỗ)
              </label>
              <input
                type="number"
                min={1}
                max={5000}
                value={maxChildren}
                onChange={(e) => setMaxChildren(Number(e.target.value))}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>
          </div>

          {/* Người đại diện pháp lý / Hiệu trưởng */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-teal-600" /> Hiệu trưởng / Người đại diện pháp lý *
              </label>
              <input
                type="text"
                value={repName}
                onChange={(e) => setRepName(e.target.value)}
                required
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                placeholder="Họ và tên Hiệu trưởng"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Chức vụ pháp lý
              </label>
              <input
                type="text"
                value={repTitle}
                onChange={(e) => setRepTitle(e.target.value)}
                required
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                placeholder="Hiệu trưởng"
              />
            </div>
          </div>

          {/* Giấy chứng nhận cơ sở đủ điều kiện An toàn thực phẩm (ATTP) */}
          <div className="p-4 bg-teal-50/50 rounded-2xl border border-teal-100 space-y-3">
            <h4 className="text-xs font-bold text-teal-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600" /> Giấy chứng nhận Cơ sở đủ điều kiện An toàn thực phẩm (ATTP)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-teal-950 mb-1">
                  Số giấy chứng nhận ATTP
                </label>
                <input
                  type="text"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-teal-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  placeholder="Nhập số giấy phép ATTP (nếu có)"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-teal-950 mb-1">
                  Cơ quan cấp phép
                </label>
                <input
                  type="text"
                  value={issuingAuthority}
                  onChange={(e) => setIssuingAuthority(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-teal-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  placeholder="VD: Ban Quản lý ATTP / Chi cục ATVSTP"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-teal-950 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-teal-600" /> Ngày cấp
                </label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-teal-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-teal-950 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-teal-600" /> Ngày hết hạn
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-teal-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
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
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Lưu thay đổi vào CSDL
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
