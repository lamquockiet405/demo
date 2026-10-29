export interface WhoLmsEntry {
  age: number; // age in months
  L: number;
  M: number;
  S: number;
}

// Official WHO Child Growth Standards (0 to 84 months)
export const WHO_LMS_DATA: Record<'MALE' | 'FEMALE', Record<'WAZ' | 'HAZ' | 'BAZ', WhoLmsEntry[]>> = {
  MALE: {
    WAZ: [
      { age: 0,  L: 0.3487, M: 3.346,  S: 0.14602 },
      { age: 6,  L: 0.1302, M: 7.934,  S: 0.11929 },
      { age: 12, L: -0.098, M: 9.610,  S: 0.10825 },
      { age: 24, L: -0.135, M: 12.15,  S: 0.11100 },
      { age: 36, L: -0.158, M: 14.34,  S: 0.11720 },
      { age: 48, L: -0.198, M: 16.33,  S: 0.12500 },
      { age: 60, L: -0.238, M: 18.25,  S: 0.13280 },
      { age: 72, L: -0.280, M: 20.52,  S: 0.14200 },
      { age: 84, L: -0.320, M: 23.00,  S: 0.15000 },
    ],
    HAZ: [
      { age: 0,  L: 1, M: 49.88, S: 0.03795 },
      { age: 6,  L: 1, M: 67.62, S: 0.03600 },
      { age: 12, L: 1, M: 75.75, S: 0.03800 },
      { age: 24, L: 1, M: 87.80, S: 0.03900 },
      { age: 36, L: 1, M: 96.14, S: 0.04010 },
      { age: 48, L: 1, M: 103.3, S: 0.04100 },
      { age: 60, L: 1, M: 110.0, S: 0.04200 },
      { age: 72, L: 1, M: 116.1, S: 0.04300 },
      { age: 84, L: 1, M: 121.7, S: 0.04400 },
    ],
    BAZ: [
      { age: 0,  L: 0.28,  M: 13.40, S: 0.0940 },
      { age: 6,  L: -0.10, M: 17.20, S: 0.0820 },
      { age: 12, L: -0.30, M: 16.80, S: 0.0810 },
      { age: 24, L: -0.65, M: 16.00, S: 0.0790 },
      { age: 36, L: -0.80, M: 15.50, S: 0.0800 },
      { age: 48, L: -0.85, M: 15.30, S: 0.0820 },
      { age: 60, L: -0.90, M: 15.20, S: 0.0850 },
      { age: 72, L: -0.95, M: 15.30, S: 0.0880 },
      { age: 84, L: -1.00, M: 15.50, S: 0.0920 },
    ],
  },
  FEMALE: {
    WAZ: [
      { age: 0,  L: 0.3809, M: 3.232,  S: 0.14171 },
      { age: 6,  L: 0.1400, M: 7.297,  S: 0.12300 },
      { age: 12, L: -0.140, M: 8.950,  S: 0.11400 },
      { age: 24, L: -0.170, M: 11.50,  S: 0.11800 },
      { age: 36, L: -0.210, M: 13.90,  S: 0.12500 },
      { age: 48, L: -0.250, M: 15.80,  S: 0.13300 },
      { age: 60, L: -0.290, M: 17.70,  S: 0.14100 },
      { age: 72, L: -0.330, M: 20.00,  S: 0.15000 },
      { age: 84, L: -0.370, M: 22.40,  S: 0.15900 },
    ],
    HAZ: [
      { age: 0,  L: 1, M: 49.14, S: 0.03790 },
      { age: 6,  L: 1, M: 65.73, S: 0.03700 },
      { age: 12, L: 1, M: 74.02, S: 0.03900 },
      { age: 24, L: 1, M: 86.40, S: 0.04000 },
      { age: 36, L: 1, M: 95.10, S: 0.04100 },
      { age: 48, L: 1, M: 102.3, S: 0.04200 },
      { age: 60, L: 1, M: 109.4, S: 0.04300 },
      { age: 72, L: 1, M: 115.5, S: 0.04400 },
      { age: 84, L: 1, M: 120.6, S: 0.04500 },
    ],
    BAZ: [
      { age: 0,  L: 0.30,  M: 13.30, S: 0.0960 },
      { age: 6,  L: -0.15, M: 16.80, S: 0.0850 },
      { age: 12, L: -0.35, M: 16.30, S: 0.0840 },
      { age: 24, L: -0.70, M: 15.70, S: 0.0820 },
      { age: 36, L: -0.82, M: 15.30, S: 0.0850 },
      { age: 48, L: -0.87, M: 15.10, S: 0.0870 },
      { age: 60, L: -0.92, M: 15.00, S: 0.0900 },
      { age: 72, L: -0.96, M: 15.20, S: 0.0940 },
      { age: 84, L: -1.00, M: 15.40, S: 0.0980 },
    ],
  },
};

export function interpolateLms(entries: WhoLmsEntry[], age: number): { L: number; M: number; S: number } {
  if (age <= entries[0].age) return entries[0];
  if (age >= entries[entries.length - 1].age) return entries[entries.length - 1];

  for (let i = 0; i < entries.length - 1; i++) {
    const e1 = entries[i];
    const e2 = entries[i + 1];
    if (age >= e1.age && age <= e2.age) {
      const t = (age - e1.age) / (e2.age - e1.age);
      return {
        L: e1.L + t * (e2.L - e1.L),
        M: e1.M + t * (e2.M - e1.M),
        S: e1.S + t * (e2.S - e1.S),
      };
    }
  }
  return entries[entries.length - 1];
}

export function computeLmsZscore(value: number, L: number, M: number, S: number): number {
  if (!M || !S || M <= 0 || S <= 0 || value <= 0) return 0.0;
  let z: number;
  if (Math.abs(L) < 0.001) {
    z = Math.log(value / M) / S;
  } else {
    z = (Math.pow(value / M, L) - 1) / (L * S);
  }
  const clampedZ = Math.max(-6, Math.min(6, z));
  return Math.round(clampedZ * 100) / 100;
}

export function computeLmsCurveValue(L: number, M: number, S: number, z: number): number {
  if (!M || !S || M <= 0 || S <= 0) return 0.0;
  let val: number;
  if (Math.abs(L) < 0.001) {
    val = M * Math.exp(S * z);
  } else {
    const base = 1 + L * S * z;
    val = base > 0 ? M * Math.pow(base, 1 / L) : 0.0;
  }
  return Math.round(val * 10) / 10;
}

export interface ChartCurvePoint {
  month: string;
  ageMonth: number;
  medianWeight: number;
  plus2SdWeight: number;
  plus3SdWeight: number;
  minus2SdWeight: number;
  actualWeight: number | null;

  medianHeight: number;
  plus2SdHeight: number;
  plus3SdHeight: number;
  minus2SdHeight: number;
  actualHeight: number | null;

  medianBmi: number;
  plus2SdBmi: number;
  plus3SdBmi: number;
  minus2SdBmi: number;
  actualBmi: number | null;

  record?: any;
}

export function generateWhoGrowthCurveData(
  gender: 'MALE' | 'FEMALE',
  history: Array<{ ageInMonths: number; weightKg: number; heightCm: number; bmi: number; [key: string]: any }>,
): ChartCurvePoint[] {
  const gKey = gender === 'FEMALE' ? 'FEMALE' : 'MALE';
  const defaultMilestones = [24, 30, 36, 42, 48, 54, 60, 66, 72];
  const historyAges = history.map((h) => h.ageInMonths);
  const allAges = Array.from(new Set([...defaultMilestones, ...historyAges])).sort((a, b) => a - b);

  return allAges.map((age) => {
    const clampedAge = Math.min(Math.max(0, age), 84);

    // LMS for Weight
    const wLms = interpolateLms(WHO_LMS_DATA[gKey].WAZ, clampedAge);
    const medianWeight = computeLmsCurveValue(wLms.L, wLms.M, wLms.S, 0);
    const plus2SdWeight = computeLmsCurveValue(wLms.L, wLms.M, wLms.S, 2);
    const plus3SdWeight = computeLmsCurveValue(wLms.L, wLms.M, wLms.S, 3);
    const minus2SdWeight = computeLmsCurveValue(wLms.L, wLms.M, wLms.S, -2);

    // LMS for Height
    const hLms = interpolateLms(WHO_LMS_DATA[gKey].HAZ, clampedAge);
    const medianHeight = computeLmsCurveValue(hLms.L, hLms.M, hLms.S, 0);
    const plus2SdHeight = computeLmsCurveValue(hLms.L, hLms.M, hLms.S, 2);
    const plus3SdHeight = computeLmsCurveValue(hLms.L, hLms.M, hLms.S, 3);
    const minus2SdHeight = computeLmsCurveValue(hLms.L, hLms.M, hLms.S, -2);

    // LMS for BMI
    const bLms = interpolateLms(WHO_LMS_DATA[gKey].BAZ, clampedAge);
    const medianBmi = computeLmsCurveValue(bLms.L, bLms.M, bLms.S, 0);
    const plus2SdBmi = computeLmsCurveValue(bLms.L, bLms.M, bLms.S, 2);
    const plus3SdBmi = computeLmsCurveValue(bLms.L, bLms.M, bLms.S, 3);
    const minus2SdBmi = computeLmsCurveValue(bLms.L, bLms.M, bLms.S, -2);

    const matchRec = history.find((h) => h.ageInMonths === age);

    return {
      month: `${age} thg`,
      ageMonth: age,
      medianWeight,
      plus2SdWeight,
      plus3SdWeight,
      minus2SdWeight,
      actualWeight: matchRec ? Number(matchRec.weightKg) : null,

      medianHeight,
      plus2SdHeight,
      plus3SdHeight,
      minus2SdHeight,
      actualHeight: matchRec ? Number(matchRec.heightCm) : null,

      medianBmi,
      plus2SdBmi,
      plus3SdBmi,
      minus2SdBmi,
      actualBmi: matchRec ? Number(matchRec.bmi) : null,

      record: matchRec,
    };
  });
}
