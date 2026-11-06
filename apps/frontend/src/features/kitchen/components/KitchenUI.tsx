import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, RefreshCw, X } from "lucide-react";

export function errorText(error: any) {
  if (error?.response?.status === 403)
    return "Tài khoản chưa được cấp quyền thực hiện thao tác này.";
  if (error?.response?.status === 413)
    return "Ảnh hoặc nội dung quá lớn. Vui lòng chọn ảnh khác.";
  if (error?.response?.status >= 500)
    return "Dịch vụ đang gặp lỗi. Chưa thể tải hoặc lưu dữ liệu; vui lòng thử lại sau.";
  const message = error?.response?.data?.message;
  return Array.isArray(message)
    ? message.join(". ")
    : typeof message === "string"
      ? message
      : error instanceof Error && !error.message.startsWith("Request failed")
        ? error.message
        : "Không thực hiện được yêu cầu. Vui lòng thử lại.";
}

export function useKitchenResource<T>(
  loader: () => Promise<T>,
  dependencies: React.DependencyList,
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const request = useRef(0);
  const reload = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    setError("");
    try {
      const next = await loader();
      if (id === request.current) setData(next);
    } catch (failure) {
      if (id === request.current) {
        setData(null);
        setError(errorText(failure));
      }
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, dependencies);
  useEffect(() => {
    setData(null);
    void reload();
    return () => {
      request.current++;
    };
  }, [reload]);
  return { data, setData, loading, error, reload };
}

export function useKitchenAction() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const run = async (
    work: () => Promise<void>,
    success = "Đã lưu thành công.",
  ) => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
      setMessage(success);
      return true;
    } catch (failure) {
      setError(errorText(failure));
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return { busy, message, error, run };
}

export function PageTitle({
  title,
  description,
  children,
  eyebrow = "BẾP BÁN TRÚ",
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
  eyebrow?: string;
}) {
  useLanguage();
  return (
    <div className="kp-page-title">
      <div>
        <span className="kp-eyebrow">{translateText(eyebrow)}</span>
        <h1>{translateText(title)}</h1>
        <p>{translateText(description)}</p>
      </div>
      <div className="kp-actions">{children}</div>
    </div>
  );
}
export function Notice({
  error,
  message,
}: {
  error?: string;
  message?: string;
}) {
  useLanguage();
  if (!error && !message) return null;
  return (
    <div
      className={`kp-notice ${error ? "error" : "success"}`}
      role={error ? "alert" : "status"}
    >
      {error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
      <span>{translateText(error || message)}</span>
    </div>
  );
}
export function ResourceState({
  resource,
  empty,
}: {
  resource: { loading: boolean; error: string; reload: () => Promise<void> };
  empty?: boolean;
}) {
  useLanguage();
  return (
    <>
      {resource.error && <Notice error={resource.error} />}
      {resource.loading ? (
        <p className="kp-empty" role="status">{translateText("Đang tải dữ liệu…")}</p>
      ) : empty && !resource.error ? (
        <p className="kp-empty">{translateText("Không có dữ liệu phù hợp với bộ lọc.")}</p>
      ) : null}
    </>
  );
}
export function ReloadButton({
  loading,
  reload,
}: {
  loading: boolean;
  reload: () => Promise<void>;
}) {
  useLanguage();
  return (
    <button
      className="kp-button"
      disabled={loading}
      onClick={() => void reload()}
    >
      <RefreshCw size={15} className={loading ? "animate-spin" : ""} />{translateText("Làm mới")}</button>
  );
}
export function Pager({
  page,
  total,
  limit = 12,
  onChange,
}: {
  page: number;
  total: number;
  limit?: number;
  onChange: (page: number) => void;
}) {
  useLanguage();
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="kp-pager">
      <span>
        {total}{translateText(" kết quả · Trang ")}{page}/{pages}
      </span>
      <button
        className="kp-button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >{translateText("Trước")}</button>
      <button
        className="kp-button"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >{translateText("Sau")}</button>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => {
      dialog.current?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      className="kp-modal"
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      aria-label={translateText(title)}
    >
      <div className="kp-modal-header">
        <h2>{translateText(title)}</h2>
        <button
          className="kp-button icon"
          disabled={busy}
          aria-label={translateText("Đóng cửa sổ")}
          onClick={onClose}
        >
          <X size={19} />
        </button>
      </div>
      <div className="kp-modal-body">{children}</div>
    </dialog>
  );
}
