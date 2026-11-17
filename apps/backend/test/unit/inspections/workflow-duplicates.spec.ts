import { InspectionsService } from '../../../src/modules/inspections/inspections.service';

describe('Inspection date/session duplicate rules', () => {
  let service: InspectionsService;
  let repo: any;
  beforeEach(() => {
    repo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((record) => record),
      save: jest.fn(async (record) => ({ ...record, id: 100 })),
    };
    service = new InspectionsService(repo, {} as any, {} as any,
      { broadcastSafetyAlert: jest.fn() } as any);
    // Exercise business rules inside the workflow transaction.
    (service as any).inWorkflowTransaction = true;
  });

  it.each([
    ['LUNCH', 'LUNCH'], ['ALL_DAY', 'BREAKFAST'],
    ['LUNCH', 'ALL_DAY'], ['FULL_DAY', 'AFTERNOON_SNACK'],
  ])('rejects existing %s against requested %s', async (existing, requested) => {
    repo.find.mockResolvedValue([{ id: 1, mealSession: existing, sessionCode: 'BB-KT-20261116-01' }]);
    await expect(service.createSessionByNutritionist({ mealDate: '2026-11-16', mealSession: requested }, 5))
      .rejects.toThrow('đã có biên bản');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('allows a different meal on the same day', async () => {
    repo.find.mockResolvedValue([{ id: 1, mealSession: 'BREAKFAST', sessionCode: 'BB-KT-20261116-01' }]);
    await expect(service.createSessionByNutritionist({ mealDate: '2026-11-16', mealSession: 'LUNCH' }, 5))
      .resolves.toMatchObject({ approvalStatus: 'CHO_BEP_TAI_ANH', code: 'BB-KT-20261116-02' });
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('checks duplicates only within the requested date', async () => {
    await service.createSessionByNutritionist({ mealDate: '2026-11-17', mealSession: 'LUNCH' }, 5);
    expect(repo.find).toHaveBeenCalledWith({ where: { date: '2026-11-17' } });
  });

  it('rejects impossible dates', async () => {
    await expect(service.createSessionByNutritionist({ mealDate: '2026-02-30', mealSession: 'LUNCH' }, 5))
      .rejects.toThrow('Ngày kiểm thực không hợp lệ');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('reuses the linked sample instead of inserting another', async () => {
    const samples = { findOne: jest.fn().mockResolvedValue({ id: 20 }), save: jest.fn() };
    const detail = jest.spyOn(service, 'getSampleDetail').mockResolvedValue({ id: '20' } as any);
    (service as any).sampleRepo = samples;
    await expect(service.sealSample({ dishName: 'Cơm', date: '2026-11-16' }, 10)).resolves.toEqual({ id: '20' });
    expect(samples.findOne).toHaveBeenCalledWith({ where: { inspectionId: 10, dishName: 'Cơm' } });
    expect(samples.save).not.toHaveBeenCalled();
    detail.mockRestore();
  });
});
