import { ChildrenService } from '../../../src/modules/children/services/children.service';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { DeclareAllergyDto } from '../../../src/modules/children/dto/declare-allergy.dto';

function setup(linked = true) {
  const rows: any[] = [];
  const catalog = [{ id: 1, name: 'Trứng', code: 'EGG' }, { id: 2, name: 'Sữa', code: 'MILK' }];
  const qb: any = {};
  for (const method of ['leftJoinAndSelect', 'andWhere', 'skip', 'take', 'orderBy']) qb[method] = jest.fn().mockReturnValue(qb);
  qb.getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
  const children = { query: jest.fn().mockResolvedValue(linked ? [{}] : []), findOne: jest.fn().mockResolvedValue({ id: 7 }), createQueryBuilder: () => qb };
  const allergies = {
    create: jest.fn(input => ({ ...input })),
    save: jest.fn(async input => {
      const row = { ...input, id: input.id || rows.length + 1, declaredAt: new Date('2026-11-03T00:00:00Z') };
      const index = rows.findIndex(item => item.id === row.id);
      if (index === -1) rows.push(row); else rows[index] = row;
      return row;
    }),
    findOne: jest.fn(async ({ where }) => {
      const row = rows.find(item => item.id === where.id);
      return row ? { ...row, allergen: catalog.find(item => item.id === row.allergenId) || null } : null;
    }),
    find: jest.fn(async ({ where }) => rows.filter(item => item.studentId === where.studentId && (where.isActive === undefined || item.isActive === where.isActive))),
  };
  const service = new ChildrenService(children as any, allergies as any, { findOne: async ({ where }) => catalog.find(item => item.id === where.id) } as any);
  return { service, children, allergies, rows, qb };
}

describe('Allergy declaration', () => {
  it.each(['LOW', 'MEDIUM', 'HIGH', 'MILD', 'MODERATE', 'SEVERE', 'ANAPHYLACTIC'])('accepts and returns severity %s', async severity => {
    const { service } = setup();
    const result = await service.declareAllergy(7, { allergenId: '1', severity, symptoms: 'Ghi nhận từ phụ huynh' }, 13);
    expect(result.severity).toBe(severity);
    expect(result.allergenId).toBe('1');
    expect(result.allergen.nameVi).toBe('Trứng');
  });
  it('keeps the requested catalog relation when editing and clears it when switching to custom food', async () => {
    const { service } = setup();
    const created = await service.declareAllergy(7, { customAllergenName: 'Kiwi', severity: 'MILD' });
    const catalog = await service.updateAllergy(Number(created.id), { allergenId: '2', customAllergenName: '' });
    expect(catalog.allergen.nameVi).toBe('Sữa');
    const custom = await service.updateAllergy(Number(created.id), { allergenId: null, customAllergenName: '  Mè  ' });
    expect(custom.allergenId).toBeUndefined();
    expect(custom.customAllergenName).toBe('Mè');
  });
  it('rejects blank targets, missing catalog items and duplicate active records', async () => {
    const { service } = setup();
    await expect(service.declareAllergy(7, { severity: 'MILD' })).rejects.toThrow('chọn dị nguyên');
    await expect(service.declareAllergy(7, { severity: 'MILD', allergenId: '99' })).rejects.toThrow('Không tìm thấy dị nguyên');
    await service.declareAllergy(7, { severity: 'MILD', customAllergenName: 'Kiwi' });
    await expect(service.declareAllergy(7, { severity: 'SEVERE', customAllergenName: ' kiwi ' })).rejects.toThrow('đã có');
  });
  it('deactivates without deleting the record, then supports reactivation', async () => {
    const { service, rows } = setup();
    const created = await service.declareAllergy(7, { severity: 'MILD', allergenId: '1' });
    await service.deleteAllergy(Number(created.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].isActive).toBe(false);
    expect((await service.updateAllergy(Number(created.id), { isActive: true })).isActive).toBe(true);
  });
  it('prevents a parent from reading or declaring allergies for an unlinked child', async () => {
    const { service, allergies } = setup(false);
    const actor = { sub: 13, roles: ['PARENT'] };
    await expect(service.findOne(7, actor)).rejects.toThrow('chưa được liên kết');
    await expect(service.declareAllergy(7, { severity: 'MILD', allergenId: '1' }, 13, actor)).rejects.toThrow('chưa được liên kết');
    expect(allergies.save).not.toHaveBeenCalled();
  });
  it('limits a parent child selector to linked children while keeping staff access', async () => {
    const parent = setup();
    await parent.service.findAll({}, { sub: 13, roles: ['PARENT'] });
    expect(parent.qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('student_parents'), { parentId: 13 });
    const staff = setup();
    await staff.service.findAll({}, { sub: 1, roles: ['SCHOOL_MANAGER', 'PARENT'] });
    expect(staff.qb.andWhere).not.toHaveBeenCalled();
  });
  it('validates malformed severity and diagnosis dates before database writes', () => {
    expect(validateSync(plainToInstance(DeclareAllergyDto, { customAllergenName: 'Kiwi', severity: 'UNKNOWN', diagnosedDate: 'not-a-date' })).map(error => error.property).sort()).toEqual(['diagnosedDate', 'severity']);
  });
});
