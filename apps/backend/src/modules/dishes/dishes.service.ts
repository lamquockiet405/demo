import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dish } from './entities/dish.entity';
import { DishCategory } from './entities/dish-category.entity';
import { RecipeItem } from './entities/recipe-item.entity';
import { DishNutrition } from './entities/dish-nutrition.entity';
import { Food } from '../foods/entities/food.entity';
import { CreateDishDto } from './dto/create-dish.dto';
import { UpdateDishDto } from './dto/update-dish.dto';
import { GetDishesQueryDto } from './dto/get-dishes-query.dto';
import { hasReferenceNutrition, hasVerifiedNutrition } from './nutrition.util';

@Injectable()
export class DishesService {
  constructor(
    @InjectRepository(Dish)
    private readonly dishRepo: Repository<Dish>,
    @InjectRepository(DishCategory)
    private readonly catRepo: Repository<DishCategory>,
    @InjectRepository(RecipeItem)
    private readonly recipeRepo: Repository<RecipeItem>,
    @InjectRepository(DishNutrition)
    private readonly nutritionRepo: Repository<DishNutrition>,
    @InjectRepository(Food)
    private readonly foodRepo: Repository<Food>,
  ) {}

  async findAll(query: GetDishesQueryDto) {
    const qb = this.dishRepo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.category', 'cat')
      .leftJoinAndSelect('d.nutrition', 'nutr')
      .leftJoinAndSelect('d.recipes', 'rec')
      .leftJoinAndSelect('rec.ingredient', 'ing')
      .leftJoinAndSelect('d.dishAllergens', 'da')
      .leftJoinAndSelect('da.allergen', 'allg');

    if (query.search) {
      qb.andWhere('LOWER(d.name) LIKE :search', { search: `%${query.search.toLowerCase()}%` });
    }

    if (query.categoryId) {
      qb.andWhere('d.categoryId = :catId', { catId: query.categoryId });
    }

    if (query.dishType) {
      qb.andWhere('cat.code = :dishType', { dishType: query.dishType });
    }
    if (query.isActive !== undefined && !query.status) {
      qb.andWhere('d.status = :activeStatus', { activeStatus: query.isActive === 'true' ? 'ACTIVE' : 'INACTIVE' });
    }

    if (query.status) {
      qb.andWhere('d.status = :status', { status: query.status });
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    qb.skip((page - 1) * limit).take(limit);
    qb.orderBy('d.id', 'ASC');

    const [items, total] = await qb.getManyAndCount();

    const mapped = items.map((d) => ({
      id: String(d.id),
      name: d.name,
      description: d.description,
      categoryId: d.categoryId ? String(d.categoryId) : null,
      categoryName: d.category?.name || 'Khác',
      categoryCode: d.category?.code || 'MAIN',
      standardServingSizeG: d.standardServingSizeG || 100,
      status: d.status,
      isActive: d.status === 'ACTIVE',
      sourceMetadata: d.sourceMetadata,
      nutritionAvailable: hasVerifiedNutrition(d),
      nutritionStatus: hasVerifiedNutrition(d) ? 'VERIFIED' : hasReferenceNutrition(d) ? 'REFERENCE' : 'MISSING',
      referenceNutrition: hasReferenceNutrition(d) ? d.nutrition : null,
      nutrition: hasVerifiedNutrition(d)
        ? {
            energyKcal: d.nutrition.energyKcal,
            proteinG: d.nutrition.proteinG,
            fatG: d.nutrition.fatG,
            carbG: d.nutrition.carbG,
            fiberG: d.nutrition.fiberG,
            calciumMg: d.nutrition.calciumMg,
            ironMg: d.nutrition.ironMg,
            zincMg: d.nutrition.zincMg,
          }
        : {
            energyKcal: 0,
            proteinG: 0,
            fatG: 0,
            carbG: 0,
            fiberG: 0,
            calciumMg: 0,
            ironMg: 0,
            zincMg: 0,
          },
      recipeCount: (d.recipes || []).length,
      allergens: (d.dishAllergens || []).map((da) => ({
        id: String(da.allergenId),
        code: da.allergen?.code || '',
        name: da.allergen?.name || '',
        riskLevel: da.riskLevel,
        note: da.note || null,
      })),
    }));

    const allergenDishesCountResult = await this.dishRepo
      .createQueryBuilder('d')
      .innerJoin('d.dishAllergens', 'da')
      .select('COUNT(DISTINCT d.id)', 'count')
      .getRawOne();

    const mainDishes = await this.dishRepo.count({
      where: { category: { code: 'MAIN' } },
    });
    const sideDishes = await this.dishRepo.count({
      where: [{ category: { code: 'SNACK_MORNING' } }, { category: { code: 'SNACK_AFTERNOON' } }],
    });

    const stats = {
      totalDishes: total,
      mainDishes,
      sideDishes,
      allergenDishesCount: parseInt(allergenDishesCountResult?.count || '0', 10),
    };

    return { items: mapped, total, page, limit, stats };
  }

  async getCategories() {
    const categories = await this.catRepo.find({ order: { displayOrder: 'ASC' } });
    return categories.map((c) => ({
      id: String(c.id),
      code: c.code,
      name: c.name,
      displayOrder: c.displayOrder,
      isRequiredInMeal: c.isRequiredInMeal,
    }));
  }

  async findOne(id: number) {
    const dish = await this.dishRepo.findOne({
      where: { id },
      relations: [
        'category',
        'nutrition',
        'recipes',
        'recipes.ingredient',
        'dishAllergens',
        'dishAllergens.allergen',
      ],
    });

    if (!dish) {
      throw new NotFoundException(`Không tìm thấy món ăn với ID: ${id}`);
    }

    return {
      id: String(dish.id),
      name: dish.name,
      description: dish.description,
      categoryId: dish.categoryId ? String(dish.categoryId) : null,
      categoryName: dish.category?.name || null,
      categoryCode: dish.category?.code || null,
      standardServingSizeG: dish.standardServingSizeG,
      status: dish.status,
      isActive: dish.status === 'ACTIVE',
      sourceMetadata: dish.sourceMetadata,
      nutritionAvailable: hasVerifiedNutrition(dish),
      nutritionStatus: hasVerifiedNutrition(dish) ? 'VERIFIED' : hasReferenceNutrition(dish) ? 'REFERENCE' : 'MISSING',
      referenceNutrition: hasReferenceNutrition(dish) ? dish.nutrition : null,
      allergens: (dish.dishAllergens || []).map((da) => ({
        id: String(da.allergenId),
        code: da.allergen?.code || '',
        name: da.allergen?.name || '',
        riskLevel: da.riskLevel,
        note: da.note || null,
      })),
      nutrition: (hasVerifiedNutrition(dish) ? dish.nutrition : null) || {
        energyKcal: 0,
        proteinG: 0,
        fatG: 0,
        carbG: 0,
        fiberG: 0,
        calciumMg: 0,
        ironMg: 0,
        zincMg: 0,
      },
      recipes: (dish.recipes || []).map((r) => ({
        id: String(r.id),
        ingredientId: String(r.ingredientId),
        ingredientName: r.ingredient?.name || 'Nguyên liệu',
        unit: r.ingredient?.unit || 'g',
        grossWeightG: r.grossWeightG,
        netWeightG: r.netWeightG,
        note: r.note,
        sourceMetadata: r.sourceMetadata,
      })),
    };
  }

  async create(dto: CreateDishDto) {
    const dish = this.dishRepo.create({
      name: dto.name,
      categoryId: dto.categoryId || null,
      description: dto.description || null,
      standardServingSizeG: dto.standardServingSizeG || 100,
      status: dto.status || 'ACTIVE',
      nutritionVerified: Boolean(dto.recipes?.length),
    });

    const savedDish = await this.dishRepo.save(dish);

    if (dto.recipes && dto.recipes.length > 0) {
      const items = dto.recipes.map((r) =>
        this.recipeRepo.create({
          dishId: savedDish.id,
          ingredientId: r.ingredientId,
          grossWeightG: r.grossWeightG || r.netWeightG,
          netWeightG: r.netWeightG,
          note: r.note || null,
        }),
      );
      await this.recipeRepo.save(items);
    }

    savedDish.nutritionVerified = await this.recalculateDishNutrition(savedDish.id);
    await this.dishRepo.save(savedDish);
    return this.findOne(savedDish.id);
  }

  async update(id: number, dto: UpdateDishDto) {
    const dish = await this.dishRepo.findOne({ where: { id } });
    if (!dish) {
      throw new NotFoundException(`Không tìm thấy món ăn với ID: ${id}`);
    }

    if (dto.name !== undefined) dish.name = dto.name;
    if (dto.categoryId !== undefined) dish.categoryId = dto.categoryId;
    if (dto.description !== undefined) dish.description = dto.description;
    if (dto.standardServingSizeG !== undefined) dish.standardServingSizeG = dto.standardServingSizeG;
    if (dto.status !== undefined) dish.status = dto.status;
    if (dto.isActive !== undefined) dish.status = dto.isActive ? 'ACTIVE' : 'INACTIVE';

    await this.dishRepo.save(dish);

    if (dto.recipes !== undefined) {
      await this.recipeRepo.delete({ dishId: id });
      if (dto.recipes.length > 0) {
        const items = dto.recipes.map((r) =>
          this.recipeRepo.create({
            dishId: id,
            ingredientId: r.ingredientId,
            grossWeightG: r.grossWeightG || r.netWeightG,
            netWeightG: r.netWeightG,
            note: r.note || null,
          }),
        );
        await this.recipeRepo.save(items);
      }
      dish.nutritionVerified = await this.recalculateDishNutrition(id);
      if (dish.sourceMetadata) {
        dish.sourceMetadata = { ...dish.sourceMetadata,
          recipeStatus: dish.nutritionVerified ? 'VERIFIED_MANUAL' : 'INCOMPLETE_RECIPE',
          servingSizeStatus: 'MANUAL' };
      }
      await this.dishRepo.save(dish);
    }

    return this.findOne(id);
  }

  async remove(id: number) {
    const dish = await this.dishRepo.findOne({ where: { id } });
    if (!dish) {
      throw new NotFoundException(`Không tìm thấy món ăn với ID: ${id}`);
    }
    await this.dishRepo.remove(dish);
    return { success: true, message: 'Đã xóa món ăn' };
  }

  async recalculateDishNutrition(dishId: number) {
    const recipes = await this.recipeRepo.find({
      where: { dishId },
      relations: ['ingredient'],
    });

    let energyKcal = 0;
    let proteinG = 0;
    let fatG = 0;
    let carbG = 0;
    let fiberG = 0;
    let calciumMg = 0;
    let ironMg = 0;
    let zincMg = 0;

    for (const r of recipes) {
      const ing = r.ingredient;
      if (!ing) continue;
      const factor = (r.netWeightG || 0) / 100;
      energyKcal += (ing.energyKcal100g || 0) * factor;
      proteinG += (ing.proteinG || 0) * factor;
      fatG += (ing.fatG || 0) * factor;
      carbG += (ing.carbG || 0) * factor;
      fiberG += (ing.fiberG || 0) * factor;
      calciumMg += (ing.calciumMg || 0) * factor;
      ironMg += (ing.ironMg || 0) * factor;
      zincMg += (ing.zincMg || 0) * factor;
    }

    const round2 = (val: number) => Math.round(val * 100) / 100;

    let nutrition = await this.nutritionRepo.findOne({ where: { dishId } });
    if (!nutrition) {
      nutrition = this.nutritionRepo.create({ dishId });
    }

    nutrition.energyKcal = round2(energyKcal);
    nutrition.proteinG = round2(proteinG);
    nutrition.fatG = round2(fatG);
    nutrition.carbG = round2(carbG);
    nutrition.fiberG = round2(fiberG);
    nutrition.calciumMg = round2(calciumMg);
    nutrition.ironMg = round2(ironMg);
    nutrition.zincMg = round2(zincMg);

    const requiredNutrients = ['energyKcal100g', 'proteinG', 'fatG', 'carbG', 'fiberG', 'calciumMg', 'ironMg', 'zincMg'];
    const complete = recipes.length > 0 && recipes.every((recipe) => recipe.ingredient &&
      !(recipe.ingredient.sourceMetadata?.missingNutrients || []).some((key: string) => requiredNutrients.includes(key)));
    nutrition.sourceMetadata = { status: complete ? 'COMPUTED_FROM_RECIPE' : 'INCOMPLETE_RECIPE',
      basis: 'ONE_STANDARD_SERVING', calculation: 'SUM(ingredient nutrient per 100g * netWeightG / 100)' };
    await this.nutritionRepo.save(nutrition);
    return complete;
  }
}
