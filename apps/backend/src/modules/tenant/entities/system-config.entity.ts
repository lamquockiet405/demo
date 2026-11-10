import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
import { BigIntTransformer } from '../../../database/base.entity';

@Entity('system_configs')
@Index('uq_system_configs_global_key', ['configKey'], { unique: true, where: 'school_id IS NULL' })
@Index('uq_system_configs_school_key', ['schoolId', 'configKey'], { unique: true, where: 'school_id IS NOT NULL' })
export class SystemConfig {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'school_id', type: 'bigint', transformer: BigIntTransformer, nullable: true })
  schoolId: number | null;

  @Column({ name: 'config_key', length: 100 })
  configKey: string;

  @Column({ name: 'config_value', type: 'text', nullable: true })
  configValue: string;

  @Column({ type: 'text', nullable: true })
  description: string;
}
