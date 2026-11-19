import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { TenantService } from '../../../src/modules/tenant/services/tenant.service';
import { SchoolTenant } from '../../../src/modules/auth/entities/tenant.entity';
import { Language } from '../../../src/modules/tenant/entities/language.entity';
import { UiTranslation } from '../../../src/modules/tenant/entities/ui-translation.entity';
import { SystemConfig } from '../../../src/modules/tenant/entities/system-config.entity';

/**
 * Unit Test Suite for TenantService (UC07: Configure School Information).
 */
describe('TenantService (UC07: Configure School Information)', () => {
  let service: TenantService;
  let tenantRepo: any;

  const mockTenant: Partial<SchoolTenant> = {
    id: 1,
    name: 'Trường Mầm Non Sao Mai',
    email: 'contact@saomai.edu.vn',
    phone: '(028) 3829 4999',
    address: '128 Võ Thị Sáu, Phường Võ Thị Sáu, Quận 3, TP. Hồ Chí Minh',
    principalName: 'Nguyễn Thu Thủy',
    logo: '/assets/logo_saomai_kids.svg',
  };

  beforeEach(async () => {
    tenantRepo = {
      findOne: jest.fn().mockResolvedValue({ ...mockTenant }),
      save: jest.fn().mockImplementation((t) => Promise.resolve(t)),
      manager: {
        query: jest.fn().mockResolvedValue([{ classes: 5, children: 120, staff: 15 }]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        {
          provide: getRepositoryToken(SchoolTenant),
          useValue: tenantRepo,
        },
        {
          provide: getRepositoryToken(Language),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(UiTranslation),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(SystemConfig),
          useValue: { findOne: jest.fn().mockResolvedValue(null), save: jest.fn().mockImplementation(c => c) },
        },
      ],
    }).compile();

    service = module.get<TenantService>(TenantService);
  });

  it('nên được khởi tạo thành công', () => {
    expect(service).toBeDefined();
  });

  describe('getProfile', () => {
    it('trả về thông tin trường học đúng định dạng khi tìm thấy', async () => {
      const res = await service.getProfile(1);
      expect(res.name).toBe('Trường Mầm Non Sao Mai');
      expect(res.contactEmail).toBe('contact@saomai.edu.vn');
      expect(res.legalRepresentative.name).toBe('Nguyễn Thu Thủy');
      expect(res.stats.totalClasses).toBe(5);
    });

    it('ném lỗi NotFoundException khi không tìm thấy trường', async () => {
      tenantRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.getProfile(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('cập nhật thành công địa chỉ, hotline, giấy phép ATTP và cấu hình vận hành', async () => {
      const res = await service.updateProfile({
        address: '130 Võ Thị Sáu, Quận 3, TP.HCM',
        phone: '02838999888',
        foodSafetyLicense: {
          number: '999/2024/ATTP-Q3',
        },
        operationalSettings: {
          mealTimes: ['BREAKFAST', 'LUNCH'],
          standardWeeklyCycleLength: 2,
          foodRetentionHours: 48,
          whoZscoreAutoCalc: true,
        },
      }, 1);

      expect(tenantRepo.save).toHaveBeenCalled();
      expect(res).toBeDefined();
    });
  });

  describe('uploadLogo', () => {
    it('chấp nhận file logo hợp lệ (data:image base64 <= 2MB)', async () => {
      const res = await service.uploadLogo({
        fileName: 'new_logo.svg',
        fileSizeBytes: 145000,
        mimeType: 'image/svg+xml',
        fileContentBase64: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
      }, 1);

      expect(res.success).toBe(true);
      expect(tenantRepo.save).toHaveBeenCalled();
    });

    it('từ chối và ném lỗi BadRequestException khi upload file không có tiền tố data:image', async () => {
      await expect(
        service.uploadLogo({
          fileName: 'banner_truong_hoc_2024.bmp',
          fileSizeBytes: 84000,
          mimeType: 'image/bmp',
          fileContentBase64: 'invalid_base64_data',
        }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('từ chối và ném lỗi BadRequestException khi file vượt quá 2MB', async () => {
      await expect(
        service.uploadLogo({
          fileName: 'heavy_logo.png',
          fileSizeBytes: 3 * 1024 * 1024,
          mimeType: 'image/png',
          fileContentBase64: 'data:image/png;base64,bigcontent',
        }, 1),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('syncEducationDb', () => {
    it('ném lỗi ServiceUnavailableException khi chưa cấu hình kết nối CSDL ngành GD', async () => {
      await expect(service.syncEducationDb()).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
