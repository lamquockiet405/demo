import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MenuScannerService } from '../services/menu-scanner.service';
import { EvaluateMenuDto } from '../dto/evaluate-menu.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

/**
 * Tiếp nhận yêu cầu thẩm định dinh dưỡng thực đơn bằng bộ quy tắc.
 * Các đường dẫn bên dưới được ghép với tiền tố toàn cục /api/v1.
 * JwtAuthGuard xác thực tài khoản trước khi thực thi các endpoint.
 * Constructor nhận service qua Dependency Injection; các hàm chuyển dữ liệu request sang service.
 */
@ApiTags('Nutrition Rule Engine Scanner')
@Controller('rule-engine')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MenuScannerController {
  constructor(private readonly scannerService: MenuScannerService) {}

  /**
   * POST /rule-engine/evaluate-menu: Thẩm định thực đơn theo Thông tư 28/2016/TT-BGDĐT & cân bằng P:L:G.
   * @param dto Dữ liệu body JSON, kiểu EvaluateMenuDto.
   * Chuyển xử lý sang MenuScannerService.evaluateMenu() và trả kết quả cho client.
   * Service đọc món theo danh sách hoặc phiên bản thực đơn rồi tính dinh dưỡng theo khẩu phần.
   * Controller trả kết quả thẩm định do service tính, không trực tiếp gọi repository lưu dữ liệu.
   */
  @Post('evaluate-menu')
  @ApiOperation({ summary: 'Thẩm định thực đơn theo Thông tư 28/2016/TT-BGDĐT & cân bằng P:L:G' })
  async evaluateMenu(@Body() dto: EvaluateMenuDto) {
    return this.scannerService.evaluateMenu(dto);
  }
}
