import React, { useEffect, useState } from "react";
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
    <Modal title="Tài khoản cá nhân" onClose={() => !action.busy && onClose()}>
      <div className="space-y-4">
        <div className="kp-tabs">
          <button
            className={tab === "profile" ? "active" : ""}
            onClick={() => setTab("profile")}
          >
            Hồ sơ cá nhân
          </button>
          <button
            className={tab === "password" ? "active" : ""}
            onClick={() => setTab("password")}
          >
            Đổi mật khẩu
          </button>
        </div>
        <Notice error={loadError || action.error} message={action.message} />
        {loading && <p role="status">Đang tải hồ sơ...</p>}
        {tab === "profile" && profile && (
          <form className="space-y-4" onSubmit={save}>
            <p>{profile.email}</p>
            <label className="kp-field">
              Họ tên
              <input
                aria-label="Họ tên tài khoản"
                required
                maxLength={150}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </label>
            <label className="kp-field">
              Số điện thoại
              <input
                aria-label="Số điện thoại tài khoản"
                maxLength={20}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
            <label className="kp-field">
              Đường dẫn ảnh đại diện
              <input
                aria-label="Đường dẫn ảnh đại diện"
                maxLength={500}
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
              />
            </label>
            <button
              type="submit"
              className="kp-button primary"
              disabled={action.busy}
            >
              Lưu hồ sơ cá nhân
            </button>
          </form>
        )}
        {tab === "password" && (
          <form className="space-y-4" onSubmit={change}>
            {[
              ["currentPassword", "Mật khẩu hiện tại"],
              ["newPassword", "Mật khẩu mới"],
              ["confirmPassword", "Xác nhận mật khẩu mới"],
            ].map(([key, label]) => (
              <label key={key} className="kp-field">
                {label}
                <input
                  aria-label={label}
                  type="password"
                  autoComplete={
                    key === "currentPassword"
                      ? "current-password"
                      : "new-password"
                  }
                  required
                  minLength={key === "currentPassword" ? undefined : 8}
                  value={passwords[key as keyof typeof passwords]}
                  onChange={(e) =>
                    setPasswords({ ...passwords, [key]: e.target.value })
                  }
                />
              </label>
            ))}
            <button
              className="kp-button primary"
              type="submit"
              disabled={action.busy}
            >
              Đổi mật khẩu
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}
