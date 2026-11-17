import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React from "react";
import { Baby, AlertTriangle } from "lucide-react";
import { ChildProfile } from "../types";

interface ChildInfoStripProps {
  child: ChildProfile;
}

export const ChildInfoStrip: React.FC<ChildInfoStripProps> = ({ child }) => {
  useLanguage();
  return (
    <div className="bg-[#eef6fc] border-b border-sky-100 py-2.5 px-4 text-xs">
      <div className="w-full px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3">
        {/* Left Child Metrics */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-slate-700">
          <div className="flex items-center gap-1.5 font-bold text-sky-900">
            <Baby className="w-4 h-4 text-sky-600" />
            <span>
              {child.name || translateText("Hồ sơ của bé")}{translateText(child.age ? ` (${child.age} tuổi)` : "")}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">{translateText("Lớp:")}</span>
            <span className="font-semibold text-slate-800">
              {child.className || translateText("Chưa phân lớp")}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">{translateText("Cân nặng:")}</span>
            <span className="font-semibold text-slate-800">
              {translateText(child.weight !== undefined && child.weight !== null ? `${child.weight} kg` : "—")}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">{translateText("Chiều cao:")}</span>
            <span className="font-semibold text-slate-800">
              {translateText(child.height !== undefined && child.height !== null ? `${child.height} cm` : "—")}
            </span>
          </div>
        </div>

        {/* Right Allergy Alert Badge */}
        {child.allergyWarning && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded-full font-bold text-xs tracking-tight animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
            <span>{translateText(child.allergyWarning)}</span>
          </div>
        )}
      </div>
    </div>
  );
};
