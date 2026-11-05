import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { InspectionRecord } from "./entities/inspection-record.entity";
import { InspectionSampleItem } from "./entities/inspection-sample-item.entity";
import { InspectionImage } from "./entities/inspection-image.entity";
import { SealSampleDto } from "./dto/seal-sample.dto";
import { KitchenGateway } from "../websocket/kitchen.gateway";

export interface FormattedInspectionSession {
  id: string;
  code: string;
  date: string;
  mealDate: string;
  mealTime: string;
  performerName: string;
  totalPortions: number | null;
  storageTemp: number | null;
  status:
    | "Hoàn tất"
    | "Chưa hoàn tất"
    | "Có cảnh báo"
    | "Chờ bếp tải ảnh"
    | "Chờ duyệt"
    | "Đã duyệt"
    | "Yêu cầu chụp lại";
  approvalStatus?:
    "CHO_BEP_TAI_ANH" | "CHO_DUYET" | "DA_DUYET" | "YEU_CAU_CHUP_LAI";
  approvalStatusLabel?: string;
  rejectionReason?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  kitchenSubmittedAt?: string | null;
  dishes?: string[];
  sealedAt: string | null;
  disposedAt: string | null;
  step1Status: "Đạt chuẩn" | "Không đạt" | "Chưa thực hiện";
  step1Time: string | null;
  step1Note: string;
  step1PhotoUrl: string | null;
  step1Photos?: string[];
  step2Status: "Đạt chuẩn" | "Không đạt" | "Chưa thực hiện";
  step2Time: string | null;
  step2Temperature: number | null;
  step2Note: string;
  step2PhotoUrl: string | null;
  step2Photos?: string[];
  step3Status: "Đạt chuẩn" | "Không đạt" | "Chưa thực hiện";
  step3Time: string | null;
  step3Temperature: number | null;
  step3Note: string;
  step3PhotoUrl: string | null;
  step3Photos?: string[];
  sampleItems: Array<{
    id: string;
    dishName: string;
    sampleCode: string;
    quantityGrams: number;
    temperatureC: number | null;
    containerType: string;
    status: string;
    storedAt: string | null;
    disposeAt: string | null;
  }>;
}

export interface WorkflowMeta {
  approvalStatus: "CHO_DUYET" | "DA_DUYET" | "YEU_CAU_CHUP_LAI";
  dishes?: string[];
  rejectionReason?: string;
  approvedBy?: string;
  approvedAt?: string;
  kitchenSubmittedAt?: string;
  nutritionistName?: string;
}

const WORKFLOW_PREFIX = "__WORKFLOW__:";
const WORKFLOW_SUFFIX = ":__END__";

export function parseWorkflowMeta(note?: string): WorkflowMeta | null {
  if (!note) return null;
  try {
    const start = note.indexOf(WORKFLOW_PREFIX);
    if (start !== -1) {
      const payloadStart = start + WORKFLOW_PREFIX.length;
      const end = note.indexOf(WORKFLOW_SUFFIX, payloadStart);
      if (end !== -1) {
        return JSON.parse(note.slice(payloadStart, end));
      }
    }
  } catch (e) {}
  return null;
}

export function embedWorkflowMeta(
  note: string | undefined,
  meta: WorkflowMeta,
): string {
  const source = note || "";
  let cleanNote = "";
  let cursor = 0;

  while (cursor < source.length) {
    const start = source.indexOf(WORKFLOW_PREFIX, cursor);
    if (start === -1) {
      cleanNote += source.slice(cursor);
      break;
    }

    cleanNote += source.slice(cursor, start);
    const payloadStart = start + WORKFLOW_PREFIX.length;
    const end = source.indexOf(WORKFLOW_SUFFIX, payloadStart);

    if (end === -1) {
      cleanNote += source.slice(start);
      break;
    }

    cursor = end + WORKFLOW_SUFFIX.length;
    while (
      source[cursor] === " " ||
      source[cursor] === "\t" ||
      source[cursor] === "\n" ||
      source[cursor] === "\r"
    ) {
      cursor += 1;
    }
  }

  cleanNote = cleanNote.trim();
  return `__WORKFLOW__:${JSON.stringify(meta)}:__END__ ${cleanNote}`.trim();
}

@Injectable()
export class InspectionsService {
  constructor(
    @InjectRepository(InspectionRecord)
    private readonly inspectionRepo: Repository<InspectionRecord>,
    @InjectRepository(InspectionSampleItem)
    private readonly sampleRepo: Repository<InspectionSampleItem>,
    @InjectRepository(InspectionImage)
    private readonly imageRepo: Repository<InspectionImage>,
    private readonly kitchenGateway: KitchenGateway,
  ) {}

  /**
   * Lấy danh sách toàn bộ các biên bản kiểm thực 3 bước (Sổ kiểm thực điện tử QĐ 1246)
   */
  async getInspections(query?: any): Promise<FormattedInspectionSession[]> {
    const rawInspections = await this.inspectionRepo.find({
      relations: ["inspector", "images"],
      order: { date: "DESC", id: "DESC" },
    });

    const samples = await this.sampleRepo.find({
      order: { date: "DESC", id: "ASC" },
    });

    // Group raw inspections by sessionCode (or fallback to date + mealSession)
    const groups: { [key: string]: InspectionRecord[] } = {};
    for (const r of rawInspections) {
      const session = r.mealSession || "LUNCH";
      const key = r.sessionCode || `${r.date}_${session}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }

    // Also collect dates with samples that might not have inspection rows
    const sampleDates = Array.from(new Set(samples.map((s) => s.date)));
    for (const sDate of sampleDates) {
      const key = `${sDate}_LUNCH`;
      if (!groups[key]) {
        groups[key] = [];
      }
    }

    const sessions: FormattedInspectionSession[] = [];
    let sessionCounter = 1;

    for (const key of Object.keys(groups).sort().reverse()) {
      const records = groups[key];
      const date = records[0]?.date || key.split("_")[0];
      const mealSession =
        records[0]?.mealSession || key.split("_")[1] || "LUNCH";

      const step1 = records.find(
        (r) =>
          r.inspectionStep === "STEP_1_RAW_CHECK" ||
          r.inspectionStep === "STEP_1_PRE_PROCESSING_CHECK",
      );
      const step2 = records.find(
        (r) => r.inspectionStep === "STEP_2_PROCESSING_CHECK",
      );
      const step3 = records.find(
        (r) => r.inspectionStep === "STEP_3_PRE_SERVING_CHECK",
      );

      const matchingSamples = samples.filter((s) => s.date === date);

      // Extract workflow meta if present
      let workflowMeta: WorkflowMeta | null = null;
      for (const r of records) {
        const meta = parseWorkflowMeta(r.note);
        if (meta) {
          workflowMeta = meta;
          break;
        }
      }

      const hasFail = records.some((r) => r.result === "FAIL");
      const hasAll3 = !!step1 && !!step2 && !!step3;

      const approvalStatus: FormattedInspectionSession["approvalStatus"] =
        workflowMeta?.approvalStatus || "CHO_BEP_TAI_ANH";
      const approvalStatusLabel = {
        CHO_BEP_TAI_ANH: "Chờ bếp tải ảnh",
        CHO_DUYET: "Chờ duyệt",
        DA_DUYET: "Đã duyệt",
        YEU_CAU_CHUP_LAI: "Yêu cầu bổ sung",
      }[approvalStatus];
      const status: FormattedInspectionSession["status"] =
        approvalStatus === "DA_DUYET"
          ? "Đã duyệt"
          : approvalStatus === "YEU_CAU_CHUP_LAI"
            ? "Yêu cầu chụp lại"
            : approvalStatus === "CHO_DUYET"
              ? "Chờ duyệt"
              : "Chờ bếp tải ảnh";

      const mealTimeLabel =
        mealSession === "BREAKFAST"
          ? "Bữa sáng (07:00)"
          : mealSession === "AFTERNOON_SNACK"
            ? "Bữa xế chiều (14:30)"
            : "Trưa chính (10:30)";

      const inspectorName =
        step3?.inspector?.fullName ||
        step2?.inspector?.fullName ||
        step1?.inspector?.fullName ||
        (matchingSamples.length > 0
          ? matchingSamples[0].collectorName
          : null) ||
        "Chưa cập nhật";

      const dateSlug = date.replace(/-/g, "");
      const code =
        records[0]?.sessionCode || `BB-KT-${dateSlug}-0${sessionCounter}`;
      const firstId = records[0]?.id
        ? String(records[0].id)
        : `session-${date}-${mealSession}`;

      const step1Photos = (step1?.images || []).map((img) => img.imageUrl);
      const step2Photos = (step2?.images || []).map((img) => img.imageUrl);
      const step3Photos = (step3?.images || []).map((img) => img.imageUrl);

      const cleanStep1Note = (step1?.note || "")
        .replace(/__WORKFLOW__:.*?:__END__\s*/g, "")
        .trim();
      const cleanStep2Note = (step2?.note || "")
        .replace(/__WORKFLOW__:.*?:__END__\s*/g, "")
        .trim();
      const cleanStep3Note = (step3?.note || "")
        .replace(/__WORKFLOW__:.*?:__END__\s*/g, "")
        .trim();

      const sealedAt = matchingSamples[0]?.storedAt
        ? matchingSamples[0].storedAt.toISOString()
        : step3?.images?.[0]?.uploadedAt
          ? step3.images[0].uploadedAt.toISOString()
          : null;

      const step1Time = step1?.images?.[0]?.uploadedAt
        ? step1.images[0].uploadedAt.toISOString()
        : step1
          ? `${date}T00:00:00.000Z`
          : null;

      const step2Time = step2?.images?.[0]?.uploadedAt
        ? step2.images[0].uploadedAt.toISOString()
        : step2
          ? `${date}T00:00:00.000Z`
          : null;

      const step3Time = matchingSamples[0]?.storedAt
        ? matchingSamples[0].storedAt.toISOString()
        : step3?.images?.[0]?.uploadedAt
          ? step3.images[0].uploadedAt.toISOString()
          : step3
            ? `${date}T00:00:00.000Z`
            : null;

      sessions.push({
        id: firstId,
        code,
        date,
        mealDate: date,
        mealTime: mealTimeLabel,
        performerName: inspectorName,
        totalPortions: null,
        storageTemp:
          matchingSamples[0]?.storageTemp != null
            ? Number(matchingSamples[0].storageTemp)
            : null,
        status,
        approvalStatus,
        approvalStatusLabel,
        rejectionReason: workflowMeta?.rejectionReason || null,
        approvedBy: workflowMeta?.approvedBy || null,
        approvedAt: workflowMeta?.approvedAt || null,
        kitchenSubmittedAt: workflowMeta?.kitchenSubmittedAt || null,
        dishes:
          workflowMeta?.dishes && workflowMeta.dishes.length > 0
            ? workflowMeta.dishes
            : matchingSamples.length > 0
              ? matchingSamples.map((s) => s.dishName)
              : [],
        sealedAt,
        disposedAt: matchingSamples[0]?.disposeAt
          ? matchingSamples[0].disposeAt.toISOString()
          : null,
        step1Status:
          step1?.result === "PASS"
            ? "Đạt chuẩn"
            : step1?.result === "FAIL"
              ? "Không đạt"
              : "Chưa thực hiện",
        step1Time,
        step1Note: cleanStep1Note,
        step1PhotoUrl: step1Photos[0] || null,
        step1Photos,
        step2Status:
          step2?.result === "PASS"
            ? "Đạt chuẩn"
            : step2?.result === "FAIL"
              ? "Không đạt"
              : "Chưa thực hiện",
        step2Time,
        step2Temperature: null,
        step2Note: cleanStep2Note,
        step2PhotoUrl: step2Photos[0] || null,
        step2Photos,
        step3Status:
          step3?.result === "PASS"
            ? "Đạt chuẩn"
            : step3?.result === "FAIL"
              ? "Không đạt"
              : "Chưa thực hiện",
        step3Time,
        step3Temperature: null,
        step3Note: cleanStep3Note,
        step3PhotoUrl: step3Photos[0] || null,
        step3Photos,
        sampleItems: matchingSamples.map((s) => ({
          id: String(s.id),
          dishName: s.dishName,
          sampleCode: s.sampleCode,
          quantityGrams:
            s.sampleWeightG == null ? null : Number(s.sampleWeightG),
          temperatureC: s.storageTemp != null ? Number(s.storageTemp) : null,
          containerType: null,
          status: s.status,
          storedAt: s.storedAt ? s.storedAt.toISOString() : null,
          disposeAt: s.disposeAt ? s.disposeAt.toISOString() : null,
        })),
      });

      sessionCounter++;
    }

    return sessions;
  }

  /**
   * Xem chi tiết 1 biên bản kiểm thực 3 bước
   */
  async getInspectionDetail(
    idOrCode: string | number,
  ): Promise<FormattedInspectionSession> {
    const all = await this.getInspections();
    const strId = String(idOrCode);
    const found = all.find(
      (item) =>
        item.id === strId ||
        item.code === strId ||
        item.id === `session-${strId}`,
    );

    if (found) {
      return found;
    }

    // Fallback: Check if numeric ID matches in database directly
    const numId = parseInt(strId, 10);
    if (!isNaN(numId)) {
      const rec = await this.inspectionRepo.findOne({
        where: { id: numId },
        relations: ["inspector", "images"],
      });
      if (rec) {
        const subList = await this.getInspections();
        const dateMatch = subList.find((s) => s.date === rec.date);
        if (dateMatch) return dateMatch;
      }
    }

    throw new NotFoundException(
      `Không tìm thấy biên bản kiểm thực với mã/ID: ${idOrCode}`,
    );
  }

  /**
   * Lấy danh sách mẫu thức ăn lưu 24h (QĐ 1246/QĐ-BYT)
   */
  async getSamples() {
    const samples = await this.sampleRepo.find({ order: { storedAt: "DESC" } });
    return samples.map((s) => {
      const storedTime = s.storedAt
        ? new Date(s.storedAt).getTime()
        : Date.now();
      const expiresTime = storedTime + 24 * 60 * 60 * 1000;
      const hoursRemaining = Math.max(
        0,
        (expiresTime - Date.now()) / (1000 * 60 * 60),
      );

      return {
        id: String(s.id),
        code: s.sampleCode,
        sampleCode: s.sampleCode,
        dishName: s.dishName,
        dishId: s.dishId != null ? String(s.dishId) : null,
        inspectionId: s.inspectionId != null ? String(s.inspectionId) : null,
        date: s.date,
        mealDate: s.date,
        mealSession:
          s.dishName.toLowerCase().includes("phở") ||
          s.dishName.toLowerCase().includes("bún")
            ? "Xế chiều"
            : "Trưa chính",
        storedAt: s.storedAt ? s.storedAt.toISOString() : null,
        disposeAt: s.disposeAt ? s.disposeAt.toISOString() : null,
        status: s.status,
        sampleWeight: s.sampleWeightG == null ? null : Number(s.sampleWeightG),
        storageTemp: s.storageTemp != null ? Number(s.storageTemp) : null,
        temperatureC: s.storageTemp != null ? Number(s.storageTemp) : null,
        fridgeUnit: s.fridgeUnit || null,
        collectorName: s.collectorName || "Chưa cập nhật",
        countdownHours: parseFloat(hoursRemaining.toFixed(1)),
        note: s.note,
      };
    });
  }

  /**
   * Xem chi tiết mẫu thức ăn lưu 24h
   */
  async getSampleDetail(id: number) {
    const s = await this.sampleRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException("Không tìm thấy mẫu thức ăn lưu");

    const storedTime = s.storedAt ? new Date(s.storedAt).getTime() : Date.now();
    const expiresTime = storedTime + 24 * 60 * 60 * 1000;
    const hoursRemaining = Math.max(
      0,
      (expiresTime - Date.now()) / (1000 * 60 * 60),
    );

    return {
      id: String(s.id),
      code: s.sampleCode,
      sampleCode: s.sampleCode,
      dishName: s.dishName,
      dishId: s.dishId != null ? String(s.dishId) : null,
      inspectionId: s.inspectionId != null ? String(s.inspectionId) : null,
      date: s.date,
      mealDate: s.date,
      storedAt: s.storedAt ? s.storedAt.toISOString() : null,
      disposeAt: s.disposeAt ? s.disposeAt.toISOString() : null,
      status: s.status,
      temperatureC: s.storageTemp != null ? Number(s.storageTemp) : null,
      storageTemp: s.storageTemp != null ? Number(s.storageTemp) : null,
      sampleWeight: s.sampleWeightG == null ? null : Number(s.sampleWeightG),
      fridgeUnit: s.fridgeUnit || null,
      collectorName: s.collectorName || "Chưa cập nhật",
      countdownHours: parseFloat(hoursRemaining.toFixed(1)),
      note: s.note,
      sealIntegrity: "NGUYÊN VẸN",
      storageLocation: s.fridgeUnit || null,
    };
  }

  /**
   * Tiêu hủy mẫu lưu an toàn sau 24 giờ
   */
  async disposeSample(id: number) {
    const s = await this.sampleRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException("Không tìm thấy mẫu thức ăn");

    s.status = "DISPOSED";
    s.disposeAt = new Date();
    await this.sampleRepo.save(s);

    this.kitchenGateway.broadcastSafetyAlert(1, {
      type: "SAMPLE_DISPOSED",
      sampleId: String(s.id),
      dishName: s.dishName,
      message: `Đã tiêu hủy an toàn mẫu lưu ${s.dishName} sau 24h`,
      severity: "INFO",
      timestamp: new Date().toISOString(),
    });

    return { success: true, message: "Đã hủy mẫu lưu 24h an toàn" };
  }

  async sealSample(dto: SealSampleDto, inspectionId?: number) {
    if (dto.dishId != null) {
      const matches = await this.sampleRepo.manager.query(
        "SELECT id FROM dishes WHERE id=$1",
        [dto.dishId],
      );
      if (!matches.length)
        throw new NotFoundException("Không tìm thấy món ăn được chọn");
    }
    const sampleCode =
      dto.sampleCode ||
      `HD-LM-${dto.date?.replace(/-/g, "") || "2026"}-${Date.now().toString().slice(-2)}`;
    const sample = this.sampleRepo.create({
      dishName: dto.dishName,
      dishId: dto.dishId ?? null,
      inspectionId: inspectionId ?? null,
      date: dto.date,
      sampleCode,
      status: "STORED",
      sampleWeightG: dto.sampleWeightG ?? null,
      storageTemp: dto.storageTemp ?? null,
      fridgeUnit: dto.fridgeUnit || null,
      collectorName: dto.collectorName || "Nhân viên nhà bếp",
      note: dto.note || "Lưu mẫu 24h theo Quyết định 1246/QĐ-BYT",
    });
    const saved = await this.sampleRepo.save(sample);

    this.kitchenGateway.broadcastSafetyAlert(1, {
      type: "SAMPLE_SEALED",
      sampleId: String(saved.id),
      dishName: saved.dishName,
      message: `Đã niêm phong mẫu lưu ${saved.dishName} (${saved.sampleCode})`,
      severity: "INFO",
      timestamp: new Date().toISOString(),
    });

    // Reload columns filled by database triggers (including an unambiguous dish match).
    return (
      (await this.sampleRepo.findOne({ where: { id: saved.id } })) || saved
    );
  }

  /**
   * Bước 1: Tiếp nhận nguyên liệu trước chế biến
   */
  async createStep1(data: any, inspectorId?: number) {
    const mealDate =
      data.mealDate || data.date || new Date().toISOString().split("T")[0];
    const sessionCode = `BB-KT-${mealDate.replace(/-/g, "")}-01`;

    const rec = this.inspectionRepo.create({
      date: mealDate,
      inspectionStep: "STEP_1_RAW_CHECK",
      inspectorId: inspectorId || 5, // Default chef
      result: data.result || "PASS",
      mealSession: data.mealSession || "LUNCH",
      sessionCode,
      note: embedWorkflowMeta(
        data.note !== undefined ? data.note : data.notes || "",
        { approvalStatus: "CHO_DUYET" },
      ),
    });
    const saved = await this.inspectionRepo.save(rec);

    if (data.photoBase64 || data.imageUrl) {
      await this.imageRepo.save(
        this.imageRepo.create({
          inspectionId: saved.id,
          imageUrl: data.imageUrl || data.photoBase64 || "",
        }),
      );
    }

    this.kitchenGateway.broadcastSafetyAlert(1, {
      type: "INSPECTION_STEP_1_COMPLETED",
      stepNumber: 1,
      message: `Đã hoàn tất Bước 1: Tiếp nhận nguyên liệu (${mealDate})`,
      severity: "INFO",
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      recordId: String(saved.id),
      code: sessionCode,
      step: "STEP_1_RAW_CHECK",
      message: "Đã hoàn tất Bước 1: Kiểm tra nguyên liệu trước chế biến",
    };
  }

  /**
   * Bước 2: Kiểm tra trong quá trình chế biến
   */
  async updateStep2(idOrCode: any, data: any, inspectorId?: number) {
    const mealDate =
      data.mealDate || data.date || new Date().toISOString().split("T")[0];
    const sessionCode = `BB-KT-${mealDate.replace(/-/g, "")}-01`;

    const rec = this.inspectionRepo.create({
      date: mealDate,
      inspectionStep: "STEP_2_PROCESSING_CHECK",
      inspectorId: inspectorId || 5,
      result: data.result || "PASS",
      mealSession: data.mealSession || "LUNCH",
      sessionCode,
      note: embedWorkflowMeta(
        data.note !== undefined ? data.note : data.notes || "",
        { approvalStatus: "CHO_DUYET" },
      ),
    });
    const saved = await this.inspectionRepo.save(rec);

    if (data.photoBase64 || data.imageUrl) {
      await this.imageRepo.save(
        this.imageRepo.create({
          inspectionId: saved.id,
          imageUrl: data.imageUrl || data.photoBase64 || "",
        }),
      );
    }

    this.kitchenGateway.broadcastSafetyAlert(1, {
      type: "INSPECTION_STEP_2_COMPLETED",
      stepNumber: 2,
      message: `Đã hoàn tất Bước 2: Chế biến món ăn (${mealDate})`,
      severity: "INFO",
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      recordId: String(saved.id),
      step: "STEP_2_PROCESSING_CHECK",
      message: "Đã hoàn tất Bước 2: Kiểm tra trong quá trình chế biến",
    };
  }

  /**
   * Bước 3: Kiểm tra thức ăn trước khi ăn & lưu mẫu 24h
   */
  async updateStep3(idOrCode: any, data: any, inspectorId?: number) {
    const mealDate =
      data.mealDate || data.date || new Date().toISOString().split("T")[0];
    const sessionCode = `BB-KT-${mealDate.replace(/-/g, "")}-01`;

    const rec = this.inspectionRepo.create({
      date: mealDate,
      inspectionStep: "STEP_3_PRE_SERVING_CHECK",
      inspectorId: inspectorId || 3, // Nutritionist / BGH
      result: data.result || "PASS",
      mealSession: data.mealSession || "LUNCH",
      sessionCode,
      note: data.note !== undefined ? data.note : data.notes || "",
    });
    const saved = await this.inspectionRepo.save(rec);

    // Save sample items if passed
    if (Array.isArray(data.dishes) && data.dishes.length > 0) {
      for (const d of data.dishes) {
        if (d.name || d.dishName) {
          await this.sealSample(
            {
              dishName: d.name || d.dishName,
              dishId: d.dishId,
              date: mealDate,
              note: `Lưu mẫu 24h từ Biên bản ${sessionCode}`,
            },
            Number(saved.id),
          );
        }
      }
    } else if (data.dishName) {
      await this.sealSample(
        {
          dishName: data.dishName,
          dishId: data.dishId,
          date: mealDate,
          note: `Lưu mẫu 24h từ Biên bản ${sessionCode}`,
        },
        Number(saved.id),
      );
    }

    if (data.photoBase64 || data.imageUrl) {
      await this.imageRepo.save(
        this.imageRepo.create({
          inspectionId: saved.id,
          imageUrl: data.imageUrl || data.photoBase64 || "",
        }),
      );
    }

    this.kitchenGateway.broadcastSafetyAlert(1, {
      type: "INSPECTION_STEP_3_COMPLETED",
      stepNumber: 3,
      message: `Đã hoàn tất Bước 3: Thử nếm & Niêm phong mẫu lưu 24h (${mealDate})`,
      severity: "INFO",
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      recordId: String(saved.id),
      step: "STEP_3_PRE_SERVING_CHECK",
      message: "Đã hoàn tất Bước 3: Kiểm tra thức ăn trước khi ăn & lưu mẫu",
    };
  }

  // =========================================================================
  // WORKFLOW: NUTRITIONIST CREATES -> KITCHEN UPLOADS PHOTOS -> NUTRITIONIST APPROVES
  // =========================================================================

  /**
   * 1. Chuyên gia dinh dưỡng khởi tạo biên bản kiểm thực (Yêu cầu bếp chụp ảnh)
   */
  async createSessionByNutritionist(data: any, nutritionistId?: number) {
    const mealDate =
      data.mealDate || data.date || new Date().toISOString().split("T")[0];
    let sessionCode = data.sessionCode;
    if (!sessionCode) {
      const existingForDate = await this.inspectionRepo.find({
        where: { date: mealDate },
      });
      let maxNum = 0;
      for (const r of existingForDate) {
        if (r.sessionCode) {
          const match = r.sessionCode.match(/-(\d+)$/);
          if (match) {
            const n = parseInt(match[1], 10);
            if (n > maxNum) maxNum = n;
          }
        }
      }
      const nextNum = maxNum + 1;
      const nextNumStr = nextNum < 10 ? `0${nextNum}` : `${nextNum}`;
      sessionCode = `BB-KT-${mealDate.replace(/-/g, "")}-${nextNumStr}`;
    }

    const dishes = Array.isArray(data.dishes)
      ? data.dishes.map((d: any) =>
          typeof d === "string" ? d : d.name || d.dishName,
        )
      : [];

    const meta: WorkflowMeta = {
      approvalStatus: "CHO_DUYET",
      dishes,
      nutritionistName: data.nutritionistName || "Chuyên gia Dinh dưỡng",
    };

    const initialNote = embedWorkflowMeta(
      data.note !== undefined ? data.note : "",
      meta,
    );

    const rec = this.inspectionRepo.create({
      date: mealDate,
      inspectionStep: "STEP_1_RAW_CHECK",
      inspectorId: nutritionistId || 2,
      result: "PASS",
      mealSession: data.mealSession || "LUNCH",
      sessionCode,
      note: initialNote,
    });
    const saved = await this.inspectionRepo.save(rec);

    this.kitchenGateway.broadcastSafetyAlert(1, {
      type: "INSPECTION_SESSION_CREATED",
      sessionCode,
      mealDate,
      message: `Chuyên gia dinh dưỡng đã tạo biên bản kiểm thực ${sessionCode}. Nhà bếp vui lòng vào tải ảnh minh chứng 3 bước.`,
      severity: "INFO",
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      recordId: String(saved.id),
      code: sessionCode,
      approvalStatus: "CHO_DUYET",
      dishes: data.dishes || [],
      message: `Đã tạo biên bản kiểm thực ${sessionCode}. Đã gửi yêu cầu đến nhà bếp để tải ảnh minh chứng.`,
    };
  }

  /**
   * 2. Nhà bếp tải ảnh minh chứng và gửi lên để Chuyên gia dinh dưỡng duyệt
   */
  async kitchenSubmitPhotos(idOrCode: any, data: any, kitchenUserId?: number) {
    const detail = await this.getInspectionDetail(idOrCode);
    const sessionCode = detail.code;
    const mealDate = detail.mealDate || detail.date;

    // Find all records for this session
    const whereCondition = sessionCode ? { sessionCode } : { date: mealDate };
    const records = await this.inspectionRepo.find({
      where: whereCondition,
      relations: ["images"],
    });

    let step1 = records.find(
      (r) =>
        r.inspectionStep === "STEP_1_RAW_CHECK" ||
        r.inspectionStep === "STEP_1_PRE_PROCESSING_CHECK",
    );
    let step2 = records.find(
      (r) => r.inspectionStep === "STEP_2_PROCESSING_CHECK",
    );
    let step3 = records.find(
      (r) => r.inspectionStep === "STEP_3_PRE_SERVING_CHECK",
    );

    if (!step1) {
      step1 = this.inspectionRepo.create({
        date: mealDate,
        inspectionStep: "STEP_1_RAW_CHECK",
        inspectorId: kitchenUserId || 5,
        result: "PASS",
        mealSession: detail.mealTime?.includes("sáng") ? "BREAKFAST" : "LUNCH",
        sessionCode,
        note: data.step1Note || "",
      });
      step1 = await this.inspectionRepo.save(step1);
    }

    if (!step2) {
      step2 = this.inspectionRepo.create({
        date: mealDate,
        inspectionStep: "STEP_2_PROCESSING_CHECK",
        inspectorId: kitchenUserId || 5,
        result: "PASS",
        mealSession: step1.mealSession,
        sessionCode,
        note:
          data.step2Note ||
          (data.step2Temperature
            ? `Nhiệt độ sôi: ${data.step2Temperature}°C.`
            : ""),
      });
      step2 = await this.inspectionRepo.save(step2);
    }

    if (!step3) {
      step3 = this.inspectionRepo.create({
        date: mealDate,
        inspectionStep: "STEP_3_PRE_SERVING_CHECK",
        inspectorId: kitchenUserId || 5,
        result: "PASS",
        mealSession: step1.mealSession,
        sessionCode,
        note: data.step3Note !== undefined ? data.step3Note : "",
      });
      step3 = await this.inspectionRepo.save(step3);
    }

    // Save photos
    const savePhotos = async (
      recordId: number,
      photos: string[] | undefined,
    ) => {
      if (!Array.isArray(photos) || photos.length === 0) return;
      for (const p of photos) {
        if (p && p.trim()) {
          await this.imageRepo.save(
            this.imageRepo.create({
              inspectionId: recordId,
              imageUrl: p,
            }),
          );
        }
      }
    };

    const step1Urls =
      data.step1Photos ||
      data.step1?.images ||
      (data.step1PhotoUrl ? [data.step1PhotoUrl] : []);
    const step2Urls =
      data.step2Photos ||
      data.step2?.images ||
      (data.step2PhotoUrl ? [data.step2PhotoUrl] : []);
    const step3Urls =
      data.step3Photos ||
      data.step3?.images ||
      (data.step3PhotoUrl ? [data.step3PhotoUrl] : []);

    if (step1Urls.length > 0) await savePhotos(step1.id, step1Urls);
    if (step2Urls.length > 0) await savePhotos(step2.id, step2Urls);
    if (step3Urls.length > 0) await savePhotos(step3.id, step3Urls);

    // Save sample retention if dish names provided
    if (Array.isArray(data.dishes) && data.dishes.length > 0) {
      for (const d of data.dishes) {
        const dishName = typeof d === "string" ? d : d.name || d.dishName;
        if (dishName) {
          await this.sealSample({
            dishName,
            date: mealDate,
            note: `Lưu mẫu 24h tự động từ Biên bản ${sessionCode}`,
          });
        }
      }
    }

    // Update workflow meta to CHO_DUYET
    const currentMeta = parseWorkflowMeta(step1.note) || {
      approvalStatus: "CHO_DUYET" as const,
      dishes: [],
    };
    const updatedMeta: WorkflowMeta = {
      ...currentMeta,
      approvalStatus: "CHO_DUYET",
      kitchenSubmittedAt: new Date().toISOString(),
      dishes: data.dishes || currentMeta.dishes,
    };

    step1.note = embedWorkflowMeta(data.step1Note || step1.note, updatedMeta);
    await this.inspectionRepo.update(step1.id, { note: step1.note });

    this.kitchenGateway.broadcastSafetyAlert(1, {
      type: "INSPECTION_SUBMITTED_FOR_APPROVAL",
      sessionCode,
      message: `Nhà bếp đã tải đủ ảnh minh chứng và gửi duyệt biên bản kiểm thực ${sessionCode}.`,
      severity: "INFO",
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      approvalStatus: "CHO_DUYET",
      message: `Đã gửi duyệt biên bản ${sessionCode} thành công cho Chuyên gia dinh dưỡng!`,
    };
  }

  /**
   * 3. Chuyên gia dinh dưỡng phê duyệt biên bản kiểm thực đạt chuẩn
   */
  async approveInspection(idOrCode: any, data: any, userId?: number) {
    const detail = await this.getInspectionDetail(idOrCode);
    if (detail.approvalStatus !== "CHO_DUYET")
      throw new BadRequestException("Biên bản chưa ở trạng thái chờ duyệt.");
    if (
      ![1, 2, 3].every(
        (step) =>
          detail["step" + step + "Status"] === "Đạt chuẩn" &&
          detail["step" + step + "Photos"]?.length,
      )
    )
      throw new BadRequestException(
        "Chưa có đủ kết quả đạt và ảnh minh chứng cho 3 bước.",
      );
    const sessionCode = detail.code;
    const mealDate = detail.mealDate || detail.date;

    const whereCondition = sessionCode ? { sessionCode } : { date: mealDate };
    const records = await this.inspectionRepo.find({
      where: whereCondition,
    });

    const step1 =
      records.find(
        (r) =>
          r.inspectionStep === "STEP_1_RAW_CHECK" ||
          r.inspectionStep === "STEP_1_PRE_PROCESSING_CHECK",
      ) || records[0];
    if (step1) {
      const currentMeta = parseWorkflowMeta(step1.note) || {
        approvalStatus: "CHO_DUYET",
      };
      let approverName = "Chuyên gia Dinh dưỡng";
      if (userId) {
        try {
          const u = await this.inspectionRepo.manager.query(
            `SELECT full_name FROM users WHERE id = $1`,
            [userId],
          );
          if (u[0]?.full_name) approverName = u[0].full_name;
        } catch (e) {}
      }

      const updatedMeta: WorkflowMeta = {
        ...currentMeta,
        approvalStatus: "DA_DUYET",
        approvedAt: new Date().toISOString(),
        approvedBy: approverName,
        rejectionReason: undefined,
      };
      step1.note = embedWorkflowMeta(step1.note, updatedMeta);
      await this.inspectionRepo.update(step1.id, { note: step1.note });
    }

    this.kitchenGateway.broadcastSafetyAlert(1, {
      type: "INSPECTION_APPROVED",
      sessionCode,
      message: `Chuyên gia dinh dưỡng đã phê duyệt Đạt chuẩn biên bản kiểm thực ${sessionCode}.`,
      severity: "INFO",
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      approvalStatus: "DA_DUYET",
      approvalStatusLabel: "Đã duyệt",
      message: `Đã phê duyệt biên bản kiểm thực ${sessionCode} Đạt chuẩn ATTP!`,
    };
  }

  /**
   * 4. Chuyên gia dinh dưỡng yêu cầu bếp chụp lại ảnh / bổ sung minh chứng
   */
  async rejectInspection(idOrCode: any, data: any, userId?: number) {
    const detail = await this.getInspectionDetail(idOrCode);
    if (detail.approvalStatus !== "CHO_DUYET")
      throw new BadRequestException("Biên bản chưa ở trạng thái chờ duyệt.");
    const sessionCode = detail.code;
    const mealDate = detail.mealDate || detail.date;

    const whereCondition = sessionCode ? { sessionCode } : { date: mealDate };
    const records = await this.inspectionRepo.find({
      where: whereCondition,
    });

    const reason = String(data.reason || data.rejectionReason || "").trim();
    if (reason.length < 5)
      throw new BadRequestException(
        "Nhập lý do yêu cầu bổ sung ít nhất 5 ký tự.",
      );

    const step1 =
      records.find(
        (r) =>
          r.inspectionStep === "STEP_1_RAW_CHECK" ||
          r.inspectionStep === "STEP_1_PRE_PROCESSING_CHECK",
      ) || records[0];
    if (step1) {
      const currentMeta = parseWorkflowMeta(step1.note) || {
        approvalStatus: "CHO_DUYET",
      };
      const updatedMeta: WorkflowMeta = {
        ...currentMeta,
        approvalStatus: "YEU_CAU_CHUP_LAI",
        rejectionReason: reason,
      };
      step1.note = embedWorkflowMeta(step1.note, updatedMeta);
      await this.inspectionRepo.update(step1.id, { note: step1.note });
    }

    this.kitchenGateway.broadcastSafetyAlert(1, {
      type: "INSPECTION_REJECTED_RETAKE",
      sessionCode,
      message: `Biên bản kiểm thực ${sessionCode} yêu cầu bếp chụp lại ảnh: ${reason}`,
      severity: "WARNING",
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      approvalStatus: "YEU_CAU_CHUP_LAI",
      approvalStatusLabel: "Yêu cầu chụp lại",
      rejectionReason: reason,
      message: `Đã gửi yêu cầu chụp lại ảnh minh chứng cho nhà bếp!`,
    };
  }

  // =========================================================================
  // KDS KITCHEN COMPATIBILITY METHODS
  // =========================================================================

  async getFoodSafetyLogs() {
    return this.getInspections();
  }

  async createFoodSafetyLog(data: any) {
    if (data.stepNumber === 1 || !data.stepNumber) {
      return this.createStep1(data);
    }
    if (data.stepNumber === 2) {
      return this.updateStep2(data.recordId || data.id, data);
    }
    return this.updateStep3(data.recordId || data.id, data);
  }

  async getSampleRetentionRecords() {
    return this.getSamples();
  }

  async createSampleRetentionRecord(data: any) {
    return this.sealSample({
      dishName: data.dishName,
      date:
        data.mealDate || data.date || new Date().toISOString().split("T")[0],
      note: data.notes || data.note,
    });
  }

  async disposeSampleRetentionRecord(id: string | number) {
    const numId = parseInt(String(id), 10);
    return this.disposeSample(numId);
  }

  async getMealIngredients(mealDate?: string, mealTime?: string) {
    const session = (mealTime || "").toLowerCase();
    let mealType = "LUNCH";
    if (
      session.includes("sáng") ||
      session.includes("morning") ||
      session.includes("07:")
    ) {
      mealType = "MORNING_SNACK";
    } else if (
      session.includes("xế") ||
      session.includes("afternoon") ||
      session.includes("14:")
    ) {
      mealType = "AFTERNOON_SNACK";
    }

    try {
      let dishesRes: any[] = [];
      let ingRes: any[] = [];

      // 1. Tra cứu thực đơn chính xác theo ngày nếu có mealDate
      if (mealDate) {
        dishesRes = await this.inspectionRepo.manager.query(
          `
          SELECT DISTINCT d.id, d.name as dish_name
          FROM menu_days md_day
          JOIN menu_meals mm ON mm.menu_day_id = md_day.id
          JOIN menu_dishes md ON md.menu_meal_id = mm.id
          JOIN dishes d ON d.id = md.dish_id
          WHERE md_day.date = $1 AND mm.meal_type = $2
          ORDER BY d.id ASC
          LIMIT 10
        `,
          [mealDate, mealType],
        );

        if (dishesRes.length > 0) {
          ingRes = await this.inspectionRepo.manager.query(
            `
            SELECT fi.id as ingredient_id, fi.name as ingredient_name, fi.unit, SUM(dr.gross_weight_g) as gross_weight_g
            FROM menu_days md_day
            JOIN menu_meals mm ON mm.menu_day_id = md_day.id
            JOIN menu_dishes md ON md.menu_meal_id = mm.id
            JOIN dishes d ON d.id = md.dish_id
            JOIN dish_recipes dr ON dr.dish_id = d.id
            JOIN food_ingredients fi ON fi.id = dr.ingredient_id
            WHERE md_day.date = $1 AND mm.meal_type = $2
            GROUP BY fi.id, fi.name, fi.unit
            ORDER BY fi.name ASC
            LIMIT 20
          `,
            [mealDate, mealType],
          );
        }
      }

      // 2. Nếu ngày cụ thể chưa có thực đơn, lấy món theo ca ăn (mealType) từ menu_meals
      if (!dishesRes || dishesRes.length === 0) {
        dishesRes = await this.inspectionRepo.manager.query(
          `
          SELECT DISTINCT d.id, d.name as dish_name
          FROM menu_meals mm
          JOIN menu_dishes md ON md.menu_meal_id = mm.id
          JOIN dishes d ON d.id = md.dish_id
          WHERE mm.meal_type = $1
          ORDER BY d.id ASC
          LIMIT 6
        `,
          [mealType],
        );

        if (dishesRes.length > 0) {
          ingRes = await this.inspectionRepo.manager.query(
            `
            SELECT fi.id as ingredient_id, fi.name as ingredient_name, fi.unit, SUM(dr.gross_weight_g) as gross_weight_g
            FROM menu_meals mm
            JOIN menu_dishes md ON md.menu_meal_id = mm.id
            JOIN dishes d ON d.id = md.dish_id
            JOIN dish_recipes dr ON dr.dish_id = d.id
            JOIN food_ingredients fi ON fi.id = dr.ingredient_id
            WHERE mm.meal_type = $1
            GROUP BY fi.id, fi.name, fi.unit
            ORDER BY fi.name ASC
            LIMIT 20
          `,
            [mealType],
          );
        }
      }

      // 3. Nếu chưa có liên kết thực đơn, lấy trực tiếp từ bảng dishes trong CSDL
      if (!dishesRes || dishesRes.length === 0) {
        dishesRes = await this.inspectionRepo.manager.query(`
          SELECT d.id, d.name as dish_name
          FROM dishes d
          ORDER BY d.id ASC
          LIMIT 6
        `);
      }

      // 4. Nếu chưa có liên kết nguyên liệu, lấy trực tiếp từ bảng food_ingredients trong CSDL
      if (!ingRes || ingRes.length === 0) {
        ingRes = await this.inspectionRepo.manager.query(`
          SELECT fi.id as ingredient_id, fi.name as ingredient_name, fi.unit, 15.0 as gross_weight_g
          FROM food_ingredients fi
          ORDER BY fi.id ASC
          LIMIT 8
        `);
      }

      return {
        mealType,
        mealTime:
          mealTime ||
          (mealType === "MORNING_SNACK"
            ? "Bữa sáng (07:15)"
            : mealType === "AFTERNOON_SNACK"
              ? "Bữa xế chiều (14:30)"
              : "Trưa chính (10:30)"),
        dishes: dishesRes,
        ingredients: ingRes,
      };
    } catch (e) {
      return { mealType, dishes: [], ingredients: [] };
    }
  }
}
