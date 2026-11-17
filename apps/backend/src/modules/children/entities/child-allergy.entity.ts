import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../database/base.entity';
import { AllergenCatalog } from './allergen-catalog.entity';
import { Child } from './child.entity';
import { User } from '../../auth/entities/user.entity';

@Entity('student_allergies')
export class ChildAllergy {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'student_id', type: 'bigint', transformer: BigIntTransformer })
  studentId: number;

  @Column({ name: 'allergen_id', type: 'bigint', transformer: BigIntTransformer, nullable: true })
  allergenId: number | null;

  @Column({ name: 'custom_allergen_name', type: 'varchar', length: 150, nullable: true })
  customAllergenName: string | null;

  @Column({ name: 'allergy_type', type: 'varchar', length: 50, default: 'ALLERGY', nullable: true })
  allergyType: string | null;

  @Column({ length: 20, default: 'MEDIUM' })
  severity: string;

  @Column({ type: 'text', nullable: true })
  symptoms: string | null;

  @Column({ name: 'reaction_treatment', type: 'text', nullable: true })
  reactionTreatment: string | null;

  @Column({ name: 'diagnosed_date', type: 'date', nullable: true })
  diagnosedDate: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'declared_by', type: 'bigint', transformer: BigIntTransformer, nullable: true })
  declaredBy: number | null;

  @CreateDateColumn({ name: 'declared_at', type: 'timestamptz' })
  declaredAt: Date;

  @ManyToOne(() => Child, (child) => child.allergies, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  child: Child;

  @ManyToOne(() => AllergenCatalog, { eager: true, nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'allergen_id' })
  allergen: AllergenCatalog | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'declared_by' })
  declarer: User | null;
}
