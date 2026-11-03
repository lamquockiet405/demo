import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Child } from '../../children/entities/child.entity';
import { User } from '../../auth/entities/user.entity';

@Entity('picky_eating_advices')
export class PickyEatingAdvice {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ name: 'student_id', type: 'bigint' })
  studentId: number;

  @ManyToOne(() => Child, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Child;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy: number;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @Column({ name: 'advice_date', type: 'date', default: () => 'CURRENT_DATE' })
  adviceDate: string;

  @Column({ name: 'severity_level', type: 'varchar', length: 20, default: 'MODERATE' })
  severityLevel: string; // 'MILD' | 'MODERATE' | 'SEVERE'

  @Column({ name: 'picky_symptoms', type: 'jsonb', default: () => "'[]'::jsonb" })
  pickySymptoms: string[];

  @Column({ name: 'advice_title', type: 'varchar', length: 255 })
  adviceTitle: string;

  @Column({ name: 'home_supplement_advice', type: 'text' })
  homeSupplementAdvice: string;

  @Column({ name: 'recommended_dishes', type: 'jsonb', default: () => "'[]'::jsonb" })
  recommendedDishes: any[];

  @Column({ name: 'micronutrients_focus', type: 'jsonb', default: () => "'[]'::jsonb" })
  micronutrientsFocus: string[];

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'SENT' })
  status: string; // 'SENT' | 'PARENT_CONFIRMED'

  @Column({ name: 'parent_feedback', type: 'text', nullable: true })
  parentFeedback: string;

  @Column({ name: 'parent_confirmed_at', type: 'timestamptz', nullable: true })
  parentConfirmedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
