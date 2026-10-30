import axios from 'axios';
import {
  SnackServicesResponse,
  SnackServiceListResponse,
  CreateSnackServicePeriodDto,
  CreatePeriodResponse,
  SnackServiceDetailResponse,
  UpdateSnackServiceDto,
  UpdateSnackServiceResponse,
  RosterResponse,
  RosterFilters,
} from '../types/snackServices';

const API_BASE_URL = 'http://localhost:3000/api/v1';

export const fetchSnackServices = async (
  search?: string,
  status?: string,
  grade?: string,
): Promise<SnackServicesResponse> => {
  const response = await axios.get<SnackServicesResponse>(`${API_BASE_URL}/snack-services`, {
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
  const response = await axios.get<SnackServiceListResponse>(`${API_BASE_URL}/snack-services/list`);
  return response.data;
};

/** UC56: Tạo đợt đăng ký ăn xế chiều */
export const createSnackServicePeriod = async (
  dto: CreateSnackServicePeriodDto,
): Promise<CreatePeriodResponse> => {
  const response = await axios.post<CreatePeriodResponse>(`${API_BASE_URL}/snack-services/periods`, dto);
  return response.data;
};

/** UC57: Lấy chi tiết 1 gói dịch vụ ăn xế */
export const fetchSnackServiceById = async (id: string): Promise<SnackServiceDetailResponse> => {
  const response = await axios.get<SnackServiceDetailResponse>(`${API_BASE_URL}/snack-services/${id}`);
  return response.data;
};

/** UC57: Cập nhật cấu hình gói dịch vụ ăn xế */
export const updateSnackService = async (
  id: string,
  dto: UpdateSnackServiceDto,
): Promise<UpdateSnackServiceResponse> => {
  const response = await axios.put<UpdateSnackServiceResponse>(`${API_BASE_URL}/snack-services/${id}`, dto);
  return response.data;
};

/** UC60 & UC61: Lấy danh sách phân công phục vụ ăn xế (Roster) và lọc */
export const fetchSnackServiceRoster = async (
  filters?: Partial<RosterFilters> & { periodId?: string },
): Promise<RosterResponse> => {
  const response = await axios.get<RosterResponse>(`${API_BASE_URL}/snack-services/roster`, {
    params: {
      periodId: filters?.periodId !== 'ALL' ? filters?.periodId : undefined,
      classId: filters?.classId !== 'ALL' ? filters?.classId : undefined,
      ageGroup: filters?.ageGroup !== 'ALL' ? filters?.ageGroup : undefined,
      search: filters?.search ? filters.search.trim() : undefined,
      attendanceStatus: filters?.attendanceStatus !== 'ALL' ? filters?.attendanceStatus : undefined,
      portionStatus: filters?.portionStatus !== 'ALL' ? filters?.portionStatus : undefined,
      allergyOnly: filters?.allergyOnly ? true : undefined,
    },
  });
  return response.data;
};


