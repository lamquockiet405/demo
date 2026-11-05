import { configuredMenuCriteria } from "../../../src/modules/nutrition-engine/services/menu-criteria";

describe("Configured menu criteria", () => {
  const summary = {
    energyKcal: 650,
    proteinPct: 15,
    fatPct: 30,
    carbPct: 55,
    calciumMg: 300,
    ironMg: 4,
    zincMg: 3,
  };
  const standard = {
    minEnergyKcal: 600,
    maxEnergyKcal: 700,
    minProteinPct: 10,
    maxProteinPct: 20,
    minFatPct: 20,
    maxFatPct: 35,
    minCarbPct: 50,
    maxCarbPct: 65,
    minCalciumMg: 200,
  };
  const slots = [
    {
      date: "2026-11-02",
      meal: "LUNCH",
      dishId: 7,
      categoryId: 2,
      categoryCode: "MAIN",
      foodGroupIds: [3],
    },
    {
      date: "2026-11-03",
      meal: "LUNCH",
      dishId: 7,
      categoryId: 2,
      categoryCode: "MAIN",
      foodGroupIds: [3],
    },
  ];
  it("reports six criteria without treating missing rules or allergy data as a pass", () => {
    const result = configuredMenuCriteria(
      summary,
      standard,
      slots,
      [],
      [],
      null,
    );
    expect(result).toHaveLength(6);
    expect(
      result.filter((c) => c.status === "UNKNOWN").map((c) => c.key),
    ).toEqual(["ALLERGENS", "FREQUENCY", "SPACING"]);
  });
  it("finds a real allergy conflict and repeated dish with the configured spacing", () => {
    const result = configuredMenuCriteria(
      summary,
      standard,
      slots,
      [],
      [
        {
          targetType: "SPECIFIC_DISH",
          targetId: 7,
          mealSlot: "ALL",
          minSpacingDays: 3,
          ruleName: "Giãn cách",
        },
      ],
      ["Học sinh · món · dị nguyên"],
    );
    expect(result.find((c) => c.key === "ALLERGENS").status).toBe("FAIL");
    expect(result.find((c) => c.key === "SPACING").status).toBe("FAIL");
  });
  it("checks food group frequency from ingredient membership", () => {
    const result = configuredMenuCriteria(
      summary,
      standard,
      slots,
      [
        {
          targetType: "FOOD_GROUP",
          targetId: 3,
          mealSlot: "LUNCH",
          periodType: "PER_WEEK",
          minOccurrences: 0,
          maxOccurrences: 1,
          ruleName: "Nhóm thực phẩm",
        },
      ],
      [],
      [],
    );
    expect(result.find((c) => c.key === "FREQUENCY").status).toBe("FAIL");
  });
  it("does not pass a four-week rule using only one week of data", () => {
    const result = configuredMenuCriteria(
      summary,
      standard,
      slots,
      [
        {
          targetType: "FOOD_GROUP",
          targetId: 3,
          mealSlot: "ALL",
          periodType: "PER_CYCLE_4_WEEKS",
          minOccurrences: 0,
          maxOccurrences: 4,
        },
      ],
      [],
      [],
    );
    expect(result.find((c) => c.key === "FREQUENCY").status).toBe("UNKNOWN");
  });
});
