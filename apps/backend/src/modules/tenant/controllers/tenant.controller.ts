import { CurrentTenant } from "../../../common/decorators/current-tenant.decorator";
import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { TenantService } from "../services/tenant.service";
import { UpdateTenantProfileDto } from "../dto/update-tenant-profile.dto";
import { UploadLogoDto } from "../dto/upload-logo.dto";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { Public } from "../../../common/decorators/public.decorator";

/**
 * Quản lý cấu hình trường, nhận diện và tài nguyên ngôn ngữ của giao diện.
 * Các đường dẫn bên dưới được ghép với tiền tố toàn cục /api/v1.
 * Xác thực, quyền hoặc @Public được khai báo riêng ở các endpoint bên dưới.
 * Constructor nhận service qua Dependency Injection; các hàm chuyển dữ liệu request sang service.
 */
@ApiTags("Tenant & School Management")
@Controller("tenant")
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  /**
   * GET /tenant/profile: Lấy thông tin cấu hình trường mầm non & pháp lý ATTP.
   * @param schoolId ID trường từ ngữ cảnh request/header qua CurrentTenant.
   * Chuyển xử lý sang TenantService.getProfile() và trả kết quả cho client.
   */
  @Get("profile")
  @ApiOperation({
    summary: "Lấy thông tin cấu hình trường mầm non & pháp lý ATTP",
  })
  async getProfile(@CurrentTenant() schoolId: number) {
    return this.tenantService.getProfile(Number(schoolId));
  }

  /**
   * PATCH /tenant/profile: Cập nhật thông tin trường mầm non (Dành cho BGH).
   * @param dto Dữ liệu body JSON, kiểu UpdateTenantProfileDto.
   * @param schoolId ID trường từ ngữ cảnh request/header qua CurrentTenant.
   * Chuyển xử lý sang TenantService.updateProfile() và trả kết quả cho client.
   */
  @Patch("profile")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("SCHOOL_MANAGER", "SCHOOL_MANAGEMENT", "PRINCIPAL", "SUPER_ADMIN")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Cập nhật thông tin trường mầm non (Dành cho BGH)" })
  async updateProfile(
    @Body() dto: UpdateTenantProfileDto,
    @CurrentTenant() schoolId: number,
  ) {
    return this.tenantService.updateProfile(dto, Number(schoolId));
  }

  /**
   * POST /tenant/upload-logo: Tải lên logo trường mầm non.
   * @param dto Dữ liệu body JSON, kiểu UploadLogoDto.
   * @param schoolId ID trường từ ngữ cảnh request/header qua CurrentTenant.
   * Chuyển xử lý sang TenantService.uploadLogo() và trả kết quả cho client.
   */
  @Post("upload-logo")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("SCHOOL_MANAGER", "SCHOOL_MANAGEMENT", "PRINCIPAL", "SUPER_ADMIN")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Tải lên logo trường mầm non" })
  async uploadLogo(
    @Body() dto: UploadLogoDto,
    @CurrentTenant() schoolId: number,
  ) {
    return this.tenantService.uploadLogo(dto, Number(schoolId));
  }

  /**
   * POST /tenant/sync-education-db: Đồng bộ cơ sở dữ liệu ngành GD&ĐT.
   * Chuyển xử lý sang TenantService.syncEducationDb() và trả kết quả cho client.
   */
  @Post("sync-education-db")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("SCHOOL_MANAGER", "SCHOOL_MANAGEMENT", "PRINCIPAL", "SUPER_ADMIN")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Đồng bộ cơ sở dữ liệu ngành GD&ĐT" })
  async syncEducationDb() {
    return this.tenantService.syncEducationDb();
  }

  /**
   * GET /tenant/languages: Lấy danh sách các ngôn ngữ được hỗ trợ (i18n).
   * Chuyển xử lý sang TenantService.getLanguages() và trả kết quả cho client.
   */
  @Public()
  @Get("languages")
  @ApiOperation({ summary: "Lấy danh sách các ngôn ngữ được hỗ trợ (i18n)" })
  async getLanguages() {
    return this.tenantService.getLanguages();
  }

  /**
   * GET /tenant/translations/:langCode: Lấy từ điển bản dịch UI theo ngôn ngữ (i18n).
   * @param langCode Giá trị langCode trên URL.
   * @param namespace Tham số namespace trong query string (tùy chọn).
   * Chuyển xử lý sang TenantService.getTranslations() và trả kết quả cho client.
   */
  @Public()
  @Get("translations/:langCode")
  @ApiOperation({ summary: "Lấy từ điển bản dịch UI theo ngôn ngữ (i18n)" })
  async getTranslations(
    @Param("langCode") langCode: string,
    @Query("namespace") namespace?: string,
  ) {
    return this.tenantService.getTranslations(langCode, namespace);
  }
}
