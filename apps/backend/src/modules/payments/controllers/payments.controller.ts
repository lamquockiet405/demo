import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { VnpayService } from '../services/vnpay.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CreatePaymentUrlDto } from '../dto/create-payment-url.dto';

@ApiTags('Payments & VNPAY Billing (UC62)')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly vnpayService: VnpayService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Post('create-url')
  @ApiOperation({
    summary:
      'Khởi tạo link thanh toán VNPAY kèm chữ ký HMAC-SHA512 (UC62 - Pay Snack Service Fee Online)',
  })
  @Roles('PARENT', 'SUPER_ADMIN', 'SCHOOL_MANAGEMENT', 'PRINCIPAL')
  async createPaymentUrl(
    @Body() body: CreatePaymentUrlDto,
    @Req() req: Request,
  ) {
    const ipAddr =
      (req.headers['x-forwarded-for'] as string) ||
      req.socket.remoteAddress ||
      '127.0.0.1';

    const resolvedRegId =
      body.registrationId ||
      (body.invoiceId ? Number(String(body.invoiceId).split('-').pop()) : 1) ||
      1;

    return this.vnpayService.createPaymentUrl({
      registrationId: Number(resolvedRegId),
      orderInfo: body.orderInfo,
      ipAddr,
    });
  }

  @Public()
  @Get('vnpay-ipn')
  @ApiOperation({
    summary:
      'KÊNH 1: Server-to-Server IPN Webhook từ máy chủ VNPAY (Ngầm, Bảo mật & Idempotent)',
  })
  async vnpayIpn(@Query() query: Record<string, string>) {
    return this.vnpayService.handleIpn(query);
  }

  @Public()
  @Get('vnpay-return')
  @ApiOperation({
    summary:
      'KÊNH 2: Xác thực kết quả giao dịch khi trình duyệt phụ huynh quay lại từ VNPAY',
  })
  async vnpayReturn(@Query() query: Record<string, string>) {
    return this.vnpayService.verifyReturnUrl(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Get('my-invoices')
  @ApiOperation({
    summary: 'Lấy danh sách các hóa đơn tiền ăn xế của con dành cho Phụ huynh',
  })
  @Roles('PARENT', 'SUPER_ADMIN')
  async getMyInvoices(@CurrentUser('id') userId?: number) {
    return this.vnpayService.getMyInvoices(userId || 13);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Get('receipt/:registrationId')
  @ApiOperation({
    summary: 'Xuất chi tiết biên lai thu tiền điện tử (Electronic Receipt)',
  })
  @Roles('PARENT', 'SUPER_ADMIN', 'SCHOOL_MANAGEMENT', 'PRINCIPAL')
  async getReceipt(
    @Param('registrationId', ParseIntPipe) registrationId: number,
    @CurrentUser('id') userId?: number,
  ) {
    return this.vnpayService.getElectronicReceipt(registrationId, userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Get('invoices')
  @ApiOperation({ summary: 'Lấy danh sách các hóa đơn tiền ăn xế toàn trường (BGH)' })
  @Roles('SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async getInvoices() {
    return this.vnpayService.getInvoices();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Post('invoices')
  @ApiOperation({ summary: 'Tạo mới phiếu đăng ký / hóa đơn ăn xế' })
  @Roles('SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN', 'PARENT')
  async createInvoice(@Body() body: any) {
    return this.vnpayService.createInvoice(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Post('invoices/:id/remind')
  @ApiOperation({ summary: 'Gửi tin nhắn nhắc phụ huynh đóng phí ăn xế' })
  @Roles('SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async remindInvoice(@Param('id', ParseIntPipe) id: number) {
    return this.vnpayService.remindInvoice(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Post('invoices/batch-remind')
  @ApiOperation({ summary: 'Gửi nhắc phí hàng loạt cho các phụ huynh chưa thanh toán' })
  @Roles('SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async batchRemind() {
    return this.vnpayService.batchRemind();
  }
}
