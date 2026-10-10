/**
 * Unit tests for CampusPulse API routes
 * Uses mocked DynamoDB - does NOT require real AWS credentials
 */

import { createIssue, getIssue, getIssues, updateIssue } from '../src/routes/issues';
import { mockEvent, parseResponse } from './helpers';

// Mock the DynamoDB module
jest.mock('../src/db/dynamodb', () => ({
  createIssueInDB: jest.fn(),
  getIssueFromDB: jest.fn(),
  listIssuesFromDB: jest.fn(),
  updateIssueInDB: jest.fn(),
}));

import * as db from '../src/db/dynamodb';

const mockCreateIssue = db.createIssueInDB as jest.MockedFunction<typeof db.createIssueInDB>;
const mockGetIssue = db.getIssueFromDB as jest.MockedFunction<typeof db.getIssueFromDB>;
const mockListIssues = db.listIssuesFromDB as jest.MockedFunction<typeof db.listIssuesFromDB>;
const mockUpdateIssue = db.updateIssueInDB as jest.MockedFunction<typeof db.updateIssueInDB>;

const sampleIssue = {
  id: 'test-uuid-1234',
  title: 'Wi-Fi not working in Library',
  description: 'The Wi-Fi has been down in the main library reading room since Monday morning.',
  category: 'wifi' as const,
  location: 'Main Library - Reading Room',
  priority: 'high' as const,
  status: 'open' as const,
  reporterName: 'Alex Chen',
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TABLE_NAME = 'campuspulse-test';
  delete process.env.ADMIN_TOKEN;
});

// ============================================================
// POST /issues - CREATE
// ============================================================
describe('POST /issues - createIssue', () => {
  const validBody = {
    title: 'Projector not working in CS101',
    description: 'The projector in room CS101 has been broken since last week. Cannot display slides.',
    category: 'classroom_equipment',
    location: 'CS Building - Room 101',
    priority: 'high',
    reporterName: 'Student User',
  };

  test('creates issue with valid data', async () => {
    mockCreateIssue.mockResolvedValueOnce(sampleIssue);
    const event = mockEvent('POST', '/issues', validBody);
    const result = await createIssue(event);
    const { statusCode, body } = parseResponse(result as { statusCode?: number; body?: string });

    expect(statusCode).toBe(201);
    expect(body.message).toBe('Issue created successfully');
    expect(body.issue).toEqual(sampleIssue);
    expect(mockCreateIssue).toHaveBeenCalledTimes(1);
  });

  test('rejects missing title', async () => {
    const event = mockEvent('POST', '/issues', { ...validBody, title: '' });
    const result = await createIssue(event);
    const { statusCode, body } = parseResponse(result as { statusCode?: number; body?: string });

    expect(statusCode).toBe(400);
    expect(body.error).toBe('Validation failed');
    expect(body.details).toContain('title: required, minimum 3 characters');
  });

  test('rejects short title (< 3 chars)', async () => {
    const event = mockEvent('POST', '/issues', { ...validBody, title: 'AB' });
    const result = await createIssue(event);
    const { statusCode, body } = parseResponse(result as { statusCode?: number; body?: string });

    expect(statusCode).toBe(400);
    expect(body.details.some((d: string) => d.includes('title'))).toBe(true);
  });

  test('rejects missing description', async () => {
    const event = mockEvent('POST', '/issues', { ...validBody, description: 'Too short' });
    const result = await createIssue(event);
    const { statusCode, body } = parseResponse(result as { statusCode?: number; body?: string });

    expect(statusCode).toBe(400);
    expect(body.details.some((d: string) => d.includes('description'))).toBe(true);
  });

  test('rejects invalid category', async () => {
    const event = mockEvent('POST', '/issues', { ...validBody, category: 'invalid_cat' });
    const result = await createIssue(event);
    const { statusCode, body } = parseResponse(result as { statusCode?: number; body?: string });

    expect(statusCode).toBe(400);
    expect(body.details.some((d: string) => d.includes('category'))).toBe(true);
  });

  test('rejects invalid priority', async () => {
    const event = mockEvent('POST', '/issues', { ...validBody, priority: 'urgent' });
    const result = await createIssue(event);
    const { statusCode, body } = parseResponse(result as { statusCode?: number; body?: string });

    expect(statusCode).toBe(400);
    expect(body.details.some((d: string) => d.includes('priority'))).toBe(true);
  });

  test('rejects missing location', async () => {
    const event = mockEvent('POST', '/issues', { ...validBody, location: 'X' });
    const result = await createIssue(event);
    const { statusCode, body } = parseResponse(result as { statusCode?: number; body?: string });

    expect(statusCode).toBe(400);
    expect(body.details.some((d: string) => d.includes('location'))).toBe(true);
  });

  test('rejects invalid JSON body', async () => {
    const event = mockEvent('POST', '/issues');
    (event as unknown as Record<string, unknown>).body = '{ not valid json ';
    const result = await createIssue(event);
    const { statusCode } = parseResponse(result as { statusCode?: number; body?: string });

    expect(statusCode).toBe(400);
  });

  test('accepts optional reporterName as undefined', async () => {
    mockCreateIssue.mockResolvedValueOnce({ ...sampleIssue, reporterName: undefined });
    const { reporterName: _, ...bodyWithoutName } = validBody;
    const event = mockEvent('POST', '/issues', bodyWithoutName);
    const result = await createIssue(event);
    const { statusCode } = parseResponse(result as { statusCode?: number; body?: string });

    expect(statusCode).toBe(201);
  });
});

// ============================================================
// GET /issues - LIST
// ============================================================
describe('GET /issues - getIssues', () => {
  test('returns list of issues', async () => {
    mockListIssues.mockResolvedValueOnce([sampleIssue]);
    const event = mockEvent('GET', '/issues');
    const result = await getIssues(event);
    const { statusCode, body } = parseResponse(result as { statusCode?: number; body?: string });

    expect(statusCode).toBe(200);
    expect(body.issues).toHaveLength(1);
    expect(body.count).toBe(1);
  });

  test('returns empty array when no issues', async () => {
    mockListIssues.mockResolvedValueOnce([]);
    const event = mockEvent('GET', '/issues');
    const result = await getIssues(event);
    const { statusCode, body } = parseResponse(result as { statusCode?: number; body?: string });

    expect(statusCode).toBe(200);
    expect(body.issues).toHaveLength(0);
  });

  test('rejects invalid status filter', async () => {
    const event = mockEvent('GET', '/issues', undefined, {}, { status: 'invalid' });
    const result = await getIssues(event);
    const { statusCode } = parseResponse(result as { statusCode?: number; body?: string });

    expect(statusCode).toBe(400);
  });

  test('accepts valid status filter', async () => {
    mockListIssues.mockResolvedValueOnce([sampleIssue]);
    const event = mockEvent('GET', '/issues', undefined, {}, { status: 'open' });
    const result = await getIssues(event);
    const { statusCode } = parseResponse(result as { statusCode?: number; body?: string });

    expect(statusCode).toBe(200);
    expect(mockListIssues).toHaveBeenCalledWith(expect.objectContaining({ status: 'open' }));
  });
});

// ============================================================
// GET /issues/{id} - GET SINGLE
// ============================================================
describe('GET /issues/{id} - getIssue', () => {
  test('returns issue when found', async () => {
    mockGetIssue.mockResolvedValueOnce(sampleIssue);
    const event = mockEvent('GET', '/issues/test-uuid-1234');
    const result = await getIssue(event, 'test-uuid-1234');
    const { statusCode, body } = parseResponse(result as { statusCode?: number; body?: string });

    expect(statusCode).toBe(200);
    expect(body.issue.id).toBe('test-uuid-1234');
  });

  test('returns 404 when issue not found', async () => {
    mockGetIssue.mockResolvedValueOnce(null);
    const event = mockEvent('GET', '/issues/nonexistent');
    const result = await getIssue(event, 'nonexistent');
    const { statusCode, body } = parseResponse(result as { statusCode?: number; body?: string });

    expect(statusCode).toBe(404);
    expect(body.error).toBe('Issue not found');
  });
});

// ============================================================
// PATCH /issues/{id} - UPDATE STATUS
// ============================================================
describe('PATCH /issues/{id} - updateIssue', () => {
  const adminToken = 'super-secret-admin-token-1234';

  beforeEach(() => {
    process.env.ADMIN_TOKEN = adminToken;
  });

  test('updates status with valid admin token', async () => {
    const updatedIssue = { ...sampleIssue, status: 'in_progress' as const };
    mockUpdateIssue.mockResolvedValueOnce(updatedIssue);

    const event = mockEvent(
      'PATCH',
      '/issues/test-uuid-1234',
      { status: 'in_progress' },
      { 'x-admin-token': adminToken }
    );
    const result = await updateIssue(event, 'test-uuid-1234');
    const { statusCode, body } = parseResponse(result as { statusCode?: number; body?: string });

    expect(statusCode).toBe(200);
    expect(body.issue.status).toBe('in_progress');
  });

  test('rejects update without admin token', async () => {
    const event = mockEvent('PATCH', '/issues/test-uuid-1234', { status: 'resolved' });
    const result = await updateIssue(event, 'test-uuid-1234');
    const { statusCode, body } = parseResponse(result as { statusCode?: number; body?: string });

    expect(statusCode).toBe(403);
    expect(body.error).toContain('Invalid or missing administrator token');
  });

  test('rejects update with wrong admin token', async () => {
    const event = mockEvent(
      'PATCH',
      '/issues/test-uuid-1234',
      { status: 'resolved' },
      { 'x-admin-token': 'wrong-token' }
    );
    const result = await updateIssue(event, 'test-uuid-1234');
    const { statusCode } = parseResponse(result as { statusCode?: number; body?: string });

    expect(statusCode).toBe(403);
  });

  test('rejects invalid status value', async () => {
    const event = mockEvent(
      'PATCH',
      '/issues/test-uuid-1234',
      { status: 'invalid_status' },
      { 'x-admin-token': adminToken }
    );
    const result = await updateIssue(event, 'test-uuid-1234');
    const { statusCode } = parseResponse(result as { statusCode?: number; body?: string });

    expect(statusCode).toBe(400);
  });

  test('returns 404 when updating nonexistent issue', async () => {
    mockUpdateIssue.mockResolvedValueOnce(null);
    const event = mockEvent(
      'PATCH',
      '/issues/nonexistent',
      { status: 'resolved' },
      { 'x-admin-token': adminToken }
    );
    const result = await updateIssue(event, 'nonexistent');
    const { statusCode } = parseResponse(result as { statusCode?: number; body?: string });

    expect(statusCode).toBe(404);
  });

  test('returns 503 when ADMIN_TOKEN not configured', async () => {
    delete process.env.ADMIN_TOKEN;
    const event = mockEvent(
      'PATCH',
      '/issues/test-uuid-1234',
      { status: 'resolved' },
      { 'x-admin-token': 'any-token' }
    );
    const result = await updateIssue(event, 'test-uuid-1234');
    const { statusCode } = parseResponse(result as { statusCode?: number; body?: string });

    expect(statusCode).toBe(503);
  });
});
