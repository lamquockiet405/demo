import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DishFrequencyRule } from '../entities/dish-frequency-rule.entity';
import { CreateFrequencyRuleDto } from '../dto/create-frequency-rule.dto';
import { UpdateFrequencyRuleDto } from '../dto/update-frequency-rule.dto';
import { DishCategory } from '../../dishes/entities/dish-category.entity';
import { FoodCategory } from '../../foods/entities/food-category.entity';

@Injectable()
export class FrequencyRulesService {
  constructor(
    @InjectRepository(DishFrequencyRule)
    private readonly ruleRepo: Repository<DishFrequencyRule>,
    @InjectRepository(DishCategory)
    private readonly dishCategoryRepo: Repository<DishCategory>,
    @InjectRepository(FoodCategory)
    private readonly foodCategoryRepo: Repository<FoodCategory>,
  ) {}

  async findAll(schoolId: number = 1, query?: { targetType?: string; ageGroup?: string; mealSlot?: string; isActive?: boolean }) {
    const qb = this.ruleRepo.createQueryBuilder('rule');
    qb.where('rule.school_id = :schoolId', { schoolId });

    if (query?.targetType) {
      qb.andWhere('rule.target_type = :targetType', { targetType: query.targetType });
    }
    if (query?.ageGroup && query.ageGroup !== 'ALL') {
      qb.andWhere('(rule.age_group = :ageGroup OR rule.age_group = :all)', { ageGroup: query.ageGroup, all: 'ALL' });
    }
    if (query?.mealSlot && query.mealSlot !== 'ALL') {
      qb.andWhere('(rule.meal_slot = :mealSlot OR rule.meal_slot = :allSlot)', { mealSlot: query.mealSlot, allSlot: 'ALL' });
    }
    if (query?.isActive !== undefined) {
      qb.andWhere('rule.is_active = :isActive', { isActive: query.isActive });
    }

    qb.orderBy('rule.target_type', 'ASC').addOrderBy('rule.id', 'ASC');
    return qb.getMany();
  }

  async findOne(id: number, schoolId: number = 1) {
    const rule = await this.ruleRepo.findOne({ where: { id, schoolId } });
    if (!rule) {
      throw new NotFoundException(`Không tìm thấy quy tắc tần suất ID #${id}`);
    }
    return rule;
  }

  async create(dto: CreateFrequencyRuleDto, schoolId: number = 1) {
    if (dto.minOccurrences > dto.maxOccurrences) {
      throw new BadRequestException('Số lần tối thiểu không được lớn hơn số lần tối đa');
    }

    const entity = this.ruleRepo.create({
      ...dto,
      schoolId,
    });
    return this.ruleRepo.save(entity);
  }

  async update(id: number, dto: UpdateFrequencyRuleDto, schoolId: number = 1) {
    const rule = await this.findOne(id, schoolId);

    const min = dto.minOccurrences !== undefined ? dto.minOccurrences : rule.minOccurrences;
    const max = dto.maxOccurrences !== undefined ? dto.maxOccurrences : rule.maxOccurrences;
    if (min > max) {
      throw new BadRequestException('Số lần tối thiểu không được lớn hơn số lần tối đa');
    }

    Object.assign(rule, dto);
    return this.ruleRepo.save(rule);
  }

  async toggleActive(id: number, schoolId: number = 1) {
    const rule = await this.findOne(id, schoolId);
    rule.isActive = !rule.isActive;
    return this.ruleRepo.save(rule);
  }

  async remove(id: number, schoolId: number = 1) {
    const rule = await this.findOne(id, schoolId);
    await this.ruleRepo.remove(rule);
    return { success: true, message: `Đã xóa quy tắc #${id}` };
  }

  /**
   * Lấy danh mục 10 nhóm thực phẩm Phụ lục 7 và danh mục loại món từ database
   */
  async getFoodGroupsCatalog() {
    const [dishCategories, foodCategories] = await Promise.all([
      this.dishCategoryRepo.find({ order: { displayOrder: 'ASC' } }),
      this.foodCategoryRepo.find(),
    ]);

    // 10 Nhóm thực phẩm chuẩn hóa theo Phụ lục 7 Bộ GDĐT/BYT
    const standardFoodGroups = [
      { code: 'CEREAL', name: 'I. Ngũ cốc và sản phẩm chế biến' },
      { code: 'TUBER', name: 'II. Khoai củ và sản phẩm chế biến' },
      { code: 'BEANS_NUTS', name: 'III. Hạt, quả giàu đạm, béo và chế biến' },
      { code: 'VEGETABLE', name: 'IV. Rau, quả, củ dùng làm rau' },
      { code: 'FRUIT', name: 'V. Quả chín' },
      { code: 'OIL_FAT', name: 'VI. Dầu, mỡ, bơ' },
      { code: 'MEAT', name: 'VII. Thịt và sản phẩm chế biến' },
      { code: 'SEAFOOD', name: 'VIII. Thủy sản và sản phẩm chế biến' },
      { code: 'EGG', name: 'IX. Trứng và sản phẩm chế biến' },
      { code: 'MILK', name: 'X. Sữa và sản phẩm chế biến' },
    ];

    return {
      dishCategories: dishCategories.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        isRequiredInMeal: c.isRequiredInMeal,
        displayOrder: c.displayOrder,
      })),
      foodCategories: foodCategories.map((fc) => ({
        id: fc.id,
        name: fc.name,
      })),
      standardFoodGroups,
    };
  }

  async getSummary(schoolId: number = 1) {
    const total = await this.ruleRepo.count({ where: { schoolId } });
    const active = await this.ruleRepo.count({ where: { schoolId, isActive: true } });
    const dishCategoryRules = await this.ruleRepo.count({ where: { schoolId, targetType: 'DISH_CATEGORY' } });
    const foodGroupRules = await this.ruleRepo.count({ where: { schoolId, targetType: 'FOOD_GROUP' } });

    return {
      total,
      active,
      dishCategoryRules,
      foodGroupRules,
    };
  }
}

