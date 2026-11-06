import { BigIntTransformer } from '../../../database/base.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { NumericTransformer } from '../../foods/entities/food.entity';

@Entity('food_samples')
export class InspectionSampleItem {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'dish_name', length: 150 })
  dishName: string;

  @Column({ name: 'dish_id', type: 'bigint', transformer: BigIntTransformer, nullable: true })
  dishId: number | null;

  @Column({ name: 'inspection_id', type: 'bigint', transformer: BigIntTransformer, nullable: true })
  inspectionId: number | null;

  @Column({ name: 'sample_code', length: 50 })
  sampleCode: string;

  @CreateDateColumn({ name: 'stored_at', type: 'timestamptz' })
  storedAt: Date;

  @Column({ name: 'dispose_at', type: 'timestamptz', nullable: true })
  disposeAt: Date;

  @Column({ length: 20, default: 'STORED' })
  status: string;


  @Column({ name: 'fridge_unit', length: 100, nullable: true })
  fridgeUnit: string;

  @Column({ name: 'sample_weight_g', type: 'numeric', precision: 6, scale: 1, default: 150.0 })
  sampleWeightG: number;

  @Column({ name: 'storage_temp', type: 'numeric', precision: 4, scale: 1, default: 3.8 })
  storageTemp: number;

  @Column({ name: 'collector_name', length: 100, nullable: true })

  collectorName: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ name: 'image_url', type: 'text', nullable: true })
  imageUrl?: string | null;
}
