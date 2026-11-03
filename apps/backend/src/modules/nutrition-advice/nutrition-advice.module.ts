import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PickyEatingAdvice } from './entities/picky-eating-advice.entity';
import { Child } from '../children/entities/child.entity';
import { NutritionAdviceService } from './services/nutrition-advice.service';
import { NutritionAdviceController } from './controllers/nutrition-advice.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([PickyEatingAdvice, Child]),
  ],
  controllers: [NutritionAdviceController],
  providers: [NutritionAdviceService],
  exports: [NutritionAdviceService, TypeOrmModule],
})
export class NutritionAdviceModule {}

