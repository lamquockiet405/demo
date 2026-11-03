import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Food } from '../entities/food.entity';
import { FoodCategory } from '../entities/food-category.entity';
import { CreateFoodDto } from '../dto/create-food.dto';
import { UpdateFoodDto } from '../dto/update-food.dto';
import { GetFoodsQueryDto } from '../dto/get-foods-query.dto';

@Injectable()
export class FoodsService {
  constructor(
    @InjectRepository(Food)
    private readonly foodRepo: Repository<Food>,
    @InjectRepository(FoodCategory)
    private readonly catRepo: Repository<FoodCategory>,
  ) {}

  async findAll(query: GetFoodsQueryDto) {
    const qb = this.foodRepo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.category', 'cat');

    // 1. Tìm kiếm theo tên hoặc mã nguyên liệu (NL-x hoặc x)
    if (query.search && query.search.trim()) {
      const raw = query.search.trim();
      const term = `%${raw.toLowerCase()}%`;
      const idMatch = raw.replace(/^nl-?/i, '');
      const numId = Number(idMatch);
      if (!isNaN(numId) && numId > 0) {
        qb.andWhere('(LOWER(f.name) LIKE :term OR f.id = :numId)', { term, numId });
      } else {
        qb.andWhere('LOWER(f.name) LIKE :term', { term });
      }
    }

    // 2. Lọc theo nhóm nguyên liệu (hỗ trợ categoryId hoặc category)
    const targetCatId =
      query.categoryId ||
      (query.category && !isNaN(Number(query.category)) ? Number(query.category) : undefined);

    if (targetCatId) {
      qb.andWhere('f.categoryId = :catId', { catId: targetCatId });
    } else if (query.category && typeof query.category === 'string' && query.category.trim()) {
      qb.andWhere('(LOWER(cat.name) LIKE :catName)', {
        catName: `%${query.category.toLowerCase().trim()}%`,
      });
    }

    // 3. Lọc theo trạng thái dị ứng (SAFE: an toàn, WARNING: có nguy cơ dị ứng)
    const allergenRegex =
      'tôm|cua|mực|ghẹ|ốc|sò|hàu|tép|sữa|trứng|lạc|đậu phộng|đậu nành|bột mì|lúa mì|hạt điều|hạnh nhân|vừng|([[:space:]]|^)cá([[:space:]]|$)|([[:space:]]|^)mè([[:space:]]|$)';

    if (query.allergen === 'WARNING') {
      qb.andWhere('(f.categoryId IN (3, 8, 9, 10) OR f.name ~* :allergenRegex)', {
        allergenRegex,
      });
    } else if (query.allergen === 'SAFE') {
      qb.andWhere('(f.categoryId NOT IN (3, 8, 9, 10) AND f.name !~* :allergenRegex)', {
        allergenRegex,
      });
    }

    // 4. Lọc theo tiêu chí dinh dưỡng
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

    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, query.limit || 50);
    qb.skip((page - 1) * limit).take(limit);
    qb.orderBy('f.id', 'ASC');

    const [items, total] = await qb.getManyAndCount();

    const mapped = items.map((f) => {
      const detectedAllergens: Array<{ id: string; name: string }> = [];
      const lowerName = (f.name || '').toLowerCase();
      const catId = Number(f.categoryId);

      const isFish = /(^|[\s,./\-])cá([\s,./\-]|$)/i.test(lowerName);
      const isSesame = /(^|[\s,./\-])mè([\s,./\-]|$)/i.test(lowerName);

      if (
        catId === 8 ||
        lowerName.includes('tôm') ||
        lowerName.includes('cua') ||
        isFish ||
        lowerName.includes('mực') ||
        lowerName.includes('ốc') ||
        lowerName.includes('hàu') ||
        lowerName.includes('sò') ||
        lowerName.includes('ghẹ') ||
        lowerName.includes('tép')
      ) {
        detectedAllergens.push({ id: 'SEAFOOD', name: 'Hải sản / Thủy sản' });
      }
      if (catId === 9 || lowerName.includes('trứng')) {
        detectedAllergens.push({ id: 'EGG', name: 'Trứng' });
      }
      if (catId === 10 || lowerName.includes('sữa')) {
        detectedAllergens.push({ id: 'MILK', name: 'Sữa & Chế phẩm' });
      }
      if (
        catId === 3 ||
        lowerName.includes('lạc') ||
        lowerName.includes('đậu phộng') ||
        lowerName.includes('đậu nành') ||
        lowerName.includes('hạt điều') ||
        lowerName.includes('hạnh nhân') ||
        isSesame ||
        lowerName.includes('vừng')
      ) {
        detectedAllergens.push({ id: 'PEANUT_NUTS', name: 'Đậu hạt / Lạc' });
      }
      if (lowerName.includes('bột mì') || lowerName.includes('lúa mì')) {
        detectedAllergens.push({ id: 'GLUTEN', name: 'Gluten / Lúa mì' });
      }

      return {
        ...f,
        id: String(f.id),
        code: `NL-${f.id}`,
        categoryId: f.categoryId ? String(f.categoryId) : null,
        categoryName: f.category?.name || 'Khác',
        energyKcal: Number(f.energyKcal100g || 0),
        allergens: detectedAllergens,
      };
    });

    return { items: mapped, total, page, limit };
  }

  async getStats() {
    const total = await this.foodRepo.count();
    const active = await this.foodRepo.count({ where: { status: 'ACTIVE' } });
    const categoriesCount = await this.catRepo.count();

    const allergenCount = await this.foodRepo
      .createQueryBuilder('f')
      .where('(f.categoryId IN (3, 8, 9, 10) OR f.name ~* :allergenRegex)', {
        allergenRegex:
          'tôm|cua|cá|mực|ghẹ|ốc|sò|hàu|tép|sữa|trứng|lạc|đậu phộng|đậu nành|mè|vừng|bột mì|lúa mì|hạt điều|hạnh nhân',
      })
      .getCount();

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

  async findOne(id: number) {
    const food = await this.foodRepo.findOne({
      where: { id },
      relations: ['category'],
    });

    if (!food) {
      throw new NotFoundException(`Không tìm thấy nguyên liệu với ID: ${id}`);
    }

    return {
      ...food,
      id: String(food.id),
      categoryId: food.categoryId ? String(food.categoryId) : null,
      categoryName: food.category?.name || null,
    };
  }

  async create(dto: CreateFoodDto) {
    const food = this.foodRepo.create({
      name: dto.name,
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
      refuseRatePercent: dto.refuseRatePercent || 0,
      status: dto.status || 'ACTIVE',
    });

    const saved = await this.foodRepo.save(food);
    return this.findOne(saved.id);
  }

  async update(id: number, dto: UpdateFoodDto) {
    const food = await this.foodRepo.findOne({ where: { id } });
    if (!food) {
      throw new NotFoundException(`Không tìm thấy nguyên liệu với ID: ${id}`);
    }

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
    if (dto.refuseRatePercent !== undefined) food.refuseRatePercent = dto.refuseRatePercent;
    if (dto.status !== undefined) food.status = dto.status;

    await this.foodRepo.save(food);
    return this.findOne(id);
  }

  async remove(id: number) {
    const food = await this.foodRepo.findOne({ where: { id } });
    if (!food) {
      throw new NotFoundException(`Không tìm thấy nguyên liệu với ID: ${id}`);
    }
    await this.foodRepo.remove(food);
    return { success: true, message: 'Đã xóa nguyên liệu' };
  }
}
