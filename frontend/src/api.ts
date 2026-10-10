import axios, { AxiosError } from 'axios';
import type { Issue, CreateIssuePayload, IssueFilters, IssueStatus } from './types';

const DEFAULT_PROD_API = 'https://ojytn19zfi.execute-api.us-east-1.amazonaws.com/prod';
const API_BASE = import.meta.env.VITE_API_BASE_URL || DEFAULT_PROD_API;

if (!API_BASE) {
  console.warn('[CampusPulse] VITE_API_BASE_URL not set. API calls will fail.');
}

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

function handleError(err: unknown): string {
  if (err instanceof AxiosError) {
    if (err.response) {
      const data = err.response.data;
      if (data?.error) return data.error;
      if (data?.details) return `Validation: ${data.details.join('; ')}`;
      return `Server error ${err.response.status}`;
    }
    if (err.code === 'ECONNABORTED') return 'Request timed out. Please try again.';
    if (err.message === 'Network Error')
      return 'Cannot reach the API. Check your connection or API URL.';
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred';
}

export async function checkHealth(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
  try {
    const res = await api.get('/health');
    return { data: res.data, error: null };
  } catch (err) {
    return { data: null, error: handleError(err) };
  }
}

export async function fetchIssues(filters: IssueFilters = {}): Promise<ApiResponse<Issue[]>> {
  try {
    const params: Record<string, string> = {};
    if (filters.status) params.status = filters.status;
    if (filters.category) params.category = filters.category;
    if (filters.priority) params.priority = filters.priority;

    const res = await api.get('/issues', { params });
    return { data: res.data.issues, error: null };
  } catch (err) {
    return { data: null, error: handleError(err) };
  }
}

export async function fetchIssue(id: string): Promise<ApiResponse<Issue>> {
  try {
    const res = await api.get(`/issues/${id}`);
    return { data: res.data.issue, error: null };
  } catch (err) {
    return { data: null, error: handleError(err) };
  }
}

export async function createIssue(
  payload: CreateIssuePayload
): Promise<ApiResponse<Issue>> {
  try {
    const res = await api.post('/issues', payload);
    return { data: res.data.issue, error: null };
  } catch (err) {
    return { data: null, error: handleError(err) };
  }
}

export async function updateIssueStatus(
  id: string,
  status: IssueStatus,
  adminToken: string
): Promise<ApiResponse<Issue>> {
  try {
    const res = await api.patch(`/issues/${id}`, { status }, {
      headers: { 'X-Admin-Token': adminToken },
    });
    return { data: res.data.issue, error: null };
  } catch (err) {
    return { data: null, error: handleError(err) };
  }
}
