import React, { useEffect, useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Users,
  UserCheck,
  UserX,
  ChefHat,
  AlertTriangle,
  RotateCcw,
  Download,
  Calendar,
  UtensilsCrossed,
  CheckCircle2,
  Clock,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  Eye,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchSnackServiceRoster, fetchSnackServicesList } from '../api/snackServicesApi';
import {
  RosterItem,
  RosterSummary,
  RosterFilters,
  SnackServiceListItem,
} from '../types/snackServices';

export const SnackServiceRosterPage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [rosterData, setRosterData] = useState<RosterItem[]>([]);
  const [summary, setSummary] = useState<RosterSummary | null>(null);
  const [periodInfo, setPeriodInfo] = useState<{
    id: string;
    periodCode: string;
    snackServiceName: string;
    serviceMonths: string[];
    pricePerUnitPerDay: number;
    status: string;
  } | null>(null);
  const [classesList, setClassesList] = useState<{ id: number; name: string; ageGroup: string }[]>([]);
  const [servicesDropdown, setServicesDropdown] = useState<SnackServiceListItem[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('ALL');

  // UC61: Bộ lọc
  const [filters, setFilters] = useState<RosterFilters>({
    search: '',
    classId: 'ALL',
    ageGroup: 'ALL',
    attendanceStatus: 'ALL',
    portionStatus: 'ALL',
    allergyOnly: false,
  });

  // Tùy chọn nhóm theo Lớp hay Danh sách liên tục
  const [groupByClass, setGroupByClass] = useState<boolean>(true);

  // Load danh sách các gói/đợt cho dropdown
  useEffect(() => {
    fetchSnackServicesList()
      .then((res) => {
        if (res.success && res.data) {
          setServicesDropdown(res.data);
        }
      })
      .catch((err) => console.error('Error fetching services dropdown:', err));
  }, []);

  // UC60: Tải dữ liệu Bảng Phân Công Phục Vụ Ăn Xế (Roster)
  const loadRoster = async () => {
    try {
      setLoading(true);
      const res = await fetchSnackServiceRoster({
        periodId: selectedPeriodId,
        ...filters,
      });

      if (res.success) {
        setRosterData(res.data);
        setSummary(res.summary);
        if (res.period) {
          setPeriodInfo(res.period);
        }
        if (res.classes && res.classes.length > 0) {
          setClassesList(res.classes);
        }
      }
    } catch (err) {
      console.error('Error loading snack roster:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoster();
  }, [selectedPeriodId, filters]);

  const resetFilters = () => {
    setFilters({
      search: '',
      classId: 'ALL',
      ageGroup: 'ALL',
      attendanceStatus: 'ALL',
      portionStatus: 'ALL',
      allergyOnly: false,
    });
  };

  const isFilterActive =
    filters.search !== '' ||
    filters.classId !== 'ALL' ||
    filters.ageGroup !== 'ALL' ||
    filters.attendanceStatus !== 'ALL' ||
    filters.portionStatus !== 'ALL' ||
    filters.allergyOnly;

  const formatVND = (val: number) => {
    return new Intl.NumberFormat('vi-VN').format(val) + ' đ';
  };

  // Group danh sách theo Lớp
  const groupedByClassData = useMemo(() => {
    const groups: Record<string, { className: string; ageGroup: string; items: RosterItem[] }> = {};
    for (const item of rosterData) {
      const key = item.className || 'Khác';
      if (!groups[key]) {
        groups[key] = {
          className: key,
          ageGroup: item.ageGroup,
          items: [],
        };
      }
      groups[key].items.push(item);
    }
    return Object.values(groups);
  }, [rosterData]);

  // Trích xuất danh sách các khối tuổi duy nhất
  const uniqueAgeGroups = useMemo(() => {
    const set = new Set<string>();
    classesList.forEach((c) => {
      if (c.ageGroup) set.add(c.ageGroup);
    });
    return Array.from(set);
  }, [classesList]);

  return (
    <div className="space-y-6 pb-16 font-sans text-slate-800">
      {/* 1. Header & Breadcrumbs Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mb-1">
            <span className="text-teal-600 font-semibold">Đơn vị KidMeal</span>
            <span>›</span>
            <span>Dịch vụ bán trú</span>
            <span>›</span>
            <span className="text-slate-700 font-bold">Bảng phân công ăn xế (Roster)</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center shadow-lg shadow-teal-500/20">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                Bảng Phân Công Phục Vụ Ăn Xế
                <span className="text-[11px] font-bold bg-teal-50 text-teal-700 px-2.5 py-0.5 rounded-full border border-teal-200">
                  UC60 & UC61
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 max-w-3xl">
                Bảng phân công cho Nhà bếp (Kitchen Staff), Ban Giám Hiệu (School Manager) và Giáo viên (Teacher) theo dõi danh sách học sinh đăng ký, khẩu phần chuẩn bị và kiểm soát dị ứng trong ngày.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            to="/services"
            className="px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm flex items-center gap-1.5 transition"
          >
            <UtensilsCrossed className="w-3.5 h-3.5 text-slate-500" />
            Quản lý gói ăn xế
          </Link>
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Xuất danh sách / In
          </button>
          <button
            onClick={loadRoster}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition shadow-sm"
            title="Tải lại dữ liệu"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Đợt Đăng Ký Selector Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 rounded-2xl p-4 sm:p-5 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0 border border-teal-500/30">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider bg-teal-400/20 text-teal-300 px-2 py-0.5 rounded border border-teal-400/30">
                Đợt phục vụ hiện hành
              </span>
              <span className="text-xs text-slate-300 font-medium">
                {periodInfo?.periodCode || 'DOT-2024-11'}
              </span>
            </div>
            <h3 className="text-base font-bold text-white mt-1">
              {periodInfo?.snackServiceName || 'Gói Năng Lượng Chiều'}
            </h3>
            <p className="text-xs text-teal-200/80 mt-0.5">
              Đơn giá tiêu chuẩn: <strong>{formatVND(periodInfo?.pricePerUnitPerDay || 15000)}</strong> / ngày ăn • Chu kỳ:{' '}
              {periodInfo?.serviceMonths?.join(', ') || 'Tháng 11/2024'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Chọn đợt dịch vụ:
            </label>
            <select
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="px-3.5 py-2 bg-slate-800/90 border border-slate-700 text-white rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-400 cursor-pointer"
            >
              <option value="ALL">Đợt đang vận hành (Mặc định)</option>
              {servicesDropdown.map((svc) => (
                <option key={svc.id} value={svc.id}>
                  {svc.name} - {formatVND(svc.pricePerUnit)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3. UC60: 4 Stat Cards Tổng quan Roster */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Tổng đăng ký */}
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Users className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                {summary.totalClasses} lớp học
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Tổng học sinh đăng ký</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">
              {summary.totalRegistered} <span className="text-xs font-semibold text-slate-400">trẻ</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">Toàn bộ danh sách phân bổ</p>
          </div>

          {/* Card 2: Có mặt hôm nay */}
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                <UserCheck className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">
                {summary.totalRegistered > 0
                  ? Math.round((summary.presentToday / summary.totalRegistered) * 100)
                  : 0}
                % có mặt
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Có mặt hôm nay</p>
            <p className="text-2xl font-black text-teal-700 mt-0.5">
              {summary.presentToday}{' '}
              <span className="text-xs font-semibold text-slate-400">/ {summary.totalRegistered}</span>
            </p>
            <p className="text-[11px] text-rose-500 mt-1 font-medium flex items-center gap-1">
              <UserX className="w-3 h-3" /> Vắng mặt: {summary.absentToday} trẻ
            </p>
          </div>

          {/* Card 3: Khẩu phần đã ra bếp */}
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full">
                Khẩu phần bếp
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Đã phục vụ chiều nay</p>
            <p className="text-2xl font-black text-sky-700 mt-0.5">
              {summary.servedCount}{' '}
              <span className="text-xs font-semibold text-slate-400">suất</span>
            </p>
            <p className="text-[11px] text-amber-600 mt-1 font-medium flex items-center gap-1">
              <Clock className="w-3 h-3" /> Đang chuẩn bị: {summary.pendingCount} suất
            </p>
          </div>

          {/* Card 4: Dị ứng cần lưu ý */}
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full">
                Cảnh báo an toàn
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Học sinh có cờ dị ứng</p>
            <p className="text-2xl font-black text-rose-600 mt-0.5">
              {rosterData.filter((i) => i.hasAllergy).length}{' '}
              <span className="text-xs font-semibold text-slate-400">trẻ cần lưu ý</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">Bếp cần chế biến khẩu phần riêng</p>
          </div>
        </div>
      )}

      {/* 4. UC61: Filter Bar đa năng */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Ô tìm kiếm */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo tên học sinh, mã HS (VD: HS-0001, Bảo Nam...)"
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
            />
          </div>

          {/* Các dropdown lọc */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Lọc theo Lớp */}
            <select
              value={filters.classId}
              onChange={(e) => setFilters((prev) => ({ ...prev, classId: e.target.value }))}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="ALL">Tất cả lớp ({classesList.length} lớp)</option>
              {classesList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Lọc theo Khối */}
            {uniqueAgeGroups.length > 0 && (
              <select
                value={filters.ageGroup}
                onChange={(e) => setFilters((prev) => ({ ...prev, ageGroup: e.target.value }))}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              >
                <option value="ALL">Tất cả khối tuổi</option>
                {uniqueAgeGroups.map((g) => (
                  <option key={g} value={g}>
                    Khối {g}
                  </option>
                ))}
              </select>
            )}

            {/* Lọc theo Điểm danh */}
            <select
              value={filters.attendanceStatus}
              onChange={(e) => setFilters((prev) => ({ ...prev, attendanceStatus: e.target.value }))}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="ALL">Tất cả điểm danh</option>
              <option value="PRESENT">Đã có mặt</option>
              <option value="ABSENT">Vắng mặt hôm nay</option>
            </select>

            {/* Lọc theo Khẩu phần */}
            <select
              value={filters.portionStatus}
              onChange={(e) => setFilters((prev) => ({ ...prev, portionStatus: e.target.value }))}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="ALL">Tất cả khẩu phần</option>
              <option value="SERVED">Đã phục vụ</option>
              <option value="PENDING">Đang chờ chuẩn bị</option>
              <option value="SKIPPED">Bỏ qua (vắng)</option>
            </select>

            {/* Toggle Dị ứng */}
            <button
              type="button"
              onClick={() => setFilters((prev) => ({ ...prev, allergyOnly: !prev.allergyOnly }))}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                filters.allergyOnly
                  ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/20'
                  : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Chỉ trẻ dị ứng
            </button>

            {/* Reset button nếu đang có filter */}
            {isFilterActive && (
              <button
                onClick={resetFilters}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
                title="Xóa bộ lọc"
              >
                <RotateCcw className="w-3 h-3" />
                Đặt lại
              </button>
            )}
          </div>
        </div>

        {/* Thanh trạng thái bộ lọc & Chuyển đổi hiển thị */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <Filter className="w-3.5 h-3.5 text-teal-600" />
            <span>
              Kết quả lọc: <strong className="text-slate-900">{rosterData.length}</strong> học sinh
              {summary && ` / ${summary.totalRegistered} học sinh đăng ký`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px] font-medium">Cách hiển thị:</span>
            <button
              onClick={() => setGroupByClass(true)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                groupByClass
                  ? 'bg-teal-50 text-teal-700 border border-teal-200'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              Gom theo Lớp
            </button>
            <button
              onClick={() => setGroupByClass(false)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                !groupByClass
                  ? 'bg-teal-50 text-teal-700 border border-teal-200'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              Danh sách phẳng
            </button>
          </div>
        </div>
      </div>

      {/* 5. UC60: Main Roster Content */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 font-medium text-xs">
            Đang tải danh sách phân công ăn xế từ PostgreSQL Database...
          </div>
        ) : rosterData.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 font-medium text-xs">
            Không tìm thấy học sinh nào phù hợp với điều kiện lọc hiện tại.
          </div>
        ) : groupByClass ? (
          /* Hiển thị Gom theo từng Lớp */
          groupedByClassData.map((group) => {
            const presentCount = group.items.filter((i) => i.attendanceStatus === 'PRESENT').length;
            const servedCount = group.items.filter((i) => i.portionStatus === 'SERVED').length;
            const allergyCount = group.items.filter((i) => i.hasAllergy).length;

            return (
              <div
                key={group.className}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
              >
                {/* Header của Lớp */}
                <div className="px-5 py-3.5 bg-slate-50/90 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-teal-500 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                      {group.className.substring(0, 2)}
                    </span>
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900">{group.className}</h3>
                      <p className="text-[11px] text-slate-500">Khối: {group.ageGroup}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-100">
                      Tổng: {group.items.length} trẻ
                    </span>
                    <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-100">
                      Có mặt: {presentCount}
                    </span>
                    <span className="bg-sky-50 text-sky-700 px-2.5 py-1 rounded-lg border border-sky-100">
                      Đã phục vụ: {servedCount}
                    </span>
                    {allergyCount > 0 && (
                      <span className="bg-rose-50 text-rose-700 px-2.5 py-1 rounded-lg border border-rose-200 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {allergyCount} dị ứng
                      </span>
                    )}
                  </div>
                </div>

                {/* Table của từng lớp */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-white">
                        <th className="py-2.5 px-5">Học sinh & Mã số</th>
                        <th className="py-2.5 px-4">Gói ăn xế</th>
                        <th className="py-2.5 px-4 text-center">Điểm danh</th>
                        <th className="py-2.5 px-4 text-center">Tình trạng khẩu phần</th>
                        <th className="py-2.5 px-4">Cảnh báo dị ứng</th>
                        <th className="py-2.5 px-4 text-center">Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.items.map((item) => (
                        <tr key={item.studentId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-5">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-teal-400 to-indigo-500 text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                                {item.fullName.charAt(0)}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900">{item.fullName}</p>
                                <p className="text-[11px] text-slate-400 font-medium">
                                  {item.studentCode}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <p className="font-semibold text-slate-800">{item.snackServiceName}</p>
                            <p className="text-[10px] text-teal-600 font-bold">
                              {formatVND(item.pricePerDay)} / ngày
                            </p>
                          </td>

                          <td className="py-3 px-4 text-center">
                            {item.attendanceStatus === 'PRESENT' ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 font-extrabold px-2.5 py-0.5 rounded-full text-[10px] border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Có mặt
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 font-extrabold px-2.5 py-0.5 rounded-full text-[10px] border border-rose-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                Vắng mặt
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center">
                            {item.portionStatus === 'SERVED' && (
                              <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-700 font-bold px-2.5 py-0.5 rounded-full text-[10px] border border-sky-200">
                                <CheckCircle2 className="w-3 h-3 text-sky-600" />
                                Đã phục vụ
                              </span>
                            )}
                            {item.portionStatus === 'PENDING' && (
                              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 font-bold px-2.5 py-0.5 rounded-full text-[10px] border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-500" />
                                Đang chờ bếp
                              </span>
                            )}
                            {item.portionStatus === 'SKIPPED' && (
                              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 font-medium px-2.5 py-0.5 rounded-full text-[10px]">
                                Bỏ qua (vắng)
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            {item.hasAllergy ? (
                              <div className="flex flex-wrap gap-1">
                                {item.allergyNames.map((name, idx) => (
                                  <span
                                    key={idx}
                                    className="bg-rose-50 text-rose-700 font-bold text-[10px] px-2 py-0.5 rounded border border-rose-200 flex items-center gap-1"
                                  >
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                    {name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-medium italic">
                                Không có dị ứng
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <button
                              className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition"
                              title="Xem chi tiết học sinh"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        ) : (
          /* Hiển thị Dạng Flat Table */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-5">Học sinh & Mã</th>
                    <th className="py-3 px-4">Lớp & Khối</th>
                    <th className="py-3 px-4">Gói ăn xế</th>
                    <th className="py-3 px-4 text-center">Điểm danh</th>
                    <th className="py-3 px-4 text-center">Tình trạng khẩu phần</th>
                    <th className="py-3 px-4">Cảnh báo dị ứng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rosterData.map((item) => (
                    <tr key={item.studentId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-teal-400 to-indigo-500 text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                            {item.fullName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{item.fullName}</p>
                            <p className="text-[11px] text-slate-400 font-medium">
                              {item.studentCode}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-800">{item.className}</p>
                        <p className="text-[11px] text-slate-400">{item.ageGroup}</p>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-800">{item.snackServiceName}</p>
                        <p className="text-[10px] text-teal-600 font-bold">
                          {formatVND(item.pricePerDay)}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {item.attendanceStatus === 'PRESENT' ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 font-extrabold px-2.5 py-0.5 rounded-full text-[10px] border border-emerald-200">
                            Có mặt
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 font-extrabold px-2.5 py-0.5 rounded-full text-[10px] border border-rose-200">
                            Vắng mặt
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {item.portionStatus === 'SERVED' && (
                          <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-700 font-bold px-2.5 py-0.5 rounded-full text-[10px] border border-sky-200">
                            Đã phục vụ
                          </span>
                        )}
                        {item.portionStatus === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 font-bold px-2.5 py-0.5 rounded-full text-[10px] border border-amber-200">
                            Đang chờ
                          </span>
                        )}
                        {item.portionStatus === 'SKIPPED' && (
                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 font-medium px-2.5 py-0.5 rounded-full text-[10px]">
                            Bỏ qua
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {item.hasAllergy ? (
                          <div className="flex flex-wrap gap-1">
                            {item.allergyNames.map((name, idx) => (
                              <span
                                key={idx}
                                className="bg-rose-50 text-rose-700 font-bold text-[10px] px-2 py-0.5 rounded border border-rose-200 flex items-center gap-1"
                              >
                                <AlertTriangle className="w-2.5 h-2.5" />
                                {name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium italic">
                            Không có dị ứng
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 6. Footer Safety & Operational Notes */}
      <div className="bg-slate-900 rounded-2xl p-5 text-white flex flex-col md:flex-row items-center justify-between gap-4 border border-slate-800 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-white">Quy chuẩn Vận hành Bếp xế & Giáo viên chủ nhiệm</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Học sinh vắng mặt sẽ được tự động hoàn phí hoặc lưu cấn trừ kỳ sau theo cấu hình của gói dịch vụ. Bếp tuyệt đối kiểm tra cờ dị ứng trước khi xuất khẩu phần ra khay lớp.
            </p>
          </div>
        </div>

        <Link
          to="/services"
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-teal-300 rounded-xl text-xs font-bold whitespace-nowrap transition border border-slate-700 flex items-center gap-1.5"
        >
          <span>Quay lại Gói dịch vụ</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};
