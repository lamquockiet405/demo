import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Menu } from './entities/menu.entity';
import { MenuVersion } from './entities/menu-version.entity';
import { MenuDay } from './entities/menu-day.entity';
import { MenuMeal } from './entities/menu-meal.entity';
import { MenuDish } from './entities/menu-dish.entity';
import { MenuCycle } from './entities/menu-cycle.entity';
import { Dish } from '../dishes/entities/dish.entity';
import { NutritionalStandard } from './entities/nutritional-standard.entity';
import { MenuRuleViolation } from './entities/menu-rule-violation.entity';
import { MenusService } from './services/menus.service';
import { MenuExportService } from './services/menu-export.service';
import { MenusController } from './controllers/menus.controller';
import { DishFrequencyRule } from '../nutrition-engine/entities/dish-frequency-rule.entity';
import { DishSpacingRule } from '../nutrition-engine/entities/dish-spacing-rule.entity';
import { NutritionIntakeStandard } from '../nutrition-engine/entities/nutrition-intake-standard.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Menu,
      MenuVersion,
      MenuDay,
      MenuMeal,
      MenuDish,
      MenuCycle,
      Dish,
      NutritionalStandard,
      MenuRuleViolation,
      DishFrequencyRule,
      DishSpacingRule,
      NutritionIntakeStandard,
    ]),
  ],
  controllers: [MenusController],
  providers: [MenusService, MenuExportService],
  exports: [MenusService, TypeOrmModule],
})
export class MenusModule {}
