import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  userProfileApi,
  UserProfile,
} from "../../../core/api/user-profile.api";
import { useAuthStore } from "../../../core/stores/auth.store";
import {
  Modal,
  Notice,
  useKitchenAction,
} from "../../kitchen/components/KitchenUI";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: (profile: UserProfile) => void;
  defaultTab?: "profile" | "password" | "security";
}
export function UserProfileModal({
  isOpen,
  onClose,
  onProfileUpdated,
  defaultTab = "profile",
}: Props) {
  useLanguage();
  const [tab, setTab] = useState(
    defaultTab === "profile" ? "profile" : "password",
  ),
    [loading, setLoading] = useState(false),
    [loadError, setLoadError] = useState(""),
    [profile, setProfile] = useState<UserProfile | null>(null);
  const [fullName, setFullName] = useState(""),
    [phone, setPhone] = useState(""),
    [avatarUrl, setAvatarUrl] = useState("");
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const action = useKitchenAction();
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setTab(defaultTab === "profile" ? "profile" : "password");
    setProfile(null);
    setLoadError("");
    setLoading(true);
    setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
    userProfileApi
      .getMyProfile()
      .then((p) => {
        if (active) {
          setProfile(p);
          setFullName(p.fullName || "");
          setPhone(p.phone || "");
          setAvatarUrl(p.avatarUrl || "");
        }
      })
      .catch(() => {
        if (active)
          setLoadError(
            "Không tải được hồ sơ tài khoản. Vui lòng đóng và mở lại để thử lại.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen, defaultTab]);
  if (!isOpen) return null;
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    await action.run(async () => {
      if (!fullName.trim()) throw Error("Vui lòng nhập họ tên.");
      const p = await userProfileApi.updateMyProfile({
        fullName: fullName.trim(),
        phone: phone.trim(),
        avatarUrl: avatarUrl.trim(),
      });
      setProfile(p);
      await useAuthStore.getState().refreshProfile();
      onProfileUpdated?.(p);
    }, "Đã lưu hồ sơ tài khoản.");
  };
  const change = async (e: React.FormEvent) => {
    e.preventDefault();
    await action.run(async () => {
      if (passwords.newPassword !== passwords.confirmPassword)
        throw Error("Mật khẩu xác nhận không khớp.");
      if (passwords.newPassword.length < 8)
        throw Error("Mật khẩu mới cần ít nhất 8 ký tự.");
      if (passwords.newPassword === passwords.currentPassword)
        throw Error("Mật khẩu mới phải khác mật khẩu hiện tại.");
      await userProfileApi.changePassword(passwords);
      setPasswords({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    }, "Đã đổi mật khẩu.");
  };
  return (
    <Modal title={translateText("Tài khoản cá nhân")} onClose={() => !action.busy && onClose()}>
      <div className="space-y-4">
        <div className="kp-tabs">
          <button
            className={tab === "profile" ? "active" : ""}
            onClick={() => setTab("profile")}
          >{translateText("Hồ sơ cá nhân")}</button>
          <button
            className={tab === "password" ? "active" : ""}
            onClick={() => setTab("password")}
          >{translateText("Đổi mật khẩu")}</button>
        </div>
        <Notice error={loadError || action.error} message={action.message} />
        {loading && <p role="status">{translateText("Đang tải hồ sơ...")}</p>}
        {tab === "profile" && profile && (
          <form className="space-y-4" onSubmit={save}>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
              <span className="font-bold text-slate-700">{translateText("Email đăng nhập:")}</span> {profile.email}
            </div>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
              <span>{translateText("Họ tên")} <span className="text-rose-500">*</span></span>
              <input
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-xs transition focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 kp-input"
                aria-label={translateText("Họ tên tài khoản")}
                placeholder={translateText("Nhập họ và tên…")}
                required
                maxLength={150}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
              <span>{translateText("Số điện thoại")}</span>
              <input
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-xs transition focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 kp-input"
                aria-label={translateText("Số điện thoại tài khoản")}
                placeholder={translateText("Nhập số điện thoại…")}
                maxLength={20}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
              <span>{translateText("Đường dẫn ảnh đại diện")}</span>
              <input
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-xs transition focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 kp-input"
                aria-label={translateText("Đường dẫn ảnh đại diện")}
                placeholder="https://…"
                maxLength={500}
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
              />
            </label>
            <button
              type="submit"
              className="kp-button primary w-full justify-center py-2.5 font-bold"
              disabled={action.busy}
            >{translateText("Lưu hồ sơ cá nhân")}</button>
          </form>
        )}
        {tab === "password" && (
          <form className="space-y-4" onSubmit={change}>
            {/* Mật khẩu hiện tại */}
            <div className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
              <label htmlFor="currentPassword">{translateText("Mật khẩu hiện tại")} <span className="text-rose-500">*</span></label>
              <div className="relative">
                <input
                  id="currentPassword"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-800 placeholder-slate-400 shadow-xs transition focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 kp-input"
                  aria-label={translateText("Mật khẩu hiện tại")}
                  placeholder={translateText("Nhập mật khẩu hiện tại…")}
                  type={showCurrent ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={passwords.currentPassword}
                  onChange={(e) =>
                    setPasswords({ ...passwords, currentPassword: e.target.value })
                  }
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  onClick={() => setShowCurrent(!showCurrent)}
                  aria-label={translateText(showCurrent ? "Ẩn mật khẩu" : "Hiện mật khẩu")}
                >
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Mật khẩu mới */}
            <div className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
              <label htmlFor="newPassword">{translateText("Mật khẩu mới")} <span className="text-rose-500">*</span></label>
              <div className="relative">
                <input
                  id="newPassword"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-800 placeholder-slate-400 shadow-xs transition focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 kp-input"
                  aria-label={translateText("Mật khẩu mới")}
                  placeholder={translateText("Nhập ít nhất 8 ký tự…")}
                  type={showNew ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={passwords.newPassword}
                  onChange={(e) =>
                    setPasswords({ ...passwords, newPassword: e.target.value })
                  }
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  onClick={() => setShowNew(!showNew)}
                  aria-label={translateText(showNew ? "Ẩn mật khẩu" : "Hiện mật khẩu")}
                >
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Xác nhận mật khẩu mới */}
            <div className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
              <label htmlFor="confirmPassword">{translateText("Xác nhận mật khẩu mới")} <span className="text-rose-500">*</span></label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-800 placeholder-slate-400 shadow-xs transition focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 kp-input"
                  aria-label={translateText("Xác nhận mật khẩu mới")}
                  placeholder={translateText("Nhập lại mật khẩu mới…")}
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={passwords.confirmPassword}
                  onChange={(e) =>
                    setPasswords({ ...passwords, confirmPassword: e.target.value })
                  }
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  onClick={() => setShowConfirm(!showConfirm)}
                  aria-label={translateText(showConfirm ? "Ẩn mật khẩu" : "Hiện mật khẩu")}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              className="kp-button primary w-full justify-center py-2.5 font-bold"
              type="submit"
              disabled={action.busy}
            >{translateText("Đổi mật khẩu")}</button>
          </form>
        )}
      </div>
    </Modal>
  );
}
