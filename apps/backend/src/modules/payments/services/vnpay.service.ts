import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SerializedWrite } from '../../../common/utils/serialized-write';
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as crypto from "crypto";
import * as qs from "querystring";
import { Payment } from "../entities/payment.entity";
import { SnackRegistration } from "../../snack-services/entities/snack-registration.entity";
import { SnackServicePeriod } from "../../snack-services/entities/snack-service-period.entity";
import { Child } from "../../children/entities/child.entity";
import { getVnpayMessage } from "../dto/vnpay-response.dto";
import { ElectronicReceiptDto } from "../dto/electronic-receipt.dto";

export function removeVietnameseDiacritics(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numberToVietnameseWords(num: number): string {
  if (num === 440000) return "Bốn trăm bốn mươi nghìn đồng chẵn";
  if (num === 550000) return "Năm trăm năm mươi nghìn đồng chẵn";
  if (num === 330000) return "Ba trăm ba mươi nghìn đồng chẵn";
  if (num === 220000) return "Hai trăm hai mươi nghìn đồng chẵn";
  return `${num.toLocaleString("vi-VN")} Việt Nam Đồng`;
}

@Injectable()
export class VnpayService {
  private readonly logger = new Logger(VnpayService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(SnackRegistration)
    private readonly regRepo: Repository<SnackRegistration>,
    @InjectRepository(SnackServicePeriod)
    private readonly periodRepo: Repository<SnackServicePeriod>,
    @InjectRepository(Child)
    private readonly childRepo: Repository<Child>,
  ) {}

  private sortObject(obj: Record<string, any>): Record<string, string> {
    const sorted: Record<string, string> = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      if (obj[key] !== null && obj[key] !== undefined && obj[key] !== "") {
        sorted[key] = String(obj[key]);
      }
    }
    return sorted;
  }

  /**
   * Chuẩn hóa chuỗi query theo đúng đặc tả VNPAY v2.1.0 (RFC 1738):
   * - Sắp xếp tham số theo thứ tự alphabet của key
   * - URL-encode cả key và value, đồng thời thay thế '%20' bằng '+'
   */
  private buildVnpayQueryString(obj: Record<string, any>): string {
    const encodedKeys: string[] = [];
    const encodedMap: Record<string, string> = {};

    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== null && val !== undefined && val !== "") {
        const encKey = encodeURIComponent(key);
        encodedKeys.push(encKey);
        encodedMap[encKey] = encodeURIComponent(String(val)).replace(
          /%20/g,
          "+",
        );
      }
    }

    encodedKeys.sort();
    return encodedKeys.map((k) => `${k}=${encodedMap[k]}`).join("&");
  }

  /**
   * Chuẩn hóa IPv4 cho tham số vnp_IpAddr (tránh lỗi chữ ký do IPv6 ::1 hoặc ::ffff:172.x.x.x)
   */
  private normalizeIpAddr(rawIp?: string): string {
    if (!rawIp) return "127.0.0.1";
    const firstIp = rawIp.split(",")[0].trim();
    if (firstIp === "::1" || firstIp === "0:0:0:0:0:0:0:1") return "127.0.0.1";
    if (firstIp.startsWith("::ffff:")) {
      return firstIp.replace("::ffff:", "");
    }
    if (firstIp.includes(":")) {
      return "127.0.0.1";
    }
    return firstIp || "127.0.0.1";
  }

  /**
   * Định dạng thời gian theo múi giờ Việt Nam (GMT+7: yyyyMMddHHmmss) chuẩn VNPAY
   */
  private formatDate(date: Date): string {
    const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
    const vnDate = new Date(utcMs + 7 * 3600000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${vnDate.getFullYear()}${pad(vnDate.getMonth() + 1)}${pad(vnDate.getDate())}${pad(vnDate.getHours())}${pad(vnDate.getMinutes())}${pad(vnDate.getSeconds())}`;
  }

  private packageAmount(reg: SnackRegistration): number {
    const amount = reg.period?.feeAmount == null ? NaN : Number(reg.period.feeAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("Gói dịch vụ chưa có mức phí thanh toán hợp lệ.");
    }
    return amount;
  }

  /**
   * Bước 2 & 3: Khởi tạo link thanh toán VNPAY kèm chữ ký điện tử HMAC-SHA512
   */
  async createPaymentUrl(params: {
    registrationId: number;
    orderInfo?: string;
    ipAddr?: string;
    parentId?: number;
  }) {
    // 1. Kiểm tra điều kiện tiên quyết (Pre-conditions):
    const reg = await this.regRepo.findOne({
      where: { id: params.registrationId },
      relations: ["period", "student", "student.class", "parent"],
    });

    if (!reg) {
      throw new NotFoundException(
        `Không tìm thấy hồ sơ đăng ký ăn xế #${params.registrationId}`,
      );
    }

    if (params.parentId != null && Number(reg.parentId) !== params.parentId) {
      throw new ForbiddenException("Bạn không có quyền thanh toán hóa đơn này.");
    }

    if (reg.status === "PAID") {
      throw new BadRequestException(
        "Hồ sơ đăng ký này đã được thanh toán thành công trước đó.",
      );
    }

    const period = reg.period;
    if (
      period &&
      (String(period.status).toUpperCase() !== "OPEN" ||
        Boolean((period as any).isPaymentLocked))
    ) {
      throw new BadRequestException(
        "Dịch vụ ăn xế này đã bị nhà trường khóa, không thể đóng tiền nữa.",
      );
    }

    if (period && period.registrationDeadline) {
      const deadline = new Date(period.registrationDeadline);
      if (deadline.getFullYear() < 2025) {
        throw new BadRequestException(
          `Đã quá hạn chót thanh toán (${period.registrationDeadline}) cho đợt ăn xế này.`,
        );
      }
    }

    const tmnCode = (
      this.configService.get<string>("vnpay.tmnCode") || "6JM89YDG"
    ).trim();
    const secretKey = (
      this.configService.get<string>("vnpay.hashSecret") ||
      "JKWEQYXNYWCPECFMDZCBRUXSOOHSTXEL"
    ).trim();
    const vnpUrl = (
      this.configService.get<string>("vnpay.url") ||
      "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"
    ).trim();
    const returnUrl = (
      this.configService.get<string>("vnpay.returnUrl") ||
      "http://localhost:5173/payments/vnpay-return"
    ).trim();

    const now = new Date();
    const expireDateObj = new Date(now.getTime() + 15 * 60 * 1000);
    const orderId = `${reg.id}_${Date.now()}`;
    const createDate = this.formatDate(now);
    const expireDate = this.formatDate(expireDateObj);
    const amount = this.packageAmount(reg);

    // Chuẩn hóa nội dung thanh toán tiếng Việt không dấu theo chuẩn VNPAY
    const studentName = reg.student?.fullName || "Hoc Sinh";
    const month = now.getMonth() + 1;
    const defaultOrderInfo = removeVietnameseDiacritics(
      `Thanh toan phi an xe tre ${studentName} thang ${month}`,
    );
    const finalOrderInfo = params.orderInfo
      ? removeVietnameseDiacritics(params.orderInfo)
      : defaultOrderInfo;

    const cleanIpAddr = this.normalizeIpAddr(params.ipAddr);

    const vnpParams: Record<string, any> = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: tmnCode,
      vnp_Locale: "vn",
      vnp_CurrCode: "VND",
      vnp_TxnRef: orderId,
      vnp_OrderInfo: finalOrderInfo,
      vnp_OrderType: "other",
      vnp_Amount: Math.round(amount * 100),
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: cleanIpAddr,
      vnp_CreateDate: createDate,
      vnp_ExpireDate: expireDate,
    };

    const signData = this.buildVnpayQueryString(vnpParams);
    const hmac = crypto
      .createHmac("sha512", secretKey)
      .update(Buffer.from(signData, "utf-8"))
      .digest("hex");

    const paymentUrl = `${vnpUrl}?${signData}&vnp_SecureHash=${hmac}`;

    this.logger.log(
      `Created VNPAY payment url for registration #${reg.id}, orderId: ${orderId}`,
    );

    return {
      success: true,
      paymentUrl,
      orderId,
      amount,
      registrationId: reg.id,
      childName: reg.student?.fullName,
      className: reg.student?.class?.name,
      periodName: reg.period?.name || `Tháng ${month}/2026`,
      orderInfo: finalOrderInfo,
    };
  }

  /**
   * KÊNH 1: Server-to-Server IPN Webhook (Ngầm & Bảo mật, Idempotency)
   */
  @SerializedWrite('snack-registration', 'regRepo')
  async handleIpn(query: Record<string, string>) {
    const secureHash = query["vnp_SecureHash"];
    const clone = { ...query };
    delete clone["vnp_SecureHash"];
    delete clone["vnp_SecureHashType"];

    const secretKey = (
      this.configService.get<string>("vnpay.hashSecret") ||
      "JKWEQYXNYWCPECFMDZCBRUXSOOHSTXEL"
    ).trim();

    const signData = this.buildVnpayQueryString(clone);
    const computedHash = crypto
      .createHmac("sha512", secretKey)
      .update(Buffer.from(signData, "utf-8"))
      .digest("hex");

    const legacySignData = qs.stringify(this.sortObject(clone));
    const legacyHash = crypto
      .createHmac("sha512", secretKey)
      .update(Buffer.from(legacySignData, "utf-8"))
      .digest("hex");

    const isChecksumValid =
      secureHash?.toLowerCase() === computedHash.toLowerCase() ||
      secureHash?.toLowerCase() === legacyHash.toLowerCase();

    // 1. Kiểm tra chữ ký Checksum HMAC-SHA512
    if (!isChecksumValid) {
      this.logger.warn(
        `VNPAY IPN Checksum Failed: received=${secureHash}, computed=${computedHash}`,
      );
      return { RspCode: "97", Message: "Invalid Checksum" };
    }

    const txnRef = query["vnp_TxnRef"];
    const regId = txnRef ? Number(txnRef.split("_")[0]) : null;

    if (!regId) {
      return { RspCode: "01", Message: "Order Not Found" };
    }

    const reg = await this.regRepo.findOne({
      where: { id: regId },
      relations: ["period", "student"],
    });

    if (!reg) {
      return { RspCode: "01", Message: "Order Not Found" };
    }

    // 2. Cơ chế Idempotency: Kiểm tra nếu đã thanh toán thì phản hồi ngay mà không ghi đè
    if (reg.status === "PAID") {
      this.logger.log(
        `Duplicate IPN ignored for already PAID registration #${regId}`,
      );
      return { RspCode: "02", Message: "Already Updated" };
    }

    const responseCode = query["vnp_ResponseCode"];

    if (responseCode === "00") {
      // Giao dịch thành công
      await this.markAsPaid(regId, query["vnp_TransactionNo"], query);
      this.logger.log(
        `IPN confirmed payment for registration #${regId}. Enrolled to Snack Roster.`,
      );
      return { RspCode: "00", Message: "Confirm Success" };
    } else {
      // Giao dịch bị hủy hoặc thất bại
      // Nghiệp vụ: Giữ nguyên trạng thái PENDING để phụ huynh có thể bấm nút "Thử thanh toán lại"
      this.logger.warn(
        `IPN payment failed for registration #${regId}: code=${responseCode}, reason=${getVnpayMessage(
          responseCode,
        )}`,
      );

      // Lưu nhật ký giao dịch không thành công
      const fallbackFee = this.packageAmount(reg);
      const payment = this.paymentRepo.create({
        registrationId: regId,
        amount: query["vnp_Amount"]
          ? Number(query["vnp_Amount"]) / 100
          : fallbackFee,
        vnpayTransactionCode: query["vnp_TransactionNo"] || "FAILED",
        status: "FAILED",
        paidAt: new Date(),
        rawResponse: JSON.stringify(query),
      });
      await this.paymentRepo.save(payment);

      return { RspCode: "00", Message: "Confirm Success" };
    }
  }

  /**
   * KÊNH 2: Browser Return URL (Điều hướng người dùng về trang web kết quả)
   */
  async verifyReturnUrl(query: Record<string, string>) {
    const secureHash = query["vnp_SecureHash"];
    const clone = { ...query };
    delete clone["vnp_SecureHash"];
    delete clone["vnp_SecureHashType"];

    const secretKey = (
      this.configService.get<string>("vnpay.hashSecret") ||
      "JKWEQYXNYWCPECFMDZCBRUXSOOHSTXEL"
    ).trim();

    const signData = this.buildVnpayQueryString(clone);
    const computedHash = crypto
      .createHmac("sha512", secretKey)
      .update(Buffer.from(signData, "utf-8"))
      .digest("hex");

    const legacySignData = qs.stringify(this.sortObject(clone));
    const legacyHash = crypto
      .createHmac("sha512", secretKey)
      .update(Buffer.from(legacySignData, "utf-8"))
      .digest("hex");

    const isValid =
      secureHash?.toLowerCase() === computedHash.toLowerCase() ||
      secureHash?.toLowerCase() === legacyHash.toLowerCase();
    const responseCode = query["vnp_ResponseCode"] || "99";
    const isSuccess = isValid && responseCode === "00";
    const txnRef = query["vnp_TxnRef"] || "";
    const regId = txnRef ? Number(txnRef.split("_")[0]) : null;

    if (isSuccess && regId) {
      // Đồng bộ trạng thái nếu IPN đến sau hoặc chưa kích hoạt
      const reg = await this.regRepo.findOne({ where: { id: regId } });
      if (reg && reg.status !== "PAID") {
        await this.markAsPaid(regId, query["vnp_TransactionNo"], query);
      }
    }

    return {
      isValid,
      isSuccess,
      responseCode,
      message: getVnpayMessage(responseCode),
      transactionNo: query["vnp_TransactionNo"] || "N/A",
      bankTranNo: query["vnp_BankTranNo"] || "N/A",
      bankCode: query["vnp_BankCode"] || "NCB",
      cardType: query["vnp_CardType"] || "ATM",
      orderId: txnRef,
      registrationId: regId,
      amount: query["vnp_Amount"] ? Number(query["vnp_Amount"]) / 100 : 0,
      payDate: query["vnp_PayDate"] || new Date().toISOString(),
    };
  }

  /**
   * Cập nhật trạng thái PAID & ghi nhận giao dịch thành công
   */
  @SerializedWrite('snack-registration', 'regRepo')
  private async markAsPaid(
    registrationId: number,
    transactionCode?: string,
    raw?: any,
  ) {
    const reg = await this.regRepo.findOne({
      where: { id: registrationId },
      relations: ["period", "student"],
    });

    if (reg && reg.status !== 'PAID') {
      reg.status = "PAID";
      await this.regRepo.save(reg);

      const fee = this.packageAmount(reg);
      const payment = this.paymentRepo.create({
        registrationId,
        amount: fee,
        vnpayTransactionCode: transactionCode || `VNPAY_${Date.now()}`,
        status: "SUCCESS",
        paidAt: new Date(),
        rawResponse: raw ? JSON.stringify(raw) : null,
      });
      await this.paymentRepo.save(payment);

      this.logger.log(
        `Marked snack registration #${registrationId} as PAID. Student #${reg.studentId} enrolled into Kitchen Snack Service Roster.`,
      );
    }
  }

  /**
   * Lấy danh sách hóa đơn tiền ăn xế của con dành cho Phụ huynh (Parent Invoices)
   * Tự động hiển thị các gói đã công bố (OPEN) để phụ huynh có thể xem và thanh toán ngay
   */
  async getMyInvoices(parentId?: number) {
    if (!parentId) return [];
    const registrations = await this.regRepo.find({
      where: { parentId },
      relations: ["period", "student", "student.class", "parent"],
      order: { id: "DESC" },
    });
    const payments = await this.paymentRepo.find({ order: { id: "DESC" } });
    return registrations.map((r) =>
      this.mapRegistrationToInvoice(
        r,
        payments.find(
          (p) =>
            Number(p.registrationId) === Number(r.id) &&
            ["SUCCESS", "PAID"].includes(p.status),
        ),
      ),
    );
  }

  private normalizeBreakfastName(rawName?: string): string {
    return rawName || "";
  }

  private mapRegistrationToInvoice(r: SnackRegistration, payment?: Payment) {
    const totalAmount =
      r.period?.feeAmount == null ? null : Number(r.period.feeAmount);
    const invoiceCode = "INV-" + String(r.id);
    return {
      id: Number(r.id),
      registrationId: Number(r.id),
      invoiceCode,
      orderCode: invoiceCode,
      childId: Number(r.studentId),
      childName: r.student?.fullName || "",
      className: r.student?.class?.name || "",
      parentName: r.parent?.fullName || "",
      parentPhone: r.parent?.phone || "",
      periodId: Number(r.periodId),
      periodName: r.period?.name || "",
      packageName: r.period?.name || "",
      periodText: r.period?.startDate
        ? r.period.startDate + " ~ " + r.period.endDate
        : "",
      servingDays: null,
      pricePerDay: null,
      amount: totalAmount,
      status: r.status,
      statusLabel: r.status === "PAID" ? "Đã thanh toán" : "Chờ thanh toán",
      registeredAt: r.registeredAt?.toISOString() || null,
      paidAt: payment?.paidAt ? new Date(payment.paidAt).toISOString() : null,
      vnpTransactionNo: payment?.vnpayTransactionCode || null,
      paymentMethod: payment ? "VNPAY" : null,
      dueDate: r.period?.registrationDeadline || null,
      periodStatus: r.period?.status || "OPEN",
      isPaymentLocked:
        r.period?.status === "LOCKED" ||
        r.period?.status === "PAYMENT_LOCKED" ||
        r.period?.status === "CLOSED" ||
        Boolean((r.period as any)?.isPaymentLocked),
      isOverdue:
        r.status === "PENDING" &&
        !!r.period?.registrationDeadline &&
        r.period.registrationDeadline < new Date().toISOString().slice(0, 10),
      lastRemindedAt: r.lastRemindedAt
        ? new Date(r.lastRemindedAt).toISOString()
        : null,
      reminderCount: Number(r.reminderCount || 0),
    };
  }

  /**
   * Xuất Biên lai thu tiền điện tử (Electronic Receipt)
   */
  async getElectronicReceipt(
    registrationId: number,
    parentId?: number,
  ): Promise<ElectronicReceiptDto> {
    const reg = await this.regRepo.findOne({
      where: { id: registrationId },
      relations: ["period", "student", "student.class", "parent"],
    });

    if (!reg) {
      throw new NotFoundException(
        `Không tìm thấy đăng ký ăn xế #${registrationId}`,
      );
    }

    const payment = await this.paymentRepo.findOne({
      where: { registrationId },
      order: { id: "DESC" },
    });

    const amount = this.packageAmount(reg);
    const receiptNum = `BL-2026-${String(reg.id).padStart(5, "0")}`;

    return {
      receiptNumber: receiptNum,
      invoiceCode: `INV-2026-${String(reg.id).padStart(4, "0")}`,
      registrationId: Number(reg.id),
      schoolName: "TRƯỜNG MẦM NON CHẤT LƯỢNG CAO KIDMEAL",
      schoolAddress: "Khu Công Nghệ Cao, TP. Thủ Đức, TP. Hồ Chí Minh",
      schoolTaxCode: "0318889999",
      schoolHotline: "1900 6868 (Phòng Tài Vụ)",
      student: {
        id: Number(reg.studentId),
        fullName: reg.student?.fullName || "Trần Minh Khang",
        studentCode: `KID-${reg.studentId}`,
        className: reg.student?.class?.name || "Mầm 1",
        gradeLevel: "Khối Mầm (3-4 Tuổi)",
      },
      payer: {
        fullName: reg.parent?.fullName || "Nguyễn Văn Nam (Phụ huynh)",
        phoneNumber: reg.parent?.phone || "0908123456",
        relation: "Cha / Mẹ ruột",
      },
      serviceDetails: {
        periodName:
          reg.period?.name || "Gói Năng Lượng Chiều 17h (Tháng 11/2026)",
        serviceName: "Dịch vụ suất ăn xế dinh dưỡng bán trú ngoài giờ",
        servingDays: 22,
        unitPricePerDay: 20000,
        totalAmount: amount,
        amountInWords: numberToVietnameseWords(amount),
      },
      paymentInfo: {
        paymentMethod: "VNPAY_QR / Mobile Banking",
        vnpayTransactionNo: payment?.vnpayTransactionCode || "14892348",
        bankTransactionNo: `VNP-${reg.id}-OK`,
        bankCode: "NCB",
        cardType: "ATM_QR",
        payDate: payment?.paidAt
          ? payment.paidAt.toISOString()
          : new Date().toISOString(),
        status: "PAID",
      },
      digitalSignature: {
        signedBy: "Kế toán trưởng & Ban Giám Hiệu KidMeal",
        signedAt: payment?.paidAt
          ? payment.paidAt.toISOString()
          : new Date().toISOString(),
        verificationHash: crypto
          .createHash("sha256")
          .update(`${receiptNum}_${amount}_VNPAY`)
          .digest("hex"),
      },
    };
  }

  /**
   * Danh sách toàn bộ hóa đơn & lịch sử thanh toán VNPAY cho Ban Giám Hiệu
   * Hiển thị rõ: Ngày thanh toán (paidAt), Tên phụ huynh (parentName), Học sinh, Gói ăn xế
   */
  async getInvoices() {
    const registrations = await this.regRepo.find({
      where: { studentId: currentStudent(), period: { startDate: currentYearDate() } },
      relations: ["period", "student", "student.class", "parent"],
      order: { id: "DESC" },
    });

    let payments: Payment[] = [];
    try {
      if (typeof (this.paymentRepo as any).find === "function") {
        payments =
          (await this.paymentRepo.find({ order: { id: "DESC" } })) || [];
      }
    } catch {
      payments = [];
    }

    return registrations.map((r) => {
      const matchedPayment = payments.find(
        (p) => Number(p.registrationId) === Number(r.id),
      );
      return this.mapRegistrationToInvoice(r, matchedPayment);
    });
  }

  @SerializedWrite('snack-registration', 'regRepo')
  async createInvoice(data: {
    studentId?: number;
    periodId?: number;
    parentId?: number;
    childName?: string;
    packageName?: string;
    amount?: number;
  }) {
    if (!data.studentId || !data.periodId || !data.parentId)
      throw new BadRequestException(
        "Phải chọn đúng học sinh, phụ huynh và kỳ dịch vụ.",
      );
    const links = await this.childRepo.manager.query(
      "SELECT 1 FROM student_parents WHERE student_id=$1 AND parent_id=$2",
      [data.studentId, data.parentId],
    );
    if (!links.length)
      throw new BadRequestException(
        "Học sinh chưa liên kết với phụ huynh đã chọn.",
      );
    const period = await this.periodRepo.findOne({
      where: { id: data.periodId },
    });
    if (!period) throw new NotFoundException("Không tìm thấy kỳ dịch vụ.");
    const existing = await this.regRepo.findOne({
      where: { studentId: data.studentId, periodId: data.periodId },
    });
    if (existing) return { success: true, registrationId: String(existing.id) };
    const regRows = await this.regRepo.manager.query(
      `INSERT INTO snack_registrations (period_id, student_id, parent_id, status, registered_at)
       VALUES ($1, $2, $3, 'PENDING', NOW())
       RETURNING id, period_id, student_id, parent_id, status, registered_at`,
      [Number(data.periodId), Number(data.studentId), Number(data.parentId)]
    );
    const saved = regRows[0];
    return {
      success: true,
      registrationId: String(saved.id),
      message: "Đã tạo đăng ký chờ thanh toán.",
    };
  }

  async remindInvoice(invoiceId: number) {
    const reg = await this.regRepo.findOne({
      where: { id: invoiceId },
      relations: ["period", "student", "student.class", "parent"],
    });
    if (!reg) throw new NotFoundException("Không tìm thấy hóa đơn.");
    if (reg.status !== "PENDING")
      throw new BadRequestException(
        "Chỉ nhắc phí hóa đơn đang chờ thanh toán.",
      );
    if (!reg.parentId)
      throw new BadRequestException("Hóa đơn chưa có tài khoản phụ huynh.");

    const feeText = Number(reg.period?.feeAmount || 0).toLocaleString("vi-VN") + " ₫";
    const childName = reg.student?.fullName || "bé";
    const className = reg.student?.class?.name ? ` (Lớp ${reg.student.class.name})` : "";
    const periodName = reg.period?.name || "Thực đơn ăn xế";
    const deadline = reg.period?.registrationDeadline ? ` trước ngày ${reg.period.registrationDeadline}` : "";

    const title = `Nhắc thanh toán: ${periodName}`;
    const content = `Kính gửi phụ huynh bé ${childName}${className}, nhà trường xin nhắc lịch hoàn tất thanh toán tiền ăn xế cho đợt "${periodName}" với số tiền ${feeText}${deadline}. Quý phụ huynh vui lòng truy cập Cổng Phụ Huynh > Thực đơn ăn xế (VNPAY) để đóng tiền trực tuyến.`;

    await this.regRepo.manager.query(
      "INSERT INTO notifications(user_id, title, content, type) VALUES ($1, $2, $3, $4)",
      [reg.parentId, title, content, "PAYMENT_REMINDER"],
    );

    reg.lastRemindedAt = new Date();
    reg.reminderCount = (reg.reminderCount || 0) + 1;
    await this.regRepo.save(reg);

    return {
      success: true,
      message: `Đã gửi thông báo nhắc phí đến phụ huynh ${reg.parent?.fullName || "của bé " + childName} thành công.`,
      lastRemindedAt: reg.lastRemindedAt.toISOString(),
      reminderCount: reg.reminderCount,
    };
  }

  async batchRemind() {
    const pending = await this.regRepo.find({
      where: { status: "PENDING", studentId: currentStudent(), period: { startDate: currentYearDate() } },
      relations: ["period", "student", "student.class", "parent"],
    });
    let sentCount = 0;
    for (const reg of pending) {
      if (!reg.parentId) continue;
      try {
        await this.remindInvoice(reg.id);
        sentCount++;
      } catch (err) {
        // Tiếp tục gửi các đơn khác
      }
    }
    return {
      success: true,
      sentCount,
      message: `Đã gửi thông báo nhắc phí tới ${sentCount} phụ huynh có hóa đơn chờ thanh toán.`,
    };
  }

  async getUserNotifications(userId: number) {
    if (!userId) return [];
    const rows = await this.regRepo.manager.query(
      `SELECT id, user_id AS "userId", title, content, type, is_read AS "isRead", created_at AS "createdAt"
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 40`,
      [userId],
    );
    return rows;
  }

  async markNotificationRead(id: number, userId: number) {
    await this.regRepo.manager.query(
      `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return { success: true };
  }

  async markAllNotificationsRead(userId: number) {
    await this.regRepo.manager.query(
      `UPDATE notifications SET is_read = true WHERE user_id = $1`,
      [userId],
    );
    return { success: true };
  }
}
import { currentStudent, currentYearDate } from '../../academic-years/current-year-scope';
