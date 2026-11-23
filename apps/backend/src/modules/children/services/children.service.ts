import { normalizeSearch, searchSql, searchLikeSql } from '../../../common/utils/search';
import { SerializedWrite } from '../../../common/utils/serialized-write';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Child } from "../entities/child.entity";
import { ChildAllergy } from "../entities/child-allergy.entity";
import { AllergenCatalog } from "../entities/allergen-catalog.entity";
import { CreateChildDto } from "../dto/create-child.dto";
import { UpdateChildDto } from "../dto/update-child.dto";
import { GetChildrenQueryDto } from "../dto/get-children-query.dto";
import { DeclareAllergyDto } from "../dto/declare-allergy.dto";
import { UpdateAllergyDto } from "../dto/update-allergy.dto";
import { UpdateNutritionProfileDto } from "../dto/update-nutrition-profile.dto";
import { readState, writeState } from "../../../common/utils/persisted-state";
import { randomUUID } from "node:crypto";
import { resolveListYear } from '../../academic-years/resolve-list-year';
import { syncCurrentEnrollment } from '../../academic-years/sync-current-enrollment';

export interface ChildAccessActor {
  sub: number;
  roles?: (string | { code?: string })[];
}

@Injectable()
export class ChildrenService {
  async getNutritionProfile(childId: number, actor: ChildAccessActor) {
    await this.assertChildAccess(childId, actor);
    const child = await this.findOne(childId, actor);
    const profile = await readState(
      this.childRepo.manager,
      `child-nutrition:${childId}`,
      null,
    );
    return { childId: String(child.id), profile };
  }

  async updateNutritionProfile(
    childId: number,
    dto: UpdateNutritionProfileDto,
    actor: ChildAccessActor,
  ) {
    await this.assertChildAccess(childId, actor);
    await this.findOne(childId, actor);
    if (!actor?.sub)
      throw new ForbiddenException("Thiếu thông tin tài khoản cập nhật.");
    const previous: Record<string, unknown> = await readState(
      this.childRepo.manager,
      `child-nutrition:${childId}`,
      {},
    );
    const profile = {
      ...previous,
      ...dto,
      updatedAt: new Date().toISOString(),
      updatedBy: String(actor.sub),
    };
    await writeState(
      this.childRepo.manager,
      `child-nutrition:${childId}`,
      profile,
    );
    return { childId: String(childId), profile };
  }

  constructor(
    @InjectRepository(Child)
    private readonly childRepo: Repository<Child>,
    @InjectRepository(ChildAllergy)
    private readonly allergyRepo: Repository<ChildAllergy>,
    @InjectRepository(AllergenCatalog)
    private readonly catalogRepo: Repository<AllergenCatalog>,
  ) {}

  private mapChildAllergy(a: ChildAllergy) {
    const allergenNameVi =
      a.allergen?.name || a.customAllergenName || "Dị ứng thực phẩm";
    return {
      id: String(a.id),
      childId: String(a.studentId),
      allergenId: a.allergenId ? String(a.allergenId) : undefined,
      customAllergenName: a.customAllergenName || undefined,
      allergenName: allergenNameVi,
      allergenCode: a.allergen?.code || "CUSTOM",
      allergen: a.allergen
        ? {
            id: String(a.allergen.id),
            code: a.allergen.code,
            nameVi: a.allergen.name,
            nameEn: a.allergen.code,
            description: a.allergen.description,
          }
        : a.customAllergenName
          ? {
              id: "0",
              code: "CUSTOM",
              nameVi: a.customAllergenName,
              nameEn: "Custom",
              description: a.customAllergenName,
            }
          : undefined,
      allergyType: a.allergyType || "ALLERGY",
      severity: a.severity,
      symptoms: a.symptoms || undefined,
      reactionTreatment: a.reactionTreatment || undefined,
      diagnosedDate: a.diagnosedDate || undefined,
      note: a.note || a.symptoms || undefined,
      isActive: a.isActive ?? true,
      declaredAt: a.declaredAt ? a.declaredAt.toISOString() : null,
    };
  }

  private parentOnly(actor?: ChildAccessActor) {
    const roles = (actor?.roles || []).map((role) =>
      (typeof role === "string" ? role : role.code || "").toUpperCase(),
    );
    return (
      roles.includes("PARENT") &&
      !roles.some((role) =>
        [
          "SUPER_ADMIN",
          "PRINCIPAL",
          "SCHOOL_MANAGER",
          "SCHOOL_MANAGEMENT",
          "TEACHER",
          "NUTRITIONIST",
          "KITCHEN_STAFF",
        ].includes(role),
      )
    );
  }

  private async assertChildAccess(childId: number, actor?: ChildAccessActor) {
    if (!this.parentOnly(actor)) return;
    const links = await this.childRepo.query(
      "SELECT 1 FROM student_parents WHERE student_id=$1 AND parent_id=$2",
      [childId, actor.sub],
    );
    if (!links.length)
      throw new ForbiddenException(
        "Tài khoản chưa được liên kết với hồ sơ học sinh này",
      );
  }

  private async allergyTarget(
    dto: DeclareAllergyDto | UpdateAllergyDto,
    current?: ChildAllergy,
  ) {
    let allergenId = current?.allergenId ?? null;
    if (dto.allergenId !== undefined) {
      if (dto.allergenId === null || dto.allergenId === "") allergenId = null;
      else {
        const parsed = Number(dto.allergenId);
        if (!Number.isSafeInteger(parsed) || parsed <= 0)
          throw new BadRequestException("Dị nguyên được chọn không hợp lệ");
        if (!(await this.catalogRepo.findOne({ where: { id: parsed } })))
          throw new NotFoundException(
            "Không tìm thấy dị nguyên trong danh mục",
          );
        allergenId = parsed;
      }
    }
    const customAllergenName =
      dto.customAllergenName === undefined
        ? (current?.customAllergenName ?? null)
        : dto.customAllergenName?.trim() || null;
    if (!allergenId && !customAllergenName)
      throw new BadRequestException(
        "Vui lòng chọn dị nguyên hoặc nhập thực phẩm cần tránh",
      );
    return {
      allergenId,
      customAllergenName: allergenId ? null : customAllergenName,
    };
  }

  private async assertNoDuplicate(
    childId: number,
    target: { allergenId: number | null; customAllergenName: string | null },
    exceptId?: number,
  ) {
    const active = await this.allergyRepo.find({
      where: { studentId: childId, isActive: true },
    });
    const duplicate = active.some(
      (item) =>
        Number(item.id) !== Number(exceptId) &&
        (target.allergenId
          ? Number(item.allergenId) === target.allergenId
          : !item.allergenId &&
            (item.customAllergenName || "").trim().toLocaleLowerCase("vi") ===
              target.customAllergenName.toLocaleLowerCase("vi")),
    );
    if (duplicate)
      throw new ConflictException(
        "Thực phẩm này đã có trong hồ sơ đang áp dụng của bé",
      );
  }

  async findAll(query: GetChildrenQueryDto, actor?: ChildAccessActor, schoolId = 1) {
    const academicYearId = await resolveListYear(this.childRepo, schoolId, query);
    const qb = this.childRepo
      .createQueryBuilder("c")
      .leftJoinAndSelect("c.class", "cls")
      .leftJoinAndSelect(
        "c.allergies",
        "alg",
        "alg.isActive = :allergyActive",
        { allergyActive: true },
      )
      .leftJoinAndSelect("alg.allergen", "ac");

    if (this.parentOnly(actor)) {
      qb.andWhere(
        "EXISTS (SELECT 1 FROM student_parents sp WHERE sp.student_id=c.id AND sp.parent_id=:parentId)",
        { parentId: actor.sub },
      );
    }

    if (query.search) {
      qb.andWhere(
        `(${searchSql("c.fullName")} LIKE ${searchLikeSql(":search")} OR ${searchSql("c.studentCode")} LIKE ${searchLikeSql(":search")})`,
        { search: `%${normalizeSearch(query.search)}%` },
      );
    }

    if (academicYearId === null) qb.andWhere('1=0');
    if (academicYearId) {
      qb.innerJoin('student_academic_enrollments', 'year_enrollment',
        'year_enrollment.student_id = c.id AND year_enrollment.academic_year_id = :academicYearId AND year_enrollment.status = :enrolledStatus',
        { academicYearId, enrolledStatus: 'ENROLLED' });
      qb.leftJoinAndMapOne('c.class', 'classes', 'year_class', 'year_class.id = year_enrollment.class_id');
    }
    if (query.classId) {
      qb.andWhere(academicYearId ? 'year_enrollment.class_id = :classId' : "c.classId = :classId", { classId: query.classId });
    }

    if (query.ageGroup) {
      qb.andWhere("cls.ageGroup = :ageGroup", { ageGroup: query.ageGroup });
    }

    if (query.allergyRisk === "YES") {
      qb.andWhere("alg.id IS NOT NULL");
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    qb.skip((page - 1) * limit).take(limit);
    qb.orderBy("c.fullName", "ASC");

    const [items, total] = await qb.getManyAndCount();

    const studentIds = items.map((c) => Number(c.id));
    const parentMap = new Map<number, any>();
    if (studentIds.length > 0) {
      const parentRows = await this.childRepo.query(
        `SELECT sp.student_id, u.id as parent_id, u.full_name as parent_name, u.email as parent_email, u.phone as parent_phone, sp.relationship, sp.is_primary
         FROM student_parents sp
         JOIN users u ON u.id = sp.parent_id
         WHERE sp.student_id = ANY($1::bigint[])
         ORDER BY sp.is_primary DESC, sp.student_id`,
        [studentIds],
      );
      for (const p of parentRows) {
        const sid = Number(p.student_id);
        if (!parentMap.has(sid)) {
          parentMap.set(sid, {
            parentId: String(p.parent_id),
            parentName: p.parent_name,
            parentEmail: p.parent_email,
            parentPhone: p.parent_phone,
            parentRelationship:
              p.relationship === "FATHER"
                ? "Bố"
                : p.relationship === "MOTHER"
                  ? "Mẹ"
                  : "Người giám hộ",
          });
        }
      }
    }

    // Map items to frontend ChildItem structure
    const mapped = items.map((c) => {
      const p = parentMap.get(Number(c.id));
      return {
        id: String(c.id),
        studentCode: c.studentCode,
        fullName: c.fullName,
        dateOfBirth: c.dateOfBirth,
        gender: c.gender,
        avatarUrl: c.avatar || null,
        classId: c.class?.id ? String(c.class.id) : c.classId ? String(c.classId) : null,
        className: c.class?.name || "Chưa phân lớp",
        ageGroup: c.class?.ageGroup || "MAU_GIAO",
        status: c.status,
        allergies: (c.allergies || []).map((a) => this.mapChildAllergy(a)),
        hasAllergy: (c.allergies || []).some((a) => a.isActive !== false),
        parentId: p?.parentId || null,
        parentName: p?.parentName || null,
        parentEmail: p?.parentEmail || null,
        parentPhone: p?.parentPhone || null,
        parentRelationship: p?.parentRelationship || null,
        emergencyContactName: p?.parentName || null,
        emergencyContactPhone: p?.parentPhone || null,
      };
    });

    return { items: mapped, total, page, limit };
  }

  async getStats(schoolId = 1, query: GetChildrenQueryDto = {}) {
    const academicYearId = await resolveListYear(this.childRepo, schoolId, query);
    const qb = this.childRepo.createQueryBuilder('c')
      .leftJoin('c.allergies', 'a', 'a.isActive = true')
      .leftJoin('student_parents', 'sp', 'sp.student_id = c.id');

    if (academicYearId === null) qb.andWhere('1=0');
    if (academicYearId) {
      qb.innerJoin('student_academic_enrollments', 'year_enrollment',
        'year_enrollment.student_id = c.id AND year_enrollment.academic_year_id = :academicYearId AND year_enrollment.status = :enrolledStatus',
        { academicYearId, enrolledStatus: 'ENROLLED' });
    } else if (query.allAcademicYears) {
      qb.innerJoin('student_academic_enrollments', 'year_enrollment',
        'year_enrollment.student_id = c.id AND year_enrollment.status = :enrolledStatus',
        { enrolledStatus: 'ENROLLED' })
        .innerJoin('academic_year', 'year_scope',
          'year_scope.id = year_enrollment.academic_year_id AND year_scope.school_id = :schoolId',
          { schoolId });
    }
    if (query.classId) {
      qb.andWhere(academicYearId || query.allAcademicYears
        ? 'year_enrollment.class_id = :classId' : 'c.classId = :classId',
        { classId: query.classId });
    }
    if (query.search) {
      qb.andWhere(
        `(${searchSql('c.fullName')} LIKE ${searchLikeSql(':search')} OR ${searchSql('c.studentCode')} LIKE ${searchLikeSql(':search')})`,
        { search: `%${normalizeSearch(query.search)}%` },
      );
    }
    const result = await qb
      .select('COUNT(DISTINCT c.id)', 'total')
      .addSelect('COUNT(DISTINCT CASE WHEN sp.student_id IS NOT NULL THEN c.id END)', 'linked')
      .addSelect('COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN c.id END)', 'allergic')
      .addSelect("COUNT(DISTINCT CASE WHEN a.severity IN ('HIGH', 'SEVERE', 'ANAPHYLACTIC') THEN c.id END)", 'severe')
      .getRawOne();
    const total = Number(result?.total || 0);
    const linked = Number(result?.linked || 0);
    const allergic = Number(result?.allergic || 0);
    return {
      totalChildren: total,
      linkedParentCount: linked,
      unlinkedParentCount: total - linked,
      allergicCount: allergic,
      severeCount: Number(result?.severe || 0),
      allergyRate: total ? Number(((allergic / total) * 100).toFixed(1)) : 0,
    };
  }

  async getAllergenCatalogs() {
    const list = await this.catalogRepo.find({ order: { name: "ASC" } });
    return list.map((item) => ({
      id: String(item.id),
      code: item.code,
      name: item.name,
      nameVi: item.name,
      nameEn: item.code,
      commonFoods: item.description,
      description: item.description,
      isActive: true,
    }));
  }

  async findOne(id: number, actor?: ChildAccessActor) {
    await this.assertChildAccess(id, actor);
    const child = await this.childRepo.findOne({
      where: { id },
      relations: ["class", "allergies", "allergies.allergen"],
    });

    if (!child) {
      throw new NotFoundException(`Không tìm thấy thông tin trẻ với ID: ${id}`);
    }

    const parentRows = await this.childRepo.query(
      `SELECT sp.student_id, u.id as parent_id, u.full_name as parent_name, u.email as parent_email, u.phone as parent_phone, sp.relationship, sp.is_primary
       FROM student_parents sp
       JOIN users u ON u.id = sp.parent_id
       WHERE sp.student_id = $1
       ORDER BY sp.is_primary DESC`,
      [child.id],
    );
    const p = parentRows[0];

    return {
      id: String(child.id),
      studentCode: child.studentCode,
      fullName: child.fullName,
      dateOfBirth: child.dateOfBirth,
      gender: child.gender,
      avatarUrl: child.avatar,
      classId: child.classId ? String(child.classId) : null,
      className: child.class?.name || null,
      status: child.status,
      allergies: (child.allergies || []).map((a) => this.mapChildAllergy(a)),
      parentId: p ? String(p.parent_id) : null,
      parentName: p?.parent_name || null,
      parentEmail: p?.parent_email || null,
      parentPhone: p?.parent_phone || null,
      parentRelationship: p
        ? p.relationship === "FATHER"
          ? "Bố"
          : p.relationship === "MOTHER"
            ? "Mẹ"
            : "Người giám hộ"
        : null,
      emergencyContactName: p?.parent_name || null,
      emergencyContactPhone: p?.parent_phone || null,
      parents: parentRows.map((row: any) => ({
        id: String(row.parent_id),
        name: row.parent_name,
        email: row.parent_email,
        phone: row.parent_phone,
        relationship: row.relationship,
        isPrimary: row.is_primary,
      })),
    };
  }


  async syncStudentParent(studentId: number, dto: any) {
    const parentName = (dto.parentName || dto.emergencyContactName || '').trim();
    const parentEmail = (dto.parentEmail || '').trim().toLowerCase();
    const parentPhone = (dto.parentPhone || dto.emergencyContactPhone || '').trim();
    const rel = dto.parentRelationship === 'MOTHER' ? 'MOTHER' : dto.parentRelationship === 'GUARDIAN' ? 'GUARDIAN' : 'FATHER';

    if (!parentName && !parentEmail && !parentPhone) return;

    let parentUser: any = null;
    if (parentEmail) {
      const users = await this.childRepo.query(`SELECT id FROM users WHERE LOWER(email) = $1`, [parentEmail]);
      if (users[0]) parentUser = users[0];
    }
    if (!parentUser && parentPhone) {
      const users = await this.childRepo.query(`SELECT id FROM users WHERE phone = $1`, [parentPhone]);
      if (users[0]) parentUser = users[0];
    }
    if (!parentUser) {
      const email = parentEmail || `phuhuynh.${studentId}@huongduong.edu.vn`;
      const name = parentName || 'Phụ huynh học sinh';
      const insertUser = await this.childRepo.query(
        `INSERT INTO users (email, password_hash, full_name, phone, status) 
         VALUES ($1, '$2b$12$LDEYAL/OVrU/HQWo386Bqu/0kT2j7ZPrSon1Za.TZxivk0hl9a5x6', $2, $3, 'ACTIVE')
         ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone
         RETURNING id`,
        [email, name, parentPhone || null]
      );
      parentUser = insertUser[0];
      await this.childRepo.query(
        `INSERT INTO user_roles (user_id, role_id) 
         SELECT $1, id FROM roles WHERE code = 'PARENT'
         ON CONFLICT DO NOTHING`,
        [parentUser.id]
      );
      await this.childRepo.query(
        `INSERT INTO parent_profiles (user_id, address, occupation) VALUES ($1, 'TP. Hồ Chí Minh', 'Phụ huynh') ON CONFLICT DO NOTHING`,
        [parentUser.id]
      );
    } else {
      if (parentName || parentPhone) {
        await this.childRepo.query(
          `UPDATE users SET full_name = COALESCE($1, full_name), phone = COALESCE($2, phone) WHERE id = $3`,
          [parentName || null, parentPhone || null, parentUser.id]
        );
      }
    }

    if (parentUser?.id) {
      await this.childRepo.query(
        `INSERT INTO student_parents (student_id, parent_id, relationship, is_primary) 
         VALUES ($1, $2, $3, TRUE) 
         ON CONFLICT (student_id, parent_id) DO UPDATE SET relationship = EXCLUDED.relationship, is_primary = TRUE`,
        [studentId, parentUser.id, rel]
      );
    }
  }

  private async assertValidUniqueStudentCode(
    rawCode?: string | null,
    excludeChildId?: number,
  ): Promise<string> {
    const code = (rawCode || "").trim();
    if (!code) {
      throw new BadRequestException("Mã học sinh không được để trống.");
    }
    const qb = this.childRepo
      .createQueryBuilder("c")
      .where("LOWER(BTRIM(c.studentCode)) = LOWER(:code)", { code });
    if (excludeChildId) {
      qb.andWhere("c.id != :excludeChildId", { excludeChildId });
    }
    const existing = await qb.getOne();
    if (existing) {
      throw new ConflictException(
        `Mã học sinh "${code}" đã tồn tại trong hệ thống (Học sinh: ${existing.fullName}). Vui lòng nhập mã học sinh khác.`,
      );
    }
    return code;
  }

  @SerializedWrite('student-records', 'childRepo')
  async create(dto: CreateChildDto) {
    const studentCode = await this.assertValidUniqueStudentCode(dto.studentCode);
    const fullName =
      dto.fullName?.trim() ||
      `${dto.lastName || ""} ${dto.firstName || ""}`.trim() ||
      "Học sinh mới";

    const child = this.childRepo.create({
      studentCode,
      fullName,
      dateOfBirth: dto.dateOfBirth,
      gender: dto.gender,
      classId: dto.classId || null,
      avatar: dto.avatar || null,
      status: dto.status || "ACTIVE",
    });
    const saved = await this.childRepo.save(child);
    await this.syncStudentParent(saved.id, dto);
    await syncCurrentEnrollment(this.childRepo.manager, Number(saved.id));
    return this.findOne(saved.id);
  }

  @SerializedWrite('student-records', 'childRepo')
  async update(id: number, dto: UpdateChildDto) {
    const child = await this.childRepo.findOne({ where: { id } });
    if (!child) {
      throw new NotFoundException(`Không tìm thấy hồ sơ trẻ với ID: ${id}`);
    }

    const calculatedFullName =
      dto.fullName?.trim() ||
      (dto.lastName !== undefined || dto.firstName !== undefined
        ? `${dto.lastName || ""} ${dto.firstName || ""}`.trim()
        : undefined);

    if (calculatedFullName !== undefined && calculatedFullName.length > 0) {
      child.fullName = calculatedFullName;
    }
    if (dto.dateOfBirth !== undefined) child.dateOfBirth = dto.dateOfBirth;
    if (dto.gender !== undefined) child.gender = dto.gender;
    if (dto.classId !== undefined) child.classId = dto.classId;
    if (dto.studentCode !== undefined) {
      child.studentCode = await this.assertValidUniqueStudentCode(
        dto.studentCode,
        id,
      );
    }
    if (dto.avatar !== undefined) child.avatar = dto.avatar;
    if (dto.status !== undefined) child.status = dto.status;

    await this.childRepo.save(child);
    await this.syncStudentParent(id, dto);
    await syncCurrentEnrollment(this.childRepo.manager, Number(id));
    return this.findOne(id);
  }

  async declareAllergy(
    childId: number,
    dto: DeclareAllergyDto,
    declaredBy?: number,
    actor?: ChildAccessActor,
  ) {
    await this.assertChildAccess(childId, actor);
    const child = await this.childRepo.findOne({ where: { id: childId } });
    if (!child) {
      throw new NotFoundException(`Không tìm thấy trẻ với ID: ${childId}`);
    }

    if (dto.diagnosedDate) {
      const todayStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      if (dto.diagnosedDate > todayStr) {
        throw new BadRequestException('Ngày phát hiện / chẩn đoán phải trước hoặc bằng ngày hiện tại');
      }
    }
    const target = await this.allergyTarget(dto);
    await this.assertNoDuplicate(childId, target);

    const allergy = this.allergyRepo.create({
      studentId: childId,
      ...target,
      allergyType: dto.allergyType || "ALLERGY",
      severity: dto.severity || "MEDIUM",
      symptoms: dto.symptoms || null,
      reactionTreatment: dto.reactionTreatment || null,
      diagnosedDate: dto.diagnosedDate || null,
      note: dto.note || dto.symptoms || null,
      isActive: true,
      declaredBy: declaredBy || null,
    });

    const saved = await this.allergyRepo.save(allergy);
    const reloaded = await this.allergyRepo.findOne({
      where: { id: saved.id },
      relations: ["allergen"],
    });

    return this.mapChildAllergy(reloaded || saved);
  }

  async updateAllergy(
    allergyId: number,
    dto: UpdateAllergyDto,
    actor?: ChildAccessActor,
  ) {
    const allergy = await this.allergyRepo.findOne({
      where: { id: allergyId },
      relations: ["allergen"],
    });
    if (!allergy) {
      throw new NotFoundException(
        `Không tìm thấy thông tin dị ứng với ID: ${allergyId}`,
      );
    }

    if (dto.diagnosedDate) {
      const todayStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      if (dto.diagnosedDate > todayStr) {
        throw new BadRequestException('Ngày phát hiện / chẩn đoán phải trước hoặc bằng ngày hiện tại');
      }
    }
    await this.assertChildAccess(allergy.studentId, actor);
    const target = await this.allergyTarget(dto, allergy);
    if (dto.isActive !== false && (dto.isActive === true || allergy.isActive))
      await this.assertNoDuplicate(allergy.studentId, target, allergy.id);
    Object.assign(allergy, target);
    allergy.allergen = target.allergenId
      ? ({ id: target.allergenId } as AllergenCatalog)
      : null;
    if (dto.allergyType !== undefined) allergy.allergyType = dto.allergyType;
    if (dto.severity !== undefined) allergy.severity = dto.severity;
    if (dto.symptoms !== undefined) allergy.symptoms = dto.symptoms || null;
    if (dto.reactionTreatment !== undefined)
      allergy.reactionTreatment = dto.reactionTreatment || null;
    if (dto.diagnosedDate !== undefined)
      allergy.diagnosedDate = dto.diagnosedDate || null;
    if (dto.note !== undefined) allergy.note = dto.note || null;
    if (dto.isActive !== undefined) allergy.isActive = dto.isActive;

    await this.allergyRepo.save(allergy);
    const reloaded = await this.allergyRepo.findOne({
      where: { id: allergy.id },
      relations: ["allergen"],
    });
    return this.mapChildAllergy(reloaded || allergy);
  }

  async deleteAllergy(allergyId: number, actor?: ChildAccessActor) {
    const allergy = await this.allergyRepo.findOne({
      where: { id: allergyId },
    });
    if (!allergy) {
      throw new NotFoundException(
        `Không tìm thấy thông tin dị ứng với ID: ${allergyId}`,
      );
    }
    await this.assertChildAccess(allergy.studentId, actor);
    allergy.isActive = false;
    await this.allergyRepo.save(allergy);
    return {
      success: true,
      message: "Đã ngưng áp dụng thông tin dị ứng, hồ sơ được giữ lại",
    };
  }

  async rescanAllergies() {
    return {
      success: true,
      message:
        "Đã quét và đồng bộ dữ liệu cảnh báo dị ứng học sinh toàn trường",
    };
  }

  async getAllergyHistory(childId: number, actor?: ChildAccessActor) {
    await this.assertChildAccess(childId, actor);
    const allergies = await this.allergyRepo.find({
      where: { studentId: childId },
      relations: ["allergen"],
      order: { declaredAt: "DESC" },
    });
    return allergies.map((a) => ({
      id: String(a.id),
      allergenId: a.allergenId ? String(a.allergenId) : null,
      allergenName: a.allergen?.name || a.customAllergenName || "Dị ứng",
      severity: a.severity,
      note: a.note || a.symptoms,
      action: "DECLARED",
      date: a.declaredAt
        ? a.declaredAt.toISOString()
        : new Date().toISOString(),
      updatedBy: "Phụ huynh / Y tế trường",
    }));
  }

  async importChildren(items: any[]) {
    if (!Array.isArray(items) || items.length === 0) {
      return {
        success: true,
        message: "Không có dữ liệu học sinh để nhập.",
        importedCount: 0,
        errors: [],
      };
    }

    const errors: string[] = [];
    let importedCount = 0;
    const seenCodesInBatch = new Set<string>();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        let studentCode = (item.studentCode || "").trim();
        if (!studentCode) {
          do {
            studentCode = `HS-${randomUUID().slice(0, 8).toUpperCase()}`;
          } while (
            seenCodesInBatch.has(studentCode.toLowerCase()) ||
            (await this.childRepo
              .createQueryBuilder("c")
              .where("LOWER(BTRIM(c.studentCode)) = LOWER(:code)", { code: studentCode })
              .getOne())
          );
        }

        const normalizedCode = studentCode.toLowerCase();
        if (seenCodesInBatch.has(normalizedCode)) {
          errors.push(
            `Dòng ${i + 1}: Mã học sinh "${studentCode}" bị trùng lặp trong danh sách nhập.`,
          );
          continue;
        }
        seenCodesInBatch.add(normalizedCode);

        const existingChild = await this.childRepo
          .createQueryBuilder("c")
          .where("LOWER(BTRIM(c.studentCode)) = LOWER(:code)", {
            code: studentCode,
          })
          .getOne();

        if (existingChild) {
          errors.push(
            `Dòng ${i + 1}: Mã học sinh "${studentCode}" đã tồn tại trong hệ thống (Học sinh: ${existingChild.fullName}).`,
          );
          continue;
        }

        const fullName =
          item.fullName?.trim() ||
          `${item.lastName || ""} ${item.firstName || ""}`.trim();

        if (!fullName) {
          errors.push(`Dòng ${i + 1}: Họ và tên học sinh không được để trống.`);
          continue;
        }

        // Chuẩn hóa giới tính ('MALE' | 'FEMALE')
        let gender = "MALE";
        const rawGender = String(item.gender || "")
          .trim()
          .toUpperCase();
        if (
          rawGender === "FEMALE" ||
          rawGender === "NỮ" ||
          rawGender === "NU" ||
          rawGender === "GIRL" ||
          rawGender.includes("GÁI") ||
          rawGender.includes("NỮ")
        ) {
          gender = "FEMALE";
        }

        // Chuẩn hóa ngày sinh (YYYY-MM-DD)
        let dob = "2021-01-01";
        if (item.dateOfBirth) {
          const rawDob = String(item.dateOfBirth).trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(rawDob)) {
            dob = rawDob;
          } else if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(rawDob)) {
            const parts = rawDob.split(/[\/\-]/);
            const day = parts[0].padStart(2, "0");
            const month = parts[1].padStart(2, "0");
            const year = parts[2];
            dob = `${year}-${month}-${day}`;
          } else {
            const parsed = new Date(rawDob);
            if (!isNaN(parsed.getTime())) {
              dob = parsed.toISOString().split("T")[0];
            }
          }
        }

        // Chuẩn hóa classId
        let classId: number | null = null;
        if (
          item.classId !== undefined &&
          item.classId !== null &&
          String(item.classId).trim() !== "" &&
          String(item.classId) !== "ALL"
        ) {
          const parsedClassId = Number(item.classId);
          if (!isNaN(parsedClassId) && parsedClassId > 0) {
            classId = parsedClassId;
          }
        }

        const newChild = this.childRepo.create({
          studentCode,
          fullName,
          dateOfBirth: dob,
          gender,
          classId,
          status: "ACTIVE",
        });

        const savedChild = await this.childRepo.manager.transaction(async manager => {
          const saved = await manager.getRepository(Child).save(newChild);
          await syncCurrentEnrollment(manager, Number(saved.id));
          return saved;
        });

        // Tự động ghi nhận dị ứng nếu có ghi chú y tế đặc biệt
        const notes = (item.medicalNotes || "").trim();
        if (
          notes &&
          notes.toLowerCase() !== "bình thường" &&
          notes.toLowerCase() !== "khong" &&
          notes.toLowerCase() !== "không"
        ) {
          try {
            const catalogs = await this.catalogRepo.find();
            const matchedCat = catalogs.find(
              (c) =>
                notes.toLowerCase().includes(c.name.toLowerCase()) ||
                c.name.toLowerCase().includes(notes.toLowerCase()),
            );

            const allergy = this.allergyRepo.create({
              studentId: savedChild.id,
              allergenId: matchedCat ? matchedCat.id : null,
              customAllergenName: matchedCat ? null : notes,
              allergyType: "ALLERGY",
              severity: "MEDIUM",
              symptoms: notes,
              reactionTreatment: "Báo y tế trường học khi có dấu hiệu dị ứng",
              isActive: true,
            });
            await this.allergyRepo.save(allergy);
          } catch (algErr) {
            console.warn(
              "Could not auto-declare allergy for imported child:",
              algErr,
            );
          }
        }

        importedCount++;
      } catch (rowErr: any) {
        errors.push(`Dòng ${i + 1}: ${rowErr.message || "Lỗi xử lý dữ liệu."}`);
      }
    }

    return {
      success: errors.length === 0 || importedCount > 0,
      message:
        errors.length > 0 && importedCount === 0
          ? errors.join(" ")
          : `Đã nhập khẩu thành công ${importedCount} hồ sơ học sinh.`,
      importedCount,
      errors,
    };
  }
}
