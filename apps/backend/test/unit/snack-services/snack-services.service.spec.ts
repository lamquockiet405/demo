import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SnackServicesService } from '../../../src/modules/snack-services/snack-services.service';
import { SnackServicePeriod } from '../../../src/modules/snack-services/entities/snack-service-period.entity';
import { SnackRegistration } from '../../../src/modules/snack-services/entities/snack-registration.entity';
import { Child } from '../../../src/modules/children/entities/child.entity';
import { CreateSnackServicePeriodDto } from '../../../src/modules/snack-services/dto/create-snack-service-period.dto';

describe('SnackServicesService - UC58 Create Snack Service Period', () => {
  let service: SnackServicesService;
  let periodRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let regRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    count: jest.Mock;
  };
  let childRepo: {
    count: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    query: jest.Mock;
  };

  beforeEach(async () => {
    periodRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((dto) => ({ id: 101, ...dto })),
      save: jest.fn((entity) => Promise.resolve({ id: entity.id || 101, ...entity })),
    };
    regRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((dto) => ({ id: 501, ...dto, registeredAt: new Date() })),
      save: jest.fn((entity) => Promise.resolve({ id: entity.id || 501, ...entity, registeredAt: entity.registeredAt || new Date() })),
      count: jest.fn().mockResolvedValue(0),
    };
    childRepo = {
      count: jest.fn().mockResolvedValue(100),
      findOne: jest.fn(),
      find: jest.fn(),
      query: jest.fn().mockResolvedValue([{ parent_id: 13 }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SnackServicesService,
        {
          provide: getRepositoryToken(SnackServicePeriod),
          useValue: periodRepo,
        },
        {
          provide: getRepositoryToken(SnackRegistration),
          useValue: regRepo,
        },
        {
          provide: getRepositoryToken(Child),
          useValue: childRepo,
        },
      ],
    }).compile();

    service = module.get<SnackServicesService>(SnackServicesService);
  });

  describe('createPeriod (UC58)', () => {
    it('1. Luồng chính: Tạo đợt đăng ký mới OPEN thành công', async () => {
      // Mock existing open periods: none
      periodRepo.find.mockResolvedValue([]);

      const dto: CreateSnackServicePeriodDto = {
        name: 'Dịch vụ ăn xế Tháng 11/2026',
        periodCode: 'XGC-2026-T11',
        appliedGrades: ['TODDLER_1_2Y', 'KINDERGARTEN_3_4Y'],
        isWholeSchool: false,
        registrationStart: '2026-10-15',
        registrationEnd: '2026-10-28',
        serviceMonths: ['2026-11'],
        pricePerUnitPerDay: 20000,
        capacityMode: 'UNLIMITED',
        status: 'OPEN',
      };

      const result = await service.createPeriod(dto);

      expect(periodRepo.find).toHaveBeenCalledWith({ where: { status: 'OPEN' } });
      expect(periodRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Dịch vụ ăn xế Tháng 11/2026',
          startDate: '2026-11-01',
          endDate: '2026-11-30',
          registrationDeadline: '2026-10-28',
          feeAmount: 440000, // 20000 * 22 * 1
          status: 'OPEN',
        }),
      );
      expect(result.success).toBe(true);
      expect(result.message).toContain('Đã khởi tạo gói "Dịch vụ ăn xế Tháng 11/2026" thành công');
      expect(result.data.status).toBe('OPEN');
    });

    it('2. Luồng lưu bản nháp (DRAFT): Tạo đợt dạng DRAFT lưu thành CLOSED trong DB', async () => {
      const dto: CreateSnackServicePeriodDto = {
        name: 'Dịch vụ ăn xế Tháng 12/2026 (Nháp)',
        periodCode: 'XGC-2026-T12',
        appliedGrades: ['TODDLER_1_2Y'],
        registrationStart: '2026-11-15',
        registrationEnd: '2026-11-28',
        serviceMonths: ['2026-12'],
        pricePerUnitPerDay: 25000,
        capacityMode: 'LIMITED',
        totalQuota: 50,
        status: 'DRAFT',
      };

      const result = await service.createPeriod(dto);

      expect(periodRepo.find).not.toHaveBeenCalled(); // Draft does not check conflict
      expect(periodRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'CLOSED',
          feeAmount: 550000, // 25000 * 22
        }),
      );
      expect(result.success).toBe(true);
      expect(result.message).toContain('Đã lưu bản nháp gói');
      expect(result.data.status).toBe('DRAFT');
    });

    it('3. Ngoại lệ: Ngày kết thúc nhận đơn <= ngày bắt đầu nhận đơn', async () => {
      const dto: CreateSnackServicePeriodDto = {
        name: 'Đợt lỗi ngày',
        registrationStart: '2026-10-28',
        registrationEnd: '2026-10-20', // end < start
        serviceMonths: ['2026-11'],
        status: 'OPEN',
      };

      await expect(service.createPeriod(dto)).rejects.toThrow(
        new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu'),
      );
    });

    it('4. Ngoại lệ: Chưa chọn ít nhất 1 tháng phục vụ (mảng rỗng)', async () => {
      const dto: CreateSnackServicePeriodDto = {
        name: 'Đợt không chọn tháng',
        registrationStart: '2026-10-15',
        registrationEnd: '2026-10-28',
        serviceMonths: [],
        status: 'OPEN',
      };

      await expect(service.createPeriod(dto)).rejects.toThrow(
        new BadRequestException('Vui lòng chọn ít nhất 1 tháng phục vụ'),
      );
    });

    it('5. Ngoại lệ: Chọn Giới hạn chỗ nhưng không nhập tổng chỉ tiêu', async () => {
      const dto: CreateSnackServicePeriodDto = {
        name: 'Đợt giới hạn thiếu quota',
        registrationStart: '2026-10-15',
        registrationEnd: '2026-10-28',
        serviceMonths: ['2026-11'],
        capacityMode: 'LIMITED',
        totalQuota: 0,
        status: 'OPEN',
      };

      await expect(service.createPeriod(dto)).rejects.toThrow(
        new BadRequestException('Vui lòng nhập tổng chỉ tiêu'),
      );
    });

    it('6. Ngoại lệ: Trùng lặp đợt đang OPEN cùng tháng phục vụ', async () => {
      // Existing open period in November 2026
      periodRepo.find.mockResolvedValue([
        {
          id: 1,
          name: 'Đợt tháng 11 cũ',
          startDate: '2026-11-01',
          endDate: '2026-11-30',
          status: 'OPEN',
        },
      ]);

      const dto: CreateSnackServicePeriodDto = {
        name: 'Đợt tháng 11 mới',
        registrationStart: '2026-10-15',
        registrationEnd: '2026-10-28',
        serviceMonths: ['2026-11'],
        status: 'OPEN',
      };

      await expect(service.createPeriod(dto)).rejects.toThrow(
        new BadRequestException(
          'Đã tồn tại đợt đăng ký đang mở cho tháng phục vụ này. Vui lòng đóng đợt cũ trước khi tạo đợt mới.',
        ),
      );
    });
  describe('updatePeriod (UC59)', () => {
    const mockExistingPeriod = {
      id: 1,
      name: 'Gói Năng Lượng Chiều',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      registrationDeadline: '2026-10-28',
      feeAmount: 440000,
      status: 'OPEN',
      registrations: [],
    };

    it('1. Luồng chính: Cập nhật thành công cấu hình gói dịch vụ', async () => {
      periodRepo.findOne.mockResolvedValue({ ...mockExistingPeriod });

      const dto = {
        name: 'Gói Năng Lượng Chiều Plus',
        pricePerUnit: 25000,
        startDate: '2026-11-05',
        endDate: '2026-11-30',
        serviceType: 'PREMIUM_MILK',
        billingCycle: 'MONTHLY',
        description: 'Thực đơn sữa hạt cao cấp bổ sung DHA',
      };

      const result = await service.updatePeriod(1, dto);

      expect(periodRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['registrations'],
      });
      expect(periodRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Gói Năng Lượng Chiều Plus',
          startDate: '2026-11-05',
          feeAmount: 550000, // 25000 * 22
        }),
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe('Cập nhật cấu hình gói dịch vụ ăn sáng thành công!');
      expect(result.data.name).toBe('Gói Năng Lượng Chiều Plus');
    });

    it('2. Ngoại lệ: Không tìm thấy gói dịch vụ theo ID', async () => {
      periodRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updatePeriod(999, { name: 'Gói mới' }),
      ).rejects.toThrow(new NotFoundException('Không tìm thấy gói dịch vụ ăn xế'));
    });

    it('3. Ngoại lệ: Tên gói để trống', async () => {
      periodRepo.findOne.mockResolvedValue({ ...mockExistingPeriod });

      await expect(
        service.updatePeriod(1, { name: '   ' }),
      ).rejects.toThrow(new BadRequestException('Vui lòng nhập tên gói dịch vụ'));
    });

    it('4. Ngoại lệ: Đơn giá nhập âm', async () => {
      periodRepo.findOne.mockResolvedValue({ ...mockExistingPeriod });

      await expect(
        service.updatePeriod(1, { pricePerUnit: -1000 }),
      ).rejects.toThrow(new BadRequestException('Đơn giá không được âm'));
    });

    it('5. Ngoại lệ: Ngày kết thúc trước ngày bắt đầu', async () => {
      periodRepo.findOne.mockResolvedValue({ ...mockExistingPeriod });

      await expect(
        service.updatePeriod(1, {
          startDate: '2026-11-20',
          endDate: '2026-11-10',
        }),
      ).rejects.toThrow(new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu'));
    });

    it('6. Cảnh báo: Đã có trẻ thanh toán (PAID) khi giảm đơn giá', async () => {
      periodRepo.findOne.mockResolvedValue({
        ...mockExistingPeriod,
        feeAmount: 500000,
        registrations: [
          { id: 1, status: 'PAID' },
          { id: 2, status: 'PAID' },
          { id: 3, status: 'PENDING' },
        ],
      });

      const dto = {
        pricePerUnit: 15000, // 15000 * 22 = 330000 < 500000
      };

      const result = await service.updatePeriod(1, dto);

      expect(result.success).toBe(true);
      expect(result.warning).toBe(
        'Đã có 2 trẻ đã thanh toán. Thay đổi đơn giá sẽ ảnh hưởng đến các kỳ tính phí kế tiếp',
      );
    });

    it('7. Ngoại lệ: Đợt đã CLOSED và có đăng ký PAID không cho phép sửa đơn giá', async () => {
      periodRepo.findOne.mockResolvedValue({
        ...mockExistingPeriod,
        status: 'CLOSED',
        registrations: [{ id: 1, status: 'PAID' }],
      });

      await expect(
        service.updatePeriod(1, { pricePerUnit: 25000 }),
      ).rejects.toThrow(
        new BadRequestException(
          'Đợt dịch vụ đã đóng và có học sinh đã thanh toán, không thể chỉnh sửa đơn giá',
        ),
      );
    });
  });
  describe('closePeriod, openPeriod, togglePeriod (UC60)', () => {
    const mockPeriod = {
      id: 1,
      name: 'Gói Năng Lượng Chiều',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      status: 'OPEN',
      registrations: [],
    };

    it('1. Luồng chính: Đóng đợt thành công và chốt danh sách phục vụ cho bếp', async () => {
      periodRepo.findOne.mockResolvedValue({
        ...mockPeriod,
        status: 'OPEN',
        registrations: [{ id: 1, status: 'PAID' }, { id: 2, status: 'PAID' }],
      });

      const result = await service.closePeriod(1);

      expect(periodRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          status: 'CLOSED',
        }),
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe("Đã đóng đợt đăng ký cho 'Gói Năng Lượng Chiều'. Phụ huynh sẽ không thấy gói này nữa.");
      expect(result.data.status).toBe('CLOSED');
      expect(result.data.rosterClosed).toBe(true);
      expect(result.data.paidCount).toBe(2);
    });

    it('2. Cảnh báo: Đóng đợt khi chưa có phụ huynh nào đăng ký', async () => {
      periodRepo.findOne.mockResolvedValue({
        ...mockPeriod,
        status: 'OPEN',
        registrations: [],
      });

      const result = await service.closePeriod(1);

      expect(result.success).toBe(true);
      expect(result.warning).toBe('Chưa có phụ huynh nào đăng ký trong đợt này');
    });

    it('3. Cảnh báo: Đóng đợt khi vẫn còn đơn PENDING (chưa thanh toán)', async () => {
      periodRepo.findOne.mockResolvedValue({
        ...mockPeriod,
        status: 'OPEN',
        registrations: [
          { id: 1, status: 'PAID' },
          { id: 2, status: 'PENDING' },
          { id: 3, status: 'PENDING' },
        ],
      });

      const result = await service.closePeriod(1);

      expect(result.success).toBe(true);
      expect(result.warning).toBe(
        'Còn 2 đơn chờ thanh toán (PENDING). Danh sách chốt phục vụ gồm 1 học sinh đã thanh toán.',
      );
    });

    it('4. Ngoại lệ: Báo lỗi 404 khi không tìm thấy đợt dịch vụ', async () => {
      periodRepo.findOne.mockResolvedValue(null);

      await expect(service.closePeriod(999)).rejects.toThrow(
        new NotFoundException('Không tìm thấy kỳ dịch vụ ăn xế'),
      );
    });

    it('5. Luồng thay thế: Mở lại đợt (openPeriod) thành công khi không có trùng tháng', async () => {
      periodRepo.findOne.mockResolvedValue({
        ...mockPeriod,
        status: 'CLOSED',
      });
      periodRepo.find.mockResolvedValue([]); // Không có đợt khác OPEN

      const result = await service.openPeriod(1);

      expect(periodRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          status: 'OPEN',
        }),
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe("Đã mở lại đợt đăng ký cho 'Gói Năng Lượng Chiều'. Phụ huynh có thể tiếp tục đăng ký.");
      expect(result.data.status).toBe('OPEN');
    });

    it('6. Ngoại lệ: Không cho phép mở lại đợt nếu đã có đợt khác đang OPEN cùng tháng', async () => {
      periodRepo.findOne.mockResolvedValue({
        ...mockPeriod,
        id: 1,
        status: 'CLOSED',
      });
      // Đã có đợt id 2 đang OPEN cùng tháng 11/2026
      periodRepo.find.mockResolvedValue([
        {
          id: 2,
          name: 'Đợt tháng 11 số 2',
          startDate: '2026-11-01',
          endDate: '2026-11-30',
          status: 'OPEN',
        },
      ]);

      await expect(service.openPeriod(1)).rejects.toThrow(
        new BadRequestException(
          'Đã tồn tại đợt đăng ký khác đang mở cho tháng phục vụ này. Vui lòng đóng đợt cũ trước khi mở lại đợt này.',
        ),
      );
    });

    it('7. Toggle trạng thái: Chuyển từ OPEN sang CLOSED và ngược lại', async () => {
      // Step A: Currently OPEN -> calls closePeriod
      periodRepo.findOne.mockResolvedValue({
        ...mockPeriod,
        status: 'OPEN',
        registrations: [{ id: 1, status: 'PAID' }],
      });

      const resultClosed = await service.togglePeriod(1);
      expect(resultClosed.data.status).toBe('CLOSED');

      // Step B: Currently CLOSED -> calls openPeriod
      periodRepo.findOne.mockResolvedValue({
        ...mockPeriod,
        status: 'CLOSED',
      });
      periodRepo.find.mockResolvedValue([]);

      const resultOpen = await service.togglePeriod(1);
      expect(resultOpen.data.status).toBe('OPEN');
    });
  });
});

  describe('registerEnrollment & checkAllergy (UC61)', () => {
    const mockOpenPeriod = {
      id: 1,
      name: 'Gói Ăn Xế Chiều: Sữa tươi & Bánh ngũ cốc',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      registrationDeadline: '2026-11-25',
      feeAmount: 550000,
      status: 'OPEN',
      registrations: [],
    };

    const mockChildNoAllergy = {
      id: 10,
      fullName: 'Bé Nguyễn An',
      studentCode: 'HS-0010',
      class: { name: 'Mầm 1' },
      allergies: [],
    };

    const mockChildSafeAllergy = {
      id: 11,
      fullName: 'Bé Trần Bình',
      studentCode: 'HS-0011',
      class: { name: 'Chồi 2' },
      allergies: [
        {
          id: 1,
          severity: 'LOW',
          allergen: { id: 5, name: 'Hải sản', code: 'SEAFOOD' },
        },
      ],
    };

    const mockChildDangerAllergy = {
      id: 12,
      fullName: 'Bé Lê Cường',
      studentCode: 'HS-0012',
      class: { name: 'Lá 1' },
      allergies: [
        {
          id: 2,
          severity: 'HIGH',
          allergen: { id: 1, name: 'Sữa bò', code: 'MILK' },
        },
      ],
    };

    it('1. Đăng ký thành công cho trẻ KHÔNG có dị ứng (status: PENDING)', async () => {
      periodRepo.findOne.mockResolvedValue({ ...mockOpenPeriod });
      childRepo.findOne.mockResolvedValue({ ...mockChildNoAllergy });
      regRepo.findOne.mockResolvedValue(null);

      const result = await service.registerEnrollment({
        periodId: 1,
        studentId: 10,
      });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('PENDING');
      expect(result.data.studentName).toBe('Bé Nguyễn An');
      expect(result.data.hasAllergy).toBe(false);
      expect(regRepo.save).toHaveBeenCalled();
    });

    it('2. Đăng ký thành công cho trẻ CÓ dị ứng nhưng thực đơn AN TOÀN (cảnh báo nhẹ)', async () => {
      periodRepo.findOne.mockResolvedValue({ ...mockOpenPeriod });
      childRepo.findOne.mockResolvedValue({ ...mockChildSafeAllergy });
      regRepo.findOne.mockResolvedValue(null);

      const result = await service.registerEnrollment({
        periodId: 1,
        studentId: 11,
      });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('PENDING');
      expect(result.warning).toContain('Trẻ có hồ sơ dị ứng (Hải sản) - Bếp đã được thông báo');
      expect(result.data.hasAllergy).toBe(true);
    });

    it('3. Ngoại lệ: Từ chối đăng ký khi trẻ CÓ dị ứng NGUY HIỂM xung đột thực đơn (acceptRisk = false)', async () => {
      periodRepo.findOne.mockResolvedValue({ ...mockOpenPeriod });
      childRepo.findOne.mockResolvedValue({ ...mockChildDangerAllergy });
      regRepo.findOne.mockResolvedValue(null);

      await expect(
        service.registerEnrollment({
          periodId: 1,
          studentId: 12,
          acceptRisk: false,
        }),
      ).rejects.toThrow(
        new BadRequestException('Thực đơn không phù hợp với hồ sơ dị ứng của trẻ: Sữa bò'),
      );
    });

    it('4. Đăng ký thành công khi trẻ CÓ dị ứng nguy hiểm NHƯNG có ký xác nhận chấp nhận rủi ro (acceptRisk = true)', async () => {
      periodRepo.findOne.mockResolvedValue({ ...mockOpenPeriod });
      childRepo.findOne.mockResolvedValue({ ...mockChildDangerAllergy });
      regRepo.findOne.mockResolvedValue(null);

      const result = await service.registerEnrollment({
        periodId: 1,
        studentId: 12,
        acceptRisk: true,
      });

      expect(result.success).toBe(true);
      expect(result.warning).toContain('chấp nhận rủi ro');
      expect(result.data.hasAllergy).toBe(true);
    });

    it('5. Ngoại lệ: Từ chối đăng ký khi đợt dịch vụ đã CLOSED', async () => {
      periodRepo.findOne.mockResolvedValue({
        ...mockOpenPeriod,
        status: 'CLOSED',
      });

      await expect(
        service.registerEnrollment({
          periodId: 1,
          studentId: 10,
        }),
      ).rejects.toThrow(
        new BadRequestException('Đã hết thời gian đăng ký (đợt dịch vụ đã đóng)'),
      );
    });

    it('6. Ngoại lệ: Từ chối đăng ký khi quá hạn nhận đơn (registrationDeadline)', async () => {
      periodRepo.findOne.mockResolvedValue({
        ...mockOpenPeriod,
        registrationDeadline: '2026-10-01', // Past deadline
      });

      await expect(
        service.registerEnrollment({
          periodId: 1,
          studentId: 10,
        }),
      ).rejects.toThrow(new BadRequestException('Đã hết thời gian đăng ký'));
    });

    it('7. Ngoại lệ: Từ chối đăng ký khi bé đã có đăng ký PAID trong đợt này', async () => {
      periodRepo.findOne.mockResolvedValue({ ...mockOpenPeriod });
      childRepo.findOne.mockResolvedValue({ ...mockChildNoAllergy });
      regRepo.findOne.mockResolvedValue({
        id: 99,
        periodId: 1,
        studentId: 10,
        status: 'PAID',
      });

      await expect(
        service.registerEnrollment({
          periodId: 1,
          studentId: 10,
        }),
      ).rejects.toThrow(new BadRequestException('Bé đã đăng ký và thanh toán thành công rồi'));
    });

    it('8. Trả về đơn hiện tại khi bé có đơn PENDING (không tạo đơn trùng lặp)', async () => {
      periodRepo.findOne.mockResolvedValue({ ...mockOpenPeriod });
      childRepo.findOne.mockResolvedValue({ ...mockChildNoAllergy });
      regRepo.findOne.mockResolvedValue({
        id: 88,
        periodId: 1,
        studentId: 10,
        status: 'PENDING',
        registeredAt: new Date('2026-10-20'),
      });

      const result = await service.registerEnrollment({
        periodId: 1,
        studentId: 10,
      });

      expect(result.success).toBe(true);
      expect(result.isExisting).toBe(true);
      expect(result.data.status).toBe('PENDING');
      expect(result.message).toContain('đang chờ thanh toán');
    });

    it('9. Ngoại lệ: Từ chối đăng ký khi vượt quá chỉ tiêu tiếp nhận (quota limit)', async () => {
      const fullRegistrations = Array.from({ length: 30 }, (_, i) => ({
        id: i + 1,
        status: 'PAID',
      }));

      periodRepo.findOne.mockResolvedValue({
        ...mockOpenPeriod,
        registrations: fullRegistrations,
      });
      childRepo.findOne.mockResolvedValue({ ...mockChildNoAllergy });
      regRepo.findOne.mockResolvedValue(null);

      await expect(
        service.registerEnrollment({
          periodId: 1,
          studentId: 10,
        }),
      ).rejects.toThrow(
        new BadRequestException('Đã đủ chỉ tiêu cho khối lớp của bé. Liên hệ nhà trường để được hỗ trợ'),
      );
    });

    it('10. Xác nhận thanh toán thành công (confirmPayment) cập nhật status = PAID', async () => {
      regRepo.findOne.mockResolvedValue({
        id: 77,
        periodId: 1,
        studentId: 10,
        status: 'PENDING',
        student: { fullName: 'Bé Nguyễn An' },
        period: { name: 'Gói Ăn Xế Chiều' },
      });

      const result = await service.confirmPayment(77);
      expect(result.success).toBe(true);
      expect(result.data.status).toBe('PAID');
      expect(result.message).toContain('Bé Nguyễn An đã được đăng ký thành công');
      expect(regRepo.save).toHaveBeenCalled();
    });
  });


});
