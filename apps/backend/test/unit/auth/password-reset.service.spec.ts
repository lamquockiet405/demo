import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PasswordResetService } from '../../../src/modules/auth/services/password-reset.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../../src/modules/auth/entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('PasswordResetService (Forgot & Reset Password)', () => {
  let service: PasswordResetService;
  let mockUserRepo: any;
  let mockJwtService: any;
  let mockConfigService: any;

  beforeEach(async () => {
    mockUserRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((u) => Promise.resolve(u)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-reset-token'),
      verify: jest.fn().mockReturnValue({
        sub: 'user-uuid-1',
        email: 'user@example.com',
        purpose: 'reset-password',
      }),
    };

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultVal?: any) => {
        if (key === 'nodeEnv') return 'development';
        return defaultVal ?? null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<PasswordResetService>(PasswordResetService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('forgotPassword', () => {
    it('should generate OTP when forgotPassword is requested for existing user', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-uuid-1',
        email: 'user@example.com',
        fullName: 'Nguyen Van A',
        status: 'ACTIVE',
      });
      const result = await service.forgotPassword('user@example.com');
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('expiresInSeconds', 300);
    });

    it('should throw NotFoundException when email does not exist', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      await expect(service.forgotPassword('nonexistent@example.com')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('verifyResetOtp', () => {
    it('should verify valid OTP and return resetToken', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-uuid-1',
        email: 'user@example.com',
        fullName: 'Nguyen Van A',
        status: 'ACTIVE',
      });
      await service.forgotPassword('user@example.com');

      const res = await service.verifyResetOtp('user@example.com', '123456');
      expect(res.success).toBe(true);
      expect(res.resetToken).toBe('mock-reset-token');
    });

    it('should throw BadRequestException for wrong OTP', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-uuid-1',
        email: 'user@example.com',
        fullName: 'Nguyen Van A',
        status: 'ACTIVE',
      });
      await service.forgotPassword('user@example.com');

      await expect(service.verifyResetOtp('user@example.com', '000000')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('resetPassword', () => {
    it('should hash and update password when resetToken and confirmPassword are valid', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-uuid-1',
        email: 'user@example.com',
        fullName: 'Nguyen Van A',
        status: 'ACTIVE',
        roles: [{ id: 1, code: 'PRINCIPAL' }],
      });

      const res = await service.resetPassword(
        'mock-reset-token',
        'NewPassword@2026',
      );
      expect(res.success).toBe(true);
      expect(mockUserRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          passwordHash: expect.any(String),
        }),
      );
    });

    it('should throw BadRequestException when resetToken is invalid', async () => {
      mockJwtService.verify.mockImplementationOnce(() => {
        throw new Error('invalid token');
      });
      await expect(
        service.resetPassword('invalid-token', 'NewPassword@2026'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
