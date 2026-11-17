import { BadRequestException } from "@nestjs/common";
import {
  InspectionsService,
  embedWorkflowMeta,
} from "../../../src/modules/inspections/inspections.service";

describe("Inspection approval decisions", () => {
  const make = () => {
    const row = {
      id: 1,
      sessionCode: "KT-1",
      inspectionStep: "STEP_1_RAW_CHECK",
      note: embedWorkflowMeta("", { approvalStatus: "CHO_DUYET" }),
    };
    const inspectionRepo = {
      find: jest.fn().mockResolvedValue([row]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      manager: {
        query: jest.fn().mockResolvedValue([{ full_name: "Người kiểm duyệt" }]),
      },
    };
    const gateway = { broadcastSafetyAlert: jest.fn() };
    const service = new InspectionsService(
      inspectionRepo as any,
      {} as any,
      {} as any,
      gateway as any,
    );
    return { service, inspectionRepo };
  };
  const submitted = {
    code: "KT-1",
    date: "2026-11-04",
    approvalStatus: "CHO_DUYET",
    step1Status: "Đạt chuẩn",
    step2Status: "Đạt chuẩn",
    step3Status: "Đạt chuẩn",
    step1Photos: ["/one.jpg"],
    step2Photos: ["/two.jpg"],
    step3Photos: ["/three.jpg"],
  };
  it("refuses approval without all proof images", async () => {
    const { service, inspectionRepo } = make();
    jest
      .spyOn(service, "getInspectionDetail")
      .mockResolvedValue({ ...submitted, step3Photos: [] } as any);
    await expect(service.approveInspection("1", {}, 8)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(inspectionRepo.update).not.toHaveBeenCalled();
  });
  it("stores the authenticated reviewer and explicit approval decision", async () => {
    const { service, inspectionRepo } = make();
    jest
      .spyOn(service, "getInspectionDetail")
      .mockResolvedValue(submitted as any);
    await expect(service.approveInspection("1", {}, 8)).resolves.toMatchObject({
      approvalStatus: "DA_DUYET",
    });
    expect(inspectionRepo.update.mock.calls[0][1].note).toContain(
      "Người kiểm duyệt",
    );
  });
  it("requires a meaningful rejection reason and keeps the decision explicit", async () => {
    const { service } = make();
    jest
      .spyOn(service, "getInspectionDetail")
      .mockResolvedValue(submitted as any);
    await expect(
      service.rejectInspection("1", { reason: "" }, 8),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.rejectInspection("1", { reason: "Bước 2 ảnh chưa rõ" }, 8),
    ).resolves.toMatchObject({ approvalStatus: "YEU_CAU_CHUP_LAI" });
  });
});
