import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NutritionalStandard } from "./entities/nutrition-rule.entity";
import { RuleViolationLog } from "./entities/rule-violation-log.entity";
import { AllergenCatalog } from "../children/entities/allergen-catalog.entity";
import { Dish } from "../dishes/entities/dish.entity";
import { DishCategory } from "../dishes/entities/dish-category.entity";
import { FoodCategory } from "../foods/entities/food-category.entity";
import { MenuVersion } from "../menus/entities/menu-version.entity";

// 3 Entities mới cho Cơ cấu Bữa ăn, Tần suất & Giãn cách
import { DishFrequencyRule } from "./entities/dish-frequency-rule.entity";
import { DishSpacingRule } from "./entities/dish-spacing-rule.entity";
import { NutritionIntakeStandard } from "./entities/nutrition-intake-standard.entity";

// Services
import { NutritionCalculatorService } from "./services/nutrition-calculator.service";
import { MenuScannerService } from "./services/menu-scanner.service";
import { AllergyValidatorService } from "./services/allergy-validator.service";
import { NutritionRulesService } from "./services/nutrition-rules.service";
import { AllergenRulesService } from "./services/allergen-rules.service";
import { RuleEngineService } from "./services/rule-engine.service";
import { FrequencyRulesService } from "./services/frequency-rules.service";
import { SpacingRulesService } from "./services/spacing-rules.service";
import { IntakeStandardsService } from "./services/intake-standards.service";

// Controllers
import { NutritionStandardsController } from "./controllers/nutrition-standards.controller";
import { AllergenRulesController } from "./controllers/allergen-rules.controller";
import { MenuScannerController } from "./controllers/menu-scanner.controller";
import { FrequencyRulesController } from "./controllers/frequency-rules.controller";
import { SpacingRulesController } from "./controllers/spacing-rules.controller";
import { IntakeStandardsController } from "./controllers/intake-standards.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NutritionalStandard,
      RuleViolationLog,
      AllergenCatalog,
      Dish,
      DishCategory,
      FoodCategory,
      MenuVersion,
      DishFrequencyRule,
      DishSpacingRule,
      NutritionIntakeStandard,
    ]),
  ],
  controllers: [
    AllergenRulesController,
    MenuScannerController,
    FrequencyRulesController,
    SpacingRulesController,
    IntakeStandardsController,
    NutritionStandardsController,
  ],
  providers: [
    NutritionCalculatorService,
    MenuScannerService,
    AllergyValidatorService,
    NutritionRulesService,
    AllergenRulesService,
    RuleEngineService,
    FrequencyRulesService,
    SpacingRulesService,
    IntakeStandardsService,
  ],
  exports: [
    NutritionCalculatorService,
    MenuScannerService,
    AllergyValidatorService,
    NutritionRulesService,
    AllergenRulesService,
    RuleEngineService,
    FrequencyRulesService,
    SpacingRulesService,
    IntakeStandardsService,
    TypeOrmModule,
  ],
})
export class NutritionEngineModule {}
