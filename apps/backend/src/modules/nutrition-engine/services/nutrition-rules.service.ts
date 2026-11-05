import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NutritionalStandard } from "../entities/nutrition-rule.entity";
import { CreateNutritionRuleDto } from "../dto/create-nutrition-rule.dto";
import { UpdateNutritionRuleDto } from "../dto/update-nutrition-rule.dto";

@Injectable()
export class NutritionRulesService {
  private serializeRule(r: any) {
    const name =
      r.ruleName ||
      (r.ageGroup === "NHA_TRE" ? "Nhà trẻ" : "Mẫu giáo") + " · " + r.mealScope;
    return {
      id: String(r.id),
      ruleName: name,
      name,
      targetAgeGroup: r.ageGroup,
      ageGroup: r.ageGroup,
      mealScope: r.mealScope,
      minCaloriesKcal: r.minEnergyKcal,
      maxCaloriesKcal: r.maxEnergyKcal,
      minEnergyKcal: r.minEnergyKcal,
      maxEnergyKcal: r.maxEnergyKcal,
      minProteinPercent: r.minProteinPct,
      maxProteinPercent: r.maxProteinPct,
      minFatPercent: r.minFatPct,
      maxFatPercent: r.maxFatPct,
      minCarbPercent: r.minCarbPct,
      maxCarbPercent: r.maxCarbPct,
      minCalciumMg: r.minCalciumMg,
      minIronMg: r.minIronMg,
      minZincMg: r.minZincMg,
      maxSodiumMg: r.maxSodiumMg,
      isActive: r.status === "ACTIVE",
      isDeleted: r.status === "INACTIVE",
      status: r.status,
      createdAt: null,
      updatedAt: null,
      deletedAt: null,
    };
  }
  private applyInput(dto: any, current: any = {}) {
    const pairs = [
      ["minEnergyKcal", "minCaloriesKcal"],
      ["maxEnergyKcal", "maxCaloriesKcal"],
      ["minProteinPct", "minProteinPercent"],
      ["maxProteinPct", "maxProteinPercent"],
      ["minFatPct", "minFatPercent"],
      ["maxFatPct", "maxFatPercent"],
      ["minCarbPct", "minCarbPercent"],
      ["maxCarbPct", "maxCarbPercent"],
    ];
    const next = { ...current };
    for (const [key, alias] of pairs) {
      const value = dto[key] ?? dto[alias] ?? current[key];
      if (value == null || value === "")
        throw new BadRequestException(
          "Nhập đầy đủ chỉ tiêu năng lượng và tỷ lệ đạm, béo, bột đường.",
        );
      if (!Number.isFinite(Number(value)) || Number(value) < 0)
        throw new BadRequestException("Chỉ tiêu phải là số không âm.");
      next[key] = Number(value);
    }
    for (const key of ["EnergyKcal", "ProteinPct", "FatPct", "CarbPct"])
      if (next["min" + key] > next["max" + key])
        throw new BadRequestException(
          "Chỉ tiêu tối thiểu không được lớn hơn tối đa.",
        );
    next.ageGroup = dto.ageGroup || dto.targetAgeGroup || current.ageGroup;
    if (next.ageGroup?.includes("TODDLER")) next.ageGroup = "NHA_TRE";
    if (next.ageGroup?.includes("KINDERGARTEN")) next.ageGroup = "MAU_GIAO";
    next.mealScope = dto.mealScope || current.mealScope;
    if (!next.ageGroup || !next.mealScope)
      throw new BadRequestException("Chọn nhóm tuổi và phạm vi bữa ăn.");
    next.ruleName = dto.name ?? current.ruleName ?? null;
    for (const key of ["minCalciumMg", "minIronMg", "minZincMg", "maxSodiumMg"])
      next[key] = dto[key] ?? current[key] ?? 0;
    next.status =
      dto.status ??
      (dto.isActive === undefined
        ? current.status || "ACTIVE"
        : dto.isActive
          ? "ACTIVE"
          : "INACTIVE");
    return next;
  }

  constructor(
    @InjectRepository(NutritionalStandard)
    private readonly ruleRepo: Repository<NutritionalStandard>,
  ) {}

  async findAll(
    query: {
      search?: string;
      includeDeleted?: boolean | string;
      targetAgeGroup?: string;
    } = {},
  ) {
    const rows = await this.ruleRepo.find({
      order: { ageGroup: "ASC", id: "ASC" },
    });
    return rows
      .filter(
        (r) =>
          (query.includeDeleted === true ||
            query.includeDeleted === "true" ||
            r.status === "ACTIVE") &&
          (!query.targetAgeGroup || r.ageGroup === query.targetAgeGroup),
      )
      .map((r) => this.serializeRule(r))
      .filter(
        (r) =>
          !query.search ||
          (r.name + " " + r.ageGroup)
            .toLocaleLowerCase("vi")
            .includes(query.search.toLocaleLowerCase("vi")),
      );
  }

  async getStats() {
    const total = await this.ruleRepo.count(),
      active = await this.ruleRepo.count({ where: { status: "ACTIVE" } });
    const [allergic] = await this.ruleRepo.query(
      "SELECT count(DISTINCT student_id) AS count FROM student_allergies WHERE is_active=true",
    );
    const [catalog] = await this.ruleRepo.query(
      "SELECT count(*) AS count FROM allergens",
    );
    return {
      activeRulesCount: active,
      complianceRatePercent: null,
      nutritionWarningsCount: null,
      allergicChildrenCount: Number(allergic?.count ?? allergic?.cnt ?? 0),
      configuredAllergensCount: Number(catalog?.count ?? catalog?.cnt ?? 0),
      totalRules: total,
      activeRules: active,
      lastEvaluated: null,
    };
  }

  async findOne(id: number) {
    const row = await this.ruleRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException("Không tìm thấy tiêu chuẩn.");
    return this.serializeRule(row);
  }

  async create(dto: CreateNutritionRuleDto) {
    const payload = this.applyInput(dto);
    const saved = await this.ruleRepo.save(this.ruleRepo.create(payload));
    return this.serializeRule(saved);
  }

  async update(id: number, dto: UpdateNutritionRuleDto) {
    const current = await this.ruleRepo.findOne({ where: { id } });
    if (!current) throw new NotFoundException("Không tìm thấy tiêu chuẩn.");
    return this.serializeRule(
      await this.ruleRepo.save(
        Object.assign(current, this.applyInput(dto, current)),
      ),
    );
  }

  async remove(id: number) {
    await this.update(id, { isActive: false });
    return { success: true, message: "Đã ngừng áp dụng tiêu chuẩn." };
  }

  async restore(id: number) {
    await this.update(id, { isActive: true });
    return { success: true, message: "Đã khôi phục tiêu chuẩn." };
  }

  async syncRdaStandards() {
    throw new ServiceUnavailableException(
      "Chưa cấu hình nguồn đồng bộ tiêu chuẩn. Vui lòng nhập chỉ tiêu đã được xác nhận.",
    );
  }
}
