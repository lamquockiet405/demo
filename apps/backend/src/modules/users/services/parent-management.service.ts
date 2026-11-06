import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcryptjs";
import { User } from "../../auth/entities/user.entity";
import { Role } from "../../auth/entities/role.entity";
import { ParentProfile } from "../entities/parent-profile.entity";
import { QueryParentDto } from "../dto/parent/query-parent.dto";
import { CreateParentDto } from "../dto/parent/create-parent.dto";
import { UpdateParentDto } from "../dto/parent/update-parent.dto";

@Injectable()
export class ParentManagementService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(ParentProfile)
    private readonly parentRepo: Repository<ParentProfile>,
  ) {}

  async findAll(query: QueryParentDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const qb = this.userRepo
      .createQueryBuilder("u")
      .leftJoin(ParentProfile, "pp", "pp.user_id = u.id")
      .leftJoinAndSelect("u.roles", "r")
      .where((subQb) => {
        const roleSubQuery = subQb
          .subQuery()
          .select("ur_parent.user_id")
          .from("user_roles", "ur_parent")
          .innerJoin("roles", "r_parent", "ur_parent.role_id = r_parent.id")
          .where("r_parent.code = 'PARENT'")
          .getQuery();

        const studentParentSubQuery = subQb
          .subQuery()
          .select("sp_parent.parent_id")
          .from("student_parents", "sp_parent")
          .getQuery();

        return `(u.id IN ${roleSubQuery} OR pp.user_id IS NOT NULL OR u.id IN ${studentParentSubQuery})`;
      });

    // Tìm kiếm thời gian thực theo họ tên phụ huynh, email, SĐT hoặc thông tin học sinh
    if (query.search && query.search.trim() !== "") {
      const searchPattern = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        (subQb) => {
          const childSearchSubQuery = subQb
            .subQuery()
            .select("sp_s.parent_id")
            .from("student_parents", "sp_s")
            .innerJoin("students", "st_s", "sp_s.student_id = st_s.id")
            .where(
              "(LOWER(st_s.full_name) LIKE :searchPattern OR LOWER(st_s.student_code) LIKE :searchPattern)",
            )
            .getQuery();

          return `(LOWER(u.fullName) LIKE :searchPattern OR LOWER(u.email) LIKE :searchPattern OR u.phone LIKE :searchPattern OR u.id IN ${childSearchSubQuery})`;
        },
        { searchPattern },
      );
    }

    // Lọc theo trạng thái & xóa mềm
    if (query.status && query.status.trim() !== "" && query.status !== "ALL") {
      if (query.status === "DELETED") {
        qb.andWhere("u.status = 'INACTIVE'");
      } else {
        qb.andWhere("u.status = :status", { status: query.status.trim() });
      }
    } else if (!query.includeDeleted) {
      qb.andWhere("u.status != 'INACTIVE'");
    }

    // Sắp xếp
    const validSortFields = ["fullName", "email", "createdAt", "lastLoginAt"];
    const sortBy = validSortFields.includes(query.sortBy || "")
      ? query.sortBy
      : "createdAt";
    const sortOrder = query.sortOrder === "ASC" ? "ASC" : "DESC";
    qb.orderBy(`u.${sortBy}`, sortOrder);
    // Phân trang
    qb.skip(skip).take(limit);

    const [users, total] = await qb.getManyAndCount();

    const profiles = await this.parentRepo.find();
    const profileMap = new Map(profiles.map((p) => [String(p.userId), p]));

    // Lấy thông tin học sinh liên kết cho các phụ huynh trong trang hiện tại
    const userIds = users.map((u) => u.id);
    let childrenRows: any[] = [];
    if (userIds.length > 0) {
      childrenRows = await this.userRepo.query(
        `
        SELECT 
          sp.parent_id,
          sp.relationship,
          s.id as child_id,
          s.student_code,
          s.full_name,
          s.gender,
          s.date_of_birth,
          c.name as class_name
        FROM student_parents sp
        JOIN students s ON s.id = sp.student_id
        LEFT JOIN classes c ON c.id = s.class_id
        WHERE sp.parent_id = ANY($1)
        ORDER BY s.id ASC
      `,
        [userIds],
      );
    }

    const childrenMap = new Map<string, any[]>();
    for (const row of childrenRows) {
      const pId = String(row.parent_id);
      if (!childrenMap.has(pId)) childrenMap.set(pId, []);
      childrenMap.get(pId)!.push({
        id: String(row.child_id),
        studentCode: row.student_code,
        fullName: row.full_name,
        gender: row.gender,
        dateOfBirth: row.date_of_birth
          ? new Date(row.date_of_birth).toISOString().split("T")[0]
          : "",
        className: row.class_name || "Chưa xếp lớp",
        relationship: row.relationship,
      });
    }

    const data = users.map((u) => {
      const uId = String(u.id);
      const p = profileMap.get(uId);
      return {
        id: uId,
        email: u.email,
        fullName: u.fullName,
        phone: u.phone,
        avatarUrl: u.avatar,
        status: u.status,
        lastLoginAt: u.lastLoginAt
          ? new Date(u.lastLoginAt).toISOString()
          : null,
        createdAt: u.createdAt,
        isDeleted: u.status === "INACTIVE",
        address: p?.address || "",
        occupation: p?.occupation || "",
        note: p?.note || "",
        children: childrenMap.get(uId) || [],
      };
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findOne(id: number) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException("Không tìm thấy phụ huynh");

    const profile = await this.parentRepo.findOne({ where: { userId: id } });

    return {
      id: String(user.id),
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      avatarUrl: user.avatar,
      status: user.status,
      address: profile?.address || "",
      occupation: profile?.occupation || "",
      note: profile?.note || "",
    };
  }

  async checkEmailExists(email: string) {
    const trimmed = (email || "").trim().toLowerCase();
    if (!trimmed) {
      return { exists: false };
    }
    const user = await this.userRepo
      .createQueryBuilder("u")
      .where("LOWER(u.email) = LOWER(:email)", { email: trimmed })
      .getOne();

    return {
      exists: !!user,
      message: user
        ? `Email "${trimmed}" đã được sử dụng trong hệ thống. Vui lòng chọn email khác.`
        : undefined,
    };
  }

  async create(dto: CreateParentDto) {
    const email = (dto.email || "").trim().toLowerCase();
    const existing = await this.userRepo
      .createQueryBuilder("u")
      .where("LOWER(u.email) = LOWER(:email)", { email })
      .getOne();

    if (existing) {
      throw new ConflictException(
        `Email "${email}" đã được sử dụng trong hệ thống. Vui lòng chọn email khác.`,
      );
    }

    if (!dto.password || dto.password.length < 8)
      throw new BadRequestException(
        "Nhập mật khẩu ban đầu có ít nhất 8 ký tự.",
      );
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const role = await this.roleRepo.findOne({ where: { code: "PARENT" } });
    if (!role)
      throw new NotFoundException(
        "Chưa cấu hình vai trò phụ huynh trong hệ thống",
      );

    const user = this.userRepo.create({
      email,
      passwordHash,
      fullName: dto.fullName?.trim(),
      phone: dto.phone?.trim() || null,
      status: dto.status || "ACTIVE",
      roles: [role],
    });

    let savedUser: User;
    try {
      savedUser = await this.userRepo.save(user);
    } catch (err: any) {
      if (
        err?.code === "23505" ||
        err?.message?.includes("duplicate key") ||
        err?.message?.includes("users_email_key")
      ) {
        throw new ConflictException(
          `Email "${email}" đã được sử dụng trong hệ thống. Vui lòng chọn email khác.`,
        );
      }
      throw err;
    }

    const profile = this.parentRepo.create({
      userId: savedUser.id,
      address: dto.address || null,
      occupation: dto.occupation || null,
      note: dto.note || null,
    });
    await this.parentRepo.save(profile);
    if (dto.childIds !== undefined)
      await this.saveChildLinks(savedUser.id, dto.childIds);
    return this.findOne(savedUser.id);
  }

  async update(id: number, dto: UpdateParentDto) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException("Không tìm thấy phụ huynh");

    const updateFields: Record<string, any> = {};
    if (dto.fullName) updateFields.fullName = dto.fullName;
    if (dto.phone !== undefined) updateFields.phone = dto.phone;
    if (dto.status) updateFields.status = dto.status;
    if (dto.newPassword) {
      if (dto.newPassword.length < 8)
        throw new BadRequestException("Mật khẩu cần ít nhất 8 ký tự.");
      updateFields.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    }
    if (Object.keys(updateFields).length > 0) {
      await this.userRepo.update(id, updateFields);
    }

    let profile = await this.parentRepo.findOne({ where: { userId: id } });
    if (!profile) {
      profile = this.parentRepo.create({ userId: id });
    }
    if (dto.address !== undefined) profile.address = dto.address;
    if (dto.occupation !== undefined) profile.occupation = dto.occupation;
    if (dto.note !== undefined) profile.note = dto.note;
    await this.parentRepo.save(profile);
    if (dto.childIds !== undefined) await this.saveChildLinks(id, dto.childIds);
    return this.findOne(id);
  }

  private async saveChildLinks(parentId: number, rawIds: string[]) {
    const ids = [...new Set(rawIds.map(Number))];
    if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0))
      throw new BadRequestException("Mã học sinh không hợp lệ.");
    await this.userRepo.manager.transaction(async (manager) => {
      const existing = ids.length
        ? await manager.query(
            "SELECT id FROM students WHERE id=ANY($1::bigint[])",
            [ids],
          )
        : [];
      if (existing.length !== ids.length)
        throw new BadRequestException("Có học sinh không tồn tại.");
      await manager.query(
        "DELETE FROM student_parents WHERE parent_id=$1 AND NOT (student_id=ANY($2::bigint[]))",
        [parentId, ids],
      );
      for (const id of ids)
        await manager.query(
          "INSERT INTO student_parents(student_id,parent_id,relationship,is_primary) VALUES($1,$2,'GUARDIAN',false) ON CONFLICT (student_id,parent_id) DO NOTHING",
          [id, parentId],
        );
    });
  }

  async remove(id: number) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException("Không tìm thấy phụ huynh");
    await this.userRepo.update(id, { status: "INACTIVE" });
    return { success: true, message: "Đã tạm ngưng tài khoản phụ huynh" };
  }

  async getStats() {
    const parentQuery = `
      SELECT DISTINCT u.id, u.status,
        EXISTS (SELECT 1 FROM student_parents child_link WHERE child_link.parent_id = u.id) AS has_children
      FROM users u
      LEFT JOIN parent_profiles pp ON pp.user_id = u.id
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      LEFT JOIN student_parents sp ON sp.parent_id = u.id
      WHERE r.code = 'PARENT' OR pp.user_id IS NOT NULL OR sp.parent_id IS NOT NULL
    `;
    const parentUsers: any[] = await this.userRepo.query(parentQuery);

    const totalParents = parentUsers.length;
    const activeParents = parentUsers.filter(
      (u: any) => u.status === "ACTIVE",
    ).length;
    const inactiveParents = parentUsers.filter(
      (u: any) => u.status === "INACTIVE",
    ).length;
    const parentsWithChildren = parentUsers.filter(
      (u: any) => u.has_children,
    ).length;

    return {
      totalParents,
      activeParents,
      inactiveParents,
      inactiveOrDeleted: inactiveParents,
      parentsWithChildren,
      verifiedParents: activeParents,
    };
  }

  async restore(id: number) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException("Không tìm thấy phụ huynh");
    await this.userRepo.update(id, { status: "ACTIVE" });
    return { success: true, message: "Đã khôi phục tài khoản phụ huynh" };
  }
}
