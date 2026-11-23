import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React from 'react';
import { ShieldCheck, FileCheck2, TrendingUp, Download, ChevronRight, Home } from 'lucide-react';

interface HistoryHeaderProps {
  classNameTitle?: string;
  academicYear?: string;
  teachers?: string[];
  onOpenTrend?: () => void;
  onOpenExport?: () => void;
}

export const HistoryHeader: React.FC<HistoryHeaderProps> = () => {
  return null;
};
