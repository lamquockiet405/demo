import { useLanguage } from '../core/i18n/useLanguage';
import React from 'react';
import { Outlet } from 'react-router-dom';

export const TeacherTabletLayout: React.FC = () => { useLanguage(); return (
  <div className="min-h-screen bg-slate-100 font-sans text-slate-800"><Outlet /></div>
); };
