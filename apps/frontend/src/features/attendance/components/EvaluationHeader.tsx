import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React from 'react';
import { Send, FileText, ChevronRight, Sparkles, CheckCircle2 } from 'lucide-react';

interface EvaluationHeaderProps {
  classNameTitle?: string;
  isSavingDraft?: boolean;
  isSubmitting?: boolean;
  onSaveDraft?: () => void;
  onSubmitReport?: () => void;
}

export const EvaluationHeader: React.FC<EvaluationHeaderProps> = () => {
  return null;
};
