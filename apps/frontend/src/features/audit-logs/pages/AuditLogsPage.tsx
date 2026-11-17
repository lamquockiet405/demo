import { t as translateText, getLocale } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  RotateCcw,
  Calendar,
  AlertTriangle,
  Clock,
  User,
  Eye,
  ChevronLeft,
  ChevronRight,
  Activity,
  CheckCircle2,
  Lock,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { auditLogsApi } from '../api/audit-logs.api';
import {
  AuditLogItem,
  AuditLogQuery,
  AuditLogStats,
  AuditLogFilterOptions,
} from '../types/audit-log.types';
import { AuditLogDetailModal } from '../components/AuditLogDetailModal';

export const AuditLogsPage: React.FC = () => {
  useLanguage();
  // State danh sách & phân trang
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [stats, setStats] = useState<AuditLogStats | null>(null);
  const [filterOptions, setFilterOptions] = useState<AuditLogFilterOptions>({
    actions: [],
    targetEntities: [],
    users: [],
  });

  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(false);

  // State các bộ lọc (UC14)
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState('ALL');
  const [selectedEntity, setSelectedEntity] = useState('ALL');
  const [selectedUserId, setSelectedUserId] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Ngoại lệ EX-01: Lỗi khoảng ngày
  const [dateError, setDateError] = useState<string | null>(null);

  // Modal chi tiết log
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Debounce tìm kiếm
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Kiểm tra tính hợp lệ của ngày (EX-01)
  const validateDates = (start: string, end: string): boolean => {
    if (start && end) {
      if (new Date(start) > new Date(end)) {
        setDateError('Ngày bắt đầu không được lớn hơn ngày kết thúc (EX-01)');
        return false;
      }
    }
    setDateError(null);
    return true;
  };

  // Tải dữ liệu Options và Stats khi mount
  useEffect(() => {
    auditLogsApi
      .getFilterOptions()
      .then((opts) => setFilterOptions(opts))
      .catch((err) => console.error('Lỗi tải filter options:', err));

    auditLogsApi
      .getStats()
      .then((s) => setStats(s))
      .catch((err) => console.error('Lỗi tải thống kê:', err));
  }, []);

  // Tải danh sách audit logs
  const fetchLogs = useCallback(async () => {
    if (startDate && endDate && !validateDates(startDate, endDate)) {
      return;
    }

    setIsLoading(true);
    try {
      const queryParams: AuditLogQuery = {
        page: currentPage,
        limit: pageSize,
      };

      if (debouncedSearch.trim()) queryParams.search = debouncedSearch.trim();
      if (selectedAction !== 'ALL') queryParams.action = selectedAction;
      if (selectedEntity !== 'ALL') queryParams.targetEntity = selectedEntity;
      if (selectedUserId !== 'ALL') queryParams.userId = selectedUserId;
      if (startDate) queryParams.startDate = startDate;
      if (endDate) queryParams.endDate = endDate;

      const res = await auditLogsApi.getAuditLogs(queryParams);
      setLogs(res.items || []);
      setTotalCount(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      console.error('Lỗi tải audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, debouncedSearch, selectedAction, selectedEntity, selectedUserId, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Xử lý Reset bộ lọc (Luồng phụ A.1)
  const handleResetFilters = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setSelectedAction('ALL');
    setSelectedEntity('ALL');
    setSelectedUserId('ALL');
    setStartDate('');
    setEndDate('');
    setDateError(null);
    setCurrentPage(1);
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    validateDates(val, endDate);
    setCurrentPage(1);
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    validateDates(startDate, val);
    setCurrentPage(1);
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      if (diffMinutes < 1) return 'Vừa xong';
      if (diffMinutes < 60) return `${diffMinutes} phút trước`;
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `${diffHours} giờ trước`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} ngày trước`;
    } catch {
      return isoString;
    }
  };

  const getActionBadge = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('DELETE') || act.includes('REMOVE') || act.includes('REJECT')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          {translateText(action)}
        </span>
      );
    }
    if (act.includes('APPROVE') || act.includes('SUCCESS') || act.includes('CREATE')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          {translateText(action)}
        </span>
      );
    }
    if (act.includes('OVERRIDE') || act.includes('ALLERGY') || act.includes('SECURITY')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle className="w-3 h-3 text-amber-600" />
          {translateText(action)}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
        {translateText(action)}
      </span>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full space-y-6">
      {/* 1. Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-600 shadow-inner">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{translateText("Nhật ký Kiểm toán & Truy vết Hệ thống")}</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">{translateText("Theo dõi, giám sát các hoạt động nhạy cảm (dị ứng, thể lực WHO, thực đơn, kiểm thực bếp) theo chuẩn an toàn thông tin")}</p>
        </div>

        <button
          onClick={() => {
            fetchLogs();
            auditLogsApi.getStats().then((s) => setStats(s));
          }}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />{translateText("Làm mới")}</button>
      </div>

      {/* 2. Thống kê nhanh (Stats Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{translateText("Tổng số sự kiện")}</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{stats?.totalLogs ?? totalCount}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">{translateText("Toàn bộ lịch sử")}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{translateText("Hoạt động hôm nay")}</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">{stats?.todayLogs ?? 0}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">{translateText("Sự kiện 24 giờ qua")}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{translateText("Thao tác nhạy cảm")}</p>
            <h3 className="text-2xl font-black text-amber-600 mt-1">{stats?.sensitiveCount ?? 0}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">{translateText("Dị ứng, thể lực, phê duyệt")}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{translateText("Tác nhân hoạt động")}</p>
            <h3 className="text-2xl font-black text-indigo-600 mt-1">{stats?.activeUsersCount ?? 0}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">{translateText("Nhân sự & Phụ huynh")}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <User className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. Khung Tìm kiếm & Bộ lọc nâng cao (UC14) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Filter className="w-4 h-4 text-teal-600" />{translateText(" Bộ lọc kiểm toán đa chiều")}</div>
          <button
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-teal-600 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />{translateText(" Đặt lại mặc định")}</button>
        </div>

        {/* Cảnh báo khoảng ngày không hợp lệ (EX-01) */}
        {dateError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{translateText(dateError)}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
          {/* Search box */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={translateText("Tìm theo email, tên, ghi chú...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-800 placeholder:text-slate-400"
            />
          </div>

          {/* Action Filter */}
          <div>
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-800"
            >
              <option value="ALL">{translateText("Tất cả hành động")}</option>
              {filterOptions.actions.map((act) => (
                <option key={act} value={act}>
                  {translateText(act)}
                </option>
              ))}
            </select>
          </div>

          {/* Target Entity Filter */}
          <div>
            <select
              value={selectedEntity}
              onChange={(e) => {
                setSelectedEntity(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-800"
            >
              <option value="ALL">{translateText("Tất cả thực thể")}</option>
              {filterOptions.targetEntities.map((ent) => (
                <option key={ent} value={ent}>
                  {translateText(ent)}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range: From Date */}
          <div className="relative">
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              title={translateText("Từ ngày")}
              className={`w-full px-3 py-2 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-slate-800 ${
                dateError ? 'border-rose-300 ring-rose-200' : 'border-slate-200 focus:border-teal-500'
              }`}
            />
          </div>

          {/* Date Range: To Date */}
          <div className="relative">
            <input
              type="date"
              value={endDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
              title={translateText("Đến ngày")}
              className={`w-full px-3 py-2 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-slate-800 ${
                dateError ? 'border-rose-300 ring-rose-200' : 'border-slate-200 focus:border-teal-500'
              }`}
            />
          </div>
        </div>
      </div>

      {/* 4. Bảng Danh sách Nhật ký (UC13) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">{translateText("Thời gian")}</th>
                <th className="py-3 px-4">{translateText("Tác nhân (Actor)")}</th>
                <th className="py-3 px-4">{translateText("Hành động")}</th>
                <th className="py-3 px-4">{translateText("Đối tượng tác động")}</th>
                <th className="py-3 px-4 text-right">{translateText("Chi tiết")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-600 mb-2" />{translateText("Đang tải nhật ký kiểm toán...")}</td>
                </tr>
              ) : logs.length === 0 ? (
                /* Ngoại lệ EX-02: Không có dữ liệu phù hợp bộ lọc */
                <tr>
                  <td colSpan={5} className="py-14 text-center">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                        <Search className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-800">{translateText("Không tìm thấy bản ghi kiểm toán phù hợp")}</h4>
                      <p className="text-xs text-slate-500">{translateText("Không có sự kiện nào khớp với tiêu chí tìm kiếm hoặc khoảng thời gian bạn đã chọn.")}</p>
                      <button
                        onClick={handleResetFilters}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-50 text-teal-700 hover:bg-teal-100 font-semibold text-xs transition"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />{translateText(" Đặt lại toàn bộ bộ lọc")}</button>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition">
                    {/* Thời gian */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {translateText(formatRelativeTime(log.createdAt))}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {translateText(new Date(log.createdAt).toLocaleDateString(getLocale()))} {translateText(new Date(log.createdAt).toLocaleTimeString(getLocale()))}
                      </div>
                    </td>

                    {/* Tác nhân */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-800">
                        {log.userName || translateText('Tài khoản hệ thống')}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {log.userEmail || translateText('N/A')}
                      </div>
                      {log.userRole && (
                        <span className="inline-block mt-0.5 text-[10px] px-1.5 py-0.2 rounded font-semibold bg-slate-100 text-slate-600">
                          {translateText(log.userRole)}
                        </span>
                      )}
                    </td>

                    {/* Hành động */}
                    <td className="py-3.5 px-4">
                      {getActionBadge(log.action)}
                    </td>

                    {/* Đối tượng tác động */}
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-semibold text-slate-700">
                        {translateText(log.targetEntity || 'HỆ THỐNG')}
                      </span>
                      {log.targetId && (
                        <span className="ml-1 text-[11px] text-slate-400 font-mono">
                          #{translateText(log.targetId)}
                        </span>
                      )}
                    </td>

                    {/* Thao tác Xem chi tiết */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedLog(log);
                          setIsDetailModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 transition"
                      >
                        <Eye className="w-3.5 h-3.5" />{translateText(" Xem")}</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang (Pagination) */}
        {!isLoading && logs.length > 0 && (
          <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>{translateText("Hiển thị ")}<span className="font-semibold text-slate-800">{(currentPage - 1) * pageSize + 1}</span>{translateText(" đến")}{' '}
              <span className="font-semibold text-slate-800">
                {Math.min(currentPage * pageSize, totalCount)}
              </span>{' '}{translateText("trong tổng số ")}<span className="font-bold text-slate-800">{totalCount}</span>{translateText(" sự kiện")}</div>

            <div className="flex items-center gap-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold px-2 text-slate-700">{translateText("Trang ")}{currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="ml-2 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none"
              >
                <option value={10}>{translateText("10 dòng/trang")}</option>
                <option value={20}>{translateText("20 dòng/trang")}</option>
                <option value={50}>{translateText("50 dòng/trang")}</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 5. Modal Chi tiết Nhật ký */}
      <AuditLogDetailModal
        log={selectedLog}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedLog(null);
        }}
      />
    </div>
  );
};

