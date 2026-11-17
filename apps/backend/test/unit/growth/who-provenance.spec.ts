import { WhoZscoreService } from '../../../src/modules/growth/services/who-zscore.service';

describe('WHO calculation reference provenance', () => {
  it('records the actual database standard while keeping the existing calculation result', async () => {
    const rows = {
      WAZ: { id: 11, lValue: 1, mValue: 10, sValue: 0.2 },
      HAZ: { id: 12, lValue: 1, mValue: 100, sValue: 0.1 },
      BAZ: { id: 13, lValue: 1, mValue: 12, sValue: 0.1 },
    };
    const repo = { findOne: jest.fn(({ where }) => Promise.resolve(rows[where.indicator])) };
    const service = new WhoZscoreService(repo as any);
    const result = await service.calculateChildGrowth('MALE', '2022-01-01', '2026-01-01', 100, 12);
    expect(result).toMatchObject({ waz: 1, haz: 0, baz: 0, wazStandardId: 11, hazStandardId: 12, bazStandardId: 13 });
    expect(await service.calculateZscore('WAZ', 'MALE', 48, 12)).toBe(1);
  });

  it('keeps fallback results and leaves provenance unknown when no database standard exists', async () => {
    const service = new WhoZscoreService({ findOne: jest.fn().mockResolvedValue(null) } as any);
    const result = await service.calculateChildGrowth('FEMALE', '2022-01-01', '2026-01-01', 100, 14);
    const previousCalculation = service.calculateSync('FEMALE', 48, 14, 100, 14);
    expect(result).toMatchObject(previousCalculation);
    expect(result).toMatchObject({ wazStandardId: null, hazStandardId: null, bazStandardId: null });
  });

  it('does not attribute a fallback calculation to a rejected database standard', async () => {
    const service = new WhoZscoreService({ findOne: jest.fn().mockResolvedValue({ id: 999, lValue: 1, mValue: 0, sValue: 0 }) } as any);
    const result = await service.calculateChildGrowth('MALE', '2022-01-01', '2026-01-01', 100, 14);
    expect(result).toMatchObject(service.calculateSync('MALE', 48, 14, 100, 14));
    expect(result).toMatchObject({ wazStandardId: null, hazStandardId: null, bazStandardId: null });
  });
});
