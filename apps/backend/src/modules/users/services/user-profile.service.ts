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

  private async resolveUserSchoolInfo(user: any) {
    const manager = (this.userRepo as any)?.manager;
    if (!manager || typeof manager.query !== 'function') {
      return null;
    }

    try {
      const userTenantId = user?.tenantId ? String(user.tenantId) : '';
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        userTenantId,
      );
      if (isUuid) {
        const rows = await manager.query(
          `SELECT id, code, name, phone, address, contact_email FROM tenants WHERE id = $1 LIMIT 1`,
          [userTenantId],
        );
        if (rows?.length) {
          const r = rows[0];
          return {
            id: String(r.id),
            code: r.code || 'SCHOOL',
            name: r.name || '',
            phone: r.phone || '',
            address: r.address || '',
            contactEmail: r.contact_email || '',
          };
        }
      }

      const tenantRows = await manager.query(
        `SELECT id, code, name, phone, address, contact_email FROM tenants ORDER BY created_at ASC LIMIT 1`,
      );
      if (tenantRows?.length) {
        const r = tenantRows[0];
        return {
          id: String(r.id),
          code: r.code || 'SCHOOL',
          name: r.name || '',
          phone: r.phone || '',
          address: r.address || '',
          contactEmail: r.contact_email || '',
        };
      }
    } catch {
      // Bảng tenants không tồn tại -> thử bảng schools
    }

    try {
      const schoolRows = await manager.query(
        `SELECT id, name, phone, address, email FROM schools ORDER BY id ASC LIMIT 1`,
      );
      if (schoolRows?.length) {
        const r = schoolRows[0];
        return {
          id: String(r.id),
          code: `SCH_${r.id}`,
          name: r.name || '',
          phone: r.phone || '',
          address: r.address || '',
          contactEmail: r.email || '',
        };
      }
    } catch {
      // Bỏ qua nếu không truy vấn được
    }

    return null;
  }

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

    const tenantInfo = await this.resolveUserSchoolInfo(user);

    return {
      id: String(user.id),
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      avatarUrl: user.avatar,
      status: user.status,
      roles: user.roles?.map((r) => r.code) || [],
      roleDetails: user.roles?.map((r) => ({ id: String(r.id), code: r.code, name: r.name })) || [],
      tenantId: (user as any).tenantId || tenantInfo?.id || null,
      tenant: tenantInfo,
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
