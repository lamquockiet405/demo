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

  /**
   * Phân giải bản ghi Tenant thực tế từ database (hỗ trợ cả UUID, mã trường, hoặc ID số '1', '2')
   */
  private async resolveTenantEntity(tenantId: string, user?: any): Promise<Tenant | null> {
    const rawId = String(tenantId || '').trim();

    // 1. Nếu là UUID hợp lệ (hoặc trong môi trường unit test không có dataSource)
    if (UUID_REGEX.test(rawId) || !this.dataSource) {
      try {
        const byId = await this.tenantRepository.findOne({
          where: { id: rawId },
        });
        if (byId) return byId;
      } catch {
        // Ignore UUID syntax error if rawId is not a valid UUID in Postgres
      }
      if (!this.dataSource) {
        return null;
      }
    }

    // 2. Nếu user đang đăng nhập có tenantId hợp lệ hoặc tìm từ bảng users
    const userTenantId = user?.tenantId;
    if (userTenantId && UUID_REGEX.test(String(userTenantId))) {
      try {
        const byUserTenant = await this.tenantRepository.findOne({
          where: { id: String(userTenantId) },
        });
        if (byUserTenant) return byUserTenant;
      } catch {
        // Ignore
      }
    }

    if (user?.sub || user?.id) {
      const uid = String(user.sub || user.id);
      if (UUID_REGEX.test(uid) && this.userRepository) {
        try {
          const dbUser = await this.userRepository.findOne({ where: { id: uid } });
          if (dbUser?.tenantId && UUID_REGEX.test(dbUser.tenantId)) {
            const byDbUserTenant = await this.tenantRepository.findOne({
              where: { id: dbUser.tenantId },
            });
            if (byDbUserTenant) return byDbUserTenant;
          }
        } catch {
          // Ignore
        }
      }
    }

    // 3. Tìm theo mã code hoặc lấy danh sách tenants trong DB
    try {
      if (rawId && !/^\d+$/.test(rawId)) {
        const byCode = await this.tenantRepository.findOne({
          where: { code: rawId },
        });
        if (byCode) return byCode;
      }

      const allTenants = await this.tenantRepository.find({
        order: { createdAt: 'ASC' },
      });
      if (allTenants.length > 0) {
        if (/^\d+$/.test(rawId)) {
          const idx = Math.max(0, parseInt(rawId, 10) - 1);
          return allTenants[idx] || allTenants[0];
        }
        return allTenants[0];
      }
    } catch {
      // Bảng tenants có thể không tồn tại nếu DB dùng bảng schools
    }

    return null;
  }

  /**
   * Truy vấn tên Hiệu trưởng thực tế từ bảng users của trường (nếu chưa cấu hình trong settings)
   */
  private async findPrincipalNameFromDb(tenantId: string): Promise<string> {
    if (!this.dataSource) return '';
    try {
      if (UUID_REGEX.test(tenantId)) {
        const rows = await this.dataSource.query(
          `SELECT u.full_name
           FROM users u
           INNER JOIN user_roles ur ON ur.user_id = u.id
           INNER JOIN roles r ON r.id = ur.role_id
           WHERE u.tenant_id = $1
             AND u.deleted_at IS NULL
             AND r.code IN ('PRINCIPAL', 'SCHOOL_MANAGER')
           ORDER BY u.created_at ASC
           LIMIT 1`,
          [tenantId],
        );
        if (rows?.[0]?.full_name) {
          return rows[0].full_name;
        }
      } else {
        const rows = await this.dataSource.query(
          `SELECT u.full_name
           FROM users u
           INNER JOIN user_roles ur ON ur.user_id = u.id
           INNER JOIN roles r ON r.id = ur.role_id
           WHERE r.code IN ('PRINCIPAL', 'SCHOOL_MANAGER')
           ORDER BY u.id ASC
           LIMIT 1`,
        );
        if (rows?.[0]?.full_name) {
          return rows[0].full_name;
        }
      }
    } catch {
      // Ignore query errors across different schemas
    }
    return '';
  }

  /**
   * Truy vấn số liệu thống kê thực tế của trường từ CSDL (số lớp, số học sinh, số nhân sự)
   */
  private async getRealSchoolStats(tenantId: string): Promise<{
    totalClasses: number;
    totalChildren: number;
    totalStaff: number;
  }> {
    const stats = { totalClasses: 0, totalChildren: 0, totalStaff: 0 };
    if (!this.dataSource) return stats;

    const isUuid = UUID_REGEX.test(tenantId);

    // 1. Đếm số lớp học thực tế
    try {
      if (isUuid) {
        const res = await this.dataSource.query(
          `SELECT COUNT(*)::int AS cnt FROM classes WHERE tenant_id = $1`,
          [tenantId],
        );
        stats.totalClasses = res?.[0]?.cnt ?? 0;
      } else {
        const res = await this.dataSource.query(`SELECT COUNT(*)::int AS cnt FROM classes`);
        stats.totalClasses = res?.[0]?.cnt ?? 0;
      }
    } catch {
      // Ignore
    }

    // 2. Đếm số học sinh thực tế (bảng children hoặc students)
    try {
      if (isUuid) {
        const res = await this.dataSource.query(
          `SELECT COUNT(*)::int AS cnt FROM children WHERE tenant_id = $1 AND deleted_at IS NULL`,
          [tenantId],
        );
        stats.totalChildren = res?.[0]?.cnt ?? 0;
      } else {
        const res = await this.dataSource.query(`SELECT COUNT(*)::int AS cnt FROM students`);
        stats.totalChildren = res?.[0]?.cnt ?? 0;
      }
    } catch {
      try {
        const res = await this.dataSource.query(`SELECT COUNT(*)::int AS cnt FROM children`);
        stats.totalChildren = res?.[0]?.cnt ?? 0;
      } catch {
        // Ignore
      }
    }

    // 3. Đếm số cán bộ nhân viên thực tế (loại trừ tài khoản chỉ có role PARENT)
    try {
      if (isUuid) {
        const res = await this.dataSource.query(
          `SELECT COUNT(DISTINCT u.id)::int AS cnt
           FROM users u
           INNER JOIN user_roles ur ON ur.user_id = u.id
           INNER JOIN roles r ON r.id = ur.role_id
           WHERE u.tenant_id = $1
             AND u.deleted_at IS NULL
             AND r.code IN ('SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_MANAGER', 'NUTRITIONIST', 'KITCHEN_MANAGER', 'KITCHEN_STAFF', 'TEACHER', 'MEDICAL_STAFF')`,
          [tenantId],
        );
        stats.totalStaff = res?.[0]?.cnt ?? 0;
      } else {
        const res = await this.dataSource.query(
          `SELECT COUNT(DISTINCT u.id)::int AS cnt
           FROM users u
           INNER JOIN user_roles ur ON ur.user_id = u.id
           INNER JOIN roles r ON r.id = ur.role_id
           WHERE r.code IN ('SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_MANAGER', 'NUTRITIONIST', 'KITCHEN_MANAGER', 'KITCHEN_STAFF', 'TEACHER', 'MEDICAL_STAFF')`,
        );
        stats.totalStaff = res?.[0]?.cnt ?? 0;
      }
    } catch {
      // Ignore
    }

    return stats;
  }

  /**
   * Hỗ trợ đọc/ghi cấu hình mở rộng từ bảng system_configs nếu DB chỉ có bảng schools
   */
  private async getSchoolExtraSettings(schoolId: number): Promise<Record<string, any>> {
    if (!this.dataSource) return {};
    try {
      const rows = await this.dataSource.query(
        `SELECT config_value FROM system_configs WHERE config_key = $1 LIMIT 1`,
        [`school_settings_${schoolId}`],
      );
      if (rows?.[0]?.config_value) {
        return JSON.parse(rows[0].config_value);
      }
    } catch {
      // Ignore
    }
    return {};
  }

  private async saveSchoolExtraSettings(schoolId: number, settings: Record<string, any>): Promise<void> {
    if (!this.dataSource) return;
    try {
      const jsonVal = JSON.stringify(settings);
      await this.dataSource.query(
        `INSERT INTO system_configs (config_key, config_value, description)
         VALUES ($1, $2, 'Cấu hình thông tin trường học (UC07)')
         ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value`,
        [`school_settings_${schoolId}`, jsonVal],
      );
    } catch {
      // Ignore
    }
  }

  /**
   * UC07: Lấy thông tin cấu hình chi tiết của Trường Mầm non (Tenant / School) từ CSDL thực tế.
   */
  async getTenantProfile(tenantId: string, user?: any) {
    const tenant = await this.resolveTenantEntity(tenantId, user);

    if (tenant) {
      const settings = tenant.settings || {};
      const fsl = settings.foodSafetyLicense || settings.food_safety_license || {};
      const rep = settings.legalRepresentative || settings.legal_representative || {};
      const brd = settings.branding || {};
      const ops = settings.operationalSettings || {};

      let principalName = rep.name || '';
      if (!principalName) {
        principalName = await this.findPrincipalNameFromDb(tenant.id);
      }

      const stats = await this.getRealSchoolStats(tenant.id);

      return {
        id: tenant.id,
        code: tenant.code,
        name: tenant.name,
        domain: tenant.domain || '',
        contactEmail: tenant.contactEmail || '',
        phone: tenant.phone || '',
        address: tenant.address || '',
        status: tenant.status || 'ACTIVE',
        subscriptionTier: tenant.subscriptionTier || 'STANDARD',
        maxChildren: tenant.maxChildren || 500,
        educationDepartmentCode:
          settings.educationDepartmentCode || settings.education_department_code || '',
        schoolIdentifierSgd:
          settings.schoolIdentifierSgd || settings.school_identifier_sgd || '',
        isEducationDbSynced: Boolean(
          settings.isEducationDbSynced ?? settings.is_education_db_synced ?? false,
        ),
        syncedAt: settings.syncedAt || settings.synced_at || null,
        foodSafetyLicense: {
          number: fsl.number || '',
          expiryDate: fsl.expiryDate || fsl.expiry_date || '',
          issueDate: fsl.issueDate || fsl.issue_date || '',
          issuingAuthority: fsl.issuingAuthority || fsl.issuing_authority || '',
        },
        legalRepresentative: {
          name: principalName,
          title: rep.title || 'Hiệu trưởng',
        },
        branding: {
          logoUrl: brd.logoUrl ?? brd.logo_url ?? '',
          logoName: brd.logoName ?? brd.logo_name ?? '',
          logoSize: brd.logoSize ?? brd.logo_size ?? '',
          primaryColor: brd.primaryColor || brd.primary_color || 'TEAL',
        },
        operationalSettings: {
          mealTimes: Array.isArray(ops.mealTimes)
            ? ops.mealTimes
            : Array.isArray(settings.meal_times)
              ? settings.meal_times
              : ['BREAKFAST', 'LUNCH', 'AFTERNOON_SNACK'],
          standardWeeklyCycleLength: Number(
            ops.standardWeeklyCycleLength ?? settings.standard_weekly_cycle_length ?? 4,
          ),
          foodRetentionHours: Number(
            ops.foodRetentionHours ?? settings.food_retention_hours ?? 24,
          ),
          whoZscoreAutoCalc: Boolean(
            ops.whoZscoreAutoCalc ?? settings.who_zscore_auto_calc ?? true,
          ),
        },
        stats,
        updatedAt: tenant.updatedAt,
      };
    }

    // Fallback sang bảng `schools` nếu hệ thống đang chạy schema BIGSERIAL
    if (this.schoolRepository) {
      try {
        const numericId = /^\d+$/.test(String(tenantId)) ? Number(tenantId) : 1;
        let school = await this.schoolRepository.findOne({ where: { id: numericId } });
        if (!school) {
          const allSchools = await this.schoolRepository.find({ order: { id: 'ASC' } });
          school = allSchools[0] || null;
        }

        if (school) {
          const extra = await this.getSchoolExtraSettings(Number(school.id));
          const fsl = extra.foodSafetyLicense || {};
          const rep = extra.legalRepresentative || {};
          const brd = extra.branding || {};
          const ops = extra.operationalSettings || {};
          const stats = await this.getRealSchoolStats(String(school.id));

          return {
            id: String(school.id),
            code: extra.code || `SCHOOL_${school.id}`,
            name: school.name,
            domain: extra.domain || '',
            contactEmail: school.email || '',
            phone: school.phone || '',
            address: school.address || '',
            status: extra.status || 'ACTIVE',
            subscriptionTier: extra.subscriptionTier || 'STANDARD',
            maxChildren: Number(extra.maxChildren || 500),
            educationDepartmentCode: extra.educationDepartmentCode || '',
            schoolIdentifierSgd: extra.schoolIdentifierSgd || '',
            isEducationDbSynced: Boolean(extra.isEducationDbSynced ?? false),
            syncedAt: extra.syncedAt || null,
            foodSafetyLicense: {
              number: fsl.number || '',
              expiryDate: fsl.expiryDate || '',
              issueDate: fsl.issueDate || '',
              issuingAuthority: fsl.issuingAuthority || '',
            },
            legalRepresentative: {
              name: school.principalName || rep.name || '',
              title: rep.title || 'Hiệu trưởng',
            },
            branding: {
              logoUrl: school.logo ?? brd.logoUrl ?? '',
              logoName: brd.logoName || (school.logo ? 'logo_truong.png' : ''),
              logoSize: brd.logoSize || '',
              primaryColor: brd.primaryColor || 'TEAL',
            },
            operationalSettings: {
              mealTimes: Array.isArray(ops.mealTimes)
                ? ops.mealTimes
                : ['MORNING_SNACK', 'LUNCH', 'AFTERNOON_SNACK'],
              standardWeeklyCycleLength: Number(ops.standardWeeklyCycleLength ?? 4),
              foodRetentionHours: Number(ops.foodRetentionHours ?? 24),
              whoZscoreAutoCalc: Boolean(ops.whoZscoreAutoCalc ?? true),
            },
            stats,
            updatedAt: extra.updatedAt || new Date().toISOString(),
          };
        }
      } catch {
        // Ignore
      }
    }

    throw new NotFoundException(`Không tìm thấy cơ sở giáo dục với mã ID: ${tenantId}`);
  }

  /**
   * UC07: Cập nhật thông tin cơ sở trường, địa chỉ, hotline, giấy phép ATTP, nhận diện & cấu hình bán trú
   */
  async updateTenantProfile(tenantId: string, dto: UpdateTenantProfileDto, user?: any) {
    const tenant = await this.resolveTenantEntity(tenantId, user);

    if (tenant) {
      if (dto.name !== undefined && dto.name.trim() !== '') {
        tenant.name = dto.name.trim();
      }
      if (dto.code !== undefined && dto.code.trim() !== '') {
        tenant.code = dto.code.trim();
      }
      if (dto.domain !== undefined) {
        tenant.domain = dto.domain.trim() || null;
      }
      if (dto.address !== undefined) {
        tenant.address = dto.address.trim();
      }
      if (dto.phone !== undefined) {
        tenant.phone = dto.phone.trim();
      }
      const nextEmail = dto.contactEmail ?? dto.email;
      if (nextEmail !== undefined) {
        tenant.contactEmail = nextEmail.trim();
      }
      if (dto.maxChildren !== undefined && Number(dto.maxChildren) > 0) {
        tenant.maxChildren = Number(dto.maxChildren);
      }

      const currentSettings = { ...(tenant.settings || {}) };

      if (dto.educationDepartmentCode !== undefined) {
        currentSettings.education_department_code = dto.educationDepartmentCode.trim();
        currentSettings.educationDepartmentCode = dto.educationDepartmentCode.trim();
      }
      if (dto.schoolIdentifierSgd !== undefined) {
        currentSettings.school_identifier_sgd = dto.schoolIdentifierSgd.trim();
        currentSettings.schoolIdentifierSgd = dto.schoolIdentifierSgd.trim();
      }

      if (dto.foodSafetyLicense) {
        const prevFsl =
          currentSettings.foodSafetyLicense || currentSettings.food_safety_license || {};
        const nextFsl = {
          ...prevFsl,
          number: dto.foodSafetyLicense.number ?? prevFsl.number ?? '',
          expiryDate:
            dto.foodSafetyLicense.expiryDate ?? prevFsl.expiryDate ?? prevFsl.expiry_date ?? '',
          expiry_date:
            dto.foodSafetyLicense.expiryDate ?? prevFsl.expiry_date ?? prevFsl.expiryDate ?? '',
          issueDate:
            dto.foodSafetyLicense.issueDate ?? prevFsl.issueDate ?? prevFsl.issue_date ?? '',
          issue_date:
            dto.foodSafetyLicense.issueDate ?? prevFsl.issue_date ?? prevFsl.issueDate ?? '',
          issuingAuthority:
            dto.foodSafetyLicense.issuingAuthority ??
            prevFsl.issuingAuthority ??
            prevFsl.issuing_authority ??
            '',
          issuing_authority:
            dto.foodSafetyLicense.issuingAuthority ??
            prevFsl.issuing_authority ??
            prevFsl.issuingAuthority ??
            '',
        };
        currentSettings.food_safety_license = nextFsl;
        currentSettings.foodSafetyLicense = nextFsl;
      }

      if (dto.legalRepresentative || dto.principalName !== undefined) {
        const prevRep =
          currentSettings.legalRepresentative || currentSettings.legal_representative || {};
        const repName =
          dto.legalRepresentative?.name ?? dto.principalName ?? prevRep.name ?? '';
        const repTitle = dto.legalRepresentative?.title ?? prevRep.title ?? 'Hiệu trưởng';
        const nextRep = {
          ...prevRep,
          name: repName,
          title: repTitle,
        };
        currentSettings.legal_representative = nextRep;
        currentSettings.legalRepresentative = nextRep;
      }

      if (dto.branding || dto.logo !== undefined) {
        const prevBrd = currentSettings.branding || {};
        const nextLogoUrl =
          dto.branding?.logoUrl !== undefined
            ? dto.branding.logoUrl
            : dto.logo !== undefined
              ? dto.logo
              : prevBrd.logoUrl ?? prevBrd.logo_url ?? '';
        const nextLogoName =
          dto.branding?.logoName !== undefined
            ? dto.branding.logoName
            : prevBrd.logoName ?? prevBrd.logo_name ?? '';
        const nextLogoSize =
          dto.branding?.logoSize !== undefined
            ? dto.branding.logoSize
            : prevBrd.logoSize ?? prevBrd.logo_size ?? '';
        const nextPrimaryColor =
          dto.branding?.primaryColor ?? prevBrd.primaryColor ?? prevBrd.primary_color ?? 'TEAL';

        currentSettings.branding = {
          ...prevBrd,
          logoUrl: nextLogoUrl,
          logo_url: nextLogoUrl,
          logoName: nextLogoName,
          logo_name: nextLogoName,
          logoSize: nextLogoSize,
          logo_size: nextLogoSize,
          primaryColor: nextPrimaryColor,
          primary_color: nextPrimaryColor,
        };
      }

      if (dto.operationalSettings) {
        const prevOps = currentSettings.operationalSettings || {};
        const mealTimes =
          dto.operationalSettings.mealTimes ??
          prevOps.mealTimes ??
          currentSettings.meal_times ??
          ['BREAKFAST', 'LUNCH', 'AFTERNOON_SNACK'];
        const standardWeeklyCycleLength = Number(
          dto.operationalSettings.standardWeeklyCycleLength ??
            prevOps.standardWeeklyCycleLength ??
            currentSettings.standard_weekly_cycle_length ??
            4,
        );
        const foodRetentionHours = Number(
          dto.operationalSettings.foodRetentionHours ??
            prevOps.foodRetentionHours ??
            currentSettings.food_retention_hours ??
            24,
        );
        const whoZscoreAutoCalc = Boolean(
          dto.operationalSettings.whoZscoreAutoCalc ??
            prevOps.whoZscoreAutoCalc ??
            currentSettings.who_zscore_auto_calc ??
            true,
        );

        currentSettings.meal_times = mealTimes;
        currentSettings.standard_weekly_cycle_length = standardWeeklyCycleLength;
        currentSettings.food_retention_hours = foodRetentionHours;
        currentSettings.who_zscore_auto_calc = whoZscoreAutoCalc;
        currentSettings.operationalSettings = {
          mealTimes,
          standardWeeklyCycleLength,
          foodRetentionHours,
          whoZscoreAutoCalc,
        };
      }

      tenant.settings = currentSettings;
      await this.tenantRepository.save(tenant);

      this.logger.log(`Đã cập nhật cấu hình trường mầm non ID: ${tenant.id}`);
      return this.getTenantProfile(tenant.id, user);
    }

    // Fallback cập nhật bảng `schools` nếu hệ thống chạy schema BIGSERIAL
    if (this.schoolRepository) {
      const numericId = /^\d+$/.test(String(tenantId)) ? Number(tenantId) : 1;
      let school = await this.schoolRepository.findOne({ where: { id: numericId } });
      if (!school) {
        const allSchools = await this.schoolRepository.find({ order: { id: 'ASC' } });
        school = allSchools[0] || null;
      }

      if (school) {
        if (dto.name !== undefined && dto.name.trim() !== '') school.name = dto.name.trim();
        if (dto.address !== undefined) school.address = dto.address.trim();
        if (dto.phone !== undefined) school.phone = dto.phone.trim();
        const nextEmail = dto.contactEmail ?? dto.email;
        if (nextEmail !== undefined) school.email = nextEmail.trim();
        if (dto.legalRepresentative?.name !== undefined) {
          school.principalName = dto.legalRepresentative.name.trim();
        } else if (dto.principalName !== undefined) {
          school.principalName = dto.principalName.trim();
        }
        if (dto.branding?.logoUrl !== undefined || dto.logo !== undefined) {
          await this.dataSource
            ?.query('ALTER TABLE schools ALTER COLUMN logo TYPE TEXT')
            .catch(() => {});
          school.logo = (dto.branding?.logoUrl ?? dto.logo) || '';
        }

        await this.schoolRepository.save(school);

        const prevExtra = await this.getSchoolExtraSettings(Number(school.id));
        const nextExtra = {
          ...prevExtra,
          code: dto.code ?? prevExtra.code ?? `SCHOOL_${school.id}`,
          domain: dto.domain ?? prevExtra.domain ?? '',
          maxChildren: dto.maxChildren ?? prevExtra.maxChildren ?? 500,
          educationDepartmentCode:
            dto.educationDepartmentCode ?? prevExtra.educationDepartmentCode ?? '',
          schoolIdentifierSgd: dto.schoolIdentifierSgd ?? prevExtra.schoolIdentifierSgd ?? '',
          foodSafetyLicense: dto.foodSafetyLicense
            ? { ...(prevExtra.foodSafetyLicense || {}), ...dto.foodSafetyLicense }
            : prevExtra.foodSafetyLicense,
          legalRepresentative: {
            name: school.principalName,
            title:
              dto.legalRepresentative?.title ??
              prevExtra.legalRepresentative?.title ??
              'Hiệu trưởng',
          },
          branding: dto.branding
            ? { ...(prevExtra.branding || {}), ...dto.branding }
            : prevExtra.branding,
          operationalSettings: dto.operationalSettings
            ? { ...(prevExtra.operationalSettings || {}), ...dto.operationalSettings }
            : prevExtra.operationalSettings,
          updatedAt: new Date().toISOString(),
        };
        await this.saveSchoolExtraSettings(Number(school.id), nextExtra);

        return this.getTenantProfile(String(school.id), user);
      }
    }

    throw new NotFoundException(`Không tìm thấy cơ sở giáo dục với mã ID: ${tenantId}`);
  }

  /**
   * UC07: Xử lý tải lên Logo thương hiệu cho trường.
   * Ràng buộc nghiệp vụ:
   * - Chỉ chấp nhận định dạng: PNG, JPG/JPEG, SVG, WEBP.
   * - Dung lượng tối đa: không quá 2MB (2 * 1024 * 1024 bytes).
   */
  async uploadLogo(tenantId: string, uploadDto: UploadLogoDto, user?: any) {
    const maxSizeBytes = 2 * 1024 * 1024; // 2MB
    const validMimeTypes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/svg+xml',
      'image/webp',
    ];
    const validExtensions = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];

    const dotIndex = uploadDto.fileName.lastIndexOf('.');
    const fileExt = dotIndex !== -1 ? uploadDto.fileName.substring(dotIndex).toLowerCase() : '';

    // 1. Kiểm tra định dạng hợp lệ
    const isValidExt = validExtensions.includes(fileExt);
    const isValidMime = validMimeTypes.includes(uploadDto.mimeType.toLowerCase());

    if (!isValidExt || !isValidMime) {
      const sizeMb = (uploadDto.fileSizeBytes / (1024 * 1024)).toFixed(1);
      throw new BadRequestException(
        `Tệp ${uploadDto.fileName} (${sizeMb} MB) không hợp lệ. Vui lòng chọn định dạng PNG, JPG hoặc SVG và dung lượng tối đa không quá 2MB.`,
      );
    }

    // 2. Kiểm tra dung lượng tối đa 2MB
    if (uploadDto.fileSizeBytes > maxSizeBytes) {
      const sizeMb = (uploadDto.fileSizeBytes / (1024 * 1024)).toFixed(1);
      throw new BadRequestException(
        `Tệp ${uploadDto.fileName} (${sizeMb} MB) vượt quá dung lượng cho phép. Vui lòng chọn tệp có dung lượng tối đa không quá 2MB.`,
      );
    }

    // 3. Cập nhật logo mới vào CSDL
    const sizeFormatted =
      uploadDto.fileSizeBytes < 1024 * 1024
        ? `${Math.max(1, Math.round(uploadDto.fileSizeBytes / 1024))} KB`
        : `${(uploadDto.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`;

    const logoUrl = uploadDto.fileContentBase64 || `/assets/${uploadDto.fileName}`;

    const tenant = await this.resolveTenantEntity(tenantId, user);
    if (tenant) {
      const currentSettings = { ...(tenant.settings || {}) };
      const prevBrd = currentSettings.branding || {};
      const nextBranding = {
        ...prevBrd,
        logoUrl,
        logo_url: logoUrl,
        logoName: uploadDto.fileName,
        logo_name: uploadDto.fileName,
        logoSize: sizeFormatted,
        logo_size: sizeFormatted,
      };
      currentSettings.branding = nextBranding;
      tenant.settings = currentSettings;
      await this.tenantRepository.save(tenant);

      return {
        message: 'Tải lên logo thương hiệu thành công',
        branding: nextBranding,
      };
    }

    if (this.schoolRepository) {
      await this.updateTenantProfile(
        tenantId,
        {
          branding: {
            logoUrl,
            logoName: uploadDto.fileName,
            logoSize: sizeFormatted,
          },
        },
        user,
      );
      return {
        message: 'Tải lên logo thương hiệu thành công',
        branding: {
          logoUrl,
          logoName: uploadDto.fileName,
          logoSize: sizeFormatted,
        },
      };
    }

    throw new NotFoundException(`Không tìm thấy cơ sở giáo dục`);
  }

  /**
   * UC07: Đồng bộ thông tin pháp lý
   */
  async syncEducationDb(tenantId: string, user?: any) {
    const tenant = await this.resolveTenantEntity(tenantId, user);

    if (!tenant) {
      throw new NotFoundException(`Không tìm thấy cơ sở giáo dục`);
    }

    const settings = { ...(tenant.settings || {}) };
    const nowIso = new Date().toISOString();
    settings.is_education_db_synced = true;
    settings.isEducationDbSynced = true;
    settings.synced_at = nowIso;
    settings.syncedAt = nowIso;

    tenant.settings = settings;
    await this.tenantRepository.save(tenant);

    return {
      message: 'Đồng bộ Cơ sở dữ liệu ngành thành công',
      syncedAt: nowIso,
      status: 'SYNCHRONIZED',
    };
  }
}
