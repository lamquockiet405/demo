import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React from 'react';
import { ChevronRight, FileText, Send, Radio } from 'lucide-react';

interface AttendanceHeaderProps {
  classNameTitle?: string;
  cutoffTime?: string;
  onExportReport?: () => void;
  onLockAndSendKitchen?: () => void;
  isLocked?: boolean;
}

export const AttendanceHeader: React.FC<AttendanceHeaderProps> = () => {
  return null;
};
