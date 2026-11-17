import { apiClient } from '../../core/api/axios';

export interface ParentContact {
  parentId?: string; fullName: string; phone: string; email?: string;
  relationship: string; isPrimary: boolean;
}
export interface YearClass {
  id: string; name: string; ageGroup: string; status: string;
  homeroomTeacherId?: string; teacherName?: string; studentCount: number;
}
export interface YearEnrollment {
  id: string; studentId: string; classId: string; className: string; status: string; notes: string;
  studentSnapshot: { studentCode: string; fullName: string; dateOfBirth: string; gender: string };
  parentContacts: ParentContact[];
}
export interface AcademicYear {
  id: string; name: string; startDate: string; endDate: string; status: string; notes: string;
  sourceYearId?: string; sourceYearName?: string; classCount: number; studentCount: number;
}
export interface YearDetail extends AcademicYear { classes: YearClass[]; enrollments: YearEnrollment[] }
export const academicYearsApi = {
  availableStudents: async (id: string) => (await apiClient.get<Array<{id: string; fullName: string; studentCode: string}>>(`/academic-years/${id}/available-students`)).data,
  list: async () => (await apiClient.get<AcademicYear[]>('/academic-years')).data,
  detail: async (id: string) => (await apiClient.get<YearDetail>(`/academic-years/${id}`)).data,
  create: async (payload: object) => (await apiClient.post<{ id: string }>('/academic-years', payload)).data,
  update: async (id: string, payload: object) => apiClient.patch(`/academic-years/${id}`, payload),
  delete: async (id: string) => apiClient.delete(`/academic-years/${id}`),
  activate: async (id: string) => apiClient.post(`/academic-years/${id}/activate`),
  complete: async (id: string) => apiClient.post(`/academic-years/${id}/complete`),
  saveClass: async (id: string, classId: string | null, payload: object) => classId
    ? apiClient.patch(`/academic-years/${id}/classes/${classId}`, payload)
    : apiClient.post(`/academic-years/${id}/classes`, payload),
  addEnrollment: async (id: string, payload: object) => apiClient.post(`/academic-years/${id}/enrollments`, payload),
  createStudent: async (id: string, payload: object) => apiClient.post(`/academic-years/${id}/students`, payload),
  updateEnrollment: async (id: string, enrollmentId: string, payload: object) => apiClient.patch(`/academic-years/${id}/enrollments/${enrollmentId}`, payload),
};
