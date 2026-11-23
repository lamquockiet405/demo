import { t as translateText } from '../../core/i18n/language';
import { useLanguage } from '../../core/i18n/useLanguage';
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  RotateCw,
  ChefHat,
  MessageSquarePlus,
  Sparkles,
  Info,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { AttendanceTopNav } from './components/AttendanceTopNav';
import { AttendanceSubTabs } from './components/AttendanceSubTabs';
import { CoordinationKPIStrip } from './components/CoordinationKPIStrip';
import { CoordinationFilterBar } from './components/CoordinationFilterBar';
import { CoordinationNotesList } from './components/CoordinationNotesList';
import { CreateEditCoordinationNoteModal } from './components/CreateEditCoordinationNoteModal';
import { coordinationApi } from './api/coordinationApi';
import {
  MealCoordinationData,
  CoordinationQueryParams,
  CoordinationNoteItem,
  CreateCoordinationNotePayload,
  UpdateCoordinationNotePayload,
} from './types';

interface MealCoordinationNotesPageProps {
  onTabChange?: (tab: string) => void;
}

export const MealCoordinationNotesPage: React.FC<MealCoordinationNotesPageProps> = ({ onTabChange }) => {
  useLanguage();
  const navigate = useNavigate();

  const [data, setData] = useState<MealCoordinationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [filters, setFilters] = useState<CoordinationQueryParams>({
    mealSession: 'ALL',
    status: 'ALL',
    priority: 'ALL',
    noteType: 'ALL',
    search: '',
  });

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [noteToEdit, setNoteToEdit] = useState<CoordinationNoteItem | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const loadData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setIsLoading(true);
      else setIsRefreshing(true);

      const res = await coordinationApi.getCoordinationNotes(filters);
      setData(res);
    } catch (err: any) {
      console.error('Lỗi khi tải dữ liệu ghi chú điều phối:', err);
      showToast('Không thể tải dữ liệu điều phối từ server', 'error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFilterChange = (newFilters: Partial<CoordinationQueryParams>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const handleResetFilters = () => {
    setFilters({
      mealSession: 'ALL',
      status: 'ALL',
      priority: 'ALL',
      noteType: 'ALL',
      search: '',
      classId: undefined,
      date: undefined,
    });
  };

  const handleTabChange = (tabId: string) => {
    if (onTabChange) {
      onTabChange(tabId);
      return;
    }
    if (tabId === 'notes') navigate('/tablet?tab=notes');
    else if (tabId === 'attendance') navigate('/tablet');
    else if (tabId === 'evaluation') navigate('/tablet/record');
    else if (tabId === 'history') navigate('/tablet?tab=history');
  };

  // Handlers for Note CRUD
  const handleSaveNote = async (
    payload: CreateCoordinationNotePayload | UpdateCoordinationNotePayload,
    noteId?: string,
  ) => {
    if (noteId) {
      await coordinationApi.updateCoordinationNote(noteId, payload as UpdateCoordinationNotePayload);
      showToast('Đã cập nhật ghi chú điều phối thành công!');
    } else {
      await coordinationApi.createCoordinationNote(payload as CreateCoordinationNotePayload);
      showToast('Đã tạo mới và đồng bộ ghi chú điều phối đến Nhà Bếp!');
    }
    await loadData(true);
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm(translateText('Bạn có chắc chắn muốn xóa ghi chú điều phối này? Dữ liệu sẽ được gỡ khỏi cơ sở dữ liệu.'))) {
      return;
    }
    try {
      await coordinationApi.deleteCoordinationNote(noteId);
      showToast('Đã xóa ghi chú điều phối thành công!');
      await loadData(true);
    } catch (err: any) {
      showToast('Lỗi khi xóa ghi chú: ' + err.message, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 animate-in slide-in-from-top duration-300">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 text-xs font-bold ${
              toastMessage.type === 'success'
                ? 'bg-emerald-900/90 text-white border-emerald-500 backdrop-blur-md'
                : 'bg-red-900/90 text-white border-red-500 backdrop-blur-md'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{translateText(toastMessage.text)}</span>
          </div>
        </div>
      )}

      {/* 1. Top Navigation Bar */}
      <AttendanceTopNav onSearch={(q) => handleFilterChange({ search: q })} />

      {/* 2. Sub Navigation Tabs: notes is ACTIVE */}
      <AttendanceSubTabs activeTab="notes" onTabChange={handleTabChange} />

      {/* 3. Main Content Container */}
      <main className="flex-1 w-full px-4 sm:px-6 py-6 space-y-6">
        {/* KPI Strip */}
        <CoordinationKPIStrip
          summary={
            data?.summary || {
              totalNotes: 0,
              urgentCount: 0,
              highCount: 0,
              pendingCount: 0,
              acknowledgedCount: 0,
              resolvedCount: 0,
            }
          }
          filterDate={data?.filterDate || new Date().toISOString().split('T')[0]}
        />

        {/* Filter Toolbar with Actions */}
        <CoordinationFilterBar
          filters={filters}
          onFilterChange={handleFilterChange}
          onResetFilters={handleResetFilters}
          availableClasses={data?.availableClasses || []}
          onRefresh={() => loadData(true)}
          isRefreshing={isRefreshing}
          onCreateNote={() => {
            setNoteToEdit(null);
            setIsCreateModalOpen(true);
          }}
        />

        {/* 6. Notes List */}
        <CoordinationNotesList
          notes={data?.notes || []}
          isLoading={isLoading}
          onEditNote={(note) => {
            setNoteToEdit(note);
            setIsCreateModalOpen(true);
          }}
          onDeleteNote={handleDeleteNote}
        />
      </main>

      {/* Modals */}
      <CreateEditCoordinationNoteModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setNoteToEdit(null);
        }}
        noteToEdit={noteToEdit}
        selectedClassId={data?.selectedClass.id || ''}
        availableClasses={data?.availableClasses || []}
        availableChildren={data?.availableChildren || []}
        onSave={handleSaveNote}
      />
    </div>
  );
};
