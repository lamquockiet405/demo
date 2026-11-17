import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParentEvaluation, EvaluationReply } from './entities/parent-evaluation.entity';
import { Child } from '../children/entities/child.entity';
import { ClassEntity } from '../classes/entities/class.entity';
import { Dish } from '../dishes/entities/dish.entity';
import { DailyMealAttendance } from '../attendance/entities/daily-meal-attendance.entity';
import { ParentEvaluationService } from './services/parent-evaluation.service';
import { ParentEvaluationsController } from './controllers/parent-evaluations.controller';
import { MenusModule } from '../menus/menus.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ParentEvaluation,
      EvaluationReply,
      Child,
      ClassEntity,
      Dish,
      DailyMealAttendance,
    ]),
    // Đọc thực đơn trường đã công bố cho trang "Thực đơn & Sức ăn của Bé"
    MenusModule,
  ],
  controllers: [ParentEvaluationsController],
  providers: [ParentEvaluationService],
  exports: [ParentEvaluationService],
})
export class ParentEvaluationsModule {}
