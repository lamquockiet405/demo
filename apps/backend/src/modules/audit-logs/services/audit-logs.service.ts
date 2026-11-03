import { Injectable, BadRequestException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from '../entities/audit-log.entity';
import { QueryAuditLogsDto } from '../dto/query-audit-logs.dto';

export interface AuditLogItem {
  id: string;
  tenantId: string | number;
  userId?: string | number | null;
  userName?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  action: string;
  targetEntity?: string | null;
  targetId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  details: Record<string, any>;
  createdAt: string;
}

// Danh sách các khóa chứa thông tin nhạy cảm cần tự động che mờ (Data Masking - CR-05)
const SENSITIVE_KEYS = [
  'password',
  'passwd',
  'hash',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'otp',
  'otpsecret',
  'pin',
  'creditcard',
  'cardnumber',
  'cvv',
  'authorization',
];

@Injectable()
export class AuditLogsService implements OnModuleInit {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepo: Repository<AuditLogEntity>,
  ) {}

  /**
   * Tự động đảm bảo cấu trúc bảng audit_logs và các index cần thiết tồn tại trong Database
   */
  async onModuleInit() {
    try {
      await this.auditLogRepo.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id BIGSERIAL PRIMARY KEY,
          school_id BIGINT NOT NULL DEFAULT 1 REFERENCES schools(id) ON DELETE RESTRICT,
          user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
          user_email VARCHAR(255),
          user_name VARCHAR(150),
          user_role VARCHAR(50),
          action VARCHAR(100) NOT NULL,
          target_entity VARCHAR(100),
          target_id VARCHAR(100),
          ip_address VARCHAR(45),
          user_agent TEXT,
          details JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_audit_logs_school_created ON audit_logs(school_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_entity, target_id);
      `);
    } catch (err: any) {
      console.warn('[AuditLogsService] Auto-init check:', err.message);
    }
  }

  /**
   * Che mờ (Data Masking) các dữ liệu nhạy cảm trong đối tượng details (CR-05)
   */
  private maskSensitiveData(obj: any): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.maskSensitiveData(item));
    }

    const masked: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = SENSITIVE_KEYS.some((sk) => lowerKey.includes(sk));

      if (isSensitive) {
        masked[key] = '******** (Encrypted/Masked)';
      } else if (typeof value === 'object' && value !== null) {
        masked[key] = this.maskSensitiveData(value);
      } else {
        masked[key] = value;
      }
    }
    return masked;
  }

  /**
   * Ghi log hành động nhạy cảm vào database PostgreSQL (BR-009, BR-010)
   */
  async logAction(entry: Omit<AuditLogItem, 'id' | 'createdAt'>): Promise<AuditLogEntity> {
    const entity = this.auditLogRepo.create({
      schoolId: Number(entry.tenantId) || 1,
      userId: entry.userId ? Number(entry.userId) : null,
      userName: entry.userName || null,
      userEmail: entry.userEmail || null,
      userRole: entry.userRole || null,
      action: entry.action,
      targetEntity: entry.targetEntity || null,
      targetId: entry.targetId ? String(entry.targetId) : null,
      ipAddress: entry.ipAddress || null,
      userAgent: entry.userAgent || null,
      details: entry.details || {},
    });
    return this.auditLogRepo.save(entity);
  }

  /**
   * Truy vấn và lọc danh sách nhật ký kiểm toán trực tiếp từ Database (SRS UC13, UC14)
   */
  async getAuditLogs(query?: QueryAuditLogsDto, schoolId?: string | number) {
    // 1. Kiểm tra tính hợp lệ của khoảng ngày (Ngoại lệ EX-01 trong SRS)
    if (query?.startDate && query?.endDate) {
      const start = new Date(query.startDate);
      const end = new Date(query.endDate);
      if (start.getTime() > end.getTime()) {
        throw new BadRequestException('Ngày bắt đầu không được lớn hơn ngày kết thúc (EX-01)');
      }
    }

    const currentSchoolId = Number(schoolId) || 1;
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.max(1, Number(query?.limit) || 20);
    const skip = (page - 1) * limit;

    // 2. Xây dựng TypeORM QueryBuilder truy vấn database
    const qb = this.auditLogRepo.createQueryBuilder('log');
    qb.where('log.school_id = :schoolId', { schoolId: currentSchoolId });

    // 3. Tìm kiếm theo từ khóa (Action, Email, Tên người dùng, Entity, IP, JSON details)
    if (query?.search && query.search.trim()) {
      const searchParam = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(log.action) LIKE :search OR LOWER(log.user_email) LIKE :search OR LOWER(log.user_name) LIKE :search OR LOWER(log.target_entity) LIKE :search OR log.ip_address LIKE :search OR CAST(log.details AS text) ILIKE :search)',
        { search: searchParam },
      );
    }

    // 4. Lọc theo Hành động (Action)
    if (query?.action && query.action !== 'ALL') {
      qb.andWhere('log.action = :action', { action: query.action });
    }

    // 5. Lọc theo Thực thể tác động (Target Entity)
    if (query?.targetEntity && query.targetEntity !== 'ALL') {
      qb.andWhere('log.target_entity = :targetEntity', { targetEntity: query.targetEntity });
    }

    // 6. Lọc theo Người dùng (User ID)
    if (query?.userId && query.userId !== 'ALL') {
      qb.andWhere('log.user_id = :userId', { userId: Number(query.userId) });
    }

    // 7. Lọc theo Khoảng thời gian (Start Date - End Date)
    if (query?.startDate) {
      const startStr = query.startDate.length === 10 ? `${query.startDate} 00:00:00` : query.startDate;
      qb.andWhere('log.created_at >= :startDate', { startDate: startStr });
    }

    if (query?.endDate) {
      const endStr = query.endDate.length === 10 ? `${query.endDate} 23:59:59.999` : query.endDate;
      qb.andWhere('log.created_at <= :endDate', { endDate: endStr });
    }

    // 8. Sắp xếp giảm dần theo thời gian (UC13: chronologically ordered, most recent first)
    qb.orderBy('log.created_at', 'DESC');
    qb.skip(skip).take(limit);

    const [entities, total] = await qb.getManyAndCount();

    // 9. Che mờ dữ liệu nhạy cảm trong details (CR-05) trước khi trả về
    const items: AuditLogItem[] = entities.map((item) => ({
      id: String(item.id),
      tenantId: item.schoolId,
      userId: item.userId || '',
      userName: item.userName,
      userEmail: item.userEmail,
      userRole: item.userRole,
      action: item.action,
      targetEntity: item.targetEntity,
      targetId: item.targetId,
      ipAddress: item.ipAddress,
      userAgent: item.userAgent,
      details: this.maskSensitiveData(item.details),
      createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : String(item.createdAt),
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Lấy danh sách các tùy chọn lọc có sẵn từ database (Actions, Entities, Users)
   */
  async getFilterOptions(schoolId?: string | number) {
    const currentSchoolId = Number(schoolId) || 1;

    // Lấy distinct actions
    const rawActions = await this.auditLogRepo
      .createQueryBuilder('log')
      .select('DISTINCT log.action', 'action')
      .where('log.school_id = :schoolId', { schoolId: currentSchoolId })
      .getRawMany();

    // Lấy distinct target entities
    const rawEntities = await this.auditLogRepo
      .createQueryBuilder('log')
      .select('DISTINCT log.target_entity', 'targetEntity')
      .where('log.school_id = :schoolId', { schoolId: currentSchoolId })
      .andWhere('log.target_entity IS NOT NULL')
      .getRawMany();

    // Lấy distinct users
    const rawUsers = await this.auditLogRepo
      .createQueryBuilder('log')
      .select([
        'log.user_id AS "userId"',
        'log.user_name AS "userName"',
        'log.user_email AS "userEmail"',
        'log.user_role AS "userRole"',
      ])
      .where('log.school_id = :schoolId', { schoolId: currentSchoolId })
      .andWhere('log.user_id IS NOT NULL')
      .groupBy('log.user_id')
      .addGroupBy('log.user_name')
      .addGroupBy('log.user_email')
      .addGroupBy('log.user_role')
      .getRawMany();

    return {
      actions: rawActions.map((r) => r.action).filter(Boolean),
      targetEntities: rawEntities.map((r) => r.targetEntity).filter(Boolean),
      users: rawUsers.map((u) => ({
        userId: String(u.userId),
        userName: u.userName || 'Tài khoản hệ thống',
        userEmail: u.userEmail || '',
        userRole: u.userRole || 'STAFF',
      })),
    };
  }

  /**
   * Thống kê tổng số lượng nhật ký kiểm toán và cảnh báo nhạy cảm từ database
   */
  async getStats(schoolId?: string | number) {
    const currentSchoolId = Number(schoolId) || 1;

    // 1. Tổng số log
    const totalLogs = await this.auditLogRepo.count({ where: { schoolId: currentSchoolId } });

    // 2. Số log hôm nay
    const todayLogs = await this.auditLogRepo
      .createQueryBuilder('log')
      .where('log.school_id = :schoolId', { schoolId: currentSchoolId })
      .andWhere('log.created_at >= CURRENT_DATE')
      .getCount();

    // 3. Số hành động nhạy cảm
    const sensitiveActions = [
      'APPROVE_MENU',
      'OVERRIDE_NUTRITION_RULE',
      'UPDATE_CHILD_ALLERGY',
      'UPDATE_CHILD_GROWTH',
      'EXPORT_STUDENT_HEALTH_REPORT',
      'SUBMIT_PAYMENT',
    ];
    const sensitiveCount = await this.auditLogRepo
      .createQueryBuilder('log')
      .where('log.school_id = :schoolId', { schoolId: currentSchoolId })
      .andWhere('log.action IN (:...actions)', { actions: sensitiveActions })
      .getCount();

    // 4. Số user khác nhau
    const rawUniqueUsers = await this.auditLogRepo
      .createQueryBuilder('log')
      .select('COUNT(DISTINCT log.user_id)', 'cnt')
      .where('log.school_id = :schoolId', { schoolId: currentSchoolId })
      .andWhere('log.user_id IS NOT NULL')
      .getRawOne();

    const activeUsersCount = parseInt(rawUniqueUsers?.cnt || '0', 10);

    return {
      totalLogs,
      todayLogs,
      sensitiveCount,
      activeUsersCount,
    };
  }
}
