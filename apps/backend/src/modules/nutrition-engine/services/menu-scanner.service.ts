import { configuredMenuCriteria, MenuSlot } from "./menu-criteria";
import { DishFrequencyRule } from "../entities/dish-frequency-rule.entity";
import { DishSpacingRule } from "../entities/dish-spacing-rule.entity";
import { matchesDeclaredAllergy } from "../../menus/services/allergy-matching";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { NutritionalStandard } from "../entities/nutrition-rule.entity";
import { NutritionCalculatorService } from "./nutrition-calculator.service";
import { Dish } from "../../dishes/entities/dish.entity";
import { EvaluateMenuDto } from "../dto/evaluate-menu.dto";
import { MenuVersion } from "../../menus/entities/menu-version.entity";
import {
  getPortionNutrition,
  hasVerifiedNutrition,
} from "../../dishes/nutrition.util";

export interface ViolationItem {
  ruleCode: string;
  ruleName: string;
  severity: "INFO" | "WARNING" | "ERROR";
  message: string;
  actualValue?: number;
  expectedRange?: string;
}

@Injectable()
export class MenuScannerService {
  constructor(
    @InjectRepository(NutritionalStandard)
    private readonly standardRepo: Repository<NutritionalStandard>,
    @InjectRepository(Dish)
    private readonly dishRepo: Repository<Dish>,
    private readonly calculator: NutritionCalculatorService,
    @InjectRepository(MenuVersion)
    private readonly versionRepo: Repository<MenuVersion>,
  ) {}

  async evaluateMenu(dto: EvaluateMenuDto) {
    let ageGroup = dto.ageGroup || dto.targetAgeGroup || "MAU_GIAO";
    let dayCount = 1;
    let menuTitle = "";
    const slots: MenuSlot[] = [];
    const selections: Array<{ dish: Dish; portionSizeG?: number }> = [];

    if (dto.dishes !== undefined) {
      const loaded = dto.dishes.length
        ? await this.dishRepo.find({
            where: { id: In(dto.dishes.map((item) => item.dishId)) },
            relations: [
              "nutrition",
              "category",
              "recipes",
              "recipes.ingredient",
              "dishAllergens",
            ],
          })
        : [];
      for (const item of dto.dishes) {
        const dish = loaded.find(
          (candidate) => Number(candidate.id) === Number(item.dishId),
        );
        if (!dish)
          throw new NotFoundException(`Không tìm thấy món ăn ${item.dishId}`);
        selections.push({ dish, portionSizeG: item.portionSizeG });
      }
    } else if (dto.menuId) {
      const version = await this.versionRepo.findOne({
        where: { menuId: dto.menuId },
        order: { versionNumber: "DESC" },
        relations: [
          "menu",
          "days",
          "days.meals",
          "days.meals.dishes",
          "days.meals.dishes.dish",
          "days.meals.dishes.dish.nutrition",
          "days.meals.dishes.dish.category",
          "days.meals.dishes.dish.recipes",
          "days.meals.dishes.dish.recipes.ingredient",
          "days.meals.dishes.dish.dishAllergens",
        ],
      });
      if (!version)
        throw new NotFoundException("Không tìm thấy phiên bản thực đơn");
      ageGroup = version.menu.ageGroup;
      menuTitle = version.menu.title;
      const days = (version.days || []).filter(
        (day) => !dto.targetDate || day.date === dto.targetDate,
      );
      if (dto.targetDate && !days.length)
        throw new NotFoundException("Ngày đánh giá không thuộc thực đơn");
      dayCount = Math.max(days.length, 1);
      for (const day of days)
        for (const meal of day.meals || [])
          for (const item of meal.dishes || []) {
            selections.push({
              dish: item.dish,
              portionSizeG: item.portionSizeG,
            });
            slots.push({
              date: day.date,
              meal: meal.mealType,
              dishId: Number(item.dishId),
              categoryId: Number(item.dish?.categoryId),
              categoryCode: item.dish?.category?.code,
              foodGroupIds: (item.dish?.recipes || [])
                .map((r) => Number(r.ingredient?.categoryId))
                .filter(Boolean),
            });
          }
    }
    const missing = selections.filter(
      ({ dish }) => !hasVerifiedNutrition(dish),
    );
    if (missing.length) {
      throw new BadRequestException(
        `Chưa có công thức định lượng được xác nhận: ${[...new Set(missing.map(({ dish }) => dish?.name || "Món ăn"))].join(", ")}`,
      );
    }

    const standard = await this.standardRepo.findOne({
      where: [
        { ageGroup, mealScope: "FULL_DAY", status: "ACTIVE" },
        { ageGroup, mealScope: "ALL_DAY", status: "ACTIVE" },
        { ageGroup, mealScope: "DAYBOARDING", status: "ACTIVE" },
      ],
    });

    const dishesNutrition = selections.map(({ dish, portionSizeG }) => {
      const nutrients = getPortionNutrition(dish, portionSizeG);
      // Weekly evaluation compares the daily average with daily standards.
      return Object.fromEntries(
        Object.entries(nutrients).map(([key, value]) => [
          key,
          value / dayCount,
        ]),
      ) as typeof nutrients;
    });

    const summary = this.calculator.calculateMacros(dishesNutrition);
    const violations: ViolationItem[] = [];
    if (!selections.length)
      violations.push({
        ruleCode: "NO_DISHES",
        ruleName: "Chưa có món ăn",
        severity: "ERROR",
        message: "Chọn thực đơn hoặc món ăn cần đánh giá.",
      });

    const minEnergy =
        standard?.minEnergyKcal == null ? null : Number(standard.minEnergyKcal),
      maxEnergy =
        standard?.maxEnergyKcal == null ? null : Number(standard.maxEnergyKcal),
      minProteinPct =
        standard?.minProteinPct == null ? null : Number(standard.minProteinPct),
      maxProteinPct =
        standard?.maxProteinPct == null ? null : Number(standard.maxProteinPct),
      minFatPct =
        standard?.minFatPct == null ? null : Number(standard.minFatPct),
      maxFatPct =
        standard?.maxFatPct == null ? null : Number(standard.maxFatPct),
      minCarbPct =
        standard?.minCarbPct == null ? null : Number(standard.minCarbPct),
      maxCarbPct =
        standard?.maxCarbPct == null ? null : Number(standard.maxCarbPct);
    let frequency: any[] = [],
      spacing: any[] = [],
      conflicts: string[] | null = null;
    if (dto.menuId && this.versionRepo.manager) {
      frequency = (
        await this.versionRepo.manager
          .getRepository(DishFrequencyRule)
          .find({ where: { isActive: true } })
      ).filter((r) => r.ageGroup === "ALL" || r.ageGroup === ageGroup);
      spacing = (
        await this.versionRepo.manager
          .getRepository(DishSpacingRule)
          .find({ where: { isActive: true } })
      ).filter((r) => r.ageGroup === "ALL" || r.ageGroup === ageGroup);
      const declarations = await this.versionRepo.manager.query(
        `SELECT sa.student_id,s.full_name,a.name,a.code,sa.allergen_id,sa.custom_allergen_name FROM student_allergies sa JOIN students s ON s.id=sa.student_id LEFT JOIN allergens a ON a.id=sa.allergen_id WHERE sa.is_active=true AND s.id IN (${currentStudentIdsSql()})`,
      );
      conflicts = [];
      for (const declaration of declarations)
        for (const { dish } of selections) {
          if (
            matchesDeclaredAllergy(
              {
                name:
                  declaration.name || declaration.custom_allergen_name || "",
                code: declaration.code,
                catalogId: declaration.allergen_id,
              },
              {
                name: dish.name,
                ingredients: (dish.recipes || []).map(
                  (r) => r.ingredient?.name || "",
                ),
                allergenIds: (dish.dishAllergens || []).map((a) =>
                  Number(a.allergenId),
                ),
              },
            )
          ) {
            const text =
              declaration.full_name +
              " · " +
              dish.name +
              " · " +
              (declaration.name || declaration.custom_allergen_name);
            if (!conflicts.includes(text)) conflicts.push(text);
          }
        }
    }
    const criteria = configuredMenuCriteria(
      summary,
      standard,
      slots,
      frequency,
      spacing,
      conflicts,
    );
    for (const criterion of criteria.filter((c) => c.status === "FAIL"))
      for (const finding of criterion.findings)
        violations.push({
          ruleCode: criterion.key,
          ruleName: criterion.name,
          severity: "ERROR",
          message: finding,
        });
    for (const criterion of criteria.filter((c) => c.status === "UNKNOWN"))
      violations.push({
        ruleCode: criterion.key + "_UNKNOWN",
        ruleName: criterion.name,
        severity: "WARNING",
        message: criterion.findings.join(" "),
      });

    const overallStatus = violations.some((v) => v.severity === "ERROR")
      ? "VIOLATION"
      : violations.length
        ? "WARNING"
        : "PASS";
    const evaluated = criteria.filter((c) => c.status !== "UNKNOWN");
    const complianceScore = evaluated.length
      ? Math.round(
          (evaluated.filter((c) => c.status === "PASS").length /
            evaluated.length) *
            100,
        )
      : null;
    const mappedViolations = violations.map((v) => ({
      code: v.ruleCode,
      severity: v.severity === "ERROR" ? "CRITICAL" : "WARNING",
      category: v.ruleCode,
      title: v.ruleName,
      message: v.message,
      recommendation:
        "Đối chiếu tiêu chuẩn và điều chỉnh dữ liệu cấu hình hoặc thực đơn.",
    }));
    const standardReference = {
      minEnergyKcal: minEnergy,
      maxEnergyKcal: maxEnergy,
      minProteinPercent: minProteinPct,
      maxProteinPercent: maxProteinPct,
      minFatPercent: minFatPct,
      maxFatPercent: maxFatPct,
      minCarbPercent: minCarbPct,
      maxCarbPercent: maxCarbPct,
    };
    return {
      menuId: dto.menuId ? String(dto.menuId) : null,
      menuTitle,
      targetAgeGroup: ageGroup,
      appliedRuleName: `Tiêu chuẩn ${standard?.ageGroup} · ${standard?.mealScope}`,
      criteria,
      complianceScore,
      overallStatus,
      summaryNutrition: {
        totalEnergyKcal: summary.energyKcal,
        totalProteinG: summary.proteinG,
        totalLipidG: summary.fatG,
        totalGlucidG: summary.carbG,
        proteinCalories: summary.proteinG * 4,
        lipidCalories: summary.fatG * 9,
        glucidCalories: summary.carbG * 4,
        proteinRatioPercent: summary.proteinPct,
        lipidRatioPercent: summary.fatPct,
        glucidRatioPercent: summary.carbPct,
        calciumMg: summary.calciumMg,
        ironMg: summary.ironMg,
        zincMg: summary.zincMg,
        caPRatio: null,
      },
      standardReference,
      violations: mappedViolations,
      actionableRecommendations: mappedViolations.map((v) => v.message),
      isCompliant: overallStatus === "PASS",
      hasWarnings: violations.length > 0,
      evaluatedAt: new Date().toISOString(),
      summary,
    };
  }
}
import { currentStudentIdsSql } from '../../academic-years/current-year-scope';
