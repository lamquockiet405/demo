import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { BigIntTransformer } from '../../../database/base.entity';

@Entity('audit_logs')
@Index(['schoolId', 'createdAt'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'school_id', type: 'bigint', transformer: BigIntTransformer, default: 1 })
  schoolId: number;

  @Column({ name: 'user_id', type: 'bigint', transformer: BigIntTransformer, nullable: true })
  userId: number | null;

  @Column({ name: 'user_email', length: 255, nullable: true })
  userEmail: string | null;

  @Column({ name: 'user_name', length: 150, nullable: true })
  userName: string | null;

  @Column({ name: 'user_role', length: 50, nullable: true })
  userRole: string | null;

  @Column({ length: 100 })
  action: string;

  @Column({ name: 'target_entity', length: 100, nullable: true })
  targetEntity: string | null;

  @Column({ name: 'target_id', length: 100, nullable: true })
  targetId: string | null;

  @Column({ name: 'ip_address', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ type: 'jsonb', default: {} })
  details: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

