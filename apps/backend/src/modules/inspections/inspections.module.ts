import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InspectionRecord } from './entities/inspection-record.entity';
import { InspectionSampleItem } from './entities/inspection-sample-item.entity';
import { InspectionImage } from './entities/inspection-image.entity';
import { InspectionsService } from './inspections.service';
import { InspectionsController } from './inspections.controller';

import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InspectionRecord,
      InspectionSampleItem,
      InspectionImage,
    ]),
    WebsocketModule,
  ],
  controllers: [InspectionsController],
  providers: [
    {
      provide: 'InspectionsService',
      useClass: InspectionsService,
    },
    InspectionsService,
  ],
  exports: [InspectionsService, TypeOrmModule],
})
export class InspectionsModule {}
