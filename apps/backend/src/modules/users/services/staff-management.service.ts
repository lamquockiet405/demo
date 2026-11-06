import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { User } from "../../auth/entities/user.entity";
import { Role } from "../../auth/entities/role.entity";
import { StaffProfile } from "../entities/staff-profile.entity";
import { QueryStaffDto } from "../dto/staff/query-staff.dto";
import { CreateStaffDto } from "../dto/staff/create-staff.dto";
import { UpdateStaffDto } from "../dto/staff/update-staff.dto";

const STAFF_ROLES = [
  "TEACHER",
  "KITCHEN_STAFF",
  "NUTRITIONIST",
  "SCHOOL_MANAGER",
  "SCHOOL_MANAGEMENT",
  "PRINCIPAL",
];
@Injectable()
export class StaffManagementService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(StaffProfile)
    private readonly staffRepo: Repository<StaffProfile>,
  ) { }
  private async resolveRoles(codes: string[]) {
    if (!codes.length)
      throw new BadRequestException("Chọn ít nhất một vai trò nhân viên.");
    const roles: Role[] = [];
    for (const code of [...new Set(codes)]) {
      if (!STAFF_ROLES.includes(code))
        throw new BadRequestException("Vai trò không thuộc nhóm nhân viên.");
      const role = await this.roleRepo.findOne({ where: { code } });
      if (!role) throw new BadRequestException("Vai trò chưa được cấu hình.");
      roles.push(role);
    }
    return roles;
  }
  private map(user: User, p?: StaffProfile) {
    return {
      id: String(user.id),
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      avatarUrl: user.avatar,
      status: user.status,
      roles: (user.roles || []).map((r) => ({
        id: String(r.id),
        code: r.code,
        name: r.name,
      })),
      staffType: p?.staffType || null,
      position: p?.position || "",
      startDate: p?.startDate || null,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      isDeleted: user.status === "INACTIVE",
      deletedAt: null,
    };
  }
  async findAll(query: QueryStaffDto) {
    const qb = this.userRepo
      .createQueryBuilder("u")
      .leftJoinAndSelect("u.roles", "r")
      .innerJoin(StaffProfile, "sp", "sp.user_id=u.id");
    if (query.search)
      qb.andWhere(
        "(LOWER(u.fullName) LIKE :s OR LOWER(u.email) LIKE :s OR u.phone LIKE :s)",
        { s: "%" + query.search.toLowerCase() + "%" },
      );
    if (query.status)
      qb.andWhere("u.status=:status", {
        status: query.status === "DELETED" ? "INACTIVE" : query.status,
      });
    else if (!query.includeDeleted)
      qb.andWhere("u.status!=:status", { status: "INACTIVE" });
    const users = await qb.getMany(),
      profiles = await this.staffRepo.find();
    let items = users.map((u) =>
      this.map(
        u,
        profiles.find((p) => Number(p.userId) === Number(u.id)),
      ),
    );
    if (query.roleCode)
      items = items.filter((u) =>
        u.roles.some((r) => r.code === query.roleCode),
      );
    if (query.staffType)
      items = items.filter((u) => u.staffType === query.staffType);
    items.sort(
      (a, b) =>
        (query.sortOrder === "ASC" ? 1 : -1) *
        (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    );
    const page = query.page || 1,
      limit = query.limit || 10,
      total = items.length;
    return {
      data: items.slice((page - 1) * limit, page * limit),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }
  async findOne(id: number) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ["roles"],
    });
    const profile = await this.staffRepo.findOne({ where: { userId: id } });
    if (!user || !profile)
      throw new NotFoundException("Không tìm thấy nhân viên.");
    return this.map(user, profile);
  }
  async create(dto: CreateStaffDto) {
    if (
      await this.userRepo.findOne({
        where: { email: dto.email.trim().toLowerCase() },
      })
    )
      throw new ConflictException("Email đã được sử dụng.");
    const roles = await this.resolveRoles(
      dto.roleCodes || (dto.roleCode ? [dto.roleCode] : []),
    );
    const initialPassword =
      dto.password || randomBytes(18).toString("base64url");
    if (initialPassword.length < 8)
      throw new BadRequestException("Mật khẩu cần ít nhất 8 ký tự.");
    const user = await this.userRepo.save(
      this.userRepo.create({
        email: dto.email.trim().toLowerCase(),
        fullName: dto.fullName.trim(),
        phone: dto.phone || null,
        passwordHash: await bcrypt.hash(initialPassword, 10),
        status: dto.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
      }),
    );
    if (typeof this.userRepo.query === "function") {
      for (const role of roles) {
        await this.userRepo.query(
          `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [user.id, role.id],
        );
      }
    }
    const staffType =
      dto.staffType ||
      (roles.some((r) => r.code === "TEACHER")
        ? "TEACHER"
        : roles.some((r) => r.code === "KITCHEN_STAFF")
          ? "KITCHEN"
          : roles.some((r) => r.code === "NUTRITIONIST")
            ? "SPECIALIST"
            : "MANAGEMENT");
    await this.staffRepo.save(
      this.staffRepo.create({
        userId: user.id,
        staffType,
        position: dto.position || null,
        startDate: null,
      }),
    );
    return {
      ...(await this.findOne(user.id)),
      ...(!dto.password ? { initialPassword } : {}),
    };
  }
  async update(id: number, dto: UpdateStaffDto) {
    await this.findOne(id);
    const updateFields: Record<string, any> = {};
    if (dto.fullName !== undefined) updateFields.fullName = dto.fullName.trim();
    if (dto.phone !== undefined) updateFields.phone = dto.phone;
    if (dto.status !== undefined) {
      if (!["ACTIVE", "INACTIVE"].includes(dto.status))
        throw new BadRequestException("Trạng thái không hợp lệ.");
      updateFields.status = dto.status;
    }
    if (dto.newPassword) {
      if (dto.newPassword.length < 8)
        throw new BadRequestException("Mật khẩu cần ít nhất 8 ký tự.");
      updateFields.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    }
    if (dto.roleCode || dto.roleCodes) {
      const roles = await this.resolveRoles(dto.roleCodes || [dto.roleCode]);
      if (typeof this.userRepo.query === "function") {
        const roleIds = roles.map((r) => r.id);
        await this.userRepo.query(
          `DELETE FROM user_roles WHERE user_id = $1 AND NOT (role_id = ANY($2::bigint[]))`,
          [id, roleIds],
        );
        for (const role of roles) {
          await this.userRepo.query(
            `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [id, role.id],
          );
        }
      } else {
        updateFields.roles = roles;
      }
    }
    if (Object.keys(updateFields).length > 0) {
      if (typeof this.userRepo.update === "function") {
        await this.userRepo.update(id, updateFields);
      } else {
        await this.userRepo.save({ id, ...updateFields });
      }
    }
    const p = await this.staffRepo.findOne({ where: { userId: id } });
    if (p) {
      if (dto.staffType !== undefined) p.staffType = dto.staffType;
      if (dto.position !== undefined) p.position = dto.position;
      await this.staffRepo.save(p);
    }
    return this.findOne(id);
  }
  async remove(id: number) {
    await this.update(id, { status: "INACTIVE" });
    return { success: true, message: "Đã vô hiệu hóa tài khoản nhân viên." };
  }
  async restore(id: number) {
    await this.update(id, { status: "ACTIVE" });
    return { success: true, message: "Đã khôi phục tài khoản nhân viên." };
  }
  async toggleStatus(id: number) {
    const current = await this.findOne(id);
    const status = current.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await this.update(id, { status });
    return {
      success: true,
      status,
      message: "Đã cập nhật trạng thái tài khoản.",
    };
  }
  async getStats() {
    const profiles = await this.staffRepo.find(),
      users = (await this.userRepo.find({ relations: ["roles"] })).filter((u) =>
        profiles.some((p) => Number(p.userId) === Number(u.id)),
      );
    const count = (codes: string[]) =>
      users.filter((u) => u.roles?.some((r) => codes.includes(r.code))).length;
    return {
      totalStaff: users.length,
      activeStaff: users.filter((u) => u.status === "ACTIVE").length,
      teachers: count(["TEACHER"]),
      kitchenAndNutrition: count(["KITCHEN_STAFF", "NUTRITIONIST"]),
      medicalStaff: count(["MEDICAL_STAFF"]),
      inactiveOrDeleted: users.filter((u) => u.status !== "ACTIVE").length,
      teachingStaff: count(["TEACHER"]),
      kitchenStaff: count(["KITCHEN_STAFF"]),
      nutritionStaff: count(["NUTRITIONIST"]),
      managementStaff: count([
        "PRINCIPAL",
        "SCHOOL_MANAGER",
        "SCHOOL_MANAGEMENT",
      ]),
    };
  }
  async getRoles() {
    return (await this.roleRepo.find())
      .filter((r) => STAFF_ROLES.includes(r.code))
      .map((r) => ({
        id: String(r.id),
        code: r.code,
        name: r.name,
        description: r.name,
      }));
  }
}
