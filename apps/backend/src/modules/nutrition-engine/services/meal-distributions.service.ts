import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MealEnergyDistribution } from '../entities/meal-energy-distribution.entity';
import { NutritionIntakeStandard } from '../entities/nutrition-intake-standard.entity';
import { CreateMealDistributionDto, UpdateMealDistributionDto } from '../dto/meal-distribution.dto';

type Range = { min: number; max: number };

const SOURCE = '01/VBHN-BGDĐT 13/4/2021';

/** Giá trị mặc định theo Chương trình GDMN (văn bản hợp nhất 01/VBHN-BGDĐT). */
export const DEFAULT_MEAL_DISTRIBUTIONS: Record<string, Array<Omit<CreateMealDistributionDto, 'ageGroup'>>> = {
  NHA_TRE: [
    {
      mealType: 'BREAKFAST',
      mealLabel: 'Buổi sáng',
      mealTime: '09:00',
      displayOrder: 1,
      energyPctMin: 5,
      energyPctMax: 10,
      waterPctMin: 10,
      waterPctMax: 15,
      waterMlMin: 100,
      waterMlMax: 150,
      note: 'Bữa phụ sáng tại trường (5–10% calo, 100–150 ml nước uống/sữa).',
    },
    {
      mealType: 'LUNCH',
      mealLabel: 'Bữa trưa chính',
      mealTime: '11:00',
      displayOrder: 2,
      energyPctMin: 30,
      energyPctMax: 35,
      waterPctMin: 30,
      waterPctMax: 35,
      waterMlMin: 250,
      waterMlMax: 350,
      note: 'Bữa trưa cung cấp 30–35% năng lượng, 250–350 ml nước (canh + nước uống).',
    },
    {
      mealType: 'AFTERNOON_SNACK',
      mealLabel: 'Bữa chiều',
      mealTime: '14:30',
      displayOrder: 3,
      energyPctMin: 25,
      energyPctMax: 30,
      waterPctMin: 20,
      waterPctMax: 25,
      waterMlMin: 150,
      waterMlMax: 250,
      note: 'Bữa chiều cung cấp 25–30% năng lượng, 150–250 ml sữa hoặc nước quả.',
    },
  ],
  MAU_GIAO: [
    {
      mealType: 'BREAKFAST',
      mealLabel: 'Buổi sáng',
      mealTime: '09:00',
      displayOrder: 1,
      energyPctMin: 5,
      energyPctMax: 10,
      waterPctMin: 10,
      waterPctMax: 15,
      waterMlMin: 150,
      waterMlMax: 250,
      note: 'Bữa phụ buổi sáng (5–10% calo, 150–250 ml nước uống/sữa).',
    },
    {
      mealType: 'LUNCH',
      mealLabel: 'Bữa trưa chính',
      mealTime: '11:00',
      displayOrder: 2,
      energyPctMin: 30,
      energyPctMax: 35,
      waterPctMin: 30,
      waterPctMax: 35,
      waterMlMin: 450,
      waterMlMax: 600,
      note: 'Bữa chính trưa 30–35% calo, 450–600 ml gồm bát canh đầy + nước tráng miệng.',
    },
    {
      mealType: 'AFTERNOON_SNACK',
      mealLabel: 'Bữa phụ chiều',
      mealTime: '14:30',
      displayOrder: 3,
      energyPctMin: 10,
      energyPctMax: 15,
      waterPctMin: 15,
      waterPctMax: 20,
      waterMlMin: 250,
      waterMlMax: 350,
      note: 'Bữa phụ chiều 10–15% calo, 250–350 ml sữa hoặc sinh tố hoa quả.',
    },
  ],
};

/** Định mức cả ngày & tỷ lệ tại trường dùng khi trường chưa cấu hình (database/reference/preschool-intake-standards.json). */
const REFERENCE_DAILY: Record<
  string,
  {
    energy: Range;
    water: Range;
    protein: Range;
    lipid: Range;
    carbohydrate: Range;
    atSchoolPct: Range;
    atSchoolWaterPct: Range;
  }
> = {
  NHA_TRE: {
    energy: { min: 930, max: 1000 },
    water: { min: 800, max: 1000 },
    protein: { min: 13, max: 20 },
    lipid: { min: 30, max: 40 },
    carbohydrate: { min: 47, max: 50 },
    atSchoolPct: { min: 60, max: 70 },
    atSchoolWaterPct: { min: 60, max: 70 },
  },
  MAU_GIAO: {
    energy: { min: 1230, max: 1320 },
    water: { min: 1600, max: 2000 },
    protein: { min: 13, max: 20 },
    lipid: { min: 25, max: 35 },
    carbohydrate: { min: 52, max: 60 },
    atSchoolPct: { min: 50, max: 55 },
    atSchoolWaterPct: { min: 50, max: 55 },
  },
};

const round1 = (value: number) => Math.round(value * 10) / 10;

@Injectable()
export class MealDistributionsService {
  constructor(
    @InjectRepository(MealEnergyDistribution)
    private readonly distributionRepo: Repository<MealEnergyDistribution>,
    @InjectRepository(NutritionIntakeStandard)
    private readonly intakeRepo: Repository<NutritionIntakeStandard>,
  ) {}

  private assertAgeGroup(ageGroup: string) {
    if (!DEFAULT_MEAL_DISTRIBUTIONS[ageGroup]) {
      throw new BadRequestException(`Nhóm tuổi không hợp lệ: ${ageGroup}`);
    }
  }

  /** Tạo dữ liệu mặc định nếu trường chưa có dòng nào cho nhóm tuổi. */
  private async ensureDefaults(schoolId: number, ageGroup: string) {
    const count = await this.distributionRepo.count({
      where: { schoolId, ageGroup },
    });
    if (count > 0) return;
    await this.distributionRepo
      .createQueryBuilder()
      .insert()
      .values(
        DEFAULT_MEAL_DISTRIBUTIONS[ageGroup].map((item) => ({
          ...item,
          ageGroup,
          schoolId,
          sourceMetadata: {
            source: SOURCE,
            seedKey: `${ageGroup}:${item.mealType}`,
          },
        })),
      )
      .orIgnore()
      .execute();
  }

  async findAll(schoolId: number, ageGroup?: string) {
    const groups = ageGroup
      ? [ageGroup]
      : Object.keys(DEFAULT_MEAL_DISTRIBUTIONS);
    for (const group of groups) {
      this.assertAgeGroup(group);
      await this.ensureDefaults(schoolId, group);
    }
    const qb = this.distributionRepo
      .createQueryBuilder('d')
      .where('d.school_id = :schoolId', { schoolId });
    if (ageGroup) qb.andWhere('d.age_group = :ageGroup', { ageGroup });
    return qb
      .orderBy('d.age_group', 'ASC')
      .addOrderBy('d.display_order', 'ASC')
      .addOrderBy('d.id', 'ASC')
      .getMany();
  }

  /** Định mức cả ngày của nhóm tuổi: ưu tiên cấu hình ALL_DAY của trường, nếu không có thì dùng số liệu tham chiếu. */
  private async getDailyStandard(schoolId: number, ageGroup: string) {
    const reference = REFERENCE_DAILY[ageGroup];
    const configured = await this.intakeRepo.findOne({
      where: { schoolId, ageGroup, mealScope: 'ALL_DAY', isActive: true },
      order: { id: 'ASC' },
    });
    if (!configured) {
      return {
        source: 'REFERENCE',
        standardName: `Tham chiếu ${SOURCE}`,
        ...reference,
      };
    }
    const waterMin =
      configured.waterMlMin != null && !isNaN(Number(configured.waterMlMin))
        ? Number(configured.waterMlMin)
        : reference.water.min;
    const waterMax =
      configured.waterMlMax != null && !isNaN(Number(configured.waterMlMax))
        ? Number(configured.waterMlMax)
        : reference.water.max;

    return {
      source: 'SCHOOL_CONFIG',
      standardName: configured.standardName,
      energy: {
        min: configured.energyKcalMin,
        max: configured.energyKcalMax,
      },
      water: {
        min: waterMin,
        max: waterMax,
      },
      protein: {
        min: configured.proteinRatioMin,
        max: configured.proteinRatioMax,
      },
      lipid: {
        min: configured.lipidRatioMin,
        max: configured.lipidRatioMax,
      },
      carbohydrate: {
        min: configured.carbohydrateRatioMin,
        max: configured.carbohydrateRatioMax,
      },
      atSchoolPct: reference.atSchoolPct,
      atSchoolWaterPct: reference.atSchoolWaterPct,
    };
  }

  /**
   * Bảng thành phần dinh dưỡng theo bữa: % năng lượng cả ngày của từng bữa
   * và lượng Kcal / Protein / Lipid / Glucid / Nước (ml) mục tiêu tương ứng.
   */
  async getOverview(schoolId: number, ageGroup: string) {
    this.assertAgeGroup(ageGroup);
    const rows = (await this.findAll(schoolId, ageGroup)).filter(
      (row) => row.isActive,
    );
    const daily = await this.getDailyStandard(schoolId, ageGroup);

    const target = (
      pctMin: number,
      pctMax: number,
      explicitWaterMlMin?: number | null,
      explicitWaterMlMax?: number | null,
      explicitWaterPctMin?: number | null,
      explicitWaterPctMax?: number | null,
    ) => {
      const kcal = {
        min: round1((daily.energy.min * pctMin) / 100),
        max: round1((daily.energy.max * pctMax) / 100),
      };

      // Nhu cầu nước (ml) của bữa: ưu tiên số ml đã cấu hình cụ thể, hoặc suy từ % nước / % calo
      const waterPct = {
        min: explicitWaterPctMin ?? pctMin,
        max: explicitWaterPctMax ?? pctMax,
      };
      const waterMl = {
        min:
          explicitWaterMlMin != null && !isNaN(explicitWaterMlMin)
            ? round1(explicitWaterMlMin)
            : round1((daily.water.min * waterPct.min) / 100),
        max:
          explicitWaterMlMax != null && !isNaN(explicitWaterMlMax)
            ? round1(explicitWaterMlMax)
            : round1((daily.water.max * waterPct.max) / 100),
      };

      return {
        energyKcal: kcal,
        proteinG: {
          min: round1(((kcal.min * daily.protein.min) / 100 / 4)),
          max: round1(((kcal.max * daily.protein.max) / 100 / 4)),
        },
        lipidG: {
          min: round1(((kcal.min * daily.lipid.min) / 100 / 9)),
          max: round1(((kcal.max * daily.lipid.max) / 100 / 9)),
        },
        carbohydrateG: {
          min: round1(((kcal.min * daily.carbohydrate.min) / 100 / 4)),
          max: round1(((kcal.max * daily.carbohydrate.max) / 100 / 4)),
        },
        waterMl,
        waterPct,
      };
    };

    const meals = rows.map((row) => ({
      id: row.id,
      mealType: row.mealType,
      mealLabel: row.mealLabel,
      mealTime: row.mealTime,
      displayOrder: row.displayOrder,
      energyPct: { min: row.energyPctMin, max: row.energyPctMax },
      note: row.note,
      ...target(
        row.energyPctMin,
        row.energyPctMax,
        row.waterMlMin,
        row.waterMlMax,
        row.waterPctMin,
        row.waterPctMax,
      ),
    }));

    const atSchoolPct = {
      min: round1(rows.reduce((sum, row) => sum + row.energyPctMin, 0)),
      max: round1(rows.reduce((sum, row) => sum + row.energyPctMax, 0)),
    };
    const atHomePct = {
      min: round1(Math.max(0, 100 - atSchoolPct.max)),
      max: round1(Math.max(0, 100 - atSchoolPct.min)),
    };

    // Tổng nước tại trường (ml)
    const atSchoolWaterMl = {
      min: round1(meals.reduce((sum, m) => sum + m.waterMl.min, 0)),
      max: round1(meals.reduce((sum, m) => sum + m.waterMl.max, 0)),
    };
    const atSchoolWaterPct = {
      min: round1((atSchoolWaterMl.min / daily.water.max) * 100),
      max: round1((atSchoolWaterMl.max / daily.water.min) * 100),
    };

    // Nước còn lại ở nhà
    const atHomeWaterMl = {
      min: round1(Math.max(0, daily.water.min - atSchoolWaterMl.max)),
      max: round1(Math.max(0, daily.water.max - atSchoolWaterMl.min)),
    };
    const atHomeWaterPct = {
      min: round1((atHomeWaterMl.min / daily.water.max) * 100),
      max: round1((atHomeWaterMl.max / daily.water.min) * 100),
    };

    const warnings: string[] = [];
    if (atSchoolPct.max > 100)
      warnings.push('Tổng % các bữa tại trường vượt quá 100% nhu cầu cả ngày.');
    if (
      atSchoolPct.max < daily.atSchoolPct.min ||
      atSchoolPct.min > daily.atSchoolPct.max
    ) {
      warnings.push(
        `Tổng tại trường (${atSchoolPct.min}–${atSchoolPct.max}%) lệch khỏi khuyến nghị ${daily.atSchoolPct.min}–${daily.atSchoolPct.max}%.`,
      );
    }

    return {
      ageGroup,
      dailyStandard: daily,
      meals,
      totals: {
        atSchool: {
          energyPct: atSchoolPct,
          ...target(atSchoolPct.min, atSchoolPct.max),
          waterMl: atSchoolWaterMl,
          waterPct: atSchoolWaterPct,
        },
        atHome: {
          energyPct: atHomePct,
          ...target(atHomePct.min, atHomePct.max),
          waterMl: atHomeWaterMl,
          waterPct: atHomeWaterPct,
        },
        recommendedAtSchoolPct: daily.atSchoolPct,
        recommendedAtSchoolWaterPct: daily.atSchoolWaterPct,
      },
      warnings,
    };
  }

  async findOne(id: number, schoolId: number) {
    const row = await this.distributionRepo.findOne({
      where: { id, schoolId },
    });
    if (!row) throw new NotFoundException(`Không tìm thấy phân bổ bữa ăn #${id}`);
    return row;
  }

  private assertRange(min: number, max: number) {
    if (min > max)
      throw new BadRequestException(
        '% năng lượng tối thiểu không được lớn hơn % tối đa',
      );
  }

  async create(dto: CreateMealDistributionDto, schoolId: number) {
    this.assertRange(dto.energyPctMin, dto.energyPctMax);
    const exists = await this.distributionRepo.findOne({
      where: {
        schoolId,
        ageGroup: dto.ageGroup,
        mealType: dto.mealType,
      },
    });
    if (exists)
      throw new ConflictException(
        'Bữa ăn này đã có cấu hình cho nhóm tuổi đã chọn',
      );
    return this.distributionRepo.save(
      this.distributionRepo.create({ ...dto, schoolId }),
    );
  }

  async update(id: number, dto: UpdateMealDistributionDto, schoolId: number) {
    const row = await this.findOne(id, schoolId);
    this.assertRange(
      dto.energyPctMin ?? row.energyPctMin,
      dto.energyPctMax ?? row.energyPctMax,
    );
    if (
      (dto.ageGroup && dto.ageGroup !== row.ageGroup) ||
      (dto.mealType && dto.mealType !== row.mealType)
    ) {
      const clash = await this.distributionRepo.findOne({
        where: {
          schoolId,
          ageGroup: dto.ageGroup ?? row.ageGroup,
          mealType: dto.mealType ?? row.mealType,
        },
      });
      if (clash && clash.id !== row.id)
        throw new ConflictException(
          'Bữa ăn này đã có cấu hình cho nhóm tuổi đã chọn',
        );
    }
    Object.assign(row, dto);
    return this.distributionRepo.save(row);
  }

  async remove(id: number, schoolId: number) {
    const row = await this.findOne(id, schoolId);
    await this.distributionRepo.remove(row);
    return { success: true, message: `Đã xóa phân bổ bữa ăn #${id}` };
  }

  /** Khôi phục giá trị mặc định cho một nhóm tuổi (xóa cấu hình hiện tại). */
  async resetDefaults(ageGroup: string, schoolId: number) {
    this.assertAgeGroup(ageGroup);
    await this.distributionRepo.manager.transaction(async (manager) => {
      await manager.delete(MealEnergyDistribution, { schoolId, ageGroup });
      await manager.insert(
        MealEnergyDistribution,
        DEFAULT_MEAL_DISTRIBUTIONS[ageGroup].map((item) => ({
          ...item,
          ageGroup,
          schoolId,
          sourceMetadata: {
            source: SOURCE,
            seedKey: `${ageGroup}:${item.mealType}`,
          },
        })),
      );
    });
    return this.findAll(schoolId, ageGroup);
  }
}
