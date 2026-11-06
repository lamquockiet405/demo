import { NotFoundException } from '@nestjs/common';
import { FoodsService } from '../../../src/modules/foods/services/foods.service';

/**
 * Unit test: FoodsService (Quản lý nguyên liệu thực phẩm - vai trò Dinh dưỡng)
 * Bao phủ lỗi "Đã xảy ra lỗi khi lưu nguyên liệu" do cột vi chất NOT NULL.
 */
describe('FoodsService (Quản lý nguyên liệu)', () => {
  let foodRepo: any;
  let catRepo: any;
  let service: FoodsService;
  let store: Map<number, any>;

  beforeEach(() => {
    store = new Map();
    let nextId = 500;
    foodRepo = {
      create: jest.fn((dto) => ({ ...dto })),
      save: jest.fn(async (entity) => {
        const id = entity.id ?? nextId++;
        const saved = { ...entity, id };
        store.set(id, saved);
        return saved;
      }),
      findOne: jest.fn(async ({ where: { id } }) => {
        const food = store.get(Number(id));
        return food ? { ...food, category: food.categoryId ? { id: food.categoryId, name: 'Rau củ' } : null } : null;
      }),
      remove: jest.fn(async (entity) => store.delete(entity.id)),
      count: jest.fn(async () => store.size),
    };
    catRepo = {
      find: jest.fn(async () => [
        { id: 2, name: 'Rau củ' },
        { id: 1, name: 'Ngũ cốc' },
      ]),
      count: jest.fn(async () => 2),
    };
    service = new FoodsService(foodRepo, catRepo);
  });

  describe('create()', () => {
    it('mặc định toàn bộ vi chất về 0 thay vì undefined (tránh vi phạm NOT NULL)', async () => {
      await service.create({ name: 'Sữa hộp 180ml', energyKcal100g: 70 } as any);

      const payload = foodRepo.create.mock.calls[0][0];
      for (const key of ['phosphorusMg', 'sodiumMg', 'vitaminAMcg', 'vitaminCMg', 'fiberG', 'calciumMg', 'ironMg', 'zincMg']) {
        expect(payload[key]).toBe(0);
      }
      expect(payload.unit).toBe('g');
      expect(payload.status).toBe('ACTIVE');
      expect(payload.categoryId).toBeNull();
      expect(payload.sourceMetadata).toBeNull();
    });

    it('giữ nguyên giá trị 0 tường minh và giá trị vi chất do người dùng nhập', async () => {
      await service.create({ name: 'Cam sành', vitaminCMg: 45.5, sodiumMg: 0, categoryId: 2 } as any);
      const payload = foodRepo.create.mock.calls[0][0];
      expect(payload.vitaminCMg).toBe(45.5);
      expect(payload.sodiumMg).toBe(0);
      expect(payload.categoryId).toBe(2);
    });

    it('trả về bản ghi đã lưu với id dạng chuỗi và tên nhóm', async () => {
      const res: any = await service.create({ name: 'Cà rốt', categoryId: 2 } as any);
      expect(typeof res.id).toBe('string');
      expect(res.categoryId).toBe('2');
      expect(res.categoryName).toBe('Rau củ');
      expect(res.nutritionComplete).toBe(true);
    });

    it('lưu metadata bổ sung (mô tả, nhà cung cấp, dị ứng) vào sourceMetadata', async () => {
      const meta = { description: 'Rửa sạch trước khi ăn', supplier: 'Vinamilk', allergens: ['MILK'] };
      await service.create({ name: 'Sữa tươi', sourceMetadata: meta } as any);
      expect(foodRepo.create.mock.calls[0][0].sourceMetadata).toEqual(meta);
    });
  });

  describe('update()', () => {
    it('chỉ cập nhật các trường được gửi lên', async () => {
      store.set(1, { id: 1, name: 'Gạo', proteinG: 7, vitaminCMg: 0, status: 'ACTIVE' });
      await service.update(1, { proteinG: 8 } as any);
      const saved = foodRepo.save.mock.calls[0][0];
      expect(saved.proteinG).toBe(8);
      expect(saved.name).toBe('Gạo');
      expect(saved.vitaminCMg).toBe(0);
    });

    it('loại khỏi danh sách missingNutrients các chỉ số vừa được bổ sung', async () => {
      store.set(2, { id: 2, name: 'Bí đỏ', sourceMetadata: { missingNutrients: ['zincMg', 'ironMg'] } });
      const res: any = await service.update(2, { zincMg: 0.3 } as any);
      expect(foodRepo.save.mock.calls[0][0].sourceMetadata.missingNutrients).toEqual(['ironMg']);
      expect(res.ironMg).toBeNull();
      expect(res.nutritionComplete).toBe(false);
    });

    it('ném NotFoundException khi nguyên liệu không tồn tại', async () => {
      await expect(service.update(999, { name: 'X' } as any)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findOne() / remove() / getCategories()', () => {
    it('findOne ném NotFoundException khi không có bản ghi', async () => {
      await expect(service.findOne(404)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('remove xóa bản ghi tồn tại và báo thành công', async () => {
      store.set(3, { id: 3, name: 'Hành lá' });
      await expect(service.remove(3)).resolves.toEqual({ success: true, message: 'Đã xóa nguyên liệu' });
      expect(store.has(3)).toBe(false);
    });

    it('remove ném NotFoundException khi không tồn tại', async () => {
      await expect(service.remove(77)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('getCategories trả id dạng chuỗi', async () => {
      const cats = await service.getCategories();
      expect(cats).toEqual([
        { id: '2', name: 'Rau củ' },
        { id: '1', name: 'Ngũ cốc' },
      ]);
    });
  });
});

