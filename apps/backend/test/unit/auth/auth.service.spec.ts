import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../../src/modules/auth/services/auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../../src/modules/auth/entities/user.entity';
import { Role } from '../../../src/modules/auth/entities/role.entity';
import { SchoolTenant } from '../../../src/modules/auth/entities/tenant.entity';

describe('AuthService', () => {
  let service: AuthService;
  let mockUserRepo: any;
  let mockJwtService: any;

  const mockUser = {
    id: 1,
    email: 'hieutruong@huongduong.edu.vn',
    fullName: 'Bà Nguyễn Thị Lan',
    status: 'ACTIVE',
    passwordHash: '$2b$12$mock',
    roles: [{ code: 'SCHOOL_MANAGER', name: 'Ban Giám hiệu' }],
  };

  beforeEach(async () => {
    mockUserRepo = {
      findOne: jest.fn().mockResolvedValue(mockUser),
      save: jest.fn(),
      update: jest.fn(),
      query: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn().mockReturnValue({
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockUser),
      }),
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(null) } },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Role), useValue: {} },
        { provide: getRepositoryToken(SchoolTenant), useValue: {} },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate tokens for valid user login', async () => {
    const result = await service.quickLogin({ roleCode: 'SCHOOL_MANAGER' });
    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('user');
    expect(result.user.roles).toContain('SCHOOL_MANAGER');
  });

  const teacher = () => ({ ...mockUser, id: 7, roles: [{ code: 'TEACHER', name: 'Giáo viên' }] });

  it('rejects teacher login without an assigned class before issuing tokens or updating last login', async () => {
    mockUserRepo.findOne.mockResolvedValue(teacher());
    await expect(service.login({ email: 'teacher@example.com', password: '123456' }, 2))
      .rejects.toThrow('chưa được phân công lớp');
    expect(mockUserRepo.query).toHaveBeenCalledWith(expect.stringContaining("c.status = 'ACTIVE' AND y.status = 'ACTIVE'"), [7, 2]);
    expect(mockJwtService.sign).not.toHaveBeenCalled();
    expect(mockUserRepo.update).not.toHaveBeenCalled();
  });

  it('allows a teacher assigned to an active class to log in', async () => {
    mockUserRepo.findOne.mockResolvedValue(teacher());
    mockUserRepo.query.mockResolvedValue([{ id: 12 }]);
    const result = await service.login({ email: 'teacher@example.com', password: '123456' }, 2);
    expect(result.user.roles).toContain('TEACHER');
    expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
    expect(mockUserRepo.update).toHaveBeenCalledWith(7, expect.objectContaining({ lastLoginAt: expect.any(Date) }));
  });

  it('does not let quick login bypass the teacher class requirement', async () => {
    mockUserRepo.createQueryBuilder().getOne.mockResolvedValue(teacher());
    await expect(service.quickLogin({ roleCode: 'TEACHER', tenantId: 2 } as any)).rejects.toThrow('chưa được phân công lớp');
    expect(mockJwtService.sign).not.toHaveBeenCalled();
  });

  it('does not renew tokens after the teacher has lost their class assignment', async () => {
    mockUserRepo.findOne.mockResolvedValue(teacher());
    mockJwtService.verify.mockReturnValue({ sub: 7, tenantId: 2 });
    await expect(service.refreshToken('refresh-token')).rejects.toThrow();
    expect(mockJwtService.sign).not.toHaveBeenCalled();
    expect(mockUserRepo.query).toHaveBeenCalledWith(expect.any(String), [7, 2]);
  });

  it('does not require a class assignment for a school manager', async () => {
    const result = await service.login({ email: mockUser.email, password: '123456' });
    expect(result.accessToken).toBeTruthy();
    expect(mockUserRepo.query).not.toHaveBeenCalled();
  });
});
