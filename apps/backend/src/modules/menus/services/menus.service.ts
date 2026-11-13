import {
  Injectable,
  Optional,
  NotFoundException,
  BadRequestException,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { readState } from "../../../common/utils/persisted-state";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { Menu } from "../entities/menu.entity";
import { MenuVersion } from "../entities/menu-version.entity";
import { MenuDay } from "../entities/menu-day.entity";
import { MenuMeal } from "../entities/menu-meal.entity";
import { MenuDish } from "../entities/menu-dish.entity";
import { MenuCycle } from "../entities/menu-cycle.entity";
import { Dish } from "../../dishes/entities/dish.entity";
import {
  getPortionNutrition,
  hasVerifiedNutrition,
  hasPlanningNutrition,
} from "../../dishes/nutrition.util";
import { NutritionalStandard } from "../entities/nutritional-standard.entity";
import { MenuRuleViolation } from "../entities/menu-rule-violation.entity";
import { QueryMenuDto } from "../dto/query-menu.dto";
import { CreateMenuDto } from "../dto/create-menu.dto";
import { UpdateMenuDto } from "../dto/update-menu.dto";
import { AdjustDishDto } from "../dto/adjust-dish.dto";
import { SubmitMenuDto } from "../dto/submit-menu.dto";
import { AuditLogsService } from "../../audit-logs/services/audit-logs.service";
import { DishFrequencyRule } from "../../nutrition-engine/entities/dish-frequency-rule.entity";
import { DishSpacingRule } from "../../nutrition-engine/entities/dish-spacing-rule.entity";
import { NutritionIntakeStandard } from "../../nutrition-engine/entities/nutrition-intake-standard.entity";
import { isFriedRice, isFriday, validateLunchRice } from "./lunch-rice-policy";
import {
  advisorySeverity,
  getAllergyMatchReasons,
  matchesDeclaredAllergy,
} from "./allergy-matching";

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
  rotationKey?: string;
  nutritionReference?: boolean;
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
      this.logger.log(
        "Tá»± Ä‘á»™ng Ä‘á»“ng bá»™ cÃ¡c cá»™t ná»™p duyá»‡t vÃ o báº£ng menus thÃ nh cÃ´ng.",
      );
    } catch (err: any) {
      this.logger.warn(`Kiá»ƒm tra cáº¥u trÃºc báº£ng menus: ${err.message}`);
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
    @Optional()
    @InjectRepository(DishFrequencyRule)
    private readonly freqRuleRepo?: Repository<DishFrequencyRule>,
    @Optional()
    @InjectRepository(DishSpacingRule)
    private readonly spacingRuleRepo?: Repository<DishSpacingRule>,
    @Optional()
    @InjectRepository(NutritionIntakeStandard)
    private readonly intakeStandardRepo?: Repository<NutritionIntakeStandard>,
  ) {}

  async findAll(query: QueryMenuDto) {
    const qb = this.menuRepo
      .createQueryBuilder("m")
      .leftJoinAndSelect("m.creator", "creator")
      .leftJoinAndSelect("m.approver", "approver")
      .leftJoinAndSelect("m.submitter", "submitter");

    if (query.search) {
      qb.andWhere("LOWER(m.title) LIKE :s", {
        s: `%${query.search.toLowerCase()}%`,
      });
    }

    if (query.status === "ALL_SUBMITTED") {
      qb.andWhere("m.status IN (:...submittedStatuses)", {
        submittedStatuses: [
          "PENDING",
          "SUBMITTED_FOR_REVIEW",
          "APPROVED",
          "ACTIVE",
          "PUBLISHED",
          "REJECTED",
        ],
      });
    } else if (query.status && query.status !== "ALL") {
      if (
        query.status === "SUBMITTED_FOR_REVIEW" ||
        query.status === "PENDING"
      ) {
        qb.andWhere("m.status IN (:...pendingStatuses)", {
          pendingStatuses: ["PENDING", "SUBMITTED_FOR_REVIEW"],
        });
      } else if (query.status === "ACTIVE" || query.status === "PUBLISHED") {
        qb.andWhere("m.status IN (:...activeStatuses)", {
          activeStatuses: ["ACTIVE", "PUBLISHED"],
        });
      } else {
        qb.andWhere("m.status = :status", { status: query.status });
      }
    }

    const ageGroup = query.ageGroup || query.targetAgeGroup;
    if (ageGroup && ageGroup !== "ALL") {
      const normalizedAge =
        ageGroup === "TODDLER_18_36M"
          ? "NHA_TRE"
          : ageGroup === "KINDERGARTEN_3_5Y"
            ? "MAU_GIAO"
            : ageGroup;
      qb.andWhere("m.ageGroup = :ageGroup", { ageGroup: normalizedAge });
    }

    if (query.weekStartDate) {
      qb.andWhere("m.weekStartDate = :wsd", { wsd: query.weekStartDate });
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    qb.skip((page - 1) * limit).take(limit);
    qb.orderBy("m.weekStartDate", "DESC");

    const [items, total] = await qb.getManyAndCount();

    // TÃ­nh toÃ¡n dinh dÆ°á»¡ng thá»±c táº¿ 100% tá»« cÆ¡ sá»Ÿ dá»¯ liá»‡u dish_nutrition
    const menuIds = items.map((m) => m.id);
    const nutritionMap: Record<
      number,
      {
        cal: number;
        prot: number;
        fat: number;
        carb: number;
        available: boolean;
        reference: boolean;
      }
    > = {};

    if (menuIds.length > 0) {
      try {
        const nutRows = await this.menuRepo.query(
          `SELECT 
             mv.menu_id,
             ROUND(COALESCE(SUM(dn.energy_kcal * COALESCE(mdi.portion_size_g / NULLIF(d.standard_serving_size_g, 0), 1)) / NULLIF(COUNT(DISTINCT md.id), 0), 0), 1) as avg_cal,
             ROUND(COALESCE(SUM(dn.protein_g * COALESCE(mdi.portion_size_g / NULLIF(d.standard_serving_size_g, 0), 1)) / NULLIF(COUNT(DISTINCT md.id), 0), 0), 1) as avg_prot,
             ROUND(COALESCE(SUM(dn.fat_g * COALESCE(mdi.portion_size_g / NULLIF(d.standard_serving_size_g, 0), 1)) / NULLIF(COUNT(DISTINCT md.id), 0), 0), 1) as avg_fat,
             ROUND(COALESCE(SUM(dn.carb_g * COALESCE(mdi.portion_size_g / NULLIF(d.standard_serving_size_g, 0), 1)) / NULLIF(COUNT(DISTINCT md.id), 0), 0), 1) as avg_carb,
             COUNT(mdi.id) > 0 AND COUNT(dn.dish_id) = COUNT(mdi.id) AS available,
             COALESCE(BOOL_OR(dn.dish_id IS NOT NULL AND d.nutrition_verified = FALSE), FALSE) AS reference
           FROM menu_versions mv
           JOIN menu_days md ON md.menu_version_id = mv.id
           LEFT JOIN menu_meals mm ON mm.menu_day_id = md.id
           LEFT JOIN menu_dishes mdi ON mdi.menu_meal_id = mm.id
           LEFT JOIN dishes d ON d.id = mdi.dish_id
           LEFT JOIN dish_nutrition dn ON dn.dish_id = mdi.dish_id AND (
             d.nutrition_verified = TRUE OR (
               d.source_metadata->>'recipeStatus' = 'APPROVED_REFERENCE'
               AND d.source_metadata->'menuPlanningEnabled' = 'true'::jsonb
               AND dn.source_metadata->>'status' = 'APPROVED_REFERENCE'
             ))
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
            reference: row.reference === true,
          };
        }
      } catch (err: any) {
        this.logger.warn(`Lá»—i tÃ­nh toÃ¡n dinh dÆ°á»¡ng thá»±c táº¿: ${err.message}`);
      }
    }

    const mapped = items.map((m) => {
      const nut = nutritionMap[m.id] || {
        cal: 0,
        prot: 0,
        fat: 0,
        carb: 0,
        available: false,
        reference: false,
      };
      return {
        id: String(m.id),
        tenantId: "1",
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
        createdByName: m.creator?.fullName || "ChuyÃªn viÃªn Dinh dÆ°á»¡ng",
        approvedByName: m.approver?.fullName || null,
        approvedAt: m.approvedAt ? m.approvedAt.toISOString() : null,
        submittedBy: m.submittedBy ? String(m.submittedBy) : null,
        submittedByName:
          m.submitter?.fullName ||
          (m.submittedBy ? "ChuyÃªn viÃªn Dinh dÆ°á»¡ng" : null),
        submittedAt: m.submittedAt ? m.submittedAt.toISOString() : null,
        createdAt: m.submittedAt ? m.submittedAt.toISOString() : null,
        updatedAt: m.approvedAt
          ? m.approvedAt.toISOString()
          : m.submittedAt
            ? m.submittedAt.toISOString()
            : null,
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
        isPublished:
          m.status === "ACTIVE" ||
          m.status === "APPROVED" ||
          m.status === "PUBLISHED",
        dailyAverageCalories: nut.cal,
        dailyAverageProteinG: nut.prot,
        dailyAverageFatG: nut.fat,
        dailyAverageCarbG: nut.carb,
        nutritionAvailable: nut.available,
        nutritionReference: nut.reference,
      };
    });

    return { items: mapped, total, page, limit };
  }

  async getStatistics() {
    const total = await this.menuRepo.count();
    const approved = await this.menuRepo.count({
      where: { status: "APPROVED" },
    });
    const pending = await this.menuRepo.count({
      where: [{ status: "SUBMITTED_FOR_REVIEW" }, { status: "PENDING" }],
    });
    const draft = await this.menuRepo.count({ where: { status: "DRAFT" } });
    const active = await this.menuRepo.count({
      where: [{ status: "ACTIVE" }, { status: "PUBLISHED" }],
    });
    const published = await this.menuRepo.count({
      where: { status: "PUBLISHED" },
    });

    let realAvgCalories = 0;
    try {
      const avgRows = await this.menuRepo.query(
        `SELECT ROUND(COALESCE(AVG(dn.energy_kcal * COALESCE(md.portion_size_g / NULLIF(d.standard_serving_size_g, 0), 1)), 0), 1) as avg_cal
         FROM menu_dishes md
         JOIN dishes d ON d.id = md.dish_id AND d.nutrition_verified = TRUE
         JOIN dish_nutrition dn ON dn.dish_id = md.dish_id`,
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
      nutritionStandard: "ThÃ´ng tÆ° 28/2016/TT-BGDÄT",
    };
  }

  async getAvailableDishes() {
    const dishes = await this.dishRepo.find({
      where: { status: "ACTIVE" },
      relations: ["category", "nutrition"],
      order: { name: "ASC" },
    });

    return dishes.map((d) => this.serializeAvailableDish(d));
  }

  private serializeAvailableDish(d: Dish) {
    const nutrition = getPortionNutrition(d);
    return {
      id: String(d.id),
      name: d.name,
      categoryCode: d.category?.code || "MAIN",
      categoryName: d.category?.name || "MÃ³n Äƒn",
      dishType: d.category?.code || "MAIN",
      isActive: d.status === "ACTIVE",
      standardServingSizeG: Number(d.standardServingSizeG) || 100,
      nutritionAvailable: hasPlanningNutrition(d),
      nutritionReference: hasPlanningNutrition(d) && !hasVerifiedNutrition(d),
      ...nutrition,
      totalCalories: nutrition.energyKcal,
      totalProteinG: nutrition.proteinG,
      totalFatG: nutrition.fatG,
      totalCarbG: nutrition.carbG,
    };
  }

  private getActiveAllergyDeclarations() {
    return this.menuDishRepo.manager.query(`
      SELECT s.id as student_id, s.full_name, c.id as class_id, c.name as class_name,
        sa.allergen_id, COALESCE(a.name,NULLIF(btrim(sa.custom_allergen_name),'')) as allergen_name,
        COALESCE(a.code,'CUSTOM') as allergen_code, sa.severity, sa.reaction_treatment, sa.allergy_type
      FROM student_allergies sa
      JOIN students s ON sa.student_id = s.id
      LEFT JOIN allergens a ON sa.allergen_id = a.id
      LEFT JOIN classes c ON s.class_id = c.id
      WHERE sa.is_active = TRUE AND s.status = 'ACTIVE'
      ORDER BY s.full_name ASC
    `);
  }

  async getSubstituteCandidates(menuId: number, menuDishId: number) {
    const menu = await this.findOne(menuId);
    const original = menu.menuDishes.find(
      (item) => Number(item.id) === menuDishId,
    );
    if (!original)
      throw new NotFoundException(
        "MÃ³n gá»‘c khÃ´ng cÃ²n trong phiÃªn báº£n thá»±c Ä‘Æ¡n hiá»‡n táº¡i. Vui lÃ²ng táº£i láº¡i.",
      );
    const dishes = await this.dishRepo.find({
      where: [{ status: "ACTIVE" }, { id: Number(original.dishId) }],
      relations: [
        "category",
        "nutrition",
        "recipes",
        "recipes.ingredient",
        "dishAllergens",
      ],
      order: { name: "ASC" },
    });
    const source = dishes.find(
      (dish) => Number(dish.id) === Number(original.dishId),
    );
    if (!source)
      throw new NotFoundException(
        "MÃ³n gá»‘c khÃ´ng cÃ²n trong danh má»¥c. Vui lÃ²ng táº£i láº¡i.",
      );
    const declarations = await this.getActiveAllergyDeclarations();
    const matches = (declaration: any, dish: Dish) =>
      matchesDeclaredAllergy(
        {
          name: declaration.allergen_name || "",
          code: declaration.allergen_code,
          catalogId: declaration.allergen_id,
        },
        {
          name: dish.name,
          ingredients: (dish.recipes || []).map(
            (item) => item.ingredient?.name || "",
          ),
          allergenIds: (dish.dishAllergens || []).map((item) =>
            Number(item.allergenId),
          ),
        },
      );
    const affected = new Set(
      declarations
        .filter((item) => matches(item, source))
        .map((item) => String(item.student_id)),
    );
    const restrictions = declarations.filter((item) =>
      affected.has(String(item.student_id)),
    );
    return dishes
      .filter(
        (dish) =>
          Number(dish.id) !== Number(source.id) &&
          dish.status === "ACTIVE" &&
          hasPlanningNutrition(dish) &&
          dish.recipes?.length &&
          !restrictions.some((item) => matches(item, dish)),
      )
      .map((dish) => this.serializeAvailableDish(dish));
  }

  async findOne(id: number, versionNumber?: number) {
    if (
      versionNumber !== undefined &&
      (!Number.isSafeInteger(versionNumber) || versionNumber < 1)
    )
      throw new BadRequestException("Sá»‘ phiÃªn báº£n khÃ´ng há»£p lá»‡.");
    const menu = await this.menuRepo.findOne({
      where: { id },
      relations: ["creator", "approver", "submitter"],
    });

    if (!menu) {
      throw new NotFoundException(`KhÃ´ng tÃ¬m tháº¥y thá»±c Ä‘Æ¡n vá»›i ID: ${id}`);
    }

    // Find latest version
    let version = await this.versionRepo.findOne({
      where: {
        menuId: id,
        ...(versionNumber !== undefined ? { versionNumber } : {}),
      },
      order: { versionNumber: "DESC" },
    });

    if (!version) {
      throw new NotFoundException(
        "ChÆ°a cÃ³ dá»¯ liá»‡u phiÃªn báº£n thá»±c Ä‘Æ¡n Ä‘Æ°á»£c chá»n.",
      );
    }

    // Load days, meals, dishes
    const days = await this.dayRepo.find({
      where: { menuVersionId: version.id },
      order: { dayOfWeek: "ASC" },
      relations: [
        "meals",
        "meals.dishes",
        "meals.dishes.dish",
        "meals.dishes.dish.category",
        "meals.dishes.dish.nutrition",
      ],
    });

    const menuDishes: any[] = [];
    let totalMenuCalories = 0;
    let totalMenuProtein = 0;
    let totalMenuFat = 0;
    let totalMenuCarb = 0;
    const activeDaysCount = days.length || 5;

    for (const d of days) {
      const frontendDayOfWeek =
        d.dayOfWeek >= 2 && d.dayOfWeek <= 6 ? d.dayOfWeek - 1 : d.dayOfWeek;
      for (const m of d.meals || []) {
        for (const md of m.dishes || []) {
          const nutrients = getPortionNutrition(md.dish, md.portionSizeG);
          const {
            energyKcal: cal,
            proteinG: prot,
            fatG: fat,
            carbG: carb,
          } = nutrients;

          totalMenuCalories += cal;
          totalMenuProtein += prot;
          totalMenuFat += fat;
          totalMenuCarb += carb;

          menuDishes.push({
            id: String(md.id),
            tenantId: "1",
            menuId: String(menu.id),
            dishId: String(md.dishId),
            dayOfWeek: frontendDayOfWeek,
            mealTime: m.mealType,
            servingOrder: md.displayOrder || 1,
            portionSizeG:
              md.portionSizeG ?? md.dish?.standardServingSizeG ?? 100,
            nutritionAvailable: hasPlanningNutrition(md.dish),
            nutritionReference: hasPlanningNutrition(md.dish) && !hasVerifiedNutrition(md.dish),
            plannedCalories: cal,
            specialDietNotes: md.specialDietNotes || null,
            dish: {
              id: String(md.dish?.id),
              name: md.dish?.name || "MÃ³n Äƒn",
              dishType: md.dish?.category?.code || "MAIN",
              targetAgeGroup: menu.ageGroup,
              standardServingSizeG: md.dish?.standardServingSizeG ?? 100,
              nutritionAvailable: hasPlanningNutrition(md.dish),
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
      createdByName: menu.creator?.fullName || "ChuyÃªn viÃªn Dinh dÆ°á»¡ng",
      approvedByName: menu.approver?.fullName || null,
      approvedAt: menu.approvedAt ? menu.approvedAt.toISOString() : null,
      submittedBy: menu.submittedBy ? String(menu.submittedBy) : null,
      submittedByName:
        menu.submitter?.fullName ||
        (menu.submittedBy ? "ChuyÃªn viÃªn Dinh dÆ°á»¡ng" : null),
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
      nutritionAvailable:
        menuDishes.length > 0 &&
        menuDishes.every((item) => item.nutritionAvailable),
      nutritionReference: menuDishes.some((item) => item.nutritionReference),
      menuDishes,
      days: days.map((d) => ({
        id: String(d.id),
        dayOfWeek:
          d.dayOfWeek >= 2 && d.dayOfWeek <= 6 ? d.dayOfWeek - 1 : d.dayOfWeek,
        date: d.date,
        meals: (d.meals || []).map((m) => ({
          id: String(m.id),
          mealType: m.mealType,
          dishes: (m.dishes || []).map((md) => ({
            id: String(md.id),
            dishId: String(md.dishId),
            dishName: md.dish?.name || "MÃ³n Äƒn",
            categoryCode: md.dish?.category?.code || "MAIN",
            categoryName:
              (m.mealType === "BREAKFAST" || m.mealType === "MORNING_SNACK") &&
              (md.dish?.category?.code === "SNACK_AFTERNOON" ||
                md.dish?.category?.name?.includes("Xáº¿") ||
                md.dish?.category?.name?.includes("chiá»u"))
                ? "MÃ³n sÃ¡ng"
                : md.dish?.category?.name || "MÃ³n Äƒn",
            portionSizeG: md.portionSizeG,
            nutritionAvailable: hasPlanningNutrition(md.dish),
            ...getPortionNutrition(md.dish, md.portionSizeG),
          })),
        })),
      })),
    };
  }

  async getVersions(menuId: number) {
    const versions = await this.versionRepo.find({
      where: { menuId },
      relations: ["creator"],
      order: { versionNumber: "DESC" },
    });

    return versions.map((v) => ({
      id: String(v.id),
      menuId: String(v.menuId),
      version: v.versionNumber,
      versionNumber: v.versionNumber,
      changeNote: v.changeNote || "",
      createdAt: v.createdAt ? v.createdAt.toISOString() : null,
      createdByName: v.creator?.fullName || "",
    }));
  }

  async getAdvisory(menuId: number) {
    const menu = await this.menuRepo.findOne({ where: { id: menuId } });
    const menuDetail = await this.findOne(menuId);

    // 1. Táº£i danh sÃ¡ch dá»‹ á»©ng há»c sinh tá»« database
    const studentAllergiesRaw = await this.getActiveAllergyDeclarations();

    // 2. Táº£i danh sÃ¡ch tÄƒng trÆ°á»Ÿng BMI / WHO Z-score tá»« database
    const bmiStudentsRaw = await this.menuDishRepo.manager.query(`
      SELECT s.id as student_id, s.full_name, c.name as class_name, gz.classification, pm.weight_kg, pm.height_cm, gz.baz
      FROM growth_zscores gz
      JOIN physical_measurements pm ON gz.measurement_id = pm.id
      JOIN students s ON pm.student_id = s.id
      LEFT JOIN classes c ON s.class_id = c.id
      ORDER BY s.full_name ASC
    `);

    // 3. QuÃ©t xung Ä‘á»™t dá»‹ á»©ng giá»¯a mÃ³n Äƒn trong tuáº§n vÃ  cÃ¡c bÃ©
    const allergyConflicts: any[] = [];
    const dishIds = [
      ...new Set(
        (menuDetail.menuDishes || []).map((item) => Number(item.dishId)),
      ),
    ];
    const recipeDishes = dishIds.length
      ? await this.dishRepo.find({
          where: { id: In(dishIds) },
          relations: ["recipes", "recipes.ingredient", "dishAllergens"],
        })
      : [];
    const recipeById = new Map(
      recipeDishes.map((dish) => [Number(dish.id), dish]),
    );

    let cflCounter = 1;
    for (const md of menuDetail.menuDishes || []) {
      const recipe = recipeById.get(Number(md.dishId));

      for (const sa of studentAllergiesRaw) {
        const matchReasons = getAllergyMatchReasons(
          {
            name: sa.allergen_name || "",
            code: sa.allergen_code,
            catalogId: sa.allergen_id,
          },
          {
            name: md.dish?.name || "",
            ingredients: (recipe?.recipes || []).map(
              (item) => item.ingredient?.name || "",
            ),
            allergenIds: (recipe?.dishAllergens || []).map((item) =>
              Number(item.allergenId),
            ),
            allergenTags: (recipe?.dishAllergens || []).map((item) => ({
              allergenId: Number(item.allergenId),
              note: item.note,
            })),
          },
        );

        if (matchReasons.length) {
          allergyConflicts.push({
            conflictId: `cfl-${cflCounter++}`,
            childId: String(sa.student_id),
            childName: sa.full_name,
            classId: sa.class_id ? String(sa.class_id) : null,
            className: sa.class_name || "ChÆ°a cÃ³ lá»›p",
            allergenDetected: sa.allergen_name,
            matchReasons,
            allergenCode: sa.allergen_code || "ALLERGEN",
            severity: advisorySeverity(sa.severity),
            reactionTreatment: sa.reaction_treatment || null,
            menuDishId: String(md.id),
            dishId: String(md.dishId),
            dishName: md.dish?.name || "MÃ³n Äƒn",
            dishType: md.dish?.dishType || "MAIN",
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

    // 4. NhÃ³m tráº» thá»«a cÃ¢n / bÃ©o phÃ¬ (Loáº¡i 2)
    const overweightChildren = bmiStudentsRaw
      .filter(
        (s: any) =>
          s.classification === "OVERWEIGHT" || s.classification === "OBESE",
      )
      .map((s: any) => {
        const w = Number(s.weight_kg) || 19;
        const h = Number(s.height_cm) || 100;
        const bmi = Math.round((w / Math.pow(h / 100, 2)) * 10) / 10;
        return {
          childId: String(s.student_id),
          childName: s.full_name,
          className: s.class_name || "Lá»›p Máº«u giÃ¡o",
          weightKg: w,
          heightCm: h,
          bmi,
          baz: Number(s.baz) || 2.1,
          classification: s.classification,
          statusText: "Thá»«a cÃ¢n / Nguy cÆ¡ bÃ©o phÃ¬ (WHO)",
          healthNotes:
            "Cáº§n giáº£m 10â€“15% cháº¥t bÃ©o & calo, háº¡n cháº¿ mÃ³n chiÃªn rÃ¡n, tÄƒng cÆ°á»ng rau cá»§ theo TT 28",
        };
      });

    // 5. NhÃ³m tráº» cÃ²i xÆ°Æ¡ng / suy dinh dÆ°á»¡ng (Loáº¡i 1)
    const wastedChildren = bmiStudentsRaw
      .filter(
        (s: any) =>
          s.classification === "UNDERWEIGHT" || s.classification === "STUNTED",
      )
      .map((s: any) => {
        const w = Number(s.weight_kg) || 11.5;
        const h = Number(s.height_cm) || 89;
        const bmi = Math.round((w / Math.pow(h / 100, 2)) * 10) / 10;
        return {
          childId: String(s.student_id),
          childName: s.full_name,
          className: s.class_name || "Lá»›p Máº§m 1",
          weightKg: w,
          heightCm: h,
          bmi,
          baz: Number(s.baz) || -1.2,
          classification: s.classification,
          statusText: "CÃ²i xÆ°Æ¡ng / Tháº¥p cÃ²i / Suy dinh dÆ°á»¡ng (WHO)",
          healthNotes:
            "Cáº§n tÄƒng Ä‘áº¡m sinh há»c cao, bá»• sung dáº§u gáº¥c/oliu, tÄƒng 15â€“20% kháº©u pháº§n Äƒn theo QÄ 1246 & TT 28",
        };
      });

    const affectedChildrenSet = new Set(allergyConflicts.map((c) => c.childId));
    const affectedDishesSet = new Set(allergyConflicts.map((c) => c.dishId));

    return {
      menuId: String(menuId),
      menuTitle: menu?.title || "Thá»±c Ä‘Æ¡n tuáº§n",
      targetAgeGroup: menu?.ageGroup || "MAU_GIAO",
      allergySummary: {
        totalConflicts: allergyConflicts.length,
        criticalCount: allergyConflicts.filter((c) =>
          ["SEVERE", "ANAPHYLACTIC"].includes(c.severity),
        ).length,
        warningCount: allergyConflicts.filter(
          (c) => !["SEVERE", "ANAPHYLACTIC"].includes(c.severity),
        ).length,
        affectedChildrenCount: affectedChildrenSet.size,
        affectedDishesCount: affectedDishesSet.size,
      },
      allergyConflicts,
      bmiSummary: {
        totalEvaluated: bmiStudentsRaw.length,
        overweightObeseCount: overweightChildren.length,
        wastedUnderweightCount: wastedChildren.length,
        normalCount: Math.max(
          0,
          bmiStudentsRaw.length -
            overweightChildren.length -
            wastedChildren.length,
        ),
      },
      bmiRecommendations: {
        overweightGroup: {
          label: "NhÃ³m Thá»«a cÃ¢n & BÃ©o phÃ¬",
          count: overweightChildren.length,
          severity: "WARNING",
          clinicalStrategy:
            "Giáº£m 10â€“15% tinh bá»™t & cháº¥t bÃ©o bÃ£o hÃ²a, háº¡n cháº¿ mÃ³n chiÃªn xÃ o máº·n, tÄƒng rau cá»§ theo ThÃ´ng tÆ° 28",
          portionAdvice:
            "Khuyáº¿n khÃ­ch Äƒn nhiá»u canh rau trÆ°á»›c, giáº£m cÆ¡m & nÆ°á»›c ngá»t",
          children: overweightChildren,
          recommendedSubstituteDishes: [],
        },
        wastedGroup: {
          label: "NhÃ³m CÃ²i xÆ°Æ¡ng & Suy dinh dÆ°á»¡ng",
          count: wastedChildren.length,
          severity: "WARNING",
          clinicalStrategy:
            "TÄƒng cÆ°á»ng cháº¥t Ä‘áº¡m sinh há»c cao, bá»• sung dáº§u oliu/dáº§u gáº¥c, tÄƒng 15â€“20% kháº©u pháº§n theo QÄ 1246 & TT 28",
          portionAdvice:
            "Chia nhá» bá»¯a Äƒn, khuyáº¿n khÃ­ch uá»‘ng thÃªm sá»¯a vÃ  mÃ³n xáº¿ bá»• dÆ°á»¡ng",
          children: wastedChildren,
          recommendedSubstituteDishes: [],
        },
      },
    };
  }

  async create(
    dto: CreateMenuDto,
    userId?: number,
    nutritionalStandardId?: number,
  ) {
    const menu = this.menuRepo.create({
      title: dto.title,
      weekStartDate: dto.weekStartDate,
      weekEndDate: dto.weekEndDate,
      ageGroup: dto.ageGroup,
      nutritionalStandardId: nutritionalStandardId ?? null,
      cycleId: dto.cycleId || null,
      status: dto.status || "DRAFT",
      createdBy: userId || 3,
    });

    const savedMenu = await this.menuRepo.save(menu);

    const version = this.versionRepo.create({
      menuId: savedMenu.id,
      versionNumber: 1,
      createdBy: userId || 3,
      changeNote: "Khá»Ÿi táº¡o thá»±c Ä‘Æ¡n tuáº§n",
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
          date: dayDate.toISOString().split("T")[0],
        }),
      );

      // Create standard meals: BREAKFAST, LUNCH, AFTERNOON_SNACK
      for (const mealType of ["BREAKFAST", "LUNCH", "AFTERNOON_SNACK"]) {
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
    if (!menu) throw new NotFoundException("KhÃ´ng tÃ¬m tháº¥y thá»±c Ä‘Æ¡n");

    if (dto.title) menu.title = dto.title;
    if (dto.weekStartDate) menu.weekStartDate = dto.weekStartDate;
    if (dto.weekEndDate) menu.weekEndDate = dto.weekEndDate;
    if (dto.ageGroup) menu.ageGroup = dto.ageGroup;
    if (dto.status) menu.status = dto.status;

    await this.menuRepo.save(menu);

    this.auditLogsService
      ?.logAction({
        tenantId: 1,
        userId: 1,
        userName: "Ban GiÃ¡m Hiá»‡u",
        userRole: "PRINCIPAL",
        action: "UPDATE_MENU",
        targetEntity: "MENU",
        targetId: String(id),
        ipAddress: "127.0.0.1",
        details: {
          menuId: id,
          title: menu.title,
          updatedFields: Object.keys(dto),
        },
      })
      .catch(() => {});

    return this.findOne(id);
  }

  async adjustDish(menuId: number, dto: AdjustDishDto) {
    const targetId = Number(
      dto.newDishId ?? dto.substituteDishId ?? dto.dishId,
    );
    if (!Number.isSafeInteger(targetId) || targetId <= 0) {
      throw new BadRequestException(
        "Vui lÃ²ng chá»n má»™t mÃ³n Äƒn há»£p lá»‡ tá»« danh má»¥c.",
      );
    }
    try {
      return await this.menuRepo.manager.transaction(async (manager) => {
        const menus = manager.getRepository(Menu);
        const versions = manager.getRepository(MenuVersion);
        const days = manager.getRepository(MenuDay);
        const meals = manager.getRepository(MenuMeal);
        const menuDishes = manager.getRepository(MenuDish);
        const dishes = manager.getRepository(Dish);
        const menu = await menus.findOne({
          where: { id: menuId },
          lock: { mode: "pessimistic_write" },
        });
        if (!menu) throw new NotFoundException("KhÃ´ng tÃ¬m tháº¥y thá»±c Ä‘Æ¡n");
        const target = await dishes.findOne({
          where: { id: targetId },
          lock: { mode: "pessimistic_read" },
        });
        if (!target)
          throw new NotFoundException(
            "MÃ³n thay tháº¿ khÃ´ng cÃ²n trong danh má»¥c. Vui lÃ²ng táº£i láº¡i vÃ  chá»n mÃ³n khÃ¡c.",
          );
        if (target.status !== "ACTIVE")
          throw new BadRequestException(
            "MÃ³n thay tháº¿ Ä‘Ã£ táº¡m ngÆ°ng. Vui lÃ²ng chá»n mÃ³n khÃ¡c.",
          );

        let version = await versions.findOne({
          where: { menuId },
          order: { versionNumber: "DESC" },
        });
        if (!version) {
          if (dto.menuDishId)
            throw new NotFoundException(
              "Ã” mÃ³n gá»‘c khÃ´ng cÃ²n trong phiÃªn báº£n thá»±c Ä‘Æ¡n hiá»‡n táº¡i.",
            );
          version = await versions.save(
            versions.create({
              menuId,
              versionNumber: 1,
              createdBy: menu.createdBy,
            }),
          );
        }
        let original: MenuDish | null = null;
        let meal: MenuMeal;
        if (dto.menuDishId) {
          original = await menuDishes.findOne({
            where: { id: dto.menuDishId },
            relations: ["menuMeal", "menuMeal.menuDay"],
          });
          if (
            !original ||
            Number(original.menuMeal?.menuDay?.menuVersionId) !==
              Number(version.id)
          ) {
            throw new NotFoundException(
              "Ã” mÃ³n gá»‘c khÃ´ng cÃ²n trong phiÃªn báº£n thá»±c Ä‘Æ¡n hiá»‡n táº¡i. Vui lÃ²ng táº£i láº¡i.",
            );
          }
          if (
            dto.oldDishId &&
            Number(original.dishId) !== Number(dto.oldDishId)
          ) {
            throw new BadRequestException(
              "MÃ³n gá»‘c Ä‘Ã£ Ä‘Æ°á»£c thay Ä‘á»•i. Vui lÃ²ng táº£i láº¡i thá»±c Ä‘Æ¡n.",
            );
          }
          meal = original.menuMeal;
        } else {
          const mealType = dto.mealType || dto.mealTime || "LUNCH";
          if (
            ![
              "BREAKFAST",
              "MORNING_SNACK",
              "LUNCH",
              "AFTERNOON_SNACK",
              "LATE_SNACK",
            ].includes(mealType)
          ) {
            throw new BadRequestException("Bá»¯a Äƒn khÃ´ng há»£p lá»‡.");
          }
          const rawDay = Number(dto.dayOfWeek ?? 1);
          if (!Number.isInteger(rawDay) || rawDay < 1 || rawDay > 7)
            throw new BadRequestException("NgÃ y trong tuáº§n khÃ´ng há»£p lá»‡.");
          let dbDay = rawDay;
          if (
            rawDay <= 5 &&
            (await days.findOne({
              where: { menuVersionId: version.id, dayOfWeek: rawDay + 1 },
            }))
          )
            dbDay++;
          let day = await days.findOne({
            where: { menuVersionId: version.id, dayOfWeek: dbDay },
            relations: ["meals"],
          });
          if (!day) {
            const date = new Date(menu.weekStartDate);
            date.setUTCDate(date.getUTCDate() + rawDay - 1);
            day = await days.save(
              days.create({
                menuVersionId: version.id,
                dayOfWeek: dbDay,
                date: date.toISOString().slice(0, 10),
              }),
            );
          }
          meal = day.meals?.find((item) => item.mealType === mealType);
          if (!meal)
            meal = await meals.save(
              meals.create({ menuDayId: day.id, mealType }),
            );
          if (dto.oldDishId) {
            original = await menuDishes.findOne({
              where: { menuMealId: meal.id, dishId: dto.oldDishId },
            });
            if (!original)
              throw new NotFoundException(
                "MÃ³n gá»‘c khÃ´ng cÃ²n trong bá»¯a Äƒn Ä‘Ã£ chá»n. Vui lÃ²ng táº£i láº¡i.",
              );
          }
        }

        const existing = await menuDishes.findOne({
          where: { menuMealId: meal.id, dishId: targetId },
        });
        const menuDish =
          existing ||
          menuDishes.create({
            menuMealId: meal.id,
            dishId: targetId,
            specialDietNotes: null,
          });
        menuDish.portionSizeG =
          dto.portionSizeG ?? existing?.portionSizeG ?? 100;
        if (
          !Number.isFinite(menuDish.portionSizeG) ||
          menuDish.portionSizeG <= 0
        )
          throw new BadRequestException("Kháº©u pháº§n pháº£i lá»›n hÆ¡n 0.");
        if (dto.specialDietNotes !== undefined)
          menuDish.specialDietNotes = dto.specialDietNotes || null;
        // Save first, then remove the original within the same transaction.
        await menuDishes.save(menuDish);
        if (
          original &&
          dto.keepOriginalDish === false &&
          Number(original.id) !== Number(menuDish.id)
        ) {
          await menuDishes.delete({ id: original.id, menuMealId: meal.id });
        }
        return {
          success: true,
          menuDishId: String(menuDish.id),
          dishId: String(targetId),
          message: "ÄÃ£ cáº­p nháº­t mÃ³n Äƒn trong thá»±c Ä‘Æ¡n thÃ nh cÃ´ng",
        };
      });
    } catch (error) {
      if (
        error.code === "23503" &&
        error.constraint === "menu_dishes_dish_id_fkey"
      ) {
        throw new BadRequestException(
          "Danh má»¥c mÃ³n Äƒn Ä‘Ã£ thay Ä‘á»•i. Vui lÃ²ng táº£i láº¡i thá»±c Ä‘Æ¡n vÃ  chá»n mÃ³n khÃ¡c.",
        );
      }
      throw error;
    }
  }

  async removeDish(menuId: number, menuDishId: number) {
    await this.menuDishRepo.delete({ id: menuDishId });
    return { success: true };
  }

  async submitForReview(id: number, submitter?: any, dto?: SubmitMenuDto) {
    const menu = await this.menuRepo.findOne({
      where: { id },
      relations: ["creator", "submitter"],
    });
    if (!menu)
      throw new NotFoundException("KhÃ´ng tÃ¬m tháº¥y thá»±c Ä‘Æ¡n Ä‘á»ƒ gá»­i duyá»‡t");

    // 1. Kiá»ƒm tra tráº¡ng thÃ¡i thá»±c Ä‘Æ¡n há»£p lá»‡ (DRAFT, REJECTED, PENDING, SUBMITTED_FOR_REVIEW)
    const allowedStatuses = [
      "DRAFT",
      "REJECTED",
      "PENDING",
      "SUBMITTED_FOR_REVIEW",
    ];
    if (!allowedStatuses.includes(menu.status)) {
      throw new BadRequestException(
        `Thá»±c Ä‘Æ¡n Ä‘ang á»Ÿ tráº¡ng thÃ¡i "${menu.status}", khÃ´ng thá»ƒ gá»­i duyá»‡t láº¡i.`,
      );
    }

    // 2. Kiá»ƒm tra báº£n cam káº¿t trÃ¡ch nhiá»‡m chuyÃªn mÃ´n (Nutritionist Commitment)
    if (dto && dto.commitmentSigned === false) {
      throw new BadRequestException(
        "ChuyÃªn viÃªn Dinh dÆ°á»¡ng báº¯t buá»™c pháº£i xÃ¡c nháº­n kÃ½ sá»‘ cam káº¿t trÃ¡ch nhiá»‡m chuyÃªn mÃ´n",
      );
    }

    // 3. Kiá»ƒm tra giáº£i trÃ¬nh vÆ°á»£t ngÆ°á»¡ng náº¿u cÃ³ cáº£nh bÃ¡o (Override Justification)
    const hasWarnings =
      Array.isArray(dto?.violationsSnapshot) &&
      dto.violationsSnapshot.length > 0;
    if (hasWarnings) {
      const justification = dto?.overrideJustification?.trim();
      if (!justification || justification.length < 10) {
        throw new BadRequestException(
          "Thá»±c Ä‘Æ¡n cÃ³ cáº£nh bÃ¡o vÆ°á»£t ngÆ°á»¡ng quy táº¯c dinh dÆ°á»¡ng / láº·p mÃ³n. ChuyÃªn viÃªn Dinh dÆ°á»¡ng báº¯t buá»™c pháº£i nháº­p giáº£i trÃ¬nh chuyÃªn mÃ´n cá»¥ thá»ƒ (tá»‘i thiá»ƒu 10 kÃ½ tá»±).",
        );
      }
    }

    // 4. LÆ°u thÃ´ng tin ná»™p duyá»‡t vÃ o Menu entity
    const submitterId =
      submitter?.id ||
      submitter?.sub ||
      (menu.createdBy ? Number(menu.createdBy) : 1);
    menu.status = "PENDING";
    menu.submittedBy = submitterId;
    menu.submittedAt = new Date();
    menu.commitmentSigned =
      dto?.commitmentSigned !== undefined ? dto.commitmentSigned : true;
    menu.commitmentText =
      dto?.commitmentText ||
      "Cam káº¿t thá»±c Ä‘Æ¡n tuÃ¢n thá»§ Ä‘á»‹nh má»©c ThÃ´ng tÆ° 28/2016/TT-BGDÄT vÃ  an toÃ n thá»±c pháº©m Quyáº¿t Ä‘á»‹nh 1246/QÄ-BYT";
    menu.commitmentItems =
      dto?.commitmentItems && dto.commitmentItems.length > 0
        ? dto.commitmentItems
        : [
            "COMMIT_TT28_NUTRITION",
            "COMMIT_QD1246_SAFETY",
            "COMMIT_ALLERGEN_SAFETY",
            "COMMIT_PROFESSIONAL_RESP",
          ];
    menu.overrideJustification = dto?.overrideJustification?.trim() || null;
    menu.violationsSnapshot = dto?.violationsSnapshot || [];

    await this.menuRepo.save(menu);

    // 5. Ghi váº¿t kiá»ƒm toÃ¡n trá»±c tiáº¿p vÃ o báº£ng audit_logs cá»§a PostgreSQL
    try {
      await this.auditLogsService?.logAction({
        tenantId: submitter?.tenantId || 1,
        userId: submitterId,
        userName:
          submitter?.fullName || submitter?.name || "ChuyÃªn viÃªn Dinh dÆ°á»¡ng",
        userEmail: submitter?.email || "dinhduong@huongduong.edu.vn",
        userRole: "NUTRITIONIST",
        action: "SUBMIT_MENU_FOR_REVIEW",
        targetEntity: "MENU",
        targetId: String(id),
        ipAddress: submitter?.ip || "127.0.0.1",
        userAgent: submitter?.userAgent || "KidMeal Web Application",
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
      this.logger.warn(
        `[MenusService] Ghi audit log submit tháº¥t báº¡i: ${auditErr.message}`,
      );
    }

    return this.findOne(id);
  }

  async approveMenu(id: number, approverId: number, notes?: string) {
    const menu = await this.menuRepo.findOne({ where: { id } });
    if (!menu) throw new NotFoundException("KhÃ´ng tÃ¬m tháº¥y thá»±c Ä‘Æ¡n");

    // Chá»‰ thá»±c Ä‘Æ¡n Ä‘ang PENDING hoáº·c SUBMITTED_FOR_REVIEW má»›i Ä‘Æ°á»£c phÃª duyá»‡t
    if (menu.status !== "PENDING" && menu.status !== "SUBMITTED_FOR_REVIEW") {
      throw new BadRequestException(
        `Chá»‰ thá»±c Ä‘Æ¡n Ä‘ang "Chá» BGH duyá»‡t" má»›i cÃ³ thá»ƒ phÃª duyá»‡t. Tráº¡ng thÃ¡i hiá»‡n táº¡i: ${menu.status}`,
      );
    }

    menu.status = "APPROVED";
    menu.approvedBy = approverId || 1;
    menu.approvedAt = new Date();
    menu.approvalNotes = notes || null;
    await this.menuRepo.save(menu);

    this.auditLogsService
      ?.logAction({
        tenantId: 1,
        userId: approverId || 1,
        userName: "Ban GiÃ¡m Hiá»‡u",
        userRole: "PRINCIPAL",
        action: "APPROVE_MENU",
        targetEntity: "MENU",
        targetId: String(id),
        ipAddress: "127.0.0.1",
        details: {
          menuId: id,
          title: menu.title,
          note: notes || "PhÃª duyá»‡t thá»±c Ä‘Æ¡n tuáº§n Ä‘áº¡t chuáº©n",
          approvedAt: menu.approvedAt,
        },
      })
      .catch(() => {});

    return this.findOne(id);
  }

  async rejectMenu(id: number, approverId: number, reason: string) {
    const menu = await this.menuRepo.findOne({ where: { id } });
    if (!menu) throw new NotFoundException("KhÃ´ng tÃ¬m tháº¥y thá»±c Ä‘Æ¡n");

    // Chá»‰ thá»±c Ä‘Æ¡n Ä‘ang PENDING hoáº·c SUBMITTED_FOR_REVIEW má»›i Ä‘Æ°á»£c tá»« chá»‘i
    if (menu.status !== "PENDING" && menu.status !== "SUBMITTED_FOR_REVIEW") {
      throw new BadRequestException(
        `Chá»‰ thá»±c Ä‘Æ¡n Ä‘ang "Chá» BGH duyá»‡t" má»›i cÃ³ thá»ƒ tá»« chá»‘i. Tráº¡ng thÃ¡i hiá»‡n táº¡i: ${menu.status}`,
      );
    }

    menu.status = "REJECTED";
    menu.rejectionReason = reason;
    menu.rejectedAt = new Date();
    await this.menuRepo.save(menu);

    this.auditLogsService
      ?.logAction({
        tenantId: 1,
        userId: approverId || 1,
        userName: "Ban GiÃ¡m Hiá»‡u",
        userRole: "PRINCIPAL",
        action: "REJECT_MENU",
        targetEntity: "MENU",
        targetId: String(id),
        ipAddress: "127.0.0.1",
        details: { menuId: id, reason, status: "REJECTED" },
      })
      .catch(() => {});
    return this.findOne(id);
  }

  async publishMenu(id: number) {
    const menu = await this.menuRepo.findOne({ where: { id } });
    if (!menu) throw new NotFoundException("KhÃ´ng tÃ¬m tháº¥y thá»±c Ä‘Æ¡n");

    // Chá»‰ thá»±c Ä‘Æ¡n Ä‘Ã£ APPROVED má»›i Ä‘Æ°á»£c cÃ´ng bá»‘ toÃ n trÆ°á»ng
    if (menu.status !== "APPROVED") {
      throw new BadRequestException(
        `Chá»‰ thá»±c Ä‘Æ¡n "ÄÃ£ duyá»‡t" má»›i cÃ³ thá»ƒ cÃ´ng bá»‘ toÃ n trÆ°á»ng. Tráº¡ng thÃ¡i hiá»‡n táº¡i: ${menu.status}`,
      );
    }

    menu.status = "PUBLISHED";
    menu.publishedAt = new Date();
    await this.menuRepo.save(menu);

    this.auditLogsService
      ?.logAction({
        tenantId: 1,
        userId: 1,
        userName: "Ban GiÃ¡m Hiá»‡u",
        userRole: "PRINCIPAL",
        action: "PUBLISH_MENU",
        targetEntity: "MENU",
        targetId: String(id),
        ipAddress: "127.0.0.1",
        details: {
          menuId: id,
          title: menu.title,
          status: "PUBLISHED",
          publishedAt: menu.publishedAt,
        },
      })
      .catch(() => {});

    return this.findOne(id);
  }

  /**
   * TÃ¬m thá»±c Ä‘Æ¡n trÆ°á»ng ÄÃƒ CÃ”NG Bá» (PUBLISHED / ACTIVE) Ã¡p dá»¥ng cho má»™t ngÃ y cá»¥ thá»ƒ.
   * - Chá»‰ xÃ©t thá»±c Ä‘Æ¡n cÃ¹ng nhÃ³m tuá»•i (NHA_TRE / MAU_GIAO) náº¿u cÃ³ truyá»n vÃ o.
   * - Báº¯t buá»™c weekStartDate <= date <= weekEndDate.
   * - Tráº£ vá» chi tiáº¿t Ä‘áº§y Ä‘á»§ (giá»‘ng findOne) hoáº·c null náº¿u chÆ°a cÃ³ thá»±c Ä‘Æ¡n cÃ´ng bá»‘.
   */
  async findPublishedMenuForDate(date: string, ageGroup?: string | null) {
    const qb = this.menuRepo
      .createQueryBuilder("m")
      .where("m.status IN (:...statuses)", {
        statuses: ["PUBLISHED", "ACTIVE"],
      })
      .andWhere("m.weekStartDate <= :date", { date })
      .andWhere("m.weekEndDate >= :date", { date });

    if (ageGroup) {
      qb.andWhere("m.ageGroup = :ageGroup", { ageGroup });
    }

    const menu = await qb.orderBy("m.id", "DESC").getOne();
    if (!menu) return null;
    return this.findOne(menu.id);
  }

  async createVersion(id: number, userId?: number) {
    const version = await this.versionRepo.findOne({
      where: { menuId: id },
      order: { versionNumber: "DESC" },
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

  // â”€â”€ Helper: Giá»›i háº¡n tá»‘i Ä‘a sá»‘ láº§n xuáº¥t hiá»‡n trong chu ká»³ 4 tuáº§n â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private getMaxCycleLimit(
    categoryCode: string,
    dynamicLimits?: Map<string, number>,
  ): number {
    if (dynamicLimits && dynamicLimits.has(categoryCode)) {
      return dynamicLimits.get(categoryCode)!;
    }
    switch (categoryCode) {
      case "RICE":
        return 20; // One rice dish per lunch across four school weeks; plain rice may repeat.
      case "MAIN":
        return 2; // MÃ³n máº·n tá»‘i Ä‘a 2 láº§n trong chu ká»³ 4 tuáº§n
      case "SOUP":
        return 3; // MÃ³n canh tá»‘i Ä‘a 3 láº§n trong chu ká»³ 4 tuáº§n
      case "DESSERT":
        return 4; // TrÃ¡ng miá»‡ng tá»‘i Ä‘a 4 láº§n trong chu ká»³ 4 tuáº§n
      case "SNACK_AFTERNOON":
        return 3; // MÃ³n xáº¿ chiá»u tá»‘i Ä‘a 3 láº§n trong chu ká»³ 4 tuáº§n
      default:
        return 12; // MÃ³n ná»n táº£ng (CÆ¡m, NÆ°á»›c uá»‘ng, Sá»¯a sÃ¡ng)
    }
  }

  // â”€â”€ Helper: Chá»n mÃ³n trÃ¡nh trÃ¹ng láº·p tuáº§n & chu ká»³ 4 tuáº§n â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private pickDish(
    pool: DishWithNutrition[],
    usedThisWeek: Set<number>,
    previousDayDishIds: Set<number>,
    recentDishIds: Set<number>,
    cycleExclusionDishIds: Set<number>,
    relaxConstraints: boolean,
  ): DishWithNutrition | null {
    if (pool.length === 0) return null;

    // LÆ°á»£t 1: Tá»‘i Æ°u chuáº©n nháº¥t: ChÆ°a dÃ¹ng tuáº§n nÃ y, khÃ´ng dÃ¹ng ngÃ y hÃ´m qua, khÃ´ng trÃ¹ng 14 ngÃ y, khÃ´ng vÆ°á»£t chu ká»³ 4 tuáº§n
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

    // LÆ°á»£t 2: ChÆ°a dÃ¹ng tuáº§n nÃ y, khÃ´ng dÃ¹ng ngÃ y hÃ´m qua, khÃ´ng vÆ°á»£t chu ká»³ 4 tuáº§n
    for (const dish of pool) {
      if (
        !usedThisWeek.has(dish.id) &&
        !previousDayDishIds.has(dish.id) &&
        !cycleExclusionDishIds.has(dish.id)
      ) {
        return dish;
      }
    }

    // LÆ°á»£t 3: ChÆ°a dÃ¹ng tuáº§n nÃ y vÃ  khÃ´ng dÃ¹ng ngÃ y hÃ´m qua
    for (const dish of pool) {
      if (!usedThisWeek.has(dish.id) && !previousDayDishIds.has(dish.id)) {
        return dish;
      }
    }

    // LÆ°á»£t 4: Náº¿u danh má»¥c cÃ³ sá»‘ lÆ°á»£ng mÃ³n Ã­t hÆ¡n sá»‘ ngÃ y trong tuáº§n (vÃ­ dá»¥ CÆ¡m chá»‰ cÃ³ 4 mÃ³n mÃ  tuáº§n cÃ³ 5 ngÃ y):
    // Cho phÃ©p láº·p láº¡i mÃ³n Ä‘Ã£ dÃ¹ng trong tuáº§n, nhÆ°ng TUYá»†T Äá»I KHÃ”NG DÃ™NG Láº I MÃ“N Cá»¦A NGÃ€Y HÃ”M QUA (trÃ¡nh trÃ¹ng 2 ngÃ y liÃªn tiáº¿p)
    for (const dish of pool) {
      if (!previousDayDishIds.has(dish.id)) {
        return dish;
      }
    }

    // Fallback: náº¿u danh má»¥c chá»‰ cÃ³ 1 mÃ³n duy nháº¥t trong toÃ n há»‡ thá»‘ng
    return pool[0];
  }
}
