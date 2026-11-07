import { readState, writeState } from "../../../common/utils/persisted-state";
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SchoolTenant } from "../../auth/entities/tenant.entity";
import { Language } from "../entities/language.entity";
import { UiTranslation } from "../entities/ui-translation.entity";
import { SystemConfig } from "../entities/system-config.entity";
import { UpdateTenantProfileDto } from "../dto/update-tenant-profile.dto";
import { UploadLogoDto } from "../dto/upload-logo.dto";

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(SchoolTenant)
    private readonly schoolRepo: Repository<SchoolTenant>,
    @InjectRepository(Language)
    private readonly languageRepo: Repository<Language>,
    @InjectRepository(UiTranslation)
    private readonly translationRepo: Repository<UiTranslation>,
    @InjectRepository(SystemConfig)
    private readonly configRepo: Repository<SystemConfig>,
  ) {}

  async getProfile(schoolId: number = 1) {
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException("Không tìm thấy trường học.");
    const settings: any = await readState(
      this.schoolRepo.manager,
      "school-profile:" + schoolId,
      {},
    );
    const [counts] = await this.schoolRepo.manager.query(
      "SELECT (SELECT count(*) FROM classes WHERE school_id=$1) AS classes, (SELECT count(*) FROM students s JOIN classes c ON c.id=s.class_id WHERE c.school_id=$1) AS children, (SELECT count(*) FROM staff_profiles) AS staff",
      [schoolId],
    );
    return {
      ...settings,
      id: String(school.id),
      name: school.name,
      address: school.address || "",
      phone: school.phone || "",
      contactEmail: school.email || "",
      foodSafetyLicense: settings.foodSafetyLicense || {},
      legalRepresentative: {
        ...settings.legalRepresentative,
        name: school.principalName || settings.legalRepresentative?.name || "",
        title: settings.legalRepresentative?.title || "",
      },
      branding: {
        ...settings.branding,
        logoUrl: settings.branding?.logoUrl !== undefined ? (settings.branding.logoUrl || "") : (school.logo || ""),
      },
      isEducationDbSynced: false,
      syncedAt: null,
      stats: {
        totalClasses: Number(counts?.classes || 0),
        totalChildren: Number(counts?.children || 0),
        totalStaff: Number(counts?.staff || 0),
      },
    };
  }

  async updateProfile(dto: UpdateTenantProfileDto, schoolId: number = 1) {
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException("Không tìm thấy trường học.");
    if (dto.name !== undefined) school.name = dto.name.trim();
    if (dto.address !== undefined) school.address = dto.address;
    if (dto.phone !== undefined) school.phone = dto.phone;
    if (dto.contactEmail !== undefined) school.email = dto.contactEmail;
    if (dto.legalRepresentative?.name !== undefined)
      school.principalName = dto.legalRepresentative.name;
    if (dto.logo !== undefined)
      school.logo = dto.logo ? dto.logo : null;
    if (dto.branding?.logoUrl !== undefined) {
      if (!dto.branding.logoUrl) {
        school.logo = null;
      } else if (dto.branding.logoUrl.length <= 500) {
        school.logo = dto.branding.logoUrl;
      }
    }
    const current: any = await readState(
      this.schoolRepo.manager,
      "school-profile:" + schoolId,
      {},
    );
    const settings = {
      ...current,
      ...dto,
      branding: { ...current.branding, ...dto.branding },
      foodSafetyLicense: {
        ...current.foodSafetyLicense,
        ...dto.foodSafetyLicense,
      },
      legalRepresentative: {
        ...current.legalRepresentative,
        ...dto.legalRepresentative,
      },
      operationalSettings: {
        ...current.operationalSettings,
        ...dto.operationalSettings,
      },
      updatedAt: new Date().toISOString(),
    };
    await this.schoolRepo.save(school);
    await writeState(
      this.schoolRepo.manager,
      "school-profile:" + schoolId,
      settings,
    );
    return this.getProfile(schoolId);
  }

  async uploadLogo(dto: UploadLogoDto, schoolId: number = 1) {
    if (
      !dto.fileContentBase64 ||
      !dto.fileContentBase64.startsWith("data:image/")
    )
      throw new BadRequestException("Thiếu nội dung ảnh hợp lệ.");
    if (dto.fileSizeBytes > 2 * 1024 * 1024)
      throw new BadRequestException("Ảnh tối đa 2 MB.");
    await this.updateProfile(
      {
        branding: {
          logoUrl: dto.fileContentBase64,
          logoName: dto.fileName,
          logoSize: String(dto.fileSizeBytes),
        },
      },
      schoolId,
    );
    return {
      success: true,
      logoUrl: dto.fileContentBase64,
      fileName: dto.fileName,
      message: "Đã lưu logo trường học.",
    };
  }

  async syncEducationDb() {
    throw new ServiceUnavailableException(
      "Chưa cấu hình kết nối cơ sở dữ liệu ngành giáo dục.",
    );
  }

  async getLanguages() {
    return this.languageRepo.find({
      where: { isActive: true },
      order: { isDefault: "DESC", id: "ASC" },
    });
  }

  async getTranslations(langCode: string = "vi", namespace?: string) {
    const lang = await this.languageRepo.findOne({ where: { code: langCode } });
    if (!lang) {
      return {};
    }

    const query = this.translationRepo
      .createQueryBuilder("t")
      .where("t.language_id = :langId", { langId: lang.id });

    if (namespace) {
      query.andWhere("t.namespace = :ns", { ns: namespace });
    }

    const items = await query.getMany();
    const result: Record<string, string> = {};
    for (const item of items) {
      result[item.translationKey] = item.translationValue;
    }
    return result;
  }
}
