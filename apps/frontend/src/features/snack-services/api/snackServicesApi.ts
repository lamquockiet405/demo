import { apiClient } from '../../../core/api/axios';
import {
  SnackServicesResponse,
  SnackServiceListResponse,
  CreateSnackServicePeriodDto,
  CreatePeriodResponse,
  SnackServiceDetailResponse,
  UpdateSnackServiceDto,
  UpdateSnackServiceResponse,
} from '../types/snackServices';

export const fetchSnackServices = async (
  search?: string,
  status?: string,
  grade?: string,
): Promise<SnackServicesResponse> => {
  const response = await apiClient.get<SnackServicesResponse>('/snack-services', {
    params: {
      search,
      status: status !== 'ALL' ? status : undefined,
      grade: grade !== 'ALL' ? grade : undefined,
    },
  });
  return response.data;
};

/** UC56: Lấy danh sách gói ăn xế đang hoạt động (cho dropdown) */
export const fetchSnackServicesList = async (): Promise<SnackServiceListResponse> => {
  const response = await apiClient.get<SnackServiceListResponse>('/snack-services/list');
  return response.data;
};

/** UC56: Tạo đợt đăng ký ăn xế chiều */
export const createSnackServicePeriod = async (
  dto: CreateSnackServicePeriodDto,
): Promise<CreatePeriodResponse> => {
  const response = await apiClient.post<CreatePeriodResponse>('/snack-services/periods', dto);
  return response.data;
};

/** UC57: Lấy chi tiết 1 gói dịch vụ ăn xế */
export const fetchSnackServiceById = async (id: string): Promise<SnackServiceDetailResponse> => {
  const response = await apiClient.get<SnackServiceDetailResponse>(`/snack-services/${id}`);
  return response.data;
};

/** UC57: Cập nhật cấu hình gói dịch vụ ăn xế */
export const updateSnackService = async (
  id: string,
  dto: UpdateSnackServiceDto,
): Promise<UpdateSnackServiceResponse> => {
  const response = await apiClient.put<UpdateSnackServiceResponse>(`/snack-services/${id}`, dto);
  return response.data;
};


/** UC60: Đóng đợt dịch vụ ăn xế */
export const closeSnackServicePeriod = async (id: string): Promise<{ success: boolean; message: string; warning?: string; data: any }> => {
  const response = await apiClient.put(`/snack-services/periods/${id}/close`);
  return response.data;
};

/** UC60: Mở lại đợt dịch vụ ăn xế */
export const openSnackServicePeriod = async (id: string): Promise<{ success: boolean; message: string; data: any }> => {
  const response = await apiClient.put(`/snack-services/periods/${id}/open`);
  return response.data;
};

/** UC60: Chuyển đổi trạng thái đóng/mở đợt */
export const toggleSnackServicePeriod = async (id: string): Promise<{ success: boolean; message: string; warning?: string; data: any }> => {
  const response = await apiClient.put(`/snack-services/periods/${id}/toggle`);
  return response.data;
};


/** UC61: Kiểm tra độ an toàn dị ứng của trẻ với thực đơn đợt ăn xế */
export const checkSnackAllergy = async (
  periodId: number,
  studentId: number,
): Promise<import('../types/snackServices').CheckAllergyResponse> => {
  const response = await apiClient.get<import('../types/snackServices').CheckAllergyResponse>(
    '/snack-services/check-allergy',
    {
      params: { periodId, studentId },
    },
  );
  return response.data;
};

/** UC61: Lấy danh sách học sinh có thể đăng ký đợt ăn xế */
export const fetchAvailableStudents = async (
  periodId?: string,
): Promise<import('../types/snackServices').AvailableStudentsResponse> => {
  const response = await apiClient.get<import('../types/snackServices').AvailableStudentsResponse>(
    '/snack-services/students-available',
    {
      params: { periodId },
    },
  );
  return response.data;
};

/** UC61: Đăng ký dịch vụ ăn xế (Kiểm tra quy tắc dị ứng) */
export const registerSnackService = async (
  dto: import('../types/snackServices').RegisterSnackServiceDto,
): Promise<import('../types/snackServices').RegisterSnackServiceResponse> => {
  const response = await apiClient.post<import('../types/snackServices').RegisterSnackServiceResponse>(
    '/snack-services/enrollment',
    dto,
  );
  return response.data;
};

/** UC61: Xác nhận thanh toán đăng ký ăn xế */
export const confirmSnackPayment = async (
  registrationId: string,
): Promise<{ success: boolean; message: string; data: any }> => {
  const response = await apiClient.put<{ success: boolean; message: string; data: any }>(
    `/snack-services/registrations/${registrationId}/confirm-payment`,
  );
  return response.data;
};
