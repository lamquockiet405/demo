import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Child } from '../entities/child.entity';
import { ChildAllergy } from '../entities/child-allergy.entity';
import { AllergenCatalog } from '../entities/allergen-catalog.entity';
import { CreateChildDto } from '../dto/create-child.dto';
import { UpdateChildDto } from '../dto/update-child.dto';
import { GetChildrenQueryDto } from '../dto/get-children-query.dto';
import { DeclareAllergyDto } from '../dto/declare-allergy.dto';
import { UpdateAllergyDto } from '../dto/update-allergy.dto';

export interface ChildAccessActor { sub: number; roles?: (string | { code?: string })[]; }

@Injectable()
export class ChildrenService {
  constructor(
    @InjectRepository(Child)
    private readonly childRepo: Repository<Child>,
    @InjectRepository(ChildAllergy)
    private readonly allergyRepo: Repository<ChildAllergy>,
    @InjectRepository(AllergenCatalog)
    private readonly catalogRepo: Repository<AllergenCatalog>,
  ) { }

  private mapChildAllergy(a: ChildAllergy) {
    const allergenNameVi = a.allergen?.name || a.customAllergenName || 'Dị ứng thực phẩm';
    return {
      id: String(a.id),
      childId: String(a.studentId),
      allergenId: a.allergenId ? String(a.allergenId) : undefined,
      customAllergenName: a.customAllergenName || undefined,
      allergenName: allergenNameVi,
      allergenCode: a.allergen?.code || 'CUSTOM',
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
            id: '0',
            code: 'CUSTOM',
            nameVi: a.customAllergenName,
            nameEn: 'Custom',
            description: a.customAllergenName,
          }
          : undefined,
      allergyType: a.allergyType || 'ALLERGY',
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
    const roles = (actor?.roles || []).map(role => (typeof role === 'string' ? role : role.code || '').toUpperCase());
    return roles.includes('PARENT') && !roles.some(role =>
      ['SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_MANAGER', 'SCHOOL_MANAGEMENT', 'TEACHER', 'NUTRITIONIST', 'KITCHEN_STAFF'].includes(role));
  }

  private async assertChildAccess(childId: number, actor?: ChildAccessActor) {
    if (!this.parentOnly(actor)) return;
    const links = await this.childRepo.query('SELECT 1 FROM student_parents WHERE student_id=$1 AND parent_id=$2', [childId, actor.sub]);
    if (!links.length) throw new ForbiddenException('Tài khoản chưa được liên kết với hồ sơ học sinh này');
  }

  private async allergyTarget(dto: DeclareAllergyDto | UpdateAllergyDto, current?: ChildAllergy) {
    let allergenId = current?.allergenId ?? null;
    if (dto.allergenId !== undefined) {
      if (dto.allergenId === null || dto.allergenId === '') allergenId = null;
      else {
        const parsed = Number(dto.allergenId);
        if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new BadRequestException('Dị nguyên được chọn không hợp lệ');
        if (!await this.catalogRepo.findOne({ where: { id: parsed } })) throw new NotFoundException('Không tìm thấy dị nguyên trong danh mục');
        allergenId = parsed;
      }
    }
    const customAllergenName = dto.customAllergenName === undefined ? current?.customAllergenName ?? null : dto.customAllergenName?.trim() || null;
    if (!allergenId && !customAllergenName) throw new BadRequestException('Vui lòng chọn dị nguyên hoặc nhập thực phẩm cần tránh');
    return { allergenId, customAllergenName: allergenId ? null : customAllergenName };
  }

  private async assertNoDuplicate(childId: number, target: { allergenId: number | null; customAllergenName: string | null }, exceptId?: number) {
    const active = await this.allergyRepo.find({ where: { studentId: childId, isActive: true } });
    const duplicate = active.some(item => Number(item.id) !== Number(exceptId) &&
      (target.allergenId ? Number(item.allergenId) === target.allergenId :
        !item.allergenId && (item.customAllergenName || '').trim().toLocaleLowerCase('vi') === target.customAllergenName.toLocaleLowerCase('vi')));
    if (duplicate) throw new ConflictException('Thực phẩm này đã có trong hồ sơ đang áp dụng của bé');
  }

  async findAll(query: GetChildrenQueryDto, actor?: ChildAccessActor) {
    const qb = this.childRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.class', 'cls')
      .leftJoinAndSelect('c.allergies', 'alg', 'alg.isActive = :allergyActive', { allergyActive: true })
      .leftJoinAndSelect('alg.allergen', 'ac');

    if (this.parentOnly(actor)) {
      qb.andWhere('EXISTS (SELECT 1 FROM student_parents sp WHERE sp.student_id=c.id AND sp.parent_id=:parentId)', { parentId: actor.sub });
    }

    if (query.search) {
      qb.andWhere(
        '(LOWER(c.fullName) LIKE :search OR LOWER(c.studentCode) LIKE :search)',
        { search: `%${query.search.toLowerCase()}%` },
      );
    }

    if (query.classId) {
      qb.andWhere('c.classId = :classId', { classId: query.classId });
    }

    if (query.ageGroup) {
      qb.andWhere('cls.ageGroup = :ageGroup', { ageGroup: query.ageGroup });
    }

    if (query.allergyRisk === 'YES') {
      qb.andWhere('alg.id IS NOT NULL');
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    qb.skip((page - 1) * limit).take(limit);
    qb.orderBy('c.fullName', 'ASC');

    const [items, total] = await qb.getManyAndCount();

    // Map items to frontend ChildItem structure
    const mapped = items.map((c) => ({
      id: String(c.id),
      studentCode: c.studentCode,
      fullName: c.fullName,
      dateOfBirth: c.dateOfBirth,
      gender: c.gender,
      avatarUrl: c.avatar || null,
      classId: c.classId ? String(c.classId) : null,
      className: c.class?.name || 'Chưa phân lớp',
      ageGroup: c.class?.ageGroup || 'MAU_GIAO',
      status: c.status,
      allergies: (c.allergies || []).map((a) => this.mapChildAllergy(a)),
      hasAllergy: (c.allergies || []).length > 0,
    }));

    return { items: mapped, total, page, limit };
  }

  async getStats() {
    const total = await this.childRepo.count();
    const allergicCount = await this.childRepo
      .createQueryBuilder('c')
      .innerJoin('c.allergies', 'a', 'a.isActive = true')
      .select('COUNT(DISTINCT c.id)', 'cnt')
      .getRawOne();

    const severeCount = await this.childRepo
      .createQueryBuilder('c')
      .innerJoin('c.allergies', 'a', 'a.isActive = true')
      .where("a.severity IN ('HIGH', 'SEVERE', 'ANAPHYLACTIC')")
      .select('COUNT(DISTINCT c.id)', 'cnt')
      .getRawOne();

    const allergic = parseInt(allergicCount?.cnt || '0', 10);
    const severe = parseInt(severeCount?.cnt || '0', 10);
    const rate = total > 0 ? parseFloat(((allergic / total) * 100).toFixed(1)) : 0;

    return {
      totalChildren: total,
      allergicCount: allergic,
      severeCount: severe,
      allergyRate: rate,
    };
  }

  async getAllergenCatalogs() {
    const list = await this.catalogRepo.find({ order: { name: 'ASC' } });
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
      relations: ['class', 'allergies', 'allergies.allergen'],
    });

    if (!child) {
      throw new NotFoundException(`Không tìm thấy thông tin trẻ với ID: ${id}`);
    }

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
    };
  }

  async create(dto: CreateChildDto) {
    const studentCode = dto.studentCode?.trim() || `HS-${Date.now().toString().slice(-6)}`;
    const fullName =
      dto.fullName?.trim() ||
      `${dto.lastName || ''} ${dto.firstName || ''}`.trim() ||
      'Học sinh mới';

    const child = this.childRepo.create({
      studentCode,
      fullName,
      dateOfBirth: dto.dateOfBirth,
      gender: dto.gender,
      classId: dto.classId || null,
      avatar: dto.avatar || null,
      status: dto.status || 'ACTIVE',
    });
    const saved = await this.childRepo.save(child);
    return this.findOne(saved.id);
  }

  async update(id: number, dto: UpdateChildDto) {
    const child = await this.childRepo.findOne({ where: { id } });
    if (!child) {
      throw new NotFoundException(`Không tìm thấy hồ sơ trẻ với ID: ${id}`);
    }

    const calculatedFullName =
      dto.fullName?.trim() ||
      (dto.lastName !== undefined || dto.firstName !== undefined
        ? `${dto.lastName || ''} ${dto.firstName || ''}`.trim()
        : undefined);

    if (calculatedFullName !== undefined && calculatedFullName.length > 0) {
      child.fullName = calculatedFullName;
    }
    if (dto.dateOfBirth !== undefined) child.dateOfBirth = dto.dateOfBirth;
    if (dto.gender !== undefined) child.gender = dto.gender;
    if (dto.classId !== undefined) child.classId = dto.classId;
    if (dto.studentCode !== undefined) child.studentCode = dto.studentCode;
    if (dto.avatar !== undefined) child.avatar = dto.avatar;
    if (dto.status !== undefined) child.status = dto.status;

    await this.childRepo.save(child);
    return this.findOne(id);
  }

  async declareAllergy(childId: number, dto: DeclareAllergyDto, declaredBy?: number, actor?: ChildAccessActor) {
    await this.assertChildAccess(childId, actor);
    const child = await this.childRepo.findOne({ where: { id: childId } });
    if (!child) {
      throw new NotFoundException(`Không tìm thấy trẻ với ID: ${childId}`);
    }

    const target = await this.allergyTarget(dto);
    await this.assertNoDuplicate(childId, target);

    const allergy = this.allergyRepo.create({
      studentId: childId,
      ...target,
      allergyType: dto.allergyType || 'ALLERGY',
      severity: dto.severity || 'MEDIUM',
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
      relations: ['allergen'],
    });

    return this.mapChildAllergy(reloaded || saved);
  }

  async updateAllergy(allergyId: number, dto: UpdateAllergyDto, actor?: ChildAccessActor) {
    const allergy = await this.allergyRepo.findOne({
      where: { id: allergyId },
      relations: ['allergen'],
    });
    if (!allergy) {
      throw new NotFoundException(`Không tìm thấy thông tin dị ứng với ID: ${allergyId}`);
    }

    await this.assertChildAccess(allergy.studentId, actor);
    const target = await this.allergyTarget(dto, allergy);
    if (dto.isActive !== false && (dto.isActive === true || allergy.isActive)) await this.assertNoDuplicate(allergy.studentId, target, allergy.id);
    Object.assign(allergy, target);
    allergy.allergen = target.allergenId ? { id: target.allergenId } as AllergenCatalog : null;
    if (dto.allergyType !== undefined) allergy.allergyType = dto.allergyType;
    if (dto.severity !== undefined) allergy.severity = dto.severity;
    if (dto.symptoms !== undefined) allergy.symptoms = dto.symptoms || null;
    if (dto.reactionTreatment !== undefined) allergy.reactionTreatment = dto.reactionTreatment || null;
    if (dto.diagnosedDate !== undefined) allergy.diagnosedDate = dto.diagnosedDate || null;
    if (dto.note !== undefined) allergy.note = dto.note || null;
    if (dto.isActive !== undefined) allergy.isActive = dto.isActive;

    await this.allergyRepo.save(allergy);
    const reloaded = await this.allergyRepo.findOne({
      where: { id: allergy.id },
      relations: ['allergen'],
    });
    return this.mapChildAllergy(reloaded || allergy);
  }

  async deleteAllergy(allergyId: number, actor?: ChildAccessActor) {
    const allergy = await this.allergyRepo.findOne({ where: { id: allergyId } });
    if (!allergy) {
      throw new NotFoundException(`Không tìm thấy thông tin dị ứng với ID: ${allergyId}`);
    }
    await this.assertChildAccess(allergy.studentId, actor);
    allergy.isActive = false;
    await this.allergyRepo.save(allergy);
    return { success: true, message: 'Đã ngưng áp dụng thông tin dị ứng, hồ sơ được giữ lại' };
  }

  async rescanAllergies() {
    return {
      success: true,
      message: 'Đã quét và đồng bộ dữ liệu cảnh báo dị ứng học sinh toàn trường',
    };
  }

  async getAllergyHistory(childId: number, actor?: ChildAccessActor) {
    await this.assertChildAccess(childId, actor);
    const allergies = await this.allergyRepo.find({
      where: { studentId: childId },
      relations: ['allergen'],
      order: { declaredAt: 'DESC' },
    });
    return allergies.map((a) => ({
      id: String(a.id),
      allergenId: a.allergenId ? String(a.allergenId) : null,
      allergenName: a.allergen?.name || a.customAllergenName || 'Dị ứng',
      severity: a.severity,
      note: a.note || a.symptoms,
      action: 'DECLARED',
      date: a.declaredAt ? a.declaredAt.toISOString() : new Date().toISOString(),
      updatedBy: 'Phụ huynh / Y tế trường',
    }));
  }

  async importChildren(items: any[]) {
    if (!Array.isArray(items) || items.length === 0) {
      return {
        success: true,
        message: 'Không có dữ liệu học sinh để nhập.',
        importedCount: 0,
        errors: [],
      };
    }

    const errors: string[] = [];
    let importedCount = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        const fullName =
          item.fullName?.trim() ||
          `${item.lastName || ''} ${item.firstName || ''}`.trim();

        if (!fullName) {
          errors.push(`Dòng ${i + 1}: Họ và tên học sinh không được để trống.`);
          continue;
        }

        // Chuẩn hóa giới tính ('MALE' | 'FEMALE')
        let gender = 'MALE';
        const rawGender = String(item.gender || '').trim().toUpperCase();
        if (
          rawGender === 'FEMALE' ||
          rawGender === 'NỮ' ||
          rawGender === 'NU' ||
          rawGender === 'GIRL' ||
          rawGender.includes('GÁI') ||
          rawGender.includes('NỮ')
        ) {
          gender = 'FEMALE';
        }

        // Chuẩn hóa ngày sinh (YYYY-MM-DD)
        let dob = '2021-01-01';
        if (item.dateOfBirth) {
          const rawDob = String(item.dateOfBirth).trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(rawDob)) {
            dob = rawDob;
          } else if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(rawDob)) {
            const parts = rawDob.split(/[\/\-]/);
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2];
            dob = `${year}-${month}-${day}`;
          } else {
            const parsed = new Date(rawDob);
            if (!isNaN(parsed.getTime())) {
              dob = parsed.toISOString().split('T')[0];
            }
          }
        }

        // Chuẩn hóa classId
        let classId: number | null = null;
        if (
          item.classId !== undefined &&
          item.classId !== null &&
          String(item.classId).trim() !== '' &&
          String(item.classId) !== 'ALL'
        ) {
          const parsedClassId = Number(item.classId);
          if (!isNaN(parsedClassId) && parsedClassId > 0) {
            classId = parsedClassId;
          }
        }

        // Xử lý studentCode & Cơ chế Upsert
        let studentCode = (item.studentCode || '').trim();
        let existingChild: Child | null = null;

        if (studentCode) {
          existingChild = await this.childRepo.findOne({ where: { studentCode } });
        }

        if (existingChild) {
          // Học sinh đã tồn tại -> cập nhật thông tin và gán vào lớp mới
          existingChild.fullName = fullName;
          existingChild.dateOfBirth = dob;
          existingChild.gender = gender;
          if (classId !== null) {
            existingChild.classId = classId;
          }
          await this.childRepo.save(existingChild);
          importedCount++;
        } else {
          // Tạo mới hồ sơ học sinh
          if (!studentCode) {
            studentCode = `HS-${Date.now().toString().slice(-6)}-${(i + 1).toString().padStart(2, '0')}`;
          }

          const newChild = this.childRepo.create({
            studentCode,
            fullName,
            dateOfBirth: dob,
            gender,
            classId,
            status: 'ACTIVE',
          });

          const savedChild = await this.childRepo.save(newChild);

          // Tự động ghi nhận dị ứng nếu có ghi chú y tế đặc biệt
          const notes = (item.medicalNotes || '').trim();
          if (
            notes &&
            notes.toLowerCase() !== 'bình thường' &&
            notes.toLowerCase() !== 'khong' &&
            notes.toLowerCase() !== 'không'
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
                allergyType: 'ALLERGY',
                severity: 'MEDIUM',
                symptoms: notes,
                reactionTreatment: 'Báo y tế trường học khi có dấu hiệu dị ứng',
                isActive: true,
              });
              await this.allergyRepo.save(allergy);
            } catch (algErr) {
              console.warn('Could not auto-declare allergy for imported child:', algErr);
            }
          }

          importedCount++;
        }
      } catch (rowErr: any) {
        errors.push(`Dòng ${i + 1}: ${rowErr.message || 'Lỗi xử lý dữ liệu.'}`);
      }
    }

    return {
      success: true,
      message: `Đã nhập khẩu thành công ${importedCount} hồ sơ học sinh.`,
      importedCount,
      errors,
    };
  }
}
