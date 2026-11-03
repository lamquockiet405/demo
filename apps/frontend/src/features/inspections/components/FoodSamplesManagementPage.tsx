import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '@/core/stores/auth.store';
import { apiClient } from '@/core/api/axios';
import {
  Refrigerator,
  CheckCircle,
  Clock,
  AlertTriangle,
  Search,
  RefreshCw,
  QrCode,
  Printer,
  ShieldCheck,
  Calendar,
  Lock,
  Trash2,
  X,
  FileText,
  User,
  ExternalLink,
} from 'lucide-react';

export interface FoodSample {
  id: string;
  code: string;
  sampleCode: string;
  dishName: string;
  date: string;
  mealDate: string;
  mealSession?: string;
  storedAt: string | null;
  disposeAt: string | null;
  status: 'STORED' | 'DISPOSED' | string;
  sampleWeight?: number;
  storageTemp?: number;
  temperatureC?: number;
  fridgeUnit?: string;
  collectorName?: string;
  countdownHours?: number;
  note?: string;
}

export const FoodSamplesManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const roles = user?.roles || [];

  // Phân quyền: Nhà bếp có quyền hủy mẫu, Hiệu trưởng & Dinh dưỡng chỉ xem
  const isKitchenStaff =
    roles.includes('KITCHEN_STAFF') ||
    roles.includes('KITCHEN_MANAGER') ||
    roles.includes('SUPER_ADMIN');
  const isNutritionist = roles.includes('NUTRITIONIST');
  const isPrincipal =
    roles.includes('PRINCIPAL') ||
    roles.includes('SCHOOL_MANAGEMENT') ||
    roles.includes('SCHOOL_MANAGER');

  const [samples, setSamples] = useState<FoodSample[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'STORED_ACTIVE' | 'STORED_EXPIRED' | 'DISPOSED'>('ALL');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedSample, setSelectedSample] = useState<FoodSample | null>(null);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [nowTime, setNowTime] = useState<number>(Date.now());

  // Cập nhật đồng hồ mỗi giây để tính đếm ngược live
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchSamples = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/inspections/samples');
      const data = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
        ? res.data.data
        : [];
      setSamples(data);
    } catch (error) {
      console.error('Failed to load food samples from database:', error);
      setSamples([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSamples();
  }, []);

  // Tính toán thời gian lưu còn lại của mẫu
  const getSampleTiming = (sample: FoodSample) => {
    if (!sample.storedAt) {
      return { is24hPassed: true, remainingMs: 0, text: 'Đã quá 24h' };
    }
    const stored = new Date(sample.storedAt).getTime();
    const expires = stored + 24 * 60 * 60 * 1000;
    const diff = expires - nowTime;

    if (diff <= 0) {
      return { is24hPassed: true, remainingMs: 0, text: '00:00:00 (Đã đủ 24h)' };
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff / (1000 * 60)) % 60);
    const secs = Math.floor((diff / 1000) % 60);
    return {
      is24hPassed: false,
      remainingMs: diff,
      text: `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
    };
  };

  // Thao tác tiêu hủy mẫu (chỉ dành cho nhà bếp)
  const handleDispose = async (sample: FoodSample) => {
    if (!isKitchenStaff) {
      alert('Chỉ nhân viên nhà bếp mới có quyền thực hiện thao tác tiêu hủy mẫu thức ăn đã lưu.');
      return;
    }

    const timing = getSampleTiming(sample);
    if (!timing.is24hPassed) {
      alert('⚠️ Chưa đủ 24 giờ lưu mẫu theo quy chuẩn Bộ Y Tế (QĐ 1246/QĐ-BYT). Mẫu thức ăn chỉ được phép tiêu hủy sau khi hoàn thành thời gian lưu giữ tối thiểu 24 giờ!');
      return;
    }

    if (!window.confirm(`Xác nhận đã tiêu hủy mẫu thức ăn "${sample.dishName}" (${sample.sampleCode}) an toàn sau 24 giờ theo quy chuẩn Bộ Y Tế?`)) {
      return;
    }

    try {
      await apiClient.patch(`/inspections/samples/${sample.id}/dispose`);
      alert(`✅ Đã xác nhận tiêu hủy an toàn mẫu "${sample.dishName}" thành công!`);
      fetchSamples();
    } catch (error: any) {
      try {
        await apiClient.post(`/inspections/samples/${sample.id}/dispose`);
        alert(`✅ Đã xác nhận tiêu hủy an toàn mẫu "${sample.dishName}" thành công!`);
        fetchSamples();
      } catch (err2: any) {
        alert('Lỗi khi tiêu hủy mẫu: ' + (err2.response?.data?.message || err2.message));
      }
    }
  };

  const handleOpenLabel = (sample: FoodSample) => {
    setSelectedSample(sample);
    setIsLabelModalOpen(true);
  };

  const handlePrint = () => {
    window.print();
  };

  // Lọc danh sách
  const filteredSamples = samples.filter((s) => {
    const timing = getSampleTiming(s);
    const matchesSearch =
      (s.dishName || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.sampleCode || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.collectorName || '').toLowerCase().includes(search.toLowerCase());

    const matchesDate = !dateFilter || (s.date && s.date.startsWith(dateFilter));

    let matchesStatus = true;
    if (statusFilter === 'DISPOSED') {
      matchesStatus = s.status === 'DISPOSED';
    } else if (statusFilter === 'STORED_EXPIRED') {
      matchesStatus = s.status !== 'DISPOSED' && timing.is24hPassed;
    } else if (statusFilter === 'STORED_ACTIVE') {
      matchesStatus = s.status !== 'DISPOSED' && !timing.is24hPassed;
    }

    return matchesSearch && matchesDate && matchesStatus;
  });

  // Thống kê thẻ KPI
  const totalCount = samples.length;
  const activeCount = samples.filter((s) => s.status !== 'DISPOSED' && !getSampleTiming(s).is24hPassed).length;
  const expiredCount = samples.filter((s) => s.status !== 'DISPOSED' && getSampleTiming(s).is24hPassed).length;
  const disposedCount = samples.filter((s) => s.status === 'DISPOSED').length;

  // Xác định đường dẫn trang Kiểm Thực 3 Bước tương ứng để chuyển tab
  const getInspectionTabUrl = () => {
    if (location.pathname.startsWith('/kitchen')) return '/kitchen/inspections';
    if (location.pathname.startsWith('/nutritionist')) return '/nutritionist/food-safety';
    return '/food-safety';
  };

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      {/* ─── HEADER BAR ─── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-100 text-blue-700 rounded-2xl shadow-sm">
              <Refrigerator className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                Sổ Theo Dõi Lưu Mẫu Thức Ăn 24 Giờ
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Quy chuẩn Bộ Y Tế — QĐ 1246/QĐ-BYT • Niên khóa 2026 - 2027 • Tủ bảo quản 0°C - 5°C
              </p>
            </div>
          </div>
        </div>

        {/* Role Badge Indicator */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 shadow-sm bg-white border-slate-200">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span className="text-slate-600">Vai trò:</span>
            {isKitchenStaff ? (
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                Nhà Bếp (Có quyền tiêu hủy)
              </span>
            ) : isNutritionist ? (
              <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                Chuyên Gia Dinh Dưỡng (Chỉ xem)
              </span>
            ) : (
              <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                Ban Giám Hiệu (Giám sát)
              </span>
            )}
          </div>

          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition flex items-center gap-1.5 shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Xuất sổ (PDF)</span>
          </button>
        </div>
      </div>

      {/* ─── TAB NAVIGATION: SỔ KIỂM THỰC 3 BƯỚC <-> SỔ LƯU MẪU 24H ─── */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-6 overflow-x-auto scrollbar-none">
        <Link
          to={getInspectionTabUrl()}
          className="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Sổ Kiểm Thực Ba Bước (QĐ 1246)</span>
        </Link>
        <button
          className="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 bg-blue-600 text-white shadow-sm"
        >
          <Refrigerator className="w-4 h-4" />
          <span>Sổ Lưu Mẫu Thức Ăn 24 Giờ</span>
          <span className="bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
            {samples.length}
          </span>
        </button>
      </div>

      {/* ─── KPI SUMMARY CARDS ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase">Tổng số mẫu lưu</p>
            <p className="text-xl font-black text-slate-800">{totalCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-blue-600 uppercase">Đang lưu (Trong 24h)</p>
            <p className="text-xl font-black text-blue-700">{activeCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-amber-600 uppercase">Đã đủ 24h (Chờ hủy)</p>
            <p className="text-xl font-black text-amber-700">{expiredCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-emerald-600 uppercase">Đã hủy mẫu an toàn</p>
            <p className="text-xl font-black text-emerald-700">{disposedCount}</p>
          </div>
        </div>
      </div>

      {/* ─── FILTER & SEARCH BAR ─── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full md:w-auto">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên món ăn, mã mẫu lưu, người lấy mẫu..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 font-medium transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 text-slate-700 font-medium transition"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="STORED_ACTIVE">Đang lưu (Trong 24h)</option>
            <option value="STORED_EXPIRED">Đã đủ 24h (Chờ hủy)</option>
            <option value="DISPOSED">Đã hủy an toàn</option>
          </select>

          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 text-slate-700 font-medium transition"
          />

          <button
            onClick={fetchSamples}
            title="Tải lại danh sách"
            className="p-2 text-slate-500 hover:text-blue-600 rounded-xl hover:bg-slate-100 border border-slate-200 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {(search || statusFilter !== 'ALL' || dateFilter) && (
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
                setDateFilter('');
              }}
              className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition border border-dashed border-slate-200"
              title="Xóa bộ lọc"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ─── DATA TABLE ─── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3.5">Mã mẫu lưu</th>
                <th className="px-4 py-3.5">Tên món ăn</th>
                <th className="px-4 py-3.5">Ca ăn</th>
                <th className="px-4 py-3.5">Giờ niêm phong</th>
                <th className="px-4 py-3.5 text-center">Khối lượng</th>
                <th className="px-4 py-3.5 text-center">Nhiệt độ tủ</th>
                <th className="px-4 py-3.5">Người lưu mẫu</th>
                <th className="px-4 py-3.5 text-center">Thời gian còn lại (24h)</th>
                <th className="px-4 py-3.5 text-center">Trạng thái</th>
                <th className="px-4 py-3.5 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSamples.map((sample) => {
                const timing = getSampleTiming(sample);
                const isDisposed = sample.status === 'DISPOSED';
                const isExpired = !isDisposed && timing.is24hPassed;

                return (
                  <tr key={sample.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3.5 font-mono font-bold text-blue-700 whitespace-nowrap">
                      {sample.sampleCode || sample.code}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-slate-800">
                      {sample.dishName}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                      {sample.mealSession || 'Trưa chính'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                      {sample.storedAt
                        ? new Date(sample.storedAt).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })
                        : `${sample.date || sample.mealDate} 10:45`}
                    </td>
                    <td className="px-4 py-3.5 text-center font-bold text-slate-700 whitespace-nowrap">
                      {sample.sampleWeight != null ? `${sample.sampleWeight}g` : '--'}
                    </td>
                    <td className="px-4 py-3.5 text-center font-bold text-blue-600 whitespace-nowrap">
                      {(sample.storageTemp != null || sample.temperatureC != null) ? `${sample.storageTemp ?? sample.temperatureC}°C` : '--'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {sample.collectorName || 'Chưa cập nhật'}
                      </span>
                    </td>

                    {/* Countdown / Thời gian lưu */}
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      {isDisposed ? (
                        <span className="text-[11px] text-slate-400 font-medium">
                          {sample.disposeAt
                            ? `Đã hủy: ${new Date(sample.disposeAt).toLocaleTimeString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                day: '2-digit',
                                month: '2-digit',
                              })}`
                            : 'Đã hoàn tất tiêu hủy'}
                        </span>
                      ) : isExpired ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertTriangle className="w-3 h-3" /> Đã đủ 24h
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          <Clock className="w-3 h-3" /> {timing.text}
                        </span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      {isDisposed ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle className="w-3 h-3" /> Đã hủy an toàn
                        </span>
                      ) : isExpired ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertTriangle className="w-3 h-3" /> Chờ tiêu hủy
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          <Refrigerator className="w-3 h-3" /> Đang lưu tủ mát
                        </span>
                      )}
                    </td>

                    {/* Thao tác: In tem & Hủy mẫu */}
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenLabel(sample)}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] transition flex items-center gap-1 border border-blue-200"
                          title="In tem niêm phong mẫu lưu"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>Tem</span>
                        </button>

                        {/* Thao tác hủy mẫu: Chỉ cho phép nhà bếp */}
                        {isDisposed ? (
                          <span className="text-[11px] text-slate-400 font-medium px-2 py-1">
                            Xong
                          </span>
                        ) : !isKitchenStaff ? (
                          <span
                            className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-400 text-[11px] font-medium"
                            title="Chỉ nhân viên nhà bếp mới có quyền hủy mẫu"
                          >
                            Chỉ xem
                          </span>
                        ) : isExpired ? (
                          <button
                            onClick={() => handleDispose(sample)}
                            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] transition flex items-center gap-1 shadow-sm active:scale-95"
                            title="Xác nhận tiêu hủy mẫu sau 24h"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hủy mẫu</span>
                          </button>
                        ) : (
                          <button
                            disabled
                            className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-400 font-medium text-[11px] flex items-center gap-1 cursor-not-allowed border border-slate-200"
                            title="Chưa đủ 24 giờ lưu mẫu theo quy định Bộ Y Tế"
                          >
                            <Lock className="w-3 h-3" />
                            <span>Chưa đủ 24h</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!isLoading && filteredSamples.length === 0 && (
          <div className="p-12 text-center text-slate-400">
            <Refrigerator className="w-12 h-12 mx-auto mb-3 opacity-30 text-blue-500" />
            <p className="text-sm font-bold text-slate-600">Không tìm thấy mẫu lưu thực phẩm nào</p>
            <p className="text-xs text-slate-400 mt-1">
              Các mẫu lưu được tạo tự động khi hoàn thành Bước 3 (Niêm phong mẫu lưu 24h) trong quy trình kiểm thực.
            </p>
          </div>
        )}
      </div>

      {/* ─── MODAL IN TEM NIÊM PHONG LƯU MẪU 24H ─── */}
      {isLabelModalOpen && selectedSample && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Tem Niêm Phong Mẫu Lưu 24H</h3>
                  <p className="text-xs text-slate-500 font-medium">Quyết định 1246/QĐ-BYT Bộ Y Tế</p>
                </div>
              </div>
              <button
                onClick={() => setIsLabelModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Template Tem In Chuẩn QĐ 1246 */}
            <div className="border-2 border-dashed border-slate-300 p-5 rounded-2xl bg-slate-50/50 space-y-3.5 print:border-solid print:m-0 font-sans">
              <div className="text-center border-b border-slate-200 pb-2">
                <p className="font-black text-xs uppercase tracking-wider text-slate-800">
                  TEM NIÊM PHONG MẪU THỨC ĂN LƯU
                </p>
                <p className="text-[10px] text-slate-500 italic">
                  (Bảo quản 24 giờ ở nhiệt độ 0°C – 5°C)
                </p>
              </div>

              <div className="space-y-1.5 text-xs text-slate-700">
                <div className="flex justify-between">
                  <span className="font-medium text-slate-500">Mã niêm phong:</span>
                  <span className="font-mono font-bold text-blue-700">{selectedSample.sampleCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-500">Tên món ăn:</span>
                  <span className="font-bold text-slate-900 text-right">{selectedSample.dishName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-500">Bữa ăn / Ca ăn:</span>
                  <span className="font-bold text-slate-800">{selectedSample.mealSession || 'Trưa chính'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-500">Thời điểm lấy mẫu:</span>
                  <span className="font-bold text-slate-800">
                    {selectedSample.storedAt
                      ? new Date(selectedSample.storedAt).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })
                      : `${selectedSample.date} 10:45`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-500">Khối lượng mẫu:</span>
                  <span className="font-bold text-slate-800">{selectedSample.sampleWeight || 150}g (Hộp Inox vô trùng)</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-500">Vị trí lưu trữ:</span>
                  <span className="font-bold text-slate-800">{selectedSample.fridgeUnit || 'Tủ lưu mẫu số 1 (Ngăn mát 0-5°C)'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-500">Người thực hiện:</span>
                  <span className="font-bold text-slate-900">{selectedSample.collectorName || 'Chưa cập nhật'}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <div className="w-16 h-16 bg-white border border-slate-200 rounded-lg p-1 flex items-center justify-center">
                  <QrCode className="w-12 h-12 text-slate-800" />
                </div>
                <div className="text-right text-[10px] text-slate-500">
                  <p className="font-bold text-slate-700">Chữ ký người niêm phong</p>
                  <p className="italic mt-5 font-mono text-[9px]">(Ký & ghi rõ họ tên)</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setIsLabelModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition"
              >
                Đóng
              </button>
              <button
                onClick={handlePrint}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>In tem niêm phong</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

