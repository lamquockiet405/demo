import { Test, TestingModule } from '@nestjs/testing';
import { UserProfileService } from '../../../src/modules/users/services/user-profile.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../../src/modules/auth/entities/user.entity';
import { NotFoundException } from '@nestjs/common';

describe('UserProfileService (UC05: View Profile, UC06: Edit Profile)', () => {
  let service: UserProfileService;
  let mockUserRepo: any;

  const mockUser = {
    id: 1,
    email: 'hieutruong@huongduong.edu.vn',
    fullName: 'Bà Nguyễn Thị Lan',
    phone: '0901234567',
    avatar: 'https://example.com/avatar.jpg',
    status: 'ACTIVE',
    roles: [{ id: 1, code: 'SCHOOL_MANAGER', name: 'Quản lý trường' }],
    lastLoginAt: new Date('2026-10-15T08:00:00Z'),
  };

  beforeEach(async () => {
    mockUserRepo = {
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (where && where.id === 1) {
          return Promise.resolve({ ...mockUser });
        }
        return Promise.resolve(null);
      }),
      save: jest.fn().mockImplementation((u) => Promise.resolve(u)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserProfileService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
      ],
    }).compile();

    service = module.get<UserProfileService>(UserProfileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('UC05 - getProfile (Xem thông tin cá nhân)', () => {
    it('lấy thành công thông tin hồ sơ của tài khoản đang đăng nhập', async () => {
      const profile = await service.getProfile(1);
      expect(profile).toBeDefined();
      expect(profile.id).toBe('1');
      expect(profile.email).toBe('hieutruong@huongduong.edu.vn');
      expect(profile.fullName).toBe('Bà Nguyễn Thị Lan');
      expect(profile.phone).toBe('0901234567');
      expect(profile.avatarUrl).toBe('https://example.com/avatar.jpg');
      expect(profile.roles).toContain('SCHOOL_MANAGER');
    });

    it('báo lỗi NotFoundException khi không tìm thấy tài khoản', async () => {
      await expect(service.getProfile(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('UC06 - updateProfile (Cập nhật thông tin cá nhân)', () => {
    it('cập nhật thành công họ tên và số điện thoại', async () => {
      const result = await service.updateProfile(1, {
        fullName: 'Nguyễn Thị Hương Lan',
        phone: '0987654321',
      });
      expect(mockUserRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('cập nhật thành công ảnh đại diện (avatar)', async () => {
      const result = await service.updateProfile(1, {
        avatar: 'https://example.com/new-avatar.png',
      });
      expect(mockUserRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('báo lỗi NotFoundException khi cập nhật tài khoản không tồn tại', async () => {
      await expect(
        service.updateProfile(999, { fullName: 'Không tồn tại' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
