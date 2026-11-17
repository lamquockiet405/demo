import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FoodSafetyController } from './controllers/food-safety.controller';
import { FoodSafetyService } from './services/food-safety.service';
import { InspectionRecord } from '../inspections/entities/inspection-record.entity';
import { InspectionImage } from '../inspections/entities/inspection-image.entity';
import { InspectionSampleItem } from '../inspections/entities/inspection-sample-item.entity';
import { StaffProfile } from '../users/entities/staff-profile.entity';
import { User } from '../auth/entities/user.entity';
import { MealCoordinationNote } from '../attendance/entities/meal-coordination-note.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InspectionRecord,
      InspectionImage,
      InspectionSampleItem,
      StaffProfile,
      User,
      MealCoordinationNote,
    ]),
    AuditLogsModule,
  ],
  controllers: [FoodSafetyController],
  providers: [FoodSafetyService],
  exports: [FoodSafetyService],
})
export class FoodSafetyModule {}

