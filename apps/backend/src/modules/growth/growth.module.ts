import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GrowthRecord, GrowthZscore } from './entities/growth-record.entity';
import { WhoGrowthStandard } from './entities/who-growth-standard.entity';
import { Child } from '../children/entities/child.entity';
import { ClassEntity } from '../classes/entities/class.entity';
import { DailyMealAttendance } from '../attendance/entities/daily-meal-attendance.entity';
import { WhoZscoreService } from './services/who-zscore.service';
import { GrowthService } from './services/growth.service';
import { GrowthDispatchService } from './services/growth-dispatch.service';
import { GrowthController } from './controllers/growth.controller';
import { GrowthDispatchController } from './controllers/growth-dispatch.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GrowthRecord,
      GrowthZscore,
      WhoGrowthStandard,
      Child,
      ClassEntity,
      DailyMealAttendance,
    ]),
  ],
  controllers: [GrowthController, GrowthDispatchController],
  providers: [GrowthService, WhoZscoreService, GrowthDispatchService],
  exports: [GrowthService, WhoZscoreService, GrowthDispatchService],
})
export class GrowthModule {}
