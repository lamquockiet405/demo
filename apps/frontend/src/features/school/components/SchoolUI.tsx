import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React from "react";
export {
  Modal,
  errorText,
  useKitchenResource as useSchoolResource,
  useKitchenAction as useSchoolAction,
} from "../../kitchen/components/KitchenUI";
import "../../kitchen/kitchen-portal.css";

export function SchoolPage({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  useLanguage();
  return (
    <section
      className="school-page space-y-5"
      style={
        {
          "--kp-border": "#dfe7ed",
          "--kp-green": "#157454",
        } as React.CSSProperties
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{translateText(title)}</h1>
          <p className="text-sm text-slate-500 mt-2">{translateText(description)}</p>
        </div>
        <div className="flex gap-2 flex-wrap">{translateText(actions)}</div>
      </div>
      {children}
    </section>
  );
}
export function Feedback({
  error,
  message,
}: {
  error?: string;
  message?: string;
}) {
  useLanguage();
  return error || message ? (
    <div
      role={error ? "alert" : "status"}
      className={`p-4 rounded-xl text-sm ${error ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}
    >
      {translateText(error || message)}
    </div>
  ) : null;
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  useLanguage();
  return (
    <label className="kp-field">
      {translateText(label)}
      {children}
    </label>
  );
}
export function State({
  resource,
  empty,
}: {
  resource: { loading: boolean; error: string };
  empty?: boolean;
}) {
  useLanguage();
  return (
    <>
      <Feedback error={resource.error} />
      {resource.loading ? (
        <p role="status" className="p-6 text-slate-500">{translateText("Đang tải dữ liệu…")}</p>
      ) : empty && !resource.error ? (
        <p className="p-6 text-slate-500">{translateText("Không có dữ liệu phù hợp.")}</p>
      ) : null}
    </>
  );
}
