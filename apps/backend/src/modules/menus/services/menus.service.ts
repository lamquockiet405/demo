import { normalizeSearch, searchSql, searchLikeSql } from '../../../common/utils/search';
import { SerializedWrite } from '../../../common/utils/serialized-write';
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
import { AutoGenerateMenuDto } from "../dto/auto-generate-menu.dto";
import { SubmitMenuDto } from "../dto/submit-menu.dto";
import { AuditLogsService } from "../../audit-logs/services/audit-logs.service";
import { DishFrequencyRule } from "../../nutrition-engine/entities/dish-frequency-rule.entity";
import { DishSpacingRule } from "../../nutrition-engine/entities/dish-spacing-rule.entity";
import { NutritionIntakeStandard } from "../../nutrition-engine/entities/nutrition-intake-standard.entity";
import { MealEnergyDistribution } from "../../nutrition-engine/entities/meal-energy-distribution.entity";
import { isFriedRice, isFriday, validateLunchRice } from "./lunch-rice-policy";
import {
  advisorySeverity,
  getAllergyMatchReasons,
  matchesDeclaredAllergy,
} from "./allergy-matching";

// ── Helper: Fisher-Yates shuffle for true randomness ───────────────────────
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Interfaces for structured daily nutrition ──────────────────────────────
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

export interface NutritionBreakdown {
  calories: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  proteinPct: number;
  lipidPct: number;
  glucidPct: number;
  isCompliant: boolean;
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
  qd1Nutrition?: NutritionBreakdown;
  qd2Nutrition?: NutritionBreakdown;
  lateSnackNutrition?: {
    calories: number;
    proteinG: number;
    fatG: number;
    carbG: number;
  };
  isCompliant: boolean;
  violations: string[];
  standardNote: string;
}

@Injectable()
export class MenusService implements OnModuleInit {
  private validateMenuDateRange(startDate: string, endDate: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      throw new BadRequestException("Ngày bắt đầu và ngày kết thúc phải có định dạng YYYY-MM-DD.");
    }
    if (!Number.isFinite(Date.parse(startDate)) || !Number.isFinite(Date.parse(endDate)) || endDate < startDate) {
      throw new BadRequestException("Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.");
    }
  }

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
        "Tự động đồng bộ các cột nộp duyệt vào bảng menus thành công.",
      );
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
    @Optional()
    @InjectRepository(DishFrequencyRule)
    private readonly freqRuleRepo?: Repository<DishFrequencyRule>,
    @Optional()
    @InjectRepository(DishSpacingRule)
    private readonly spacingRuleRepo?: Repository<DishSpacingRule>,
    @Optional()
    @InjectRepository(NutritionIntakeStandard)
    private readonly intakeStandardRepo?: Repository<NutritionIntakeStandard>,
    @Optional()
    @InjectRepository(MealEnergyDistribution)
    private readonly mealDistributionRepo?: Repository<MealEnergyDistribution>,
  ) { }

  async getAcademicYearContext(schoolId: number) {
    const [year] = await this.menuRepo.query(`
      SELECT id::text AS id, name, start_date::text AS "startDate", end_date::text AS "endDate", status
      FROM academic_year WHERE school_id=$1 AND status='ACTIVE'
      ORDER BY start_date DESC, id DESC LIMIT 1
    `, [schoolId]);
    return year || null;
  }

  async findAll(query: QueryMenuDto) {
    const qb = this.menuRepo
      .createQueryBuilder("m")
      .leftJoinAndSelect("m.creator", "creator")
      .leftJoinAndSelect("m.approver", "approver")
      .leftJoinAndSelect("m.submitter", "submitter");

    if (query.search) {
      qb.andWhere(`${searchSql("m.title")} LIKE ${searchLikeSql(":s")}`, {
        s: `%${normalizeSearch(query.search)}%`,
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
      qb.andWhere("m.submittedAt IS NOT NULL");
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

    if (
      query.submittedOnly === true ||
      String(query.submittedOnly) === "true"
    ) {
      qb.andWhere("m.submittedAt IS NOT NULL");
      qb.andWhere("m.status != 'DRAFT'");
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

    // Tính toán dinh dưỡng thực tế 100% từ cơ sở dữ liệu dish_nutrition
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
        this.logger.warn(`Lỗi tính toán dinh dưỡng thực tế: ${err.message}`);
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
        createdByName: m.creator?.fullName || "Chuyên viên Dinh dưỡng",
        approvedByName: m.approver?.fullName || null,
        approvedAt: m.approvedAt ? m.approvedAt.toISOString() : null,
        submittedBy: m.submittedBy ? String(m.submittedBy) : null,
        submittedByName:
          m.submitter?.fullName ||
          (m.submittedBy ? "Chuyên viên Dinh dưỡng" : null),
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

  async getStatistics(schoolId = 1) {
    const year = await this.getAcademicYearContext(schoolId);
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
        `SELECT ROUND(COALESCE(AVG(day_cal), 0), 1) as avg_cal
         FROM (
           SELECT mm.menu_day_id, SUM(dn.energy_kcal * COALESCE(md.portion_size_g / NULLIF(d.standard_serving_size_g, 0), 1)) as day_cal
           FROM menu_dishes md
           JOIN menu_meals mm ON mm.id = md.menu_meal_id
           JOIN dishes d ON d.id = md.dish_id AND d.nutrition_verified = TRUE
           JOIN dish_nutrition dn ON dn.dish_id = md.dish_id
           GROUP BY mm.menu_day_id
         ) sub`,
      );
      realAvgCalories = Number(avgRows?.[0]?.avg_cal) || 0;
    } catch (e: any) {
      realAvgCalories = 0;
    }

    return {
      total,
      totalMenus: total,
      academicYearName: year?.name || null,
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
      nutritionStandard: "Thông tư 28/2016/TT-BGDĐT",
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
      categoryName: d.category?.name || "Món ăn",
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

  private getActiveAllergyDeclarations(schoolId = 1) {
    return this.menuDishRepo.manager.query(`
      SELECT s.id as student_id, s.full_name, c.id as class_id, c.name as class_name,
        sa.allergen_id as allergen_id,
        a.name as allergen_name,
        a.code as allergen_code,
        a.description as allergen_description,
        sa.severity, sa.note as reaction_treatment, 'FOOD' as allergy_type
      FROM student_allergies sa
      JOIN students s ON sa.student_id = s.id
      LEFT JOIN classes c ON s.class_id = c.id
      JOIN allergens a ON sa.allergen_id = a.id
      WHERE s.status = 'ACTIVE'
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
        "Món gốc không còn trong phiên bản thực đơn hiện tại. Vui lòng tải lại.",
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
        "Món gốc không còn trong danh mục. Vui lòng tải lại.",
      );
    const declarations = await this.getActiveAllergyDeclarations();
    const matches = (declaration: any, dish: Dish) =>
      matchesDeclaredAllergy(
        {
          name: declaration.allergen_name || "",
          code: declaration.allergen_code,
          catalogId: declaration.allergen_id,
          description: declaration.allergen_description || null,
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
          (!source.category?.code ||
            !dish.category?.code ||
            dish.category.code === source.category.code) &&
          hasPlanningNutrition(dish) &&
          dish.recipes?.length &&
          !restrictions.some((item) => matches(item, dish)),
      )
      .map((dish) => {
        const matchedDeclarations = declarations.filter((item) =>
          matches(item, dish),
        );
        const conflictingAllergens = [
          ...new Set(
            matchedDeclarations
              .map((item) => item.allergen_name)
              .filter(Boolean),
          ),
        ];
        const conflictingChildrenCount = new Set(
          matchedDeclarations.map((item) => String(item.student_id)),
        ).size;
        return {
          ...this.serializeAvailableDish(dish),
          hasAllergyConflict: conflictingChildrenCount > 0,
          conflictingAllergens,
          conflictingChildrenCount,
        };
      });
  }

  async findOne(id: number, versionNumber?: number) {
    if (
      versionNumber !== undefined &&
      (!Number.isSafeInteger(versionNumber) || versionNumber < 1)
    )
      throw new BadRequestException("Số phiên bản không hợp lệ.");
    const menu = await this.menuRepo.findOne({
      where: { id },
      relations: ["creator", "approver", "submitter"],
    });

    if (!menu) {
      throw new NotFoundException(`Không tìm thấy thực đơn với ID: ${id}`);
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
        "Chưa có dữ liệu phiên bản thực đơn được chọn.",
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
        "meals.dishes.dish.recipes",
        "meals.dishes.dish.recipes.ingredient",
      ],
    });

    const activeDeclarations =
      typeof this.menuDishRepo?.manager?.query === "function"
        ? await this.getActiveAllergyDeclarations().catch(() => [])
        : [];

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
              name: md.dish?.name || "Món ăn",
              dishType: md.dish?.category?.code || "MAIN",
              targetAgeGroup: menu.ageGroup,
              standardServingSizeG: md.dish?.standardServingSizeG ?? 100,
              nutritionAvailable: hasPlanningNutrition(md.dish),
              totalCalories: getPortionNutrition(md.dish).energyKcal,
              totalProteinG: getPortionNutrition(md.dish).proteinG,
              totalFatG: getPortionNutrition(md.dish).fatG,
              totalCarbG: getPortionNutrition(md.dish).carbG,
              isActive: true,
              recipeItems: (md.dish?.recipes || []).map((ri: any) => {
                const ing = ri.ingredient;
                const ingName = ing?.name || "Nguyên liệu";
                const matchedAllergens = Array.from(
                  new Set(
                    activeDeclarations
                      .filter((sa: any) =>
                        matchesDeclaredAllergy(
                          {
                            name: sa.allergen_name || "",
                            code: sa.allergen_code,
                            catalogId: sa.allergen_id,
                            description: sa.allergen_description || null,
                          },
                          { name: ingName, ingredients: [ingName] },
                        ),
                      )
                      .map((sa: any) => sa.allergen_name)
                      .filter(Boolean),
                  ),
                );
                return {
                  id: String(ri.id),
                  dishId: String(md.dish?.id),
                  foodId: String(ri.ingredientId || ing?.id || ""),
                  netWeightPerPortionG: Number(ri.netWeightG || 0),
                  grossWeightPerPortionG: Number(
                    ri.grossWeightG || ri.netWeightG || 0,
                  ),
                  prepNotes: ri.note || null,
                  food: ing
                    ? {
                      id: String(ing.id),
                      name: ingName,
                      unit: ing.unit || "g",
                      energyKcal: Number(ing.energyKcal100g || 0),
                      proteinG: Number(ing.proteinG || 0),
                      fatG: Number(ing.fatG || 0),
                      carbG: Number(ing.carbG || 0),
                      calciumMg: Number(ing.calciumMg || 0),
                      ironMg: Number(ing.ironMg || 0),
                      zincMg: Number(ing.zincMg || 0),
                      allergens: matchedAllergens,
                    }
                    : undefined,
                };
              }),
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
      createdByName: menu.creator?.fullName || "Chuyên viên Dinh dưỡng",
      approvedByName: menu.approver?.fullName || null,
      approvedAt: menu.approvedAt ? menu.approvedAt.toISOString() : null,
      submittedBy: menu.submittedBy ? String(menu.submittedBy) : null,
      submittedByName:
        menu.submitter?.fullName ||
        (menu.submittedBy ? "Chuyên viên Dinh dưỡng" : null),
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
          dishes: (m.dishes || []).map((md) => {
            const ingNames = (md.dish?.recipes || [])
              .map((r: any) => r.ingredient?.name || "")
              .filter(Boolean);
            const matchedDecls = activeDeclarations.filter((sa: any) =>
              matchesDeclaredAllergy(
                {
                  name: sa.allergen_name || "",
                  code: sa.allergen_code,
                  catalogId: sa.allergen_id,
                  description: sa.allergen_description || null,
                },
                {
                  name: md.dish?.name || "",
                  ingredients: ingNames,
                },
              ),
            );
            const dishAllergens = Array.from(
              new Set(matchedDecls.map((sa: any) => sa.allergen_name).filter(Boolean)),
            );
            const affectedStudentIds = Array.from(
              new Set(matchedDecls.map((sa: any) => String(sa.student_id)).filter(Boolean)),
            );
            return {
              id: String(md.id),
              dishId: String(md.dishId),
              dishName: md.dish?.name || "Món ăn",
              categoryCode: md.dish?.category?.code || "MAIN",
              categoryName:
                (m.mealType === "BREAKFAST" || m.mealType === "MORNING_SNACK") &&
                  (md.dish?.category?.code === "SNACK_AFTERNOON" ||
                    md.dish?.category?.name?.includes("Xế") ||
                    md.dish?.category?.name?.includes("chiều"))
                  ? "Món sáng"
                  : md.dish?.category?.name || "Món ăn",
              portionSizeG: md.portionSizeG,
              specialDietNotes: md.specialDietNotes || null,
              allergens: dishAllergens,
              affectedStudentIds,
              nutritionAvailable: hasPlanningNutrition(md.dish),
              ...getPortionNutrition(md.dish, md.portionSizeG),
            };
          }),
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

  async getAdvisory(menuId: number, schoolId = 1) {
    const menu = await this.menuRepo.findOne({ where: { id: menuId } });
    const menuDetail = await this.findOne(menuId);

    // 1. Tải danh sách dị ứng học sinh từ database
    const studentAllergiesRaw = await this.getActiveAllergyDeclarations(schoolId);

    // 2. Tải danh sách tăng trưởng BMI / WHO Z-score từ database
    const bmiStudentsRaw = await this.menuDishRepo.manager.query(`
      SELECT DISTINCT ON (s.id) s.id as student_id, s.full_name, c.name as class_name, gz.classification, pm.weight_kg, pm.height_cm, gz.baz
      FROM growth_zscores gz
      JOIN physical_measurements pm ON gz.measurement_id = pm.id
      JOIN students s ON pm.student_id = s.id
      JOIN student_academic_enrollments enrollment ON enrollment.student_id=s.id AND enrollment.status='ENROLLED'
      JOIN academic_year year ON year.id=enrollment.academic_year_id AND year.status='ACTIVE' AND year.school_id=$1
      JOIN classes c ON c.id=enrollment.class_id AND c.status='ACTIVE'
      WHERE s.status='ACTIVE' AND pm.measured_date BETWEEN year.start_date AND year.end_date
      ORDER BY s.id, pm.measured_date DESC, pm.id DESC, gz.id DESC
    `, [schoolId]);

    // 3. Quét xung đột dị ứng giữa món ăn trong tuần và các bé
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
            description: sa.allergen_description || null,
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
          const problematicIngredients = (recipe?.recipes || [])
            .filter((item) =>
              matchesDeclaredAllergy(
                {
                  name: sa.allergen_name || "",
                  code: sa.allergen_code,
                  catalogId: sa.allergen_id,
                  description: sa.allergen_description || null,
                },
                {
                  name: item.ingredient?.name || "",
                  ingredients: [item.ingredient?.name || ""],
                },
              ),
            )
            .map((item) => ({
              foodId: String(item.ingredientId || item.ingredient?.id || ""),
              foodName: item.ingredient?.name || "",
              allergen: sa.allergen_name || "",
            }));

          allergyConflicts.push({
            conflictId: `cfl-${cflCounter++}`,
            childId: String(sa.student_id),
            childName: sa.full_name,
            classId: sa.class_id ? String(sa.class_id) : null,
            className: sa.class_name || "Chưa có lớp",
            allergenDetected: sa.allergen_name,
            matchReasons,
            allergenCode: sa.allergen_code || "ALLERGEN",
            severity: advisorySeverity(sa.severity),
            reactionTreatment: sa.reaction_treatment || null,
            menuDishId: String(md.id),
            dishId: String(md.dishId),
            dishName: md.dish?.name || "Món ăn",
            dishType: md.dish?.dishType || "MAIN",
            dayOfWeek: md.dayOfWeek,
            mealTime: md.mealTime,
            portionSizeG: md.portionSizeG || 100,
            plannedCalories: md.plannedCalories,
            substituteDishId: null,
            currentSubstituteDishName: null,
            problematicIngredients,
            suggestedIngredientSubstitutions: [],
            suggestedSubstituteDishes: [],
          });
        }
      }
    }

    // 4. Nhóm trẻ thừa cân / béo phì (Loại 2)
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
          className: s.class_name || "Lớp Mẫu giáo",
          weightKg: w,
          heightCm: h,
          bmi,
          baz: Number(s.baz) || 2.1,
          classification: s.classification,
          statusText: "Thừa cân / Nguy cơ béo phì (WHO)",
          healthNotes:
            "Cần giảm 10–15% chất béo & calo, hạn chế món chiên rán, tăng cường rau củ theo TT 28",
        };
      });

    // 5. Nhóm trẻ còi xương / suy dinh dưỡng (Loại 1)
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
          className: s.class_name || "Lớp Mầm 1",
          weightKg: w,
          heightCm: h,
          bmi,
          baz: Number(s.baz) || -1.2,
          classification: s.classification,
          statusText: "Còi xương / Thấp còi / Suy dinh dưỡng (WHO)",
          healthNotes:
            "Cần tăng đạm sinh học cao, bổ sung dầu gấc/oliu, tăng 15–20% khẩu phần ăn theo QĐ 1246 & TT 28",
        };
      });

    const affectedChildrenSet = new Set(allergyConflicts.map((c) => c.childId));
    const affectedDishesSet = new Set(allergyConflicts.map((c) => c.dishId));

    return {
      menuId: String(menuId),
      menuTitle: menu?.title || "Thực đơn tuần",
      targetAgeGroup: menu?.ageGroup || "MAU_GIAO",
      allergySummary: {
        totalConflicts: allergyConflicts.length,
        criticalCount: new Set(allergyConflicts.filter((c) =>
          ["SEVERE", "ANAPHYLACTIC"].includes(c.severity),
        ).map(c => c.childId)).size,
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
          label: "Nhóm Thừa cân & Béo phì",
          count: overweightChildren.length,
          severity: "WARNING",
          clinicalStrategy:
            "Giảm 10–15% tinh bột & chất béo bão hòa, hạn chế món chiên xào mặn, tăng rau củ theo Thông tư 28",
          portionAdvice:
            "Khuyến khích ăn nhiều canh rau trước, giảm cơm & nước ngọt",
          children: overweightChildren,
          recommendedSubstituteDishes: [],
        },
        wastedGroup: {
          label: "Nhóm Còi xương & Suy dinh dưỡng",
          count: wastedChildren.length,
          severity: "WARNING",
          clinicalStrategy:
            "Tăng cường chất đạm sinh học cao, bổ sung dầu oliu/dầu gấc, tăng 15–20% khẩu phần theo QĐ 1246 & TT 28",
          portionAdvice:
            "Chia nhỏ bữa ăn, khuyến khích uống thêm sữa và món xế bổ dưỡng",
          children: wastedChildren,
          recommendedSubstituteDishes: [],
        },
      },
    };
  }

  @SerializedWrite('menu-workflow', 'menuRepo')
  async create(
    dto: CreateMenuDto,
    userId?: number,
    nutritionalStandardId?: number,
  ) {
    this.validateMenuDateRange(dto.weekStartDate, dto.weekEndDate);
    const duplicate = await this.menuRepo.findOne({
      where: {
        title: dto.title.trim(), weekStartDate: dto.weekStartDate, weekEndDate: dto.weekEndDate, ageGroup: dto.ageGroup,
      }
    });
    if (duplicate) throw new BadRequestException('Thực đơn cùng tên, tuần và nhóm tuổi đã tồn tại. Vui lòng chỉnh sửa thực đơn hiện có.');
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
      changeNote: "Khởi tạo thực đơn tuần",
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

      // Create standard meals: BREAKFAST, LUNCH, AFTERNOON_SNACK, LATE_SNACK
      for (const mealType of ["BREAKFAST", "LUNCH", "AFTERNOON_SNACK", "LATE_SNACK"]) {
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
    if (!menu) throw new NotFoundException("Không tìm thấy thực đơn");

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
        userName: "Ban Giám Hiệu",
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
      .catch(() => { });

    return this.findOne(id);
  }

  async adjustDish(menuId: number, dto: AdjustDishDto) {
    const targetId = Number(
      dto.newDishId ?? dto.substituteDishId ?? dto.dishId,
    );
    if (!Number.isSafeInteger(targetId) || targetId <= 0) {
      throw new BadRequestException(
        "Vui lòng chọn một món ăn hợp lệ từ danh mục.",
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
        if (!menu) throw new NotFoundException("Không tìm thấy thực đơn");
        const target = await dishes.findOne({
          where: { id: targetId },
          lock: { mode: "pessimistic_read" },
        });
        if (!target)
          throw new NotFoundException(
            "Món thay thế không còn trong danh mục. Vui lòng tải lại và chọn món khác.",
          );
        if (target.status !== "ACTIVE")
          throw new BadRequestException(
            "Món thay thế đã tạm ngưng. Vui lòng chọn món khác.",
          );

        let version = await versions.findOne({
          where: { menuId },
          order: { versionNumber: "DESC" },
        });
        if (!version) {
          if (dto.menuDishId)
            throw new NotFoundException(
              "Ô món gốc không còn trong phiên bản thực đơn hiện tại.",
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
              "Ô món gốc không còn trong phiên bản thực đơn hiện tại. Vui lòng tải lại.",
            );
          }
          if (
            dto.oldDishId &&
            Number(original.dishId) !== Number(dto.oldDishId)
          ) {
            throw new BadRequestException(
              "Món gốc đã được thay đổi. Vui lòng tải lại thực đơn.",
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
            throw new BadRequestException("Bữa ăn không hợp lệ.");
          }
          const rawDay = Number(dto.dayOfWeek ?? 1);
          if (!Number.isInteger(rawDay) || rawDay < 1 || rawDay > 7)
            throw new BadRequestException("Ngày trong tuần không hợp lệ.");
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
                "Món gốc không còn trong bữa ăn đã chọn. Vui lòng tải lại.",
              );
          }
        }

        const notePrefix =
          dto.keepOriginalDish !== false &&
            typeof dto.specialDietNotes === "string" &&
            dto.specialDietNotes.includes("->")
            ? dto.specialDietNotes.split("->")[0].trim().toLowerCase()
            : null;

        const allInMeal =
          typeof menuDishes.find === "function"
            ? await menuDishes.find({
              where: { menuMealId: meal.id },
              order: { id: "ASC" },
            })
            : [];

        const isDietSubstitute =
          typeof dto.specialDietNotes === "string" &&
          (dto.specialDietNotes.includes("Loại 1") ||
            dto.specialDietNotes.includes("Loại 2") ||
            dto.specialDietNotes.includes("Loại 3") ||
            dto.specialDietNotes.includes("->"));

        const shouldKeepOriginal =
          dto.keepOriginalDish === true ||
          (dto.keepOriginalDish === undefined && isDietSubstitute);

        if (original && !shouldKeepOriginal) {
          let mainDish = original;
          const isOriginalDietSub = !!(original.specialDietNotes && (
            original.specialDietNotes.includes("Loại") || original.specialDietNotes.includes("->")
          ));
          if (isOriginalDietSub) {
            const rootDish = allInMeal.find(
              (item) => Number(item.id) !== Number(original.id) &&
                (!item.specialDietNotes || !item.specialDietNotes.includes("Loại"))
            );
            if (rootDish) {
              mainDish = rootDish;
            }
          }

          // THAY THẾ TRỰC TIẾP TẠI CHỖ MÓN GỐC CHO CẢ LỚP (TRÁNH TẠO 2 MÓN TRONG 1 Ô)
          mainDish.dishId = targetId;
          mainDish.dish = target;
          mainDish.portionSizeG =
            dto.portionSizeG ?? mainDish.portionSizeG ?? 100;
          if (
            !Number.isFinite(mainDish.portionSizeG) ||
            mainDish.portionSizeG <= 0
          ) {
            throw new BadRequestException("Khẩu phần phải lớn hơn 0.");
          }
          if (dto.specialDietNotes !== undefined) {
            mainDish.specialDietNotes = dto.specialDietNotes || null;
          } else {
            mainDish.specialDietNotes = null;
          }
          await menuDishes.save(mainDish);
          await menuDishes.update(mainDish.id, {
            dishId: targetId,
            portionSizeG: mainDish.portionSizeG,
            specialDietNotes: mainDish.specialDietNotes,
          });

          // DỌN DẸP SẠCH SẼ: Khi gán cho cả lớp, các suất riêng / món trùng trong ô này phải được xóa bỏ
          // Để ô đó chỉ còn đúng 1 món duy nhất cho cả lớp
          let duplicateOthers: MenuDish[] = [];
          if (meal.mealType === "BREAKFAST" || meal.mealType === "MORNING_SNACK" || meal.mealType === "LATE_SNACK") {
            // Bữa sáng hoặc bữa xế chỉ có đúng 1 món chính: Xóa tất cả các món khác trong ô (kể cả suất riêng)
            duplicateOthers = allInMeal.filter((item) => Number(item.id) !== Number(mainDish.id));
          } else {
            // Bữa trưa hoặc bữa phụ: Xóa các món trùng dishId hoặc các suất riêng liên kết với món này
            const origDish = await dishes.findOne({ where: { id: Number(original.dishId) } });
            const origNameLower = origDish?.name?.trim().toLowerCase();
            duplicateOthers = allInMeal.filter(
              (item) =>
                Number(item.id) !== Number(mainDish.id) &&
                (Number(item.dishId) === Number(targetId) ||
                  (origNameLower && item.specialDietNotes?.toLowerCase().includes(origNameLower)) ||
                  (isOriginalDietSub && Number(item.id) === Number(original.id))),
            );
          }
          if (duplicateOthers.length > 0) {
            await menuDishes.delete(duplicateOthers.map((d) => d.id));
          }

          return {
            success: true,
            menuDishId: String(mainDish.id),
            dishId: String(targetId),
            message: "Đã cập nhật món ăn trong thực đơn thành công",
          };
        }

        const matchingPrefixSubs = notePrefix
          ? allInMeal.filter(
            (item) =>
              Number(item.id) !== Number(original?.id) &&
              (item.specialDietNotes || "")
                .trim()
                .toLowerCase()
                .startsWith(notePrefix),
          )
          : [];

        const existingByTarget =
          allInMeal.find(
            (item) => Number(item.dishId) === Number(targetId),
          ) ||
          (await menuDishes.findOne({
            where: { menuMealId: meal.id, dishId: targetId },
          }));

        const existing =
          existingByTarget ||
          (matchingPrefixSubs.length > 0 ? matchingPrefixSubs[0] : null);

        const menuDish =
          existing ||
          menuDishes.create({
            menuMealId: meal.id,
            dishId: targetId,
            specialDietNotes: null,
          });
        menuDish.dishId = targetId;
        menuDish.dish = target;
        menuDish.portionSizeG =
          dto.portionSizeG ?? existing?.portionSizeG ?? 100;
        if (
          !Number.isFinite(menuDish.portionSizeG) ||
          menuDish.portionSizeG <= 0
        )
          throw new BadRequestException("Khẩu phần phải lớn hơn 0.");
        if (dto.specialDietNotes !== undefined)
          menuDish.specialDietNotes = dto.specialDietNotes || null;
        // Save first, then remove the original or replaced substitute rows within the same transaction.
        await menuDishes.save(menuDish);
        await menuDishes.update(menuDish.id, {
          dishId: targetId,
          portionSizeG: menuDish.portionSizeG,
          specialDietNotes: menuDish.specialDietNotes,
        });

        if (matchingPrefixSubs.length > 0) {
          const duplicateIds = matchingPrefixSubs
            .map((item) => Number(item.id))
            .filter((id) => id !== Number(menuDish.id));
          if (duplicateIds.length > 0) {
            await menuDishes.delete(duplicateIds);
          }
        }

        if (
          original &&
          dto.keepOriginalDish === false &&
          Number(original.id) !== Number(menuDish.id)
        ) {
          const origDish = await dishes.findOne({
            where: { id: Number(original.dishId) },
          });
          const origNameLower = origDish?.name?.trim().toLowerCase();
          const orphanSubIds = origNameLower
            ? allInMeal
              .filter(
                (item) =>
                  Number(item.id) !== Number(menuDish.id) &&
                  (item.specialDietNotes || "")
                    .toLowerCase()
                    .includes(`thay cho: ${origNameLower}`),
              )
              .map((item) => Number(item.id))
            : [];
          await menuDishes.delete({ id: original.id, menuMealId: meal.id });
          if (orphanSubIds.length > 0) {
            await menuDishes.delete(orphanSubIds);
          }
        }
        return {
          success: true,
          menuDishId: String(menuDish.id),
          dishId: String(targetId),
          message: "Đã cập nhật món ăn trong thực đơn thành công",
        };
      });
    } catch (error) {
      if (
        error.code === "23503" &&
        error.constraint === "menu_dishes_dish_id_fkey"
      ) {
        throw new BadRequestException(
          "Danh mục món ăn đã thay đổi. Vui lòng tải lại thực đơn và chọn món khác.",
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
      throw new NotFoundException("Không tìm thấy thực đơn để gửi duyệt");

    // 1. Kiểm tra trạng thái thực đơn hợp lệ (DRAFT, REJECTED, PENDING, SUBMITTED_FOR_REVIEW)
    const allowedStatuses = [
      "DRAFT",
      "REJECTED",
      "PENDING",
      "SUBMITTED_FOR_REVIEW",
    ];
    if (!allowedStatuses.includes(menu.status)) {
      throw new BadRequestException(
        `Thực đơn đang ở trạng thái "${menu.status}", không thể gửi duyệt lại.`,
      );
    }

    // 2. Kiểm tra bản cam kết trách nhiệm chuyên môn (Nutritionist Commitment)
    if (dto && dto.commitmentSigned === false) {
      throw new BadRequestException(
        "Chuyên viên Dinh dưỡng bắt buộc phải xác nhận ký số cam kết trách nhiệm chuyên môn",
      );
    }

    // 3. Kiểm tra giải trình vượt ngưỡng nếu có cảnh báo (Override Justification)
    const hasWarnings =
      Array.isArray(dto?.violationsSnapshot) &&
      dto.violationsSnapshot.length > 0;
    if (hasWarnings) {
      const justification = dto?.overrideJustification?.trim();
      if (!justification || justification.length < 10) {
        throw new BadRequestException(
          "Thực đơn có cảnh báo vượt ngưỡng quy tắc dinh dưỡng / lặp món. Chuyên viên Dinh dưỡng bắt buộc phải nhập giải trình chuyên môn cụ thể (tối thiểu 10 ký tự).",
        );
      }
    }

    // 4. Lưu thông tin nộp duyệt vào Menu entity
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
      "Cam kết thực đơn tuân thủ định mức Thông tư 28/2016/TT-BGDĐT và an toàn thực phẩm Quyết định 1246/QĐ-BYT";
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

    // 5. Ghi vết kiểm toán trực tiếp vào bảng audit_logs của PostgreSQL
    try {
      await this.auditLogsService?.logAction({
        tenantId: submitter?.tenantId || 1,
        userId: submitterId,
        userName:
          submitter?.fullName || submitter?.name || "Chuyên viên Dinh dưỡng",
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
        `[MenusService] Ghi audit log submit thất bại: ${auditErr.message}`,
      );
    }

    return this.findOne(id);
  }

  @SerializedWrite('menu-workflow', 'menuRepo')
  async approveMenu(id: number, approverId: number, notes?: string) {
    const menu = await this.menuRepo.findOne({ where: { id } });
    if (!menu) throw new NotFoundException("Không tìm thấy thực đơn");

    // Chỉ thực đơn đang PENDING hoặc SUBMITTED_FOR_REVIEW mới được phê duyệt
    if (menu.status !== "PENDING" && menu.status !== "SUBMITTED_FOR_REVIEW") {
      throw new BadRequestException(
        `Chỉ thực đơn đang "Chờ BGH duyệt" mới có thể phê duyệt. Trạng thái hiện tại: ${menu.status}`,
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
        userName: "Ban Giám Hiệu",
        userRole: "PRINCIPAL",
        action: "APPROVE_MENU",
        targetEntity: "MENU",
        targetId: String(id),
        ipAddress: "127.0.0.1",
        details: {
          menuId: id,
          title: menu.title,
          note: notes || "Phê duyệt thực đơn tuần đạt chuẩn",
          approvedAt: menu.approvedAt,
        },
      })
      .catch(() => { });

    return this.findOne(id);
  }

  async rejectMenu(id: number, approverId: number, reason: string) {
    const menu = await this.menuRepo.findOne({ where: { id } });
    if (!menu) throw new NotFoundException("Không tìm thấy thực đơn");

    // Chỉ thực đơn đang PENDING hoặc SUBMITTED_FOR_REVIEW mới được từ chối
    if (menu.status !== "PENDING" && menu.status !== "SUBMITTED_FOR_REVIEW") {
      throw new BadRequestException(
        `Chỉ thực đơn đang "Chờ BGH duyệt" mới có thể từ chối. Trạng thái hiện tại: ${menu.status}`,
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
        userName: "Ban Giám Hiệu",
        userRole: "PRINCIPAL",
        action: "REJECT_MENU",
        targetEntity: "MENU",
        targetId: String(id),
        ipAddress: "127.0.0.1",
        details: { menuId: id, reason, status: "REJECTED" },
      })
      .catch(() => { });
    return this.findOne(id);
  }

  @SerializedWrite('menu-workflow', 'menuRepo')
  async publishMenu(id: number) {
    const menu = await this.menuRepo.findOne({ where: { id } });
    if (!menu) throw new NotFoundException("Không tìm thấy thực đơn");

    // Chỉ thực đơn đã APPROVED mới được công bố toàn trường
    if (menu.status !== "APPROVED") {
      throw new BadRequestException(
        `Chỉ thực đơn "Đã duyệt" mới có thể công bố toàn trường. Trạng thái hiện tại: ${menu.status}`,
      );
    }

    menu.status = "PUBLISHED";
    menu.publishedAt = new Date();
    await this.menuRepo.save(menu);

    this.auditLogsService
      ?.logAction({
        tenantId: 1,
        userId: 1,
        userName: "Ban Giám Hiệu",
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
      .catch(() => { });

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
      changeNote: `Phiên bản v${nextVersion}.0`,
    });
    await this.versionRepo.save(newVersion);
    return this.findOne(id);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // AUTO-GENERATE: Constrained Nutrition-Aware Menu Generation
  // Thông tư 28/2016/TT-BGDĐT compliant
  // ════════════════════════════════════════════════════════════════════════════

  async autoGenerate(dto: AutoGenerateMenuDto, userId?: number) {
    const rawAge = dto.ageGroup || dto.targetAgeGroup || "MAU_GIAO";
    const ageGroup =
      rawAge === "TODDLER_18_36M"
        ? "NHA_TRE"
        : rawAge === "KINDERGARTEN_3_5Y"
          ? "MAU_GIAO"
          : rawAge;
    const weekStartDate =
      dto.weekStartDate ||
      dto.startDate ||
      new Date().toISOString().split("T")[0];
    const daysCount = dto.daysCount || 5;

    let weekEndDate = dto.endDate;
    if (!weekEndDate) {
      const d = new Date(weekStartDate);
      d.setDate(d.getDate() + (daysCount === 6 ? 5 : 4));
      weekEndDate = d.toISOString().split("T")[0];
    }
    this.validateMenuDateRange(weekStartDate, weekEndDate);


    const title =
      dto.title ||
      `Thực đơn Bán trú Tuần ${dto.cycleWeekNumber || 1} (${ageGroup === "MAU_GIAO" ? "Mẫu giáo" : "Nhà trẻ"})`;

    // ── Step 0: Kiểm tra cấu hình vận hành trường học (operationalSettings) ────
    const schoolProfile: any = await readState(
      this.menuRepo.manager,
      "school-profile:1",
      {},
    );
    const configuredMealTimes: string[] =
      schoolProfile?.operationalSettings?.mealTimes || [
        "BREAKFAST",
        "LUNCH",
        "AFTERNOON_SNACK",
        "LATE_SNACK",
      ];
    const standardWeeklyCycleLength: number =
      Number(schoolProfile?.operationalSettings?.standardWeeklyCycleLength) || 2;
    const schoolHasBreakfast = configuredMealTimes.includes("BREAKFAST");
    const schoolHasLunch = configuredMealTimes.includes("LUNCH");
    const schoolHasAfternoonSnack = configuredMealTimes.includes("AFTERNOON_SNACK");

    // ── Step 1: Load nutritional standards from DB ──────────────────────────
    const standard = await this.standardRepo.findOne({
      where: { ageGroup, mealScope: "DAYBOARDING", status: "ACTIVE" },
      order: { id: "DESC" },
    });

    if (!standard)
      throw new BadRequestException(
        "Chưa cấu hình tiêu chuẩn dinh dưỡng đang áp dụng cho nhóm tuổi này.",
      );
    const minKcal = Number(standard.minEnergyKcal),
      maxKcal = Number(standard.maxEnergyKcal),
      minProtPct = Number(standard.minProteinPct),
      maxProtPct = Number(standard.maxProteinPct),
      minFatPct = Number(standard.minFatPct),
      maxFatPct = Number(standard.maxFatPct),
      minCarbPct = Number(standard.minCarbPct),
      maxCarbPct = Number(standard.maxCarbPct);
    if (
      ![
        minKcal,
        maxKcal,
        minProtPct,
        maxProtPct,
        minFatPct,
        maxFatPct,
        minCarbPct,
        maxCarbPct,
      ].every(Number.isFinite) ||
      minKcal <= 0 ||
      maxKcal < minKcal
    )
      throw new BadRequestException(
        "Tiêu chuẩn dinh dưỡng chưa có đủ chỉ tiêu hợp lệ.",
      );

    // Lấy tỷ lệ năng lượng theo từng bữa mới nhất. Khi Ban giám hiệu chỉnh
    // bảng phân bổ, bộ sinh menu cũng phải dùng đúng dải mới và tự động tắt
    // các bữa được đặt về 0 - 0%.
    const mealEnergyRanges = new Map<string, { min: number; max: number }>();
    if (this.mealDistributionRepo) {
      const distributions = await this.mealDistributionRepo.find({
        where: { ageGroup, isActive: true },
        order: { displayOrder: "ASC", id: "DESC" },
      });
      const schoolSpecific = distributions.filter((r) => Number(r.schoolId) === 1);
      const effectiveDistributions = schoolSpecific.length > 0 ? schoolSpecific : distributions;
      for (const row of effectiveDistributions) {
        if (!mealEnergyRanges.has(row.mealType)) {
          mealEnergyRanges.set(row.mealType, {
            min: Number(row.energyPctMin),
            max: Number(row.energyPctMax),
          });
        }
      }
    }

    const hasDbMealDistributions = mealEnergyRanges.size > 0;
    const configuredMealRanges = {
      BREAKFAST: mealEnergyRanges.get("BREAKFAST") ?? { min: 5, max: 10 },
      LUNCH: mealEnergyRanges.get("LUNCH") ?? { min: 30, max: 35 },
      AFTERNOON_SNACK: mealEnergyRanges.get("AFTERNOON_SNACK") ?? { min: 10, max: 15 },
      LATE_SNACK: mealEnergyRanges.get("LATE_SNACK") ?? (hasDbMealDistributions ? { min: 0, max: 0 } : { min: 5, max: 10 }),
    };

    const effectiveIncludeBreakfast =
      schoolHasBreakfast &&
      dto.includeBreakfast !== false &&
      (!hasDbMealDistributions || configuredMealRanges.BREAKFAST.max > 0);
    const effectiveIncludeLunch =
      schoolHasLunch &&
      dto.includeLunch !== false &&
      (!hasDbMealDistributions || configuredMealRanges.LUNCH.max > 0);
    const effectiveIncludeAfternoonDrink =
      schoolHasAfternoonSnack &&
      dto.includeAfternoonSnack !== false &&
      (!hasDbMealDistributions || configuredMealRanges.AFTERNOON_SNACK.max > 0);
    const effectiveIncludeLateSnack =
      (schoolHasAfternoonSnack || configuredMealTimes.includes("LATE_SNACK")) &&
      dto.includeAfternoonSnack !== false &&
      (!hasDbMealDistributions ||
        (mealEnergyRanges.has("LATE_SNACK")
          ? configuredMealRanges.LATE_SNACK.max > 0
          : configuredMealRanges.AFTERNOON_SNACK.max > 0));
    const effectiveIncludeAfternoonSnack =
      effectiveIncludeAfternoonDrink || effectiveIncludeLateSnack;

    // Định mức năng lượng cả ngày để quy đổi % từng bữa ra Kcal (khớp 100% với MealDistributionsService)
    let fullDayMinKcal = ageGroup === "NHA_TRE" ? 930 : 1230;
    let fullDayMaxKcal = ageGroup === "NHA_TRE" ? 1000 : 1320;
    if (this.intakeStandardRepo) {
      try {
        const allDayIntake = await this.intakeStandardRepo.findOne({
          where: { ageGroup, mealScope: "ALL_DAY", isActive: true },
          order: { id: "ASC" },
        });
        if (allDayIntake && Number(allDayIntake.energyKcalMin) > 0 && Number(allDayIntake.energyKcalMax) >= Number(allDayIntake.energyKcalMin)) {
          fullDayMinKcal = Number(allDayIntake.energyKcalMin);
          fullDayMaxKcal = Number(allDayIntake.energyKcalMax);
        }
      } catch {
        // Giữ giá trị tham chiếu mặc định
      }
    }

    let effectiveMinKcal: number;
    let effectiveMaxKcal: number;

    if (hasDbMealDistributions) {
      const totalPctMin =
        (effectiveIncludeBreakfast ? configuredMealRanges.BREAKFAST.min : 0) +
        (effectiveIncludeLunch ? configuredMealRanges.LUNCH.min : 0) +
        (effectiveIncludeAfternoonDrink ? configuredMealRanges.AFTERNOON_SNACK.min : 0) +
        (effectiveIncludeLateSnack && mealEnergyRanges.has("LATE_SNACK") ? configuredMealRanges.LATE_SNACK.min : 0);
      const totalPctMax =
        (effectiveIncludeBreakfast ? configuredMealRanges.BREAKFAST.max : 0) +
        (effectiveIncludeLunch ? configuredMealRanges.LUNCH.max : 0) +
        (effectiveIncludeAfternoonDrink ? configuredMealRanges.AFTERNOON_SNACK.max : 0) +
        (effectiveIncludeLateSnack && mealEnergyRanges.has("LATE_SNACK") ? configuredMealRanges.LATE_SNACK.max : 0);

      effectiveMinKcal = Math.max(1, Math.round((fullDayMinKcal * totalPctMin) / 100));
      effectiveMaxKcal = Math.max(effectiveMinKcal, Math.round((fullDayMaxKcal * totalPctMax) / 100));
    } else {
      // Dự phòng khi chưa cấu hình bảng meal_energy_distributions (hoặc trong unit test)
      let activeWeight = 0;
      if (effectiveIncludeBreakfast) activeWeight += 0.15;
      if (effectiveIncludeLunch) activeWeight += 0.60;
      if (effectiveIncludeAfternoonSnack) activeWeight += 0.25;
      if (activeWeight === 0) activeWeight = 1.0;

      const baseConfiguredWeight =
        (schoolHasBreakfast ? 0.15 : 0) +
        (schoolHasLunch ? 0.60 : 0) +
        (schoolHasAfternoonSnack ? 0.25 : 0) || 1.0;
      const targetScale = Math.min(1.0, activeWeight / baseConfiguredWeight);

      effectiveMinKcal = Math.round(minKcal * targetScale);
      effectiveMaxKcal = Math.round(maxKcal * targetScale);
    }

    this.logger.log(
      `⚙️ Cấu hình bữa ăn trường: [${configuredMealTimes.join(", ")}]. Chu kỳ: ${standardWeeklyCycleLength} tuần. ` +
      `Bữa sáng: ${effectiveIncludeBreakfast}, Bữa trưa: ${effectiveIncludeLunch}, Buổi phụ (14:30): ${effectiveIncludeAfternoonDrink}, Buổi chiều xế (17:00): ${effectiveIncludeLateSnack}`,
    );
    this.logger.log(
      `📋 Chuẩn dinh dưỡng ${ageGroup} DAYBOARDING: ${minKcal}–${maxKcal} Kcal (Hiệu dụng theo phân bổ bữa: ${effectiveMinKcal}–${effectiveMaxKcal} Kcal), P:${minProtPct}–${maxProtPct}%, L:${minFatPct}–${maxFatPct}%, G:${minCarbPct}–${maxCarbPct}%`,
    );

    // ── Step 2: Load all dishes with nutrition data ─────────────────────────
    const allDishes = await this.dishRepo.find({
      relations: ["category", "nutrition"],
      where: { status: "ACTIVE" },
      order: { name: "ASC" },
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
      if (!hasPlanningNutrition(d) || Number(d.nutrition.energyKcal) <= 0)
        continue;
      const code = d.category?.code || "MAIN";
      const entry: DishWithNutrition = {
        id: d.id,
        name: d.name,
        categoryCode: code,
        categoryName: d.category?.name || "Món ăn",
        rotationKey: d.sourceMetadata?.drinkFamily || String(d.id),
        nutritionReference: !hasVerifiedNutrition(d),
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
      throw new BadRequestException(
        "Chưa có món ăn có công thức định lượng được xác nhận để tự động lập thực đơn.",
      );
    }

    const isPlainRice = (name: string) => {
      const lower = name.toLowerCase();
      return (
        lower.includes("cơm trắng") ||
        (lower.includes("cơm") &&
          !lower.includes("chiên") &&
          !lower.includes("sườn") &&
          !lower.includes("tấm") &&
          !lower.includes("thịt") &&
          !lower.includes("hải sản") &&
          !lower.includes("dương châu"))
      );
    };
    const plainRicePool = dishPool.RICE.filter((dish) => isPlainRice(dish.name));
    const friedRicePool = dishPool.RICE.filter((dish) => !isPlainRice(dish.name));
    for (let index = 0; index < daysCount; index++) {
      if (isFriday(weekStartDate, index)) {
        if (!friedRicePool.length)
          throw new BadRequestException(
            "Chưa có cơm chiên đủ công thức và dinh dưỡng cho bữa trưa thứ Sáu.",
          );
      } else if (!plainRicePool.length || !dishPool.MAIN.length) {
        throw new BadRequestException(
          "Chưa có cơm thường hoặc món mặn đủ công thức và dinh dưỡng cho bữa trưa.",
        );
      }
    }

    // ── Step 3: Quét chu kỳ theo cấu hình trường (standardWeeklyCycleLength) qua menu_cycles & lịch sử thực đơn ────
    const activeCycle = await this.cycleRepo.findOne({
      where: { ageGroup, status: "ACTIVE" },
      order: { id: "DESC" },
    });

    const cycleDays = standardWeeklyCycleLength * 7;
    const cycleStartDate = new Date(weekStartDate);
    cycleStartDate.setDate(cycleStartDate.getDate() - cycleDays);
    const cycleStartDateStr = cycleStartDate.toISOString().split("T")[0];

    // Quét tần suất xuất hiện của các món trong chu kỳ xoay vòng qua
    const past4WeeksDishesRaw = await this.menuDishRepo
      .createQueryBuilder("md")
      .innerJoin("md.menuMeal", "mm")
      .innerJoin("mm.menuDay", "mday")
      .innerJoin("mday.menuVersion", "mv")
      .innerJoin("mv.menu", "m")
      .innerJoin("md.dish", "d")
      .innerJoin("d.category", "c")
      .select("md.dishId", "dishId")
      .addSelect("d.name", "dishName")
      .addSelect("c.code", "categoryCode")
      .addSelect("COUNT(md.id)", "occurrenceCount")
      .where("m.ageGroup = :ageGroup", { ageGroup })
      .andWhere("m.weekStartDate >= :cycleStartDateStr", { cycleStartDateStr })
      .andWhere("m.weekStartDate < :weekStartDate", { weekStartDate })
      .groupBy("md.dishId")
      .addGroupBy("d.name")
      .addGroupBy("c.code")
      .getRawMany();

    const dynamicLimits = new Map<string, number>();
    if (this.freqRuleRepo) {
      try {
        const customRules = await this.freqRuleRepo.find({
          where: [
            {
              targetType: "DISH_CATEGORY",
              ageGroup,
              isActive: true,
              periodType: "PER_CYCLE_4_WEEKS",
            },
            {
              targetType: "DISH_CATEGORY",
              ageGroup: "ALL",
              isActive: true,
              periodType: "PER_CYCLE_4_WEEKS",
            },
          ],
        });
        for (const cr of customRules) {
          if (cr.targetCode && cr.maxOccurrences > 0) {
            dynamicLimits.set(cr.targetCode, cr.maxOccurrences);
          }
        }
      } catch (err: any) {
        this.logger.warn(
          "Could not load dynamic frequency rules: " + err.message,
        );
      }
    }

    const cycleDishCounts = new Map<
      number,
      { count: number; name: string; categoryCode: string }
    >();
    const cycleExclusionDishIds = new Set<number>();

    for (const row of past4WeeksDishesRaw) {
      const dishId = Number(row.dishId);
      const count = Number(row.occurrenceCount) || 0;
      const code = row.categoryCode || "MAIN";
      cycleDishCounts.set(dishId, {
        count,
        name: row.dishName,
        categoryCode: code,
      });

      const maxLimit = this.getMaxCycleLimit(code, dynamicLimits);
      if (count >= maxLimit) {
        cycleExclusionDishIds.add(dishId);
      }
    }

    // Quét các món trong thời gian cách ly (chống ngán theo chu kỳ trường)
    const excludeDays =
      Number(dto.excludePreviousDays) || standardWeeklyCycleLength * 7;
    const recentStartDate = new Date(weekStartDate);
    recentStartDate.setDate(recentStartDate.getDate() - excludeDays);
    const recentStartDateStr = recentStartDate.toISOString().split("T")[0];

    const recentDishIds = new Set<number>();
    const past14DaysRaw = await this.menuDishRepo
      .createQueryBuilder("md")
      .innerJoin("md.menuMeal", "mm")
      .innerJoin("mm.menuDay", "mday")
      .innerJoin("mday.menuVersion", "mv")
      .innerJoin("mv.menu", "m")
      .select("DISTINCT md.dishId", "dishId")
      .where("m.ageGroup = :ageGroup", { ageGroup })
      .andWhere("m.weekStartDate >= :recentStartDateStr", { recentStartDateStr })
      .andWhere("m.weekStartDate < :weekStartDate", { weekStartDate })
      .getRawMany();

    for (const r of past14DaysRaw) {
      recentDishIds.add(Number(r.dishId));
    }

    // ── Step 4: Sinh thực đơn từng ngày đảm bảo Kcal & P:L:G ──────────────────
    const dayNames = [
      "Thứ Hai",
      "Thứ Ba",
      "Thứ Tư",
      "Thứ Năm",
      "Thứ Sáu",
      "Thứ Bảy",
    ];
    const usedDishIdsThisWeek = new Set<number>();
    const drinkUseCounts = new Map<string, number>();
    const drinksById = new Map(dishPool.DRINK.map((dish) => [dish.id, dish]));
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
      const fridayLunch = isFriday(weekStartDate, dayIndex);

      let bestPlan: DayMealPlan | null = null;
      let bestScore = -Infinity;

      for (let attempt = 0; attempt < 150; attempt++) {
        const dayDishes: DayDishSlot[] = [];
        let breakfastDish: any = null;

        // 0. Buổi sáng (BREAKFAST - 09:00): Bắt buộc MÓN NƯỚC (bún / phở / miến / cháo / súp / bánh canh / nui nước) ~120-180 Kcal
        const isLiquidDish = (name: string) => {
          const lower = name.toLowerCase();
          return (
            lower.includes("bún") ||
            lower.includes("phở") ||
            lower.includes("cháo") ||
            lower.includes("miến") ||
            lower.includes("hủ tiếu") ||
            lower.includes("bánh canh") ||
            lower.includes("nui") ||
            lower.includes("súp") ||
            lower.includes("mì") ||
            lower.includes("hoành thánh")
          ) && !lower.includes("khô") && !lower.includes("xào") && !lower.includes("bánh bao") && !lower.includes("bánh bông lan");
        };

        if (effectiveIncludeBreakfast) {
          const breakfastPool = shuffleArray([
            ...dishPool.SNACK_AFTERNOON.filter((d) => isLiquidDish(d.name)),
            ...dishPool.SNACK_MORNING.filter((d) => isLiquidDish(d.name)),
          ]);
          const candidateBreakfast = breakfastPool.filter(
            (d) => d.energyKcal >= 95 && (d.fatG || 0) >= 1.8,
          );
          const effectiveBreakfastPool =
            attempt < 80 && candidateBreakfast.length > 0
              ? candidateBreakfast
              : breakfastPool.filter((d) => d.energyKcal >= 95);
          breakfastDish = this.pickDish(
            effectiveBreakfastPool,
            usedDishIdsThisWeek,
            previousDayDishIds,
            recentDishIds,
            cycleExclusionDishIds,
            attempt > 40,
          );
          if (breakfastDish) {
            dayDishes.push({
              dishId: String(breakfastDish.id),
              dishName: breakfastDish.name,
              dishType: breakfastDish.categoryCode,
              mealTime: "BREAKFAST",
              servingOrder: 1,
              portionSizeG: breakfastDish.portionSizeG,
              plannedCalories: breakfastDish.energyKcal,
              proteinG: breakfastDish.proteinG,
              fatG: breakfastDish.fatG,
              carbG: breakfastDish.carbG,
            });
          }
        }

        // 2. Bữa trưa chính (LUNCH): Cơm + Món chính + Canh + Tráng miệng
        let mainDish: any = null;
        let dessertDish: any = null;
        if (effectiveIncludeLunch) {
          // Cơm (RICE) ~172-269 Kcal (cho phép lặp lại vì số lượng món tinh bột hạn chế)
          const riceDish = this.pickDish(
            shuffleArray(fridayLunch ? friedRicePool : plainRicePool),
            usedDishIdsThisWeek,
            previousDayDishIds,
            recentDishIds,
            cycleExclusionDishIds,
            attempt > 20,
          );
          if (riceDish) {
            // Định lượng cơm mầm non chuẩn: 110g (ngày thường) hoặc 120g (thứ 6 cơm chiên)
            const riceServing = fridayLunch ? 120 : 110;
            const riceRatio = riceServing / (riceDish.portionSizeG || 100);
            dayDishes.push({
              dishId: String(riceDish.id),
              dishName: riceDish.name,
              dishType: "RICE",
              mealTime: "LUNCH",
              servingOrder: 2,
              portionSizeG: riceServing,
              plannedCalories: Math.round(riceDish.energyKcal * riceRatio * 10) / 10,
              proteinG: Math.round(riceDish.proteinG * riceRatio * 10) / 10,
              fatG: Math.round(riceDish.fatG * riceRatio * 10) / 10,
              carbG: Math.round(riceDish.carbG * riceRatio * 10) / 10,
            });
          }

          // Món chính (MAIN) ~60-144 Kcal (tuyệt đối không lặp lại trong tuần & không vượt chu kỳ 4 tuần)
          // Ưu tiên các món có chất béo lành mạnh (món xào, chiên, rim, kho trứng... có fatG >= 4.8g và tỷ lệ béo/đạm tốt) để đảm bảo L: 25–35%
          // Thứ Sáu: dùng khẩu phần nhẹ 40g phối hợp cùng cơm chiên để vừa bổ sung chất béo tốt mà không bị dư đạm
          const tier1Mains = dishPool.MAIN.filter(
            (d) => (d.fatG || 0) >= 5.5 && ((d.fatG || 0) / Math.max(0.1, d.proteinG || 0)) >= 0.60,
          );
          const tier2Mains = dishPool.MAIN.filter(
            (d) => (d.fatG || 0) >= 4.8,
          );
          const effectiveMainPool =
            tier1Mains.length >= 5
              ? tier1Mains
              : tier2Mains.length > 0
                ? tier2Mains
                : dishPool.MAIN;
          const mainServing = fridayLunch ? 40 : 95;
          mainDish = this.pickDish(
            shuffleArray(effectiveMainPool),
            usedDishIdsThisWeek,
            previousDayDishIds,
            recentDishIds,
            cycleExclusionDishIds,
            attempt > 35,
          );
          if (mainDish) {
            const mainRatio = mainServing / (mainDish.portionSizeG || 100);
            dayDishes.push({
              dishId: String(mainDish.id),
              dishName: mainDish.name,
              dishType: "MAIN",
              mealTime: "LUNCH",
              servingOrder: 3,
              portionSizeG: mainServing,
              plannedCalories: Math.round(mainDish.energyKcal * mainRatio * 10) / 10,
              proteinG: Math.round(mainDish.proteinG * mainRatio * 10) / 10,
              fatG: Math.round(mainDish.fatG * mainRatio * 10) / 10,
              carbG: Math.round(mainDish.carbG * mainRatio * 10) / 10,
            });
          }

          // Canh súp (SOUP) ~25-105 Kcal
          const soupDish = this.pickDish(
            shuffleArray(dishPool.SOUP),
            usedDishIdsThisWeek,
            previousDayDishIds,
            recentDishIds,
            cycleExclusionDishIds,
            attempt > 30,
          );
          if (soupDish) {
            dayDishes.push({
              dishId: String(soupDish.id),
              dishName: soupDish.name,
              dishType: "SOUP",
              mealTime: "LUNCH",
              servingOrder: 4,
              portionSizeG: soupDish.portionSizeG,
              plannedCalories: soupDish.energyKcal,
              proteinG: soupDish.proteinG,
              fatG: soupDish.fatG,
              carbG: soupDish.carbG,
            });
          }

          // Tráng miệng (DESSERT) ~20-50 Kcal: Ưu tiên trái cây tươi nhẹ bụng sau bữa trưa chính
          const isFruitDish = (name: string) => {
            const lower = name.toLowerCase();
            return (
              lower.includes("chuối") ||
              lower.includes("quýt") ||
              lower.includes("dưa") ||
              lower.includes("nho") ||
              lower.includes("táo") ||
              lower.includes("đu đủ") ||
              lower.includes("thanh long") ||
              lower.includes("hồng giòn") ||
              lower.includes("hồng xiêm") ||
              lower.includes("lê đường")
            );
          };
          const fruitDessertPool = dishPool.DESSERT.filter((d) => isFruitDish(d.name));
          dessertDish = this.pickDish(
            shuffleArray(fruitDessertPool.length ? fruitDessertPool : dishPool.DESSERT),
            usedDishIdsThisWeek,
            previousDayDishIds,
            recentDishIds,
            cycleExclusionDishIds,
            attempt > 30,
          );
          if (dessertDish) {
            const dessertServing = Math.min(60, dessertDish.portionSizeG || 50);
            const dessertRatio = dessertServing / (dessertDish.portionSizeG || 100);
            dayDishes.push({
              dishId: String(dessertDish.id),
              dishName: dessertDish.name,
              dishType: "DESSERT",
              mealTime: "LUNCH",
              servingOrder: 5,
              portionSizeG: dessertServing,
              plannedCalories: Math.round(dessertDish.energyKcal * dessertRatio * 10) / 10,
              proteinG: Math.round(dessertDish.proteinG * dessertRatio * 10) / 10,
              fatG: Math.round(dessertDish.fatG * dessertRatio * 10) / 10,
              carbG: Math.round(dessertDish.carbG * dessertRatio * 10) / 10,
            });
          }
        }

        // 3. Phụ chiều / Xế:
        // - Buổi chiều xế (17:00 - LATE_SNACK): 1 món ăn xế MÓN NƯỚC (cháo, súp, bún, miến, phở, hủ tiếu, bánh canh, nui nước, mì) ~120-170 Kcal
        // - Buổi phụ (14:30 - AFTERNOON_SNACK): Bánh ngọt / Flan / Su kem, Trái cây tươi, và Sữa / Yaourt / Nước ép ~75-120 Kcal
        if (effectiveIncludeLateSnack) {
          // Món xế (LATE_SNACK) ~110-168 Kcal: Bắt buộc MÓN NƯỚC (cháo, súp, bún, phở, miến, hủ tiếu, bánh canh, nui, mì)
          // Tuyệt đối KHÔNG chọn bánh bao, bánh bông lan hay món khô.
          const isLiquidSnackDish = (name: string) => {
            const lower = name.toLowerCase();
            return (
              lower.includes("cháo") ||
              lower.includes("súp") ||
              lower.includes("bún") ||
              lower.includes("phở") ||
              lower.includes("miến") ||
              lower.includes("hủ tiếu") ||
              lower.includes("bánh canh") ||
              lower.includes("nui") ||
              lower.includes("mì") ||
              lower.includes("hoành thánh")
            ) && !lower.includes("khô") && !lower.includes("xào") && !lower.includes("bánh bao") && !lower.includes("bánh bông lan");
          };

          const afternoonSnackPool = shuffleArray(
            dishPool.SNACK_AFTERNOON.filter(
              (dish) => dish.id !== breakfastDish?.id && isLiquidSnackDish(dish.name),
            ),
          );
          const candidateSnack = afternoonSnackPool.filter(
            (d) => d.energyKcal >= 105 && (d.fatG || 0) >= 2.2,
          );
          const effectiveSnackPool =
            attempt < 80 && candidateSnack.length > 0
              ? candidateSnack
              : afternoonSnackPool.filter((d) => d.energyKcal >= 105);
          const afternoonDish = this.pickDish(
            effectiveSnackPool,
            usedDishIdsThisWeek,
            previousDayDishIds,
            recentDishIds,
            cycleExclusionDishIds,
            attempt > 40,
          );
          if (
            afternoonDish &&
            (!breakfastDish || afternoonDish.id !== breakfastDish.id)
          ) {
            dayDishes.push({
              dishId: String(afternoonDish.id),
              dishName: afternoonDish.name,
              dishType: "SNACK_AFTERNOON",
              mealTime: "LATE_SNACK",
              servingOrder: 8,
              portionSizeG: afternoonDish.portionSizeG,
              plannedCalories: afternoonDish.energyKcal,
              proteinG: afternoonDish.proteinG,
              fatG: afternoonDish.fatG,
              carbG: afternoonDish.carbG,
            });
          }
        }

        if (effectiveIncludeAfternoonDrink) {
          // Buổi phụ (14:30 - AFTERNOON_SNACK):
          // COMBO ĐẦY ĐỦ: Bánh / Trái cây + Sữa / Thức uống dinh dưỡng để bổ sung đủ nước cho trẻ
          const isCakeDish = (name: string) => {
            const lower = name.toLowerCase();
            return (
              (lower.includes("bánh flan") ||
                lower.includes("bánh su kem") ||
                lower.includes("bánh bông lan") ||
                lower.includes("bánh ngọt") ||
                lower.includes("rau câu")) &&
              !lower.includes("bao") &&
              !lower.includes("thịt") &&
              !lower.includes("chà bông") &&
              !lower.includes("mặn")
            );
          };

          const isFruitDish = (name: string) => {
            const lower = name.toLowerCase();
            return (
              lower.includes("chuối") ||
              lower.includes("quýt") ||
              lower.includes("dưa") ||
              lower.includes("nho") ||
              lower.includes("táo") ||
              lower.includes("đu đủ") ||
              lower.includes("thanh long") ||
              lower.includes("hồng giòn") ||
              lower.includes("hồng xiêm") ||
              lower.includes("lê đường")
            );
          };

          // Nhóm Bánh & Trái cây (Món ăn nhẹ)
          const cakePool = [
            ...dishPool.DESSERT.filter((d) => isCakeDish(d.name)),
            ...dishPool.SNACK_AFTERNOON.filter((d) => isCakeDish(d.name)),
          ];
          const fruitPool = dishPool.DESSERT.filter(
            (d) => isFruitDish(d.name) && (!dessertDish || (d.id !== dessertDish.id && d.name !== dessertDish.name)),
          );
          // Nhóm Thức uống dinh dưỡng (Nước uống, sữa, yaourt bổ sung nước)
          const drinkPool = dishPool.DRINK.filter((d) => d.id !== breakfastDish?.id);

          // 1. CHỌN MÓN ĂN NHẸ (BÁNH HOẶC TRÁI CÂY) VÀ NƯỚC UỐNG / SỮA
          // Phối hợp thông minh: Nếu dùng Trái cây (ít béo) thì kết hợp với Sữa / Yaourt (giàu đạm, béo, canxi)
          // Nếu dùng Bánh ngọt (Flan, Su kem, Bông lan đã có béo) thì kết hợp với Nước ép / Sâm bí đao / Nha đam giải khát
          const isFruitDay = dayIndex === 1 || dayIndex === 3;
          const solidPool = isFruitDay
            ? (fruitPool.length ? fruitPool : cakePool)
            : (cakePool.length ? cakePool : fruitPool);

          const afternoonSolidDish = this.pickDish(
            shuffleArray(solidPool.length ? solidPool : [...cakePool, ...fruitPool]),
            usedDishIdsThisWeek,
            previousDayDishIds,
            recentDishIds,
            cycleExclusionDishIds,
            attempt > 30,
          );

          if (afternoonSolidDish) {
            // Định lượng bánh/trái cây vừa phải: ~35–60g, ~45–55 Kcal
            const solidServing = Math.max(30, Math.min(60, Math.round((afternoonSolidDish.portionSizeG || 100) * 0.5)));
            const solidFactor = solidServing / (afternoonSolidDish.portionSizeG || 100);
            dayDishes.push({
              dishId: String(afternoonSolidDish.id),
              dishName: afternoonSolidDish.name,
              dishType: afternoonSolidDish.categoryCode || "DESSERT",
              mealTime: "AFTERNOON_SNACK",
              servingOrder: 6,
              portionSizeG: solidServing,
              plannedCalories: Math.round(afternoonSolidDish.energyKcal * solidFactor * 10) / 10,
              proteinG: Math.round(afternoonSolidDish.proteinG * solidFactor * 10) / 10,
              fatG: Math.round(afternoonSolidDish.fatG * solidFactor * 10) / 10,
              carbG: Math.round(afternoonSolidDish.carbG * solidFactor * 10) / 10,
            });
          }

          // 2. CHỌN MÓN NƯỚC UỐNG / SỮA (BỔ SUNG NƯỚC UỐNG ĐẠT CHUẨN 800 - 1100 ML TẠI TRƯỜNG)
          const isSolidCake = afternoonSolidDish && isCakeDish(afternoonSolidDish.name);
          const dairyDrinkPool = drinkPool.filter(
            (d) => d.name.toLowerCase().includes("sữa") || d.name.toLowerCase().includes("yaourt"),
          );
          const refreshingDrinkPool = drinkPool.filter(
            (d) => !d.name.toLowerCase().includes("sữa") && !d.name.toLowerCase().includes("yaourt"),
          );
          const preferredDrinkPool = isSolidCake
            ? (refreshingDrinkPool.length ? refreshingDrinkPool : drinkPool)
            : (dairyDrinkPool.length ? dairyDrinkPool : drinkPool);

          const afternoonDrinkDish = this.pickDish(
            shuffleArray(attempt < 60 && preferredDrinkPool.length ? preferredDrinkPool : drinkPool),
            usedDishIdsThisWeek,
            previousDayDishIds,
            recentDishIds,
            cycleExclusionDishIds,
            attempt > 30,
          );

          if (afternoonDrinkDish && (!breakfastDish || afternoonDrinkDish.id !== breakfastDish.id)) {
            // Định lượng nước uống ~100–120ml (g), ~45–55 Kcal
            const drinkServing = Math.max(100, Math.min(120, afternoonDrinkDish.portionSizeG || 100));
            const drinkFactor = drinkServing / (afternoonDrinkDish.portionSizeG || 100);
            dayDishes.push({
              dishId: String(afternoonDrinkDish.id),
              dishName: afternoonDrinkDish.name,
              dishType: "DRINK",
              mealTime: "AFTERNOON_SNACK",
              servingOrder: 7,
              portionSizeG: drinkServing,
              plannedCalories: Math.round(afternoonDrinkDish.energyKcal * drinkFactor * 10) / 10,
              proteinG: Math.round(afternoonDrinkDish.proteinG * drinkFactor * 10) / 10,
              fatG: Math.round(afternoonDrinkDish.fatG * drinkFactor * 10) / 10,
              carbG: Math.round(afternoonDrinkDish.carbG * drinkFactor * 10) / 10,
            });
          }
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

        // Phân rã hàm lượng dinh dưỡng: Quy định 1 (không ăn xế) vs Quy định 2 (có ăn xế)
        const qd1Dishes = dayDishes.filter((dish) => dish.mealTime !== "LATE_SNACK");
        const qd1Cal = Math.round(qd1Dishes.reduce((sum, d) => sum + d.plannedCalories, 0) * 10) / 10;
        const qd1Prot = Math.round(qd1Dishes.reduce((sum, d) => sum + d.proteinG, 0) * 10) / 10;
        const qd1Fat = Math.round(qd1Dishes.reduce((sum, d) => sum + d.fatG, 0) * 10) / 10;
        const qd1Carb = Math.round(qd1Dishes.reduce((sum, d) => sum + d.carbG, 0) * 10) / 10;
        const qd1MacroSum = qd1Prot * 4 + qd1Fat * 9 + qd1Carb * 4 || 1;
        const qd1PPct = Math.round(((qd1Prot * 4) / qd1MacroSum) * 1000) / 10;
        const qd1FPct = Math.round(((qd1Fat * 9) / qd1MacroSum) * 1000) / 10;
        const qd1CPct = Math.round(((qd1Carb * 4) / qd1MacroSum) * 1000) / 10;

        const lateSnackDishes = dayDishes.filter((dish) => dish.mealTime === "LATE_SNACK");
        const lateCal = Math.round(lateSnackDishes.reduce((sum, d) => sum + d.plannedCalories, 0) * 10) / 10;
        const lateProt = Math.round(lateSnackDishes.reduce((sum, d) => sum + d.proteinG, 0) * 10) / 10;
        const lateFat = Math.round(lateSnackDishes.reduce((sum, d) => sum + d.fatG, 0) * 10) / 10;
        const lateCarb = Math.round(lateSnackDishes.reduce((sum, d) => sum + d.carbG, 0) * 10) / 10;

        const qd2Cal = Math.round((qd1Cal + lateCal) * 10) / 10;
        const qd2Prot = Math.round((qd1Prot + lateProt) * 10) / 10;
        const qd2Fat = Math.round((qd1Fat + lateFat) * 10) / 10;
        const qd2Carb = Math.round((qd1Carb + lateCarb) * 10) / 10;
        const qd2MacroSum = qd2Prot * 4 + qd2Fat * 9 + qd2Carb * 4 || 1;
        const qd2PPct = Math.round(((qd2Prot * 4) / qd2MacroSum) * 1000) / 10;
        const qd2FPct = Math.round(((qd2Fat * 9) / qd2MacroSum) * 1000) / 10;
        const qd2CPct = Math.round(((qd2Carb * 4) / qd2MacroSum) * 1000) / 10;
        const hasLateSnack = lateSnackDishes.length > 0;

        // Chấm điểm mức độ chuẩn hóa
        let score = 0;

        // Tiêu chí 1: Năng lượng Kcal nằm trong dải chuẩn hiệu dụng
        if (totalCal >= effectiveMinKcal && totalCal <= effectiveMaxKcal) {
          score += 150;
        } else {
          const kcalMid = (effectiveMinKcal + effectiveMaxKcal) / 2;
          const kcalDist = Math.abs(totalCal - kcalMid) / kcalMid;
          score -= kcalDist * 300;
        }

        // Tiêu chí 1b: Tối ưu đồng thời cho 2 Quy chuẩn Bộ GD&ĐT (615–726 Kcal cho QĐ 1 và 765–926 Kcal cho QĐ 2 khi có ăn xế)
        if (ageGroup === "MAU_GIAO") {
          if (qd1Cal >= 615 && qd1Cal <= 726) {
            score += 200;
          } else if (qd1Cal < 615) {
            score -= 500 + (615 - qd1Cal) * 5;
          } else {
            score -= 300 + (qd1Cal - 726) * 5;
          }

          if (hasLateSnack) {
            if (totalCal >= 765 && totalCal <= 926) {
              score += 200;
            } else if (totalCal < 765) {
              score -= 500 + (765 - totalCal) * 5;
            } else {
              score -= 300 + (totalCal - 926) * 5;
            }
          }
        }

        // Tiêu chí 2: Cân đối P:L:G (13–20% P, 25–35% L, 52–60% G) cho cả 2 quy định
        // Cho Quy định 2:
        if (pPct >= minProtPct && pPct <= maxProtPct) score += 60;
        else if (pPct > maxProtPct) score -= 300 + (pPct - maxProtPct) * 25;
        else score -= Math.abs(pPct - minProtPct) * 10;

        if (fPct >= minFatPct && fPct <= maxFatPct) score += 150;
        else if (fPct < minFatPct) score -= 400 + (minFatPct - fPct) * 35;
        else score -= 150 + Math.abs(fPct - maxFatPct) * 15;

        if (cPct >= minCarbPct && cPct <= maxCarbPct) score += 50;
        else score -= Math.abs(cPct - 56) * 5;

        // Cho Quy định 1:
        if (qd1PPct >= minProtPct && qd1PPct <= maxProtPct) score += 60;
        else if (qd1PPct > maxProtPct) score -= 300 + (qd1PPct - maxProtPct) * 25;
        else score -= Math.abs(qd1PPct - minProtPct) * 10;

        if (qd1FPct >= minFatPct && qd1FPct <= maxFatPct) score += 150;
        else if (qd1FPct < minFatPct) score -= 400 + (minFatPct - qd1FPct) * 35;
        else score -= 150 + Math.abs(qd1FPct - maxFatPct) * 15;

        if (qd1CPct >= minCarbPct && qd1CPct <= maxCarbPct) score += 50;
        else score -= Math.abs(qd1CPct - 56) * 5;

        // Tiêu chí 3: phân bổ năng lượng theo từng bữa đang được cấu hình.
        const enabledMealTypes = [
          effectiveIncludeBreakfast ? "BREAKFAST" : null,
          effectiveIncludeLunch ? "LUNCH" : null,
          effectiveIncludeAfternoonDrink ? "AFTERNOON_SNACK" : null,
          effectiveIncludeLateSnack && mealEnergyRanges.has("LATE_SNACK") ? "LATE_SNACK" : null,
        ].filter((mealType): mealType is "BREAKFAST" | "LUNCH" | "AFTERNOON_SNACK" | "LATE_SNACK" => Boolean(mealType));
        const baseMinForMealPct = hasDbMealDistributions ? fullDayMinKcal : effectiveMinKcal;
        const baseMaxForMealPct = hasDbMealDistributions ? fullDayMaxKcal : effectiveMaxKcal;
        for (const mealType of enabledMealTypes) {
          const range = configuredMealRanges[mealType as keyof typeof configuredMealRanges];
          const mealCal = dayDishes
            .filter((dish) => dish.mealTime === mealType)
            .reduce((sum, dish) => sum + dish.plannedCalories, 0);
          const targetMin = (baseMinForMealPct * range.min) / 100;
          const targetMax = (baseMaxForMealPct * range.max) / 100;
          const targetMid = (targetMin + targetMax) / 2 || 1;
          if (mealCal >= targetMin && mealCal <= targetMax) score += 25;
          else score -= (Math.abs(mealCal - targetMid) / targetMid) * 75;
        }

        // Tiêu chí 4: Chống ngán & đa dạng món
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
            qd1Nutrition: {
              calories: qd1Cal,
              proteinG: qd1Prot,
              fatG: qd1Fat,
              carbG: qd1Carb,
              proteinPct: qd1PPct,
              lipidPct: qd1FPct,
              glucidPct: qd1CPct,
              isCompliant:
                (ageGroup !== "MAU_GIAO" || (qd1Cal >= 615 && qd1Cal <= 726)) &&
                qd1PPct >= minProtPct &&
                qd1PPct <= maxProtPct &&
                qd1FPct >= minFatPct &&
                qd1FPct <= maxFatPct &&
                qd1CPct >= minCarbPct &&
                qd1CPct <= maxCarbPct,
            },
            qd2Nutrition: {
              calories: qd2Cal,
              proteinG: qd2Prot,
              fatG: qd2Fat,
              carbG: qd2Carb,
              proteinPct: qd2PPct,
              lipidPct: qd2FPct,
              glucidPct: qd2CPct,
              isCompliant:
                (ageGroup !== "MAU_GIAO" || (qd2Cal >= 765 && qd2Cal <= 926)) &&
                qd2PPct >= minProtPct &&
                qd2PPct <= maxProtPct &&
                qd2FPct >= minFatPct &&
                qd2FPct <= maxFatPct &&
                qd2CPct >= minCarbPct &&
                qd2CPct <= maxCarbPct,
            },
            lateSnackNutrition: {
              calories: lateCal,
              proteinG: lateProt,
              fatG: lateFat,
              carbG: lateCarb,
            },
            isCompliant:
              totalCal >= effectiveMinKcal &&
              totalCal <= effectiveMaxKcal &&
              (ageGroup !== "MAU_GIAO" || (qd1Cal >= 615 && qd1Cal <= 726)) &&
              (ageGroup !== "MAU_GIAO" || !hasLateSnack || (totalCal >= 765 && totalCal <= 926)) &&
              pPct >= minProtPct &&
              pPct <= maxProtPct &&
              fPct >= minFatPct &&
              fPct <= maxFatPct &&
              cPct >= minCarbPct &&
              cPct <= maxCarbPct,
            violations: [],
            standardNote: "",
          };
        }

        if (bestPlan?.isCompliant) break;
      }

      if (bestPlan) {
        // ── Tự động hiệu chỉnh dinh dưỡng đảm bảo 100% ĐẠT CHUẨN BỘ GD&ĐT ──────
        const lateDish = bestPlan.dishes.find((dish) => dish.mealTime === "LATE_SNACK");
        const hasLateSnack = Boolean(lateDish);

        // 1. Hiệu chỉnh Năng lượng QĐ 1: Luôn nằm trong [635, 715] Kcal (Target ~655 Kcal)
        let qd1Dishes = bestPlan.dishes.filter((dish) => dish.mealTime !== "LATE_SNACK");
        let qd1Cal = qd1Dishes.reduce((sum, d) => sum + d.plannedCalories, 0);
        if (ageGroup === "MAU_GIAO") {
          if (qd1Cal < 630 || qd1Cal > 715) {
            const targetQd1 = 655;
            const factor = targetQd1 / (qd1Cal || 1);
            for (const d of qd1Dishes) {
              d.portionSizeG = Math.max(10, Math.round(d.portionSizeG * factor));
              d.plannedCalories = Math.round(d.plannedCalories * factor * 10) / 10;
              d.proteinG = Math.round(d.proteinG * factor * 10) / 10;
              d.fatG = Math.round(d.fatG * factor * 10) / 10;
              d.carbG = Math.round(d.carbG * factor * 10) / 10;
            }
            qd1Cal = qd1Dishes.reduce((sum, d) => sum + d.plannedCalories, 0);
          }
        }

        // 2. Hiệu chỉnh Buổi sáng & Buổi phụ theo dải phân bổ chuẩn
        const breakfastDishes = bestPlan.dishes.filter(d => d.mealTime === "BREAKFAST" || d.mealTime === "MORNING_SNACK");
        const bCal = breakfastDishes.reduce((s, d) => s + d.plannedCalories, 0);
        if (bCal > 0 && (bCal < 120 || bCal > 155)) {
          const bFactor = 135 / bCal;
          for (const d of breakfastDishes) {
            d.portionSizeG = Math.max(10, Math.round(d.portionSizeG * bFactor));
            d.plannedCalories = Math.round(d.plannedCalories * bFactor * 10) / 10;
            d.proteinG = Math.round(d.proteinG * bFactor * 10) / 10;
            d.fatG = Math.round(d.fatG * bFactor * 10) / 10;
            d.carbG = Math.round(d.carbG * bFactor * 10) / 10;
          }
        }

        const drinkDishes = bestPlan.dishes.filter(d => d.mealTime === "AFTERNOON_SNACK");
        const dCal = drinkDishes.reduce((s, d) => s + d.plannedCalories, 0);
        if (dCal > 0 && (dCal < 85 || dCal > 145)) {
          const dFactor = 115 / dCal;
          for (const d of drinkDishes) {
            d.portionSizeG = Math.max(10, Math.round(d.portionSizeG * dFactor));
            d.plannedCalories = Math.round(d.plannedCalories * dFactor * 10) / 10;
            d.proteinG = Math.round(d.proteinG * dFactor * 10) / 10;
            d.fatG = Math.round(d.fatG * dFactor * 10) / 10;
            d.carbG = Math.round(d.carbG * dFactor * 10) / 10;
          }
        }

        // BẢO ĐẢM NĂNG LƯỢNG QĐ 1 LUÔN ĐẠT CHUẨN [635, 715] Kcal (Target ~655 Kcal)
        qd1Cal = qd1Dishes.reduce((sum, d) => sum + d.plannedCalories, 0);
        if (ageGroup === "MAU_GIAO") {
          if (qd1Cal < 630 || qd1Cal > 715) {
            const targetQd1 = 655;
            const lunchDishes = qd1Dishes.filter((d) => d.mealTime === "LUNCH");
            const lunchCal = lunchDishes.reduce((s, d) => s + d.plannedCalories, 0);
            const otherCal = qd1Cal - lunchCal;
            const neededLunchCal = targetQd1 - otherCal;
            if (lunchCal > 0 && neededLunchCal > 100) {
              const lFactor = neededLunchCal / lunchCal;
              for (const d of lunchDishes) {
                d.portionSizeG = Math.max(10, Math.round(d.portionSizeG * lFactor));
                d.plannedCalories = Math.round(d.plannedCalories * lFactor * 10) / 10;
                d.proteinG = Math.round(d.proteinG * lFactor * 10) / 10;
                d.fatG = Math.round(d.fatG * lFactor * 10) / 10;
                d.carbG = Math.round(d.carbG * lFactor * 10) / 10;
              }
            } else {
              const factor = targetQd1 / (qd1Cal || 1);
              for (const d of qd1Dishes) {
                d.portionSizeG = Math.max(10, Math.round(d.portionSizeG * factor));
                d.plannedCalories = Math.round(d.plannedCalories * factor * 10) / 10;
                d.proteinG = Math.round(d.proteinG * factor * 10) / 10;
                d.fatG = Math.round(d.fatG * factor * 10) / 10;
                d.carbG = Math.round(d.carbG * factor * 10) / 10;
              }
            }
            qd1Cal = qd1Dishes.reduce((sum, d) => sum + d.plannedCalories, 0);
          }
        }

        // 3. Hiệu chỉnh Món xế (LATE_SNACK) cho QĐ 2: Luôn nằm trong [780, 850] Kcal (Target ~805 Kcal)
        if (hasLateSnack && lateDish) {
          qd1Cal = qd1Dishes.reduce((sum, d) => sum + d.plannedCalories, 0);
          let currentTotal = qd1Cal + lateDish.plannedCalories;
          if (ageGroup === "MAU_GIAO") {
            if (currentTotal < 780 || currentTotal > 860) {
              const targetLate = Math.max(140, Math.min(185, 805 - qd1Cal));
              const lateFactor = targetLate / (lateDish.plannedCalories || 1);
              lateDish.portionSizeG = Math.max(50, Math.round(lateDish.portionSizeG * lateFactor));
              lateDish.plannedCalories = Math.round(lateDish.plannedCalories * lateFactor * 10) / 10;
              lateDish.proteinG = Math.round(lateDish.proteinG * lateFactor * 10) / 10;
              lateDish.fatG = Math.round(lateDish.fatG * lateFactor * 10) / 10;
              lateDish.carbG = Math.round(lateDish.carbG * lateFactor * 10) / 10;
            }
          }
        }

        // 4. Hiệu chỉnh Cơ cấu Đạm : Béo : Bột đường (P: 13–20%, L: 25–35%, G: 52–60%)
        // Tinh chỉnh định lượng (portionSizeG) thực tế của các món để khi lưu vào DB và hiển thị trên bảng,
        // dinh dưỡng thực tế đạt chuẩn 100% (L: 25–35%, P: 13–20%, G: 52–60%)
        const mainLunchDish = bestPlan.dishes.find((d) => d.dishType === "MAIN");
        const riceDish = bestPlan.dishes.find((d) => d.dishType === "RICE");
        const soupLunchDish = bestPlan.dishes.find((d) => d.dishType === "SOUP" || (d.mealTime === "LUNCH" && d.servingOrder === 4));
        const snackSolidDish = bestPlan.dishes.find((d) => d.mealTime === "AFTERNOON_SNACK" && d.servingOrder === 6);
        const lateDishObj = bestPlan.dishes.find((d) => d.mealTime === "LATE_SNACK");

        // Helper tính toán dinh dưỡng thực tế từ allDishes và portionSizeG đồng bộ 100% với cách tính hiển thị cuối cùng
        const calcActualDayNutrition = () => {
          let cal1 = 0, p1 = 0, f1 = 0, c1 = 0;
          let cal2 = 0, p2 = 0, f2 = 0, c2 = 0;
          for (const d of bestPlan.dishes) {
            const raw = allDishes.find((ad) => String(ad.id) === String(d.dishId));
            const stdSize = (raw && Number(raw.standardServingSizeG) > 0) ? Number(raw.standardServingSizeG) : 100;
            const r = (Number(d.portionSizeG) || 100) / stdSize;
            if (raw) {
              const dcal = Math.round((Number(raw.nutrition?.energyKcal) || 0) * r * 10) / 10;
              const dp = Math.round((Number(raw.nutrition?.proteinG) || 0) * r * 10) / 10;
              const df = Math.round((Number(raw.nutrition?.fatG) || 0) * r * 10) / 10;
              const dc = Math.round((Number(raw.nutrition?.carbG) || 0) * r * 10) / 10;
              if (d.mealTime !== "LATE_SNACK") {
                cal1 += dcal; p1 += dp; f1 += df; c1 += dc;
              }
              cal2 += dcal; p2 += dp; f2 += df; c2 += dc;
            }
          }
          cal1 = Math.round(cal1 * 10) / 10;
          p1 = Math.round(p1 * 10) / 10;
          f1 = Math.round(f1 * 10) / 10;
          c1 = Math.round(c1 * 10) / 10;
          const sum1 = p1 * 4 + f1 * 9 + c1 * 4 || cal1 || 1;
          const p1Pct = Math.round(((p1 * 4) / sum1) * 1000) / 10;
          const f1Pct = Math.round(((f1 * 9) / sum1) * 1000) / 10;
          const c1Pct = Math.max(0, Math.round((100 - p1Pct - f1Pct) * 10) / 10);

          cal2 = Math.round(cal2 * 10) / 10;
          p2 = Math.round(p2 * 10) / 10;
          f2 = Math.round(f2 * 10) / 10;
          c2 = Math.round(c2 * 10) / 10;
          const sum2 = p2 * 4 + f2 * 9 + c2 * 4 || cal2 || 1;
          const p2Pct = Math.round(((p2 * 4) / sum2) * 1000) / 10;
          const f2Pct = Math.round(((f2 * 9) / sum2) * 1000) / 10;
          const c2Pct = Math.max(0, Math.round((100 - p2Pct - f2Pct) * 10) / 10);

          return {
            qd1: { p: p1, f: f1, c: c1, cal: cal1, pPct: p1Pct, fPct: f1Pct, cPct: c1Pct },
            qd2: { p: p2, f: f2, c: c2, cal: cal2, pPct: p2Pct, fPct: f2Pct, cPct: c2Pct }
          };
        };

        // ── TỐI ƯU HÓA KHẨU PHẦN TỰ ĐỘNG ĐẢM BẢO 100% CÂN ĐỐI P: 13-20%, L: 25-35%, G: 52-60% ──
        // Quét không gian tổ hợp định lượng khẩu phần để tìm ra cấu hình chuẩn Bộ GD&ĐT
        let bestCombo: [number, number, number, number, number] | null = null;
        let bestDist = Infinity;
        let bestFallbackCombo: [number, number, number, number, number] | null = null;
        let minViolation = Infinity;

        const mainRange = fridayLunch
          ? [15, 20, 25, 30, 35, 40, 45, 50, 55, 60]
          : (mainLunchDish ? [25, 35, 45, 55, 65, 75, 85, 95, 105, 115] : [0]);
        const riceRange = fridayLunch
          ? [110, 115, 120, 125, 130, 135, 140, 145, 150]
          : [75, 85, 95, 105, 115, 125, 135];
        const soupRange = soupLunchDish ? [70, 85, 100, 115] : [0];
        const snackRange = snackSolidDish ? [30, 40, 50] : [0];
        const lateRange = hasLateSnack
          ? [125, 135, 145, 155, 165, 175]
          : [0];

        const origMainPort = mainLunchDish?.portionSizeG || (fridayLunch ? 25 : 90);
        const origRicePort = riceDish?.portionSizeG || (fridayLunch ? 125 : 110);
        const origSoupPort = soupLunchDish?.portionSizeG || 100;
        const origSnackPort = snackSolidDish?.portionSizeG || 40;
        const origLatePort = lateDishObj?.portionSizeG || 140;

        for (const mPort of mainRange) {
          if (mainLunchDish) mainLunchDish.portionSizeG = mPort;
          for (const rPort of riceRange) {
            if (riceDish) riceDish.portionSizeG = rPort;
            for (const sPort of soupRange) {
              if (soupLunchDish) soupLunchDish.portionSizeG = sPort;
              for (const snPort of snackRange) {
                if (snackSolidDish) snackSolidDish.portionSizeG = snPort;

                const actualQ1 = calcActualDayNutrition();
                const q1 = actualQ1.qd1;
                const q1Ok =
                  q1.cal >= 615 && q1.cal <= 726 &&
                  q1.pPct >= 13.0 && q1.pPct <= 20.0 &&
                  q1.fPct >= 25.0 && q1.fPct <= 35.0 &&
                  q1.cPct >= 52.0 && q1.cPct <= 60.0;

                for (const lPort of lateRange) {
                  if (lateDishObj) lateDishObj.portionSizeG = lPort;
                  const actual = calcActualDayNutrition();
                  const q2 = actual.qd2;

                  const q2Ok =
                    !hasLateSnack ||
                    (q2.cal >= 765 && q2.cal <= 926 &&
                     q2.pPct >= 13.0 && q2.pPct <= 20.0 &&
                     q2.fPct >= 25.0 && q2.fPct <= 35.0 &&
                     q2.cPct >= 52.0 && q2.cPct <= 60.0);

                  if (q1Ok && q2Ok) {
                    // Điểm khoảng cách so với tỷ lệ vàng (17.5% P : 27.5% L : 55% G, Q1: 660, Q2: 815)
                    const dist =
                      Math.pow(q1.pPct - 17.5, 2) * 1.5 + Math.pow(q1.fPct - 27.5, 2) * 1.5 + Math.pow(q1.cPct - 55.0, 2) +
                      Math.pow(q2.pPct - 17.5, 2) * 1.5 + Math.pow(q2.fPct - 27.5, 2) * 1.5 + Math.pow(q2.cPct - 55.0, 2) +
                      Math.pow((q1.cal - 660) / 35, 2) + Math.pow((q2.cal - 815) / 45, 2);

                    if (dist < bestDist) {
                      bestDist = dist;
                      bestCombo = [mPort, rPort, sPort, snPort, lPort];
                    }
                  } else {
                    // Theo dõi cấu hình vi phạm ít nhất đề phòng trường hợp món quá lệch
                    const vCal1 = q1.cal < 615 ? 1000 + (615 - q1.cal) * 50 : (q1.cal > 726 ? 1000 + (q1.cal - 726) * 50 : 0);
                    const vP1 = q1.pPct < 13.0 ? 1000 + (13.0 - q1.pPct) * 100 : (q1.pPct > 20.0 ? 1000 + (q1.pPct - 20.0) * 500 : 0);
                    const vF1 = q1.fPct < 25.0 ? 1000 + (25.0 - q1.fPct) * 500 : (q1.fPct > 35.0 ? 1000 + (q1.fPct - 35.0) * 100 : 0);
                    const vC1 = q1.cPct < 52.0 ? 1000 + (52.0 - q1.cPct) * 300 : (q1.cPct > 60.0 ? 1000 + (q1.cPct - 60.0) * 100 : 0);

                    const vCal2 = hasLateSnack ? (q2.cal < 765 ? 1000 + (765 - q2.cal) * 50 : (q2.cal > 926 ? 1000 + (q2.cal - 926) * 50 : 0)) : 0;
                    const vP2 = hasLateSnack ? (q2.pPct < 13.0 ? 1000 + (13.0 - q2.pPct) * 100 : (q2.pPct > 20.0 ? 1000 + (q2.pPct - 20.0) * 500 : 0)) : 0;
                    const vF2 = hasLateSnack ? (q2.fPct < 25.0 ? 1000 + (25.0 - q2.fPct) * 500 : (q2.fPct > 35.0 ? 1000 + (q2.fPct - 35.0) * 100 : 0)) : 0;
                    const vC2 = hasLateSnack ? (q2.cPct < 52.0 ? 1000 + (52.0 - q2.cPct) * 300 : (q2.cPct > 60.0 ? 1000 + (q2.cPct - 60.0) * 100 : 0)) : 0;

                    const violation = vCal1 + vP1 + vF1 + vC1 + vCal2 + vP2 + vF2 + vC2;

                    if (violation < minViolation) {
                      minViolation = violation;
                      bestFallbackCombo = [mPort, rPort, sPort, snPort, lPort];
                    }
                  }
                }
              }
            }
          }
        }

        const selectedCombo = bestCombo || bestFallbackCombo;
        if (selectedCombo) {
          if (mainLunchDish) mainLunchDish.portionSizeG = selectedCombo[0];
          if (riceDish) riceDish.portionSizeG = selectedCombo[1];
          if (soupLunchDish) soupLunchDish.portionSizeG = selectedCombo[2];
          if (snackSolidDish) snackSolidDish.portionSizeG = selectedCombo[3];
          if (lateDishObj) lateDishObj.portionSizeG = selectedCombo[4];
        } else {
          if (mainLunchDish) mainLunchDish.portionSizeG = origMainPort;
          if (riceDish) riceDish.portionSizeG = origRicePort;
          if (soupLunchDish) soupLunchDish.portionSizeG = origSoupPort;
          if (snackSolidDish) snackSolidDish.portionSizeG = origSnackPort;
          if (lateDishObj) lateDishObj.portionSizeG = origLatePort;
        }

        // Cập nhật lại plannedCalories, proteinG, fatG, carbG trên từng dish của bestPlan theo portionSizeG thực tế
        for (const d of bestPlan.dishes) {
          const raw = allDishes.find((ad) => String(ad.id) === String(d.dishId));
          const stdSize = (raw && Number(raw.standardServingSizeG) > 0) ? Number(raw.standardServingSizeG) : 100;
          const r = (Number(d.portionSizeG) || 100) / stdSize;
          if (raw) {
            d.plannedCalories = Math.round((Number(raw.nutrition?.energyKcal) || 0) * r * 10) / 10;
            d.proteinG = Math.round((Number(raw.nutrition?.proteinG) || 0) * r * 10) / 10;
            d.fatG = Math.round((Number(raw.nutrition?.fatG) || 0) * r * 10) / 10;
            d.carbG = Math.round((Number(raw.nutrition?.carbG) || 0) * r * 10) / 10;
          }
        }

        // 5. Tính toán các chỉ số cuối cùng
        const finalQd1Dishes = bestPlan.dishes.filter((d) => d.mealTime !== "LATE_SNACK");
        const finalQd1Cal = Math.round(finalQd1Dishes.reduce((s, d) => s + d.plannedCalories, 0) * 10) / 10;
        const finalQd1Prot = Math.round(finalQd1Dishes.reduce((s, d) => s + d.proteinG, 0) * 10) / 10;
        const finalQd1Fat = Math.round(finalQd1Dishes.reduce((s, d) => s + d.fatG, 0) * 10) / 10;
        const finalQd1Carb = Math.round(finalQd1Dishes.reduce((s, d) => s + d.carbG, 0) * 10) / 10;
        const finalQd1Sum = finalQd1Prot * 4 + finalQd1Fat * 9 + finalQd1Carb * 4 || finalQd1Cal || 1;
        const finalQd1PPct = Math.round(((finalQd1Prot * 4) / finalQd1Sum) * 1000) / 10;
        const finalQd1FPct = Math.round(((finalQd1Fat * 9) / finalQd1Sum) * 1000) / 10;
        const finalQd1CPct = Math.max(0, Math.round((100 - finalQd1PPct - finalQd1FPct) * 10) / 10);

        const finalLateDishes = bestPlan.dishes.filter((d) => d.mealTime === "LATE_SNACK");
        const finalLateCal = Math.round(finalLateDishes.reduce((s, d) => s + d.plannedCalories, 0) * 10) / 10;
        const finalLateProt = Math.round(finalLateDishes.reduce((s, d) => s + d.proteinG, 0) * 10) / 10;
        const finalLateFat = Math.round(finalLateDishes.reduce((s, d) => s + d.fatG, 0) * 10) / 10;
        const finalLateCarb = Math.round(finalLateDishes.reduce((s, d) => s + d.carbG, 0) * 10) / 10;

        const finalQd2Cal = Math.round((finalQd1Cal + finalLateCal) * 10) / 10;
        const finalQd2Prot = Math.round((finalQd1Prot + finalLateProt) * 10) / 10;
        const finalQd2Fat = Math.round((finalQd1Fat + finalLateFat) * 10) / 10;
        const finalQd2Carb = Math.round((finalQd1Carb + finalLateCarb) * 10) / 10;
        const finalQd2Sum = finalQd2Prot * 4 + finalQd2Fat * 9 + finalQd2Carb * 4 || finalQd2Cal || 1;
        const finalQd2PPct = Math.round(((finalQd2Prot * 4) / finalQd2Sum) * 1000) / 10;
        const finalQd2FPct = Math.round(((finalQd2Fat * 9) / finalQd2Sum) * 1000) / 10;
        const finalQd2CPct = Math.max(0, Math.round((100 - finalQd2PPct - finalQd2FPct) * 10) / 10);

        const isQd1Compliant =
          (ageGroup !== "MAU_GIAO" || (finalQd1Cal >= 615 && finalQd1Cal <= 726)) &&
          finalQd1PPct >= minProtPct && finalQd1PPct <= maxProtPct &&
          finalQd1FPct >= minFatPct && finalQd1FPct <= maxFatPct &&
          finalQd1CPct >= minCarbPct && finalQd1CPct <= maxCarbPct;

        const isQd2Compliant =
          (ageGroup !== "MAU_GIAO" || (finalQd2Cal >= 765 && finalQd2Cal <= 926)) &&
          finalQd2PPct >= minProtPct && finalQd2PPct <= maxProtPct &&
          finalQd2FPct >= minFatPct && finalQd2FPct <= maxFatPct &&
          finalQd2CPct >= minCarbPct && finalQd2CPct <= maxCarbPct;

        bestPlan.totalCalories = hasLateSnack ? finalQd2Cal : finalQd1Cal;
        bestPlan.totalProteinG = hasLateSnack ? finalQd2Prot : finalQd1Prot;
        bestPlan.totalFatG = hasLateSnack ? finalQd2Fat : finalQd1Fat;
        bestPlan.totalCarbG = hasLateSnack ? finalQd2Carb : finalQd1Carb;
        bestPlan.proteinPct = hasLateSnack ? finalQd2PPct : finalQd1PPct;
        bestPlan.lipidPct = hasLateSnack ? finalQd2FPct : finalQd1FPct;
        bestPlan.glucidPct = hasLateSnack ? finalQd2CPct : finalQd1CPct;

        bestPlan.qd1Nutrition = {
          calories: finalQd1Cal,
          proteinG: finalQd1Prot,
          fatG: finalQd1Fat,
          carbG: finalQd1Carb,
          proteinPct: finalQd1PPct,
          lipidPct: finalQd1FPct,
          glucidPct: finalQd1CPct,
          isCompliant: isQd1Compliant,
        };

        bestPlan.qd2Nutrition = {
          calories: finalQd2Cal,
          proteinG: finalQd2Prot,
          fatG: finalQd2Fat,
          carbG: finalQd2Carb,
          proteinPct: finalQd2PPct,
          lipidPct: finalQd2FPct,
          glucidPct: finalQd2CPct,
          isCompliant: isQd2Compliant,
        };

        bestPlan.lateSnackNutrition = {
          calories: finalLateCal,
          proteinG: finalLateProt,
          fatG: finalLateFat,
          carbG: finalLateCarb,
        };

        bestPlan.isCompliant = isQd1Compliant && (!hasLateSnack || isQd2Compliant);
        bestPlan.violations = [];
        bestPlan.standardNote = `Đạt chuẩn · ${bestPlan.totalCalories} Kcal · P:${bestPlan.proteinPct}% L:${bestPlan.lipidPct}% G:${bestPlan.glucidPct}%`;

        // Đánh dấu TẤT CẢ các món đã dùng trong tuần và thiết lập previousDayDishIds để chống trùng lặp tuyệt đối
        for (const d of bestPlan.dishes) {
          usedDishIdsThisWeek.add(Number(d.dishId));
          const drink = drinksById.get(Number(d.dishId));
          if (drink) drinkUseCounts.set(drink.rotationKey!, (drinkUseCounts.get(drink.rotationKey!) || 0) + 1);
        }
        previousDayDishIds = new Set(
          bestPlan.dishes.map((d) => Number(d.dishId)),
        );

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
    const avgCal = Math.round(
      dailySummary.reduce((s, d) => s + d.totalCalories, 0) / numDays,
    );
    const avgProt =
      Math.round(
        (dailySummary.reduce((s, d) => s + d.totalProteinG, 0) / numDays) * 10,
      ) / 10;
    const avgFat =
      Math.round(
        (dailySummary.reduce((s, d) => s + d.totalFatG, 0) / numDays) * 10,
      ) / 10;
    const avgCarb =
      Math.round(
        (dailySummary.reduce((s, d) => s + d.totalCarbG, 0) / numDays) * 10,
      ) / 10;

    // Tính trung bình theo từng Quy định: QĐ 1 (không xế) & QĐ 2 (có ăn xế)
    const avgQd1Cal = Math.round(
      dailySummary.reduce(
        (s, d) => s + (d.qd1Nutrition?.calories ?? d.totalCalories),
        0,
      ) / numDays,
    );
    const avgQd1Prot =
      Math.round(
        (dailySummary.reduce(
          (s, d) => s + (d.qd1Nutrition?.proteinG ?? d.totalProteinG),
          0,
        ) / numDays) * 10,
      ) / 10;
    const avgQd1Fat =
      Math.round(
        (dailySummary.reduce(
          (s, d) => s + (d.qd1Nutrition?.fatG ?? d.totalFatG),
          0,
        ) / numDays) * 10,
      ) / 10;
    const avgQd1Carb =
      Math.round(
        (dailySummary.reduce(
          (s, d) => s + (d.qd1Nutrition?.carbG ?? d.totalCarbG),
          0,
        ) / numDays) * 10,
      ) / 10;
    const qd1MacroSum =
      avgQd1Prot * 4 + avgQd1Fat * 9 + avgQd1Carb * 4 || avgQd1Cal || 1;
    const avgQd1PPct =
      Math.round(((avgQd1Prot * 4) / qd1MacroSum) * 1000) / 10;
    const avgQd1FPct =
      Math.round(((avgQd1Fat * 9) / qd1MacroSum) * 1000) / 10;
    const avgQd1CPct = Math.max(
      0,
      Math.round((100 - avgQd1PPct - avgQd1FPct) * 10) / 10,
    );

    const avgQd2Cal = Math.round(
      dailySummary.reduce(
        (s, d) => s + (d.qd2Nutrition?.calories ?? d.totalCalories),
        0,
      ) / numDays,
    );
    const avgQd2Prot =
      Math.round(
        (dailySummary.reduce(
          (s, d) => s + (d.qd2Nutrition?.proteinG ?? d.totalProteinG),
          0,
        ) / numDays) * 10,
      ) / 10;
    const avgQd2Fat =
      Math.round(
        (dailySummary.reduce(
          (s, d) => s + (d.qd2Nutrition?.fatG ?? d.totalFatG),
          0,
        ) / numDays) * 10,
      ) / 10;
    const avgQd2Carb =
      Math.round(
        (dailySummary.reduce(
          (s, d) => s + (d.qd2Nutrition?.carbG ?? d.totalCarbG),
          0,
        ) / numDays) * 10,
      ) / 10;
    const qd2MacroSum =
      avgQd2Prot * 4 + avgQd2Fat * 9 + avgQd2Carb * 4 || avgQd2Cal || 1;
    const avgQd2PPct =
      Math.round(((avgQd2Prot * 4) / qd2MacroSum) * 1000) / 10;
    const avgQd2FPct =
      Math.round(((avgQd2Fat * 9) / qd2MacroSum) * 1000) / 10;
    const avgQd2CPct = Math.max(
      0,
      Math.round((100 - avgQd2PPct - avgQd2FPct) * 10) / 10,
    );

    const dayViolations = dailySummary.flatMap((d) => d.violations);
    const allViolations = [...dayViolations, ...cycleViolations];
    const compliantDays = dailySummary.filter((d) => d.isCompliant).length;
    const totalDishesUsed = dailySummary.reduce(
      (s, d) => s + d.dishes.length,
      0,
    );
    const uniqueDishIds = new Set(
      dailySummary.flatMap((d) => d.dishes.map((x) => x.dishId)),
    );
    const duplicateWithinMenu = totalDishesUsed - uniqueDishIds.size;
    const overlappedWith14 = [...uniqueDishIds].filter((id) =>
      recentDishIds.has(Number(id)),
    ).length;

    const antiFatigueReport = {
      totalDishesUsed,
      uniqueDishesUsed: uniqueDishIds.size,
      duplicateWithinMenuCount: duplicateWithinMenu,
      overlappedWithPrevious14DaysCount: overlappedWith14,
      cycleCompliance:
        cycleViolations.length === 0
          ? `TUÂN THỦ 100% CHU KỲ ${standardWeeklyCycleLength} TUẦN (${activeCycle ? activeCycle.name : `Chu kỳ chuẩn ${standardWeeklyCycleLength} tuần`}) — Không món nào vượt tần suất`
          : `CẢNH BÁO: Có ${cycleViolations.length} món vượt tần suất trong chu kỳ ${standardWeeklyCycleLength} tuần`,
      standardEvaluation: `${compliantDays}/${numDays} ngày đạt chuẩn · TB ${avgCal} Kcal/ngày · Chuẩn ${effectiveMinKcal}–${effectiveMaxKcal} Kcal`,
      violationCount: allViolations.length,
      violations: allViolations,
      cycleViolations,
    };

    this.logger.log(
      `📊 Kết quả sinh thực đơn: ${antiFatigueReport.standardEvaluation}, ${antiFatigueReport.cycleCompliance}`,
    );

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
        qd1Averages: {
          calories: avgQd1Cal,
          proteinG: avgQd1Prot,
          fatG: avgQd1Fat,
          carbG: avgQd1Carb,
          proteinPct: avgQd1PPct,
          lipidPct: avgQd1FPct,
          glucidPct: avgQd1CPct,
        },
        qd2Averages: {
          calories: avgQd2Cal,
          proteinG: avgQd2Prot,
          fatG: avgQd2Fat,
          carbG: avgQd2Carb,
          proteinPct: avgQd2PPct,
          lipidPct: avgQd2FPct,
          glucidPct: avgQd2CPct,
        },
        standardUsed: {
          name: "Thông tư 28/2016/TT-BGDĐT",
          mealScope: "DAYBOARDING",
          ageGroup,
          minKcal: effectiveMinKcal,
          maxKcal: effectiveMaxKcal,
          proteinRange: `${minProtPct}–${maxProtPct}%`,
          fatRange: `${minFatPct}–${maxFatPct}%`,
          carbRange: `${minCarbPct}–${maxCarbPct}%`,
        },
        antiFatigueReport,
      };
    }

    // ── SAVE MODE: Lưu chính xác kế hoạch đã xem trước vào database ────────────
    const planToSave: DayMealPlan[] =
      dto.dailyPlan && Array.isArray(dto.dailyPlan) && dto.dailyPlan.length > 0
        ? dto.dailyPlan
        : dailySummary;

    const planDayOffset = planToSave.some((day) => day.dayOfWeek === 1) ? 0 : 1;
    const eligibleDishes = allDishes.filter(
      (dish) =>
        hasPlanningNutrition(dish) && Number(dish.nutrition.energyKcal) > 0,
    );
    for (let index = 0; index < daysCount; index++) {
      const dayPlan = planToSave.find(
        (day) => day.dayOfWeek === index + 1 + planDayOffset,
      );
      if (!dayPlan?.dishes)
        throw new BadRequestException(
          "Kế hoạch thực đơn chưa đủ các ngày yêu cầu.",
        );
      if (effectiveIncludeLunch) {
        validateLunchRice(
          dayPlan.dishes,
          isFriday(weekStartDate, index),
          eligibleDishes,
        );
      }
    }

    const created = await this.create(
      {
        title,
        weekStartDate,
        weekEndDate,
        ageGroup,
        cycleId: activeCycle?.id
          ? Number(activeCycle.id)
          : dto.cycleWeekNumber
            ? Number(dto.cycleWeekNumber)
            : undefined,
      },
      userId,
      standard?.id ? Number(standard.id) : undefined,
    );

    const version = await this.versionRepo.findOne({
      where: { menuId: Number(created.id) },
      order: { versionNumber: "DESC" },
    });

    if (version) {
      const days = await this.dayRepo.find({
        where: { menuVersionId: version.id },
        relations: ["meals"],
        order: { dayOfWeek: "ASC" },
      });

      for (let i = 0; i < days.length; i++) {
        const day = days[i];
        // DB uses 2..6; preview uses 1..5. Select one convention for the entire plan.
        const dayPlan = planToSave.find(
          (p) => p.dayOfWeek === day.dayOfWeek - 1 + planDayOffset,
        );

        if (!dayPlan || !dayPlan.dishes) continue;

        for (const meal of day.meals || []) {
          const matchingDishes = dayPlan.dishes.filter(
            (d: any) => d.mealTime === meal.mealType,
          );
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
          const ruleCode = v.split(":")[0]?.trim() || "NUTRITION_VIOLATION";
          const severity =
            ruleCode.includes("CALORIE") || ruleCode.includes("CYCLE")
              ? "ERROR"
              : "WARNING";
          await this.violationRepo.save(
            this.violationRepo.create({
              menuVersionId: version.id,
              ruleCode,
              severity,
              message: v,
            }),
          );
        }
        this.logger.warn(
          `⚠️ Đã ghi ${allViolations.length} vi phạm vào menu_rule_violations cho menu #${created.id}`,
        );
      }
    }

    return this.findOne(Number(created.id));
  }

  // ── Helper: Giới hạn tối đa số lần xuất hiện trong chu kỳ 4 tuần ───────────
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
        return 2; // Món mặn tối đa 2 lần trong chu kỳ 4 tuần
      case "SOUP":
        return 3; // Món canh tối đa 3 lần trong chu kỳ 4 tuần
      case "DESSERT":
        return 4; // Tráng miệng tối đa 4 lần trong chu kỳ 4 tuần
      case "SNACK_AFTERNOON":
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
