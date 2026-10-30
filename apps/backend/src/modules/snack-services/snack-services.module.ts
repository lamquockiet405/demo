import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SnackServiceEntity } from './entities/snack-service.entity';
import { SnackServicePeriodEntity } from './entities/snack-service-period.entity';
import { Child } from '../children/entities/child.entity';
import { ClassEntity } from '../classes/entities/class.entity';
import { SnackServicesService } from './snack-services.service';
import { SnackServicesController } from './snack-services.controller';

@Module({
  imports: [

    TypeOrmModule.forFeature([
      SnackServiceEntity,
      SnackServicePeriodEntity,
      Child,
      ClassEntity,
    ]),

  ],
  controllers: [SnackServicesController],
  providers: [SnackServicesService],
  exports: [SnackServicesService, TypeOrmModule],
})
export class SnackServicesModule {}
