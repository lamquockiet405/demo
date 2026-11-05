import { apiClient } from '../../../core/api/axios';
import {
  ParentEvaluationQueryParams,
  ParentEvaluationResponse,
  ParentEvaluationItem,
  RespondEvaluationPayload,
} from '../types';

export const parentEvaluationApi = {
  getEvaluations: async (params: ParentEvaluationQueryParams): Promise<ParentEvaluationResponse> => {
    const res = await apiClient.get('/parent-evaluations', { params });
    return res.data;
  },

  respondToEvaluation: async (
    id: string,
    payload: RespondEvaluationPayload,
  ): Promise<ParentEvaluationItem> => {
    const res = await apiClient.post(`/parent-evaluations/${id}/respond`, payload);
    return res.data;
  },

  updateResponse: async (
    id: string,
    payload: RespondEvaluationPayload,
  ): Promise<ParentEvaluationItem> => {
    const res = await apiClient.put(`/parent-evaluations/${id}/respond`, payload);
    return res.data;
  },

  toggleDraft: async (id: string, isDrafting: boolean): Promise<ParentEvaluationItem> => {
    const res = await apiClient.put(`/parent-evaluations/${id}/draft`, { isDrafting });
    return res.data;
  },

  getPortalData: async (childId?: string, date?: string, mealType?: string) => {
    const res = await apiClient.get('/parent-evaluations/portal-data', {
      params: { childId, date, mealType },
    });
    return res.data;
  },

  submitEvaluation: async (payload: any) => {
    const res = await apiClient.post('/parent-evaluations/submit', payload);
    return res.data;
  },

  updateEvaluation: async (id: string, payload: any) => {
    const res = await apiClient.put(`/parent-evaluations/${encodeURIComponent(id)}`, payload);
    return res.data;
  },

  getChildMenuConsumption: async (childId?: string, date?: string) => {
    const res = await apiClient.get('/parent-evaluations/child-menu-consumption', {
      params: { childId, date },
    });
    return res.data;
  },

  toggleHeartReaction: async (attendanceId: string) => {
    const res = await apiClient.post('/parent-evaluations/child-consumption/heart', {
      attendanceId,
    });
    return res.data;
  },
};
