import {
  Injectable,
  Optional,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { InspectionRecord } from "../../inspections/entities/inspection-record.entity";
import { InspectionImage } from "../../inspections/entities/inspection-image.entity";
import { InspectionSampleItem } from "../../inspections/entities/inspection-sample-item.entity";
import { StaffProfile } from "../../users/entities/staff-profile.entity";
import { User } from "../../auth/entities/user.entity";
import { MealCoordinationNote } from "../../attendance/entities/meal-coordination-note.entity";
import { AuditLogsService } from "../../audit-logs/services/audit-logs.service";
import { SignMonthlyLogDto } from "../dto/sign-monthly-log.dto";
import { NutritionistReviewDto } from "../dto/nutritionist-review.dto";
import { SuspendSupplierDto } from "../dto/suspend-supplier.dto";
import { readState } from "../../../common/utils/persisted-state";

export interface SupplierItem {
  id: number;
  name: string;
  certType: string;
  certNumber: string;
  expiryDate: string;
  totalDeliveries: number;
  rejectedDeliveries: number;
  rejectRate: number;
  isRejectRateAlert: boolean;
  status: "ACTIVE" | "SUSPENDED" | "UNDER_REVIEW";
  suspensionReason?: string;
}

export interface SensoryIncidentItem {
  id: number;
  date: string;
  dishName: string;
  incident: string;
  chemicalOrAdditiveSafetyStatus: string;
  nutritionistAnalysis: string;
  actionTaken: string;
  reviewer: string;
  status: "RESOLVED" | "PENDING";
}

export interface FoodSafetyComplianceReportResponse {
  schoolName: string;
  reportPeriod: {
    month: number;
    year: number;
    targetDate: string;
  };
  overallComplianceRate: number;
  zeroDefectStatus: "COMPLIANT" | "WARNING" | "ALERT" | "RECORDED" | "NO_DATA";
  inspection3Step: {
    decisionStandard: string;
    step1RawCheckCompliance: number;
    step2ProcessingCheckCompliance: number;
    step3PreServingCheckCompliance: number;
    photoAuditTrail: {
      totalInspections: number;
      withPhotoCount: number;
      photoRate: number;
      isCompliant: boolean;
      threshold: number;
      samplePhotos: Array<{
        step: string;
        title: string;
        imageUrl: string;
        uploadedAt: string;
      }>;
    };
    temperatureLogs: {
      avgTransportTempC: number;
      avgCoreBoilingTempC: number;
      minCoreBoilingTempC: number;
      coreTempThreshold: number;
    };
  };
  sampleRetention24h: {
    decisionStandard: string;
    sampleRetentionRate: number;
    totalSamplesStored: number;
    standardWeightComplianceRate: number;
    fridgeStatus: {
      unitName: string;
      currentTempC: number;
      standardRange: string;
      powerStatus: "NORMAL" | "OUTAGE" | "UNKNOWN";
      isRedAlert: boolean;
      hourlyTrend: Array<{ hour: string; tempC: number; status: string }>;
    };
    samples: Array<{
      id: string;
      sampleCode: string;
      dishName: string;
      weightOrVolume: string;
      isStandard: boolean;
      storedAt: string;
      disposeAt: string;
      status: string;
      tripartiteSigned: boolean;
    }>;
  };
  legalAndCertificates: {
    schoolFoodSafetyLicense: {
      certNumber: string;
      issueDate: string;
      expiryDate: string;
      status: "VALID" | "EXPIRING_SOON" | "EXPIRED" | "UNKNOWN";
      daysRemaining: number;
    };
    staffCompliance: {
      totalKitchenStaff: number;
      validHealthCardCount: number;
      healthCardRate: number;
      validTrainingCertCount: number;
      trainingCertRate: number;
      expiringWithin30Days: number;
      staffList: Array<{
        name: string;
        position: string;
        greenHealthCardExpiry: string;
        trainingCertExpiry: string;
        status: string;
      }>;
    };
    waterTesting: {
      lastTestDate: string;
      standardRef: string;
      drinkingWaterResult: string;
      domesticWaterResult: string;
      nextTestDueDate: string;
      labName: string;
      isCompliant: boolean;
    };
    suppliers: SupplierItem[];
  };
  sensoryIncidentReviews: SensoryIncidentItem[];
  monthlySignatures: {
    isSigned: boolean;
    signedBy?: string;
    signedRole?: string;
    signedAt?: string;
    notes?: string;
  };
}

@Injectable()
export class FoodSafetyService {
  // In-memory persistent state for suppliers and sensory reviews
  private suppliersState: SupplierItem[] = [];

  private sensoryReviewsState: SensoryIncidentItem[] = [];

  private monthlySignatureState: Record<string, any> = {};

  constructor(
    @InjectRepository(InspectionRecord)
    private readonly inspectionRepo: Repository<InspectionRecord>,
    @InjectRepository(InspectionImage)
    private readonly imageRepo: Repository<InspectionImage>,
    @InjectRepository(InspectionSampleItem)
    private readonly sampleRepo: Repository<InspectionSampleItem>,
    @InjectRepository(StaffProfile)
    private readonly staffProfileRepo: Repository<StaffProfile>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(MealCoordinationNote)
    private readonly mealNoteRepo: Repository<MealCoordinationNote>,
    @Optional() private readonly auditLogsService?: AuditLogsService,
  ) {}

  private getTodayDateStr(): string {
    return new Date().toISOString().split("T")[0];
  }

  /**
   * UC95: Xem Báo Cáo Tuân Thủ An Toàn Thực Phẩm (View Food Safety Compliance Report)
   */
  async getFoodSafetyComplianceReport(
    targetDate?: string,
    targetMonth?: number,
    targetYear?: number,
    schoolId?: number,
  ): Promise<FoodSafetyComplianceReportResponse> {
    const date = targetDate || this.getTodayDateStr(),
      year = targetYear || Number(date.slice(0, 4)),
      month = targetMonth || Number(date.slice(5, 7)),
      monthKey = year + "-" + String(month).padStart(2, "0");
    const inspections = (
      await this.inspectionRepo.find({
        relations: ["inspector", "images"],
        order: { date: "DESC" },
      })
    ).filter((r) => r.date.startsWith(monthKey));
    const totalInspections = inspections.length,
      withPhotoCount = inspections.filter((r) => r.images?.length).length;
    const rate = (a: number, b: number) =>
      b ? Math.round((a / b) * 1000) / 10 : null;
    const samplePhotos = inspections
      .filter((r) => r.date === date)
      .flatMap((r) =>
        (r.images || []).map((image) => ({
          step: r.inspectionStep,
          title: r.note || r.inspectionStep,
          imageUrl: image.imageUrl,
          uploadedAt: image.uploadedAt?.toISOString() || null,
        })),
      );
    const samples = await this.sampleRepo.find({
      where: { date },
      order: { storedAt: "ASC" },
    });
    const sampleList = samples.map((s) => ({
      id: String(s.id),
      sampleCode: s.sampleCode,
      dishName: s.dishName,
      weightOrVolume:
        s.sampleWeightG == null ? "Chưa ghi nhận" : s.sampleWeightG + "g",
      isStandard:
        s.sampleWeightG == null ? null : Number(s.sampleWeightG) >= 100,
      storedAt: s.storedAt?.toISOString() || null,
      disposeAt: s.disposeAt?.toISOString() || null,
      status: s.status,
      tripartiteSigned: false,
    }));
    const compliance = (step: string) => {
      const list = inspections.filter((r) => r.inspectionStep.includes(step));
      return rate(list.filter((r) => r.result === "PASS").length, list.length);
    };
    const schools = await this.inspectionRepo.manager.query(
      "SELECT name FROM schools WHERE id = $1",
      [schoolId || 1],
    );
    const profile: any = await readState(
      this.inspectionRepo.manager,
      "school-profile:1",
      {},
    );
    const retentionHours =
      Number(profile?.operationalSettings?.foodRetentionHours) || 24;

    return {
      schoolName: schools[0]?.name || "",
      reportPeriod: { month, year, targetDate: date },
      overallComplianceRate: rate(
        inspections.filter((r) => r.result === "PASS").length,
        totalInspections,
      ),
      zeroDefectStatus: totalInspections ? "RECORDED" : "NO_DATA",
      inspection3Step: {
        decisionStandard: "Kiểm thực 3 bước",
        step1RawCheckCompliance: compliance("STEP_1"),
        step2ProcessingCheckCompliance: compliance("STEP_2"),
        step3PreServingCheckCompliance: compliance("STEP_3"),
        photoAuditTrail: {
          totalInspections,
          withPhotoCount,
          photoRate: rate(withPhotoCount, totalInspections),
          isCompliant: null,
          threshold: null,
          samplePhotos,
        },
        temperatureLogs: {
          avgTransportTempC: null,
          avgCoreBoilingTempC: null,
          minCoreBoilingTempC: null,
          coreTempThreshold: null,
        },
      },
      sampleRetention24h: {
        decisionStandard: `Lưu mẫu ${retentionHours} giờ`,
        sampleRetentionRate: null,
        totalSamplesStored: samples.length,
        standardWeightComplianceRate: rate(
          sampleList.filter((s) => s.isStandard).length,
          samples.length,
        ),
        fridgeStatus: {
          unitName: samples[0]?.fridgeUnit || "Chưa khai báo",
          currentTempC: null,
          standardRange: "Chưa cấu hình",
          powerStatus: "UNKNOWN",
          isRedAlert: false,
          hourlyTrend: [],
        },
        samples: sampleList,
      },
      legalAndCertificates: {
        schoolFoodSafetyLicense: {
          certNumber: null,
          issueDate: null,
          expiryDate: null,
          status: "UNKNOWN",
          daysRemaining: null,
        },
        staffCompliance: {
          totalKitchenStaff: 0,
          validHealthCardCount: 0,
          healthCardRate: null,
          validTrainingCertCount: 0,
          trainingCertRate: null,
          expiringWithin30Days: 0,
          staffList: [],
        },
        waterTesting: {
          lastTestDate: null,
          standardRef: null,
          drinkingWaterResult: "Chưa có kết quả",
          domesticWaterResult: "Chưa có kết quả",
          nextTestDueDate: null,
          labName: null,
          isCompliant: null,
        },
        suppliers: [],
      },
      sensoryIncidentReviews: [],
      monthlySignatures: { isSigned: false },
    };
  }

  /**
   * School Manager: Ký phê duyệt sổ kiểm thực điện tử định kỳ
   */
  async signMonthlyLog(dto: SignMonthlyLogDto, userId: number) {
    const monthKey = `${dto.year}-${String(dto.month).padStart(2, "0")}`;
    this.monthlySignatureState[monthKey] = {
      isSigned: true,
      signedBy: dto.signerName,
      signedRole: dto.signerRole,
      signedAt: new Date().toISOString(),
      notes: dto.notes || "Phê duyệt sổ kiểm thực 3 bước và hồ sơ lưu mẫu",
    };

    this.auditLogsService
      ?.logAction({
        tenantId: 1,
        userId,
        userName: dto.signerName,
        userRole: dto.signerRole,
        action: "SIGN_MONTHLY_FOOD_SAFETY_LOG",
        targetEntity: "FOOD_SAFETY_MONTHLY_LOG",
        targetId: monthKey,
        ipAddress: "127.0.0.1",
        details: {
          month: dto.month,
          year: dto.year,
          signerName: dto.signerName,
        },
      })
      .catch(() => {});

    return {
      success: true,
      message: `Đã ký duyệt thành công sổ kiểm thực điện tử tháng ${dto.month}/${dto.year}`,
      signedAt: new Date().toISOString(),
    };
  }

  /**
   * Nutritionist: Ghi nhận phân tích chuyên môn về sự cố cảm quan hoặc phụ gia
   */
  async submitNutritionistReview(dto: NutritionistReviewDto, userId: number) {
    const newReview: SensoryIncidentItem = {
      id: Date.now(),
      date: dto.date,
      dishName: dto.dishName,
      incident: dto.incidentDescription,
      chemicalOrAdditiveSafetyStatus:
        dto.chemicalOrAdditiveSafetyStatus || "AN TOÀN (Đạt chuẩn thành phần)",
      nutritionistAnalysis: dto.nutritionistAnalysis,
      actionTaken: dto.actionTaken,
      reviewer: dto.reviewerName,
      status: "RESOLVED",
    };

    this.sensoryReviewsState.unshift(newReview);

    // Save note for cross-reference
    const note = this.mealNoteRepo.create({
      date: dto.date,
      fromUserId: userId,
      content: `[Nutritionist Review - ${dto.dishName}] Sự cố: ${dto.incidentDescription}. Phân tích: ${dto.nutritionistAnalysis}. Xử lý: ${dto.actionTaken}`,
    });
    await this.mealNoteRepo.save(note).catch(() => {});

    this.auditLogsService
      ?.logAction({
        tenantId: 1,
        userId,
        userName: dto.reviewerName,
        userRole: "NUTRITIONIST",
        action: "SUBMIT_NUTRITIONIST_SAFETY_REVIEW",
        targetEntity: "SENSORY_INCIDENT_REVIEW",
        targetId: String(newReview.id),
        ipAddress: "127.0.0.1",
        details: {
          dishName: dto.dishName,
          incident: dto.incidentDescription,
        },
      })
      .catch(() => {});

    return {
      success: true,
      message:
        "Đã lưu phân tích chuyên môn dinh dưỡng và đề xuất điều chỉnh thành công",
      review: newReview,
    };
  }

  /**
   * School Manager: Đình chỉ nhà cung cấp khi tỷ lệ Reject Rate > 2%
   */
  async suspendSupplier(dto: SuspendSupplierDto, userId: number) {
    const supplier = this.suppliersState.find((s) => s.id === dto.supplierId);
    if (!supplier) {
      throw new NotFoundException(
        `Không tìm thấy nhà cung cấp với ID ${dto.supplierId}`,
      );
    }

    supplier.status = "SUSPENDED";
    supplier.suspensionReason = dto.reason;

    this.auditLogsService
      ?.logAction({
        tenantId: 1,
        userId,
        userName: dto.decisionBy,
        userRole: "SCHOOL_MANAGER",
        action: "SUSPEND_FOOD_SUPPLIER",
        targetEntity: "FOOD_SUPPLIER",
        targetId: String(supplier.id),
        ipAddress: "127.0.0.1",
        details: {
          supplierName: supplier.name,
          rejectRate: supplier.rejectRate,
          reason: dto.reason,
        },
      })
      .catch(() => {});

    return {
      success: true,
      message: `Đã ban hành lệnh đình chỉ tạm thời đối với nhà cung cấp ${supplier.name}`,
      supplier,
    };
  }

  /**
   * Xuất bộ hồ sơ thanh tra an toàn thực phẩm đầy đủ phục vụ đoàn thanh tra liên ngành
   */
  async exportComplianceDossier(
    targetDate?: string,
    month?: number,
    year?: number,
  ) {
    const report = await this.getFoodSafetyComplianceReport(
      targetDate,
      month,
      year,
    );

    return {
      dossierTitle: "HỒ SƠ PHÁP LÝ & SỔ KIỂM THỰC 3 BƯỚC AN TOÀN THỰC PHẨM",
      legalFramework: [
        "Quyết định 1246/QĐ-BYT ngày 31/03/2017 của Bộ Y Tế",
        "Luật An toàn thực phẩm số 55/2010/QH12",
        "Nghị định 15/2018/NĐ-CP của Chính phủ",
        "Quy chuẩn QCVN 01-1:2018/BYT về chất lượng nước sạch",
      ],
      organization: report.schoolName,
      exportedAt: new Date().toISOString(),
      report,
    };
  }
}
