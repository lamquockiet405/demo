import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { NutritionalStandard } from '../entities/nutrition-rule.entity';
import { NutritionCalculatorService } from './nutrition-calculator.service';
import { Dish } from '../../dishes/entities/dish.entity';
import { EvaluateMenuDto } from '../dto/evaluate-menu.dto';
import { MenuVersion } from '../../menus/entities/menu-version.entity';
import { getPortionNutrition, hasVerifiedNutrition } from '../../dishes/nutrition.util';

export interface ViolationItem {
  ruleCode: string;
  ruleName: string;
  severity: 'INFO' | 'WARNING' | 'ERROR';
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
    let ageGroup = dto.ageGroup || dto.targetAgeGroup || 'MAU_GIAO';
    let dayCount = 1;
    let menuTitle = '';
    const selections: Array<{ dish: Dish; portionSizeG?: number }> = [];

    if (dto.dishes !== undefined) {
      const loaded = dto.dishes.length ? await this.dishRepo.find({
        where: { id: In(dto.dishes.map((item) => item.dishId)) }, relations: ['nutrition'],
      }) : [];
      for (const item of dto.dishes) {
        const dish = loaded.find((candidate) => Number(candidate.id) === Number(item.dishId));
        if (!dish) throw new NotFoundException(`Không tìm thấy món ăn ${item.dishId}`);
        selections.push({ dish, portionSizeG: item.portionSizeG });
      }
    } else if (dto.menuId) {
      const version = await this.versionRepo.findOne({
        where: { menuId: dto.menuId }, order: { versionNumber: 'DESC' },
        relations: ['menu', 'days', 'days.meals', 'days.meals.dishes', 'days.meals.dishes.dish', 'days.meals.dishes.dish.nutrition'],
      });
      if (!version) throw new NotFoundException('Không tìm thấy phiên bản thực đơn');
      ageGroup = version.menu.ageGroup;
      menuTitle = version.menu.title;
      const days = (version.days || []).filter((day) => !dto.targetDate || day.date === dto.targetDate);
      if (dto.targetDate && !days.length) throw new NotFoundException('Ngày đánh giá không thuộc thực đơn');
      dayCount = Math.max(days.length, 1);
      for (const day of days) for (const meal of day.meals || []) for (const item of meal.dishes || []) {
        selections.push({ dish: item.dish, portionSizeG: item.portionSizeG });
      }
    }
    const missing = selections.filter(({ dish }) => !hasVerifiedNutrition(dish));
    if (missing.length) {
      throw new BadRequestException(`Chưa có công thức định lượng được xác nhận: ${[...new Set(missing.map(({ dish }) => dish?.name || 'Món ăn'))].join(', ')}`);
    }

    const standard = await this.standardRepo.findOne({
      where: [
        { ageGroup, mealScope: 'FULL_DAY', status: 'ACTIVE' },
        { ageGroup, mealScope: 'ALL_DAY', status: 'ACTIVE' },
        { ageGroup, mealScope: 'DAYBOARDING', status: 'ACTIVE' },
      ],
    });

    const dishesNutrition = selections.map(({ dish, portionSizeG }) => {
      const nutrients = getPortionNutrition(dish, portionSizeG);
      // Weekly evaluation compares the daily average with daily standards.
      return Object.fromEntries(Object.entries(nutrients).map(([key, value]) => [key, value / dayCount])) as typeof nutrients;
    });

    const summary = this.calculator.calculateMacros(dishesNutrition);
    const violations: ViolationItem[] = [];
    if (!selections.length) violations.push({
      ruleCode: 'NO_DISHES', ruleName: 'Chưa có món ăn', severity: 'ERROR',
      message: 'Chọn thực đơn hoặc món ăn cần đánh giá.',
    });

    const minEnergy = standard ? standard.minEnergyKcal : (ageGroup === 'MAU_GIAO' ? 615 : 600);
    const maxEnergy = standard ? standard.maxEnergyKcal : (ageGroup === 'MAU_GIAO' ? 738 : 651);
    const minProteinPct = standard ? standard.minProteinPct : 13;
    const maxProteinPct = standard ? standard.maxProteinPct : 20;
    const minFatPct = standard ? standard.minFatPct : (ageGroup === 'MAU_GIAO' ? 25 : 30);
    const maxFatPct = standard ? standard.maxFatPct : (ageGroup === 'MAU_GIAO' ? 35 : 40);
    const minCarbPct = standard ? standard.minCarbPct : 52;
    const maxCarbPct = standard ? standard.maxCarbPct : 60;

    // 1. Check Energy
    if (summary.energyKcal < minEnergy) {
      violations.push({
        ruleCode: 'CALORIE_DEFICIT',
        ruleName: 'Thiếu năng lượng Kcal',
        severity: 'ERROR',
        message: `Tổng năng lượng ${summary.energyKcal} kcal chưa đạt chuẩn tối thiểu ${minEnergy} kcal (Thông tư 28/2016/TT-BGDĐT)`,
        actualValue: summary.energyKcal,
        expectedRange: `${minEnergy} - ${maxEnergy} kcal`,
      });
    } else if (summary.energyKcal > maxEnergy) {
      violations.push({
        ruleCode: 'CALORIE_EXCESS',
        ruleName: 'Vượt năng lượng Kcal',
        severity: 'WARNING',
        message: `Tổng năng lượng ${summary.energyKcal} kcal vượt ngưỡng tối đa ${maxEnergy} kcal`,
        actualValue: summary.energyKcal,
        expectedRange: `${minEnergy} - ${maxEnergy} kcal`,
      });
    }

    // 2. Check Protein%
    if (summary.proteinPct < minProteinPct || summary.proteinPct > maxProteinPct) {
      violations.push({
        ruleCode: 'PROTEIN_OUT_OF_RANGE',
        ruleName: 'Tỷ lệ Đạm (P%) ngoài khoảng',
        severity: 'WARNING',
        message: `Tỷ lệ đạm ${summary.proteinPct}% nằm ngoài khoảng chuẩn ${minProteinPct}% - ${maxProteinPct}%`,
        actualValue: summary.proteinPct,
        expectedRange: `${minProteinPct}% - ${maxProteinPct}%`,
      });
    }

    // 3. Check Fat%
    if (summary.fatPct < minFatPct || summary.fatPct > maxFatPct) {
      violations.push({
        ruleCode: 'FAT_OUT_OF_RANGE',
        ruleName: 'Tỷ lệ Béo (L%) ngoài khoảng',
        severity: 'WARNING',
        message: `Tỷ lệ chất béo ${summary.fatPct}% nằm ngoài khoảng chuẩn ${minFatPct}% - ${maxFatPct}%`,
        actualValue: summary.fatPct,
        expectedRange: `${minFatPct}% - ${maxFatPct}%`,
      });
    }

    // 4. Check Carb%
    if (summary.carbPct < minCarbPct || summary.carbPct > maxCarbPct) {
      violations.push({
        ruleCode: 'CARB_OUT_OF_RANGE',
        ruleName: 'Tỷ lệ Bột đường (G%) ngoài khoảng',
        severity: 'WARNING',
        message: `Tỷ lệ bột đường ${summary.carbPct}% nằm ngoài khoảng chuẩn ${minCarbPct}% - ${maxCarbPct}%`,
        actualValue: summary.carbPct,
        expectedRange: `${minCarbPct}% - ${maxCarbPct}%`,
      });
    }

    const hasError = violations.some((v) => v.severity === 'ERROR');
    const hasWarning = violations.some((v) => v.severity === 'WARNING');
    const overallStatus: 'PASS' | 'WARNING' | 'VIOLATION' = hasError
      ? 'VIOLATION'
      : hasWarning
      ? 'WARNING'
      : 'PASS';

    const complianceScore = violations.length === 0 ? 100 : hasError ? 68 : 88;

    const mappedViolations = violations.map((v) => ({
      code: v.ruleCode,
      severity: v.severity === 'ERROR' ? ('CRITICAL' as const) : ('WARNING' as const),
      category: 'MACRO_NUTRIENT' as const,
      title: v.ruleName,
      message: v.message,
      recommendation: 'Cân chỉnh thực phẩm giàu đạm, rau củ để đạt cân đối theo Thông tư 28.',
    }));

    return {
      menuId: dto.menuId ? String(dto.menuId) : null,
      menuTitle: menuTitle || `Thực đơn ${ageGroup === 'NHA_TRE' ? 'Nhà trẻ' : 'Mẫu giáo'} bán trú`,
      targetAgeGroup: ageGroup,
      appliedRuleName: `Thông tư 28/2016/TT-BGDĐT (${ageGroup === 'NHA_TRE' ? 'Nhà trẻ' : 'Mẫu giáo'})`,
      complianceScore,
      overallStatus,
      summaryNutrition: {
        totalEnergyKcal: Math.round(summary.energyKcal),
        totalProteinG: summary.proteinG,
        totalLipidG: summary.fatG,
        totalGlucidG: summary.carbG,
        proteinCalories: Math.round(summary.proteinG * 4),
        lipidCalories: Math.round(summary.fatG * 9),
        glucidCalories: Math.round(summary.carbG * 4),
        proteinRatioPercent: summary.proteinPct,
        lipidRatioPercent: summary.fatPct,
        glucidRatioPercent: summary.carbPct,
        calciumMg: summary.calciumMg,
        ironMg: summary.ironMg,
        zincMg: summary.zincMg,
        caPRatio: null,
      },
      standardReference: {
        minEnergyKcal: minEnergy,
        maxEnergyKcal: maxEnergy,
        minProteinPercent: minProteinPct,
        maxProteinPercent: maxProteinPct,
        minFatPercent: minFatPct,
        maxFatPercent: maxFatPct,
        minCarbPercent: minCarbPct,
        maxCarbPercent: maxCarbPct,
      },
      violations: mappedViolations,
      actionableRecommendations: violations.length > 0
        ? [
            'Tăng cường món đạm nạc và cá để đạt tỷ lệ Protein 13-20%',
            'Kiểm tra định lượng dầu/mỡ khi chế biến món xào để đảm bảo Lipid không vượt ngưỡng 35%',
            'Đối chiếu cảnh báo chất dị ứng trong thực đơn đối với các bé có tiền sử dị ứng',
          ]
        : ['Thực đơn đạt chuẩn cân đối năng lượng và vi chất theo Thông tư 28/2016/TT-BGDĐT.'],
      // Backwards compatibility:
      isCompliant: !hasError,
      hasWarnings: violations.length > 0,
      evaluatedAt: new Date().toISOString(),
      standardCode: 'Circular 28/2016/TT-BGDĐT',
      summary,
      targetStandards: {
        energyRange: `${minEnergy} - ${maxEnergy} kcal`,
        proteinPctRange: `${minProteinPct}% - ${maxProteinPct}%`,
        fatPctRange: `${minFatPct}% - ${maxFatPct}%`,
        carbPctRange: `${minCarbPct}% - ${maxCarbPct}%`,
      },
    };
  }
}
