import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyMealPortion } from './entities/daily-meal-portion.entity';
import { ClassEntity } from '../classes/entities/class.entity';
import { SnackRegistration } from '../snack-services/entities/snack-registration.entity';
import { MealPortionsService } from './services/meal-portions.service';
import { MealPortionsController } from './meal-portions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DailyMealPortion, ClassEntity, SnackRegistration])],
  controllers: [MealPortionsController],
  providers: [MealPortionsService],
  exports: [MealPortionsService, TypeOrmModule],
})
export class MealPortionsModule {}
