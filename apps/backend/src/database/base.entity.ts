import {
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  BaseEntity as TypeOrmBaseEntity,
} from 'typeorm';

export const BigIntTransformer = {
  to: (value?: number | null): number | null => (value !== undefined && value !== null ? value : null),
  from: (value?: string | number | null): number | null => (value !== undefined && value !== null ? Number(value) : null),
};

export abstract class BaseEntity extends TypeOrmBaseEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}

export abstract class BaseTenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date;
}

export abstract class BaseTenantTimestampedEntity extends BaseTenantEntity {}

export abstract class BaseTenantSoftDeleteEntity extends BaseTenantEntity {}
