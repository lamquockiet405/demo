import { ParentManagementService } from '../../../src/modules/users/services/parent-management.service';

jest.mock('bcryptjs', () => ({ genSalt: jest.fn().mockResolvedValue('salt'), hash: jest.fn().mockResolvedValue('hashed') }));

function setup(role: any = { id: 5, code: 'PARENT' }) {
  const query = { where: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(null) };
  const users = { createQueryBuilder: () => query, create: jest.fn(input => input), save: jest.fn().mockResolvedValue({ id: 55 }) };
  const profiles = { create: jest.fn(input => input), save: jest.fn() };
  const service = new ParentManagementService(users as any, { findOne: async () => role } as any, profiles as any);
  jest.spyOn(service, 'findOne').mockResolvedValue({ id: '55' } as any);
  return { service, users, profiles, role };
}

describe('Parent account creation', () => {
  it('persists the PARENT role so the new account can use parent authentication and routes', async () => {
    const { service, users, profiles, role } = setup();
    await service.create({ email: ' Parent@Example.com ', fullName: 'Phụ huynh kiểm thử', password: 'example-password' });
    expect(users.save).toHaveBeenCalledWith(expect.objectContaining({
      email: 'parent@example.com', passwordHash: 'hashed', roles: [role], status: 'ACTIVE',
    }));
    expect(profiles.save).toHaveBeenCalledWith(expect.objectContaining({ userId: 55 }));
  });
  it('does not create a roleless user when the PARENT role has not been configured', async () => {
    const { service, users, profiles } = setup(null);
    await expect(service.create({ email: 'parent@example.com', fullName: 'Phụ huynh kiểm thử' })).rejects.toThrow('vai trò phụ huynh');
    expect(users.save).not.toHaveBeenCalled();
    expect(profiles.save).not.toHaveBeenCalled();
  });
});
