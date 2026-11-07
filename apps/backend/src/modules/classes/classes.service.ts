import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ClassEntity } from './entities/class.entity';
import { Child } from '../children/entities/child.entity';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { FilterClassDto } from './dto/filter-class.dto';

@Injectable()
export class ClassesService {
  constructor(
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(Child)
    private readonly childRepo: Repository<Child>,
  ) {}

  async findAll(filter: FilterClassDto, schoolId = 1) {
    const qb = this.classRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.homeroomTeacher', 'teacher');
    qb.andWhere('c.schoolId = :schoolId', { schoolId });

    if (filter.search) {
      qb.andWhere('LOWER(c.name) LIKE :search', { search: `%${filter.search.toLowerCase()}%` });
    }
    if (filter.ageGroup) {
      qb.andWhere('c.ageGroup = :ageGroup', { ageGroup: filter.ageGroup });
    }
    if (filter.schoolYear || filter.academicYear) {
      qb.andWhere('c.schoolYear = :schoolYear', { schoolYear: filter.schoolYear || filter.academicYear });
    } else {
      qb.andWhere("c.academic_year_id IN (SELECT id FROM academic_year WHERE status='ACTIVE' AND school_id=:schoolId)", { schoolId });
    }
    if (filter.status) {
      qb.andWhere('c.status = :status', { status: filter.status });
    }

    qb.orderBy('c.id', 'ASC');
    const classes = await qb.getMany();

    // Enrich with student count & allergy count
    const enriched = await Promise.all(
      classes.map(async (cls) => {
        const students = await this.childRepo.find({
          where: { classId: cls.id },
          relations: ['allergies'],
        });

        const studentCount = students.length;
        const allergicCount = students.filter((s) => s.allergies && s.allergies.length > 0).length;

        return {
          ...cls,
          studentCount,
          allergicCount,
          hasAllergyAlert: allergicCount > 0,
        };
      }),
    );

    return enriched;
  }

  async findOne(id: number) {
    const cls = await this.classRepo.findOne({
      where: { id },
      relations: ['homeroomTeacher'],
    });
    if (!cls) {
      throw new NotFoundException(`Không tìm thấy lớp học với ID: ${id}`);
    }

    const students = await this.childRepo.find({
      where: { classId: cls.id },
      relations: ['allergies', 'allergies.allergen'],
    });

    return {
      ...cls,
      studentCount: students.length,
      students,
    };
  }

  async create(dto: CreateClassDto, schoolId = 1) {
    let ageGroup = dto.ageGroup;
    if (!ageGroup && dto.gradeLevel) {
      ageGroup =
        dto.gradeLevel.includes('TODDLER') || dto.gradeLevel.includes('INFANT')
          ? 'NHA_TRE'
          : 'MAU_GIAO';
    }
    if (!ageGroup) {
      const name = (dto.name || '').toLowerCase();
      ageGroup = name.includes('nhà trẻ') || name.includes('nha tre') ? 'NHA_TRE' : 'MAU_GIAO';
    }

    const requestedYear = dto.schoolYear || dto.academicYear;
    const [year] = await this.classRepo.manager.query(`SELECT id,name FROM academic_year WHERE school_id=$1
      AND (($2::text IS NOT NULL AND name=$2) OR ($2::text IS NULL AND status='ACTIVE'))`, [schoolId, requestedYear || null]);
    if (!year) throw new BadRequestException('Hãy tạo hoặc chọn năm học trong Quản lý năm học trước khi thêm lớp.');
    const schoolYear = year.name;
    const homeroomTeacherId =
      dto.homeroomTeacherId !== undefined
        ? dto.homeroomTeacherId
        : dto.mainTeacherId
        ? Number(dto.mainTeacherId)
        : null;

    // Lớp 2 bảo vệ: kiểm tra trùng tên lớp (case-insensitive) trước khi INSERT
    const existing = await this.classRepo
      .createQueryBuilder('c')
      .where('LOWER(c.name) = LOWER(:name)', { name: dto.name.trim() })
      .andWhere('c.academicYearId = :yearId', { yearId: year.id })
      .getOne();
    if (existing) {
      throw new ConflictException(
        `Tên lớp "${dto.name.trim()}" đã tồn tại. Vui lòng chọn tên khác.`
      );
    }

    const cls = this.classRepo.create({
      schoolId,
      name: dto.name,
      ageGroup,
      schoolYear,
      academicYearId: Number(year.id),
      homeroomTeacherId,
      status: dto.status || 'ACTIVE',
    });
    return this.classRepo.save(cls);
  }

  async update(id: number, dto: UpdateClassDto) {
    const cls = await this.classRepo.findOne({ where: { id } });
    if (!cls) {
      throw new NotFoundException(`Không tìm thấy lớp học với ID: ${id}`);
    }

    let ageGroup = dto.ageGroup;
    if (!ageGroup && dto.gradeLevel) {
      ageGroup =
        dto.gradeLevel.includes('TODDLER') || dto.gradeLevel.includes('INFANT')
          ? 'NHA_TRE'
          : 'MAU_GIAO';
    }

    const schoolYear = dto.schoolYear || dto.academicYear;
    if (schoolYear && schoolYear !== cls.schoolYear) {
      throw new BadRequestException('Sử dụng Quản lý năm học để kế thừa lớp sang năm mới.');
    }
    const homeroomTeacherId =
      dto.homeroomTeacherId !== undefined
        ? dto.homeroomTeacherId
        : dto.mainTeacherId
        ? Number(dto.mainTeacherId)
        : undefined;

    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      const existing = await this.classRepo
        .createQueryBuilder('c')
        .where('LOWER(c.name) = LOWER(:name) AND c.id != :id', { name: trimmedName, id })
        .andWhere('c.academicYearId = :yearId', { yearId: cls.academicYearId })
        .getOne();
      if (existing) {
        throw new ConflictException(
          `Tên lớp "${trimmedName}" đã tồn tại. Vui lòng chọn tên khác.`
        );
      }
      cls.name = trimmedName;
    }
    if (ageGroup !== undefined) cls.ageGroup = ageGroup;
    if (schoolYear !== undefined) cls.schoolYear = schoolYear;
    if (homeroomTeacherId !== undefined) cls.homeroomTeacherId = homeroomTeacherId;
    if (dto.status !== undefined) cls.status = dto.status;

    return this.classRepo.save(cls);
  }

  async remove(id: number) {
    const cls = await this.classRepo.findOne({ where: { id } });
    if (!cls) {
      throw new NotFoundException(`Không tìm thấy lớp học với ID: ${id}`);
    }
    const [roster] = await this.classRepo.manager.query('SELECT count(*)::int AS count FROM student_academic_enrollments WHERE class_id=$1', [id]);
    if (roster.count) throw new BadRequestException('Lớp đã có hồ sơ năm học. Hãy chuyển học sinh rồi ngừng hoạt động lớp để giữ lịch sử.');
    await this.classRepo.remove(cls);
    return { success: true, message: 'Đã xóa lớp học' };
  }

  async getStudents(classId: number) {
    return this.childRepo.find({
      where: { classId },
      relations: ['allergies', 'allergies.allergen'],
      order: { fullName: 'ASC' },
    });
  }

  async addStudents(classId: number, childIds: number[]) {
    await this.requireActiveClass(classId);
    if (!childIds || childIds.length === 0) return { success: true };
    await this.childRepo.update({ id: In(childIds) }, { classId });
    return { success: true, count: childIds.length };
  }

  async removeStudent(classId: number, childId: number) {
    await this.requireActiveClass(classId);
    const child = await this.childRepo.findOne({ where: { id: childId, classId } });
    if (child) {
      child.classId = null;
      await this.childRepo.save(child);
    }
    return { success: true };
  }

  private async requireActiveClass(classId: number) {
    const rows = await this.classRepo.manager.query(`SELECT c.id FROM classes c JOIN academic_year y ON y.id=c.academic_year_id
      WHERE c.id=$1 AND y.status='ACTIVE' AND c.status='ACTIVE'`, [classId]);
    if (!rows.length) throw new BadRequestException('Chỉnh sửa danh sách của năm này tại Quản lý năm học.');
  }
}
