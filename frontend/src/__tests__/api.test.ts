import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS } from '../types';
import * as apiModule from '../api';

vi.mock('axios', () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  };
  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
    },
    AxiosError: class AxiosError extends Error {
      response?: { data?: unknown; status?: number };
      code?: string;
      constructor(message: string, response?: { data?: unknown; status?: number }, code?: string) {
        super(message);
        this.response = response;
        this.code = code;
      }
    },
  };
});

describe('CampusPulse Frontend - Constants & Types', () => {
  it('defines all required categories with user-friendly labels', () => {
    expect(CATEGORY_LABELS.wifi).toBe('Wi-Fi / Network');
    expect(CATEGORY_LABELS.classroom_equipment).toBe('Classroom Equipment');
    expect(CATEGORY_LABELS.maintenance).toBe('Maintenance');
    expect(CATEGORY_LABELS.electrical).toBe('Electrical');
    expect(CATEGORY_LABELS.plumbing).toBe('Plumbing');
    expect(CATEGORY_LABELS.security).toBe('Security');
    expect(CATEGORY_LABELS.lost_found).toBe('Lost & Found');
    expect(CATEGORY_LABELS.other).toBe('Other');
  });

  it('defines all required priorities', () => {
    expect(PRIORITY_LABELS.low).toBe('Low');
    expect(PRIORITY_LABELS.medium).toBe('Medium');
    expect(PRIORITY_LABELS.high).toBe('High');
    expect(PRIORITY_LABELS.critical).toBe('Critical');
  });

  it('defines all required statuses', () => {
    expect(STATUS_LABELS.open).toBe('Open');
    expect(STATUS_LABELS.in_progress).toBe('In Progress');
    expect(STATUS_LABELS.resolved).toBe('Resolved');
    expect(STATUS_LABELS.closed).toBe('Closed');
  });
});

describe('CampusPulse Frontend - API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports core API methods', () => {
    expect(typeof apiModule.checkHealth).toBe('function');
    expect(typeof apiModule.fetchIssues).toBe('function');
    expect(typeof apiModule.fetchIssue).toBe('function');
    expect(typeof apiModule.createIssue).toBe('function');
    expect(typeof apiModule.updateIssueStatus).toBe('function');
  });
});
