import { normalizeSearch } from '../../../common/utils/search';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AllergenCatalog } from "../entities/allergen-catalog.entity";
import { CreateAllergenDto } from "../dto/create-allergen.dto";
import { UpdateAllergenDto } from "../dto/update-allergen.dto";

@Injectable()
export class AllergenRulesService {
  private serialize(a: any) {
    const inactive = (a.description || "").startsWith("[INACTIVE]");
    const description = (a.description || "").replace(/^\[INACTIVE\]\s*/, "");
    return {
      id: String(a.id),
      code: a.code,
      name: a.name,
      nameVi: a.name,
      nameEn: a.code,
      commonFoods: description,
      description,
      isActive: !inactive,
      isDeleted: inactive,
      isSystemStandard: [
        "SEAFOOD",
        "MILK",
        "EGG",
        "SOY",
        "PEANUT",
        "WHEAT",
        "TREE_NUT",
        "SESAME",
      ].includes(a.code),
      createdAt: null,
      updatedAt: null,
      deletedAt: null,
    };
  }
  async restore(id: number) {
    await this.update(id, { isActive: true });
    return { success: true, message: "Đã khôi phục dị nguyên." };
  }

  constructor(
    @InjectRepository(AllergenCatalog)
    private readonly allergenRepo: Repository<AllergenCatalog>,
  ) {}

  async findAll(
    query: { search?: string; includeDeleted?: boolean | string } = {},
  ) {
    const rows = await this.allergenRepo.find({ order: { name: "ASC" } });
    return rows
      .map((a) => this.serialize(a))
      .filter(
        (a) =>
          (query.includeDeleted === true ||
            query.includeDeleted === "true" ||
            !a.isDeleted) &&
          (!query.search ||
            normalizeSearch((a.name + " " + a.code + " " + a.description))
              .includes(normalizeSearch(query.search))),
      );
  }

  async findOne(id: number) {
    const row = await this.allergenRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException("Không tìm thấy dị nguyên.");
    return this.serialize(row);
  }

  async create(dto: CreateAllergenDto) {
    const code = dto.code?.trim().toUpperCase(),
      name = (dto.name || dto.nameVi || "").trim();
    if (!code || !name)
      throw new BadRequestException("Nhập mã và tên dị nguyên.");
    if (await this.allergenRepo.findOne({ where: { code } }))
      throw new ConflictException("Mã dị nguyên đã tồn tại.");
    return this.serialize(
      await this.allergenRepo.save(
        this.allergenRepo.create({
          code,
          name,
          description: dto.description || dto.commonFoods || "",
        }),
      ),
    );
  }

  async update(id: number, dto: UpdateAllergenDto) {
    const row = await this.allergenRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException("Không tìm thấy dị nguyên.");
    if (dto.name || dto.nameVi) row.name = (dto.name || dto.nameVi).trim();
    if (dto.code) row.code = dto.code.toUpperCase();
    if (dto.description !== undefined || dto.commonFoods !== undefined)
      row.description = dto.description ?? dto.commonFoods;
    if (dto.isActive !== undefined) {
      const clean = (row.description || "").replace(/^\[INACTIVE\]\s*/, "");
      row.description = dto.isActive ? clean : "[INACTIVE] " + clean;
    }
    return this.serialize(await this.allergenRepo.save(row));
  }

  async remove(id: number) {
    await this.update(id, { isActive: false });
    return { success: true, message: "Đã ngừng áp dụng dị nguyên." };
  }
}
