import {
  Injectable,
  ServiceUnavailableException,
  StreamableFile,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Menu } from "../entities/menu.entity";
import { MenusService } from "./menus.service";

const meals: Record<string, string> = {
  BREAKFAST: "Bữa sáng",
  MORNING_SNACK: "Phụ sáng",
  LUNCH: "Bữa trưa",
  AFTERNOON_SNACK: "Ăn phụ chiều",
};
const csvCell = (value: unknown) => {
  let s = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
};

@Injectable()
export class MenuExportService {
  constructor(
    private readonly menusService: MenusService,
    @InjectRepository(Menu) private readonly menuRepo: Repository<Menu>,
  ) {}
  async exportData(menuId: number, schoolId = 1) {
    const menu = await this.menusService.findOne(menuId);
    const schools = await this.menuRepo.manager.query(
      "SELECT name FROM schools WHERE id=$1",
      [schoolId],
    );
    const codes = [
      ...new Set(menu.days.flatMap((d) => d.meals.map((m) => m.mealType))),
    ];
    const rows = codes.map((code) => {
      const names = (weekday: number) =>
        menu.days
          .filter(
            (d) => new Date(d.date + "T12:00:00Z").getUTCDay() === weekday,
          )
          .flatMap((d) =>
            d.meals
              .filter((m) => m.mealType === code)
              .flatMap((m) => m.dishes.map((dish) => dish.dishName)),
          )
          .join("\n");
      return {
        mealTimeVi: meals[code] || code,
        mealTimeCode: code,
        mondayDishes: names(1),
        tuesdayDishes: names(2),
        wednesdayDishes: names(3),
        thursdayDishes: names(4),
        fridayDishes: names(5),
      };
    });
    return {
      schoolName: schools[0]?.name || "",
      title: menu.title,
      version: String(menu.version),
      targetAgeGroupVi:
        menu.ageGroup === "NHA_TRE"
          ? "Nhà trẻ"
          : menu.ageGroup === "MAU_GIAO"
            ? "Mẫu giáo"
            : menu.ageGroup,
      dateRange: menu.startDate + " – " + menu.endDate,
      cycleWeekNumber: null,
      statusVi:
        (
          {
            DRAFT: "Bản nháp",
            SUBMITTED: "Chờ duyệt",
            APPROVED: "Đã duyệt",
            PUBLISHED: "Đã công bố",
            ACTIVE: "Đang áp dụng",
            ARCHIVED: "Lưu trữ",
            REJECTED: "Từ chối",
          } as Record<string, string>
        )[menu.status] || menu.status,
      dailyAverageCalories: menu.nutritionAvailable
        ? menu.dailyAverageCalories
        : null,
      dailyAverageProteinG: menu.nutritionAvailable
        ? menu.dailyAverageProteinG
        : null,
      dailyAverageFatG: menu.nutritionAvailable ? menu.dailyAverageFatG : null,
      dailyAverageCarbG: menu.nutritionAvailable
        ? menu.dailyAverageCarbG
        : null,
      plgRatio: "Chưa có kết quả xác nhận",
      standardCompliance: "Xem kết quả đánh giá thực đơn",
      rows,
      preparedBy: menu.createdByName || "",
      approvedBy: menu.approvedByName || "",
      approvedDate: menu.approvedAt ? menu.approvedAt.slice(0, 10) : "",
    };
  }
  async exportExcel(menuId: number, schoolId = 1) {
    const data = await this.exportData(menuId, schoolId);
    const rows: unknown[][] = [
      [data.schoolName],
      [data.title, data.version, data.statusVi],
      [data.dateRange, data.targetAgeGroupVi],
      ["Bữa ăn", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu"],
      ...data.rows.map((r) => [
        r.mealTimeVi,
        r.mondayDishes,
        r.tuesdayDishes,
        r.wednesdayDishes,
        r.thursdayDishes,
        r.fridayDishes,
      ]),
      ["Người lập", data.preparedBy],
      ["Người duyệt", data.approvedBy, data.approvedDate],
    ];
    return new StreamableFile(
      Buffer.from(
        "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n"),
        "utf8",
      ),
      {
        type: "text/csv; charset=utf-8",
        disposition: `attachment; filename="thuc-don-${menuId}.csv"`,
      },
    );
  }
  async exportPdf(menuId: number) {
    await this.menusService.findOne(menuId);
    throw new ServiceUnavailableException(
      "Dùng bản xem trước và lệnh In / Lưu PDF của trình duyệt để xuất PDF.",
    );
  }
}
