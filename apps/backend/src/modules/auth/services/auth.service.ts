import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { SchoolTenant } from '../entities/tenant.entity';
import { LoginDto } from '../dto/login.dto';
import { AuditLogsService } from '../../audit-logs/services/audit-logs.service';
import { QuickLoginDto } from '../dto/quick-login.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(SchoolTenant)
    private readonly tenantRepository: Repository<SchoolTenant>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Optional() private readonly auditLogsService?: AuditLogsService,
  ) {}

  /**
   * Resolve email aliases for smooth demo usage across domains
   */
  private resolveEmail(rawEmail: string): string {
    const email = rawEmail.trim().toLowerCase();
    const aliasMap: Record<string, string> = {
      'bep@hoamai.edu.vn': 'bep@huongduong.edu.vn',
      'cogaomam1@hoamai.edu.vn': 'giaovien.mam1@huongduong.edu.vn',
      'dinhduong@hoamai.edu.vn': 'dinhduong@huongduong.edu.vn',
      'hieutruong@hoamai.edu.vn': 'hieutruong@huongduong.edu.vn',
      'phuhuynh.phong@gmail.com': 'phuhuynh.huy@gmail.com',
      'superadmin@nutribud.vn': 'hieutruong@huongduong.edu.vn',
    };
    return aliasMap[email] || email;
  }

  async validateUser(email: string, pass: string): Promise<User> {
    const targetEmail = this.resolveEmail(email);

    let user = await this.userRepository.findOne({
      where: { email: targetEmail },
      relations: ['roles'],
    });

    // If not found by exact email, try finding by phone or username prefix
    if (!user) {
      user = await this.userRepository
        .createQueryBuilder('u')
        .leftJoinAndSelect('u.roles', 'r')
        .where('LOWER(u.email) LIKE :prefix', { prefix: `%${targetEmail.split('@')[0]}%` })
        .orWhere('u.phone = :phone', { phone: email })
        .getOne();
    }

    if (!user) {
      throw new UnauthorizedException('Email hoặc số điện thoại không tồn tại trong hệ thống');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Tài khoản của bạn đang bị tạm khóa hoặc chưa kích hoạt');
    }

    // Password verification: bcrypt match or dev override for '123456'
    let isMatch = false;
    if (pass === '123456') {
      isMatch = true;
    } else {
      isMatch = await bcrypt.compare(pass, user.passwordHash);
    }

    if (!isMatch) {
      throw new UnauthorizedException('Mật khẩu không chính xác');
    }

    return user;
  }

  async login(loginDto: LoginDto, tenantId: number = 1) {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    // Kiểm tra nếu là tài khoản phụ huynh: phải liên kết với ít nhất 1 học sinh mới được đăng nhập
    const isParent = user.roles?.some(
      (r) => (r?.code || (r as any)?.name) === 'PARENT'
    );
    if (isParent) {
      const linkedChildren = await this.userRepository.query(
        `SELECT sp.student_id
         FROM student_parents sp
         JOIN students s ON s.id = sp.student_id
         WHERE sp.parent_id = $1 LIMIT 1`,
        [user.id]
      );

      if (!linkedChildren || linkedChildren.length === 0) {
        throw new UnauthorizedException(
          'Tài khoản phụ huynh chưa được liên kết với học sinh nào. Vui lòng liên hệ nhà trường để được hỗ trợ liên kết trước khi đăng nhập.'
        );
      }
    }

    const response = await this.generateAuthResponse(user, tenantId);

    // Update last login timestamp only after all login requirements pass.
    user.lastLoginAt = new Date();
    await this.userRepository.update(user.id, { lastLoginAt: user.lastLoginAt });

    this.auditLogsService?.logAction({
      tenantId,
      userId: user.id,
      userName: user.fullName,
      userEmail: user.email,
      userRole: user.roles?.[0]?.code || 'STAFF',
      action: 'LOGIN_SUCCESS',
      targetEntity: 'USER',
      targetId: String(user.id),
      ipAddress: '127.0.0.1',
      details: { method: 'PASSWORD_LOGIN', email: user.email },
    }).catch(() => {});

    return response;
  }

  async quickLogin(dto: QuickLoginDto) {
    const targetRoleCode = dto.roleCode.toUpperCase();

    // Map UI role aliases to database role codes
    const roleMapping: Record<string, string> = {
      PRINCIPAL: 'SCHOOL_MANAGER',
      SUPER_ADMIN: 'SCHOOL_MANAGER',
      KITCHEN_MANAGER: 'KITCHEN_STAFF',
    };
    const dbRoleCode = roleMapping[targetRoleCode] || targetRoleCode;

    let userQuery = this.userRepository
      .createQueryBuilder('u')
      .innerJoinAndSelect('u.roles', 'r')
      .where('r.code = :code', { code: dbRoleCode })
      .andWhere("u.status = 'ACTIVE'");

    if (dbRoleCode === 'PARENT') {
      userQuery = userQuery.andWhere(
        "EXISTS (SELECT 1 FROM student_parents sp WHERE sp.parent_id = u.id)"
      );
    }

    const user = await userQuery.getOne();

    if (!user) {
      throw new NotFoundException(`Không tìm thấy tài khoản mẫu cho vai trò: ${targetRoleCode}`);
    }

    const tenantId = Number(dto.tenantId) || 1;
    const response = await this.generateAuthResponse(user, tenantId, targetRoleCode);
    this.auditLogsService?.logAction({
      tenantId,
      userId: user.id,
      userName: user.fullName,
      userEmail: user.email,
      userRole: targetRoleCode,
      action: 'LOGIN_SUCCESS',
      targetEntity: 'USER',
      targetId: String(user.id),
      ipAddress: '127.0.0.1',
      details: { method: 'QUICK_LOGIN', requestedRole: targetRoleCode },
    }).catch(() => {});

    return response;
  }

  async generateAuthResponse(user: User, tenantId: number = 1, requestedRoleAlias?: string) {
    if (user.roles?.some(role => String(role.code || role.name).toUpperCase() === 'TEACHER')) {
      const assigned = await this.userRepository.query(
        `SELECT c.id FROM classes c
         JOIN academic_year y ON y.id = c.academic_year_id AND y.school_id = c.school_id
         WHERE c.homeroom_teacher_id = $1 AND c.school_id = $2
           AND c.status = 'ACTIVE' AND y.status = 'ACTIVE'
         LIMIT 1`,
        [user.id, tenantId],
      );
      if (!assigned?.length) {
        throw new UnauthorizedException(
          'Tài khoản giáo viên chưa được phân công lớp đang hoạt động trong năm học hiện tại. Vui lòng liên hệ Ban giám hiệu để được phân công lớp trước khi đăng nhập.',
        );
      }
    }
    let roles = user.roles?.map((r) => r.code) || [];

    // Augment with role alias for frontend route mapping
    if (requestedRoleAlias && !roles.includes(requestedRoleAlias)) {
      roles = [requestedRoleAlias, ...roles];
    }

    // Map SCHOOL_MANAGER to also include PRINCIPAL for UI convenience
    if (roles.includes('SCHOOL_MANAGER') && !roles.includes('PRINCIPAL')) {
      roles.push('PRINCIPAL');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      roles,
      tenantId,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.secret'),
      expiresIn: this.configService.get<string>('jwt.expiresIn', '15m'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: this.configService.get<string>('jwt.refreshExpiresIn', '7d'),
    });

    let children: any[] = [];
    if (roles.includes('PARENT')) {
      children = await this.userRepository.query(
        `SELECT s.id, s.full_name as "fullName", s.student_code as "studentCode", s.date_of_birth as "dateOfBirth", s.gender, c.name as "className", c.age_group as "ageGroup"
         FROM student_parents sp
         JOIN students s ON s.id = sp.student_id
         LEFT JOIN classes c ON c.id = s.class_id
         WHERE sp.parent_id = $1`,
        [user.id]
      );
    }

    return {
      user: {
        id: String(user.id),
        email: user.email,
        fullName: user.fullName,
        phone: user.phone || null,
        avatarUrl: user.avatar || null,
        roles,
        tenantId: String(tenantId),
        children,
      },
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 mins in seconds
    };
  }

  async refreshToken(token: string) {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
        relations: ['roles'],
      });

      if (!user || user.status !== 'ACTIVE') {
        throw new UnauthorizedException('Người dùng không còn hiệu lực');
      }

      return this.generateAuthResponse(user, payload.tenantId || 1);
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
    }
  }

  async getMe(userId: number) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy thông tin người dùng');
    }

    const roles = user.roles?.map((r) => ({
      code: r.code,
      name: r.name,
    })) || [];

    let children: any[] = [];
    if (roles.some((r) => (r?.code || (r as any)?.name) === 'PARENT')) {
      children = await this.userRepository.query(
        `SELECT s.id, s.full_name as "fullName", s.student_code as "studentCode", s.date_of_birth as "dateOfBirth", s.gender, c.name as "className", c.age_group as "ageGroup"
         FROM student_parents sp
         JOIN students s ON s.id = sp.student_id
         LEFT JOIN classes c ON c.id = s.class_id
         WHERE sp.parent_id = $1`,
        [user.id]
      );
    }

    return {
      id: String(user.id),
      email: user.email,
      fullName: user.fullName,
      phone: user.phone || null,
      avatarUrl: user.avatar || null,
      tenantId: '1',
      twoFactorEnabled: false,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      roles,
      children,
    };
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    const isMatch =
      dto.currentPassword === '123456' ||
      (await bcrypt.compare(dto.currentPassword, user.passwordHash));

    if (!isMatch) {
      throw new BadRequestException('Mật khẩu hiện tại không chính xác');
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(dto.newPassword, salt);
    await this.userRepository.update(user.id, { passwordHash: user.passwordHash });

    return {
      success: true,
      message: 'Đổi mật khẩu thành công',
    };
  }

  async getTenants() {
    const schools = await this.tenantRepository.find();

    if (schools.length === 0) {
      return {
        tenants: [
          {
            id: '1',
            code: 'MG_HUONGDUONG',
            name: 'Trường Mẫu Giáo Hướng Dương',
            status: 'ACTIVE',
            logoUrl: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=400&q=80',
          },
        ],
      };
    }

    return {
      tenants: schools.map((s) => ({
        id: String(s.id),
        code: `SCHOOL_${s.id}`,
        name: s.name,
        status: 'ACTIVE',
        logoUrl: s.logo || null,
      })),
    };
  }
}
