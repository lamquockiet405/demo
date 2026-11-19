import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Menu } from '../../menus/entities/menu.entity';
import { DailyPurchasingQueryDto } from '../dto/daily-purchasing-query.dto';

@Injectable()
export class PurchasingService {
  constructor(
    @InjectRepository(Menu)
    private readonly menuRepo: Repository<Menu>,
  ) {}

  /**
   * Lấy danh sách các ngày thực đơn đã phê duyệt kèm thống kê
   */
  async getAvailableMenuDays() {
    const days = await this.menuRepo.manager.query(`
      SELECT 
        md.id as menu_day_id,
        md.day_of_week,
        md.date,
        m.id as menu_id,
        m.title as menu_title,
        m.status as menu_status,
        count(DISTINCT mm.id)::int as meals_count,
        count(DISTINCT mdi.dish_id)::int as dishes_count
      FROM menu_days md
      JOIN menu_versions mv ON mv.id = md.menu_version_id
      JOIN menus m ON m.id = mv.menu_id
      LEFT JOIN menu_meals mm ON mm.menu_day_id = md.id
      LEFT JOIN menu_dishes mdi ON mdi.menu_meal_id = mm.id
      WHERE m.status = 'APPROVED'
      GROUP BY md.id, md.day_of_week, md.date, m.id, m.title, m.status
      ORDER BY m.id DESC, md.day_of_week ASC
    `);

    return days.map((d: any) => ({
      menuDayId: Number(d.menu_day_id),
      menuId: Number(d.menu_id),
      menuTitle: d.menu_title,
      date: d.date ? new Date(d.date).toISOString().split('T')[0] : null,
      dayOfWeek: Number(d.day_of_week),
      dayOfWeekLabel: `Thứ ${Number(d.day_of_week) === 1 ? 'Chủ Nhật' : d.day_of_week}`,
      mealsCount: Number(d.meals_count) || 0,
      dishesCount: Number(d.dishes_count) || 0,
    }));
  }

  /**
   * Tính toán khối lượng mua hàng thô (Gross Weight Purchasing Suggestion)
   * dựa trên tổng số học sinh các lớp và tỉ lệ thải bỏ thực phẩm.
   */
  async getDailyPurchasingSuggestion(query: DailyPurchasingQueryDto) {
    // 1. Lấy sĩ số thực tế từ các lớp đang hoạt động
    const classesRes = await this.menuRepo.manager.query(`
      SELECT 
        c.id, 
        c.name, 
        c.age_group, 
        count(s.id)::int as student_count 
      FROM classes c 
      LEFT JOIN students s ON s.class_id = c.id AND s.status = 'ACTIVE' 
      WHERE c.status = 'ACTIVE' 
      GROUP BY c.id, c.name, c.age_group 
      ORDER BY c.id
    `);

    const totalStudents = classesRes.reduce(
      (sum: number, r: any) => sum + (parseInt(r.student_count, 10) || 0),
      0,
    );

    // Suất ăn tính toán: ưu tiên số tùy chỉnh (nếu có), mặc định lấy tổng số học sinh các lớp
    const portionsCount =
      query.customPortions && Number(query.customPortions) > 0
        ? Number(query.customPortions)
        : totalStudents;

    // 2. Xác định ngày và thực đơn phù hợp
    const targetDateStr = query.date || new Date().toISOString().split('T')[0];
    let selectedDay: any = null;

    if (query.menuId) {
      const menuDays = await this.menuRepo.manager.query(`
        SELECT md.id, md.day_of_week, md.date, m.id as menu_id, m.title, m.status 
        FROM menu_days md
        JOIN menu_versions mv ON mv.id = md.menu_version_id
        JOIN menus m ON m.id = mv.menu_id
        WHERE m.id = $1
        ORDER BY md.day_of_week ASC
      `, [query.menuId]);

      if (menuDays.length > 0) {
        selectedDay = menuDays[0];
      }
    }

    if (!selectedDay) {
      // Tìm ngày khớp chính xác trong các thực đơn đã duyệt
      const exactMatch = await this.menuRepo.manager.query(`
        SELECT md.id, md.day_of_week, md.date, m.id as menu_id, m.title, m.status 
        FROM menu_days md
        JOIN menu_versions mv ON mv.id = md.menu_version_id
        JOIN menus m ON m.id = mv.menu_id
        WHERE md.date::date = $1::date AND m.status = 'APPROVED'
        ORDER BY m.id DESC LIMIT 1
      `, [targetDateStr]);

      if (exactMatch.length > 0) {
        selectedDay = exactMatch[0];
      }
    }

    if (!selectedDay) {
      // Ánh xạ thứ trong tuần (2: Thứ Hai, ..., 6: Thứ Sáu) của ngày yêu cầu vào thực đơn duyệt gần nhất
      const targetDate = new Date(targetDateStr);
      const dayOfWeekJs = targetDate.getDay(); // 0 = Sun, 1 = Mon ...
      const dayOfWeekSystem = dayOfWeekJs === 0 ? 2 : (dayOfWeekJs === 6 ? 6 : dayOfWeekJs + 1);

      const dowMatch = await this.menuRepo.manager.query(`
        SELECT md.id, md.day_of_week, md.date, m.id as menu_id, m.title, m.status 
        FROM menu_days md
        JOIN menu_versions mv ON mv.id = md.menu_version_id
        JOIN menus m ON m.id = mv.menu_id
        WHERE md.day_of_week = $1 AND m.status = 'APPROVED'
        ORDER BY m.id DESC LIMIT 1
      `, [dayOfWeekSystem]);

      if (dowMatch.length > 0) {
        selectedDay = dowMatch[0];
      } else {
        const anyDay = await this.menuRepo.manager.query(`
          SELECT md.id, md.day_of_week, md.date, m.id as menu_id, m.title, m.status 
          FROM menu_days md
          JOIN menu_versions mv ON mv.id = md.menu_version_id
          JOIN menus m ON m.id = mv.menu_id
          WHERE m.status = 'APPROVED'
          ORDER BY m.id DESC, md.day_of_week ASC LIMIT 1
        `);
        if (anyDay.length > 0) {
          selectedDay = anyDay[0];
        }
      }
    }

    if (!selectedDay) {
      throw new NotFoundException('Không tìm thấy thực đơn nào đã duyệt trong hệ thống để tính toán đi chợ.');
    }

    // 3. Truy vấn các nguyên liệu và định lượng cho ngày đã chọn
    let mealFilterSql = '';
    const queryParams: any[] = [selectedDay.id];
    if (query.mealType && query.mealType !== 'ALL') {
      queryParams.push(query.mealType);
      mealFilterSql = 'AND mm.meal_type = $2';
    }

    const recipeRows = await this.menuRepo.manager.query(`
      SELECT 
        md.id as menu_day_id,
        md.date,
        md.day_of_week,
        m.id as menu_id,
        m.title as menu_title,
        mm.id as meal_id,
        mm.meal_type,
        d.id as dish_id,
        d.name as dish_name,
        fi.id as ingredient_id,
        fi.name as ingredient_name,
        COALESCE(fc.name, 'Gia vị & Khác') as category_name,
        COALESCE(fi.unit, 'g') as unit,
        COALESCE(fi.refuse_rate_percent, 0)::float as refuse_rate_percent,
        COALESCE(dr.net_weight_g, 0)::float as net_weight_g,
        COALESCE(dr.gross_weight_g, 0)::float as gross_weight_g
      FROM menu_days md
      JOIN menu_versions mv ON mv.id = md.menu_version_id
      JOIN menus m ON m.id = mv.menu_id
      JOIN menu_meals mm ON mm.menu_day_id = md.id
      JOIN menu_dishes mdi ON mdi.menu_meal_id = mm.id
      JOIN dishes d ON d.id = mdi.dish_id
      JOIN dish_recipes dr ON dr.dish_id = d.id
      JOIN food_ingredients fi ON fi.id = dr.ingredient_id
      LEFT JOIN food_categories fc ON fc.id = fi.category_id
      WHERE md.id = $1
      ${mealFilterSql}
      ORDER BY fc.name, fi.name
    `, queryParams);

    // 4. Tổng hợp định lượng theo từng nguyên liệu
    const ingMap = new Map<number, any>();
    const dishesSet = new Set<string>();

    for (const row of recipeRows) {
      const key = Number(row.ingredient_id);
      const netG = parseFloat(row.net_weight_g) || 0;
      const refuseRate = parseFloat(row.refuse_rate_percent) || 0;
      let grossG = parseFloat(row.gross_weight_g) || 0;

      // Công thức: Gross = Net / (1 - RefuseRate / 100)
      if (grossG <= 0 && netG > 0) {
        grossG = refuseRate > 0 && refuseRate < 100 ? netG / (1 - refuseRate / 100) : netG;
      }

      dishesSet.add(row.dish_name);

      if (!ingMap.has(key)) {
        ingMap.set(key, {
          id: String(key),
          name: row.ingredient_name,
          category: row.category_name,
          unit: row.unit,
          refuseRatePercent: refuseRate,
          netWeightPerPortionG: 0,
          grossWeightPerPortionG: 0,
          dishes: new Set<string>(),
        });
      }

      const item = ingMap.get(key);
      item.netWeightPerPortionG += netG;
      item.grossWeightPerPortionG += grossG;
      item.dishes.add(row.dish_name);
    }

    const ingredients = Array.from(ingMap.values()).map((i) => {
      const totalGrossG = i.grossWeightPerPortionG * portionsCount;
      const totalNetG = i.netWeightPerPortionG * portionsCount;
      const totalGrossKg = totalGrossG / 1000;
      const totalNetKg = totalNetG / 1000;
      const refuseLossKg = Math.max(0, totalGrossKg - totalNetKg);

      return {
        id: i.id,
        name: i.name,
        category: i.category,
        unit: i.unit,
        refuseRatePercent: i.refuseRatePercent,
        netPerPortionG: Math.round(i.netWeightPerPortionG * 100) / 100,
        grossPerPortionG: Math.round(i.grossWeightPerPortionG * 100) / 100,
        totalNetKg: Math.round(totalNetKg * 1000) / 1000,
        totalGrossKg: Math.round(totalGrossKg * 1000) / 1000,
        refuseLossKg: Math.round(refuseLossKg * 1000) / 1000,
        dishesUsed: Array.from(i.dishes),
      };
    });

    // Sắp xếp theo khối lượng thô cần mua giảm dần
    ingredients.sort((a, b) => b.totalGrossKg - a.totalGrossKg);

    const totalGrossKg = ingredients.reduce((sum, item) => sum + item.totalGrossKg, 0);
    const totalNetKg = ingredients.reduce((sum, item) => sum + item.totalNetKg, 0);
    const totalRefuseLossKg = ingredients.reduce((sum, item) => sum + item.refuseLossKg, 0);
    const categories = Array.from(new Set(ingredients.map((i) => i.category)));

    return {
      date: targetDateStr,
      dayOfWeek: Number(selectedDay.day_of_week),
      dayOfWeekLabel: `Thứ ${Number(selectedDay.day_of_week) === 1 ? 'Chủ Nhật' : selectedDay.day_of_week}`,
      menuId: Number(selectedDay.menu_id),
      menuTitle: selectedDay.title,
      menuStatus: selectedDay.status,
      mealFilter: query.mealType || 'ALL',
      totalStudents,
      portionsCount,
      isCustomPortions: portionsCount !== totalStudents,
      classesBreakdown: classesRes.map((c: any) => ({
        classId: String(c.id),
        className: c.name,
        ageGroup: c.age_group,
        studentCount: parseInt(c.student_count, 10) || 0,
      })),
      dishesInDay: Array.from(dishesSet),
      summary: {
        totalIngredients: ingredients.length,
        totalGrossKg: Math.round(totalGrossKg * 100) / 100,
        totalNetKg: Math.round(totalNetKg * 100) / 100,
        totalRefuseLossKg: Math.round(totalRefuseLossKg * 100) / 100,
        categoriesCount: categories.length,
      },
      ingredients,
      categories,
    };
  }
}

