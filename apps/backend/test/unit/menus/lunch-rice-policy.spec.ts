import { MenusService } from '../../../src/modules/menus/services/menus.service';
import { isFriday, validateLunchRice } from '../../../src/modules/menus/services/lunch-rice-policy';

const makeDish = (id: number, name: string, code: string) => ({
  id, name, category: { code, name: code }, status: 'ACTIVE', nutritionVerified: true,
  standardServingSizeG: 100, nutrition: { energyKcal: 200, proteinG: 8, fatG: 4, carbG: 30 },
});
const catalog = [makeDish(1, 'Cơm', 'RICE'), makeDish(2, 'Cơm Dương Châu', 'RICE'),
  makeDish(3, 'Cơm chiên hải sản', 'RICE'), makeDish(4, 'Thịt kho', 'MAIN')];
function serviceFor(dishes = catalog) {
  const qb: any = {};
  for (const key of ['innerJoin', 'select', 'addSelect', 'where', 'andWhere', 'groupBy', 'addGroupBy']) qb[key] = jest.fn().mockReturnValue(qb);
  qb.getRawMany = jest.fn().mockResolvedValue([]);
  return new MenusService({} as any, {} as any, {} as any, {} as any,
    { createQueryBuilder: () => qb } as any, { findOne: async () => null } as any,
    { find: async () => dishes } as any, { findOne: async () => null } as any, {} as any);
}

describe('Required weekday lunch rice', () => {
  it('includes rice with a main Monday–Thursday and fried rice without a main on Friday', async () => {
    const preview = await serviceFor().autoGenerate({ weekStartDate: '2026-11-09', previewOnly: true });
    if (!('dailySummary' in preview)) throw new Error('Expected a preview');
    expect(preview.dailySummary).toHaveLength(5);
    preview.dailySummary.forEach((day, index) => {
      const lunch = day.dishes.filter(dish => dish.mealTime === 'LUNCH');
      expect(lunch.filter(dish => dish.dishType === 'RICE')).toHaveLength(1);
      expect(lunch.filter(dish => dish.dishType === 'MAIN')).toHaveLength(index === 4 ? 0 : 1);
      expect(lunch.find(dish => dish.dishType === 'RICE').dishId).toEqual(index === 4 ? expect.stringMatching(/^[23]$/) : '1');
    });
  });
  it('rejects a week with no eligible fried rice instead of silently omitting it', async () => {
    await expect(serviceFor(catalog.filter(dish => ![2, 3].includes(dish.id)))
      .autoGenerate({ weekStartDate: '2026-11-09', previewOnly: true })).rejects.toThrow('thứ Sáu');
  });
  it('rejects a week with no eligible plain rice', async () => {
    await expect(serviceFor(catalog.filter(dish => dish.id !== 1))
      .autoGenerate({ weekStartDate: '2026-11-09', previewOnly: true })).rejects.toThrow('cơm thường');
  });
  it('validates client-supplied plans before saving any menu', async () => {
    const service = serviceFor();
    const preview = await service.autoGenerate({ weekStartDate: '2026-11-09', previewOnly: true });
    if (!('dailySummary' in preview)) throw new Error('Expected a preview');
    preview.dailySummary[4].dishes.push({ ...preview.dailySummary[0].dishes.find(dish => dish.dishType === 'MAIN') });
    const create = jest.spyOn(service, 'create');
    await expect(service.autoGenerate({ weekStartDate: '2026-11-09', dailyPlan: preview.dailySummary })).rejects.toThrow('không kèm món mặn');
    expect(create).not.toHaveBeenCalled();
  });
  it('uses the calendar Friday rather than assuming the fifth supplied date', () => {
    expect(isFriday('2026-11-10', 3)).toBe(true);
    expect(isFriday('2026-11-10', 4)).toBe(false);
  });
  it.each([0, 1])('keeps Friday rice-only when saving a plan with weekday offset %s', async (offset) => {
    const service = serviceFor();
    const preview = await service.autoGenerate({ weekStartDate: '2026-11-09', previewOnly: true });
    if (!('dailySummary' in preview)) throw new Error('Expected a preview');
    jest.spyOn(service, 'create').mockResolvedValue({ id: '99' } as any);
    jest.spyOn(service, 'findOne').mockResolvedValue({ id: '99' } as any);
    (service as any).versionRepo.findOne = jest.fn().mockResolvedValue({ id: 1 });
    (service as any).dayRepo.find = jest.fn().mockResolvedValue([2, 3, 4, 5, 6].map(dayOfWeek => ({
      dayOfWeek, meals: [{ id: dayOfWeek * 10, mealType: 'LUNCH' }],
    })));
    const stored: any[] = [];
    (service as any).menuDishRepo.create = (row: any) => row;
    (service as any).menuDishRepo.save = async (row: any) => { stored.push(row); return row; };
    (service as any).violationRepo.create = (row: any) => row;
    (service as any).violationRepo.save = jest.fn();
    const dailyPlan = preview.dailySummary.map(day => ({ ...day, dayOfWeek: day.dayOfWeek + offset }));
    await service.autoGenerate({ weekStartDate: '2026-11-09', dailyPlan });
    expect(stored.filter(row => row.menuMealId === 60)).toHaveLength(1);
    expect([2, 3]).toContain(stored.find(row => row.menuMealId === 60).dishId);
    for (const day of [2, 3, 4, 5]) {
      expect(stored.filter(row => row.menuMealId === day * 10).map(row => row.dishId).sort()).toEqual([1, 4]);
    }
  });
  it('checks actual catalog categories rather than trusting client dish labels', () => {
    expect(() => validateLunchRice([{ dishId: '4', mealTime: 'LUNCH' }], false, catalog)).toThrow('đúng một món cơm');
  });
});
