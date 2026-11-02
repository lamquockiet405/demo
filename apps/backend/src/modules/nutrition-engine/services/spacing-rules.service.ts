import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DishSpacingRule } from '../entities/dish-spacing-rule.entity';
import { CreateSpacingRuleDto } from '../dto/create-spacing-rule.dto';
import { UpdateSpacingRuleDto } from '../dto/update-spacing-rule.dto';
import { Dish } from '../../dishes/entities/dish.entity';
import { DishCategory } from '../../dishes/entities/dish-category.entity';

@Injectable()
export class SpacingRulesService {
  constructor(
    @InjectRepository(DishSpacingRule)
    private readonly ruleRepo: Repository<DishSpacingRule>,
    @InjectRepository(Dish)
    private readonly dishRepo: Repository<Dish>,
    @InjectRepository(DishCategory)
    private readonly dishCategoryRepo: Repository<DishCategory>,
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

    qb.orderBy('rule.priority_order', 'DESC').addOrderBy('rule.min_spacing_days', 'DESC');
    return qb.getMany();
  }

  async findOne(id: number, schoolId: number = 1) {
    const rule = await this.ruleRepo.findOne({ where: { id, schoolId } });
    if (!rule) {
      throw new NotFoundException(`Không tìm thấy quy tắc giãn cách ID #${id}`);
    }
    return rule;
  }

  async create(dto: CreateSpacingRuleDto, schoolId: number = 1) {
    const entity = this.ruleRepo.create({
      ...dto,
      schoolId,
    });
    return this.ruleRepo.save(entity);
  }

  async update(id: number, dto: UpdateSpacingRuleDto, schoolId: number = 1) {
    const rule = await this.findOne(id, schoolId);
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
    return { success: true, message: `Đã xóa quy tắc giãn cách #${id}` };
  }

  /**
   * Lấy danh mục món ăn và loại món khả dụng từ database để cấu hình giãn cách
   */
  async getDishesCatalog() {
    const [dishes, categories] = await Promise.all([
      this.dishRepo.find({
        relations: ['category'],
        order: { name: 'ASC' },
      }),
      this.dishCategoryRepo.find({ order: { displayOrder: 'ASC' } }),
    ]);

    return {
      categories: categories.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
      })),
      dishes: dishes.map((d) => ({
        id: d.id,
        name: d.name,
        categoryCode: d.category?.code || 'UNKNOWN',
        categoryName: d.category?.name || '',
      })),
    };
  }

  async getSummary(schoolId: number = 1) {
    const total = await this.ruleRepo.count({ where: { schoolId } });
    const active = await this.ruleRepo.count({ where: { schoolId, isActive: true } });
    const categoryRules = await this.ruleRepo.count({ where: { schoolId, targetType: 'DISH_CATEGORY' } });
    const specificDishRules = await this.ruleRepo.count({ where: { schoolId, targetType: 'SPECIFIC_DISH' } });

    return {
      total,
      active,
      categoryRules,
      specificDishRules,
    };
  }
}

