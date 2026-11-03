import { advisorySeverity, matchesDeclaredAllergy } from '../../../src/modules/menus/services/allergy-matching';
import { MenusService } from '../../../src/modules/menus/services/menus.service';

describe('Declared allergy matching', () => {
  it.each(['Thịt bò xào khóm', 'Bò hầm rau củ', 'Cháo thịt bò'])('matches custom beef against %s', name => {
    expect(matchesDeclaredAllergy({ name: '  THỊT BÒ ', code: 'CUSTOM' }, { name })).toBe(true);
  });
  it('finds an ingredient even when the dish name does not mention it', () => {
    expect(matchesDeclaredAllergy({ name: 'thịt bò' }, { name: 'Súp rau củ', ingredients: ['Thịt bò nạc', 'Cà rốt'] })).toBe(true);
    expect(matchesDeclaredAllergy({ name: 'Kiwi' }, { name: 'Trái cây', ingredients: ['Kiwi xanh'] })).toBe(true);
  });
  it('uses explicit catalog tags', () => {
    expect(matchesDeclaredAllergy({ name: 'Trứng', catalogId: 4 }, { name: 'Bánh đặc biệt', allergenIds: [4] })).toBe(true);
  });
  it('preserves Vietnamese distinctions and whole words', () => {
    expect(matchesDeclaredAllergy({ name: 'Cá' }, { name: 'Cà chua xào' })).toBe(false);
    expect(matchesDeclaredAllergy({ name: 'Mè' }, { name: 'Canh me' })).toBe(false);
    expect(matchesDeclaredAllergy({ name: '' }, { name: 'Món ăn' })).toBe(false);
  });
  it('does not treat cow milk as beef, but still detects actual beef with milk', () => {
    expect(matchesDeclaredAllergy({ name: 'thịt bò' }, { name: 'Sữa bò', ingredients: ['Sữa bò tươi'] })).toBe(false);
    expect(matchesDeclaredAllergy({ name: 'thịt bò' }, { name: 'Bò nấu sữa bò' })).toBe(true);
    expect(matchesDeclaredAllergy({ name: 'Sữa bò' }, { name: 'Sữa chua' })).toBe(true);
  });
  it.each([
    ['LOW', 'MILD'], ['MEDIUM', 'MODERATE'], ['HIGH', 'SEVERE'],
    ['MILD', 'MILD'], ['MODERATE', 'MODERATE'], ['SEVERE', 'SEVERE'], ['ANAPHYLACTIC', 'ANAPHYLACTIC'],
  ])('preserves severity %s as %s', (input, expected) => expect(advisorySeverity(input)).toBe(expected));
});

describe('Menu allergy advisory', () => {
  it('includes active custom declarations, recipe ingredients and stored guidance', async () => {
    const query = jest.fn().mockResolvedValueOnce([{
      student_id: 1, full_name: 'Trẻ kiểm thử', allergen_id: null, allergen_name: 'thịt bò',
      allergen_code: 'CUSTOM', severity: 'SEVERE', reaction_treatment: 'Hướng dẫn đã khai báo',
    }]).mockResolvedValueOnce([]);
    const dishes = { find: jest.fn().mockResolvedValue([{ id: 3, recipes: [{ ingredient: { name: 'Thịt bò nạc' } }], dishAllergens: [] }]) };
    const service = new MenusService({ findOne: async () => ({ title: 'Tuần thử' }) } as any, {} as any, {} as any,
      {} as any, { manager: { query } } as any, {} as any, dishes as any, {} as any, {} as any);
    jest.spyOn(service, 'findOne').mockResolvedValue({ menuDishes: [
      { id: '8', dishId: '3', dish: { name: 'Súp rau củ', dishType: 'SOUP' }, dayOfWeek: 2, mealTime: 'LUNCH' },
    ] } as any);
    const result = await service.getAdvisory(1);
    expect(query.mock.calls[0][0]).toContain('LEFT JOIN allergens');
    expect(query.mock.calls[0][0]).toContain('sa.is_active = TRUE');
    expect(dishes.find).toHaveBeenCalledWith(expect.objectContaining({ relations: expect.arrayContaining(['recipes.ingredient', 'dishAllergens']) }));
    expect(result.allergySummary).toMatchObject({ totalConflicts: 1, criticalCount: 1, warningCount: 0 });
    expect(result.allergyConflicts[0]).toMatchObject({
      childId: '1', menuDishId: '8', allergenDetected: 'thịt bò', severity: 'SEVERE', reactionTreatment: 'Hướng dẫn đã khai báo',
    });
  });
});
