import { NotFoundException } from '@nestjs/common';
import { InspectionsService } from '../../../src/modules/inspections/inspections.service';

describe('Food sample relationships', () => {
  it('keeps the inspection that produced the sample and returns the resolved dish reference', async () => {
    const sample = { id: 8, dishName: 'Món lưu mẫu', dishId: 20, inspectionId: 7 };
    const sampleRepo = {
      manager: { query: jest.fn().mockResolvedValue([{ id: 20 }]) },
      create: jest.fn((input) => input), save: jest.fn().mockResolvedValue(sample), findOne: jest.fn().mockResolvedValue(sample),
    };
    const inspectionRepo = { create: jest.fn((input) => input), save: jest.fn().mockResolvedValue({ id: 7 }) };
    const gateway = { broadcastSafetyAlert: jest.fn() };
    const service = new InspectionsService(inspectionRepo as any, sampleRepo as any, {} as any, gateway as any);
    await service.updateStep3(1, { dishName: 'Món lưu mẫu', dishId: 20, date: '2026-11-03' }, 4);
    expect(sampleRepo.create).toHaveBeenCalledWith(expect.objectContaining({ dishId: 20, inspectionId: 7 }));
    expect(await service.sealSample({ dishName: 'Món lưu mẫu', date: '2026-11-03' })).toEqual(sample);
  });

  it('rejects an unknown explicit dish before inserting a food sample', async () => {
    const sampleRepo = { manager: { query: jest.fn().mockResolvedValue([]) }, create: jest.fn() };
    const service = new InspectionsService({} as any, sampleRepo as any, {} as any, {} as any);
    await expect(service.sealSample({ dishId: 9999, dishName: 'Tên nhập tay', date: '2026-11-03' })).rejects.toThrow(NotFoundException);
    expect(sampleRepo.create).not.toHaveBeenCalled();
  });
});
