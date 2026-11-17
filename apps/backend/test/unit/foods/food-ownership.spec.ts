import { FoodsService } from '../../../src/modules/foods/services/foods.service';

describe('Food ingredient ownership', () => {
  const actor = { sub: 7, tenantId: 1 };
  const custom = () => ({ id: 200, name: 'Nguyên liệu tự thêm', sourceMetadata: { kind: 'USER_CREATED', createdBy: '7', schoolId: '1' } });
  const setup = (food: any) => {
    const repo: any = { findOne: jest.fn().mockResolvedValue(food), create: jest.fn(dto => ({ id: 200, ...dto })), save: jest.fn(async value => value), remove: jest.fn() };
    const qb = { where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(null) };
    repo.createQueryBuilder = () => qb;
    const manager: any = { query: jest.fn().mockResolvedValue([]) };
    manager.transaction = async (work: any) => work(manager);
    repo.manager = manager;
    return { repo, service: new FoodsService(repo, {} as any) };
  };
  it('records the authenticated creator and ignores forged provenance when creating', async () => {
    const { service, repo } = setup(custom());
    await service.create({ name: 'Mới', sourceMetadata: { createdBy: '99', schoolId: '99', kind: 'REFERENCE' } } as any, actor);
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ sourceMetadata: expect.objectContaining({ kind: 'USER_CREATED', createdBy: '7', schoolId: '1' }) }));
  });
  it.each([null, { kind: 'VIETNAM_FCT_REFERENCE' }, { kind: 'USER_CREATED', createdBy: '8', schoolId: '1' }, { kind: 'USER_CREATED', createdBy: '7', schoolId: '2' }])('blocks changing a reference, unowned or another user/school ingredient: %p', async sourceMetadata => {
    const { service, repo } = setup({ id: 1, name: 'Gạo tẻ', sourceMetadata });
    await expect(service.update(1, { name: 'Đổi tên' }, actor)).rejects.toThrow('Chỉ được chỉnh sửa');
    await expect(service.remove(1, actor)).rejects.toThrow('Chỉ được chỉnh sửa');
    expect(repo.save).not.toHaveBeenCalled();
    expect(repo.remove).not.toHaveBeenCalled();
  });
  it('allows the owner to edit their ingredient without transferring ownership', async () => {
    const { service, repo } = setup(custom());
    const result = await service.update(200, { name: 'Tên mới', proteinG: 12, sourceMetadata: { createdBy: '99', kind: 'REFERENCE', schoolId: '99', description: 'Ghi chú' } }, actor);
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Tên mới', proteinG: 12, sourceMetadata: expect.objectContaining({ kind: 'USER_CREATED', createdBy: '7', schoolId: '1', description: 'Ghi chú' }) }));
    expect(result.canEdit).toBe(true);
  });
  it('returns read-only permissions for other users and unidentified callers', async () => {
    const { service } = setup(custom());
    expect((await service.findOne(200, { sub: 8, tenantId: 1 })).canEdit).toBe(false);
    expect((await service.findOne(200)).canEdit).toBe(false);
    await expect(service.update(200, { name: 'New' })).rejects.toThrow();
  });
});
