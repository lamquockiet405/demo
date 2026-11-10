import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../database/base.entity';

@Entity('dish_spacing_rules')
export class DishSpacingRule {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'school_id', type: 'bigint', default: 1, transformer: BigIntTransformer })
  schoolId: number;

  @Column({ name: 'rule_name', length: 200 })
  ruleName: string;

  @Column({ name: 'meal_slot', length: 30, default: 'ALL' })
  mealSlot: string; // 'MORNING_SNACK', 'LUNCH', 'AFTERNOON_SNACK', 'ALL'

  @Column({ name: 'target_type', length: 30 })
  targetType: string; // 'DISH_CATEGORY', 'SPECIFIC_DISH'

  @Column({ name: 'target_id', type: 'bigint', nullable: true, transformer: BigIntTransformer })
  targetId: number | null;

  @Column({ name: 'target_name', length: 150, nullable: true })
  targetName: string | null;

  @Column({ name: 'age_group', length: 30, default: 'ALL' })
  ageGroup: string;

  @Column({ name: 'min_spacing_days', type: 'int', default: 1 })
  minSpacingDays: number;

  @Column({ name: 'no_repeat_in_same_week', default: true })
  noRepeatInSameWeek: boolean;

  @Column({ name: 'no_repeat_in_same_day', default: true })
  noRepeatInSameDay: boolean;

  @Column({ name: 'priority_order', type: 'int', default: 1 })
  priorityOrder: number;

  @Column({ length: 15, default: 'WARNING' })
  severity: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'source_metadata', type: 'jsonb', nullable: true })
  sourceMetadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

