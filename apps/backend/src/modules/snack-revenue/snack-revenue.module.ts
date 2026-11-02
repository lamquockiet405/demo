import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnackRevenueController } from './controllers/snack-revenue.controller';
import { SnackRevenueService } from './services/snack-revenue.service';
import { SnackServicePeriod } from '../snack-services/entities/snack-service-period.entity';
import { SnackRegistration } from '../snack-services/entities/snack-registration.entity';
import { Payment } from '../payments/entities/payment.entity';
import { DailyMealAttendance } from '../attendance/entities/daily-meal-attendance.entity';
import { Child } from '../children/entities/child.entity';
import { ClassEntity } from '../classes/entities/class.entity';
import { User } from '../auth/entities/user.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SnackServicePeriod,
      SnackRegistration,
      Payment,
      DailyMealAttendance,
      Child,
      ClassEntity,
      User,
    ]),
    AuditLogsModule,
  ],
  controllers: [SnackRevenueController],
  providers: [SnackRevenueService],
  exports: [SnackRevenueService],
})
export class SnackRevenueModule {}

