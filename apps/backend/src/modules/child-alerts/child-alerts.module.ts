import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Child } from '../children/entities/child.entity';
import { ClassEntity } from '../classes/entities/class.entity';
import { ChildAllergy } from '../children/entities/child-allergy.entity';
import { DailyMealAttendance } from '../attendance/entities/daily-meal-attendance.entity';
import { GrowthRecord, GrowthZscore } from '../growth/entities/growth-record.entity';
import { Menu } from '../menus/entities/menu.entity';
import { SnackRegistration } from '../snack-services/entities/snack-registration.entity';
import { SnackServicePeriod } from '../snack-services/entities/snack-service-period.entity';
import { ParentEvaluation } from '../parent-evaluations/entities/parent-evaluation.entity';
import { ChildAlertsService } from './services/child-alerts.service';
import { ChildAlertsController } from './controllers/child-alerts.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Child,
      ClassEntity,
      ChildAllergy,
      DailyMealAttendance,
      GrowthRecord,
      GrowthZscore,
      Menu,
      SnackRegistration,
      SnackServicePeriod,
      ParentEvaluation,
    ]),
  ],
  controllers: [ChildAlertsController],
  providers: [ChildAlertsService],
  exports: [ChildAlertsService],
})
export class ChildAlertsModule {}

