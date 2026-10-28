import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
  ) { }

  async findAll(query: GetFoodsQueryDto) {
    const qb = this.foodRepo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.category', 'cat');

    if (query.search) {
      qb.andWhere('LOWER(f.name) LIKE :search', { search: `%${query.search.toLowerCase()}%` });
    }

    if (query.categoryId) {
      qb.andWhere('f.categoryId = :catId', { catId: query.categoryId });
    } else if (query.category) {
      if (!isNaN(Number(query.category))) {
        qb.andWhere('f.categoryId = :catId', { catId: Number(query.category) });
      } else {
        qb.andWhere('LOWER(cat.name) LIKE :catName', { catName: `%${query.category.toLowerCase()}%` });
      }
    }

    if (query.status) {
      qb.andWhere('f.status = :status', { status: query.status });
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    qb.skip((page - 1) * limit).take(limit);
    qb.orderBy('f.id', 'ASC');

    const [items, total] = await qb.getManyAndCount();

    const mapped = items.map((f) => ({
      ...f,
      id: String(f.id),
      categoryId: f.categoryId ? String(f.categoryId) : null,
      categoryName: f.category?.name || 'Khác',
    }));

    return { items: mapped, total, page, limit };
  }

  async getStats() {
    const total = await this.foodRepo.count();
    const active = await this.foodRepo.count({ where: { status: 'ACTIVE' } });
    const categoriesCount = await this.catRepo.count();

    return {
      totalFoods: total,
      totalIngredients: total,
      activeFoods: active,
      categoryCount: categoriesCount,
      categoriesCount,
      allergenCount: 8,
      updatedThisWeekCount: 3,
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
    try {
      const food = this.foodRepo.create({
        name: dto.name,
        categoryId: dto.categoryId ? Number(dto.categoryId) : null,
        unit: dto.unit || 'g',
        energyKcal100g: dto.energyKcal100g ?? dto.energyKcal ?? 0,
        proteinG: dto.proteinG ?? 0,
        fatG: dto.fatG ?? 0,
        carbG: dto.carbG ?? 0,
        fiberG: dto.fiberG ?? 0,
        calciumMg: dto.calciumMg ?? 0,
        ironMg: dto.ironMg ?? 0,
        zincMg: dto.zincMg ?? 0,
        refuseRatePercent: dto.refuseRatePercent ?? 0,
        status: dto.status || 'ACTIVE',
      });

      const saved = await this.foodRepo.save(food);
      return this.findOne(Number(saved.id));
    } catch (err: any) {
      console.error('Error in FoodsService.create:', err);
      throw new BadRequestException(err?.message || String(err));
    }
  }

  async update(id: number, dto: UpdateFoodDto) {
    const food = await this.foodRepo.findOne({ where: { id } });
    if (!food) {
      throw new NotFoundException(`Không tìm thấy nguyên liệu với ID: ${id}`);
    }

    if (dto.name !== undefined) food.name = dto.name;
    if (dto.categoryId !== undefined) food.categoryId = dto.categoryId;
    if (dto.unit !== undefined) food.unit = dto.unit;
    if (dto.status !== undefined) food.status = dto.status;
    // Quy định: Các chỉ số dinh dưỡng và tỉ lệ thải bỏ sơ chế là dữ liệu chuẩn FCT Viện Dinh Dưỡng, cố định chỉ xem, không được thay đổi khi cập nhật.

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
