import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../database/base.entity';
import { NumericTransformer } from '../../foods/entities/food.entity';

@Entity('dish_frequency_rules')
export class DishFrequencyRule {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'school_id', type: 'bigint', default: 1, transformer: BigIntTransformer })
  schoolId: number;

  @Column({ name: 'rule_name', length: 200 })
  ruleName: string;

  @Column({ name: 'meal_slot', length: 30, default: 'ALL' })
  mealSlot: string; // 'MORNING_SNACK', 'LUNCH', 'AFTERNOON_SNACK', 'ALL'

  @Column({ name: 'target_type', length: 30 })
  targetType: string; // 'DISH_CATEGORY' hoặc 'FOOD_GROUP'

  @Column({ name: 'target_id', type: 'bigint', nullable: true, transformer: BigIntTransformer })
  targetId: number | null;

  @Column({ name: 'target_code', length: 50 })
  targetCode: string;

  @Column({ name: 'target_name', length: 150 })
  targetName: string;

  @Column({ name: 'age_group', length: 30, default: 'ALL' })
  ageGroup: string;

  @Column({ name: 'period_type', length: 20, default: 'PER_CYCLE_4_WEEKS' })
  periodType: string; // 'PER_DAY', 'PER_WEEK', 'PER_CYCLE_4_WEEKS'

  @Column({ name: 'min_occurrences', type: 'int', default: 0 })
  minOccurrences: number;

  @Column({ name: 'max_occurrences', type: 'int' })
  maxOccurrences: number;

  @Column({ name: 'is_required_in_meal', default: false })
  isRequiredInMeal: boolean;

  @Column({ length: 15, default: 'WARNING' })
  severity: string; // 'ERROR', 'WARNING', 'INFO'

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

