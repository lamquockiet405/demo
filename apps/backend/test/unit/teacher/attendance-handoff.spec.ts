import { TeacherService } from '../../../src/modules/teacher/teacher.service';
import { MealPortionsService } from '../../../src/modules/meal-portions/services/meal-portions.service';

describe('Class/day/meal attendance handoff', () => {
  const actor = { sub: 7, tenantId: '1', roles: ['TEACHER'] };
  const date = '2026-11-12';
  const items = [1, 2, 3].map(studentId => ({ studentId: String(studentId), isAttended: studentId !== 3, consumptionLevel: '', note: '' }));
  function setup(locked = false) {
    const tx: any = { query: jest.fn(async (sql: string) => {
      if (sql.includes('SELECT is_locked')) return [{ is_locked: locked }];
      if (sql.includes('SELECT id,full_name')) return [1,2,3].map(id => ({ id, full_name: `Student ${id}` }));
      if (sql.includes('RETURNING attendance_submitted_at')) return [{ submittedAt: new Date() }];
      return [];
    }) };
    const db: any = { query: jest.fn().mockResolvedValue([{ id: 1 }]), transaction: jest.fn(async fn => fn(tx)) };
    const service = new TeacherService(db, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    return { service, tx, db };
  }
  it('sends the entire roster and the present count without requiring a consumption result', async () => {
    const { service, tx } = setup();
    const result = await service.submitMeals(actor, { classId: '1', date, mealType: 'LUNCH', items });
    expect(result).toMatchObject({ classId: '1', date, mealType: 'LUNCH', quantity: 2, absent: 1, total: 3 });
    const attendance = tx.query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO meal_attendances'));
    expect(attendance).toHaveLength(3);
    expect(attendance[0][1][4]).toBeNull();
    const [sql, values] = tx.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO daily_meal_portions'));
    expect(values.slice(0,5)).toEqual([1,date,'LUNCH',2,7]);
    expect(JSON.parse(values[5])).toHaveLength(3);
    expect(sql).not.toContain('actual_quantity=');
  });
  it('preserves zero when every child is absent', async () => {
    const result = await setup().service.submitMeals(actor, { classId: 1, date, mealType: 'BREAKFAST', items: items.map(item => ({ ...item, isAttended: false })) });
    expect(result.quantity).toBe(0);
  });
  it.each([
    items.slice(0,2),
    [...items.slice(0,2), { ...items[2], studentId: '99' }],
    [...items.slice(0,2), items[0]],
    items.map(item => ({ ...item, isAttended: null })),
  ])('rejects incomplete, foreign, duplicate, or unmarked rosters before writing', async invalid => {
    const { service, tx } = setup();
    await expect(service.submitMeals(actor, { classId: 1, date, mealType: 'LUNCH', items: invalid })).rejects.toThrow();
    expect(tx.query.mock.calls.some(([sql]) => sql.startsWith('INSERT'))).toBe(false);
  });
  it('rejects another class and closed meals', async () => {
    const { service, tx } = setup();
    await expect(service.submitMeals(actor, { classId: 2, date, mealType: 'LUNCH', items })).rejects.toThrow();
    expect(tx.query).not.toHaveBeenCalled();
    await expect(setup(true).service.submitMeals(actor, { classId: 1, date, mealType: 'LUNCH', items })).rejects.toThrow();
  });
});

describe('Kitchen daily portion requests', () => {
  it('shows real zero, unsubmitted records, and no invented defaults', async () => {
    const repo: any = { find: jest.fn().mockResolvedValue([{ classId: 1, mealType: 'LUNCH', plannedQuantity: 0, actualQuantity: 0, attendanceSubmittedAt: new Date(), attendanceSnapshot: [{ isAttended: false, fullName: 'Child', note: '' }] }]) };
    const classes: any = { find: jest.fn().mockResolvedValue([{ id: 1, name: 'Class' }, { id: 2, name: 'Another class' }]) };
    const result = await new MealPortionsService(repo, classes).findAll({ date: '2026-11-12' }, 1);
    expect(result.items[0].lunch).toMatchObject({ planned: 0, actual: 0, present: 0, absent: 1 });
    expect(result.items[1].lunch).toMatchObject({ planned: null, actual: null, submittedAt: null });
    expect(result.totalLunch).toBe(0);
    expect(classes.find).toHaveBeenCalledWith(expect.objectContaining({ where: { schoolId: 1 } }));
  });
});
