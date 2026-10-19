import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

/**
 * Tenant Entity — Mapping bảng `tenants` trong PostgreSQL.
 * Mỗi tenant đại diện cho 1 trường mầm non trong hệ thống (UC07: Configure School Information).
 */
@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Mã trường duy nhất (e.g. 'MN_SAOMAI') */
  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  /** Tên đầy đủ trường mầm non */
  @Column({ type: 'varchar', length: 255 })
  name: string;

  /** Subdomain riêng */
  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  domain: string | null;

  @Column({ type: 'varchar', length: 255, name: 'contact_email' })
  contactEmail: string;

  @Column({ type: 'varchar', length: 50 })
  phone: string;

  @Column({ type: 'text' })
  address: string;

  /** ACTIVE | INACTIVE | SUSPENDED | TRIAL */
  @Column({ type: 'varchar', length: 50, default: 'ACTIVE' })
  status: string;

  /** FREE | STANDARD | PREMIUM | ENTERPRISE */
  @Column({ type: 'varchar', length: 50, name: 'subscription_tier', default: 'STANDARD' })
  subscriptionTier: string;

  @Column({ type: 'int', name: 'max_children', default: 500 })
  maxChildren: number;

  /** JSONB cấu hình: legal_representative, food_safety_license, branding, etc. */
  @Column({ type: 'jsonb', default: () => `'{"meal_times":["BREAKFAST","LUNCH","AFTERNOON_SNACK"],"standard_weekly_cycle_length":4,"food_retention_hours":24,"who_zscore_auto_calc":true}'` })
  settings: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}

/**
 * SchoolTenant Entity — Alias cho auth module tương thích ngược
 */
@Entity('schools')
export class SchoolTenant {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ length: 255, nullable: true })
  email: string;

  @Column({ name: 'principal_name', length: 150, nullable: true })
  principalName: string;

  @Column({ length: 500, nullable: true })
  logo: string;
}
