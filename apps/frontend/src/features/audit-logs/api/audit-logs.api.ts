import { apiClient } from '../../../core/api/axios';
import {
  AuditLogQuery,
  AuditLogResponse,
  AuditLogFilterOptions,
  AuditLogStats,
} from '../types/audit-log.types';

export const auditLogsApi = {
  /**
   * UC13 & UC14: Lấy danh sách nhật ký kiểm toán kèm tìm kiếm, lọc và phân trang từ Backend/Database
   */
  async getAuditLogs(params?: AuditLogQuery): Promise<AuditLogResponse> {
    const res = await apiClient.get<AuditLogResponse>('/audit-logs', { params });
    return res.data;
  },

  /**
   * Lấy các tùy chọn lọc: actions, targetEntities, users
   */
  async getFilterOptions(): Promise<AuditLogFilterOptions> {
    const res = await apiClient.get<AuditLogFilterOptions>('/audit-logs/filters');
    return res.data;
  },

  /**
   * Thống kê tổng số lượng nhật ký và hành động nhạy cảm
   */
  async getStats(): Promise<AuditLogStats> {
    const res = await apiClient.get<AuditLogStats>('/audit-logs/stats');
    return res.data;
  },
};

