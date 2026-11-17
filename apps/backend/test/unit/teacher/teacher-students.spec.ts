import { firstValueFrom, of } from 'rxjs';
import { TeacherService } from '../../../src/modules/teacher/teacher.service';
import { TransformInterceptor } from '../../../src/common/interceptors/transform.interceptor';

describe('Teacher assigned students and their profiles', () => {
  const actor = { sub: 7, tenantId: '1', roles: ['TEACHER'] };
  function setup(assigned = true) {
    const rows = Array.from({ length: 30 }, (_, i) => ({ id: String(i + 4), fullName: `Student ${i + 4}`, classId: '2' }));
    const db: any = { query: jest.fn(async (sql: string, values: any[]) => {
      if (sql.includes('homeroom_teacher_id')) return assigned ? [{ id: 2, name: 'Assigned class' }] : [];
      if (sql.includes('FROM system_configs')) return values[0].includes('child-nutrition:4') ? [{ config_key: 'child-nutrition:4' }] : [];
      if (sql.includes('SELECT id,class_id')) return [{ id: Number(values[0]), class_id: Number(values[0]) === 1 ? 1 : 2 }];
      throw new Error('Unexpected query');
    }) };
    const children: any = {
      findAll: jest.fn().mockResolvedValue({ items: rows, total: 30 }),
      getNutritionProfile: jest.fn().mockResolvedValue({ childId: '4', profile: null }),
      updateNutritionProfile: jest.fn().mockResolvedValue({ childId: '4', profile: { eatingHabits: 'Recorded' } }),
      create: jest.fn(),
    };
    const service = new TeacherService(db, {} as any, children, {} as any, {} as any, {} as any, {} as any);
    return { service, db, children };
  }

  it('returns a page envelope that survives the global response transformer', async () => {
    const { service, children } = setup();
    const page = await service.childList(actor, { page: 1, limit: 25 });
    const context: any = { switchToHttp: () => ({ getResponse: () => ({ statusCode: 200 }) }) };
    const result: any = await firstValueFrom(new TransformInterceptor().intercept(context, { handle: () => of(page) }));
    expect(result.data.items).toHaveLength(25);
    expect(result.data.total).toBe(30);
    expect(result.data.totalPages).toBe(2);
    expect(result.data.items[0].hasNutritionProfile).toBe(true);
    expect(result.data.items[1].hasNutritionProfile).toBe(false);
    expect(children.findAll).toHaveBeenCalledWith(expect.objectContaining({ classId: '2' }));
  });

  it('keeps total counts and the remaining students on later pages', async () => {
    const page = await setup().service.childList(actor, { page: 2, limit: 25 });
    expect(page.items).toHaveLength(5);
    expect(page.total).toBe(30);
    expect(page.items[0].id).toBe('29');
  });

  it('rejects a class filter outside the assignment', async () => {
    const { service, children } = setup();
    await expect(service.childList(actor, { classId: '1' })).rejects.toThrow('không thuộc phân công');
    expect(children.findAll).not.toHaveBeenCalled();
  });

  it('returns an empty scoped collection when the teacher has no assigned class', async () => {
    const { service, children } = setup(false);
    const page = await service.childList(actor, {});
    expect(page.items).toEqual([]);
    expect(page.total).toBe(0);
    expect(children.findAll).not.toHaveBeenCalled();
  });

  it('creates a nutrition profile for an existing assigned child without creating a new student', async () => {
    const { service, children } = setup();
    await service.profile(actor, 4, { eatingHabits: 'Recorded' });
    expect(children.updateNutritionProfile).toHaveBeenCalledWith(4, { eatingHabits: 'Recorded' }, actor);
    expect(children.create).not.toHaveBeenCalled();
  });

  it('rejects opening or updating a profile for an unassigned child', async () => {
    const { service, children } = setup();
    await expect(service.profile(actor, 1)).rejects.toThrow('không thuộc phân công');
    await expect(service.profile(actor, 1, { eatingHabits: 'Other' })).rejects.toThrow('không thuộc phân công');
    expect(children.getNutritionProfile).not.toHaveBeenCalled();
    expect(children.updateNutritionProfile).not.toHaveBeenCalled();
  });
});
