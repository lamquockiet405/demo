import { apiClient } from '../../../core/api/axios';

export interface AllergenCatalogItem {
  id: string;
  code: string;
  nameVi: string;
  nameEn: string;
  commonFoods?: string;
  description?: string;
}

export interface ChildAllergyItem {
  id: string;
  childId: string;
  allergenId?: string;
  customAllergenName?: string;
  allergen?: AllergenCatalogItem;
  allergyType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'MILD' | 'MODERATE' | 'SEVERE' | 'ANAPHYLACTIC';
  symptoms?: string;
  reactionTreatment?: string;
  diagnosedDate?: string;
  isActive: boolean;
  declaredAt?: string | null;
  note?: string;
}

export interface ChildItem {
  id: string;
  tenantId: string;
  classId?: string;
  className?: string;
  ageGroup?: string;
  class?: {
    id: string;
    name: string;
  };
  parentId?: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  parentRelationship?: string;
  studentCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  dateOfBirth: string;
  gender: 'MALE' | 'FEMALE';
  status: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  medicalNotes?: string;
  avatarUrl?: string;
  allergies?: ChildAllergyItem[];
  hasNutritionProfile?: boolean;
}

export interface ChildrenStats {
  totalChildren: number;
  allergicCount: number;
  severeCount: number;
  allergyRate: number;
}

export interface CreateChildDto {
  classId?: string | number;
  studentCode?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth: string;
  gender: 'MALE' | 'FEMALE';
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  medicalNotes?: string;
}

export interface NutritionProfileDto {
  dietaryRegime?: string;
  dietaryNotes?: string;
  eatingHabits?: string;
  nutritionGoals?: string;
  targetEnergyKcal?: number | null;
  updatedAt?: string;
}

export interface DeclareAllergyDto {
  allergenId?: string | null;
  customAllergenName?: string;
  allergyType?: string;
  severity: 'MILD' | 'MODERATE' | 'SEVERE' | 'ANAPHYLACTIC';
  symptoms?: string;
  reactionTreatment?: string;
  diagnosedDate?: string;
  note?: string;
}

export const childrenApi = {
  getChildren: async (params?: {
    search?: string;
    classId?: string;
    hasAllergy?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: ChildItem[]; total: number }> => {
    const res = await apiClient.get<{ items: ChildItem[]; total: number }>('/children', {
      params,
    });
    const raw: any = res.data;
    const items = Array.isArray(raw) ? raw : raw?.items;
    if (!Array.isArray(items)) throw new Error('Không đọc được danh sách học sinh. Vui lòng tải lại.');
    return { items, total: Number(raw?.total ?? raw?.meta?.total ?? items.length) };
  },

  getStats: async (): Promise<ChildrenStats> => {
    const res = await apiClient.get<ChildrenStats>('/children/stats');
    return res.data;
  },

  getAllergenCatalogs: async (): Promise<AllergenCatalogItem[]> => {
    const res = await apiClient.get<AllergenCatalogItem[]>('/children/allergen-catalogs');
    return res.data;
  },

  getChild: async (childId: string): Promise<ChildItem> => {
    const res = await apiClient.get<ChildItem>(`/children/${childId}`);
    return res.data;
  },

  createChild: async (dto: CreateChildDto): Promise<ChildItem> => {
    const fullName =
      dto.fullName?.trim() ||
      `${dto.lastName || ''} ${dto.firstName || ''}`.trim();

    const payload = {
      ...dto,
      fullName,
      studentCode: dto.studentCode?.trim() || undefined,
      classId: dto.classId && String(dto.classId).trim() !== '' ? Number(dto.classId) : undefined,
    };

    const res = await apiClient.post<ChildItem>('/children', payload);
    return res.data;
  },

  updateChild: async (id: string | number, dto: Partial<CreateChildDto>): Promise<ChildItem> => {
    const fullName =
      dto.fullName !== undefined
        ? dto.fullName.trim()
        : dto.lastName !== undefined || dto.firstName !== undefined
        ? `${dto.lastName || ''} ${dto.firstName || ''}`.trim()
        : undefined;

    const payload = {
      ...dto,
      fullName,
      classId: dto.classId && String(dto.classId).trim() !== '' ? Number(dto.classId) : undefined,
    };

    const res = await apiClient.patch<ChildItem>(`/children/${id}`, payload);
    return res.data;
  },

  declareAllergy: async (childId: string, dto: DeclareAllergyDto): Promise<ChildAllergyItem> => {
    const res = await apiClient.post<ChildAllergyItem>(`/children/${childId}/allergies`, dto);
    return res.data;
  },

  updateAllergy: async (allergyId: string, dto: Partial<DeclareAllergyDto> & { isActive?: boolean }): Promise<ChildAllergyItem> => {
    const res = await apiClient.put<ChildAllergyItem>(`/children/allergies/${allergyId}`, dto);
    return res.data;
  },

  deactivateAllergy: async (allergyId: string): Promise<ChildAllergyItem> => {
    const res = await apiClient.delete<ChildAllergyItem>(`/children/allergies/${allergyId}`);
    return res.data;
  },

  getAllergyHistory: async (childId: string): Promise<any[]> => {
    const res = await apiClient.get<any[]>(`/children/${childId}/allergy-history`);
    return res.data;
  },

  rescanAllergies: async (): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.post<{ success: boolean; message: string }>('/children/rescan-allergies');
    return res.data;
  },

  importChildren: async (items: any[]): Promise<{
    success: boolean;
    message: string;
    importedCount: number;
    errors: string[];
  }> => {
    const res = await apiClient.post('/children/import', { items });
    return res.data;
  },

  getNutritionProfile: async (childId: string | number): Promise<{ childId: string; profile: NutritionProfileDto | null }> => {
    const res = await apiClient.get<{ childId: string; profile: NutritionProfileDto | null }>(`/children/${childId}/nutrition-profile`);
    return res.data;
  },

  updateNutritionProfile: async (childId: string | number, dto: NutritionProfileDto): Promise<{ childId: string; profile: NutritionProfileDto }> => {
    const res = await apiClient.patch<{ childId: string; profile: NutritionProfileDto }>(`/children/${childId}/nutrition-profile`, dto);
    return res.data;
  },
};
