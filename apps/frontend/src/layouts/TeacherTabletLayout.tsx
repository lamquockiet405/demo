import React from 'react';
import { Outlet } from 'react-router-dom';

export const TeacherTabletLayout: React.FC = () => (
  <div className="min-h-screen bg-slate-100 font-sans text-slate-800"><Outlet /></div>
);
