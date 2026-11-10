import { validate } from 'class-validator';
import { CreateIntakeStandardDto } from '../../../src/modules/nutrition-engine/dto/create-intake-standard.dto';
import { NullableIntakeNumericTransformer } from '../../../src/modules/nutrition-engine/entities/nutrition-intake-standard.entity';

describe('Intake standards with partially documented requirements', () => {
  it('keeps an unknown requirement distinct from a measured zero', () => {
    expect(NullableIntakeNumericTransformer.from(null)).toBeNull();
    expect(NullableIntakeNumericTransformer.from('0.00')).toBe(0);
    expect(NullableIntakeNumericTransformer.from('350.50')).toBe(350.5);
  });

  it('accepts an energy/macro standard without inventing micronutrients', async () => {
    const dto = Object.assign(new CreateIntakeStandardDto(), {
      standardName: 'Documented energy requirements', ageGroup: 'NHA_TRE',
      energyKcalMin: 600, energyKcalMax: 651,
      calciumMgMin: null, ironMgMin: null, zincMgMin: null, vitaminARaeMcgMin: null,
      ironAbsorptionRate: null, zincAbsorptionLevel: null,
    });
    expect(await validate(dto)).toEqual([]);
    dto.calciumMgMin = -1;
    expect((await validate(dto)).map(error => error.property)).toContain('calciumMgMin');
  });
});
