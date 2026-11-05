import { MenusService } from "../../../src/modules/menus/services/menus.service";

describe("Stored menu versions", () => {
  function setup(found: any = { id: 21, versionNumber: 2 }) {
    const versions: any = {
      findOne: jest.fn(async () => found),
      find: jest.fn(async () => []),
      save: jest.fn(),
    };
    const days: any = { find: jest.fn(async () => []) };
    const service = new MenusService(
      { findOne: async () => ({ id: 7, ageGroup: "MAU_GIAO" }) } as any,
      versions,
      days,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    return { service, versions, days };
  }
  it("loads days from the requested version rather than silently using latest", async () => {
    const { service, versions, days } = setup();
    const data = await service.findOne(7, 2);
    expect(versions.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { menuId: 7, versionNumber: 2 } }),
    );
    expect(days.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { menuVersionId: 21 } }),
    );
    expect(data.versionNumber).toBe(2);
  });
  it("does not create an invented version or history record on a read", async () => {
    const { service, versions } = setup(null);
    await expect(service.findOne(7, 9)).rejects.toThrow();
    expect(versions.save).not.toHaveBeenCalled();
    expect(await service.getVersions(7)).toEqual([]);
  });
  it("rejects invalid version numbers before reading menu data", async () => {
    const { service, versions } = setup();
    await expect(service.findOne(7, -1)).rejects.toThrow();
    expect(versions.findOne).not.toHaveBeenCalled();
  });
});
