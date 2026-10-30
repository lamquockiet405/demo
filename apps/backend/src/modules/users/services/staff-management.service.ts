import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../../auth/entities/user.entity';
import { Role } from '../../auth/entities/role.entity';
import { Tenant } from '../../auth/entities/tenant.entity';
import { CreateStaffDto } from '../dto/staff/create-staff.dto';
import { UpdateStaffDto } from '../dto/staff/update-staff.dto';
import { QueryStaffDto } from '../dto/staff/query-staff.dto';

export interface StaffStats {
  totalStaff: number;
  activeStaff: number;
  teachers: number;
  kitchenAndNutrition: number;
  medicalStaff: number;
  inactiveOrDeleted: number;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STAFF_ROLES_SQL = `('SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_MANAGER', 'NUTRITIONIST', 'KITCHEN_MANAGER', 'KITCHEN_STAFF', 'TEACHER', 'MEDICAL_STAFF')`;
const AVAILABLE_STAFF_ROLES = [
  'PRINCIPAL',
  'SCHOOL_MANAGER',
  'NUTRITIONIST',
  'KITCHEN_MANAGER',
  'KITCHEN_STAFF',
  'TEACHER',
  'MEDICAL_STAFF',
];

@Injectable()
export class StaffManagementService {
  private cachedTenantMap = new Map<string, string>();

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @Optional()
    @InjectRepository(Tenant)
    private readonly tenantRepo?: Repository<Tenant>,
  ) {}

  private async resolveTenantId(rawTenantId: string): Promise<string> {
    const raw = String(rawTenantId || '').trim();
    if (!this.tenantRepo || UUID_REGEX.test(raw)) return raw;
    if (this.cachedTenantMap.has(raw)) return this.cachedTenantMap.get(raw)!;

    try {
      const tenants = await this.tenantRepo.find({ order: { createdAt: 'ASC' } });
      if (tenants.length > 0) {
        const idx = /^\d+$/.test(raw) ? Math.max(0, parseInt(raw, 10) - 1) : 0;
        const resolved = (tenants[idx] || tenants[0]).id;
        this.cachedTenantMap.set(raw, resolved);
        return resolved;
      }
    } catch {}
    return raw;
  }

  private toStaffDto(u: User) {
    return {
      id: u.id,
      tenantId: u.tenantId,
      email: u.email,
      fullName: u.fullName,
      phone: u.phone,
      avatarUrl: u.avatarUrl,
      status: u.status,
      twoFactorEnabled: u.twoFactorEnabled,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      deletedAt: u.deletedAt,
      isDeleted: u.deletedAt !== null && u.deletedAt !== undefined,
      roles: (u.roles || []).map((r) => ({ id: r.id, code: r.code, name: r.name })),
    };
  }

  async getStaffList(rawTenantId: string, query: QueryStaffDto) {
    const tenantId = await this.resolveTenantId(rawTenantId);
    const page = query.page || 1;
    const limit = query.limit || 10;

    const qb = this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.roles', 'r')
      .where('u.tenantId = :tenantId', { tenantId });

    if (query.includeDeleted || query.status === 'DELETED') {
      qb.withDeleted();
    }

    if (query.search?.trim()) {
      qb.andWhere(
        '(LOWER(u.fullName) LIKE :search OR LOWER(u.email) LIKE :search OR u.phone LIKE :search)',
        { search: `%${query.search.trim().toLowerCase()}%` },
      );
    }

    if (query.roleCode?.trim()) {
      qb.andWhere('r.code = :roleCode', { roleCode: query.roleCode.trim() });
    } else {
      qb.andWhere((subQb) => {
        const subQuery = subQb
          .subQuery()
          .select('ur_filter.user_id')
          .from('user_roles', 'ur_filter')
          .innerJoin('roles', 'r_filter', 'ur_filter.role_id = r_filter.id')
          .where(`r_filter.code IN ${STAFF_ROLES_SQL}`)
          .getQuery();
        return `u.id IN ${subQuery}`;
      });
    }

    if (query.status?.trim()) {
      if (query.status === 'DELETED') {
        qb.andWhere('u.deletedAt IS NOT NULL');
      } else {
        qb.andWhere('u.status = :status', { status: query.status.trim() });
      }
    }

    const validSortFields = ['fullName', 'email', 'createdAt', 'lastLoginAt'];
    const sortBy = validSortFields.includes(query.sortBy || '') ? query.sortBy : 'createdAt';
    qb.orderBy(`u.${sortBy}`, query.sortOrder === 'ASC' ? 'ASC' : 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [users, total] = await qb.getManyAndCount();

    return {
      data: users.map((u) => this.toStaffDto(u)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getStaffStats(rawTenantId: string): Promise<StaffStats> {
    const tenantId = await this.resolveTenantId(rawTenantId);
    const countWith = (roleClause: string, statusClause?: string, withDel = false) => {
      const qb = this.userRepo.createQueryBuilder('u');
      if (withDel) qb.withDeleted();
      qb.innerJoin('u.roles', 'r')
        .where('u.tenantId = :tenantId', { tenantId })
        .andWhere(roleClause);
      if (statusClause) qb.andWhere(statusClause);
      return qb.getCount();
    };

    const [
      totalStaff,
      activeStaff,
      teachers,
      kitchenAndNutrition,
      medicalStaff,
      inactiveOrDeleted,
    ] = await Promise.all([
      countWith(`r.code IN ${STAFF_ROLES_SQL}`),
      countWith(`r.code IN ${STAFF_ROLES_SQL}`, "u.status = 'ACTIVE'"),
      countWith("r.code = 'TEACHER'", "u.status = 'ACTIVE'"),
      countWith("r.code IN ('KITCHEN_MANAGER', 'KITCHEN_STAFF', 'NUTRITIONIST')", "u.status = 'ACTIVE'"),
      countWith("r.code = 'MEDICAL_STAFF'", "u.status = 'ACTIVE'"),
      countWith(`r.code IN ${STAFF_ROLES_SQL}`, "(u.status != 'ACTIVE' OR u.deletedAt IS NOT NULL)", true),
    ]);

    return {
      totalStaff,
      activeStaff,
      teachers,
      kitchenAndNutrition,
      medicalStaff,
      inactiveOrDeleted,
    };
  }

  async getAvailableStaffRoles() {
    return this.roleRepo.find({
      where: { code: In(AVAILABLE_STAFF_ROLES) },
      select: ['id', 'code', 'name', 'description'],
      order: { code: 'ASC' },
    });
  }

  async getStaffById(rawTenantId: string, id: string) {
    const tenantId = await this.resolveTenantId(rawTenantId);
    const user = await this.userRepo
      .createQueryBuilder('u')
      .withDeleted()
      .leftJoinAndSelect('u.roles', 'r')
      .where('u.id = :id AND u.tenantId = :tenantId', { id, tenantId })
      .getOne();

    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản nhân sự này trong trường.');
    }

    return this.toStaffDto(user);
  }

  async createStaff(rawTenantId: string, createDto: CreateStaffDto) {
    const tenantId = await this.resolveTenantId(rawTenantId);
    const email = createDto.email.trim().toLowerCase();

    const existingUser = await this.userRepo
      .createQueryBuilder('u')
      .withDeleted()
      .where('LOWER(u.email) = :email AND u.tenantId = :tenantId', { email, tenantId })
      .getOne();

    if (existingUser) {
      throw new ConflictException(
        existingUser.deletedAt !== null
          ? 'Email này thuộc về một tài khoản đã bị xóa mềm trước đó. Bạn có thể khôi phục tài khoản này thay vì tạo mới.'
          : 'Email này đã được sử dụng bởi một tài khoản khác trong trường.',
      );
    }

    const roles = await this.roleRepo.find({ where: { code: In(createDto.roleCodes) } });
    if (!roles?.length) {
      throw new BadRequestException('Vai trò được chọn không hợp lệ.');
    }

    const rawPassword = createDto.password?.trim() || 'Password123@';
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const savedUser = await this.userRepo.save(
      this.userRepo.create({
        tenantId,
        email,
        fullName: createDto.fullName.trim(),
        phone: createDto.phone?.trim() || null,
        passwordHash,
        status: createDto.status || 'ACTIVE',
        roles,
      }),
    );

    return {
      id: savedUser.id,
      tenantId: savedUser.tenantId,
      email: savedUser.email,
      fullName: savedUser.fullName,
      phone: savedUser.phone,
      status: savedUser.status,
      createdAt: savedUser.createdAt,
      roles: (savedUser.roles || roles).map((r) => ({ id: r.id, code: r.code, name: r.name })),
      initialPassword: rawPassword,
    };
  }

  async updateStaff(rawTenantId: string, id: string, updateDto: UpdateStaffDto) {
    const tenantId = await this.resolveTenantId(rawTenantId);
    const user = await this.userRepo
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .leftJoinAndSelect('u.roles', 'r')
      .where('u.id = :id AND u.tenantId = :tenantId', { id, tenantId })
      .getOne();

    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản nhân sự cần cập nhật.');
    }

    const prevRoles = user.roles || [];
    if (updateDto.fullName !== undefined) user.fullName = updateDto.fullName.trim();
    if (updateDto.phone !== undefined) user.phone = updateDto.phone?.trim() || null;
    if (updateDto.status !== undefined) user.status = updateDto.status;
    if (updateDto.newPassword?.trim()) {
      user.passwordHash = await bcrypt.hash(updateDto.newPassword.trim(), 10);
    }

    let resolvedRoles = prevRoles;
    if (updateDto.roleCodes?.length) {
      const nextRoles = await this.roleRepo.find({ where: { code: In(updateDto.roleCodes) } });
      if (nextRoles.length > 0) {
        resolvedRoles = nextRoles;
        const prevCodes = prevRoles.map((r) => r.code).sort().join(',');
        const nextCodes = nextRoles.map((r) => r.code).sort().join(',');
        if (prevCodes !== nextCodes) {
          user.roles = nextRoles;
        } else {
          delete (user as any).roles;
        }
      }
    } else {
      delete (user as any).roles;
    }

    const updatedUser = await this.userRepo.save(user);

    return {
      id: updatedUser.id,
      tenantId: updatedUser.tenantId,
      email: updatedUser.email,
      fullName: updatedUser.fullName,
      phone: updatedUser.phone,
      status: updatedUser.status,
      updatedAt: updatedUser.updatedAt,
      roles: (updatedUser.roles || resolvedRoles).map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
      })),
    };
  }

  async softDeleteStaff(rawTenantId: string, currentUserId: string, targetId: string) {
    if (currentUserId === targetId) {
      throw new ForbiddenException('Bạn không thể tự xóa tài khoản của chính mình.');
    }

    const tenantId = await this.resolveTenantId(rawTenantId);
    const user = await this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.roles', 'r')
      .where('u.id = :targetId AND u.tenantId = :tenantId', { targetId, tenantId })
      .getOne();

    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản nhân sự này.');
    }

    if ((user.roles || []).some((r) => r.code === 'SUPER_ADMIN')) {
      throw new ForbiddenException('Không thể xóa tài khoản Quản Trị Viên Hệ Thống.');
    }

    await this.userRepo.softDelete({ id: targetId, tenantId });
    await this.userRepo.update({ id: targetId, tenantId }, { status: 'INACTIVE' });

    return {
      success: true,
      message: `Đã chuyển nhân sự "${user.fullName}" vào danh sách lưu trữ (xóa mềm). Lịch sử dữ liệu học sinh, thực đơn và sổ kiểm thực được bảo toàn nguyên vẹn.`,
    };
  }

  async restoreStaff(rawTenantId: string, targetId: string) {
    const tenantId = await this.resolveTenantId(rawTenantId);
    const user = await this.userRepo
      .createQueryBuilder('u')
      .withDeleted()
      .where('u.id = :targetId AND u.tenantId = :tenantId', { targetId, tenantId })
      .getOne();

    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản nhân sự này.');
    }
    if (!user.deletedAt) {
      throw new BadRequestException('Tài khoản này hiện không ở trạng thái bị xóa mềm.');
    }

    await this.userRepo.restore({ id: targetId, tenantId });
    await this.userRepo.update({ id: targetId, tenantId }, { status: 'ACTIVE' });

    return {
      success: true,
      message: `Đã khôi phục tài khoản nhân sự "${user.fullName}" thành công.`,
    };
  }

  async toggleStaffStatus(rawTenantId: string, currentUserId: string, targetId: string) {
    if (currentUserId === targetId) {
      throw new ForbiddenException('Bạn không thể tự khóa tài khoản của chính mình.');
    }

    const tenantId = await this.resolveTenantId(rawTenantId);
    const user = await this.userRepo.findOne({ where: { id: targetId, tenantId } });
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản nhân sự.');
    }

    const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await this.userRepo.update({ id: targetId, tenantId }, { status: newStatus });

    return {
      success: true,
      status: newStatus,
      message: `Đã đổi trạng thái tài khoản thành ${newStatus === 'ACTIVE' ? 'Hoạt động' : 'Tạm khóa'}.`,
    };
  }
}
