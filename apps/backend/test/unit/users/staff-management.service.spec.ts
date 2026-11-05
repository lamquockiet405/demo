import { StaffManagementService } from "../../../src/modules/users/services/staff-management.service";
import { StaffManagementController } from "../../../src/modules/users/controllers/staff-management.controller";
import * as bcrypt from "bcryptjs";
jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("hashed-password"),
}));

describe("Staff account frontend/backend contract", () => {
  function setup() {
    let user: any = {
      id: 9,
      email: "staff@example.invalid",
      fullName: "Actual staff",
      status: "ACTIVE",
      roles: [{ id: 2, code: "TEACHER", name: "Teacher" }],
      createdAt: new Date("2026-11-01"),
    };
    const qb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn(async () => [user]),
    };
    const users: any = {
      createQueryBuilder: () => qb,
      findOne: jest.fn(async ({ where }) => (where.email ? null : user)),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => {
        user = { ...user, ...x };
        return user;
      }),
      find: async () => [user],
    };
    let profile: any = { userId: 9, staffType: "TEACHER" };
    const profiles: any = {
      findOne: async () => profile,
      find: async () => [profile],
      create: (x) => x,
      save: jest.fn(async (x) => {
        profile = x;
        return x;
      }),
    };
    const roles: any = {
      findOne: async ({ where }) => ({
        id: 2,
        code: where.code,
        name: where.code,
      }),
      find: async () => [
        { id: 2, code: "TEACHER", name: "Teacher" },
        { id: 3, code: "PARENT", name: "Parent" },
      ],
    };
    const service = new StaffManagementService(users, roles, profiles);
    return {
      service,
      users,
      profiles,
      qb,
      controller: new StaffManagementController(service),
    };
  }
  it("supports roleCodes from the staff drawer and stores all selected roles", async () => {
    const { service, users, profiles } = setup();
    const result = await service.create({
      email: " New@Example.invalid ",
      fullName: "New staff",
      roleCodes: ["TEACHER", "NUTRITIONIST"],
      password: "explicit-password",
    });
    expect(users.save).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new@example.invalid",
        roles: [
          expect.objectContaining({ code: "TEACHER" }),
          expect.objectContaining({ code: "NUTRITIONIST" }),
        ],
      }),
    );
    expect(result.roles.map((r) => r.code)).toEqual([
      "TEACHER",
      "NUTRITIONIST",
    ]);
    expect(profiles.save).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 9, startDate: null }),
    );
  });
  it("rejects non-staff and missing roles before creating a user", async () => {
    const { service, users } = setup();
    await expect(
      service.create({
        email: "x@example.invalid",
        fullName: "X",
        roleCodes: ["PARENT"],
      }),
    ).rejects.toThrow();
    await expect(
      service.create({ email: "x@example.invalid", fullName: "X" }),
    ).rejects.toThrow();
    expect(users.save).not.toHaveBeenCalled();
  });
  it("returns paginated objects with role names and applies search and role filters", async () => {
    const { service, qb } = setup();
    const result = await service.findAll({
      search: "actual",
      roleCode: "TEACHER",
      page: 1,
      limit: 10,
    });
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining("LOWER"), {
      s: "%actual%",
    });
    expect(result.meta.total).toBe(1);
    expect(result.data[0].roles[0].code).toBe("TEACHER");
    expect(
      (await service.findAll({ roleCode: "NUTRITIONIST" })).meta.total,
    ).toBe(0);
  });
  it("updates roles, clears optional contact fields and hashes the supplied replacement password", async () => {
    const { service } = setup();
    const result = await service.update(9, {
      phone: "",
      roleCodes: ["NUTRITIONIST"],
      newPassword: "new-explicit-password",
    });
    expect(result.phone).toBe("");
    expect(result.roles[0].code).toBe("NUTRITIONIST");
    expect(bcrypt.hash).toHaveBeenCalledWith("new-explicit-password", 10);
  });
  it("reports only stored staff counts and excludes parent roles from assignment", async () => {
    const { service } = setup();
    expect((await service.getStats()).teachers).toBe(1);
    expect((await service.getRoles()).map((r) => r.code)).toEqual(["TEACHER"]);
  });
  it("passes numeric account ids and the real payload through the update controller", async () => {
    const { service, controller } = setup();
    const update = jest.spyOn(service, "update");
    await controller.update(9, { fullName: "Changed name" });
    expect(update).toHaveBeenCalledWith(9, { fullName: "Changed name" });
  });
});
