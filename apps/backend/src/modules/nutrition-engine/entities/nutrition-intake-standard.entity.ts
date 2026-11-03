import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../database/base.entity';
import { NumericTransformer } from '../../foods/entities/food.entity';

export const NullableIntakeNumericTransformer = {
  to: NumericTransformer.to,
  from: (value?: string | number | null): number | null => value == null ? null : Number(value),
};

@Entity('nutrition_intake_standards')
export class NutritionIntakeStandard {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'school_id', type: 'bigint', default: 1, transformer: BigIntTransformer })
  schoolId: number;

  @Column({ name: 'standard_name', length: 200 })
  standardName: string;

  @Column({ name: 'age_group', length: 30 })
  ageGroup: string; // 'NHA_TRE', 'MAU_GIAO', 'PRIMARY_6_7', 'PRIMARY_8_9', 'SECONDARY_10_11'...

  @Column({ length: 10, default: 'ALL' })
  gender: string; // 'MALE', 'FEMALE', 'ALL'

  @Column({ name: 'meal_scope', length: 30, default: 'DAYBOARDING' })
  mealScope: string; // 'ALL_DAY', 'DAYBOARDING', 'LUNCH_ONLY'

  // Phụ lục 1: Năng lượng Kcal
  @Column({ name: 'energy_kcal_min', type: 'numeric', precision: 8, scale: 2, transformer: NumericTransformer })
  energyKcalMin: number;

  @Column({ name: 'energy_kcal_max', type: 'numeric', precision: 8, scale: 2, transformer: NumericTransformer })
  energyKcalMax: number;

  // Tỷ lệ P:L:G (%)
  @Column({ name: 'protein_ratio_min', type: 'numeric', precision: 5, scale: 2, default: 13.0, transformer: NumericTransformer })
  proteinRatioMin: number;

  @Column({ name: 'protein_ratio_max', type: 'numeric', precision: 5, scale: 2, default: 20.0, transformer: NumericTransformer })
  proteinRatioMax: number;

  @Column({ name: 'lipid_ratio_min', type: 'numeric', precision: 5, scale: 2, default: 25.0, transformer: NumericTransformer })
  lipidRatioMin: number;

  @Column({ name: 'lipid_ratio_max', type: 'numeric', precision: 5, scale: 2, default: 35.0, transformer: NumericTransformer })
  lipidRatioMax: number;

  @Column({ name: 'carbohydrate_ratio_min', type: 'numeric', precision: 5, scale: 2, default: 52.0, transformer: NumericTransformer })
  carbohydrateRatioMin: number;

  @Column({ name: 'carbohydrate_ratio_max', type: 'numeric', precision: 5, scale: 2, default: 60.0, transformer: NumericTransformer })
  carbohydrateRatioMax: number;

  // Phụ lục 2: Chất xơ (g/ngày)
  @Column({ name: 'fiber_g_min', type: 'numeric', precision: 6, scale: 2, nullable: true, transformer: NullableIntakeNumericTransformer })
  fiberGMin: number | null;

  @Column({ name: 'fiber_g_max', type: 'numeric', precision: 6, scale: 2, nullable: true, transformer: NullableIntakeNumericTransformer })
  fiberGMax: number | null;

  // Phụ lục 3: Canxi (mg/ngày)
  @Column({ name: 'calcium_mg_min', type: 'numeric', precision: 8, scale: 2, nullable: true, transformer: NullableIntakeNumericTransformer })
  calciumMgMin: number | null;

  // Phụ lục 4: Sắt (mg/ngày) theo mức hấp thu
  @Column({ name: 'iron_absorption_rate', length: 10, nullable: true, default: '10%' })
  ironAbsorptionRate: string | null; // '10%', '15%'

  @Column({ name: 'iron_mg_min', type: 'numeric', precision: 6, scale: 2, nullable: true, transformer: NullableIntakeNumericTransformer })
  ironMgMin: number | null;

  // Phụ lục 5: Kẽm (mg/ngày) theo 3 mức hấp thu sinh học
  @Column({ name: 'zinc_absorption_level', length: 10, nullable: true, default: 'MEDIUM' })
  zincAbsorptionLevel: string | null; // 'POOR', 'MEDIUM', 'GOOD'

  @Column({ name: 'zinc_mg_min', type: 'numeric', precision: 6, scale: 2, nullable: true, transformer: NullableIntakeNumericTransformer })
  zincMgMin: number | null;

  // Phụ lục 6: Vitamin A (µg RAE/ngày)
  @Column({ name: 'vitamin_a_rae_mcg_min', type: 'numeric', precision: 8, scale: 2, nullable: true, transformer: NullableIntakeNumericTransformer })
  vitaminARaeMcgMin: number | null;

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

