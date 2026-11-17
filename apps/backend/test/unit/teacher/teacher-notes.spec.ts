import { TeacherService } from '../../../src/modules/teacher/teacher.service';
import { MealCoordinationService } from '../../../src/modules/attendance/services/meal-coordination.service';

describe('Teacher meal coordination notes', () => {
  const actor = { sub: 7, tenantId: '1', roles: ['TEACHER'], fullName: 'Assigned teacher' };
  function setup() {
    const db: any = { query: jest.fn(async (sql: string, values: any[]) => {
      if (sql.includes('homeroom_teacher_id')) return [{ id: 1, name: 'Assigned class' }];
      if (sql.includes('SELECT class_id')) return [{ class_id: values[0] === 99 ? 2 : 1 }];
      if (sql.includes('SELECT id,class_id')) return [{ id: values[0], class_id: 2 }];
      return [];
    }) };
    const notes: any = { create: jest.fn().mockResolvedValue({ id: 10 }), update: jest.fn(), delete: jest.fn() };
    const service = new TeacherService(db, {} as any, {} as any, {} as any, {} as any, {} as any, notes);
    return { db, service, notes };
  }
  const body = { classId: '1', mealDate: '2026-11-05', mealSession: 'BREAKFAST', title: 'Morning request', content: 'Prepare breakfast' };

  it('filters the list by assigned classes and date', async () => {
    const { service, db } = setup();
    await service.noteList(actor, { date: body.mealDate });
    expect(db.query).toHaveBeenLastCalledWith(expect.stringContaining('n.class_id=ANY($1::bigint[]) AND n.meal_date=$2'), [[1], body.mealDate]);
    await expect(service.noteList(actor, { classId: '2' })).rejects.toThrow();
  });
  it.each(['BREAKFAST', 'MORNING_SNACK', 'LUNCH', 'AFTERNOON_SNACK'])('supports the %s meal', async mealSession => {
    const { service, notes } = setup();
    await service.noteWrite(actor, { ...body, mealSession });
    expect(notes.create).toHaveBeenCalledWith(expect.objectContaining({ mealSession, teacherName: actor.fullName, targetRole: 'KITCHEN' }), actor.sub);
  });
  it('rejects unknown meals and students outside the assigned class', async () => {
    const { service, notes } = setup();
    await expect(service.noteWrite(actor, { ...body, mealSession: 'UNKNOWN' })).rejects.toThrow();
    await expect(service.noteWrite(actor, { ...body, childId: '4' })).rejects.toThrow();
    expect(notes.create).not.toHaveBeenCalled();
  });
  it('rejects editing or deleting notes belonging to another class', async () => {
    const { service, notes } = setup();
    await expect(service.noteWrite(actor, body, 99)).rejects.toThrow();
    await expect(service.noteDelete(actor, 99)).rejects.toThrow();
    expect(notes.update).not.toHaveBeenCalled();
    expect(notes.delete).not.toHaveBeenCalled();
  });
});

describe('Shared teacher/kitchen note storage', () => {
  it('serializes photo arrays as JSON rather than PostgreSQL arrays', async () => {
    const db: any = { query: jest.fn().mockResolvedValue([{ id: 10 }]) };
    const service = new MealCoordinationService(db);
    await service.create({ classId: '1', mealDate: '2026-11-05', mealSession: 'BREAKFAST', noteType: 'OTHER', priority: 'NORMAL', title: 'Morning', content: 'Request', teacherName: 'Teacher', photos: ['photo.jpg'] });
    const values = db.query.mock.calls[0][1];
    expect(values[4]).toBe('Bữa sáng');
    expect(JSON.parse(values[13])).toEqual(['photo.jpg']);
  });
  it('saves changed meal, note type, and photos together with their labels', async () => {
    const db: any = { query: jest.fn().mockResolvedValue([{ id: 10 }]) };
    await new MealCoordinationService(db).update('10', { mealSession: 'MORNING_SNACK', noteType: 'SPECIAL_DIET', photos: [] });
    const [sql, values] = db.query.mock.calls[1];
    expect(sql).toContain('meal_session =');
    expect(sql).toContain('note_type =');
    expect(values).toEqual(['10', 'MORNING_SNACK', 'Phụ sáng', 'SPECIAL_DIET', 'Chế độ ăn riêng', '[]']);
  });
});
