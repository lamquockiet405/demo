import { normalizeSearch, searchSql, searchLikeSql } from '../../../common/utils/search';
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SerializedWrite } from '../../../common/utils/serialized-write';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Food } from '../entities/food.entity';
import { FoodCategory } from '../entities/food-category.entity';
import { CreateFoodDto } from '../dto/create-food.dto';
import { UpdateFoodDto } from '../dto/update-food.dto';
import { GetFoodsQueryDto } from '../dto/get-foods-query.dto';
import { matchesDeclaredAllergy } from '../../menus/services/allergy-matching';

@Injectable()
export class FoodsService {
  private canEdit(food: Food, actor?: { sub?: number | string; id?: number | string; tenantId?: number | string }) {
    const metadata = food.sourceMetadata;
    const userId = actor?.sub ?? actor?.id;
    return !!userId && metadata?.kind === 'USER_CREATED' &&
      String(metadata.createdBy) === String(userId) &&
      String(metadata.schoolId) === String(actor?.tenantId || 1);
  }

  private assertEditable(food: Food, actor?: any) {
    if (!this.canEdit(food, actor)) throw new ForbiddenException('Chỉ được chỉnh sửa nguyên liệu do chính bạn thêm. Nguyên liệu có sẵn chỉ được xem.');
  }

  private serializeFood(food: Food) {
    const missing = food.sourceMetadata?.missingNutrients || [];
    return {
      ...food,
      ...Object.fromEntries(missing.map((key: string) => [key, null])),
      nutritionComplete: missing.length === 0,
      referenceValues: food.sourceMetadata?.kind === 'LEGACY_UNVERIFIED' ? {
        energyKcal100g: food.energyKcal100g, proteinG: food.proteinG, fatG: food.fatG, carbG: food.carbG,
        fiberG: food.fiberG, calciumMg: food.calciumMg, ironMg: food.ironMg, zincMg: food.zincMg,
      } : null,
    };
  }

  constructor(
    @InjectRepository(Food)
    private readonly foodRepo: Repository<Food>,
    @InjectRepository(FoodCategory)
    private readonly catRepo: Repository<FoodCategory>,
  ) { }

  private async getActiveStudentAllergies(): Promise<Array<{ name: string; code: string; catalogId: number | null; description?: string | null }>> {
    try {
      if (typeof this.foodRepo?.manager?.query !== 'function') return [];
      const rows = await this.foodRepo.manager.query(`
        SELECT DISTINCT
          COALESCE(sa.allergen_id, a.id) AS "catalogId",
          COALESCE(NULLIF(btrim(sa.custom_allergen_name), ''), a.name) AS name,
          COALESCE(a.code, 'CUSTOM') AS code,
          COALESCE(
            a.description,
            (
              SELECT string_agg(cat.description, ', ')
              FROM allergens cat
              WHERE position(lower(cat.name) in lower(COALESCE(sa.custom_allergen_name, ''))) > 0
            )
          ) AS description
        FROM student_allergies sa
        JOIN students s ON sa.student_id = s.id
        JOIN student_academic_enrollments e ON e.student_id=s.id AND e.status='ENROLLED'
        JOIN academic_year y ON y.id=e.academic_year_id AND y.status='ACTIVE'
        LEFT JOIN allergens a
          ON sa.allergen_id = a.id
          OR (sa.allergen_id IS NULL AND LOWER(btrim(sa.custom_allergen_name)) = LOWER(a.name))
        WHERE sa.is_active = TRUE AND s.status = 'ACTIVE'
      `);
      return Array.isArray(rows) ? rows.filter((r) => r.name) : [];
    } catch {
      return [];
    }
  }

  private detectFoodAllergens(
    f: Food,
    declarations: Array<{ name: string; code: string; catalogId: number | null; description?: string | null }> = [],
  ): Array<{ id: string; name: string }> {
    const detectedAllergens: Array<{ id: string; name: string }> = [];
    const addUnique = (id: string, name: string) => {
      if (!name) return;
      const norm = name.trim().toLowerCase();
      if (!detectedAllergens.some((item) => item.name.trim().toLowerCase() === norm || item.id === id)) {
        detectedAllergens.push({ id, name: name.trim() });
      }
    };

    const metaAllergens = Array.isArray(f.sourceMetadata?.allergens) ? f.sourceMetadata.allergens : [];
    for (const metaAlg of metaAllergens) {
      const algName = typeof metaAlg === 'string' ? metaAlg : metaAlg?.name;
      if (algName) addUnique(`META_${algName.toUpperCase()}`, algName);
    }

    for (const decl of declarations) {
      if (matchesDeclaredAllergy(decl, { name: f.name || '', ingredients: [f.name || ''] })) {
        addUnique(
          decl.code && decl.code !== 'CUSTOM' ? decl.code : `DECLARED_${decl.name.toUpperCase()}`,
          decl.name,
        );
      }
    }

    return detectedAllergens;
  }

  async findAll(query: GetFoodsQueryDto, actor?: any) {
    const qb = this.foodRepo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.category', 'cat');

    // 1. Tìm kiếm theo tên hoặc mã nguyên liệu (NL-x hoặc x)
    if (query.search && query.search.trim()) {
      const raw = query.search.trim();
      const term = `%${normalizeSearch(raw)}%`;
      const idMatch = raw.replace(/^nl-?/i, '');
      const numId = Number(idMatch);
      if (!isNaN(numId) && numId > 0) {
        qb.andWhere(`(${searchSql("f.name")} LIKE :term OR f.id = :numId)`, { term, numId });
      } else {
        qb.andWhere(`${searchSql("f.name")} LIKE :term`, { term });
      }
    }

    // 2. Lọc theo nhóm nguyên liệu (hỗ trợ categoryId hoặc category)
    const targetCatId =
      query.categoryId ||
      (query.category && !isNaN(Number(query.category)) ? Number(query.category) : undefined);

    if (targetCatId) {
      qb.andWhere('f.categoryId = :catId', { catId: targetCatId });
    } else if (query.category && typeof query.category === 'string' && query.category.trim()) {
      qb.andWhere(`(${searchSql("cat.name")} LIKE ${searchLikeSql(":catName")})`, {
        catName: `%${normalizeSearch(query.category).trim()}%`,
      });
    }

    // 3. Lọc theo tiêu chí dinh dưỡng
    if (query.nutrition === 'HIGH_PROTEIN') {
      qb.andWhere('f.proteinG >= 15');
    } else if (query.nutrition === 'HIGH_CARB') {
      qb.andWhere('f.carbG >= 40');
    } else if (query.nutrition === 'HIGH_CALORIES') {
      qb.andWhere('f.energyKcal100g >= 250');
    }

    if (query.status) {
      qb.andWhere('f.status = :status', { status: query.status });
    }

    const declarations = await this.getActiveStudentAllergies();

    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, query.limit || 50);

    // 4. Lọc theo trạng thái dị ứng (SAFE / WARNING) dựa trên cả danh mục chuẩn + khai báo của phụ huynh
    if (query.allergen === 'WARNING' || query.allergen === 'SAFE') {
      qb.orderBy('f.id', 'ASC');
      const allMatching = await qb.getMany();
      const filtered = allMatching.filter((f) => {
        const hasAlg = this.detectFoodAllergens(f, declarations).length > 0;
        return query.allergen === 'WARNING' ? hasAlg : !hasAlg;
      });
      const total = filtered.length;
      const paged = filtered.slice((page - 1) * limit, page * limit);
      const mapped = paged.map((f) => ({
        ...this.serializeFood(f),
        canEdit: this.canEdit(f, actor),
        id: String(f.id),
        code: `NL-${f.id}`,
        categoryId: f.categoryId ? String(f.categoryId) : null,
        categoryName: f.category?.name || 'Khác',
        energyKcal: this.serializeFood(f).energyKcal100g,
        allergens: this.detectFoodAllergens(f, declarations),
      }));
      return { items: mapped, total, page, limit };
    }

    qb.skip((page - 1) * limit).take(limit);
    qb.orderBy('f.id', 'ASC');

    const [items, total] = await qb.getManyAndCount();

    const mapped = items.map((f) => ({
      ...this.serializeFood(f),
      canEdit: this.canEdit(f, actor),
      id: String(f.id),
      code: `NL-${f.id}`,
      categoryId: f.categoryId ? String(f.categoryId) : null,
      categoryName: f.category?.name || 'Khác',
      energyKcal: this.serializeFood(f).energyKcal100g,
      allergens: this.detectFoodAllergens(f, declarations),
    }));

    return { items: mapped, total, page, limit };
  }

  async getStats() {
    const allFoods = await this.foodRepo.find();
    const declarations = await this.getActiveStudentAllergies();
    const total = allFoods.length;
    const active = allFoods.filter((f) => f.status === 'ACTIVE').length;
    const categoriesCount = await this.catRepo.count();
    const allergenCount = allFoods.filter((f) => this.detectFoodAllergens(f, declarations).length > 0).length;

    return {
      totalFoods: total,
      totalIngredients: total,
      activeFoods: active,
      categoryCount: categoriesCount,
      categoriesCount,
      allergenCount,
      updatedThisWeekCount: total,
    };
  }

  async getCategories() {
    const cats = await this.catRepo.find({ order: { id: 'ASC' } });
    return cats.map((c) => ({
      id: String(c.id),
      name: c.name,
    }));
  }

  async findOne(id: number, actor?: any) {
    const food = await this.foodRepo.findOne({
      where: { id },
      relations: ['category'],
    });

    if (!food) {
      throw new NotFoundException(`Không tìm thấy nguyên liệu với ID: ${id}`);
    }

    const declarations = await this.getActiveStudentAllergies();

    return {
      ...this.serializeFood(food),
      canEdit: this.canEdit(food, actor),
      id: String(food.id),
      categoryId: food.categoryId ? String(food.categoryId) : null,
      categoryName: food.category?.name || null,
      allergens: this.detectFoodAllergens(food, declarations),
    };
  }

  @SerializedWrite('food-catalog', 'foodRepo')
  async create(dto: CreateFoodDto, actor?: any) {
    const userId = actor?.sub ?? actor?.id;
    if (!userId) throw new ForbiddenException('Thiếu thông tin người tạo nguyên liệu.');
    const duplicate = await this.foodRepo.createQueryBuilder('f')
      .where('LOWER(TRIM(f.name)) = LOWER(:name)', { name: dto.name.trim() })
      .andWhere("COALESCE(f.source_metadata->>'schoolId', '1') = :school", { school: String(actor.tenantId || 1) })
      .getOne();
    if (duplicate) throw new ConflictException('Tên nguyên liệu đã tồn tại. Vui lòng cập nhật nguyên liệu hiện có.');
    const food = this.foodRepo.create({
      name: dto.name.trim(),
      categoryId: dto.categoryId || null,
      unit: dto.unit || 'g',
      energyKcal100g: dto.energyKcal100g || 0,
      proteinG: dto.proteinG || 0,
      fatG: dto.fatG || 0,
      carbG: dto.carbG || 0,
      fiberG: dto.fiberG || 0,
      calciumMg: dto.calciumMg || 0,
      ironMg: dto.ironMg || 0,
      zincMg: dto.zincMg || 0,
      phosphorusMg: dto.phosphorusMg ?? 0,
      sodiumMg: dto.sodiumMg ?? 0,
      vitaminAMcg: dto.vitaminAMcg ?? 0,
      vitaminCMg: dto.vitaminCMg ?? 0,
      refuseRatePercent: dto.refuseRatePercent || 0,
      status: dto.status || 'ACTIVE',
      sourceMetadata: { ...dto.sourceMetadata, kind: 'USER_CREATED', createdBy: String(userId), schoolId: String(actor.tenantId || 1) },
    });

    const saved = await this.foodRepo.save(food);
    return this.findOne(saved.id, actor);
  }

  async update(id: number, dto: UpdateFoodDto, actor?: any) {
    const food = await this.foodRepo.findOne({ where: { id } });
    if (!food) {
      throw new NotFoundException(`Không tìm thấy nguyên liệu với ID: ${id}`);
    }

    this.assertEditable(food, actor);
    const ownership = { kind: food.sourceMetadata.kind, createdBy: food.sourceMetadata.createdBy, schoolId: food.sourceMetadata.schoolId };
    if (dto.name !== undefined) food.name = dto.name;
    if (dto.categoryId !== undefined) food.categoryId = dto.categoryId;
    if (dto.unit !== undefined) food.unit = dto.unit;
    if (dto.energyKcal100g !== undefined) food.energyKcal100g = dto.energyKcal100g;
    if (dto.proteinG !== undefined) food.proteinG = dto.proteinG;
    if (dto.fatG !== undefined) food.fatG = dto.fatG;
    if (dto.carbG !== undefined) food.carbG = dto.carbG;
    if (dto.fiberG !== undefined) food.fiberG = dto.fiberG;
    if (dto.calciumMg !== undefined) food.calciumMg = dto.calciumMg;
    if (dto.ironMg !== undefined) food.ironMg = dto.ironMg;
    if (dto.zincMg !== undefined) food.zincMg = dto.zincMg;
    if (dto.phosphorusMg !== undefined) food.phosphorusMg = dto.phosphorusMg;
    if (dto.sodiumMg !== undefined) food.sodiumMg = dto.sodiumMg;
    if (dto.vitaminAMcg !== undefined) food.vitaminAMcg = dto.vitaminAMcg;
    if (dto.vitaminCMg !== undefined) food.vitaminCMg = dto.vitaminCMg;
    if (dto.refuseRatePercent !== undefined) food.refuseRatePercent = dto.refuseRatePercent;
    if (dto.status !== undefined) food.status = dto.status;
    if (dto.sourceMetadata !== undefined) food.sourceMetadata = { ...food.sourceMetadata, ...dto.sourceMetadata, ...ownership };

    if (food.sourceMetadata?.missingNutrients) {
      food.sourceMetadata = {
        ...food.sourceMetadata,
        missingNutrients: food.sourceMetadata.missingNutrients.filter((key: string) => dto[key] === undefined),
      };
    }

    await this.foodRepo.save(food);
    return this.findOne(id, actor);
  }

  async remove(id: number, actor?: any) {
    const food = await this.foodRepo.findOne({ where: { id } });
    if (!food) {
      throw new NotFoundException(`Không tìm thấy nguyên liệu với ID: ${id}`);
    }
    this.assertEditable(food, actor);
    await this.foodRepo.remove(food);
    return { success: true, message: 'Đã xóa nguyên liệu' };
  }
}
