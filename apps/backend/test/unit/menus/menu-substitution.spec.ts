import { MenusService } from '../../../src/modules/menus/services/menus.service';
import { Menu } from '../../../src/modules/menus/entities/menu.entity';
import { MenuVersion } from '../../../src/modules/menus/entities/menu-version.entity';
import { MenuDish } from '../../../src/modules/menus/entities/menu-dish.entity';
import { Dish } from '../../../src/modules/dishes/entities/dish.entity';

function setup(status = 'ACTIVE') {
  const original: any = { id: 50, dishId: 1201, menuMealId: 30, portionSizeG: 65, menuMeal: { id: 30, menuDay: { menuVersionId: 20 } } };
  const rows: any[] = [original];
  const target: any = { id: 1408, status };
  const menuDishes: any = {
    findOne: jest.fn(async ({ where }) => rows.find(row => Object.entries(where).every(([key, value]) => row[key] === value)) || null),
    create: jest.fn(value => ({ ...value, id: 51 })),
    save: jest.fn(async row => { if (!rows.some(value => value.id === row.id)) rows.push(row); return row; }),
    delete: jest.fn(async ({ id }) => { const index = rows.findIndex(row => row.id === id); rows.splice(index, 1); }),
  };
  const dishes = { findOne: jest.fn().mockResolvedValue(target) };
  const menus = { findOne: jest.fn().mockResolvedValue({ id: 10 }) };
  const versions = { findOne: jest.fn().mockResolvedValue({ id: 20 }) };
  const repositories = new Map<any, any>([[Menu, menus], [MenuVersion, versions], [MenuDish, menuDishes], [Dish, dishes]]);
  const transaction = jest.fn(async callback => callback({ getRepository: entity => repositories.get(entity) }));
  const service = new MenusService({ manager: { transaction } } as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
  const payload = { menuDishId: 50, oldDishId: 1201, newDishId: 1408, keepOriginalDish: false, portionSizeG: 65 };
  return { service, original, rows, menuDishes, dishes, versions, transaction, payload };
}

describe('Menu dish replacement', () => {
  it.each([undefined, 0, -1, 1.5, NaN])('rejects invalid dish ID %s without falling back to dish 1', async newDishId => {
    const { service, transaction } = setup();
    await expect(service.adjustDish(10, { newDishId })).rejects.toThrow('chọn một món ăn hợp lệ');
    expect(transaction).not.toHaveBeenCalled();
  });
  it('rejects a nonexistent target before changing the original or creating a version', async () => {
    const { service, dishes, menuDishes, versions, payload } = setup();
    dishes.findOne.mockResolvedValue(null);
    await expect(service.adjustDish(10, payload)).rejects.toThrow('không còn trong danh mục');
    expect(menuDishes.delete).not.toHaveBeenCalled();
    expect(menuDishes.save).not.toHaveBeenCalled();
    expect(versions.findOne).not.toHaveBeenCalled();
  });
  it('rejects a suspended target', async () => {
    const { service, menuDishes, payload } = setup('INACTIVE');
    await expect(service.adjustDish(10, payload)).rejects.toThrow('tạm ngưng');
    expect(menuDishes.save).not.toHaveBeenCalled();
  });
  it('replaces only the selected slot in a transaction', async () => {
    const { service, rows, menuDishes, transaction, payload } = setup();
    const result = await service.adjustDish(10, payload);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ dishId: '1408', menuDishId: '51' });
    expect(rows.map(row => row.dishId)).toEqual([1408]);
    expect(menuDishes.save.mock.invocationCallOrder[0]).toBeLessThan(menuDishes.delete.mock.invocationCallOrder[0]);
    expect(menuDishes.delete).toHaveBeenCalledWith({ id: 50, menuMealId: 30 });
  });
  it('does not remove the original when saving the replacement fails', async () => {
    const { service, rows, menuDishes, payload } = setup();
    menuDishes.save.mockRejectedValue(new Error('write failed'));
    await expect(service.adjustDish(10, payload)).rejects.toThrow('write failed');
    expect(menuDishes.delete).not.toHaveBeenCalled();
    expect(rows.map(row => row.dishId)).toEqual([1201]);
  });
  it('keeps the original for a separate portion', async () => {
    const { service, rows, payload } = setup();
    await service.adjustDish(10, { ...payload, keepOriginalDish: true, specialDietNotes: 'Suất riêng' });
    expect(rows.map(row => row.dishId)).toEqual([1201, 1408]);
  });
  it('rejects a slot from another menu/version and a changed original', async () => {
    const { service, original, menuDishes, payload } = setup();
    original.menuMeal.menuDay.menuVersionId = 99;
    await expect(service.adjustDish(10, payload)).rejects.toThrow('phiên bản thực đơn hiện tại');
    original.menuMeal.menuDay.menuVersionId = 20;
    original.dishId = 99;
    await expect(service.adjustDish(10, payload)).rejects.toThrow('đã được thay đổi');
    expect(menuDishes.save).not.toHaveBeenCalled();
  });
  it('allows clearing old special-diet notes when replacing for everyone', async () => {
    const { service, rows, payload } = setup();
    rows.push({ id: 51, dishId: 1408, menuMealId: 30, specialDietNotes: 'Old note' });
    await service.adjustDish(10, { ...payload, specialDietNotes: null });
    expect(rows.find(row => row.id === 51).specialDietNotes).toBeNull();
  });
});

describe('Current substitute catalog', () => {
  const makeDish = (id: number, name: string, ingredients: string[] = []) => ({
    id, name, status: 'ACTIVE', category: { code: 'MAIN' }, nutritionVerified: true, standardServingSizeG: 100,
    nutrition: { energyKcal: 200, proteinG: 10, fatG: 4, carbG: 20 },
    recipes: ingredients.map(name => ({ ingredient: { name } })), dishAllergens: [],
  });
  it('uses real IDs and excludes all declared restrictions of affected children, including hidden ingredients', async () => {
    const catalog = [makeDish(1201, 'Thịt bò xào khóm', ['Thịt bò']), makeDish(1408, 'Gà hầm', ['Thịt gà']),
      makeDish(1503, 'Gà trứng', ['Thịt gà', 'Trứng']), makeDish(1600, 'Súp rau củ', ['Thịt bò']),
      makeDish(1601, 'Gà sữa', ['Sữa']), { ...makeDish(1602, 'Gà chưa xác nhận', ['Thịt gà']), nutritionVerified: false },
      makeDish(1603, 'Thiếu công thức'), { ...makeDish(1604, 'Gà tạm ngưng', ['Gà']), status: 'INACTIVE' }];
    const query = jest.fn().mockResolvedValue([
      { student_id: 1, allergen_name: 'thịt bò', allergen_code: 'CUSTOM' },
      { student_id: 1, allergen_name: 'Trứng', allergen_code: 'EGG' },
      { student_id: 2, allergen_name: 'Sữa', allergen_code: 'MILK' },
    ]);
    const service = new MenusService({} as any, {} as any, {} as any, {} as any, { manager: { query } } as any, {} as any,
      { find: async () => catalog } as any, {} as any, {} as any);
    jest.spyOn(service, 'findOne').mockResolvedValue({ menuDishes: [{ id: '50', dishId: '1201' }] } as any);
    const result = await service.getSubstituteCandidates(10, 50);
    expect(result.map(dish => dish.id)).toEqual(['1408', '1601']);
    expect(result[0]).toMatchObject({ name: 'Gà hầm', totalCalories: 200, totalProteinG: 10, dishType: 'MAIN', standardServingSizeG: 100, isActive: true });
    await expect(service.getSubstituteCandidates(10, 999)).rejects.toThrow('Món gốc không còn');
  });
});
