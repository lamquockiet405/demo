import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant, SchoolTenant } from '../auth/entities/tenant.entity';
import { User } from '../auth/entities/user.entity';
import { TenantController } from './controllers/tenant.controller';
import { TenantService } from './services/tenant.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, SchoolTenant, User])],
  controllers: [TenantController],
  providers: [TenantService],
  exports: [TenantService],
})
export class TenantModule {}
