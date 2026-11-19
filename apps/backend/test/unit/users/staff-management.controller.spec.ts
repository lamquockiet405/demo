import { Test, TestingModule } from '@nestjs/testing';
import { StaffManagementController } from '../../../src/modules/users/controllers/staff-management.controller';
import { StaffManagementService } from '../../../src/modules/users/services/staff-management.service';

describe('StaffManagementController', () => {
  let controller: StaffManagementController;
  let serviceMock: any;

  const mockTargetId = 2;

  beforeEach(async () => {
    serviceMock = {
      findAll: jest.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
      getStats: jest.fn().mockResolvedValue({ totalStaff: 5, activeStaff: 5 }),
      getRoles: jest.fn().mockResolvedValue([{ code: 'TEACHER', name: 'Giáo Viên' }]),
      findOne: jest.fn().mockResolvedValue({ id: mockTargetId, fullName: 'Cô Lan' }),
      create: jest.fn().mockResolvedValue({ id: 3, email: 'test@saomai.edu.vn' }),
      update: jest.fn().mockResolvedValue({ id: mockTargetId, fullName: 'Cô Lan Cập Nhật' }),
      restore: jest.fn().mockResolvedValue({ success: true }),
      toggleStatus: jest.fn().mockResolvedValue({ success: true, status: 'INACTIVE' }),
      remove: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StaffManagementController],
      providers: [
        { provide: StaffManagementService, useValue: serviceMock },
      ],
    }).compile();

    controller = module.get<StaffManagementController>(StaffManagementController);
  });

  it('phải gọi findAll từ service', async () => {
    const query = { page: 1, limit: 10 } as any;
    await controller.findAll(query);
    expect(serviceMock.findAll).toHaveBeenCalledWith(query);
  });

  it('phải gọi getStats từ service', async () => {
    await controller.getStats();
    expect(serviceMock.getStats).toHaveBeenCalled();
  });

  it('phải gọi getRoles từ service', async () => {
    await controller.getRoles();
    expect(serviceMock.getRoles).toHaveBeenCalled();
  });

  it('phải gọi findOne từ service', async () => {
    await controller.findOne(mockTargetId);
    expect(serviceMock.findOne).toHaveBeenCalledWith(mockTargetId);
  });

  it('phải gọi create từ service', async () => {
    const dto = {
      email: 'teacher@saomai.edu.vn',
      fullName: 'Cô Mai',
      roles: ['TEACHER'],
    } as any;
    await controller.create(dto);
    expect(serviceMock.create).toHaveBeenCalledWith(dto);
  });

  it('phải gọi update từ service', async () => {
    const dto = { fullName: 'Cô Mai Cập Nhật' } as any;
    await controller.update(mockTargetId, dto);
    expect(serviceMock.update).toHaveBeenCalledWith(mockTargetId, dto);
  });

  it('phải gọi restore từ service', async () => {
    await controller.restore(mockTargetId);
    expect(serviceMock.restore).toHaveBeenCalledWith(mockTargetId);
  });

  it('phải gọi toggleStatus từ service', async () => {
    await controller.toggleStatus(mockTargetId);
    expect(serviceMock.toggleStatus).toHaveBeenCalledWith(mockTargetId);
  });

  it('phải gọi remove từ service', async () => {
    await controller.remove(mockTargetId);
    expect(serviceMock.remove).toHaveBeenCalledWith(mockTargetId);
  });
});
