import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GrowthRecord, GrowthZscore } from '../entities/growth-record.entity';
import { Child } from '../../children/entities/child.entity';
import { WhoZscoreService, WhoLmsEntry, WhoStandardsResult } from './who-zscore.service';
import { CreateGrowthRecordDto } from '../dto/create-growth-record.dto';
import { UpdateGrowthRecordDto } from '../dto/update-growth-record.dto';
import { QueryGrowthRecordsDto } from '../dto/query-growth-records.dto';

@Injectable()
export class GrowthService {
  constructor(
    @InjectRepository(GrowthRecord)
    private readonly growthRepo: Repository<GrowthRecord>,
    @InjectRepository(GrowthZscore)
    private readonly zscoreRepo: Repository<GrowthZscore>,
    @InjectRepository(Child)
    private readonly childRepo: Repository<Child>,
    private readonly whoService: WhoZscoreService,
  ) {}

  private mapToItem(record: GrowthRecord) {
    const student = record.student;
    const zscore = record.zscore;

    let ageInMonths = 0;
    let bmi = 0;
    if (student && student.dateOfBirth && record.measuredDate) {
      const dob = new Date(student.dateOfBirth);
      const md = new Date(record.measuredDate);
      ageInMonths = (md.getFullYear() - dob.getFullYear()) * 12 + (md.getMonth() - dob.getMonth());
      if (md.getDate() < dob.getDate()) {
        ageInMonths--;
      }
      ageInMonths = Math.min(Math.max(0, ageInMonths), 84);
    }

    if (record.heightCm && record.heightCm > 0 && record.weightKg) {
      const hM = Number(record.heightCm) / 100;
      bmi = Math.round((Number(record.weightKg) / (hM * hM)) * 100) / 100;
    }

    let waz = zscore?.waz != null ? Number(zscore.waz) : 0;
    let haz = zscore?.haz != null ? Number(zscore.haz) : 0;
    let baz = zscore?.baz != null ? Number(zscore.baz) : 0;

    // Tự động tính toán lại Z-Score chính xác nếu bản ghi cũ bị 0
    if (waz === 0 && haz === 0 && baz === 0 && student && record.heightCm && record.weightKg) {
      const gender = (student.gender?.toUpperCase() === 'FEMALE' ? 'FEMALE' : 'MALE') as 'MALE' | 'FEMALE';
      const calc = this.whoService.calculateSync(
        gender,
        ageInMonths,
        Number(record.weightKg),
        Number(record.heightCm),
        bmi,
      );
      waz = calc.waz;
      haz = calc.haz;
      baz = calc.baz;
    }

    const detailed = this.whoService.classifyDetailed(waz, haz, baz, bmi);
    const weightClassification = detailed.weightClassification;
    const heightClassification = detailed.heightClassification;
    const bmiClassification = detailed.bmiClassification;
    const overall = detailed.overallNutritionalStatus;

    return {
      id: String(record.id),
      tenantId: student?.class?.schoolId ? String(student.class.schoolId) : '',
      childId: student ? String(student.id) : String(record.studentId),
      child: student
        ? {
            id: String(student.id),
            fullName: student.fullName,
            studentCode: student.studentCode,
            gender: student.gender as 'MALE' | 'FEMALE',
            dateOfBirth: student.dateOfBirth,
            class: student.class
              ? {
                  id: String(student.class.id),
                  name: student.class.name,
                }
              : undefined,
          }
        : {
            id: String(record.studentId),
            fullName: '',
            studentCode: '',
            gender: 'MALE' as const,
            dateOfBirth: '',
          },
      measurementDate: record.measuredDate,
      ageInMonths,
      weightKg: Number(record.weightKg),
      heightCm: Number(record.heightCm),
      bmi,
      waz,
      haz,
      baz,
      weightClassification,
      heightClassification,
      bmiClassification,
      overallNutritionalStatus: overall,
      healthNotes: record.healthNotes || '',
      createdAt: record.measuredDate,
    };
  }

  async findAll(query: QueryGrowthRecordsDto, schoolId?: number) {
    const qb = this.growthRepo
      .createQueryBuilder('record')
      .leftJoinAndSelect('record.student', 'student')
      .leftJoinAndSelect('student.class', 'class')
      .leftJoinAndSelect('record.zscore', 'zscore');

    if (query.childId || query.studentId) {
      const cId = Number(query.childId || query.studentId);
      qb.andWhere('record.studentId = :cId', { cId });
    }

    if (query.classId) {
      qb.andWhere('student.classId = :classId', { classId: Number(query.classId) });
    }

    const status = query.status || query.nutritionalStatus;
    if (status) {
      qb.andWhere('zscore.classification = :status', { status });
    }

    if (query.search) {
      qb.andWhere(
        '(student.fullName ILIKE :search OR student.studentCode ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (schoolId) {
      qb.andWhere('class.schoolId = :schoolId', { schoolId });
    }

    qb.orderBy('record.measuredDate', 'DESC').addOrderBy('record.id', 'DESC');

    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, query.limit || 50);
    qb.skip((page - 1) * limit).take(limit);

    const [records, total] = await qb.getManyAndCount();

    return {
      items: records.map((r) => this.mapToItem(r)),
      total,
    };
  }

  async getChildHistory(childId: number) {
    const child = await this.childRepo.findOne({
      where: { id: childId },
      relations: ['class'],
    });
    if (!child) {
      throw new NotFoundException(`Child with ID ${childId} not found`);
    }

    const records = await this.growthRepo.find({
      where: { studentId: childId },
      relations: ['student', 'student.class', 'zscore'],
      order: { measuredDate: 'ASC' },
    });

    const items = records.map((r) => this.mapToItem(r));
    const latest = items.length > 0 ? items[items.length - 1] : null;

    return {
      child: {
        id: String(child.id),
        fullName: child.fullName,
        studentCode: child.studentCode,
        gender: child.gender,
        dateOfBirth: child.dateOfBirth,
        class: child.class
          ? {
              id: String(child.class.id),
              name: child.class.name,
            }
          : null,
      },
      latest,
      history: items,
    };
  }

  async getClassOverview(classId: number) {
    const students = await this.childRepo.find({
      where: { classId },
      relations: ['class'],
    });

    const totalStudents = students.length;
    if (totalStudents === 0) {
      return {
        totalStudents: 0,
        evaluatedCount: 0,
        normalCount: 0,
        stuntedCount: 0,
        underweightCount: 0,
        overweightCount: 0,
        normalPercent: 0,
        stuntedPercent: 0,
        underweightPercent: 0,
        overweightPercent: 0,
      };
    }

    const studentIds = students.map((s) => s.id);
    const records = await this.growthRepo
      .createQueryBuilder('record')
      .leftJoinAndSelect('record.zscore', 'zscore')
      .where('record.student_id IN (:...studentIds)', { studentIds })
      .orderBy('record.measured_date', 'DESC')
      .getMany();

    // Map latest record per student
    const latestMap = new Map<number, GrowthRecord>();
    for (const r of records) {
      if (!latestMap.has(r.studentId)) {
        latestMap.set(r.studentId, r);
      }
    }

    let evaluatedCount = 0;
    let normalCount = 0;
    let stuntedCount = 0;
    let underweightCount = 0;
    let overweightCount = 0;

    for (const s of students) {
      const rec = latestMap.get(s.id);
      if (rec && rec.zscore) {
        evaluatedCount++;
        const haz = Number(rec.zscore.haz);
        const waz = Number(rec.zscore.waz);
        const baz = Number(rec.zscore.baz);
        const hM = Number(rec.heightCm) > 0 ? Number(rec.heightCm) / 100 : 0;
        const bmi = hM > 0 ? Math.round((Number(rec.weightKg) / (hM * hM)) * 100) / 100 : 0;

        const detailed = this.whoService.classifyDetailed(waz, haz, baz, bmi);

        if (detailed.heightClassification === 'STUNTED' || detailed.heightClassification === 'SEVERELY_STUNTED') {
          stuntedCount++;
        }
        if (detailed.weightClassification === 'UNDERWEIGHT' || detailed.weightClassification === 'SEVERELY_UNDERWEIGHT' || detailed.bmiClassification === 'WASTED' || detailed.bmiClassification === 'SEVERELY_WASTED') {
          underweightCount++;
        }
        if (detailed.bmiClassification === 'OVERWEIGHT' || detailed.bmiClassification === 'OBESE' || detailed.weightClassification === 'OVERWEIGHT' || detailed.weightClassification === 'SEVERELY_OVERWEIGHT') {
          overweightCount++;
        }
        if (detailed.overallNutritionalStatus === 'NORMAL') {
          normalCount++;
        }
      }
    }

    const calcPct = (cnt: number) =>
      evaluatedCount > 0 ? Math.round((cnt / evaluatedCount) * 1000) / 10 : 0;

    return {
      totalStudents,
      evaluatedCount,
      normalCount,
      stuntedCount,
      underweightCount,
      overweightCount,
      normalPercent: calcPct(normalCount),
      stuntedPercent: calcPct(stuntedCount),
      underweightPercent: calcPct(underweightCount),
      overweightPercent: calcPct(overweightCount),
      hasAlerts: stuntedCount > 0 || overweightCount > 0 || underweightCount > 0,
      alertBadges: {
        stunted: stuntedCount,
        overweight: overweightCount,
        underweight: underweightCount,
        isAllNormal: evaluatedCount > 0 && stuntedCount === 0 && overweightCount === 0 && underweightCount === 0,
      },
    };
  }

  async createRecord(dto: CreateGrowthRecordDto, measurerId?: number) {
    let studentId = Number(dto.studentId || dto.childId);
    let child: Child | null = null;

    if (!isNaN(studentId) && studentId > 0) {
      child = await this.childRepo.findOne({
        where: { id: studentId },
        relations: ['class'],
      });
    }

    if (!child && (dto.studentCode || dto.childId || dto.studentId)) {
      const code = String(dto.studentCode || dto.childId || dto.studentId).trim();
      child = await this.childRepo.findOne({
        where: { studentCode: code },
        relations: ['class'],
      });
      if (child) {
        studentId = child.id;
      }
    }

    if (!child) {
      const lookupIdentifier = dto.studentCode || dto.childId || dto.studentId || 'N/A';
      throw new NotFoundException(`Không tìm thấy hồ sơ học sinh (${lookupIdentifier}) trong hệ thống`);
    }

    const measuredDate =
      dto.measuredDate ||
      dto.measurementDate ||
      new Date().toISOString().split('T')[0];

    const gender = (child.gender?.toUpperCase() === 'FEMALE' ? 'FEMALE' : 'MALE') as 'MALE' | 'FEMALE';
    const growth = await this.whoService.calculateChildGrowth(
      gender,
      child.dateOfBirth,
      measuredDate,
      Number(dto.heightCm),
      Number(dto.weightKg),
    );

    // Upsert cơ chế chống trùng lặp: Học sinh + Ngày đo
    let record = await this.growthRepo.findOne({
      where: { studentId: child.id, measuredDate },
      relations: ['zscore'],
    });

    if (record) {
      record.heightCm = Number(dto.heightCm);
      record.weightKg = Number(dto.weightKg);
      if (measurerId) record.measuredBy = measurerId;
      if (dto.healthNotes !== undefined) record.healthNotes = dto.healthNotes;
      await this.growthRepo.save(record);
    } else {
      record = this.growthRepo.create({
        studentId: child.id,
        measuredDate,
        heightCm: Number(dto.heightCm),
        weightKg: Number(dto.weightKg),
        measuredBy: measurerId,
        healthNotes: dto.healthNotes,
      });
      await this.growthRepo.save(record);
    }

    let zscore = await this.zscoreRepo.findOne({
      where: { measurementId: record.id },
    });

    if (zscore) {
      zscore.waz = growth.waz;
      zscore.haz = growth.haz;
      zscore.baz = growth.baz;
      zscore.classification = growth.classification;
      await this.zscoreRepo.save(zscore);
    } else {
      zscore = this.zscoreRepo.create({
        measurementId: record.id,
        waz: growth.waz,
        haz: growth.haz,
        baz: growth.baz,
        classification: growth.classification,
      });
      await this.zscoreRepo.save(zscore);
    }

    record.student = child;
    record.zscore = zscore;
    return this.mapToItem(record);
  }

  async updateRecord(id: number, dto: UpdateGrowthRecordDto) {
    const record = await this.growthRepo.findOne({
      where: { id },
      relations: ['student', 'student.class', 'zscore'],
    });
    if (!record) {
      throw new NotFoundException(`Growth record with ID ${id} not found`);
    }

    // 1. Cập nhật ngày đo (kiểm tra chống trùng lặp ngày đo cho cùng một học sinh)
    const targetDate = dto.measuredDate || dto.measurementDate;
    if (targetDate && targetDate !== record.measuredDate) {
      const duplicateRecord = await this.growthRepo.findOne({
        where: { studentId: record.studentId, measuredDate: targetDate },
      });
      if (duplicateRecord && Number(duplicateRecord.id) !== Number(record.id)) {
        throw new BadRequestException(
          `Đã có bản ghi cân đo của học sinh vào ngày ${targetDate}. Vui lòng chọn ngày khác hoặc sửa bản ghi ngày đó.`
        );
      }
      record.measuredDate = targetDate;
    }

    // 2. Cập nhật thông số đo: chiều cao, cân nặng, ghi chú
    if (dto.heightCm != null) record.heightCm = Number(dto.heightCm);
    if (dto.weightKg != null) record.weightKg = Number(dto.weightKg);
    if (dto.healthNotes !== undefined) record.healthNotes = dto.healthNotes;

    // 3. Tính toán lại (Re-calculate) Z-Score & Phân loại WHO
    const student = record.student;
    if (student) {
      const gender = (student.gender?.toUpperCase() === 'FEMALE' ? 'FEMALE' : 'MALE') as 'MALE' | 'FEMALE';
      const growth = await this.whoService.calculateChildGrowth(
        gender,
        student.dateOfBirth,
        record.measuredDate,
        Number(record.heightCm),
        Number(record.weightKg),
      );

      let zscore = record.zscore;
      if (!zscore) {
        zscore = await this.zscoreRepo.findOne({ where: { measurementId: record.id } }) ||
                 this.zscoreRepo.create({ measurementId: record.id });
      }
      zscore.waz = growth.waz;
      zscore.haz = growth.haz;
      zscore.baz = growth.baz;
      zscore.classification = growth.classification;
      await this.zscoreRepo.save(zscore);
      record.zscore = zscore;
    }

    await this.growthRepo.save(record);
    return {
      success: true,
      message: 'Cập nhật chỉ số tăng trưởng thành công',
      data: this.mapToItem(record),
    };
  }

  async deleteRecord(id: number) {
    const record = await this.growthRepo.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException(`Growth record with ID ${id} not found`);
    }

    await this.zscoreRepo.delete({ measurementId: id });
    await this.growthRepo.delete(id);

    return {
      success: true,
      message: 'Xóa chỉ số tăng trưởng thành công',
    };
  }

  async importRecords(items: any[], measurerId?: number) {
    let importedCount = 0;
    const errors: string[] = [];

    for (const item of items) {
      try {
        await this.createRecord(item, measurerId);
        importedCount++;
      } catch (err: any) {
        const iden = item.studentCode || item.studentId || item.childId || 'Dòng dữ liệu';
        errors.push(`Lỗi dòng học sinh ${iden}: ${err.message}`);
      }
    }

    return {
      success: errors.length === 0,
      importedCount,
      errors,
    };
  }

  private formatWeightClassification(wc?: string): string {
    switch (wc) {
      case 'SEVERELY_UNDERWEIGHT':
        return 'Nhẹ cân nặng';
      case 'UNDERWEIGHT':
        return 'Nhẹ cân';
      case 'NORMAL':
        return 'Bình thường';
      case 'OVERWEIGHT':
        return 'Thừa cân';
      case 'SEVERELY_OVERWEIGHT':
        return 'Thừa cân nặng';
      default:
        return wc || 'Bình thường';
    }
  }

  private formatOverallNutritionalStatus(st?: string): string {
    switch (st) {
      case 'OBESE':
        return 'Béo phì';
      case 'OVERWEIGHT':
        return 'Thừa cân';
      case 'SEVERELY_STUNTED':
        return 'Thấp còi nặng';
      case 'STUNTED':
        return 'Thấp còi';
      case 'SEVERELY_WASTED':
        return 'Gầy còm nặng';
      case 'WASTED':
        return 'Gầy còm';
      case 'SEVERELY_UNDERWEIGHT':
        return 'Nhẹ cân nặng';
      case 'UNDERWEIGHT':
        return 'Nhẹ cân';
      case 'SEVERELY_OVERWEIGHT':
        return 'Thừa cân nặng';
      case 'NORMAL':
        return 'Bình thường';
      default:
        return st || 'Bình thường';
    }
  }

  async exportReport(classId?: string, schoolId?: number) {
    const query: QueryGrowthRecordsDto = {
      classId,
      page: 1,
      limit: 1000,
    };
    const { items, total } = await this.findAll(query, schoolId);

    const formattedItems = items.map((it: any) => {
      const studentCode = it.child?.studentCode || it.studentCode || '';
      const childName = it.child?.fullName || it.childName || '';
      let gender = it.child?.gender || it.gender || '';
      if (gender === 'MALE' || gender === 'male') gender = 'Nam';
      else if (gender === 'FEMALE' || gender === 'female') gender = 'Nữ';

      const className = it.child?.class?.name || it.className || '';
      const measurementDate = it.measurementDate ? String(it.measurementDate).split('T')[0] : '';
      const ageInMonths = it.ageInMonths ?? 0;
      const weightKg = it.weightKg ?? 0;
      const heightCm = it.heightCm ?? 0;

      const waz = it.waz != null ? Number(it.waz).toFixed(2) : '0.00';
      const haz = it.haz != null ? Number(it.haz).toFixed(2) : '0.00';
      const baz = it.baz != null ? Number(it.baz).toFixed(2) : '0.00';

      const weightStatus = this.formatWeightClassification(it.weightClassification);
      const overallStatus = this.formatOverallNutritionalStatus(it.overallNutritionalStatus);
      const notes = it.healthNotes || it.notes || '';

      return {
        ...it,
        studentCode,
        childName,
        gender,
        className,
        measurementDate,
        ageInMonths,
        weightKg,
        heightCm,
        waz,
        haz,
        baz,
        weightStatus,
        overallStatus,
        notes,
      };
    });

    return {
      totalRecords: total,
      items: formattedItems,
    };
  }

  getStandards(gender: 'MALE' | 'FEMALE', indicator?: 'WAZ' | 'HAZ' | 'BAZ'): WhoStandardsResult {
    return this.whoService.getStandards(gender, indicator);
  }
}
