import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MealOperationsController } from './controllers/meal-operations.controller';
import { MealOperationsService } from './services/meal-operations.service';
import { DailyMealAttendance } from '../attendance/entities/daily-meal-attendance.entity';
import { DailyMealPortion } from '../meal-portions/entities/daily-meal-portion.entity';
import { InspectionRecord } from '../inspections/entities/inspection-record.entity';
import { InspectionSampleItem } from '../inspections/entities/inspection-sample-item.entity';
import { MealCoordinationNote } from '../attendance/entities/meal-coordination-note.entity';
import { Child } from '../children/entities/child.entity';
import { ClassEntity } from '../classes/entities/class.entity';
import { ChildAllergy } from '../children/entities/child-allergy.entity';
import { User } from '../auth/entities/user.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DailyMealAttendance,
      DailyMealPortion,
      InspectionRecord,
      InspectionSampleItem,
      MealCoordinationNote,
      Child,
      ClassEntity,
      ChildAllergy,
      User,
    ]),
    AuditLogsModule,
  ],
  controllers: [MealOperationsController],
  providers: [MealOperationsService],
  exports: [MealOperationsService],
})
export class MealOperationsModule {}

