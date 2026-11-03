import React from 'react';
import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store';

export const LogoutButton: React.FC<{ className?: string }> = ({ className = 'text-slate-500 hover:bg-rose-50 hover:text-rose-700' }) => {
  const logout = useAuthStore(state => state.logout);
  const navigate = useNavigate();
  return (
    <button type="button" title="Đăng xuất" aria-label="Đăng xuất" onClick={() => { logout(); navigate('/home', { replace: true }); }}
      className={`inline-flex shrink-0 items-center gap-2 rounded-xl p-2.5 text-xs font-semibold transition ${className}`}>
      <LogOut className="h-4 w-4" /><span className="hidden sm:inline">Đăng xuất</span>
    </button>
  );
};
