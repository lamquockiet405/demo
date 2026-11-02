import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { AuditLogsService } from '../../../src/modules/audit-logs/services/audit-logs.service';
import { AuditLogEntity } from '../../../src/modules/audit-logs/entities/audit-log.entity';

describe('AuditLogsService (Unit Tests with Database Repository)', () => {
  let service: AuditLogsService;

  const mockEntities: AuditLogEntity[] = [
    {
      id: 101,
      schoolId: 1,
      userId: 2,
      userName: 'Trần Thị Thảo',
      userEmail: 'nutritionist@huongduong.edu.vn',
      userRole: 'NUTRITIONIST',
      action: 'APPROVE_MENU',
      targetEntity: 'MENU',
      targetId: '4',
      ipAddress: '192.168.1.45',
      userAgent: 'Chrome',
      details: {
        note: 'Duyệt thực đơn Tuần 2 tháng 9',
        password: 'super-secret-password-123',
        status: 'APPROVED',
      },
      createdAt: new Date('2026-09-08T10:00:00Z'),
    },
    {
      id: 102,
      schoolId: 1,
      userId: 4,
      userName: 'Nguyễn Văn Bếp',
      userEmail: 'kitchen@huongduong.edu.vn',
      userRole: 'KITCHEN_STAFF',
      action: 'FOOD_INSPECTION_STEP1',
      targetEntity: 'FOOD_INSPECTION',
      targetId: '12',
      ipAddress: '192.168.1.80',
      userAgent: 'iPad',
      details: {
        step: 1,
        result: 'PASSED',
      },
      createdAt: new Date('2026-09-08T09:00:00Z'),
    },
  ];

  const mockQueryBuilder: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([mockEntities, 2]),
    getRawMany: jest.fn().mockResolvedValue([]),
    getRawOne: jest.fn().mockResolvedValue({ cnt: '3' }),
    getCount: jest.fn().mockResolvedValue(5),
  };

  const mockRepository = {
    query: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(2),
    create: jest.fn().mockImplementation((dto) => ({ id: 999, createdAt: new Date(), ...dto })),
    save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogsService,
        {
          provide: getRepositoryToken(AuditLogEntity),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<AuditLogsService>(AuditLogsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('UC13: View Audit Logs from Database', () => {
    it('should query database via query builder and return formatted items', async () => {
      const result = await service.getAuditLogs({ page: 1, limit: 10 }, 1);

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('log');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('log.school_id = :schoolId', { schoolId: 1 });
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('log.created_at', 'DESC');
      expect(result).toHaveProperty('items');
      expect(result.items.length).toBe(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
    });

    it('CR-05: should mask sensitive keys retrieved from database', async () => {
      const result = await service.getAuditLogs({ page: 1, limit: 10 }, 1);
      const firstItem = result.items[0];
      expect(firstItem.details.password).toContain('********');
      expect(firstItem.details.status).toBe('APPROVED');
    });
  });

  describe('UC14: Filter Audit Logs from Database', () => {
    it('should apply search filter clause in query builder', async () => {
      await service.getAuditLogs({ search: 'thực đơn' }, 1);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('LOWER(log.action) LIKE :search'),
        expect.objectContaining({ search: '%thực đơn%' }),
      );
    });

    it('should apply action filter', async () => {
      await service.getAuditLogs({ action: 'APPROVE_MENU' }, 1);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('log.action = :action', { action: 'APPROVE_MENU' });
    });

    it('should apply targetEntity filter', async () => {
      await service.getAuditLogs({ targetEntity: 'MENU' }, 1);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('log.target_entity = :targetEntity', { targetEntity: 'MENU' });
    });

    it('should apply userId filter', async () => {
      await service.getAuditLogs({ userId: '2' }, 1);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('log.user_id = :userId', { userId: 2 });
    });

    it('should apply date range filter', async () => {
      await service.getAuditLogs({ startDate: '2026-09-01', endDate: '2026-09-30' }, 1);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'log.created_at >= :startDate',
        { startDate: '2026-09-01 00:00:00' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'log.created_at <= :endDate',
        { endDate: '2026-09-30 23:59:59.999' },
      );
    });
  });

  describe('Exceptions Handling', () => {
    it('EX-01: should throw BadRequestException when startDate > endDate', async () => {
      await expect(
        service.getAuditLogs({
          startDate: '2026-10-20',
          endDate: '2026-10-10',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Write Log: logAction', () => {
    it('should save log entity to database', async () => {
      await service.logAction({
        tenantId: 1,
        userId: 2,
        userName: 'Admin',
        userEmail: 'admin@huongduong.edu.vn',
        action: 'UPDATE_ALLERGY',
        targetEntity: 'ALLERGY',
        targetId: '105',
        ipAddress: '192.168.1.1',
        details: { note: 'Updated allergy status' },
      });

      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
    });
  });

  describe('Filter Options & Stats from Database', () => {
    it('should query distinct filter options from database', async () => {
      mockQueryBuilder.getRawMany
        .mockResolvedValueOnce([{ action: 'APPROVE_MENU' }])
        .mockResolvedValueOnce([{ targetEntity: 'MENU' }])
        .mockResolvedValueOnce([{ userId: 2, userName: 'Thảo', userEmail: 'thao@edu.vn', userRole: 'NUTRITIONIST' }]);

      const opts = await service.getFilterOptions(1);
      expect(opts.actions).toEqual(['APPROVE_MENU']);
      expect(opts.targetEntities).toEqual(['MENU']);
      expect(opts.users.length).toBe(1);
      expect(opts.users[0].userId).toBe('2');
    });

    it('should calculate stats from database', async () => {
      const stats = await service.getStats(1);
      expect(stats.totalLogs).toBe(2);
      expect(stats.todayLogs).toBe(5);
      expect(stats.sensitiveCount).toBe(5);
      expect(stats.activeUsersCount).toBe(3);
    });
  });
});

