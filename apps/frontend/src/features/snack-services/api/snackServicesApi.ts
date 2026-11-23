import { apiClient } from "../../../core/api/axios";
import {
  SnackServicesResponse,
  SnackServiceListResponse,
  SnackServiceListItem,
  CreateSnackServicePeriodDto,
  CreatePeriodResponse,
  SnackServiceDetailResponse,
  UpdateSnackServiceDto,
  UpdateSnackServiceResponse,
  SnackMenuDayItem,
  ParentSnackOverviewResponse,
  CheckAllergyResponse,
  AvailableStudentsResponse,
  RegisterSnackServiceDto,
  RegisterSnackServiceResponse,
} from "../types/snackServices";

export const fetchSnackServices = async (
  search?: string,
  status?: string,
  grade?: string,
): Promise<SnackServicesResponse> => {
  const response = await apiClient.get<any>("/snack-services", {
    params: {
      search,
      status: status !== "ALL" ? status : undefined,
      grade: grade !== "ALL" ? grade : undefined,
    },
  });
  const raw = response.data;
  if (Array.isArray(raw)) {
    const openCount = raw.filter((i: any) => i.status === "OPEN").length;
    const closedCount = raw.filter((i: any) => i.status === "CLOSED").length;
    const upcomingCount = raw.filter(
      (i: any) => i.status === "UPCOMING",
    ).length;
    // The collection endpoint does not supply summary metrics. Preserve that absence.
    return { success: true, data: raw, totalCount: raw.length, summary: null };
  }
  return raw;
};

/** UC56: Lấy danh sách gói ăn xế đang hoạt động (cho dropdown) */
export const fetchSnackServicesList =
  async (): Promise<SnackServiceListResponse> => {
    const response = await apiClient.get<any>("/snack-services/list");
    const raw = response.data;
    const items = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.data)
        ? raw.data
        : Array.isArray(raw?.items)
          ? raw.items
          : [];
    return { success: true, data: items };
  };

/** Phụ huynh xem các gói ăn xế đã công bố và Lịch ăn xế (Cho phép xem trước thực đơn suất ăn xế) */
export const fetchParentSnackOverview =
  async (studentId?: string | number): Promise<ParentSnackOverviewResponse> => {
    const response = await apiClient.get<any>(
      "/snack-services/parent-overview",
      { params: studentId ? { studentId } : {} },
    );
    return response.data;
  };

/** UC56: Tạo đợt đăng ký ăn xế chiều */
export const createSnackServicePeriod = async (
  dto: CreateSnackServicePeriodDto,
): Promise<CreatePeriodResponse> => {
  const response = await apiClient.post<any>("/snack-services/periods", dto);
  const raw = response.data;
  if (raw && typeof raw === "object" && "success" in raw) {
    return raw;
  }
  return {
    success: true,
    message:
      dto.status === "DRAFT"
        ? `Đã lưu bản nháp gói "${dto.name || "Dịch vụ ăn xế"}" thành công!`
        : `Đã khởi tạo và công bố gói "${dto.name || "Dịch vụ ăn xế"}" thành công!`,
    data: raw,
  };
};

/** UC57: Lấy chi tiết 1 gói dịch vụ ăn xế */
export const fetchSnackServiceById = async (
  id: string,
): Promise<SnackServiceDetailResponse> => {
  const response = await apiClient.get<any>(`/snack-services/${id}`);
  const raw = response.data;
  if (raw && typeof raw === "object" && "success" in raw && "data" in raw) {
    return raw;
  }
  return {
    success: true,
    data: raw,
  };
};

/** UC57: Cập nhật cấu hình gói dịch vụ ăn xế */
export const updateSnackService = async (
  id: string,
  dto: UpdateSnackServiceDto,
): Promise<UpdateSnackServiceResponse> => {
  const response = await apiClient.put<any>(`/snack-services/${id}`, dto);
  const raw = response.data;
  if (raw && typeof raw === "object" && "success" in raw) {
    return raw;
  }
  return {
    success: true,
    message: "Cập nhật cấu hình gói dịch vụ ăn xế thành công!",
    data: raw,
  };
};

/** CGDD / Hiệu trưởng lên thực đơn ăn xế cho gói dịch vụ */
export const updateSnackMenuSchedule = async (
  id: string,
  payload: { menuSchedule: SnackMenuDayItem[]; description?: string },
): Promise<{ success: boolean; message: string; data: any }> => {
  const response = await apiClient.put<any>(
    `/snack-services/${id}/menu-schedule`,
    payload,
  );
  const raw = response.data;
  if (raw && typeof raw === "object" && "success" in raw) {
    return raw;
  }
  return {
    success: true,
    message: "Đã lưu thực đơn ăn xế từ Thứ 2 đến Thứ 6 thành công!",
    data: raw,
  };
};

/** Hiệu trưởng xóa gói dịch vụ ăn xế */
export const deleteSnackServicePeriod = async (
  id: string,
): Promise<{ success: boolean; message: string }> => {
  const response = await apiClient.delete<any>(`/snack-services/${id}`);
  const raw = response.data;
  if (raw && typeof raw === "object" && "success" in raw) {
    return raw;
  }
  return {
    success: true,
    message: "Đã xóa gói dịch vụ ăn xế thành công!",
  };
};

/** UC60: Đóng đợt dịch vụ ăn xế */
export const closeSnackServicePeriod = async (
  id: string,
): Promise<{
  success: boolean;
  message: string;
  warning?: string;
  data: any;
}> => {
  const response = await apiClient.put<any>(
    `/snack-services/periods/${id}/close`,
  );
  const raw = response.data;
  if (raw && typeof raw === "object" && "success" in raw) {
    return raw;
  }
  return {
    success: true,
    message: "Đã đóng đợt đăng ký ăn xế thành công!",
    data: raw,
  };
};

/** UC60: Mở lại đợt dịch vụ ăn xế */
export const openSnackServicePeriod = async (
  id: string,
): Promise<{ success: boolean; message: string; data: any }> => {
  const response = await apiClient.put<any>(
    `/snack-services/periods/${id}/open`,
  );
  const raw = response.data;
  if (raw && typeof raw === "object" && "success" in raw) {
    return raw;
  }
  return {
    success: true,
    message: "Đã công bố và mở đợt đăng ký ăn xế thành công!",
    data: raw,
  };
};

/** UC60: Chuyển đổi trạng thái đóng/mở đợt */
export const toggleSnackServicePeriod = async (
  id: string,
): Promise<{
  success: boolean;
  message: string;
  warning?: string;
  data: any;
}> => {
  const response = await apiClient.put<any>(
    `/snack-services/periods/${id}/toggle`,
  );
  const raw = response.data;
  if (raw && typeof raw === "object" && "success" in raw) {
    return raw;
  }
  return {
    success: true,
    message: "Đã cập nhật trạng thái đợt đăng ký thành công!",
    data: raw,
  };
};

/** UC61: Kiểm tra độ an toàn dị ứng của trẻ với thực đơn đợt ăn xế */
export const checkSnackAllergy = async (
  periodId: number,
  studentId: number,
): Promise<CheckAllergyResponse> => {
  const response = await apiClient.get<any>("/snack-services/check-allergy", {
    params: { periodId, studentId },
  });
  return response.data;
};

/** UC61: Lấy danh sách học sinh có thể đăng ký đợt ăn xế */
export const fetchAvailableStudents = async (
  periodId?: string,
): Promise<AvailableStudentsResponse> => {
  const response = await apiClient.get<any>(
    "/snack-services/students-available",
    {
      params: { periodId },
    },
  );
  const raw = response.data;
  if (Array.isArray(raw)) {
    return {
      success: true,
      data: raw,
    };
  }
  return raw;
};

/** UC61: Đăng ký dịch vụ ăn xế (Kiểm tra quy tắc dị ứng) */
export const registerSnackService = async (
  dto: RegisterSnackServiceDto,
): Promise<RegisterSnackServiceResponse> => {
  const response = await apiClient.post<any>("/snack-services/enrollment", dto);
  const raw = response.data;
  if (raw && typeof raw === "object" && "success" in raw) {
    return raw;
  }
  return {
    success: true,
    message: "Đăng ký dịch vụ ăn xế thành công!",
    data: raw,
  };
};

/** UC61: Xác nhận thanh toán đăng ký ăn xế */
export const confirmSnackPayment = async (
  registrationId: string,
): Promise<{ success: boolean; message: string; data: any }> => {
  const response = await apiClient.put<any>(
    `/snack-services/registrations/${registrationId}/confirm-payment`,
  );
  const raw = response.data;
  if (raw && typeof raw === "object" && "success" in raw) {
    return raw;
  }
  return {
    success: true,
    message: "Xác nhận thanh toán thành công!",
    data: raw,
  };
};
