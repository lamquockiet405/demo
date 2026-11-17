import { activeAcademicYear } from '../../classes/active-academic-year';
import { currentStudent, currentYearDate } from '../../academic-years/current-year-scope';
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DailyMealPortion } from '../entities/daily-meal-portion.entity';
import { ClassEntity } from '../../classes/entities/class.entity';
import { SnackRegistration } from '../../snack-services/entities/snack-registration.entity';
import { MealPortionsQueryDto } from '../dto/meal-portions-query.dto';
import { schoolDate } from '../../../common/utils/persisted-state';

@Injectable()
export class MealPortionsService {
  constructor(
    @InjectRepository(DailyMealPortion)
    private readonly portionRepo: Repository<DailyMealPortion>,
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(SnackRegistration)
    private readonly registrationRepo: Repository<SnackRegistration>,
  ) {}

  async findAll(query: MealPortionsQueryDto, tenantId = 1) {
    const date = query.date || schoolDate();
    const classes = await this.classRepo.find({ where: { schoolId: tenantId, academicYearId: activeAcademicYear(tenantId) }, order: { name: 'ASC' } });

    const portions = await this.portionRepo.find({
      where: { date },
      relations: ['class'],
    });
    const portionMap = new Map(portions.map((p) => [`${p.classId}_${p.mealType}`, p]));
    const paidRegistrations = await this.registrationRepo.find({
      where: { status: 'PAID', studentId: currentStudent(tenantId), period: { startDate: currentYearDate(tenantId) } },
      relations: ['student'],
    });
    const paidStudentIdsByClass = new Map<number, Set<number>>();
    for (const registration of paidRegistrations) {
      const classId = Number(registration.student?.classId);
      const studentId = Number(registration.studentId);
      if (Number.isFinite(classId) && Number.isFinite(studentId)) {
        const studentIds = paidStudentIdsByClass.get(classId) || new Set<number>();
        studentIds.add(studentId);
        paidStudentIdsByClass.set(classId, studentIds);
      }
    }

    const value = (portion?: DailyMealPortion) => ({
      planned: portion?.plannedQuantity ?? null,
      actual: portion?.actualQuantity ?? null,
      submittedAt: portion?.attendanceSubmittedAt ?? null,
      present: portion?.attendanceSnapshot?.filter(item => item.isAttended).length ?? null,
      absent: portion?.attendanceSnapshot?.filter(item => !item.isAttended).length ?? null,
      notes: portion?.attendanceSnapshot?.filter(item => item.note).map(item => ({ fullName: item.fullName, note: item.note })) ?? [],
    });
    const items = classes.filter(cls => !query.classId || String(cls.id) === query.classId).map((cls) => {
      const breakfastPortion = portionMap.get(`${cls.id}_BREAKFAST`);
      const lunchPortion = portionMap.get(`${cls.id}_LUNCH`);
      const morningPortion = portionMap.get(`${cls.id}_MORNING_SNACK`);
      const snackPortion = portionMap.get(`${cls.id}_AFTERNOON_SNACK`);

      return {
        classId: String(cls.id),
        className: cls.name,
        ageGroup: cls.ageGroup,
        paidSnackCount: paidStudentIdsByClass.get(Number(cls.id))?.size || 0,
        breakfast: value(breakfastPortion),
        morningSnack: value(morningPortion),
        lunch: value(lunchPortion),
        afternoonSnack: value(snackPortion),
      };
    });

    return {
      date,
      items,
      totalBreakfast: items.reduce((total, item) => total + (item.breakfast.planned ?? 0), 0),
      totalLunch: items.reduce((total, item) => total + (item.lunch.planned ?? 0), 0),
      totalSnack: items.reduce((total, item) => total + (item.afternoonSnack.planned ?? 0), 0),
      totalPaidSnack: items.reduce((total, item) => total + item.paidSnackCount, 0),
    };
  }

  async updateActual(classId: number, date: string, mealType: string, actualQuantity: number, tenantId = 1) {
    if (!Number.isSafeInteger(classId) || !Number.isSafeInteger(actualQuantity) || actualQuantity < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !['BREAKFAST','MORNING_SNACK','LUNCH','AFTERNOON_SNACK'].includes(mealType)) throw new BadRequestException('Ngày, bữa ăn hoặc số suất không hợp lệ.');
    if (!await this.classRepo.findOne({ where: { id: classId, schoolId: tenantId, academicYearId: activeAcademicYear(tenantId) } })) throw new ForbiddenException('Lớp không thuộc năm học đang áp dụng của trường.');
    // A kitchen acknowledgement never overwrites the teacher's requested quantity.
    const result = await this.portionRepo.query(`UPDATE daily_meal_portions SET actual_quantity=$4
      WHERE class_id=$1 AND date=$2 AND meal_type=$3 RETURNING id`, [classId, date, mealType, actualQuantity]);
    const rows = Array.isArray(result?.[0]) ? result[0] : result;
    if (!rows?.length) throw new BadRequestException('Chưa có kế hoạch suất ăn cho lớp, ngày và bữa này.');
    return { success: true, actualQuantity };
  }
}
