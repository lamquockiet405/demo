import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { UpdateProfileDto } from '../dto/update-profile.dto';

@Injectable()
export class UserProfileService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * UC05: Xem thông tin hồ sơ cá nhân của tài khoản đang đăng nhập
   */
  async getProfile(userId: number) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['roles'],
    });
    if (!user) {
      throw new NotFoundException('Không tìm thấy thông tin tài khoản');
    }

    return {
      id: String(user.id),
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      avatarUrl: user.avatar,
      status: user.status,
      roles: user.roles?.map((r) => r.code) || [],
      roleDetails: user.roles?.map((r) => ({ id: String(r.id), code: r.code, name: r.name })) || [],
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      twoFactorEnabled: false,
    };
  }

  /**
   * UC06: Chỉnh sửa thông tin hồ sơ cá nhân (Họ tên, SĐT, Avatar)
   */
  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Không tìm thấy thông tin tài khoản');
    }

    if (dto.fullName !== undefined) user.fullName = dto.fullName.trim();
    if (dto.phone !== undefined) user.phone = dto.phone.trim();
    if (dto.avatar !== undefined) user.avatar = dto.avatar;
    if (dto.avatarUrl !== undefined) user.avatar = dto.avatarUrl;

    // Tránh TypeORM re-insert vào bảng user_roles gây duplicate key user_roles_pkey
    delete (user as any).roles;

    await this.userRepo.save(user);
    return this.getProfile(userId);
  }
}
