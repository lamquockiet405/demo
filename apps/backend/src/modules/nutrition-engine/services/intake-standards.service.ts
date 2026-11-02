import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NutritionIntakeStandard } from '../entities/nutrition-intake-standard.entity';
import { CreateIntakeStandardDto } from '../dto/create-intake-standard.dto';
import { UpdateIntakeStandardDto } from '../dto/update-intake-standard.dto';

@Injectable()
export class IntakeStandardsService {
  constructor(
    @InjectRepository(NutritionIntakeStandard)
    private readonly standardRepo: Repository<NutritionIntakeStandard>,
  ) {}

  async findAll(schoolId: number = 1, query?: { ageGroup?: string; gender?: string; mealScope?: string; isActive?: boolean }) {
    const qb = this.standardRepo.createQueryBuilder('std');
    qb.where('std.school_id = :schoolId', { schoolId });

    if (query?.ageGroup && query.ageGroup !== 'ALL') {
      qb.andWhere('std.age_group = :ageGroup', { ageGroup: query.ageGroup });
    }
    if (query?.gender && query.gender !== 'ALL') {
      qb.andWhere('(std.gender = :gender OR std.gender = :allGender)', { gender: query.gender, allGender: 'ALL' });
    }
    if (query?.mealScope) {
      qb.andWhere('std.meal_scope = :mealScope', { mealScope: query.mealScope });
    }
    if (query?.isActive !== undefined) {
      qb.andWhere('std.is_active = :isActive', { isActive: query.isActive });
    }

    qb.orderBy('std.age_group', 'ASC').addOrderBy('std.id', 'ASC');
    return qb.getMany();
  }

  async findOne(id: number, schoolId: number = 1) {
    const standard = await this.standardRepo.findOne({ where: { id, schoolId } });
    if (!standard) {
      throw new NotFoundException(`Không tìm thấy định mức dinh dưỡng ID #${id}`);
    }
    return standard;
  }

  async create(dto: CreateIntakeStandardDto, schoolId: number = 1) {
    if (dto.energyKcalMin > dto.energyKcalMax) {
      throw new BadRequestException('Năng lượng tối thiểu không được lớn hơn năng lượng tối đa');
    }
    if (dto.fiberGMin && dto.fiberGMax && dto.fiberGMin > dto.fiberGMax) {
      throw new BadRequestException('Chất xơ tối thiểu không được lớn hơn chất xơ tối đa');
    }

    const entity = this.standardRepo.create({
      ...dto,
      schoolId,
    });
    return this.standardRepo.save(entity);
  }

  async update(id: number, dto: UpdateIntakeStandardDto, schoolId: number = 1) {
    const standard = await this.findOne(id, schoolId);

    const minEnergy = dto.energyKcalMin !== undefined ? dto.energyKcalMin : standard.energyKcalMin;
    const maxEnergy = dto.energyKcalMax !== undefined ? dto.energyKcalMax : standard.energyKcalMax;
    if (minEnergy > maxEnergy) {
      throw new BadRequestException('Năng lượng tối thiểu không được lớn hơn năng lượng tối đa');
    }

    Object.assign(standard, dto);
    return this.standardRepo.save(standard);
  }

  async toggleActive(id: number, schoolId: number = 1) {
    const standard = await this.findOne(id, schoolId);
    standard.isActive = !standard.isActive;
    return this.standardRepo.save(standard);
  }

  async remove(id: number, schoolId: number = 1) {
    const standard = await this.findOne(id, schoolId);
    await this.standardRepo.remove(standard);
    return { success: true, message: `Đã xóa định mức dinh dưỡng #${id}` };
  }

  async getSummary(schoolId: number = 1) {
    const total = await this.standardRepo.count({ where: { schoolId } });
    const active = await this.standardRepo.count({ where: { schoolId, isActive: true } });
    const mauGiaoCount = await this.standardRepo.count({ where: { schoolId, ageGroup: 'MAU_GIAO' } });
    const nhaTreCount = await this.standardRepo.count({ where: { schoolId, ageGroup: 'NHA_TRE' } });

    return {
      total,
      active,
      mauGiaoCount,
      nhaTreCount,
    };
  }
}

