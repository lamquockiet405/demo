import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyMealAttendance } from './entities/daily-meal-attendance.entity';
import { MealCoordinationNote } from './entities/meal-coordination-note.entity';
import { ClassEntity } from '../classes/entities/class.entity';
import { Child } from '../children/entities/child.entity';
import { SnackRegistration } from '../snack-services/entities/snack-registration.entity';
import { SnackServicePeriod } from '../snack-services/entities/snack-service-period.entity';
import { AttendanceService } from './services/attendance.service';
import { MealCoordinationService } from './services/meal-coordination.service';
import { SnackRosterService } from './services/snack-roster.service';
import { AttendanceHistoryService } from './services/attendance-history.service';
import { AttendanceController } from './attendance.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DailyMealAttendance,
      MealCoordinationNote,
      ClassEntity,
      Child,
      SnackRegistration,
      SnackServicePeriod,
    ]),
  ],
  controllers: [AttendanceController],
  providers: [
    AttendanceService,
    MealCoordinationService,
    SnackRosterService,
    AttendanceHistoryService,
  ],
  exports: [
    AttendanceService,
    MealCoordinationService,
    SnackRosterService,
    AttendanceHistoryService,
    TypeOrmModule,
  ],
})
export class AttendanceModule {}
