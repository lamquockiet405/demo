import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AllergenCatalog } from '../entities/allergen-catalog.entity';
import { CreateAllergenDto } from '../dto/create-allergen.dto';
import { UpdateAllergenDto } from '../dto/update-allergen.dto';

const CODEX_CODES = new Set(['SEAFOOD', 'PEANUT', 'MILK', 'EGG', 'WHEAT', 'SOY', 'TREE_NUT', 'SESAME']);

@Injectable()
export class AllergenRulesService {
  constructor(
    @InjectRepository(AllergenCatalog)
    private readonly allergenRepo: Repository<AllergenCatalog>,
  ) {}

  private toDto(item: AllergenCatalog) {
    const desc = item.description || '';
    const isDeleted = desc.startsWith('[INACTIVE]');
    const cleanDesc = desc.replace(/^\[INACTIVE\]\s*/, '');
    return {
      ...item,
      id: String(item.id),
      tenantId: null,
      name: item.name,
      nameVi: item.name,
      nameEn: null,
      commonFoods: cleanDesc,
      description: cleanDesc,
      isActive: !isDeleted,
      isDeleted,
      isSystemStandard: CODEX_CODES.has(item.code),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: isDeleted ? new Date().toISOString() : null,
    };
  }

  async findAll(query?: any) {
    const items = await this.allergenRepo.find({ order: { id: 'ASC' } });
    const search = query?.search?.trim().toLowerCase();
    const includeDeleted = query?.includeDeleted === 'true' || query?.includeDeleted === true;

    return items
      .map((i) => this.toDto(i))
      .filter((a) => {
        if (!includeDeleted && a.isDeleted) return false;
        if (search && !a.code.toLowerCase().includes(search) && !a.nameVi.toLowerCase().includes(search) && !(a.description || '').toLowerCase().includes(search)) {
          return false;
        }
        return true;
      });
  }

  async findOne(id: number) {
    const allergen = await this.allergenRepo.findOne({ where: { id } });
    if (!allergen) throw new NotFoundException('Không tìm thấy chất dị ứng.');
    return this.toDto(allergen);
  }

  async create(dto: CreateAllergenDto) {
    const code = (dto.code || 'CUSTOM').trim().toUpperCase();
    const existing = await this.allergenRepo.findOne({ where: { code } });
    if (existing) throw new ConflictException(`Mã chất dị ứng "${code}" đã tồn tại trong danh mục.`);

    const entity = this.allergenRepo.create({
      code,
      name: (dto.name || dto.nameVi || 'Chất dị ứng mới').trim(),
      description: (dto.description || dto.commonFoods || '').trim(),
    });
    return this.toDto(await this.allergenRepo.save(entity));
  }

  async update(id: number, dto: UpdateAllergenDto) {
    const allergen = await this.allergenRepo.findOne({ where: { id } });
    if (!allergen) throw new NotFoundException('Không tìm thấy chất dị ứng.');

    if (dto.code) allergen.code = dto.code.trim().toUpperCase();
    if (dto.name || dto.nameVi) allergen.name = (dto.name || dto.nameVi)!.trim();
    if (dto.description !== undefined || dto.commonFoods !== undefined) {
      const baseDesc = (dto.description ?? dto.commonFoods ?? '').trim();
      allergen.description = dto.isActive === false ? `[INACTIVE] ${baseDesc}` : baseDesc;
    } else if (dto.isActive !== undefined) {
      const clean = (allergen.description || '').replace(/^\[INACTIVE\]\s*/, '');
      allergen.description = dto.isActive ? clean : `[INACTIVE] ${clean}`;
    }

    return this.toDto(await this.allergenRepo.save(allergen));
  }

  async toggleStatus(id: number, isActive?: boolean) {
    const allergen = await this.allergenRepo.findOne({ where: { id } });
    if (!allergen) throw new NotFoundException('Không tìm thấy chất dị ứng.');
    const currentlyActive = !(allergen.description || '').startsWith('[INACTIVE]');
    const nextActive = isActive !== undefined ? isActive : !currentlyActive;
    const clean = (allergen.description || '').replace(/^\[INACTIVE\]\s*/, '');
    allergen.description = nextActive ? clean : `[INACTIVE] ${clean}`;
    await this.allergenRepo.save(allergen);
    return { success: true, message: nextActive ? 'Đã kích hoạt chất dị ứng' : 'Đã tạm ngưng chất dị ứng', isActive: nextActive };
  }

  async remove(id: number) {
    await this.toggleStatus(id, false);
    return { success: true, message: 'Đã chuyển chất dị ứng vào danh sách lưu trữ (xóa mềm)' };
  }

  async restore(id: number) {
    await this.toggleStatus(id, true);
    return { success: true, message: 'Đã khôi phục chất dị ứng' };
  }
}
