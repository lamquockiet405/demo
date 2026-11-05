export type MenuCriterion = {
  key: string;
  name: string;
  status: "PASS" | "FAIL" | "UNKNOWN";
  findings: string[];
};
export type MenuSlot = {
  date: string;
  meal: string;
  dishId: number;
  categoryId?: number;
  categoryCode?: string;
  foodGroupIds: number[];
};

export function configuredMenuCriteria(
  summary: any,
  standard: any,
  slots: MenuSlot[],
  frequency: any[],
  spacing: any[],
  conflicts: string[] | null,
): MenuCriterion[] {
  const criterion = (
    key: string,
    name: string,
    configured: boolean,
    findings: string[],
  ): MenuCriterion => ({
    key,
    name,
    status: findings.length ? "FAIL" : configured ? "PASS" : "UNKNOWN",
    findings: findings.length
      ? findings
      : configured
        ? []
        : ["Chưa đủ dữ liệu hoặc chưa có quy tắc áp dụng."],
  });
  const between = (value: number, min: number, max: number) =>
    Number.isFinite(Number(value)) &&
    value >= Number(min) &&
    value <= Number(max);
  const energy =
    standard &&
    standard.minEnergyKcal != null &&
    standard.maxEnergyKcal != null;
  const macroKeys = [
    ["proteinPct", "minProteinPct", "maxProteinPct", "Đạm"],
    ["fatPct", "minFatPct", "maxFatPct", "Béo"],
    ["carbPct", "minCarbPct", "maxCarbPct", "Bột đường"],
  ];
  const macros =
    !!standard &&
    macroKeys.every(
      ([, min, max]) => standard[min] != null && standard[max] != null,
    );
  const micronutrients = [
    ["calciumMg", "minCalciumMg", "Canxi"],
    ["ironMg", "minIronMg", "Sắt"],
    ["zincMg", "minZincMg", "Kẽm"],
  ].filter(([, min]) => standard?.[min] != null && Number(standard[min]) > 0);
  const matches = (slot: MenuSlot, rule: any) =>
    (rule.mealSlot === "ALL" || rule.mealSlot === slot.meal) &&
    (rule.targetType === "SPECIFIC_DISH"
      ? slot.dishId === Number(rule.targetId)
      : rule.targetType === "FOOD_GROUP"
        ? slot.foodGroupIds.includes(Number(rule.targetId))
        : slot.categoryId === Number(rule.targetId) ||
          (!!rule.targetCode && slot.categoryCode === rule.targetCode));
  const frequencyFindings: string[] = [],
    spacingFindings: string[] = [];
  let frequencyKnown = !!frequency.length && !!slots.length;
  const monday = (date: string) => {
    const d = new Date(date + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  };
  for (const rule of frequency) {
    if (!["PER_DAY", "PER_WEEK"].includes(rule.periodType)) {
      frequencyKnown = false;
      continue;
    }
    const groups = [
      ...new Set(
        slots.map((s) =>
          rule.periodType === "PER_DAY" ? s.date : monday(s.date),
        ),
      ),
    ];
    for (const group of groups) {
      const scoped = slots.filter(
        (s) =>
          (rule.periodType === "PER_DAY" ? s.date : monday(s.date)) === group,
      );
      const count = scoped.filter((s) => matches(s, rule)).length;
      if (
        count < Number(rule.minOccurrences) ||
        count > Number(rule.maxOccurrences)
      )
        frequencyFindings.push(
          `${rule.ruleName}: ${group} có ${count} lượt, cấu hình ${rule.minOccurrences}–${rule.maxOccurrences}.`,
        );
    }
  }
  for (const rule of spacing) {
    const relevant = slots
      .filter((s) => matches(s, rule))
      .sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 1; i < relevant.length; i++) {
      const previous = relevant[i - 1],
        current = relevant[i];
      const days =
        (Date.parse(current.date) - Date.parse(previous.date)) / 86400000;
      if (
        days < Number(rule.minSpacingDays) ||
        (rule.noRepeatInSameDay && days === 0) ||
        (rule.noRepeatInSameWeek &&
          monday(previous.date) === monday(current.date))
      )
        spacingFindings.push(
          `${rule.ruleName}: lặp ngày ${previous.date} và ${current.date}.`,
        );
    }
  }
  return [
    criterion(
      "ENERGY",
      "Năng lượng",
      energy,
      energy &&
        !between(
          summary.energyKcal,
          standard.minEnergyKcal,
          standard.maxEnergyKcal,
        )
        ? [
            `Năng lượng ${summary.energyKcal} kcal ngoài khoảng ${standard.minEnergyKcal}–${standard.maxEnergyKcal}.`,
          ]
        : [],
    ),
    criterion(
      "MACROS",
      "Tỷ lệ đạm, béo, bột đường",
      macros,
      macros
        ? macroKeys
            .filter(
              ([key, min, max]) =>
                !between(summary[key], standard[min], standard[max]),
            )
            .map(
              ([key, min, max, label]) =>
                `${label}: ${summary[key]}%, cấu hình ${standard[min]}–${standard[max]}%.`,
            )
        : [],
    ),
    criterion(
      "MICRONUTRIENTS",
      "Vi chất",
      !!micronutrients.length,
      micronutrients
        .filter(
          ([key, min]) =>
            summary[key] == null ||
            Number(summary[key]) < Number(standard[min]),
        )
        .map(
          ([key, min, label]) =>
            `${label}: ${summary[key] ?? "chưa có số liệu"}, tối thiểu ${standard[min]}.`,
        ),
    ),
    criterion(
      "ALLERGENS",
      "Dị ứng đã khai báo",
      conflicts !== null,
      conflicts || [],
    ),
    criterion(
      "FREQUENCY",
      "Tần suất thực phẩm và nhóm món",
      frequencyKnown,
      frequencyFindings,
    ),
    criterion(
      "SPACING",
      "Giãn cách lặp món",
      !!spacing.length && !!slots.length,
      spacingFindings,
    ),
  ];
}
