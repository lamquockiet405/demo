import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MenusService } from '../../../src/modules/menus/services/menus.service';
import { Menu } from '../../../src/modules/menus/entities/menu.entity';
import { MenuVersion } from '../../../src/modules/menus/entities/menu-version.entity';
import { MenuDay } from '../../../src/modules/menus/entities/menu-day.entity';
import { MenuMeal } from '../../../src/modules/menus/entities/menu-meal.entity';
import { MenuDish } from '../../../src/modules/menus/entities/menu-dish.entity';
import { MenuCycle } from '../../../src/modules/menus/entities/menu-cycle.entity';
import { Dish } from '../../../src/modules/dishes/entities/dish.entity';
import { NutritionalStandard } from '../../../src/modules/menus/entities/nutritional-standard.entity';
import { MenuRuleViolation } from '../../../src/modules/menus/entities/menu-rule-violation.entity';
import { AuditLogsService } from '../../../src/modules/audit-logs/services/audit-logs.service';
import { DishFrequencyRule } from '../../../src/modules/nutrition-engine/entities/dish-frequency-rule.entity';
import { DishSpacingRule } from '../../../src/modules/nutrition-engine/entities/dish-spacing-rule.entity';
import { NutritionIntakeStandard } from '../../../src/modules/nutrition-engine/entities/nutrition-intake-standard.entity';

describe('MenusService - Submit Menu with Nutritionist Commitment & Override Justification', () => {
  let service: MenusService;
  let menuRepo: any;
  let auditLogsService: any;

  function createMenuEntity(overrides: Partial<Menu> = {}): Menu {
    const menu = new Menu();
    menu.id = 101;
    menu.title = 'Thực đơn Mầm non Tuần 1 Tháng 11';
    menu.ageGroup = 'MAU_GIAO';
    menu.weekStartDate = '2026-11-02';
    menu.weekEndDate = '2026-11-06';
    menu.status = 'DRAFT';
    menu.createdBy = 5;
    menu.submittedBy = null;
    menu.submittedAt = null;
    menu.commitmentSigned = false;
    menu.commitmentText = null;
    menu.commitmentItems = [];
    menu.overrideJustification = null;
    menu.violationsSnapshot = [];
    Object.assign(menu, overrides);
    return menu;
  }

  beforeEach(async () => {
    menuRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((entity) => Promise.resolve({ ...entity })),
      count: jest.fn().mockResolvedValue(1),
      query: jest.fn().mockResolvedValue([]),
    };

    auditLogsService = {
      logAction: jest.fn().mockResolvedValue({ id: 'log-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenusService,
        { provide: getRepositoryToken(Menu), useValue: menuRepo },
        { provide: getRepositoryToken(MenuVersion), useValue: { findOne: jest.fn().mockResolvedValue({ versionNumber: 1 }), save: jest.fn() } },
        { provide: getRepositoryToken(MenuDay), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: getRepositoryToken(MenuMeal), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: getRepositoryToken(MenuDish), useValue: { find: jest.fn().mockResolvedValue([]), delete: jest.fn() } },
        { provide: getRepositoryToken(MenuCycle), useValue: { findOne: jest.fn().mockResolvedValue(null) } },
        { provide: getRepositoryToken(Dish), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: getRepositoryToken(NutritionalStandard), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: getRepositoryToken(MenuRuleViolation), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: AuditLogsService, useValue: auditLogsService },
        { provide: getRepositoryToken(DishFrequencyRule), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: getRepositoryToken(DishSpacingRule), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: getRepositoryToken(NutritionIntakeStandard), useValue: { find: jest.fn().mockResolvedValue([]) } },
      ],
    }).compile();

    service = module.get<MenusService>(MenusService);
    jest.spyOn(service, 'findOne').mockResolvedValue({
      id: '101',
      title: 'Thực đơn Mầm non Tuần 1 Tháng 11',
      status: 'PENDING',
    } as any);
  });

  it('1. Nên ném lỗi NotFoundException nếu thực đơn không tồn tại', async () => {
    menuRepo.findOne.mockResolvedValue(null);
    await expect(service.submitForReview(999)).rejects.toThrow(NotFoundException);
  });

  it('2. Nên ném lỗi BadRequestException nếu thực đơn đã ở trạng thái APPROVED hoặc ACTIVE', async () => {
    menuRepo.findOne.mockResolvedValue(createMenuEntity({ status: 'APPROVED' }));
    await expect(
      service.submitForReview(101, { id: 5 }, {
        commitmentSigned: true,
        commitmentItems: ['COMMIT_TT28_NUTRITION'],
        commitmentText: 'Cam kết chuẩn',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('3. Nên ném lỗi BadRequestException nếu chuyên viên dinh dưỡng từ chối ký cam kết (commitmentSigned = false)', async () => {
    menuRepo.findOne.mockResolvedValue(createMenuEntity());
    await expect(
      service.submitForReview(101, { id: 5 }, {
        commitmentSigned: false,
        commitmentItems: [],
        commitmentText: '',
      }),
    ).rejects.toThrow('ký số cam kết');
  });

  it('4. Nên ném lỗi BadRequestException nếu có cảnh báo vi phạm nhưng thiếu giải trình can thiệp (overrideJustification)', async () => {
    menuRepo.findOne.mockResolvedValue(createMenuEntity());
    await expect(
      service.submitForReview(101, { id: 5 }, {
        commitmentSigned: true,
        commitmentItems: ['COMMIT_TT28_NUTRITION', 'COMMIT_QD1246_SAFETY'],
        commitmentText: 'Bản cam kết đầy đủ',
        violationsSnapshot: [{ ruleCode: 'FREQUENCY_EXCEEDED', message: 'Món thịt bò lặp 2 lần' }],
        overrideJustification: '',
      }),
    ).rejects.toThrow('bắt buộc phải nhập giải trình');
  });

  it('5. Nên gửi duyệt thành công khi thực đơn đạt chuẩn và ghi nhận đầy đủ cam kết & audit log', async () => {
    menuRepo.findOne.mockResolvedValue(createMenuEntity());

    const result = await service.submitForReview(101, { id: 5, fullName: 'CN. Nguyễn Thị An', email: 'an.dinhduong@huongduong.edu.vn' }, {
      commitmentSigned: true,
      commitmentItems: [
        'COMMIT_TT28_NUTRITION',
        'COMMIT_QD1246_SAFETY',
        'COMMIT_ALLERGEN_SAFETY',
        'COMMIT_PROFESSIONAL_RESP',
      ],
      commitmentText: 'Tôi cam kết thực đơn tuân thủ đầy đủ Thông tư 28 và Quyết định 1246/QĐ-BYT',
    });

    expect(result).toBeDefined();
    expect(menuRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'PENDING',
        submittedBy: 5,
        commitmentSigned: true,
        commitmentText: expect.stringContaining('Thông tư 28'),
      }),
    );
    expect(auditLogsService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SUBMIT_MENU_FOR_REVIEW',
        targetEntity: 'MENU',
        targetId: '101',
      }),
    );
  });

  it('6. Nên gửi duyệt thành công khi có cảnh báo nhưng có giải trình can thiệp chuyên môn hợp lệ (>= 10 ký tự)', async () => {
    menuRepo.findOne.mockResolvedValue(createMenuEntity());

    const result = await service.submitForReview(101, { id: 5, fullName: 'CN. Nguyễn Thị An' }, {
      commitmentSigned: true,
      commitmentItems: ['COMMIT_TT28_NUTRITION', 'COMMIT_QD1246_SAFETY'],
      commitmentText: 'Bản cam kết chuyên môn',
      violationsSnapshot: [{ ruleCode: 'SPACING_WARNING', message: 'Món canh rau ngót cách 1 ngày' }],
      overrideJustification: 'Nguồn rau ngót tươi từ hợp tác xã VietGAP thu hoạch thứ 2 và thứ 4, cung ứng tăng cường vi chất A cho học sinh.',
    });

    expect(result).toBeDefined();
    expect(menuRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'PENDING',
        overrideJustification: expect.stringContaining('rau ngót tươi'),
      }),
    );
    expect(auditLogsService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SUBMIT_MENU_FOR_REVIEW',
        details: expect.objectContaining({
          hasOverrideJustification: true,
          overrideJustification: expect.stringContaining('rau ngót tươi'),
        }),
      }),
    );
  });
});
