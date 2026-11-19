/**
 * UC07: Tenant / School Information API Client (Configure School Information).
 */
import { apiClient } from './axios';

export interface FoodSafetyLicense {
  number: string;
  expiryDate: string;
  issueDate?: string;
  issuingAuthority?: string;
}

export interface LegalRepresentative {
  name: string;
  title: string;
}

export interface SchoolBranding {
  logoUrl: string;
  logoName: string;
  logoSize: string;
  primaryColor: 'TEAL' | 'YELLOW' | 'ORANGE';
}

export interface OperationalSettings {
  mealTimes: string[];
  standardWeeklyCycleLength: number;
  foodRetentionHours: number;
  whoZscoreAutoCalc: boolean;
}

export interface SchoolStats {
  totalClasses: number;
  totalChildren: number;
  totalStaff: number;
}

export interface TenantProfile {
  id: string;
  code: string;
  name: string;
  domain?: string;
  contactEmail: string;
  phone: string;
  address: string;
  status: string;
  subscriptionTier: string;
  maxChildren: number;
  educationDepartmentCode: string;
  schoolIdentifierSgd: string;
  isEducationDbSynced: boolean;
  syncedAt: string | null;
  foodSafetyLicense: FoodSafetyLicense;
  legalRepresentative: LegalRepresentative;
  branding: SchoolBranding;
  operationalSettings?: OperationalSettings;
  stats?: SchoolStats;
  updatedAt?: string;
}

export interface UpdateTenantProfileInput {
  name?: string;
  code?: string;
  domain?: string;
  address?: string;
  phone?: string;
  contactEmail?: string;
  email?: string;
  principalName?: string;
  logo?: string;
  maxChildren?: number;
  educationDepartmentCode?: string;
  schoolIdentifierSgd?: string;
  foodSafetyLicense?: Partial<FoodSafetyLicense>;
  legalRepresentative?: Partial<LegalRepresentative>;
  branding?: Partial<SchoolBranding>;
  operationalSettings?: Partial<OperationalSettings>;
}

export interface UploadLogoInput {
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  fileContentBase64?: string;
}

export const tenantApi = {
  /**
   * UC07: Lấy cấu hình trường mầm non & pháp lý ATTP (Configure School Information)
   */
  getProfile: async (): Promise<TenantProfile> => {
    const res = await apiClient.get<any>('/tenant/profile');
    return res.data?.data || res.data;
  },

  /**
   * UC07: Cập nhật thông tin trường mầm non & pháp lý ATTP
   */
  updateProfile: async (data: UpdateTenantProfileInput): Promise<TenantProfile> => {
    const res = await apiClient.patch<any>('/tenant/profile', data);
    return res.data?.data || res.data;
  },

  /**
   * UC07: Tải lên Logo trường học (kiểm soát định dạng & dung lượng tối đa 2MB)
   */
  uploadLogo: async (data: UploadLogoInput) => {
    const res = await apiClient.post<any>('/tenant/upload-logo', data);
    return res.data?.data || res.data;
  },

  /**
   * UC07: Đồng bộ dữ liệu với Cơ sở dữ liệu ngành của Bộ GD&ĐT
   */
  syncEducationDb: async () => {
    const res = await apiClient.post<any>('/tenant/sync-education-db');
    return res.data?.data || res.data;
  },
};
