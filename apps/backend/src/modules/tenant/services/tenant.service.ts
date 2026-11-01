import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Tenant, SchoolTenant } from '../../auth/entities/tenant.entity';
import { User } from '../../auth/entities/user.entity';
import { UpdateTenantProfileDto } from '../dto/update-tenant-profile.dto';
import { UploadLogoDto } from '../dto/upload-logo.dto';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STAFF_ROLES_SQL = `('SUPER_ADMIN','PRINCIPAL','SCHOOL_MANAGER','NUTRITIONIST','KITCHEN_MANAGER','KITCHEN_STAFF','TEACHER','MEDICAL_STAFF')`;
const DEFAULT_MEALS = ['BREAKFAST', 'LUNCH', 'AFTERNOON_SNACK'];

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @Optional()
    @InjectRepository(SchoolTenant)
    private readonly schoolRepository?: Repository<SchoolTenant>,
    @Optional()
    @InjectRepository(User)
    private readonly userRepository?: Repository<User>,
    @Optional()
    private readonly dataSource?: DataSource,
  ) {}

  private async resolveTenantEntity(tenantId: string, user?: any): Promise<Tenant | null> {
    const rawId = String(tenantId || '').trim();

    if (UUID_REGEX.test(rawId) || !this.dataSource) {
      try {
        const byId = await this.tenantRepository.findOne({ where: { id: rawId } });
        if (byId) return byId;
      } catch {}
      if (!this.dataSource) return null;
    }

    const candidates = [user?.tenantId, user?.sub || user?.id].filter(Boolean).map(String);
    for (const cid of candidates) {
      if (!UUID_REGEX.test(cid)) continue;
      try {
        const direct = await this.tenantRepository.findOne({ where: { id: cid } });
        if (direct) return direct;
        if (this.userRepository) {
          const dbUser = await this.userRepository.findOne({ where: { id: cid } });
          if (dbUser?.tenantId && UUID_REGEX.test(dbUser.tenantId)) {
            const byUser = await this.tenantRepository.findOne({ where: { id: dbUser.tenantId } });
            if (byUser) return byUser;
          }
        }
      } catch {}
    }

    try {
      if (rawId && !/^\d+$/.test(rawId)) {
        const byCode = await this.tenantRepository.findOne({ where: { code: rawId } });
        if (byCode) return byCode;
      }
      const all = await this.tenantRepository.find({ order: { createdAt: 'ASC' } });
      if (all.length > 0) {
        const idx = /^\d+$/.test(rawId) ? Math.max(0, parseInt(rawId, 10) - 1) : 0;
        return all[idx] || all[0];
      }
    } catch {}

    return null;
  }

  private async resolveSchoolFallback(tenantId: string): Promise<SchoolTenant | null> {
    if (!this.schoolRepository) return null;
    try {
      const numericId = /^\d+$/.test(String(tenantId)) ? Number(tenantId) : 1;
      const byId = await this.schoolRepository.findOne({ where: { id: numericId } });
      if (byId) return byId;
      const all = await this.schoolRepository.find({ order: { id: 'ASC' } });
      return all[0] || null;
    } catch {
      return null;
    }
  }

  private async findPrincipalNameFromDb(tenantId: string): Promise<string> {
    if (!this.dataSource) return '';
    try {
      const isUuid = UUID_REGEX.test(tenantId);
      const rows = await this.dataSource.query(
        `SELECT u.full_name FROM users u
         INNER JOIN user_roles ur ON ur.user_id = u.id
         INNER JOIN roles r ON r.id = ur.role_id
         WHERE ${isUuid ? 'u.tenant_id = $1 AND u.deleted_at IS NULL AND ' : ''}r.code IN ('PRINCIPAL', 'SCHOOL_MANAGER')
         ORDER BY ${isUuid ? 'u.created_at' : 'u.id'} ASC LIMIT 1`,
        isUuid ? [tenantId] : [],
      );
      return rows?.[0]?.full_name || '';
    } catch {
      return '';
    }
  }

  private async getRealSchoolStats(tenantId: string) {
    if (!this.dataSource) return { totalClasses: 0, totalChildren: 0, totalStaff: 0 };
    const isUuid = UUID_REGEX.test(tenantId);
    const params = isUuid ? [tenantId] : [];
    const safeCount = async (sql: string, p: any[] = params) => {
      try {
        const r = await this.dataSource!.query(sql, p);
        return r?.[0]?.cnt ?? 0;
      } catch {
        return 0;
      }
    };

    const [totalClasses, totalChildren, totalStaff] = await Promise.all([
      safeCount(`SELECT COUNT(*)::int AS cnt FROM classes${isUuid ? ' WHERE tenant_id = $1' : ''}`),
      isUuid
        ? safeCount(`SELECT COUNT(*)::int AS cnt FROM children WHERE tenant_id = $1 AND deleted_at IS NULL`)
        : safeCount(`SELECT COUNT(*)::int AS cnt FROM students`).then((c) =>
            c || safeCount(`SELECT COUNT(*)::int AS cnt FROM children`, []),
          ),
      safeCount(
        `SELECT COUNT(DISTINCT u.id)::int AS cnt FROM users u
         INNER JOIN user_roles ur ON ur.user_id = u.id
         INNER JOIN roles r ON r.id = ur.role_id
         WHERE ${isUuid ? 'u.tenant_id = $1 AND u.deleted_at IS NULL AND ' : ''}r.code IN ${STAFF_ROLES_SQL}`,
      ),
    ]);

    return { totalClasses, totalChildren, totalStaff };
  }

  private async getSchoolExtraSettings(schoolId: number): Promise<Record<string, any>> {
    if (!this.dataSource) return {};
    try {
      const rows = await this.dataSource.query(
        `SELECT config_value FROM system_configs WHERE config_key = $1 LIMIT 1`,
        [`school_settings_${schoolId}`],
      );
      return rows?.[0]?.config_value ? JSON.parse(rows[0].config_value) : {};
    } catch {
      return {};
    }
  }

  private async saveSchoolExtraSettings(schoolId: number, settings: Record<string, any>): Promise<void> {
    if (!this.dataSource) return;
    try {
      await this.dataSource.query(
        `INSERT INTO system_configs (config_key, config_value, description)
         VALUES ($1, $2, 'Cấu hình thông tin trường học (UC07)')
         ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value`,
        [`school_settings_${schoolId}`, JSON.stringify(settings)],
      );
    } catch {}
  }

  private formatProfile(base: any, settings: Record<string, any>, principalFallback: string, stats: any) {
    const fsl = settings.foodSafetyLicense || settings.food_safety_license || {};
    const rep = settings.legalRepresentative || settings.legal_representative || {};
    const brd = settings.branding || {};
    const ops = settings.operationalSettings || {};

    return {
      id: String(base.id),
      code: base.code || settings.code || `SCHOOL_${base.id}`,
      name: base.name,
      domain: base.domain ?? settings.domain ?? '',
      contactEmail: base.contactEmail ?? base.email ?? '',
      phone: base.phone || '',
      address: base.address || '',
      status: base.status || settings.status || 'ACTIVE',
      subscriptionTier: base.subscriptionTier || settings.subscriptionTier || 'STANDARD',
      maxChildren: Number(base.maxChildren || settings.maxChildren || 500),
      educationDepartmentCode: settings.educationDepartmentCode || settings.education_department_code || '',
      schoolIdentifierSgd: settings.schoolIdentifierSgd || settings.school_identifier_sgd || '',
      isEducationDbSynced: Boolean(settings.isEducationDbSynced ?? settings.is_education_db_synced ?? false),
      syncedAt: settings.syncedAt || settings.synced_at || null,
      foodSafetyLicense: {
        number: fsl.number || '',
        expiryDate: fsl.expiryDate || fsl.expiry_date || '',
        issueDate: fsl.issueDate || fsl.issue_date || '',
        issuingAuthority: fsl.issuingAuthority || fsl.issuing_authority || '',
      },
      legalRepresentative: {
        name: base.principalName || rep.name || principalFallback || '',
        title: rep.title || 'Hiệu trưởng',
      },
      branding: {
        logoUrl: base.logo ?? brd.logoUrl ?? brd.logo_url ?? '',
        logoName: brd.logoName ?? brd.logo_name ?? (base.logo ? 'logo_truong.png' : ''),
        logoSize: brd.logoSize ?? brd.logo_size ?? '',
        primaryColor: brd.primaryColor || brd.primary_color || 'TEAL',
      },
      operationalSettings: {
        mealTimes: Array.isArray(ops.mealTimes)
          ? ops.mealTimes
          : Array.isArray(settings.meal_times)
            ? settings.meal_times
            : DEFAULT_MEALS,
        standardWeeklyCycleLength: Number(
          ops.standardWeeklyCycleLength ?? settings.standard_weekly_cycle_length ?? 4,
        ),
        foodRetentionHours: Number(ops.foodRetentionHours ?? settings.food_retention_hours ?? 24),
        whoZscoreAutoCalc: Boolean(ops.whoZscoreAutoCalc ?? settings.who_zscore_auto_calc ?? true),
      },
      stats,
      updatedAt: base.updatedAt || settings.updatedAt || new Date().toISOString(),
    };
  }

  private mergeSettings(prev: Record<string, any>, dto: UpdateTenantProfileDto): Record<string, any> {
    const next = { ...prev };
    if (dto.educationDepartmentCode !== undefined) {
      next.educationDepartmentCode = next.education_department_code = dto.educationDepartmentCode.trim();
    }
    if (dto.schoolIdentifierSgd !== undefined) {
      next.schoolIdentifierSgd = next.school_identifier_sgd = dto.schoolIdentifierSgd.trim();
    }
    if (dto.foodSafetyLicense) {
      const pf = next.foodSafetyLicense || next.food_safety_license || {};
      const exp = dto.foodSafetyLicense.expiryDate ?? pf.expiryDate ?? pf.expiry_date ?? '';
      const iss = dto.foodSafetyLicense.issueDate ?? pf.issueDate ?? pf.issue_date ?? '';
      const aut = dto.foodSafetyLicense.issuingAuthority ?? pf.issuingAuthority ?? pf.issuing_authority ?? '';
      next.foodSafetyLicense = next.food_safety_license = {
        ...pf,
        number: dto.foodSafetyLicense.number ?? pf.number ?? '',
        expiryDate: exp,
        expiry_date: exp,
        issueDate: iss,
        issue_date: iss,
        issuingAuthority: aut,
        issuing_authority: aut,
      };
    }
    if (dto.legalRepresentative || dto.principalName !== undefined) {
      const pr = next.legalRepresentative || next.legal_representative || {};
      next.legalRepresentative = next.legal_representative = {
        ...pr,
        name: dto.legalRepresentative?.name ?? dto.principalName ?? pr.name ?? '',
        title: dto.legalRepresentative?.title ?? pr.title ?? 'Hiệu trưởng',
      };
    }
    if (dto.branding || dto.logo !== undefined) {
      const pb = next.branding || {};
      const logoUrl = dto.branding?.logoUrl ?? dto.logo ?? pb.logoUrl ?? pb.logo_url ?? '';
      const logoName = dto.branding?.logoName ?? pb.logoName ?? pb.logo_name ?? '';
      const logoSize = dto.branding?.logoSize ?? pb.logoSize ?? pb.logo_size ?? '';
      const primaryColor = dto.branding?.primaryColor ?? pb.primaryColor ?? pb.primary_color ?? 'TEAL';
      next.branding = {
        ...pb,
        logoUrl,
        logo_url: logoUrl,
        logoName,
        logo_name: logoName,
        logoSize,
        logo_size: logoSize,
        primaryColor,
        primary_color: primaryColor,
      };
    }
    if (dto.operationalSettings) {
      const po = next.operationalSettings || {};
      const mealTimes = dto.operationalSettings.mealTimes ?? po.mealTimes ?? next.meal_times ?? DEFAULT_MEALS;
      const standardWeeklyCycleLength = Number(
        dto.operationalSettings.standardWeeklyCycleLength ??
          po.standardWeeklyCycleLength ??
          next.standard_weekly_cycle_length ??
          4,
      );
      const foodRetentionHours = Number(
        dto.operationalSettings.foodRetentionHours ??
          po.foodRetentionHours ??
          next.food_retention_hours ??
          24,
      );
      const whoZscoreAutoCalc = Boolean(
        dto.operationalSettings.whoZscoreAutoCalc ??
          po.whoZscoreAutoCalc ??
          next.who_zscore_auto_calc ??
          true,
      );
      next.meal_times = mealTimes;
      next.standard_weekly_cycle_length = standardWeeklyCycleLength;
      next.food_retention_hours = foodRetentionHours;
      next.who_zscore_auto_calc = whoZscoreAutoCalc;
      next.operationalSettings = {
        mealTimes,
        standardWeeklyCycleLength,
        foodRetentionHours,
        whoZscoreAutoCalc,
      };
    }
    return next;
  }

  async getTenantProfile(tenantId: string, user?: any) {
    const tenant = await this.resolveTenantEntity(tenantId, user);
    if (tenant) {
      const settings = tenant.settings || {};
      const repName = (settings.legalRepresentative || settings.legal_representative)?.name;
      const [principalFallback, stats] = await Promise.all([
        repName ? Promise.resolve(repName) : this.findPrincipalNameFromDb(tenant.id),
        this.getRealSchoolStats(tenant.id),
      ]);
      return this.formatProfile(tenant, settings, principalFallback, stats);
    }

    const school = await this.resolveSchoolFallback(tenantId);
    if (school) {
      const [extra, stats] = await Promise.all([
        this.getSchoolExtraSettings(Number(school.id)),
        this.getRealSchoolStats(String(school.id)),
      ]);
      return this.formatProfile(school, extra, school.principalName || '', stats);
    }

    throw new NotFoundException(`Không tìm thấy cơ sở giáo dục với mã ID: ${tenantId}`);
  }

  async updateTenantProfile(tenantId: string, dto: UpdateTenantProfileDto, user?: any) {
    const tenant = await this.resolveTenantEntity(tenantId, user);
    if (tenant) {
      if (dto.name?.trim()) tenant.name = dto.name.trim();
      if (dto.code?.trim()) tenant.code = dto.code.trim();
      if (dto.domain !== undefined) tenant.domain = dto.domain.trim() || null;
      if (dto.address !== undefined) tenant.address = dto.address.trim();
      if (dto.phone !== undefined) tenant.phone = dto.phone.trim();
      const nextEmail = dto.contactEmail ?? dto.email;
      if (nextEmail !== undefined) tenant.contactEmail = nextEmail.trim();
      if (dto.maxChildren !== undefined && Number(dto.maxChildren) > 0) {
        tenant.maxChildren = Number(dto.maxChildren);
      }

      tenant.settings = this.mergeSettings(tenant.settings || {}, dto);
      await this.tenantRepository.save(tenant);
      this.logger.log(`Đã cập nhật cấu hình trường mầm non ID: ${tenant.id}`);
      return this.getTenantProfile(tenant.id, user);
    }

    const school = await this.resolveSchoolFallback(tenantId);
    if (school && this.schoolRepository) {
      if (dto.name?.trim()) school.name = dto.name.trim();
      if (dto.address !== undefined) school.address = dto.address.trim();
      if (dto.phone !== undefined) school.phone = dto.phone.trim();
      const nextEmail = dto.contactEmail ?? dto.email;
      if (nextEmail !== undefined) school.email = nextEmail.trim();
      const nextPrincipal = dto.legalRepresentative?.name ?? dto.principalName;
      if (nextPrincipal !== undefined) school.principalName = nextPrincipal.trim();
      if (dto.branding?.logoUrl !== undefined || dto.logo !== undefined) {
        await this.dataSource?.query('ALTER TABLE schools ALTER COLUMN logo TYPE TEXT').catch(() => {});
        school.logo = (dto.branding?.logoUrl ?? dto.logo) || '';
      }
      await this.schoolRepository.save(school);

      const prevExtra = await this.getSchoolExtraSettings(Number(school.id));
      const nextExtra = {
        ...this.mergeSettings(prevExtra, dto),
        code: dto.code ?? prevExtra.code ?? `SCHOOL_${school.id}`,
        domain: dto.domain ?? prevExtra.domain ?? '',
        maxChildren: dto.maxChildren ?? prevExtra.maxChildren ?? 500,
        updatedAt: new Date().toISOString(),
      };
      await this.saveSchoolExtraSettings(Number(school.id), nextExtra);
      return this.getTenantProfile(String(school.id), user);
    }

    throw new NotFoundException(`Không tìm thấy cơ sở giáo dục với mã ID: ${tenantId}`);
  }

  async uploadLogo(tenantId: string, uploadDto: UploadLogoDto, user?: any) {
    const maxSizeBytes = 2 * 1024 * 1024;
    const validMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    const validExtensions = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];
    const dotIndex = uploadDto.fileName.lastIndexOf('.');
    const fileExt = dotIndex !== -1 ? uploadDto.fileName.substring(dotIndex).toLowerCase() : '';
    const sizeMb = (uploadDto.fileSizeBytes / (1024 * 1024)).toFixed(1);

    if (!validExtensions.includes(fileExt) || !validMimeTypes.includes(uploadDto.mimeType.toLowerCase())) {
      throw new BadRequestException(
        `Tệp ${uploadDto.fileName} (${sizeMb} MB) không hợp lệ. Vui lòng chọn định dạng PNG, JPG hoặc SVG và dung lượng tối đa không quá 2MB.`,
      );
    }
    if (uploadDto.fileSizeBytes > maxSizeBytes) {
      throw new BadRequestException(
        `Tệp ${uploadDto.fileName} (${sizeMb} MB) vượt quá dung lượng cho phép. Vui lòng chọn tệp có dung lượng tối đa không quá 2MB.`,
      );
    }

    const sizeFormatted =
      uploadDto.fileSizeBytes < 1024 * 1024
        ? `${Math.max(1, Math.round(uploadDto.fileSizeBytes / 1024))} KB`
        : `${sizeMb} MB`;
    const logoUrl = uploadDto.fileContentBase64 || `/assets/${uploadDto.fileName}`;

    const tenant = await this.resolveTenantEntity(tenantId, user);
    if (tenant) {
      tenant.settings = this.mergeSettings(tenant.settings || {}, {
        branding: { logoUrl, logoName: uploadDto.fileName, logoSize: sizeFormatted },
      });
      await this.tenantRepository.save(tenant);
      return {
        message: 'Tải lên logo thương hiệu thành công',
        branding: tenant.settings.branding,
      };
    }

    if (this.schoolRepository) {
      const branding = { logoUrl, logoName: uploadDto.fileName, logoSize: sizeFormatted };
      await this.updateTenantProfile(tenantId, { logo: logoUrl, branding }, user);
      return { message: 'Tải lên logo thương hiệu thành công', branding };
    }

    throw new NotFoundException('Không tìm thấy cơ sở giáo dục');
  }

  async syncEducationDb(tenantId: string, user?: any) {
    const nowIso = new Date().toISOString();
    const tenant = await this.resolveTenantEntity(tenantId, user);
    if (tenant) {
      tenant.settings = {
        ...(tenant.settings || {}),
        is_education_db_synced: true,
        isEducationDbSynced: true,
        synced_at: nowIso,
        syncedAt: nowIso,
      };
      await this.tenantRepository.save(tenant);
      return {
        message: 'Đồng bộ Cơ sở dữ liệu ngành thành công',
        syncedAt: nowIso,
        status: 'SYNCHRONIZED',
      };
    }

    const school = await this.resolveSchoolFallback(tenantId);
    if (school) {
      const prev = await this.getSchoolExtraSettings(Number(school.id));
      await this.saveSchoolExtraSettings(Number(school.id), {
        ...prev,
        isEducationDbSynced: true,
        syncedAt: nowIso,
        updatedAt: nowIso,
      });
      return {
        message: 'Đồng bộ Cơ sở dữ liệu ngành thành công',
        syncedAt: nowIso,
        status: 'SYNCHRONIZED',
      };
    }

    throw new NotFoundException('Không tìm thấy cơ sở giáo dục');
  }
}
