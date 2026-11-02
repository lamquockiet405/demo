import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  Receipt,
  Users,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Bell,
  Printer,
  RefreshCw,
  Clock,
  ArrowRight,
  ShieldAlert,
  Percent,
  Layers,
  FileSpreadsheet,
  Send,
  Building,
  CreditCard,
  Check,
  Search,
} from 'lucide-react';
import {
  snackRevenueApi,
  SnackRevenueReportData,
  AgingDebtItem,
  VnpayTransactionItem,
} from '../api/snack-revenue.api';

export const SnackServiceRevenueReportPage: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<number>(11);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedServiceType, setSelectedServiceType] = useState<string>('ALL');
  const [report, setReport] = useState<SnackRevenueReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'collection' | 'reconciliation' | 'cost_structure' | 'vnpay'>(
    'collection',
  );

  // Reminder Modal State
  const [isReminderModalOpen, setIsReminderModalOpen] = useState<boolean>(false);
  const [selectedDebtIds, setSelectedDebtIds] = useState<number[]>([]);
  const [reminderChannel, setReminderChannel] = useState<'SMS' | 'APP_PUSH' | 'ALL'>('ALL');
  const [customReminderMsg, setCustomReminderMsg] = useState<string>(
    'Trường Mầm Non KidMeal trân trọng nhắc Quý Phụ Huynh hoàn tất học phí dịch vụ ăn xế chiều 17h00. Xin cảm ơn!',
  );
  const [isSendingReminder, setIsSendingReminder] = useState<boolean>(false);
  const [reminderSuccessMsg, setReminderSuccessMsg] = useState<string | null>(null);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const data = await snackRevenueApi.getReport({
        month: selectedMonth,
        year: selectedYear,
        serviceType: selectedServiceType,
      });
      setReport(data);
    } catch (err) {
      console.error('Lỗi khi tải báo cáo doanh thu ăn xế:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedMonth, selectedYear, selectedServiceType]);

  const handleSendReminder = async () => {
    if (selectedDebtIds.length === 0) {
      alert('Vui lòng chọn ít nhất một học sinh để gửi tin nhắn nhắc phí');
      return;
    }
    try {
      setIsSendingReminder(true);
      const res = await snackRevenueApi.sendDebtReminder({
        registrationIds: selectedDebtIds,
        channel: reminderChannel,
        customMessage: customReminderMsg,
      });
      setReminderSuccessMsg(res.message);
      setIsReminderModalOpen(false);
      setSelectedDebtIds([]);
      setTimeout(() => setReminderSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi gửi tin nhắn nhắc nợ');
    } finally {
      setIsSendingReminder(false);
    }
  };

  const handleSelectAllDebts = () => {
    if (!report) return;
    if (selectedDebtIds.length === report.agingDebts.length) {
      setSelectedDebtIds([]);
    } else {
      setSelectedDebtIds(report.agingDebts.map((d) => d.registrationId));
    }
  };

  const toggleDebtSelect = (id: number) => {
    if (selectedDebtIds.includes(id)) {
      setSelectedDebtIds(selectedDebtIds.filter((item) => item !== id));
    } else {
      setSelectedDebtIds([...selectedDebtIds, id]);
    }
  };

  const handleExport = async () => {
    try {
      await snackRevenueApi.exportFinancialReport({
        month: selectedMonth,
        year: selectedYear,
      });
      window.print();
    } catch (err) {
      window.print();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-6 lg:p-8 space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 rounded-full flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" /> UC96 • Bảo Mật Tài Chính BGH
              </span>
              <span className="px-2.5 py-1 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 rounded-full">
                Dịch Vụ Tự Nguyện Ngoài Giờ 17h00
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mt-2">
              Báo Cáo Doanh Thu Dịch Vụ Ăn Xế
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Quyết toán dòng tiền ròng, tiến độ thu phí (KPI ≥ 95%), cấn trừ hoàn phí điểm danh & đối soát VNPAY.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Month & Year Select */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700/60 p-1.5 rounded-xl border border-slate-200 dark:border-slate-600 text-xs font-semibold">
              <Calendar className="w-4 h-4 text-slate-500 ml-1" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-transparent text-slate-800 dark:text-slate-200 border-none focus:outline-none cursor-pointer"
              >
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Tháng {i + 1}
                  </option>
                ))}
              </select>
              <span>/</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent text-slate-800 dark:text-slate-200 border-none focus:outline-none cursor-pointer"
              >
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
              </select>
            </div>

            {/* Service Package Filter */}
            <select
              value={selectedServiceType}
              onChange={(e) => setSelectedServiceType(e.target.value)}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-700/60 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-600 focus:outline-none"
            >
              <option value="ALL">Tất cả gói dịch vụ</option>
              <option value="FULL_MONTH">Gói ăn cả tháng (22 buổi)</option>
              <option value="FLEXIBLE_3_DAYS">Gói linh hoạt (3 buổi/tuần)</option>
            </select>

            <button
              onClick={fetchReport}
              title="Làm mới dữ liệu"
              className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
            >
              <Printer className="w-4 h-4" /> Xuất Báo Cáo Quyết Toán
            </button>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/80 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
          <span>
            <strong>Phạm vi truy cập giới hạn:</strong> Dữ liệu chứa thông tin tài chính nhạy cảm (biên lợi nhuận ròng, thù lao giáo viên ngoài giờ sau 16h30, hoa hồng cổng VNPAY). Chỉ Ban Giám Hiệu & Kế toán trưởng có thẩm quyền.
          </span>
        </div>
      </div>

      {reminderSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{reminderSuccessMsg}</span>
        </div>
      )}

      {/* Revenue KPI Cards */}
      {report && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <div className="text-xs font-semibold text-slate-500 uppercase">Doanh Thu Dự Kiến</div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {report.collectionSummary.expectedRevenue.toLocaleString('vi-VN')} đ
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {report.collectionSummary.totalRegisteredStudents} học sinh đăng ký
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 shadow-xs">
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase">
              Doanh Thu Thực Thu
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-300 mt-1">
              {report.collectionSummary.collectedRevenue.toLocaleString('vi-VN')} đ
            </div>
            <div className="text-xs text-emerald-600 mt-1">
              {report.collectionSummary.paidStudents} học sinh đã thanh toán
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-blue-200 dark:border-blue-900/50 shadow-xs">
            <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase">
              Tiến Độ Thu (KPI ≥ 95%)
            </div>
            <div className="text-2xl font-black text-blue-600 dark:text-blue-300 mt-1 flex items-baseline gap-2">
              {report.collectionSummary.collectionRate}%
              {report.collectionSummary.isTargetReached ? (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  ĐẠT KPI
                </span>
              ) : (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                  CHƯA ĐẠT
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 mt-1">Chốt trước ngày 05/tháng</div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-purple-200 dark:border-purple-900/50 shadow-xs">
            <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase">
              Hoàn Phí Cấn Trừ
            </div>
            <div className="text-2xl font-black text-purple-600 dark:text-purple-300 mt-1">
              {report.attendanceReconciliation.totalRefundAmount.toLocaleString('vi-VN')} đ
            </div>
            <div className="text-xs text-purple-600 mt-1">
              {report.attendanceReconciliation.totalExcusedAbsences} lượt nghỉ &lt; 08h00
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-rose-200 dark:border-rose-900/50 shadow-xs">
            <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase">
              Công Nợ Tồn Đọng
            </div>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-300 mt-1">
              {report.collectionSummary.pendingDebtAmount.toLocaleString('vi-VN')} đ
            </div>
            <div className="text-xs text-rose-500 font-medium mt-1">
              {report.collectionSummary.pendingStudents} học sinh quá hạn
            </div>
          </div>
        </div>
      )}

      {/* Main Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 gap-2">
        <button
          onClick={() => setActiveTab('collection')}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'collection'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          1. Doanh Số & Tiến Độ Thu (Collection Metrics)
        </button>

        <button
          onClick={() => setActiveTab('reconciliation')}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'reconciliation'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <Receipt className="w-4 h-4" />
          2. Quyết Toán Hoàn Phí & Cấn Trừ (Attendance Reconciliation)
        </button>

        <button
          onClick={() => setActiveTab('cost_structure')}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'cost_structure'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <Percent className="w-4 h-4" />
          3. Cơ Cấu Định Mức Chi Phí (70% - 20% - 10%)
        </button>

        <button
          onClick={() => setActiveTab('vnpay')}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'vnpay'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          4. Đối Chiếu Sao Kê VNPAY & Ngân Hàng
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-600" />
          Đang tính toán doanh thu ăn xế và quyết toán hoàn phí...
        </div>
      ) : !report ? (
        <div className="p-12 text-center text-slate-500">Không có dữ liệu cho tháng này.</div>
      ) : (
        <>
          {/* TAB 1: COLLECTION METRICS & AGING DEBTS */}
          {activeTab === 'collection' && (
            <div className="space-y-6">
              {/* Grade Breakdown Table */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-base">
                    <Users className="w-4 h-4 text-indigo-600" />
                    Phân Rã Doanh Số Theo Khối Lớp (Grade Revenue Breakdown)
                  </h3>
                  <span className="text-xs text-slate-500">
                    Đơn giá: {report.period.serviceFeePerDay.toLocaleString('vi-VN')} đ/ngày ({report.period.daysInMonth} ngày/tháng)
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs font-semibold text-slate-500 uppercase">
                      <tr>
                        <th className="py-3 px-4">Khối Lớp</th>
                        <th className="py-3 px-4 text-center">Số Trẻ Đăng Ký</th>
                        <th className="py-3 px-4 text-right">Doanh Thu Dự Kiến</th>
                        <th className="py-3 px-4 text-right">Doanh Thu Thực Thu</th>
                        <th className="py-3 px-4 text-center">Tỷ Lệ Thu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {report.gradeBreakdown.map((g) => (
                        <tr key={g.gradeLevel} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                          <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                            {g.gradeName}
                          </td>
                          <td className="py-3.5 px-4 text-center font-semibold text-slate-700 dark:text-slate-300">
                            {g.registeredCount} học sinh
                          </td>
                          <td className="py-3.5 px-4 text-right font-medium text-slate-900 dark:text-white">
                            {g.expectedRevenue.toLocaleString('vi-VN')} đ
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {g.collectedRevenue.toLocaleString('vi-VN')} đ
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                g.collectionRate >= 95
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {g.collectionRate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 dark:bg-slate-700/40 font-bold border-t border-slate-200 dark:border-slate-700">
                      <tr>
                        <td className="py-3 px-4">Tổng Cộng Toàn Trường</td>
                        <td className="py-3 px-4 text-center">{report.collectionSummary.totalRegisteredStudents} bé</td>
                        <td className="py-3 px-4 text-right">{report.collectionSummary.expectedRevenue.toLocaleString('vi-VN')} đ</td>
                        <td className="py-3 px-4 text-right text-emerald-600">{report.collectionSummary.collectedRevenue.toLocaleString('vi-VN')} đ</td>
                        <td className="py-3 px-4 text-center text-blue-600">{report.collectionSummary.collectionRate}%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Aging Debts Table with Send Reminder Button */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 pb-4">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-rose-600" />
                      Danh Sách Công Nợ Tồn Đọng (Aging Debts Quá Hạn)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Các đơn đăng ký ở trạng thái PENDING quá hạn đóng tiền trước ngày 05 hàng tháng.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSelectAllDebts}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                    >
                      {selectedDebtIds.length === report.agingDebts.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                    </button>
                    <button
                      onClick={() => setIsReminderModalOpen(true)}
                      disabled={selectedDebtIds.length === 0}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" /> Gửi Nhắc Nợ ({selectedDebtIds.length})
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs font-semibold text-slate-500 uppercase">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={report.agingDebts.length > 0 && selectedDebtIds.length === report.agingDebts.length}
                            onChange={handleSelectAllDebts}
                            className="rounded"
                          />
                        </th>
                        <th className="py-2.5 px-3">Học Sinh</th>
                        <th className="py-2.5 px-3">Lớp</th>
                        <th className="py-2.5 px-3">Phụ Huynh</th>
                        <th className="py-2.5 px-3">Số Điện Thoại</th>
                        <th className="py-2.5 px-3 text-right">Số Tiền Nợ</th>
                        <th className="py-2.5 px-3 text-center">Số Ngày Quá Hạn</th>
                        <th className="py-2.5 px-3 text-center">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {report.agingDebts.map((debt) => (
                        <tr key={debt.registrationId} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={selectedDebtIds.includes(debt.registrationId)}
                              onChange={() => toggleDebtSelect(debt.registrationId)}
                              className="rounded"
                            />
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                            {debt.studentName}
                          </td>
                          <td className="py-3 px-3 text-xs text-slate-500">
                            {debt.className}
                          </td>
                          <td className="py-3 px-3 text-xs font-medium text-slate-700 dark:text-slate-300">
                            {debt.parentName}
                          </td>
                          <td className="py-3 px-3 text-xs font-mono text-slate-600 dark:text-slate-400">
                            {debt.parentPhone}
                          </td>
                          <td className="py-3 px-3 text-right font-black text-rose-600">
                            {debt.amount.toLocaleString('vi-VN')} đ
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-700">
                              Trễ {debt.daysOverdue} ngày
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={() => {
                                setSelectedDebtIds([debt.registrationId]);
                                setIsReminderModalOpen(true);
                              }}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                            >
                              Nhắc nợ
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ATTENDANCE RECONCILIATION */}
          {activeTab === 'reconciliation' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 text-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Receipt className="w-5 h-5 text-purple-600" />
                  <div>
                    <span className="font-bold text-purple-900 dark:text-purple-200">
                      Cơ chế hoàn phí tự động (Meal Attendance Auto-Refunds):
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-400 ml-2">
                      Trẻ nghỉ học có phép báo trước 08h00 sáng được hoàn 100% tiền ăn xế ({report.attendanceReconciliation.refundPerSnack.toLocaleString('vi-VN')} đ/buổi).
                    </span>
                  </div>
                </div>
                <div className="text-xs font-bold text-purple-700 dark:text-purple-300 px-3 py-1 bg-white dark:bg-slate-800 rounded-lg shadow-xs border border-purple-200">
                  Tự động cấn trừ sang tháng tiếp theo
                </div>
              </div>

              {/* Detail Table */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Danh Sách Học Sinh Được Hoàn Phí & Cấn Trừ Hóa Đơn Tháng Sau
                  </h3>
                  <div className="text-xs text-slate-500">
                    Tổng hoàn trả tháng này: <strong className="text-purple-600 font-black">{report.attendanceReconciliation.totalRefundAmount.toLocaleString('vi-VN')} đ</strong>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs font-semibold text-slate-500 uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Học Sinh</th>
                        <th className="py-2.5 px-3">Lớp Học</th>
                        <th className="py-2.5 px-3">Phụ Huynh</th>
                        <th className="py-2.5 px-3 text-center">Số Buổi Nghỉ Báo Phép</th>
                        <th className="py-2.5 px-3 text-right">Số Tiền Hoàn Trả</th>
                        <th className="py-2.5 px-3 text-center">Trạng Thái Hạch Toán</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {report.attendanceReconciliation.reconciliationStudents.map((item) => (
                        <tr key={item.studentId} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                          <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                            {item.studentName}
                          </td>
                          <td className="py-3 px-3 text-xs text-slate-500">
                            {item.className}
                          </td>
                          <td className="py-3 px-3 text-xs text-slate-700 dark:text-slate-300">
                            {item.parentName}
                          </td>
                          <td className="py-3 px-3 text-center font-semibold text-blue-600">
                            {item.excusedDaysCount} buổi (&lt;08h00)
                          </td>
                          <td className="py-3 px-3 text-right font-black text-purple-600">
                            {item.refundAmount.toLocaleString('vi-VN')} đ
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 flex items-center justify-center gap-1 mx-auto w-fit">
                              <Check className="w-3 h-3" /> Đã cấn trừ tháng sau
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: COST STRUCTURE NORMS (70% - 20% - 10%) */}
          {activeTab === 'cost_structure' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <Percent className="w-5 h-5 text-indigo-600" />
                    Cơ Cấu Định Mức Chi Phí Gói Dịch Vụ Ăn Xế (Food Cost Structure Norms)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Định mức chi phí chuẩn áp dụng cho toàn bộ các gói dịch vụ ăn xế chiều 17h00.
                  </p>
                </div>

                {/* Progress Bar of Cost Structure */}
                <div className="space-y-2">
                  <div className="h-6 w-full rounded-xl overflow-hidden flex shadow-inner">
                    <div
                      style={{ width: '70%' }}
                      className="bg-emerald-500 flex items-center justify-center text-[11px] font-bold text-white"
                      title="Nguyên liệu trực tiếp: 70%"
                    >
                      Nguyên liệu (70%)
                    </div>
                    <div
                      style={{ width: '20%' }}
                      className="bg-amber-500 flex items-center justify-center text-[11px] font-bold text-white"
                      title="Phục vụ ngoài giờ: 20%"
                    >
                      Phục vụ ngoài giờ (20%)
                    </div>
                    <div
                      style={{ width: '10%' }}
                      className="bg-blue-500 flex items-center justify-center text-[11px] font-bold text-white"
                      title="Phí VNPAY & Quản trị: 10%"
                    >
                      Phí VNPAY (10%)
                    </div>
                  </div>
                </div>

                {/* Detailed Cards for 3 parts */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-3">
                  {/* Part 1: Ingredient 70% */}
                  <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-emerald-700">Nhóm 1 • Định Mức 70%</span>
                      <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                        70%
                      </span>
                    </div>
                    <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                      {report.costStructure.ingredientCost70Pct.amount.toLocaleString('vi-VN')} đ
                    </div>
                    <h5 className="font-bold text-slate-900 dark:text-white text-xs">
                      Chi Phí Nguyên Liệu Thực Phẩm Trực Tiếp
                    </h5>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {report.costStructure.ingredientCost70Pct.description}
                    </p>
                  </div>

                  {/* Part 2: Service Cost 20% */}
                  <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-amber-700">Nhóm 2 • Định Mức 20%</span>
                      <span className="text-xs font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                        20%
                      </span>
                    </div>
                    <div className="text-2xl font-black text-amber-700 dark:text-amber-300">
                      {report.costStructure.serviceCost20Pct.amount.toLocaleString('vi-VN')} đ
                    </div>
                    <h5 className="font-bold text-slate-900 dark:text-white text-xs">
                      Thù Lao Phục Vụ Ngoài Giờ & Khay Ăn
                    </h5>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {report.costStructure.serviceCost20Pct.description}
                    </p>
                  </div>

                  {/* Part 3: VNPAY & Admin Fee 10% */}
                  <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-blue-700">Nhóm 3 • Định Mức 10%</span>
                      <span className="text-xs font-black text-blue-800 bg-blue-100 px-2 py-0.5 rounded">
                        10%
                      </span>
                    </div>
                    <div className="text-2xl font-black text-blue-700 dark:text-blue-300">
                      {report.costStructure.paymentFeeAndAdmin10Pct.amount.toLocaleString('vi-VN')} đ
                    </div>
                    <h5 className="font-bold text-slate-900 dark:text-white text-xs">
                      Phí Cổng Thanh Toán VNPAY & Quản Trị
                    </h5>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {report.costStructure.paymentFeeAndAdmin10Pct.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: VNPAY STATEMENT RECONCILIATION */}
          {activeTab === 'vnpay' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-indigo-600" />
                      Đối Chiếu Sao Kê Cổng Thanh Toán VNPAY & Sổ Phụ Ngân Hàng
                    </h3>
                    <p className="text-xs text-slate-500">
                      Khớp nối trực tiếp từng giao dịch chuyển tiền qua VNPAY QR với tài khoản ngân hàng nhà trường.
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg text-xs">
                    100% KHỚP NỐI (MATCHED)
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs font-semibold text-slate-500 uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Mã Giao Dịch VNPAY</th>
                        <th className="py-2.5 px-3">Học Sinh</th>
                        <th className="py-2.5 px-3">Lớp Học</th>
                        <th className="py-2.5 px-3 text-right">Số Tiền</th>
                        <th className="py-2.5 px-3">Phương Thức</th>
                        <th className="py-2.5 px-3">Thời Điểm Ghi Có</th>
                        <th className="py-2.5 px-3">Mã Bút Toán Ngân Hàng</th>
                        <th className="py-2.5 px-3 text-center">Trạng Thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {report.vnpayTransactions.map((tx, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                          <td className="py-3 px-3 font-mono text-xs font-bold text-slate-900 dark:text-white">
                            {tx.transactionCode}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">
                            {tx.studentName}
                          </td>
                          <td className="py-3 px-3 text-xs text-slate-500">
                            {tx.className}
                          </td>
                          <td className="py-3 px-3 text-right font-black text-emerald-600">
                            {tx.amount.toLocaleString('vi-VN')} đ
                          </td>
                          <td className="py-3 px-3 text-xs">
                            <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold text-[11px]">
                              {tx.paymentMethod}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-xs text-slate-500">
                            {new Date(tx.paidAt).toLocaleString('vi-VN')}
                          </td>
                          <td className="py-3 px-3 font-mono text-xs text-slate-600">
                            {tx.bankRef}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 flex items-center justify-center gap-1 mx-auto w-fit">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Khớp nối
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Reminder Modal */}
      {isReminderModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <Send className="w-5 h-5 text-rose-600" />
              Gửi Tin Nhắn Nhắc Phí Dịch Vụ Ăn Xế
            </h3>
            <p className="text-xs text-slate-500">
              Bạn đang chọn gửi thông báo nhắc đóng tiền ăn xế cho{' '}
              <strong className="text-rose-600 font-bold">{selectedDebtIds.length}</strong> học sinh có đơn quá hạn.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Kênh Gửi Thông Báo
                </label>
                <select
                  value={reminderChannel}
                  onChange={(e: any) => setReminderChannel(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs bg-slate-50 dark:bg-slate-700"
                >
                  <option value="ALL">Tất cả kênh (SMS & App Push)</option>
                  <option value="APP_PUSH">Chỉ gửi App Push</option>
                  <option value="SMS">Chỉ gửi SMS Brandname</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Nội Dung Tin Nhắn
                </label>
                <textarea
                  rows={4}
                  value={customReminderMsg}
                  onChange={(e) => setCustomReminderMsg(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs bg-slate-50 dark:bg-slate-700 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsReminderModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleSendReminder}
                disabled={isSendingReminder}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
              >
                {isSendingReminder ? 'Đang gửi...' : 'Gửi Nhắc Phí Ngay'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

