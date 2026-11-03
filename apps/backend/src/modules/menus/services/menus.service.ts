import { Injectable, Optional, NotFoundException, BadRequestException, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Menu } from '../entities/menu.entity';
import { MenuVersion } from '../entities/menu-version.entity';
import { MenuDay } from '../entities/menu-day.entity';
import { MenuMeal } from '../entities/menu-meal.entity';
import { MenuDish } from '../entities/menu-dish.entity';
import { MenuCycle } from '../entities/menu-cycle.entity';
import { Dish } from '../../dishes/entities/dish.entity';
import { getPortionNutrition, hasVerifiedNutrition } from '../../dishes/nutrition.util';
import { NutritionalStandard } from '../entities/nutritional-standard.entity';
import { MenuRuleViolation } from '../entities/menu-rule-violation.entity';
import { QueryMenuDto } from '../dto/query-menu.dto';
import { CreateMenuDto } from '../dto/create-menu.dto';
import { UpdateMenuDto } from '../dto/update-menu.dto';
import { AdjustDishDto } from '../dto/adjust-dish.dto';
import { AutoGenerateMenuDto } from '../dto/auto-generate-menu.dto';
import { SubmitMenuDto } from '../dto/submit-menu.dto';
import { AuditLogsService } from '../../audit-logs/services/audit-logs.service';
import { DishFrequencyRule } from '../../nutrition-engine/entities/dish-frequency-rule.entity';
import { DishSpacingRule } from '../../nutrition-engine/entities/dish-spacing-rule.entity';
import { NutritionIntakeStandard } from '../../nutrition-engine/entities/nutrition-intake-standard.entity';

// â”€â”€ Helper: Fisher-Yates shuffle for true randomness â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// â”€â”€ Interfaces for structured daily nutrition â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface DishWithNutrition {
  id: number;
  name: string;
  categoryCode: string;
  categoryName: string;
  energyKcal: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  portionSizeG: number;
}

export interface DayDishSlot {
  dishId: string;
  dishName: string;
  dishType: string;
  mealTime: string;
  servingOrder: number;
  portionSizeG: number;
  plannedCalories: number;
  proteinG: number;
  fatG: number;
  carbG: number;
}

export interface DayMealPlan {
  dayOfWeek: number;
  dayName: string;
  dishes: DayDishSlot[];
  totalCalories: number;
  totalProteinG: number;
  totalFatG: number;
  totalCarbG: number;
  proteinPct: number;
  lipidPct: number;
  glucidPct: number;
  isCompliant: boolean;
  violations: string[];
  standardNote: string;
}

@Injectable()
export class MenusService implements OnModuleInit {
  async onModuleInit() {
    try {
      await this.menuRepo.query(`
        ALTER TABLE menus 
        ADD COLUMN IF NOT EXISTS submitted_by BIGINT,
        ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS commitment_signed BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS commitment_text TEXT,
        ADD COLUMN IF NOT EXISTS commitment_items JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS override_justification TEXT,
        ADD COLUMN IF NOT EXISTS violations_snapshot JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS approval_notes TEXT,
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
        ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

        CREATE INDEX IF NOT EXISTS idx_menus_submitted_by ON menus(submitted_by);
        CREATE INDEX IF NOT EXISTS idx_menus_submitted_at ON menus(submitted_at);
      `);
      this.logger.log('Tự động đồng bộ các cột nộp duyệt vào bảng menus thành công.');
    } catch (err: any) {
      this.logger.warn(`Kiểm tra cấu trúc bảng menus: ${err.message}`);
    }
  }
  private readonly logger = new Logger(MenusService.name);

  constructor(
    @InjectRepository(Menu)
    private readonly menuRepo: Repository<Menu>,
    @InjectRepository(MenuVersion)
    private readonly versionRepo: Repository<MenuVersion>,
    @InjectRepository(MenuDay)
    private readonly dayRepo: Repository<MenuDay>,
    @InjectRepository(MenuMeal)
    private readonly mealRepo: Repository<MenuMeal>,
    @InjectRepository(MenuDish)
    private readonly menuDishRepo: Repository<MenuDish>,
    @InjectRepository(MenuCycle)
    private readonly cycleRepo: Repository<MenuCycle>,
    @InjectRepository(Dish)
    private readonly dishRepo: Repository<Dish>,
    @InjectRepository(NutritionalStandard)
    private readonly standardRepo: Repository<NutritionalStandard>,
    @InjectRepository(MenuRuleViolation)
    private readonly violationRepo: Repository<MenuRuleViolation>,
    @Optional() private readonly auditLogsService?: AuditLogsService,
    @Optional() @InjectRepository(DishFrequencyRule) private readonly freqRuleRepo?: Repository<DishFrequencyRule>,
    @Optional() @InjectRepository(DishSpacingRule) private readonly spacingRuleRepo?: Repository<DishSpacingRule>,
    @Optional() @InjectRepository(NutritionIntakeStandard) private readonly intakeStandardRepo?: Repository<NutritionIntakeStandard>,
  ) {}

  async findAll(query: QueryMenuDto) {
    const qb = this.menuRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.creator', 'creator')
      .leftJoinAndSelect('m.approver', 'approver')
      .leftJoinAndSelect('m.submitter', 'submitter');

    if (query.search) {
      qb.andWhere('LOWER(m.title) LIKE :s', { s: `%${query.search.toLowerCase()}%` });
    }

    if (query.status === 'ALL_SUBMITTED') {
      qb.andWhere('m.status IN (:...submittedStatuses)', {
        submittedStatuses: ['PENDING', 'SUBMITTED_FOR_REVIEW', 'APPROVED', 'ACTIVE', 'PUBLISHED', 'REJECTED'],
      });
    } else if (query.status && query.status !== 'ALL') {
      if (query.status === 'SUBMITTED_FOR_REVIEW' || query.status === 'PENDING') {
        qb.andWhere('m.status IN (:...pendingStatuses)', { pendingStatuses: ['PENDING', 'SUBMITTED_FOR_REVIEW'] });
      } else if (query.status === 'ACTIVE' || query.status === 'PUBLISHED') {
        qb.andWhere('m.status IN (:...activeStatuses)', { activeStatuses: ['ACTIVE', 'PUBLISHED'] });
      } else {
        qb.andWhere('m.status = :status', { status: query.status });
      }
    }

    const ageGroup = query.ageGroup || query.targetAgeGroup;
    if (ageGroup && ageGroup !== 'ALL') {
      const normalizedAge = ageGroup === 'TODDLER_18_36M' ? 'NHA_TRE' : (ageGroup === 'KINDERGARTEN_3_5Y' ? 'MAU_GIAO' : ageGroup);
      qb.andWhere('m.ageGroup = :ageGroup', { ageGroup: normalizedAge });
    }

    if (query.weekStartDate) {
      qb.andWhere('m.weekStartDate = :wsd', { wsd: query.weekStartDate });
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    qb.skip((page - 1) * limit).take(limit);
    qb.orderBy('m.weekStartDate', 'DESC');

    const [items, total] = await qb.getManyAndCount();

    // Tính toán dinh dưỡng thực tế 100% từ cơ sở dữ liệu dish_nutrition
    const menuIds = items.map((m) => m.id);
    const nutritionMap: Record<number, { cal: number; prot: number; fat: number; carb: number; available: boolean }> = {};

    if (menuIds.length > 0) {
      try {
        const nutRows = await this.menuRepo.query(
          `SELECT 
             mv.menu_id,
             ROUND(COALESCE(SUM(dn.energy_kcal * COALESCE(mdi.portion_size_g / NULLIF(d.standard_serving_size_g, 0), 1)) / NULLIF(COUNT(DISTINCT md.id), 0), 0), 1) as avg_cal,
             ROUND(COALESCE(SUM(dn.protein_g * COALESCE(mdi.portion_size_g / NULLIF(d.standard_serving_size_g, 0), 1)) / NULLIF(COUNT(DISTINCT md.id), 0), 0), 1) as avg_prot,
             ROUND(COALESCE(SUM(dn.fat_g * COALESCE(mdi.portion_size_g / NULLIF(d.standard_serving_size_g, 0), 1)) / NULLIF(COUNT(DISTINCT md.id), 0), 0), 1) as avg_fat,
             ROUND(COALESCE(SUM(dn.carb_g * COALESCE(mdi.portion_size_g / NULLIF(d.standard_serving_size_g, 0), 1)) / NULLIF(COUNT(DISTINCT md.id), 0), 0), 1) as avg_carb,
             COUNT(mdi.id) > 0 AND COUNT(dn.dish_id) = COUNT(mdi.id) AS available
           FROM menu_versions mv
           JOIN menu_days md ON md.menu_version_id = mv.id
           LEFT JOIN menu_meals mm ON mm.menu_day_id = md.id
           LEFT JOIN menu_dishes mdi ON mdi.menu_meal_id = mm.id
           LEFT JOIN dishes d ON d.id = mdi.dish_id
           LEFT JOIN dish_nutrition dn ON dn.dish_id = mdi.dish_id AND d.nutrition_verified = TRUE
           WHERE mv.menu_id = ANY($1)
             AND mv.version_number = (SELECT MAX(latest.version_number) FROM menu_versions latest WHERE latest.menu_id = mv.menu_id)
           GROUP BY mv.menu_id`,
          [menuIds],
        );
        for (const row of nutRows) {
          nutritionMap[Number(row.menu_id)] = {
            cal: Number(row.avg_cal) || 0,
            prot: Number(row.avg_prot) || 0,
            fat: Number(row.avg_fat) || 0,
            carb: Number(row.avg_carb) || 0,
            available: row.available === true,
          };
        }
      } catch (err: any) {
        this.logger.warn(`Lỗi tính toán dinh dưỡng thực tế: ${err.message}`);
      }
    }

    const mapped = items.map((m) => {
      const nut = nutritionMap[m.id] || { cal: 0, prot: 0, fat: 0, carb: 0, available: false };
      return {
        id: String(m.id),
        tenantId: '1',
        title: m.title,
        weekStartDate: m.weekStartDate,
        weekEndDate: m.weekEndDate,
        startDate: m.weekStartDate,
        endDate: m.weekEndDate,
        ageGroup: m.ageGroup,
        targetAgeGroup: m.ageGroup,
        status: m.status,
        cycleId: m.cycleId ? String(m.cycleId) : null,
        cycleWeekNumber: 1,
        createdByName: m.creator?.fullName || 'Chuyên viên Dinh dưỡng',
        approvedByName: m.approver?.fullName || null,
        approvedAt: m.approvedAt ? m.approvedAt.toISOString() : null,
        submittedBy: m.submittedBy ? String(m.submittedBy) : null,
        submittedByName: m.submitter?.fullName || (m.submittedBy ? 'Chuyên viên Dinh dưỡng' : null),
        submittedAt: m.submittedAt ? m.submittedAt.toISOString() : null,
        createdAt: m.submittedAt ? m.submittedAt.toISOString() : null,
        updatedAt: m.approvedAt ? m.approvedAt.toISOString() : (m.submittedAt ? m.submittedAt.toISOString() : null),
        approvalNotes: m.approvalNotes || null,
        rejectionReason: m.rejectionReason || null,
        rejectedAt: m.rejectedAt ? m.rejectedAt.toISOString() : null,
        publishedAt: m.publishedAt ? m.publishedAt.toISOString() : null,
        commitmentSigned: m.commitmentSigned ?? false,
        commitmentText: m.commitmentText || null,
        commitmentItems: m.commitmentItems || [],
        overrideJustification: m.overrideJustification || null,
        violationsSnapshot: m.violationsSnapshot || [],
        version: 1,
        isPublished: m.status === 'ACTIVE' || m.status === 'APPROVED' || m.status === 'PUBLISHED',
        dailyAverageCalories: nut.cal,
        dailyAverageProteinG: nut.prot,
        dailyAverageFatG: nut.fat,
        dailyAverageCarbG: nut.carb,
        nutritionAvailable: nut.available,
      };
    });

    return { items: mapped, total, page, limit };
  }

  async getStatistics() {
    const total = await this.menuRepo.count();
    const approved = await this.menuRepo.count({ where: { status: 'APPROVED' } });
    const pending = await this.menuRepo.count({ where: [{ status: 'SUBMITTED_FOR_REVIEW' }, { status: 'PENDING' }] });
    const draft = await this.menuRepo.count({ where: { status: 'DRAFT' } });
    const active = await this.menuRepo.count({ where: [{ status: 'ACTIVE' }, { status: 'PUBLISHED' }] });
    const published = await this.menuRepo.count({ where: { status: 'PUBLISHED' } });

    let realAvgCalories = 0;
    try {
      const avgRows = await this.menuRepo.query(
        `SELECT ROUND(COALESCE(AVG(dn.energy_kcal * COALESCE(md.portion_size_g / NULLIF(d.standard_serving_size_g, 0), 1)), 0), 1) as avg_cal
         FROM menu_dishes md
         JOIN dishes d ON d.id = md.dish_id AND d.nutrition_verified = TRUE
         JOIN dish_nutrition dn ON dn.dish_id = md.dish_id`
      );
      realAvgCalories = Number(avgRows?.[0]?.avg_cal) || 0;
    } catch (e: any) {
      realAvgCalories = 0;
    }

    return {
      total,
      totalMenus: total,
      active: active || published || 0,
      submitted: pending,
      pendingApproval: pending,
      draft,
      draftMenus: draft,
      approved,
      approvedMenus: approved,
      publishedMenus: published,
      rejected: 0,
      avgCalories: realAvgCalories,
      nutritionStandard: 'Thông tư 28/2016/TT-BGDĐT',
    };
  }

  async getAvailableDishes() {
    const dishes = await this.dishRepo.find({
      where: { status: 'ACTIVE' },
      relations: ['category', 'nutrition'],
      order: { name: 'ASC' },
    });

    return dishes.map((d) => ({
      id: String(d.id),
      name: d.name,
      categoryCode: d.category?.code || 'MAIN',
      categoryName: d.category?.name || 'MÃ³n Äƒn',
      nutritionAvailable: hasVerifiedNutrition(d),
      ...getPortionNutrition(d),
    }));
  }

  async findOne(id: number) {
    const menu = await this.menuRepo.findOne({
      where: { id },
      relations: ['creator', 'approver', 'submitter'],
    });

    if (!menu) {
      throw new NotFoundException(`Không tìm thấy thực đơn với ID: ${id}`);
    }

    // Find latest version
    let version = await this.versionRepo.findOne({
      where: { menuId: id },
      order: { versionNumber: 'DESC' },
    });

    if (!version) {
      version = await this.versionRepo.save(
        this.versionRepo.create({ menuId: id, versionNumber: 1, createdBy: menu.createdBy }),
      );
    }

    // Load days, meals, dishes
    const days = await this.dayRepo.find({
      where: { menuVersionId: version.id },
      order: { dayOfWeek: 'ASC' },
      relations: ['meals', 'meals.dishes', 'meals.dishes.dish', 'meals.dishes.dish.category', 'meals.dishes.dish.nutrition'],
    });

    const menuDishes: any[] = [];
    let totalMenuCalories = 0;
    let totalMenuProtein = 0;
    let totalMenuFat = 0;
    let totalMenuCarb = 0;
    const activeDaysCount = days.length || 5;

    for (const d of days) {
      const frontendDayOfWeek = d.dayOfWeek >= 2 && d.dayOfWeek <= 6 ? d.dayOfWeek - 1 : d.dayOfWeek;
      for (const m of (d.meals || [])) {
        for (const md of (m.dishes || [])) {
          const nutrients = getPortionNutrition(md.dish, md.portionSizeG);
          const { energyKcal: cal, proteinG: prot, fatG: fat, carbG: carb } = nutrients;

          totalMenuCalories += cal;
          totalMenuProtein += prot;
          totalMenuFat += fat;
          totalMenuCarb += carb;

          menuDishes.push({
            id: String(md.id),
            tenantId: '1',
            menuId: String(menu.id),
            dishId: String(md.dishId),
            dayOfWeek: frontendDayOfWeek,
            mealTime: m.mealType,
            servingOrder: md.displayOrder || 1,
            portionSizeG: md.portionSizeG ?? md.dish?.standardServingSizeG ?? 100,
            nutritionAvailable: hasVerifiedNutrition(md.dish),
            plannedCalories: cal,
            specialDietNotes: md.specialDietNotes || null,
            dish: {
              id: String(md.dish?.id),
              name: md.dish?.name || 'Món ăn',
              dishType: md.dish?.category?.code || 'MAIN',
              targetAgeGroup: menu.ageGroup,
              standardServingSizeG: md.dish?.standardServingSizeG ?? 100,
              nutritionAvailable: hasVerifiedNutrition(md.dish),
              totalCalories: getPortionNutrition(md.dish).energyKcal,
              totalProteinG: getPortionNutrition(md.dish).proteinG,
              totalFatG: getPortionNutrition(md.dish).fatG,
              totalCarbG: getPortionNutrition(md.dish).carbG,
              isActive: true,
            },
          });
        }
      }
    }

    const avgCal = Math.round((totalMenuCalories / activeDaysCount) * 10) / 10;
    const avgProt = Math.round((totalMenuProtein / activeDaysCount) * 10) / 10;
    const avgFat = Math.round((totalMenuFat / activeDaysCount) * 10) / 10;
    const avgCarb = Math.round((totalMenuCarb / activeDaysCount) * 10) / 10;

    return {
      id: String(menu.id),
      title: menu.title,
      weekStartDate: menu.weekStartDate,
      weekEndDate: menu.weekEndDate,
      startDate: menu.weekStartDate,
      endDate: menu.weekEndDate,
      ageGroup: menu.ageGroup,
      targetAgeGroup: menu.ageGroup,
      status: menu.status,
      cycleId: menu.cycleId ? String(menu.cycleId) : null,
      createdByName: menu.creator?.fullName || 'Chuyên viên Dinh dưỡng',
      approvedByName: menu.approver?.fullName || null,
      approvedAt: menu.approvedAt ? menu.approvedAt.toISOString() : null,
      submittedBy: menu.submittedBy ? String(menu.submittedBy) : null,
      submittedByName: menu.submitter?.fullName || (menu.submittedBy ? 'Chuyên viên Dinh dưỡng' : null),
      submittedAt: menu.submittedAt ? menu.submittedAt.toISOString() : null,
      approvalNotes: menu.approvalNotes || null,
      rejectionReason: menu.rejectionReason || null,
      rejectedAt: menu.rejectedAt ? menu.rejectedAt.toISOString() : null,
      publishedAt: menu.publishedAt ? menu.publishedAt.toISOString() : null,
      commitmentSigned: menu.commitmentSigned ?? false,
      commitmentText: menu.commitmentText || null,
      commitmentItems: menu.commitmentItems || [],
      overrideJustification: menu.overrideJustification || null,
      violationsSnapshot: menu.violationsSnapshot || [],
      version: version.versionNumber,
      versionNumber: version.versionNumber,
      dailyAverageCalories: avgCal,
      dailyAverageProteinG: avgProt,
      dailyAverageFatG: avgFat,
      dailyAverageCarbG: avgCarb,
      nutritionAvailable: menuDishes.length > 0 && menuDishes.every((item) => item.nutritionAvailable),
      menuDishes,
      days: days.map((d) => ({
        id: String(d.id),
        dayOfWeek: d.dayOfWeek >= 2 && d.dayOfWeek <= 6 ? d.dayOfWeek - 1 : d.dayOfWeek,
        date: d.date,
        meals: (d.meals || []).map((m) => ({
          id: String(m.id),
          mealType: m.mealType,
          dishes: (m.dishes || []).map((md) => ({
            id: String(md.id),
            dishId: String(md.dishId),
            dishName: md.dish?.name || 'Món ăn',
            categoryCode: md.dish?.category?.code || 'MAIN',
            categoryName: md.dish?.category?.name || 'Món ăn',
            portionSizeG: md.portionSizeG,
            nutritionAvailable: hasVerifiedNutrition(md.dish),
            ...getPortionNutrition(md.dish, md.portionSizeG),
          })),
        })),
      })),
    };
  }

  async getVersions(menuId: number) {
    const versions = await this.versionRepo.find({
      where: { menuId },
      relations: ['creator'],
      order: { versionNumber: 'DESC' },
    });

    if (versions.length === 0) {
      return [
        {
          id: 'v1',
          menuId: String(menuId),
          version: 1,
          versionNumber: 1,
          changeNote: 'PhiÃªn báº£n gá»‘c',
          createdAt: new Date().toISOString(),
          createdByName: 'ChuyÃªn viÃªn Dinh dÆ°á»¡ng',
        },
      ];
    }

    return versions.map((v) => ({
      id: String(v.id),
      menuId: String(v.menuId),
      version: v.versionNumber,
      versionNumber: v.versionNumber,
      changeNote: v.changeNote || 'Khá»Ÿi táº¡o thá»±c Ä‘Æ¡n tuáº§n',
      createdAt: v.createdAt ? v.createdAt.toISOString() : new Date().toISOString(),
      createdByName: v.creator?.fullName || 'ChuyÃªn viÃªn Dinh dÆ°á»¡ng',
    }));
  }

  async getAdvisory(menuId: number) {
    const menu = await this.menuRepo.findOne({ where: { id: menuId } });
    const menuDetail = await this.findOne(menuId);

    // 1. Tải danh sách dị ứng học sinh từ database
    const studentAllergiesRaw = await this.menuDishRepo.manager.query(`
      SELECT s.id as student_id, s.full_name, c.id as class_id, c.name as class_name, a.name as allergen_name, a.code as allergen_code, sa.severity
      FROM student_allergies sa
      JOIN students s ON sa.student_id = s.id
      JOIN allergens a ON sa.allergen_id = a.id
      LEFT JOIN classes c ON s.class_id = c.id
      ORDER BY s.full_name ASC
    `);

    // 2. Tải danh sách tăng trưởng BMI / WHO Z-score từ database
    const bmiStudentsRaw = await this.menuDishRepo.manager.query(`
      SELECT s.id as student_id, s.full_name, c.name as class_name, gz.classification, pm.weight_kg, pm.height_cm, gz.baz
      FROM growth_zscores gz
      JOIN physical_measurements pm ON gz.measurement_id = pm.id
      JOIN students s ON pm.student_id = s.id
      LEFT JOIN classes c ON s.class_id = c.id
      ORDER BY s.full_name ASC
    `);

    // 3. Quét xung đột dị ứng giữa món ăn trong tuần và các bé
    const allergyConflicts: any[] = [];
    const allergenKeywords: Record<string, string[]> = {
      'Hải sản': ['hải sản', 'tôm', 'cua', 'cá', 'mực', 'nghêu', 'hến', 'sò', 'chả cá', 'cá hồi'],
      'SEAFOOD': ['hải sản', 'tôm', 'cua', 'cá', 'mực', 'nghêu', 'hến', 'sò', 'chả cá', 'cá hồi'],
      'CRUSTACEAN': ['tôm', 'cua', 'hải sản'],
      'Sữa bò': ['sữa', 'yaourt', 'phô mai', 'flan', 'bơ'],
      'MILK': ['sữa', 'yaourt', 'phô mai', 'flan', 'bơ'],
      'Đậu phộng': ['đậu phộng', 'lạc', 'bơ đậu phộng'],
      'PEANUT': ['đậu phộng', 'lạc', 'bơ đậu phộng'],
      'Trứng': ['trứng', 'hột gà', 'hột vịt'],
      'EGG': ['trứng', 'hột gà', 'hột vịt'],
      'Đậu nành': ['đậu nành', 'đậu phụ', 'tàu hũ', 'đậu hũ'],
      'SOY': ['đậu nành', 'đậu phụ', 'tàu hũ', 'đậu hũ'],
      'Lúa mì': ['lúa mì', 'bánh mì', 'bánh bao', 'mì sợi', 'hoành thánh'],
      'WHEAT': ['lúa mì', 'bánh mì', 'bánh bao', 'mì sợi', 'hoành thánh'],
      'Mè (vừng)': ['mè', 'vừng', 'dầu mè'],
      'SESAME': ['mè', 'vừng', 'dầu mè'],
    };

    let cflCounter = 1;
    for (const md of menuDetail.menuDishes || []) {
      const dishNameLower = (md.dish?.name || '').toLowerCase();

      for (const sa of studentAllergiesRaw) {
        const keywords = allergenKeywords[sa.allergen_name] || allergenKeywords[sa.allergen_code] || [sa.allergen_name.toLowerCase()];
        const isMatched = keywords.some((kw) => dishNameLower.includes(kw.toLowerCase()));

        if (isMatched) {
          allergyConflicts.push({
            conflictId: `cfl-${cflCounter++}`,
            childId: String(sa.student_id),
            childName: sa.full_name,
            classId: sa.class_id ? String(sa.class_id) : null,
            className: sa.class_name || 'Chưa có lớp',
            allergenDetected: sa.allergen_name,
            allergenCode: sa.allergen_code || 'ALLERGEN',
            severity: sa.severity === 'HIGH' ? 'SEVERE' : (sa.severity === 'MEDIUM' ? 'WARNING' : 'MILD'),
            reactionTreatment: sa.severity === 'HIGH' ? 'Báo y tế trường ngay, sẵn sàng thuốc kháng histamine / Epipen' : 'Theo dõi biểu hiện ngoài da / tiêu hóa',
            menuDishId: String(md.id),
            dishId: String(md.dishId),
            dishName: md.dish?.name || 'Món ăn',
            dishType: md.dish?.dishType || 'MAIN',
            dayOfWeek: md.dayOfWeek,
            mealTime: md.mealTime,
            portionSizeG: md.portionSizeG || 100,
            plannedCalories: md.plannedCalories,
            substituteDishId: null,
            currentSubstituteDishName: null,
            // Source menus do not provide verified recipes or substitutions.
            problematicIngredients: [],
            suggestedIngredientSubstitutions: [],
            suggestedSubstituteDishes: [],
          });
        }
      }
    }

    // 4. Nhóm trẻ thừa cân / béo phì (Loại 2)
    const overweightChildren = bmiStudentsRaw
      .filter((s: any) => s.classification === 'OVERWEIGHT' || s.classification === 'OBESE')
      .map((s: any) => {
        const w = Number(s.weight_kg) || 19;
        const h = Number(s.height_cm) || 100;
        const bmi = Math.round((w / Math.pow(h / 100, 2)) * 10) / 10;
        return {
          childId: String(s.student_id),
          childName: s.full_name,
          className: s.class_name || 'Lớp Mẫu giáo',
          weightKg: w,
          heightCm: h,
          bmi,
          baz: Number(s.baz) || 2.1,
          classification: s.classification,
          statusText: 'Thừa cân / Nguy cơ béo phì (WHO)',
          healthNotes: 'Cần giảm 10–15% chất béo & calo, hạn chế món chiên rán, tăng cường rau củ theo TT 28',
        };
      });

    // 5. Nhóm trẻ còi xương / suy dinh dưỡng (Loại 1)
    const wastedChildren = bmiStudentsRaw
      .filter((s: any) => s.classification === 'UNDERWEIGHT' || s.classification === 'STUNTED')
      .map((s: any) => {
        const w = Number(s.weight_kg) || 11.5;
        const h = Number(s.height_cm) || 89;
        const bmi = Math.round((w / Math.pow(h / 100, 2)) * 10) / 10;
        return {
          childId: String(s.student_id),
          childName: s.full_name,
          className: s.class_name || 'Lớp Mầm 1',
          weightKg: w,
          heightCm: h,
          bmi,
          baz: Number(s.baz) || -1.2,
          classification: s.classification,
          statusText: 'Còi xương / Thấp còi / Suy dinh dưỡng (WHO)',
          healthNotes: 'Cần tăng đạm sinh học cao, bổ sung dầu gấc/oliu, tăng 15–20% khẩu phần ăn theo QĐ 1246 & TT 28',
        };
      });

    const affectedChildrenSet = new Set(allergyConflicts.map((c) => c.childId));
    const affectedDishesSet = new Set(allergyConflicts.map((c) => c.dishId));

    return {
      menuId: String(menuId),
      menuTitle: menu?.title || 'Thực đơn tuần',
      targetAgeGroup: menu?.ageGroup || 'MAU_GIAO',
      allergySummary: {
        totalConflicts: allergyConflicts.length,
        criticalCount: allergyConflicts.filter((c) => c.severity === 'SEVERE').length,
        warningCount: allergyConflicts.filter((c) => c.severity !== 'SEVERE').length,
        affectedChildrenCount: affectedChildrenSet.size,
        affectedDishesCount: affectedDishesSet.size,
      },
      allergyConflicts,
      bmiSummary: {
        totalEvaluated: bmiStudentsRaw.length,
        overweightObeseCount: overweightChildren.length,
        wastedUnderweightCount: wastedChildren.length,
        normalCount: Math.max(0, bmiStudentsRaw.length - overweightChildren.length - wastedChildren.length),
      },
      bmiRecommendations: {
        overweightGroup: {
          label: 'Nhóm Thừa cân & Béo phì',
          count: overweightChildren.length,
          severity: 'WARNING',
          clinicalStrategy: 'Giảm 10–15% tinh bột & chất béo bão hòa, hạn chế món chiên xào mặn, tăng rau củ theo Thông tư 28',
          portionAdvice: 'Khuyến khích ăn nhiều canh rau trước, giảm cơm & nước ngọt',
          children: overweightChildren,
          recommendedSubstituteDishes: [],
        },
        wastedGroup: {
          label: 'Nhóm Còi xương & Suy dinh dưỡng',
          count: wastedChildren.length,
          severity: 'WARNING',
          clinicalStrategy: 'Tăng cường chất đạm sinh học cao, bổ sung dầu oliu/dầu gấc, tăng 15–20% khẩu phần theo QĐ 1246 & TT 28',
          portionAdvice: 'Chia nhỏ bữa ăn, khuyến khích uống thêm sữa và món xế bổ dưỡng',
          children: wastedChildren,
          recommendedSubstituteDishes: [],
        },
      },
    };
  }

    async create(dto: CreateMenuDto, userId?: number, nutritionalStandardId?: number) {
    const menu = this.menuRepo.create({
      title: dto.title,
      weekStartDate: dto.weekStartDate,
      weekEndDate: dto.weekEndDate,
      ageGroup: dto.ageGroup,
      nutritionalStandardId: nutritionalStandardId ?? null,
      cycleId: dto.cycleId || null,
      status: dto.status || 'DRAFT',
      createdBy: userId || 3,
    });

    const savedMenu = await this.menuRepo.save(menu);

    const version = this.versionRepo.create({
      menuId: savedMenu.id,
      versionNumber: 1,
      createdBy: userId || 3,
      changeNote: 'Khá»Ÿi táº¡o thá»±c Ä‘Æ¡n tuáº§n',
    });
    const savedVersion = await this.versionRepo.save(version);

    // Populate standard 5 days Mon-Fri (day 2 to 6)
    const startDate = new Date(dto.weekStartDate);
    for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
      const dayDate = new Date(startDate);
      dayDate.setDate(startDate.getDate() + dayOffset);
      const dayOfWeek = dayOffset + 2; // Monday = 2, Tuesday = 3, ...

      const menuDay = await this.dayRepo.save(
        this.dayRepo.create({
          menuVersionId: savedVersion.id,
          dayOfWeek,
          date: dayDate.toISOString().split('T')[0],
        }),
      );

      // Create standard meals: MORNING_SNACK, LUNCH, AFTERNOON_SNACK
      for (const mealType of ['MORNING_SNACK', 'LUNCH', 'AFTERNOON_SNACK']) {
        await this.mealRepo.save(
          this.mealRepo.create({
            menuDayId: menuDay.id,
            mealType,
          }),
        );
      }
    }

    return this.findOne(savedMenu.id);
  }

  async update(id: number, dto: UpdateMenuDto) {
    const menu = await this.menuRepo.findOne({ where: { id } });
    if (!menu) throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y thá»±c Ä‘Æ¡n');

    if (dto.title) menu.title = dto.title;
    if (dto.weekStartDate) menu.weekStartDate = dto.weekStartDate;
    if (dto.weekEndDate) menu.weekEndDate = dto.weekEndDate;
    if (dto.ageGroup) menu.ageGroup = dto.ageGroup;
    if (dto.status) menu.status = dto.status;

    await this.menuRepo.save(menu);

    this.auditLogsService?.logAction({
      tenantId: 1,
      userId: 1,
      userName: 'Ban Giám Hiệu',
      userRole: 'PRINCIPAL',
      action: 'UPDATE_MENU',
      targetEntity: 'MENU',
      targetId: String(id),
      ipAddress: '127.0.0.1',
      details: {
        menuId: id,
        title: menu.title,
        updatedFields: Object.keys(dto),
      },
    }).catch(() => {});

    return this.findOne(id);
  }

  async adjustDish(menuId: number, dto: AdjustDishDto) {
    const menu = await this.menuRepo.findOne({ where: { id: menuId } });
    if (!menu) throw new NotFoundException('Không tìm thấy thực đơn');

    let version = await this.versionRepo.findOne({
      where: { menuId },
      order: { versionNumber: 'DESC' },
    });
    if (!version) {
      version = await this.versionRepo.save(
        this.versionRepo.create({ menuId, versionNumber: 1, createdBy: menu.createdBy }),
      );
    }

    const mealType = dto.mealType || (dto as any).mealTime || 'LUNCH';
    const rawDay = Number(dto.dayOfWeek) || 2;

    // Ánh xạ thứ trong tuần: Frontend gửi 1..5 (Thứ 2..Thứ 6), DB có thể lưu 2..6
    let dbDayOfWeek = rawDay;
    if (rawDay >= 1 && rawDay <= 5) {
      const offsetDay = await this.dayRepo.findOne({
        where: { menuVersionId: version.id, dayOfWeek: rawDay + 1 },
      });
      if (offsetDay) {
        dbDayOfWeek = rawDay + 1;
      }
    }

    let day = await this.dayRepo.findOne({
      where: { menuVersionId: version.id, dayOfWeek: dbDayOfWeek },
      relations: ['meals'],
    });

    if (!day) {
      day = await this.dayRepo.findOne({
        where: { menuVersionId: version.id, dayOfWeek: rawDay },
        relations: ['meals'],
      });
    }

    if (!day) {
      const existingDays = await this.dayRepo.find({
        where: { menuVersionId: version.id },
        order: { dayOfWeek: 'ASC' },
        relations: ['meals'],
      });
      day = existingDays[0] || await this.dayRepo.save(
        this.dayRepo.create({ menuVersionId: version.id, dayOfWeek: dbDayOfWeek }),
      );
    }

    let meal = day.meals?.find((m) => m.mealType === mealType);
    if (!meal) {
      meal = await this.mealRepo.save(
        this.mealRepo.create({ menuDayId: day.id, mealType }),
      );
    }

    const resolvedOldDishId = Number(dto.oldDishId || (dto as any).dishId) || null;
    let resolvedNewDishId = Number(dto.newDishId || (dto as any).substituteDishId || (dto as any).dishId);

    if (!resolvedNewDishId || isNaN(resolvedNewDishId)) {
      resolvedNewDishId = resolvedOldDishId || 1;
    }

    const keepOriginalDish = dto.keepOriginalDish !== false; // Mặc định luôn giữ món gốc cho trẻ bình thường

    if (resolvedOldDishId && !keepOriginalDish && resolvedOldDishId !== resolvedNewDishId) {
      await this.menuDishRepo.delete({ menuMealId: meal.id, dishId: resolvedOldDishId });
    }

    // Kiểm tra xem món thay thế này đã có trong bữa ăn chưa
    let menuDish = await this.menuDishRepo.findOne({
      where: { menuMealId: meal.id, dishId: resolvedNewDishId },
    });

    if (menuDish) {
      menuDish.portionSizeG = dto.portionSizeG || menuDish.portionSizeG || 100;
      menuDish.specialDietNotes = dto.specialDietNotes || (dto as any).notes || menuDish.specialDietNotes;
      await this.menuDishRepo.save(menuDish);
    } else {
      menuDish = this.menuDishRepo.create({
        menuMealId: meal.id,
        dishId: resolvedNewDishId,
        portionSizeG: dto.portionSizeG || 100,
        specialDietNotes: dto.specialDietNotes || (dto as any).notes || null,
      });
      await this.menuDishRepo.save(menuDish);
    }

    return {
      success: true,
      menuDishId: String(menuDish.id),
      dishId: String(resolvedNewDishId),
      message: 'Đã cập nhật món ăn trong thực đơn thành công',
    };
  }

  async removeDish(menuId: number, menuDishId: number) {
    await this.menuDishRepo.delete({ id: menuDishId });
    return { success: true };
  }

  async submitForReview(id: number, submitter?: any, dto?: SubmitMenuDto) {
    const menu = await this.menuRepo.findOne({
      where: { id },
      relations: ['creator', 'submitter'],
    });
    if (!menu) throw new NotFoundException('Không tìm thấy thực đơn để gửi duyệt');

    // 1. Kiểm tra trạng thái thực đơn hợp lệ (DRAFT, REJECTED, PENDING, SUBMITTED_FOR_REVIEW)
    const allowedStatuses = ['DRAFT', 'REJECTED', 'PENDING', 'SUBMITTED_FOR_REVIEW'];
    if (!allowedStatuses.includes(menu.status)) {
      throw new BadRequestException(`Thực đơn đang ở trạng thái "${menu.status}", không thể gửi duyệt lại.`);
    }

    // 2. Kiểm tra bản cam kết trách nhiệm chuyên môn (Nutritionist Commitment)
    if (dto && dto.commitmentSigned === false) {
      throw new BadRequestException('Chuyên viên Dinh dưỡng bắt buộc phải xác nhận ký số cam kết trách nhiệm chuyên môn');
    }

    // 3. Kiểm tra giải trình vượt ngưỡng nếu có cảnh báo (Override Justification)
    const hasWarnings = Array.isArray(dto?.violationsSnapshot) && dto.violationsSnapshot.length > 0;
    if (hasWarnings) {
      const justification = dto?.overrideJustification?.trim();
      if (!justification || justification.length < 10) {
        throw new BadRequestException(
          'Thực đơn có cảnh báo vượt ngưỡng quy tắc dinh dưỡng / lặp món. Chuyên viên Dinh dưỡng bắt buộc phải nhập giải trình chuyên môn cụ thể (tối thiểu 10 ký tự).'
        );
      }
    }

    // 4. Lưu thông tin nộp duyệt vào Menu entity
    const submitterId = submitter?.id || submitter?.sub || (menu.createdBy ? Number(menu.createdBy) : 1);
    menu.status = 'PENDING';
    menu.submittedBy = submitterId;
    menu.submittedAt = new Date();
    menu.commitmentSigned = dto?.commitmentSigned !== undefined ? dto.commitmentSigned : true;
    menu.commitmentText =
      dto?.commitmentText ||
      'Cam kết thực đơn tuân thủ định mức Thông tư 28/2016/TT-BGDĐT và an toàn thực phẩm Quyết định 1246/QĐ-BYT';
    menu.commitmentItems =
      dto?.commitmentItems && dto.commitmentItems.length > 0
        ? dto.commitmentItems
        : ['COMMIT_TT28_NUTRITION', 'COMMIT_QD1246_SAFETY', 'COMMIT_ALLERGEN_SAFETY', 'COMMIT_PROFESSIONAL_RESP'];
    menu.overrideJustification = dto?.overrideJustification?.trim() || null;
    menu.violationsSnapshot = dto?.violationsSnapshot || [];

    await this.menuRepo.save(menu);

    // 5. Ghi vết kiểm toán trực tiếp vào bảng audit_logs của PostgreSQL
    try {
      await this.auditLogsService?.logAction({
        tenantId: submitter?.tenantId || 1,
        userId: submitterId,
        userName: submitter?.fullName || submitter?.name || 'Chuyên viên Dinh dưỡng',
        userEmail: submitter?.email || 'dinhduong@huongduong.edu.vn',
        userRole: 'NUTRITIONIST',
        action: 'SUBMIT_MENU_FOR_REVIEW',
        targetEntity: 'MENU',
        targetId: String(id),
        ipAddress: submitter?.ip || '127.0.0.1',
        userAgent: submitter?.userAgent || 'NutriKid Web Application',
        details: {
          menuId: id,
          title: menu.title,
          ageGroup: menu.ageGroup,
          weekStartDate: menu.weekStartDate,
          weekEndDate: menu.weekEndDate,
          commitmentSigned: menu.commitmentSigned,
          commitmentItemsCount: menu.commitmentItems?.length || 0,
          hasOverrideJustification: Boolean(menu.overrideJustification),
          overrideJustification: menu.overrideJustification,
          violationsCount: menu.violationsSnapshot?.length || 0,
          violations: menu.violationsSnapshot,
          submittedAt: menu.submittedAt,
        },
      });
    } catch (auditErr: any) {
      this.logger.warn(`[MenusService] Ghi audit log submit thất bại: ${auditErr.message}`);
    }

    return this.findOne(id);
  }

  async approveMenu(id: number, approverId: number, notes?: string) {
    const menu = await this.menuRepo.findOne({ where: { id } });
    if (!menu) throw new NotFoundException('Không tìm thấy thực đơn');

    // Chỉ thực đơn đang PENDING hoặc SUBMITTED_FOR_REVIEW mới được phê duyệt
    if (menu.status !== 'PENDING' && menu.status !== 'SUBMITTED_FOR_REVIEW') {
      throw new BadRequestException(
        `Chỉ thực đơn đang "Chờ BGH duyệt" mới có thể phê duyệt. Trạng thái hiện tại: ${menu.status}`
      );
    }

    menu.status = 'APPROVED';
    menu.approvedBy = approverId || 1;
    menu.approvedAt = new Date();
    menu.approvalNotes = notes || null;
    await this.menuRepo.save(menu);

    this.auditLogsService?.logAction({
      tenantId: 1,
      userId: approverId || 1,
      userName: 'Ban Giám Hiệu',
      userRole: 'PRINCIPAL',
      action: 'APPROVE_MENU',
      targetEntity: 'MENU',
      targetId: String(id),
      ipAddress: '127.0.0.1',
      details: {
        menuId: id,
        title: menu.title,
        note: notes || 'Phê duyệt thực đơn tuần đạt chuẩn',
        approvedAt: menu.approvedAt,
      },
    }).catch(() => {});

    return this.findOne(id);
  }

  async rejectMenu(id: number, approverId: number, reason: string) {
    const menu = await this.menuRepo.findOne({ where: { id } });
    if (!menu) throw new NotFoundException('Không tìm thấy thực đơn');

    // Chỉ thực đơn đang PENDING hoặc SUBMITTED_FOR_REVIEW mới được từ chối
    if (menu.status !== 'PENDING' && menu.status !== 'SUBMITTED_FOR_REVIEW') {
      throw new BadRequestException(
        `Chỉ thực đơn đang "Chờ BGH duyệt" mới có thể từ chối. Trạng thái hiện tại: ${menu.status}`
      );
    }

    menu.status = 'REJECTED';
    menu.rejectionReason = reason;
    menu.rejectedAt = new Date();
    await this.menuRepo.save(menu);

    this.auditLogsService?.logAction({
      tenantId: 1,
      userId: approverId || 1,
      userName: 'Ban Giám Hiệu',
      userRole: 'PRINCIPAL',
      action: 'REJECT_MENU',
      targetEntity: 'MENU',
      targetId: String(id),
      ipAddress: '127.0.0.1',
      details: { menuId: id, reason, status: 'REJECTED' },
    }).catch(() => {});
    return this.findOne(id);
  }

  async publishMenu(id: number) {
    const menu = await this.menuRepo.findOne({ where: { id } });
    if (!menu) throw new NotFoundException('Không tìm thấy thực đơn');

    // Chỉ thực đơn đã APPROVED mới được công bố toàn trường
    if (menu.status !== 'APPROVED') {
      throw new BadRequestException(
        `Chỉ thực đơn "Đã duyệt" mới có thể công bố toàn trường. Trạng thái hiện tại: ${menu.status}`
      );
    }

    menu.status = 'PUBLISHED';
    menu.publishedAt = new Date();
    await this.menuRepo.save(menu);

    this.auditLogsService?.logAction({
      tenantId: 1,
      userId: 1,
      userName: 'Ban Giám Hiệu',
      userRole: 'PRINCIPAL',
      action: 'PUBLISH_MENU',
      targetEntity: 'MENU',
      targetId: String(id),
      ipAddress: '127.0.0.1',
      details: {
        menuId: id,
        title: menu.title,
        status: 'PUBLISHED',
        publishedAt: menu.publishedAt,
      },
    }).catch(() => {});

    return this.findOne(id);
  }

  /**
   * Tìm thực đơn trường ĐÃ CÔNG BỐ (PUBLISHED / ACTIVE) áp dụng cho một ngày cụ thể.
   * - Chỉ xét thực đơn cùng nhóm tuổi (NHA_TRE / MAU_GIAO) nếu có truyền vào.
   * - Bắt buộc weekStartDate <= date <= weekEndDate.
   * - Trả về chi tiết đầy đủ (giống findOne) hoặc null nếu chưa có thực đơn công bố.
   */
  async findPublishedMenuForDate(date: string, ageGroup?: string | null) {
    const qb = this.menuRepo
      .createQueryBuilder('m')
      .where('m.status IN (:...statuses)', { statuses: ['PUBLISHED', 'ACTIVE'] })
      .andWhere('m.weekStartDate <= :date', { date })
      .andWhere('m.weekEndDate >= :date', { date });

    if (ageGroup) {
      qb.andWhere('m.ageGroup = :ageGroup', { ageGroup });
    }

    const menu = await qb.orderBy('m.id', 'DESC').getOne();
    if (!menu) return null;
    return this.findOne(menu.id);
  }

  async createVersion(id: number, userId?: number) {
    const version = await this.versionRepo.findOne({
      where: { menuId: id },
      order: { versionNumber: 'DESC' },
    });
    const nextVersion = (version?.versionNumber || 1) + 1;

    const newVersion = this.versionRepo.create({
      menuId: id,
      versionNumber: nextVersion,
      createdBy: userId || 3,
      changeNote: `PhiÃªn báº£n v${nextVersion}.0`,
    });
    await this.versionRepo.save(newVersion);
    return this.findOne(id);
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // AUTO-GENERATE: Constrained Nutrition-Aware Menu Generation
  // ThÃ´ng tÆ° 28/2016/TT-BGDÄT compliant
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  async autoGenerate(dto: AutoGenerateMenuDto, userId?: number) {
    const rawAge = dto.ageGroup || dto.targetAgeGroup || 'MAU_GIAO';
    const ageGroup = rawAge === 'TODDLER_18_36M' ? 'NHA_TRE' : (rawAge === 'KINDERGARTEN_3_5Y' ? 'MAU_GIAO' : rawAge);
    const weekStartDate = dto.weekStartDate || dto.startDate || new Date().toISOString().split('T')[0];
    const daysCount = dto.daysCount || 5;

    let weekEndDate = dto.endDate;
    if (!weekEndDate) {
      const d = new Date(weekStartDate);
      d.setDate(d.getDate() + (daysCount === 6 ? 5 : 4));
      weekEndDate = d.toISOString().split('T')[0];
    }

    const title = dto.title || `Thá»±c Ä‘Æ¡n BÃ¡n trÃº Tuáº§n ${dto.cycleWeekNumber || 1} (${ageGroup === 'MAU_GIAO' ? 'Máº«u giÃ¡o' : 'NhÃ  tráº»'})`;

    // â”€â”€ Step 1: Load nutritional standards from DB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const standard = await this.standardRepo.findOne({
      where: { ageGroup, mealScope: 'DAYBOARDING', status: 'ACTIVE' },
    });

    // Fallback defaults matching ThÃ´ng tÆ° 28 if DB lookup fails
    const minKcal = standard?.minEnergyKcal || (ageGroup === 'NHA_TRE' ? 600 : 615);
    const maxKcal = standard?.maxEnergyKcal || (ageGroup === 'NHA_TRE' ? 735 : 726);
    const minProtPct = standard?.minProteinPct || 13;
    const maxProtPct = standard?.maxProteinPct || 20;
    const minFatPct = standard?.minFatPct || (ageGroup === 'NHA_TRE' ? 30 : 25);
    const maxFatPct = standard?.maxFatPct || (ageGroup === 'NHA_TRE' ? 40 : 35);
    const minCarbPct = standard?.minCarbPct || (ageGroup === 'NHA_TRE' ? 47 : 52);
    const maxCarbPct = standard?.maxCarbPct || (ageGroup === 'NHA_TRE' ? 57 : 60);

    this.logger.log(`ðŸ“‹ Chuáº©n dinh dÆ°á»¡ng ${ageGroup} DAYBOARDING: ${minKcal}â€“${maxKcal} Kcal, P:${minProtPct}â€“${maxProtPct}%, L:${minFatPct}â€“${maxFatPct}%, G:${minCarbPct}â€“${maxCarbPct}%`);

    // â”€â”€ Step 2: Load all dishes with nutrition data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const allDishes = await this.dishRepo.find({
      relations: ['category', 'nutrition'],
      where: { status: 'ACTIVE' },
      order: { name: 'ASC' },
    });

    // Categorize dishes
    const dishPool: Record<string, DishWithNutrition[]> = {
      MAIN: [],
      SOUP: [],
      RICE: [],
      DESSERT: [],
      SNACK_MORNING: [],
      SNACK_AFTERNOON: [],
      DRINK: [],
    };

    for (const d of allDishes) {
      if (!hasVerifiedNutrition(d) || Number(d.nutrition.energyKcal) <= 0) continue;
      const code = d.category?.code || 'MAIN';
      const entry: DishWithNutrition = {
        id: d.id,
        name: d.name,
        categoryCode: code,
        categoryName: d.category?.name || 'MÃ³n Äƒn',
        energyKcal: Number(d.nutrition?.energyKcal) || 0,
        proteinG: Number(d.nutrition?.proteinG) || 0,
        fatG: Number(d.nutrition?.fatG) || 0,
        carbG: Number(d.nutrition?.carbG) || 0,
        portionSizeG: Number(d.standardServingSizeG) || 100,
      };
      if (dishPool[code]) {
        dishPool[code].push(entry);
      }
    }

    if (Object.values(dishPool).every((pool) => pool.length === 0)) {
      throw new BadRequestException('Chưa có món ăn có công thức định lượng được xác nhận để tự động lập thực đơn.');
    }

    // ── Step 3: Quét chu kỳ 4 tuần qua menu_cycles & lịch sử thực đơn ────────
    const activeCycle = await this.cycleRepo.findOne({
      where: { ageGroup, status: 'ACTIVE' },
      order: { id: 'DESC' },
    });

    const fourWeeksAgo = new Date(weekStartDate);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const fourWeeksAgoStr = fourWeeksAgo.toISOString().split('T')[0];

    const twoWeeksAgo = new Date(weekStartDate);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const twoWeeksAgoStr = twoWeeksAgo.toISOString().split('T')[0];

    // Quét tần suất xuất hiện của các món trong 4 tuần qua
    const past4WeeksDishesRaw = await this.menuDishRepo
      .createQueryBuilder('md')
      .innerJoin('md.menuMeal', 'mm')
      .innerJoin('mm.menuDay', 'mday')
      .innerJoin('mday.menuVersion', 'mv')
      .innerJoin('mv.menu', 'm')
      .innerJoin('md.dish', 'd')
      .innerJoin('d.category', 'c')
      .select('md.dishId', 'dishId')
      .addSelect('d.name', 'dishName')
      .addSelect('c.code', 'categoryCode')
      .addSelect('COUNT(md.id)', 'occurrenceCount')
      .where('m.ageGroup = :ageGroup', { ageGroup })
      .andWhere('m.weekStartDate >= :fourWeeksAgoStr', { fourWeeksAgoStr })
      .andWhere('m.weekStartDate < :weekStartDate', { weekStartDate })
      .groupBy('md.dishId')
      .addGroupBy('d.name')
      .addGroupBy('c.code')
      .getRawMany();

    const dynamicLimits = new Map<string, number>();
    if (this.freqRuleRepo) {
      try {
        const customRules = await this.freqRuleRepo.find({
          where: [
            { targetType: 'DISH_CATEGORY', ageGroup, isActive: true, periodType: 'PER_CYCLE_4_WEEKS' },
            { targetType: 'DISH_CATEGORY', ageGroup: 'ALL', isActive: true, periodType: 'PER_CYCLE_4_WEEKS' },
          ],
        });
        for (const cr of customRules) {
          if (cr.targetCode && cr.maxOccurrences > 0) {
            dynamicLimits.set(cr.targetCode, cr.maxOccurrences);
          }
        }
      } catch (err: any) {
        this.logger.warn('Could not load dynamic frequency rules: ' + err.message);
      }
    }

    const cycleDishCounts = new Map<number, { count: number; name: string; categoryCode: string }>();
    const cycleExclusionDishIds = new Set<number>();

    for (const row of past4WeeksDishesRaw) {
      const dishId = Number(row.dishId);
      const count = Number(row.occurrenceCount) || 0;
      const code = row.categoryCode || 'MAIN';
      cycleDishCounts.set(dishId, { count, name: row.dishName, categoryCode: code });

      const maxLimit = this.getMaxCycleLimit(code, dynamicLimits);
      if (count >= maxLimit) {
        cycleExclusionDishIds.add(dishId);
      }
    }

    // Quét các món 14 ngày gần nhất để chống ngán
    const recentDishIds = new Set<number>();
    const past14DaysRaw = await this.menuDishRepo
      .createQueryBuilder('md')
      .innerJoin('md.menuMeal', 'mm')
      .innerJoin('mm.menuDay', 'mday')
      .innerJoin('mday.menuVersion', 'mv')
      .innerJoin('mv.menu', 'm')
      .select('DISTINCT md.dishId', 'dishId')
      .where('m.ageGroup = :ageGroup', { ageGroup })
      .andWhere('m.weekStartDate >= :twoWeeksAgoStr', { twoWeeksAgoStr })
      .andWhere('m.weekStartDate < :weekStartDate', { weekStartDate })
      .getRawMany();

    for (const r of past14DaysRaw) {
      recentDishIds.add(Number(r.dishId));
    }

    // ── Step 4: Sinh thực đơn từng ngày đảm bảo Kcal & P:L:G ──────────────────
    const dayNames = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const usedDishIdsThisWeek = new Set<number>();
    let previousDayDishIds = new Set<number>();
    const dailySummary: DayMealPlan[] = [];

    const shuffleArray = <T>(arr: T[]): T[] => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };

    for (let dayIndex = 0; dayIndex < daysCount; dayIndex++) {
      const dayOfWeek = dayIndex + 1; // 1 = T2 ... 5 = T6
      const dayName = dayNames[dayIndex] || `Ngày ${dayIndex + 1}`;

      let bestPlan: DayMealPlan | null = null;
      let bestScore = -Infinity;

      for (let attempt = 0; attempt < 50; attempt++) {
        const dayDishes: DayDishSlot[] = [];

        // 1. Phụ sáng (MORNING_SNACK): 1 món (Sữa dinh dưỡng / Thức uống) ~100-110 Kcal
        const morningPool = shuffleArray([...dishPool.SNACK_MORNING, ...dishPool.DRINK, ...dishPool.SNACK_AFTERNOON]);
        const morningDish = this.pickDish(morningPool, usedDishIdsThisWeek, previousDayDishIds, recentDishIds, cycleExclusionDishIds, attempt > 25);
        if (morningDish) {
          dayDishes.push({
            dishId: String(morningDish.id),
            dishName: morningDish.name,
            dishType: morningDish.categoryCode,
            mealTime: 'MORNING_SNACK',
            servingOrder: 1,
            portionSizeG: morningDish.portionSizeG,
            plannedCalories: morningDish.energyKcal,
            proteinG: morningDish.proteinG,
            fatG: morningDish.fatG,
            carbG: morningDish.carbG,
          });
        }

        // 2. Bữa trưa chính (LUNCH): Cơm + Món chính + Canh + Tráng miệng
        // Cơm (RICE) ~172-269 Kcal (cho phép lặp lại vì số lượng món tinh bột hạn chế)
        const riceDish = this.pickDish(shuffleArray(dishPool.RICE), usedDishIdsThisWeek, previousDayDishIds, recentDishIds, cycleExclusionDishIds, attempt > 20);
        if (riceDish) {
          dayDishes.push({
            dishId: String(riceDish.id),
            dishName: riceDish.name,
            dishType: 'RICE',
            mealTime: 'LUNCH',
            servingOrder: 2,
            portionSizeG: riceDish.portionSizeG,
            plannedCalories: riceDish.energyKcal,
            proteinG: riceDish.proteinG,
            fatG: riceDish.fatG,
            carbG: riceDish.carbG,
          });
        }

        // Món chính (MAIN) ~60-144 Kcal (tuyệt đối không lặp lại trong tuần & không vượt chu kỳ 4 tuần)
        const mainDish = this.pickDish(shuffleArray(dishPool.MAIN), usedDishIdsThisWeek, previousDayDishIds, recentDishIds, cycleExclusionDishIds, attempt > 35);
        if (mainDish) {
          dayDishes.push({
            dishId: String(mainDish.id),
            dishName: mainDish.name,
            dishType: 'MAIN',
            mealTime: 'LUNCH',
            servingOrder: 3,
            portionSizeG: mainDish.portionSizeG,
            plannedCalories: mainDish.energyKcal,
            proteinG: mainDish.proteinG,
            fatG: mainDish.fatG,
            carbG: mainDish.carbG,
          });
        }

        // Canh súp (SOUP) ~25-105 Kcal
        const soupDish = this.pickDish(shuffleArray(dishPool.SOUP), usedDishIdsThisWeek, previousDayDishIds, recentDishIds, cycleExclusionDishIds, attempt > 30);
        if (soupDish) {
          dayDishes.push({
            dishId: String(soupDish.id),
            dishName: soupDish.name,
            dishType: 'SOUP',
            mealTime: 'LUNCH',
            servingOrder: 4,
            portionSizeG: soupDish.portionSizeG,
            plannedCalories: soupDish.energyKcal,
            proteinG: soupDish.proteinG,
            fatG: soupDish.fatG,
            carbG: soupDish.carbG,
          });
        }

        // Tráng miệng (DESSERT) ~20-150 Kcal
        const dessertDish = this.pickDish(shuffleArray(dishPool.DESSERT), usedDishIdsThisWeek, previousDayDishIds, recentDishIds, cycleExclusionDishIds, attempt > 30);
        if (dessertDish) {
          dayDishes.push({
            dishId: String(dessertDish.id),
            dishName: dessertDish.name,
            dishType: 'DESSERT',
            mealTime: 'LUNCH',
            servingOrder: 5,
            portionSizeG: dessertDish.portionSizeG,
            plannedCalories: dessertDish.energyKcal,
            proteinG: dessertDish.proteinG,
            fatG: dessertDish.fatG,
            carbG: dessertDish.carbG,
          });
        }

        // 3. Phụ chiều / Xế (AFTERNOON_SNACK): 1 món ăn xế + 1 thức uống
        // Món xế (SNACK_AFTERNOON) ~100-168 Kcal
        const afternoonSnackPool = shuffleArray(dishPool.SNACK_AFTERNOON);
        const afternoonDish = this.pickDish(afternoonSnackPool, usedDishIdsThisWeek, previousDayDishIds, recentDishIds, cycleExclusionDishIds, attempt > 30);
        if (afternoonDish && (!morningDish || afternoonDish.id !== morningDish.id)) {
          dayDishes.push({
            dishId: String(afternoonDish.id),
            dishName: afternoonDish.name,
            dishType: 'SNACK_AFTERNOON',
            mealTime: 'AFTERNOON_SNACK',
            servingOrder: 6,
            portionSizeG: afternoonDish.portionSizeG,
            plannedCalories: afternoonDish.energyKcal,
            proteinG: afternoonDish.proteinG,
            fatG: afternoonDish.fatG,
            carbG: afternoonDish.carbG,
          });
        }

        // Thức uống xế (DRINK) ~45-102 Kcal (cho phép lặp lại)
        const drinkDish = this.pickDish(shuffleArray(dishPool.DRINK), usedDishIdsThisWeek, previousDayDishIds, recentDishIds, cycleExclusionDishIds, attempt > 20);
        if (drinkDish && (!morningDish || drinkDish.id !== morningDish.id)) {
          dayDishes.push({
            dishId: String(drinkDish.id),
            dishName: drinkDish.name,
            dishType: 'DRINK',
            mealTime: 'AFTERNOON_SNACK',
            servingOrder: 7,
            portionSizeG: drinkDish.portionSizeG,
            plannedCalories: drinkDish.energyKcal,
            proteinG: drinkDish.proteinG,
            fatG: drinkDish.fatG,
            carbG: drinkDish.carbG,
          });
        }

        // Tính tổng năng lượng & tỷ lệ P:L:G
        const totalCal = dayDishes.reduce((s, d) => s + d.plannedCalories, 0);
        const totalProt = dayDishes.reduce((s, d) => s + d.proteinG, 0);
        const totalFat = dayDishes.reduce((s, d) => s + d.fatG, 0);
        const totalCarb = dayDishes.reduce((s, d) => s + d.carbG, 0);

        const protKcal = totalProt * 4;
        const fatKcal = totalFat * 9;
        const carbKcal = totalCarb * 4;
        const macroSum = protKcal + fatKcal + carbKcal || 1;

        const pPct = (protKcal / macroSum) * 100;
        const fPct = (fatKcal / macroSum) * 100;
        const cPct = (carbKcal / macroSum) * 100;

        // Chấm điểm mức độ chuẩn hóa
        let score = 0;

        // Tiêu chí 1: Năng lượng Kcal nằm trong dải chuẩn (Nhà trẻ: 600–750; Mẫu giáo: 615–770)
        if (totalCal >= minKcal && totalCal <= maxKcal) {
          score += 150;
        } else {
          const kcalMid = (minKcal + maxKcal) / 2;
          const kcalDist = Math.abs(totalCal - kcalMid) / kcalMid;
          score -= kcalDist * 300;
        }

        // Tiêu chí 2: Cân đối P:L:G (13–20% P, 25–35% L, 52–60% G)
        if (pPct >= minProtPct && pPct <= maxProtPct) score += 50;
        else score -= Math.abs(pPct - (minProtPct + maxProtPct) / 2) * 5;

        if (fPct >= minFatPct && fPct <= maxFatPct) score += 50;
        else score -= Math.abs(fPct - (minFatPct + maxFatPct) / 2) * 5;

        if (cPct >= minCarbPct && cPct <= maxCarbPct) score += 50;
        else score -= Math.abs(cPct - (minCarbPct + maxCarbPct) / 2) * 5;

        // Tiêu chí 3: Chống ngán & đa dạng món
        if (mainDish && !usedDishIdsThisWeek.has(mainDish.id)) score += 40;
        if (mainDish && !recentDishIds.has(mainDish.id)) score += 30;

        if (score > bestScore) {
          bestScore = score;
          bestPlan = {
            dayOfWeek,
            dayName,
            dishes: dayDishes,
            totalCalories: Math.round(totalCal * 10) / 10,
            totalProteinG: Math.round(totalProt * 10) / 10,
            totalFatG: Math.round(totalFat * 10) / 10,
            totalCarbG: Math.round(totalCarb * 10) / 10,
            proteinPct: Math.round(pPct * 10) / 10,
            lipidPct: Math.round(fPct * 10) / 10,
            glucidPct: Math.round(cPct * 10) / 10,
            isCompliant: totalCal >= minKcal && totalCal <= maxKcal
              && pPct >= minProtPct && pPct <= maxProtPct
              && fPct >= minFatPct && fPct <= maxFatPct
              && cPct >= minCarbPct && cPct <= maxCarbPct,
            violations: [],
            standardNote: '',
          };
        }

        if (bestPlan?.isCompliant) break;
      }

      if (bestPlan) {
        // Kiểm tra dải Kcal
        if (bestPlan.totalCalories < minKcal) {
          bestPlan.violations.push(`CALORIE_DEFICIT: ${dayName} tổng năng lượng ${bestPlan.totalCalories} Kcal < ${minKcal} Kcal (chuẩn tối thiểu Thông tư 28)`);
        }
        if (bestPlan.totalCalories > maxKcal) {
          bestPlan.violations.push(`CALORIE_EXCESS: ${dayName} tổng năng lượng ${bestPlan.totalCalories} Kcal > ${maxKcal} Kcal (chuẩn tối đa Thông tư 28)`);
        }

        // Kiểm tra tỷ lệ cân đối P:L:G (13–20% P, 25–35% L, 52–60% G)
        if (bestPlan.proteinPct < minProtPct || bestPlan.proteinPct > maxProtPct) {
          bestPlan.violations.push(`PROTEIN_OUT_OF_RANGE: ${dayName} Protein ${bestPlan.proteinPct}% ngoài dải chuẩn ${minProtPct}–${maxProtPct}%`);
        }
        if (bestPlan.lipidPct < minFatPct || bestPlan.lipidPct > maxFatPct) {
          bestPlan.violations.push(`FAT_OUT_OF_RANGE: ${dayName} Lipid ${bestPlan.lipidPct}% ngoài dải chuẩn ${minFatPct}–${maxFatPct}%`);
        }
        if (bestPlan.glucidPct < minCarbPct || bestPlan.glucidPct > maxCarbPct) {
          bestPlan.violations.push(`CARB_OUT_OF_RANGE: ${dayName} Glucid ${bestPlan.glucidPct}% ngoài dải chuẩn ${minCarbPct}–${maxCarbPct}%`);
        }

        bestPlan.isCompliant = bestPlan.violations.length === 0;
        bestPlan.standardNote = bestPlan.isCompliant
          ? `✅ ĐẠT CHUẨN Thông tư 28 (${bestPlan.totalCalories} Kcal, P:${bestPlan.proteinPct}% L:${bestPlan.lipidPct}% G:${bestPlan.glucidPct}%)`
          : `⚠️ CHƯA ĐẠT: ${bestPlan.violations.join('; ')}`;

        // Đánh dấu TẤT CẢ các món đã dùng trong tuần và thiết lập previousDayDishIds để chống trùng lặp tuyệt đối
        for (const d of bestPlan.dishes) {
          usedDishIdsThisWeek.add(Number(d.dishId));
        }
        previousDayDishIds = new Set(bestPlan.dishes.map((d) => Number(d.dishId)));

        dailySummary.push(bestPlan);
      }
    }

    // ── Step 5: Quét chu kỳ 4 tuần qua menu_cycles & ghi nhận vi phạm lặp món ──
    const currentWeekDishCounts = new Map<number, number>();
    const cycleViolations: string[] = [];
    const cycleLoggedDishes = new Set<number>();

    for (const day of dailySummary) {
      for (const d of day.dishes) {
        const dishId = Number(d.dishId);
        const prevCount = cycleDishCounts.get(dishId)?.count || 0;
        const weekCount = (currentWeekDishCounts.get(dishId) || 0) + 1;
        currentWeekDishCounts.set(dishId, weekCount);

        const totalCycleCount = prevCount + weekCount;
        const maxLimit = this.getMaxCycleLimit(d.dishType, dynamicLimits);

        if (totalCycleCount > maxLimit && !cycleLoggedDishes.has(dishId)) {
          cycleLoggedDishes.add(dishId);
          cycleViolations.push(
            `CYCLE_REPEAT_EXCEEDED: Món "${d.dishName}" (${d.dishType}) lặp lại ${totalCycleCount} lần trong chu kỳ 4 tuần (vượt quá giới hạn tối đa ${maxLimit} lần)`,
          );
        }
      }
    }

    // ── Step 6: Tổng hợp số liệu tuần ─────────────────────────────────────────
    const numDays = dailySummary.length || 1;
    const avgCal = Math.round(dailySummary.reduce((s, d) => s + d.totalCalories, 0) / numDays);
    const avgProt = Math.round((dailySummary.reduce((s, d) => s + d.totalProteinG, 0) / numDays) * 10) / 10;
    const avgFat = Math.round((dailySummary.reduce((s, d) => s + d.totalFatG, 0) / numDays) * 10) / 10;
    const avgCarb = Math.round((dailySummary.reduce((s, d) => s + d.totalCarbG, 0) / numDays) * 10) / 10;

    const dayViolations = dailySummary.flatMap((d) => d.violations);
    const allViolations = [...dayViolations, ...cycleViolations];
    const compliantDays = dailySummary.filter((d) => d.isCompliant).length;
    const totalDishesUsed = dailySummary.reduce((s, d) => s + d.dishes.length, 0);
    const uniqueDishIds = new Set(dailySummary.flatMap((d) => d.dishes.map((x) => x.dishId)));
    const duplicateWithinMenu = totalDishesUsed - uniqueDishIds.size;
    const overlappedWith14 = [...uniqueDishIds].filter((id) => recentDishIds.has(Number(id))).length;

    const antiFatigueReport = {
      totalDishesUsed,
      uniqueDishesUsed: uniqueDishIds.size,
      duplicateWithinMenuCount: duplicateWithinMenu,
      overlappedWithPrevious14DaysCount: overlappedWith14,
      cycleCompliance: cycleViolations.length === 0
        ? `TUÂN THỦ 100% CHU KỲ 4 TUẦN (${activeCycle ? activeCycle.name : 'Chu kỳ chuẩn 4 tuần'}) — Không món nào vượt tần suất`
        : `CẢNH BÁO: Có ${cycleViolations.length} món vượt tần suất trong chu kỳ 4 tuần`,
      standardEvaluation: `${compliantDays}/${numDays} ngày ĐẠT CHUẨN Thông tư 28 (TB: ${avgCal} Kcal/ngày, chuẩn ${minKcal}–${maxKcal} Kcal)`,
      violationCount: allViolations.length,
      violations: allViolations,
      cycleViolations,
    };

    this.logger.log(`📊 Kết quả sinh thực đơn: ${antiFatigueReport.standardEvaluation}, ${antiFatigueReport.cycleCompliance}`);

    // ── PREVIEW MODE: trả về ngay mà không lưu DB ──────────────────────────────
    if (dto.previewOnly) {
      return {
        previewOnly: true,
        title,
        targetAgeGroup: rawAge,
        ageGroup,
        startDate: weekStartDate,
        endDate: weekEndDate,
        daysCount,
        dailySummary,
        averageCalories: avgCal,
        averageProteinG: avgProt,
        averageFatG: avgFat,
        averageCarbG: avgCarb,
        standardUsed: {
          name: 'Thông tư 28/2016/TT-BGDĐT',
          mealScope: 'DAYBOARDING',
          ageGroup,
          minKcal,
          maxKcal,
          proteinRange: `${minProtPct}–${maxProtPct}%`,
          fatRange: `${minFatPct}–${maxFatPct}%`,
          carbRange: `${minCarbPct}–${maxCarbPct}%`,
        },
        antiFatigueReport,
      };
    }

    // ── SAVE MODE: Lưu chính xác kế hoạch đã xem trước vào database ────────────
    const planToSave: DayMealPlan[] = (dto.dailyPlan && Array.isArray(dto.dailyPlan) && dto.dailyPlan.length > 0)
      ? dto.dailyPlan
      : dailySummary;

    const created = await this.create(
      {
        title,
        weekStartDate,
        weekEndDate,
        ageGroup,
        cycleId: activeCycle?.id ? Number(activeCycle.id) : (dto.cycleWeekNumber ? Number(dto.cycleWeekNumber) : undefined),
      },
      userId,
      standard?.id ? Number(standard.id) : undefined,
    );

    const version = await this.versionRepo.findOne({
      where: { menuId: Number(created.id) },
      order: { versionNumber: 'DESC' },
    });

    if (version) {
      const days = await this.dayRepo.find({
        where: { menuVersionId: version.id },
        relations: ['meals'],
        order: { dayOfWeek: 'ASC' },
      });

      for (let i = 0; i < days.length; i++) {
        const day = days[i];
        // Khớp dayPlan qua dayOfWeek (hỗ trợ cả hệ 1..5 và 2..6)
        const dayPlan = planToSave.find((p: any) =>
          p.dayOfWeek === day.dayOfWeek ||
          p.dayOfWeek === (day.dayOfWeek - 1)
        ) || planToSave[i];

        if (!dayPlan || !dayPlan.dishes) continue;

        for (const meal of day.meals || []) {
          const matchingDishes = dayPlan.dishes.filter((d: any) => d.mealTime === meal.mealType);
          for (const md of matchingDishes) {
            await this.menuDishRepo.save(
              this.menuDishRepo.create({
                menuMealId: meal.id,
                dishId: Number(md.dishId),
                portionSizeG: md.portionSizeG || 100,
                displayOrder: md.servingOrder || 1,
              }),
            );
          }
        }
      }

      // ── Lưu các vi phạm quy chuẩn vào bảng menu_rule_violations ───────────────
      if (allViolations.length > 0) {
        for (const v of allViolations) {
          const ruleCode = v.split(':')[0]?.trim() || 'NUTRITION_VIOLATION';
          const severity = ruleCode.includes('CALORIE') || ruleCode.includes('CYCLE') ? 'ERROR' : 'WARNING';
          await this.violationRepo.save(
            this.violationRepo.create({
              menuVersionId: version.id,
              ruleCode,
              severity,
              message: v,
            }),
          );
        }
        this.logger.warn(`⚠️ Đã ghi ${allViolations.length} vi phạm vào menu_rule_violations cho menu #${created.id}`);
      }
    }

    return this.findOne(Number(created.id));
  }

  // ── Helper: Giới hạn tối đa số lần xuất hiện trong chu kỳ 4 tuần ───────────
  private getMaxCycleLimit(categoryCode: string, dynamicLimits?: Map<string, number>): number {
    if (dynamicLimits && dynamicLimits.has(categoryCode)) {
      return dynamicLimits.get(categoryCode)!;
    }
    switch (categoryCode) {
      case 'MAIN':
        return 2; // Món mặn tối đa 2 lần trong chu kỳ 4 tuần
      case 'SOUP':
        return 3; // Món canh tối đa 3 lần trong chu kỳ 4 tuần
      case 'DESSERT':
        return 4; // Tráng miệng tối đa 4 lần trong chu kỳ 4 tuần
      case 'SNACK_AFTERNOON':
        return 3; // Món xế chiều tối đa 3 lần trong chu kỳ 4 tuần
      default:
        return 12; // Món nền tảng (Cơm, Nước uống, Sữa sáng)
    }
  }

  // ── Helper: Chọn món tránh trùng lặp tuần & chu kỳ 4 tuần ──────────────────
  private pickDish(
    pool: DishWithNutrition[],
    usedThisWeek: Set<number>,
    previousDayDishIds: Set<number>,
    recentDishIds: Set<number>,
    cycleExclusionDishIds: Set<number>,
    relaxConstraints: boolean,
  ): DishWithNutrition | null {
    if (pool.length === 0) return null;

    // Lượt 1: Tối ưu chuẩn nhất: Chưa dùng tuần này, không dùng ngày hôm qua, không trùng 14 ngày, không vượt chu kỳ 4 tuần
    for (const dish of pool) {
      if (
        !usedThisWeek.has(dish.id) &&
        !previousDayDishIds.has(dish.id) &&
        !recentDishIds.has(dish.id) &&
        !cycleExclusionDishIds.has(dish.id)
      ) {
        return dish;
      }
    }

    // Lượt 2: Chưa dùng tuần này, không dùng ngày hôm qua, không vượt chu kỳ 4 tuần
    for (const dish of pool) {
      if (
        !usedThisWeek.has(dish.id) &&
        !previousDayDishIds.has(dish.id) &&
        !cycleExclusionDishIds.has(dish.id)
      ) {
        return dish;
      }
    }

    // Lượt 3: Chưa dùng tuần này và không dùng ngày hôm qua
    for (const dish of pool) {
      if (!usedThisWeek.has(dish.id) && !previousDayDishIds.has(dish.id)) {
        return dish;
      }
    }

    // Lượt 4: Nếu danh mục có số lượng món ít hơn số ngày trong tuần (ví dụ Cơm chỉ có 4 món mà tuần có 5 ngày):
    // Cho phép lặp lại món đã dùng trong tuần, nhưng TUYỆT ĐỐI KHÔNG DÙNG LẠI MÓN CỦA NGÀY HÔM QUA (tránh trùng 2 ngày liên tiếp)
    for (const dish of pool) {
      if (!previousDayDishIds.has(dish.id)) {
        return dish;
      }
    }

    // Fallback: nếu danh mục chỉ có 1 món duy nhất trong toàn hệ thống
    return pool[0];
  }
}
