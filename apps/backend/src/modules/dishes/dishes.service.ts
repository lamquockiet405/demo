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
    const typeFilter = query.dishType || query.categoryCode;

    const applyFilters = (builder: any) => {
      if (query.search) {
        builder.andWhere(
          '(LOWER(unaccent(d.name)) LIKE LOWER(unaccent(:search)) OR LOWER(unaccent(COALESCE(d.description, \'\'))) LIKE LOWER(unaccent(:search)))',
          {
            search: `%${query.search.trim()}%`,
          },
        );
      }

      if (query.categoryId) {
        builder.andWhere('d.categoryId = :catId', { catId: query.categoryId });
      }

      if (typeFilter) {
        const typeMap: Record<string, string[]> = {
          MAIN_COURSE: ['MAIN'],
          SOUP: ['SOUP'],
          SIDE_VEGETABLE: ['SIDE'],
          RICE_STAPLE: ['RICE'],
          PORRIDGE_NOODLE: ['RICE', 'SNACK_MORNING'],
          DESSERT: ['DESSERT'],
          SNACK_AFTERNOON: ['SNACK_AFTERNOON', 'SNACK_MORNING'],
          DRINK: ['DRINK'],
        };
        const codes = typeMap[typeFilter] || [typeFilter];
        builder.andWhere('cat.code IN (:...catCodes)', { catCodes: codes });
      }

      if (query.allergenFilter === 'WARNING') {
        builder.andWhere('EXISTS (SELECT 1 FROM dish_allergens da_sub WHERE da_sub.dish_id = d.id)');
      } else if (query.allergenFilter === 'SAFE') {
        builder.andWhere('NOT EXISTS (SELECT 1 FROM dish_allergens da_sub WHERE da_sub.dish_id = d.id)');
      }

      if (query.isActive !== undefined && query.isActive !== '') {
        const active = query.isActive === true || query.isActive === 'true';
        builder.andWhere('d.status = :status', { status: active ? 'ACTIVE' : 'INACTIVE' });
      } else if (query.status) {
        builder.andWhere('d.status = :status', { status: query.status });
      }
    };

    const qb = this.dishRepo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.category', 'cat')
      .leftJoinAndSelect('d.nutrition', 'nutr')
      .leftJoinAndSelect('d.recipes', 'rec')
      .leftJoinAndSelect('rec.ingredient', 'ing')
      .leftJoinAndSelect('d.dishAllergens', 'da')
      .leftJoinAndSelect('da.allergen', 'allg');

    applyFilters(qb);

    const page = query.page || 1;
    const limit = query.limit || 50;
    qb.skip((page - 1) * limit).take(limit);
    qb.orderBy('d.id', 'ASC');

    const [items, total] = await qb.getManyAndCount();

    const mapped = items.map((d) => {
      const nutr = d.nutrition || {
        energyKcal: 0,
        proteinG: 0,
        fatG: 0,
        carbG: 0,
        fiberG: 0,
        calciumMg: 0,
        ironMg: 0,
        zincMg: 0,
      };

      const energyKcal = Number(nutr.energyKcal) || 0;
      const proteinG = Number(nutr.proteinG) || 0;
      const fatG = Number(nutr.fatG) || 0;
      const carbG = Number(nutr.carbG) || 0;
      const fiberG = Number(nutr.fiberG) || 0;
      const calciumMg = Number(nutr.calciumMg) || 0;
      const ironMg = Number(nutr.ironMg) || 0;
      const zincMg = Number(nutr.zincMg) || 0;

      return {
        id: String(d.id),
        code: `MA${String(d.id).padStart(4, '0')}`,
        name: d.name,
        description: d.description,
        categoryId: d.categoryId ? String(d.categoryId) : null,
        categoryName: d.category?.name || 'Khác',
        categoryCode: d.category?.code || 'MAIN',
        dishType: d.category?.code || 'MAIN_COURSE',
        targetAgeGroup: 'KINDERGARTEN_3_5Y',
        standardServingSizeG: Number(d.standardServingSizeG) || 100,
        status: d.status,
        isActive: d.status === 'ACTIVE',
        totalCalories: energyKcal,
        totalProteinG: proteinG,
        totalFatG: fatG,
        totalCarbG: carbG,
        totalFiberG: fiberG,
        totalCalciumMg: calciumMg,
        totalIronMg: ironMg,
        totalZincMg: zincMg,
        nutrition: {
          energyKcal,
          proteinG,
          fatG,
          carbG,
          fiberG,
          calciumMg,
          ironMg,
          zincMg,
        },
        recipeCount: (d.recipes || []).length,
        recipeItems: (d.recipes || []).map((r) => ({
          id: String(r.id),
          foodId: String(r.ingredientId),
          ingredientId: String(r.ingredientId),
          ingredientName: r.ingredient?.name || 'Nguyên liệu',
          unit: r.ingredient?.unit || 'g',
          netWeightPerPortionG: Number(r.netWeightG) || 0,
          grossWeightPerPortionG: Number(r.grossWeightG) || Number(r.netWeightG) || 0,
          note: r.note || null,
          food: r.ingredient
            ? {
                id: String(r.ingredient.id),
                name: r.ingredient.name,
                unit: r.ingredient.unit,
                energyKcal: Number(r.ingredient.energyKcal100g) || 0,
                proteinG: Number(r.ingredient.proteinG) || 0,
                fatG: Number(r.ingredient.fatG) || 0,
                carbG: Number(r.ingredient.carbG) || 0,
                fiberG: Number(r.ingredient.fiberG) || 0,
                calciumMg: Number(r.ingredient.calciumMg) || 0,
                ironMg: Number(r.ingredient.ironMg) || 0,
                zincMg: Number(r.ingredient.zincMg) || 0,
              }
            : undefined,
        })),
        allergens: (d.dishAllergens || []).map((da) => ({
          id: String(da.allergenId),
          code: da.allergen?.code || '',
          name: da.allergen?.name || '',
          riskLevel: da.riskLevel,
          note: da.note || null,
        })),
      };
    });

    // Thống kê cố định toàn kho thực đơn (giữ nguyên cố định, không thay đổi theo tìm kiếm / lọc)
    const [totalDishes, allergenDishesCount, mainDishes, sideDishes] = await Promise.all([
      this.dishRepo.count(),
      this.dishRepo
        .createQueryBuilder('d')
        .andWhere('EXISTS (SELECT 1 FROM dish_allergens da_sub WHERE da_sub.dish_id = d.id)')
        .getCount(),
      this.dishRepo
        .createQueryBuilder('d')
        .leftJoin('d.category', 'cat')
        .where("cat.code = 'MAIN'")
        .getCount(),
      this.dishRepo
        .createQueryBuilder('d')
        .leftJoin('d.category', 'cat')
        .where("cat.code IN ('SNACK_MORNING', 'SNACK_AFTERNOON', 'DRINK')")
        .getCount(),
    ]);

    const stats = {
      totalDishes,
      mainDishes,
      sideDishes,
      allergenDishesCount,
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

    const nutr = dish.nutrition || {
      energyKcal: 0,
      proteinG: 0,
      fatG: 0,
      carbG: 0,
      fiberG: 0,
      calciumMg: 0,
      ironMg: 0,
      zincMg: 0,
    };

    const energyKcal = Number(nutr.energyKcal) || 0;
    const proteinG = Number(nutr.proteinG) || 0;
    const fatG = Number(nutr.fatG) || 0;
    const carbG = Number(nutr.carbG) || 0;
    const fiberG = Number(nutr.fiberG) || 0;
    const calciumMg = Number(nutr.calciumMg) || 0;
    const ironMg = Number(nutr.ironMg) || 0;
    const zincMg = Number(nutr.zincMg) || 0;

    const recipesMapped = (dish.recipes || []).map((r) => ({
      id: String(r.id),
      ingredientId: String(r.ingredientId),
      foodId: String(r.ingredientId),
      ingredientName: r.ingredient?.name || 'Nguyên liệu',
      unit: r.ingredient?.unit || 'g',
      grossWeightG: Number(r.grossWeightG) || 0,
      netWeightG: Number(r.netWeightG) || 0,
      netWeightPerPortionG: Number(r.netWeightG) || 0,
      grossWeightPerPortionG: Number(r.grossWeightG) || 0,
      note: r.note,
      food: r.ingredient
        ? {
            id: String(r.ingredient.id),
            name: r.ingredient.name,
            unit: r.ingredient.unit,
            energyKcal: Number(r.ingredient.energyKcal100g) || 0,
            proteinG: Number(r.ingredient.proteinG) || 0,
            fatG: Number(r.ingredient.fatG) || 0,
            carbG: Number(r.ingredient.carbG) || 0,
            fiberG: Number(r.ingredient.fiberG) || 0,
            calciumMg: Number(r.ingredient.calciumMg) || 0,
            ironMg: Number(r.ingredient.ironMg) || 0,
            zincMg: Number(r.ingredient.zincMg) || 0,
          }
        : undefined,
    }));

    return {
      id: String(dish.id),
      code: `MA${String(dish.id).padStart(4, '0')}`,
      name: dish.name,
      description: dish.description,
      categoryId: dish.categoryId ? String(dish.categoryId) : null,
      categoryName: dish.category?.name || null,
      categoryCode: dish.category?.code || null,
      dishType: dish.category?.code || 'MAIN_COURSE',
      targetAgeGroup: 'KINDERGARTEN_3_5Y',
      standardServingSizeG: Number(dish.standardServingSizeG) || 100,
      status: dish.status,
      isActive: dish.status === 'ACTIVE',
      totalCalories: energyKcal,
      totalProteinG: proteinG,
      totalFatG: fatG,
      totalCarbG: carbG,
      totalFiberG: fiberG,
      totalCalciumMg: calciumMg,
      totalIronMg: ironMg,
      totalZincMg: zincMg,
      allergens: (dish.dishAllergens || []).map((da) => ({
        id: String(da.allergenId),
        code: da.allergen?.code || '',
        name: da.allergen?.name || '',
        riskLevel: da.riskLevel,
        note: da.note || null,
      })),
      nutrition: {
        energyKcal,
        proteinG,
        fatG,
        carbG,
        fiberG,
        calciumMg,
        ironMg,
        zincMg,
      },
      recipes: recipesMapped,
      recipeItems: recipesMapped,
    };
  }

  async create(dto: CreateDishDto) {
    let categoryId = dto.categoryId || null;
    if (!categoryId && dto.dishType) {
      const cat = await this.catRepo.findOne({ where: { code: dto.dishType } });
      if (cat) categoryId = cat.id;
    }

    const dish = this.dishRepo.create({
      name: dto.name,
      categoryId,
      description: dto.description || dto.presentationNotes || null,
      standardServingSizeG: dto.standardServingSizeG || 100,
      status: dto.status || (dto.isActive === false ? 'INACTIVE' : 'ACTIVE'),
    });

    const savedDish = await this.dishRepo.save(dish);

    const rawRecipes =
      dto.recipes ||
      (dto.recipeItems
        ? dto.recipeItems.map((ri: any) => ({
            ingredientId: Number(ri.foodId || ri.ingredientId),
            grossWeightG: Number(
              ri.grossWeightPerPortionG || ri.grossWeightG || ri.netWeightPerPortionG || ri.netWeightG || 0,
            ),
            netWeightG: Number(ri.netWeightPerPortionG || ri.netWeightG || 0),
            note: ri.note || null,
          }))
        : []);

    if (rawRecipes.length > 0) {
      const items = rawRecipes.map((r) =>
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

    await this.recalculateDishNutrition(savedDish.id);
    return this.findOne(savedDish.id);
  }

  async update(id: number, dto: UpdateDishDto) {
    const dish = await this.dishRepo.findOne({ where: { id } });
    if (!dish) {
      throw new NotFoundException(`Không tìm thấy món ăn với ID: ${id}`);
    }

    if (dto.name !== undefined) dish.name = dto.name;
    if (dto.categoryId !== undefined) dish.categoryId = dto.categoryId;
    if (!dto.categoryId && dto.dishType) {
      const cat = await this.catRepo.findOne({ where: { code: dto.dishType } });
      if (cat) dish.categoryId = cat.id;
    }
    if (dto.description !== undefined) dish.description = dto.description;
    if (dto.presentationNotes !== undefined && !dto.description) dish.description = dto.presentationNotes;
    if (dto.standardServingSizeG !== undefined) dish.standardServingSizeG = dto.standardServingSizeG;
    if (dto.status !== undefined) dish.status = dto.status;
    if (dto.isActive !== undefined) dish.status = dto.isActive ? 'ACTIVE' : 'INACTIVE';

    await this.dishRepo.save(dish);

    const hasNewRecipes = dto.recipes !== undefined || dto.recipeItems !== undefined;
    if (hasNewRecipes) {
      await this.recipeRepo.delete({ dishId: id });
      const rawRecipes =
        dto.recipes ||
        (dto.recipeItems
          ? dto.recipeItems.map((ri: any) => ({
              ingredientId: Number(ri.foodId || ri.ingredientId),
              grossWeightG: Number(
                ri.grossWeightPerPortionG || ri.grossWeightG || ri.netWeightPerPortionG || ri.netWeightG || 0,
              ),
              netWeightG: Number(ri.netWeightPerPortionG || ri.netWeightG || 0),
              note: ri.note || null,
            }))
          : []);

      if (rawRecipes.length > 0) {
        const items = rawRecipes.map((r) =>
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
      await this.recalculateDishNutrition(id);
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

    await this.nutritionRepo.save(nutrition);
  }
}
