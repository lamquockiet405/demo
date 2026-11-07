import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../database/base.entity';
import { NumericTransformer } from '../../foods/entities/food.entity';

/**
 * Bảng phân bổ năng lượng & dinh dưỡng theo bữa trong ngày.
 * Mỗi dòng: một bữa ăn chiếm bao nhiêu % nhu cầu năng lượng CẢ NGÀY của một nhóm tuổi.
 */
@Entity('meal_energy_distributions')
export class MealEnergyDistribution {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'school_id', type: 'bigint', nullable: true, transformer: BigIntTransformer })
  schoolId: number | null;

  @Column({ name: 'age_group', length: 30 })
  ageGroup: string; // 'NHA_TRE' | 'MAU_GIAO'

  @Column({ name: 'meal_type', length: 30 })
  mealType: string; // 'BREAKFAST' | 'MORNING_SNACK' | 'LUNCH' | 'AFTERNOON_SNACK' | 'LATE_SNACK'

  @Column({ name: 'meal_label', length: 100 })
  mealLabel: string;

  @Column({ name: 'meal_time', type: 'varchar', length: 5, nullable: true })
  mealTime: string | null;

  @Column({ name: 'display_order', type: 'int', default: 1 })
  displayOrder: number;

  @Column({ name: 'energy_pct_min', type: 'numeric', precision: 5, scale: 2, transformer: NumericTransformer })
  energyPctMin: number;

  @Column({ name: 'energy_pct_max', type: 'numeric', precision: 5, scale: 2, transformer: NumericTransformer })
  energyPctMax: number;

  // Nhu cầu nước khuyến nghị (% nhu cầu nước cả ngày hoặc ml trực tiếp)
  @Column({ name: 'water_pct_min', type: 'numeric', precision: 5, scale: 2, nullable: true, transformer: NumericTransformer })
  waterPctMin: number | null;

  @Column({ name: 'water_pct_max', type: 'numeric', precision: 5, scale: 2, nullable: true, transformer: NumericTransformer })
  waterPctMax: number | null;

  @Column({ name: 'water_ml_min', type: 'numeric', precision: 8, scale: 2, nullable: true, transformer: NumericTransformer })
  waterMlMin: number | null;

  @Column({ name: 'water_ml_max', type: 'numeric', precision: 8, scale: 2, nullable: true, transformer: NumericTransformer })
  waterMlMax: number | null;

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

