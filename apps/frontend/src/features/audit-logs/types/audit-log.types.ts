export interface AuditLogItem {
  id: string;
  tenantId: string | number;
  userId: string | number;
  userName?: string | null;
  userEmail: string | null;
  userRole?: string | null;
  action: string;
  targetEntity: string | null;
  targetId: string | null;
  ipAddress: string | null;
  userAgent?: string | null;
  details: Record<string, any>;
  createdAt: string;
}

export interface AuditLogQuery {
  search?: string;
  action?: string;
  targetEntity?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogResponse {
  items: AuditLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuditLogUserOption {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
}

export interface AuditLogFilterOptions {
  actions: string[];
  targetEntities: string[];
  users: AuditLogUserOption[];
}

export interface AuditLogStats {
  totalLogs: number;
  todayLogs: number;
  sensitiveCount: number;
  activeUsersCount: number;
}

