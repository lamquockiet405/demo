import { firstValueFrom, of } from "rxjs";
import { SnackServicesService } from "../../../src/modules/snack-services/snack-services.service";
import { MenuExportService } from "../../../src/modules/menus/services/menu-export.service";
import { TransformInterceptor } from "../../../src/common/interceptors/transform.interceptor";
import { TenantService } from "../../../src/modules/tenant/services/tenant.service";
import { UserProfileService } from "../../../src/modules/users/services/user-profile.service";

function storedManager() {
  const states = new Map<string, string>();
  const manager: any = {
    transaction: async (work: any) => work(manager),
    query: jest.fn(async (sql: string, params: any[] = []) => {
      if (sql.startsWith("SELECT config_value"))
        return states.has(params[0])
          ? [{ config_value: states.get(params[0]) }]
          : [];
      if (sql.startsWith("UPDATE system_configs")) {
        if (!states.has(params[0])) return [];
        states.set(params[0], params[1]);
        return [{ id: 1 }];
      }
      if (sql.startsWith("INSERT INTO system_configs")) {
        states.set(params[0], params[1]);
        return [];
      }
      if (sql.startsWith("SELECT name FROM schools"))
        return [{ name: "School from database" }];
      if (sql.includes("AS classes"))
        return [{ classes: 2, children: 7, staff: 3 }];
      return [];
    }),
  };
  return manager;
}
describe("Principal persisted configuration and real exports", () => {
  let period: any, repo: any, manager: any, service: SnackServicesService;
  beforeEach(() => {
    manager = storedManager();
    period = {
      id: 19,
      name: "Configured service",
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      feeAmount: 0,
      status: "OPEN",
      registrations: [],
    };
    repo = {
      manager,
      find: jest.fn(async () => []),
      findOne: jest.fn(async () => period),
      create: jest.fn((x) => ({ ...x, id: 19 })),
      save: jest.fn(async (x) => {
        period = { ...period, ...x };
        return period;
      }),
    };
    service = new SnackServicesService(
      repo,
      {} as any,
      { count: async () => 0 } as any,
    );
  });
  it("keeps menu and description after a new service instance is created", async () => {
    const schedule: any = [
      { dayOfWeek: 2, dayLabel: "Monday", mainDish: "Actual configured dish" },
    ];
    await service.updateMenuSchedule(19, {
      menuSchedule: schedule,
      description: "Saved notes",
    });
    const restarted = new SnackServicesService(repo, {} as any, {} as any);
    const detail = await restarted.findOne(19);
    expect(detail.data.description).toBe("Saved notes");
    expect(detail.data.menuSchedule).toEqual(schedule);
    expect(detail.data.pricePerUnit).toBeNull();
    expect(detail.data.feeAmount).toBe(0);
  });
  it("stores draft configuration and calculates only selected months instead of 22 days per month", async () => {
    await service.createPeriod({
      name: "Selected months",
      status: "DRAFT",
      serviceMonths: ["2026-11", "2027-01"],
      pricePerUnitPerDay: 100,
      nutritionNotes: "Configured note",
    });
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ feeAmount: 4200, status: "CLOSED" }),
    );
    const restarted = new SnackServicesService(repo, {} as any, {} as any);
    const detail = await restarted.findOne(19);
    expect(detail.status).toBe("DRAFT");
    expect(detail.data.servingDays).toBe(42);
    expect(detail.data.description).toBe("Configured note");
  });
  it("preserves an explicitly free period and allows clearing a description", async () => {
    await service.createPeriod({
      name: "Free service",
      status: "DRAFT",
      startDate: "2026-11-02",
      endDate: "2026-11-06",
      feeAmount: 0,
      nutritionNotes: "Old description",
    });
    await service.updatePeriod(19, { description: "", feeAmount: 0 });
    const detail = await service.findOne(19);
    expect(detail.data.description).toBe("");
    expect(detail.data.feeAmount).toBe(0);
  });
  it("rejects missing price rather than inserting a default price", async () => {
    await expect(
      service.createPeriod({
        name: "No price",
        status: "DRAFT",
        startDate: "2026-11-02",
        endDate: "2026-11-06",
      }),
    ).rejects.toThrow();
    expect(repo.save).not.toHaveBeenCalled();
  });
  it("reads school identity, counts and saved configuration from storage", async () => {
    const school = {
      id: 1,
      name: "Configured school",
      phone: "",
      address: "",
      email: "",
    };
    const schoolRepo: any = {
      manager,
      findOne: async () => school,
      save: async (x: any) => x,
    };
    const tenant = new TenantService(
      schoolRepo,
      {} as any,
      {} as any,
      {} as any,
    );
    await tenant.updateProfile(
      { operationalSettings: { foodRetentionHours: 48 } as any },
      1,
    );
    const restarted = new TenantService(
      schoolRepo,
      {} as any,
      {} as any,
      {} as any,
    );
    const data = await restarted.getProfile(1);
    expect(data.name).toBe("Configured school");
    expect(data.phone).toBe("");
    expect(data.stats.totalChildren).toBe(7);
    expect(data.operationalSettings.foodRetentionHours).toBe(48);
    expect(data.isEducationDbSynced).toBe(false);
  });
  it("exports stored dishes on their actual calendar day and leaves unknown nutrition empty", async () => {
    const menu: any = {
      title: "Stored menu",
      version: 3,
      ageGroup: "NHA_TRE",
      status: "PUBLISHED",
      startDate: "2026-11-02",
      endDate: "2026-11-06",
      nutritionAvailable: false,
      createdByName: "Actual author",
      approvedByName: "Actual reviewer",
      approvedAt: "2026-11-01T01:00:00Z",
      days: [
        {
          date: "2026-11-03",
          dayOfWeek: 1,
          meals: [
            { mealType: "LUNCH", dishes: [{ dishName: "=Formula safe dish" }] },
          ],
        },
      ],
    };
    const exports = new MenuExportService(
      { findOne: async () => menu } as any,
      { manager } as any,
    );
    const data = await exports.exportData(19, 1);
    expect(data.rows[0].mondayDishes).toBe("");
    expect(data.rows[0].tuesdayDishes).toBe("=Formula safe dish");
    expect(data.dailyAverageCalories).toBeNull();
    expect(data.approvedBy).toBe("Actual reviewer");
    const file = await exports.exportExcel(19, 1);
    let csv = "";
    for await (const chunk of file.getStream()) csv += chunk.toString();
    expect(csv).toContain("'=Formula safe dish");
    expect(csv).toContain("Stored menu");
    expect(csv).not.toContain("downloadUrl");
    expect(file.getHeaders().type).toContain("text/csv");
    const interceptor = new TransformInterceptor();
    const result = await firstValueFrom(
      interceptor.intercept(
        {
          switchToHttp: () => ({ getResponse: () => ({ statusCode: 200 }) }),
        } as any,
        { handle: () => of(file) },
      ),
    );
    expect(result).toBe(file);
  });
  it("allows an authenticated profile to clear optional contact fields without demo defaults", async () => {
    const user: any = {
      id: 8,
      fullName: "Actual user",
      phone: "Old phone",
      avatar: "old.png",
      roles: [],
    };
    const profiles = new UserProfileService({
      findOne: async () => user,
      save: async () => user,
    } as any);
    const result = await profiles.updateProfile(8, { phone: "", avatar: "" });
    expect(result.phone).toBe("");
    expect(result.avatarUrl).toBe("");
    expect(result.fullName).toBe("Actual user");
  });
});
