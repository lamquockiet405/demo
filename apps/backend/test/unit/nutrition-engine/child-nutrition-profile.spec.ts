import { ForbiddenException } from "@nestjs/common";
import { ChildrenService } from "../../../src/modules/children/services/children.service";

describe("Child nutrition profile persistence and access", () => {
  const make = () => {
    let saved: any = null;
    const query = jest.fn(async (sql: string, args: any[]) => {
      if (sql.startsWith("SELECT config_value"))
        return saved ? [{ config_value: JSON.stringify(saved) }] : [];
      if (sql.startsWith("UPDATE system_configs")) {
        if (!saved) return [[], 0]; // TypeORM PostgreSQL UPDATE result, including zero affected rows.
        saved = JSON.parse(args[1]);
        return [[{ id: 1 }], 1];
      }
      if (sql.startsWith("INSERT INTO system_configs")) {
        if (saved && !sql.includes("ON CONFLICT")) throw new Error("duplicate key");
        saved = JSON.parse(args[1]);
        return [];
      }
      return [];
    });
    const manager: any = {
      query,
      transaction: jest.fn(async (work: any) => work({ query })),
    };
    const childRepo: any = { manager, query: jest.fn().mockResolvedValue([]) };
    const service = new ChildrenService(childRepo, {} as any, {} as any);
    jest.spyOn(service, "findOne").mockResolvedValue({ id: "41" } as any);
    return { service, query };
  };
  it("returns an unconfigured profile without filling measurements or a diet", async () => {
    const { service } = make();
    await expect(
      service.getNutritionProfile(41, { sub: 8, roles: ["NUTRITIONIST"] }),
    ).resolves.toEqual({ childId: "41", profile: null });
  });
  it("stores authored fields with the authenticated author and reads them back", async () => {
    const { service } = make();
    const result = await service.updateNutritionProfile(
      41,
      { dietaryRegime: "Chế độ đã đánh giá", targetEnergyKcal: 620 },
      { sub: 8, roles: ["NUTRITIONIST"] },
    );
    expect(result.profile).toMatchObject({
      dietaryRegime: "Chế độ đã đánh giá",
      targetEnergyKcal: 620,
      updatedBy: "8",
    });
    expect(
      (
        await service.getNutritionProfile(41, {
          sub: 8,
          roles: ["NUTRITIONIST"],
        })
      ).profile,
    ).toEqual(result.profile);
  });
  it("rejects a parent who is not linked to that child", async () => {
    const { service, query } = make();
    await expect(
      service.updateNutritionProfile(
        41,
        { dietaryNotes: "Không được lưu" },
        { sub: 7, roles: ["PARENT"] },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(query).not.toHaveBeenCalled();
  });
});
