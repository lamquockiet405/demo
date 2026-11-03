import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Menu } from '../menus/entities/menu.entity';
import { PurchasingService } from './services/purchasing.service';
import { PurchasingController } from './controllers/purchasing.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Menu])],
  controllers: [PurchasingController],
  providers: [PurchasingService],
  exports: [PurchasingService],
})
export class PurchasingModule {}

