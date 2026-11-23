export type KitchenStatus =
  | "WAITING"
  | "SYNCED"
  | "PREPARING"
  | "PORTIONING"
  | "READY_DELIVERY"
  | "DELIVERED"
  | "COMPLETED";

export interface KitchenClass {
  classId: string;
  className: string;
  gradeLevel: string;
  gradeLabel: string;
  roomNumber: string;
  teacherName: string;
  lunchCount: number | null;
  snackCount: number | null;
  absentCount: number | null;
  specialCount: number | null;
  isLocked: boolean | null;
  kitchenStatus: KitchenStatus;
}

export interface KitchenAlert {
  id: string;
  childName: string;
  className: string;
  severity: string;
  urgent: boolean;
  allergen: string;
  replacementMeal: string;
  notes: string;
}

export interface KitchenData {
  classes: KitchenClass[];
  alerts: KitchenAlert[];
  menu: {
    id: string;
    name: string;
    type: string;
    portionSize: string;
    calories: string;
  }[];
  summary: {
    lunch: number | null;
    snack: number | null;
    absent: number | null;
    special: number | null;
    locked: number | null;
    total: number;
    kindergarten: number | null;
    toddler: number | null;
  };
  lastUpdated: string | null;
}

type Raw = Record<string, any>;
const list = (value: unknown): Raw[] =>
  Array.isArray(value)
    ? value.filter((item) => item && typeof item === "object")
    : [];
const label = (value: unknown): string =>
  typeof value === "string" || typeof value === "number" ? String(value) : "";
const count = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};
const sumKnown = (values: (number | null)[]): number | null =>
  values.every((value) => value !== null)
    ? values.reduce<number>((sum, value) => sum + value!, 0)
    : null;

export const normalizeSearch = (value: unknown): string =>
  String(value ?? '')
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export const getSchoolDate = (): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

export const isToddler = (grade: string): boolean =>
  /TODDLER|NHA_TRE|NHÀ TRẺ|18.?24|24.?36|0.?3|1.?2|2.?3/i.test(grade);

export const statusLabels: Record<KitchenStatus, string> = {
  WAITING: "Chờ tiếp nhận",
  SYNCED: "Đã nhận báo bếp",
  PREPARING: "Đang chuẩn bị",
  PORTIONING: "Đang chia suất",
  READY_DELIVERY: "Sẵn sàng giao",
  DELIVERED: "Đã giao lên lớp",
  COMPLETED: "Đã xuất khay",
};

// Adapt both existing KDS response shapes at the frontend boundary. Missing data
// stays null so an unavailable count is never presented as a confirmed zero.
export function normalizeKitchenData(
  payload: unknown,
  headcountPayload?: unknown,
): KitchenData {
  if (
    !payload ||
    typeof payload !== "object" ||
    !Array.isArray((payload as Raw).classes)
  ) {
    throw new Error("Dữ liệu báo bếp không đúng định dạng. Vui lòng tải lại.");
  }
  const raw = payload as Raw;
  const headcount =
    headcountPayload &&
    typeof headcountPayload === "object" &&
    Array.isArray((headcountPayload as Raw).classes)
      ? (headcountPayload as Raw)
      : null;
  const attendanceByClass = new Map(
    list(headcount?.classes).map((item) => [label(item.id), item]),
  );
  const classes = list(raw.classes).map((item): KitchenClass => {
    const attendance = attendanceByClass.get(label(item.classId ?? item.id));
    const grade = label(item.gradeLevel || item.ageGroup);
    const status = label(item.kitchenStatus || item.status);
    return {
      classId: label(item.classId ?? item.id),
      className: label(item.className || item.name) || "Lớp chưa có tên",
      gradeLevel: grade,
      gradeLabel:
        label(item.gradeLevelLabel) ||
        (grade
          ? isToddler(grade)
            ? "Nhà trẻ · Cháo / xay"
            : "Mẫu giáo · Cơm mềm"
          : "Chưa có thông tin khối"),
      roomNumber: label(item.roomNumber || attendance?.roomNumber),
      teacherName: label(item.teacherName || attendance?.homeroomTeacher),
      lunchCount:
        count(item.lunchCount) ??
        count(attendance?.lunchCount) ??
        count(item.actualPortions),
      snackCount: count(item.snackCount) ?? count(attendance?.snackCount),
      absentCount: count(item.absentCount) ?? count(attendance?.absentToday),
      specialCount: count(item.specialCount),
      isLocked:
        typeof item.isLocked === "boolean"
          ? item.isLocked
          : typeof attendance?.isKitchenLocked === "boolean"
            ? attendance.isKitchenLocked
            : null,
      kitchenStatus: Object.prototype.hasOwnProperty.call(statusLabels, status)
        ? (status as KitchenStatus)
        : "WAITING",
    };
  });
  const alerts: KitchenAlert[] = list(raw.allergyAlerts)
    .filter((item) => !item.isResolved)
    .map((item, index) => ({
      id: label(item.id) || `alert-${index}`,
      childName: label(item.childName) || "Suất ăn riêng",
      className: label(item.className),
      severity: label(item.severity) || "Cần kiểm tra",
      urgent: item.badgeColor === "RED",
      allergen: label(item.allergen),
      replacementMeal: label(item.replacementMeal),
      notes: label(item.dosingNotes),
    }));
  // The legacy endpoint supplies class-level allergy instructions, not children
  // or tray totals. Preserve the complete instructions without guessing names.
  if (!Array.isArray(raw.allergyAlerts)) {
    list(raw.classes).forEach((item, index) => {
      if (!Array.isArray(item.allergies)) return;
      item.allergies.forEach((instruction: unknown, alertIndex: number) => {
        const text = label(instruction);
        if (!text) return;
        const match = text.match(/(?:1\s*suất\s*)?(?:không\s*)?([^(]+?)\s*\((?:Bé\s*)?([^)]+)\)/i);
        const childName = match ? `Bé ${match[2].trim()}` : "Yêu cầu suất ăn riêng";
        const allergenClean = match ? match[1].trim() : text;
        alerts.push({
          id: `class-${index}-${alertIndex}`,
          childName,
          className: label(item.className),
          severity: "Cần kiểm tra",
          urgent: true,
          allergen: text,
          replacementMeal: "",
          notes: match ? `Kiêng: ${allergenClean}` : "",
        });
      });
    });
  }
  const summary = raw.summary || {};
  return {
    classes,
    alerts,
    menu: list(raw.todayMenu).map((item, index) => ({
      id: label(item.id) || `dish-${index}`,
      name: label(item.name) || "Món ăn chưa có tên",
      type:
        (
          {
            MAIN_COURSE: "Món mặn",
            SOUP: "Món canh",
            SIDE_DISH: "Món phụ",
            DESSERT: "Tráng miệng",
            RICE: "Cơm",
          } as Record<string, string>
        )[item.type] ||
        label(item.type) ||
        "Món ăn",
      portionSize: label(item.portionSize),
      calories: label(item.calories),
    })),
    summary: {
      lunch:
        count(summary.totalLunchPortions) ??
        count(headcount?.overview?.lunchPortions ?? headcount?.totalLunch) ??
        count(raw.totalActual) ??
        sumKnown(classes.map((item) => item.lunchCount)),
      snack:
        count(summary.totalSnackPortions) ??
        count(headcount?.overview?.snackPortions ?? headcount?.totalSnack) ??
        sumKnown(classes.map((item) => item.snackCount)),
      absent:
        count(summary.absentCount) ??
        count(headcount?.overview?.absentToday ?? headcount?.totalAbsent) ??
        sumKnown(classes.map((item) => item.absentCount)),
      special:
        count(summary.specialTraysCount) ??
        sumKnown(classes.map((item) => item.specialCount)),
      locked:
        count(summary.lockedClasses) ??
        count(
          headcount?.overview?.classesLockedCount ??
            headcount?.lockedClassesCount,
        ) ??
        (classes.every((item) => item.isLocked !== null)
          ? classes.filter((item) => item.isLocked).length
          : null),
      total: count(summary.totalClasses) ?? classes.length,
      kindergarten:
        count(summary.kindergartenPortions) ??
        (classes.every((item) => item.gradeLevel)
          ? sumKnown(
              classes
                .filter((item) => !isToddler(item.gradeLevel))
                .map((item) => item.lunchCount),
            )
          : null),
      toddler:
        count(summary.toddlerPortions) ??
        (classes.every((item) => item.gradeLevel)
          ? sumKnown(
              classes
                .filter((item) => isToddler(item.gradeLevel))
                .map((item) => item.lunchCount),
            )
          : null),
    },
    lastUpdated: label(raw.lastUpdated) || null,
  };
}
