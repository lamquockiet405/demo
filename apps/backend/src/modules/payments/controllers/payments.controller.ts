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
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { Request } from "express";
import { VnpayService } from "../services/vnpay.service";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { Public } from "../../../common/decorators/public.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { CreatePaymentUrlDto } from "../dto/create-payment-url.dto";

/**
 * Quản lý hóa đơn ăn xế và tiếp nhận luồng thanh toán, callback từ VNPAY.
 * Các đường dẫn bên dưới được ghép với tiền tố toàn cục /api/v1.
 * Xác thực, quyền hoặc @Public được khai báo riêng ở các endpoint bên dưới.
 * Constructor nhận service qua Dependency Injection; các hàm chuyển dữ liệu request sang service.
 */
@ApiTags("Payments & VNPAY Billing (UC62)")
@Controller("payments")
export class PaymentsController {
  constructor(private readonly vnpayService: VnpayService) {}

  /**
   * POST /payments/create-url: Khởi tạo link thanh toán VNPAY kèm chữ ký HMAC-SHA512 (UC62 - Pay Snack Service Fee Online).
   * @param body Dữ liệu body JSON, kiểu CreatePaymentUrlDto.
   * @param req HTTP request để đọc thông tin người dùng, header hoặc địa chỉ IP.
   * @param user Thông tin tài khoản đã xác thực.
   * Chuyển xử lý sang VnpayService.createPaymentUrl() và trả kết quả cho client.
   * Lấy IP từ header hoặc socket; xác định registrationId trực tiếp hoặc từ phần cuối invoiceId.
   * Với tài khoản PARENT, truyền thêm ID phụ huynh đang đăng nhập sang service.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Post("create-url")
  @ApiOperation({
    summary:
      "Khởi tạo link thanh toán VNPAY kèm chữ ký HMAC-SHA512 (UC62 - Pay Snack Service Fee Online)",
  })
  @Roles("PARENT", "SUPER_ADMIN", "SCHOOL_MANAGEMENT", "PRINCIPAL")
  async createPaymentUrl(
    @Body() body: CreatePaymentUrlDto,
    @Req() req: Request,
    @CurrentUser() user: any,
  ) {
    const ipAddr =
      (req.headers["x-forwarded-for"] as string) ||
      req.socket.remoteAddress ||
      "127.0.0.1";

    const resolvedRegId =
      body.registrationId ||
      (body.invoiceId ? Number(String(body.invoiceId).split("-").pop()) : 1) ||
      1;

    return this.vnpayService.createPaymentUrl({
      registrationId: Number(resolvedRegId),
      orderInfo: body.orderInfo,
      ipAddr,
      parentId: user?.roles?.includes("PARENT") ? Number(user.sub ?? user.id) : undefined,
    });
  }

  /**
   * GET /payments/vnpay-ipn: KÊNH 1: Server-to-Server IPN Webhook từ máy chủ VNPAY (Ngầm, Bảo mật & Idempotent).
   * @param query Bộ lọc trong query string.
   * Chuyển xử lý sang VnpayService.handleIpn() và trả kết quả cho client.
   */
  @Public()
  @Get("vnpay-ipn")
  @ApiOperation({
    summary:
      "KÊNH 1: Server-to-Server IPN Webhook từ máy chủ VNPAY (Ngầm, Bảo mật & Idempotent)",
  })
  async vnpayIpn(@Query() query: Record<string, string>) {
    return this.vnpayService.handleIpn(query);
  }

  /**
   * GET /payments/vnpay-return: KÊNH 2: Xác thực kết quả giao dịch khi trình duyệt phụ huynh quay lại từ VNPAY.
   * @param query Bộ lọc trong query string.
   * Chuyển xử lý sang VnpayService.verifyReturnUrl() và trả kết quả cho client.
   */
  @Public()
  @Get("vnpay-return")
  @ApiOperation({
    summary:
      "KÊNH 2: Xác thực kết quả giao dịch khi trình duyệt phụ huynh quay lại từ VNPAY",
  })
  async vnpayReturn(@Query() query: Record<string, string>) {
    return this.vnpayService.verifyReturnUrl(query);
  }

  /**
   * GET /payments/my-invoices: Lấy danh sách các hóa đơn tiền ăn xế của con dành cho Phụ huynh.
   * @param userId Trường sub của tài khoản đã xác thực (tùy chọn).
   * Chuyển xử lý sang VnpayService.getMyInvoices() và trả kết quả cho client.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Get("my-invoices")
  @ApiOperation({
    summary: "Lấy danh sách các hóa đơn tiền ăn xế của con dành cho Phụ huynh",
  })
  @Roles(
    "PARENT",
    "SUPER_ADMIN",
    "PRINCIPAL",
    "SCHOOL_MANAGER",
    "SCHOOL_MANAGEMENT",
    "TEACHER",
  )
  async getMyInvoices(@CurrentUser("sub") userId?: number) {
    return this.vnpayService.getMyInvoices(userId);
  }

  /**
   * GET /payments/receipt/:registrationId: Xuất chi tiết biên lai thu tiền điện tử (Electronic Receipt).
   * @param registrationId Giá trị registrationId trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * @param userId Trường id của tài khoản đã xác thực (tùy chọn).
   * Chuyển xử lý sang VnpayService.getElectronicReceipt() và trả kết quả cho client.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Get("receipt/:registrationId")
  @ApiOperation({
    summary: "Xuất chi tiết biên lai thu tiền điện tử (Electronic Receipt)",
  })
  @Roles("PARENT", "SUPER_ADMIN", "SCHOOL_MANAGEMENT", "PRINCIPAL")
  async getReceipt(
    @Param("registrationId", ParseIntPipe) registrationId: number,
    @CurrentUser("id") userId?: number,
  ) {
    return this.vnpayService.getElectronicReceipt(registrationId, userId);
  }

  /**
   * GET /payments/invoices: Lấy danh sách các hóa đơn tiền ăn xế toàn trường (BGH).
   * Chuyển xử lý sang VnpayService.getInvoices() và trả kết quả cho client.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Get("invoices")
  @ApiOperation({
    summary: "Lấy danh sách các hóa đơn tiền ăn xế toàn trường (BGH)",
  })
  @Roles("SCHOOL_MANAGEMENT", "PRINCIPAL", "SUPER_ADMIN")
  async getInvoices() {
    return this.vnpayService.getInvoices();
  }

  /**
   * POST /payments/invoices: Tạo mới phiếu đăng ký / hóa đơn ăn xế.
   * @param body Dữ liệu body JSON.
   * @param user Thông tin tài khoản đã xác thực.
   * Chuyển xử lý sang VnpayService.createInvoice() và trả kết quả cho client.
   * Với tài khoản PARENT, parentId được lấy từ người đăng nhập thay cho giá trị trong body.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Post("invoices")
  @ApiOperation({ summary: "Tạo mới phiếu đăng ký / hóa đơn ăn xế" })
  @Roles("SCHOOL_MANAGEMENT", "PRINCIPAL", "SUPER_ADMIN", "PARENT")
  async createInvoice(@Body() body: any, @CurrentUser() user: any) {
    return this.vnpayService.createInvoice({
      ...body,
      parentId: user?.roles?.includes("PARENT") ? Number(user.sub ?? user.id) : body.parentId,
    });
  }

  /**
   * POST /payments/invoices/:id/remind: Gửi tin nhắn nhắc phụ huynh đóng phí ăn xế.
   * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
   * Chuyển xử lý sang VnpayService.remindInvoice() và trả kết quả cho client.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Post("invoices/:id/remind")
  @ApiOperation({ summary: "Gửi tin nhắn nhắc phụ huynh đóng phí ăn xế" })
  @Roles("SCHOOL_MANAGEMENT", "PRINCIPAL", "SUPER_ADMIN")
  async remindInvoice(@Param("id", ParseIntPipe) id: number) {
    return this.vnpayService.remindInvoice(id);
  }

  /**
   * POST /payments/invoices/batch-remind: Gửi nhắc phí hàng loạt cho các phụ huynh chưa thanh toán.
   * Chuyển xử lý sang VnpayService.batchRemind() và trả kết quả cho client.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Post("invoices/batch-remind")
  @ApiOperation({
    summary: "Gửi nhắc phí hàng loạt cho các phụ huynh chưa thanh toán",
  })
  @Roles("SCHOOL_MANAGEMENT", "PRINCIPAL", "SUPER_ADMIN")
  async batchRemind() {
    return this.vnpayService.batchRemind();
  }
}
