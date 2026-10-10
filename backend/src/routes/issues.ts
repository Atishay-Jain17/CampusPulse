import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { corsHeaders } from '../handler';
import {
  createIssueInDB,
  getIssueFromDB,
  listIssuesFromDB,
  updateIssueInDB,
} from '../db/dynamodb';
import {
  VALID_CATEGORIES,
  VALID_PRIORITIES,
  VALID_STATUSES,
  CreateIssueInput,
  IssueStatus,
  IssueCategory,
  IssuePriority,
} from '../types/issue';

const MAX_BODY_SIZE = 10 * 1024; // 10KB

function jsonResponse(
  statusCode: number,
  body: unknown
): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: corsHeaders(),
    body: JSON.stringify(body),
  };
}

function parseBody(event: APIGatewayProxyEventV2): unknown {
  const raw = event.body || '';
  if (raw.length > MAX_BODY_SIZE) {
    throw new Error('REQUEST_TOO_LARGE');
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('INVALID_JSON');
  }
}

// GET /issues
export async function getIssues(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const q = event.queryStringParameters || {};

  const statusFilter = q.status as IssueStatus | undefined;
  const categoryFilter = q.category as IssueCategory | undefined;
  const priorityFilter = q.priority as IssuePriority | undefined;

  // Validate filters
  if (statusFilter && !VALID_STATUSES.includes(statusFilter)) {
    return jsonResponse(400, {
      error: 'Invalid status filter',
      valid: VALID_STATUSES,
    });
  }
  if (categoryFilter && !VALID_CATEGORIES.includes(categoryFilter)) {
    return jsonResponse(400, {
      error: 'Invalid category filter',
      valid: VALID_CATEGORIES,
    });
  }
  if (priorityFilter && !VALID_PRIORITIES.includes(priorityFilter)) {
    return jsonResponse(400, {
      error: 'Invalid priority filter',
      valid: VALID_PRIORITIES,
    });
  }

  const issues = await listIssuesFromDB({
    status: statusFilter,
    category: categoryFilter,
    priority: priorityFilter,
  });

  return jsonResponse(200, {
    issues,
    count: issues.length,
    filters: { status: statusFilter, category: categoryFilter, priority: priorityFilter },
  });
}

// GET /issues/{id}
export async function getIssue(
  _event: APIGatewayProxyEventV2,
  id: string
): Promise<APIGatewayProxyResultV2> {
  if (!id || id.length > 100) {
    return jsonResponse(400, { error: 'Invalid issue ID' });
  }

  const issue = await getIssueFromDB(id);
  if (!issue) {
    return jsonResponse(404, { error: 'Issue not found', id });
  }

  return jsonResponse(200, { issue });
}

// POST /issues
export async function createIssue(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  let body: unknown;
  try {
    body = parseBody(event);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Parse error';
    if (msg === 'REQUEST_TOO_LARGE') {
      return jsonResponse(413, { error: 'Request body too large' });
    }
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  if (!body || typeof body !== 'object') {
    return jsonResponse(400, { error: 'Request body must be a JSON object' });
  }

  const input = body as Record<string, unknown>;
  const errors: string[] = [];

  // Validate title
  if (!input.title || typeof input.title !== 'string' || input.title.trim().length < 3) {
    errors.push('title: required, minimum 3 characters');
  } else if (input.title.trim().length > 200) {
    errors.push('title: maximum 200 characters');
  }

  // Validate description
  if (
    !input.description ||
    typeof input.description !== 'string' ||
    input.description.trim().length < 10
  ) {
    errors.push('description: required, minimum 10 characters');
  } else if (input.description.trim().length > 2000) {
    errors.push('description: maximum 2000 characters');
  }

  // Validate category
  if (!input.category || !VALID_CATEGORIES.includes(input.category as IssueCategory)) {
    errors.push(`category: required, must be one of: ${VALID_CATEGORIES.join(', ')}`);
  }

  // Validate location
  if (
    !input.location ||
    typeof input.location !== 'string' ||
    input.location.trim().length < 2
  ) {
    errors.push('location: required, minimum 2 characters');
  } else if (input.location.trim().length > 100) {
    errors.push('location: maximum 100 characters');
  }

  // Validate priority
  if (!input.priority || !VALID_PRIORITIES.includes(input.priority as IssuePriority)) {
    errors.push(`priority: required, must be one of: ${VALID_PRIORITIES.join(', ')}`);
  }

  // Validate optional reporterName
  if (
    input.reporterName !== undefined &&
    input.reporterName !== null &&
    input.reporterName !== ''
  ) {
    if (typeof input.reporterName !== 'string' || input.reporterName.trim().length > 100) {
      errors.push('reporterName: maximum 100 characters');
    }
  }

  if (errors.length > 0) {
    return jsonResponse(400, {
      error: 'Validation failed',
      details: errors,
    });
  }

  const createInput: CreateIssueInput = {
    title: input.title as string,
    description: input.description as string,
    category: input.category as IssueCategory,
    location: input.location as string,
    priority: input.priority as IssuePriority,
    reporterName: input.reporterName as string | undefined,
  };

  const isDemoData = input.isDemoData === true;
  const issue = await createIssueInDB(createInput, isDemoData);

  return jsonResponse(201, {
    message: 'Issue created successfully',
    issue,
  });
}

// PATCH /issues/{id}
export async function updateIssue(
  event: APIGatewayProxyEventV2,
  id: string
): Promise<APIGatewayProxyResultV2> {
  // Validate admin token
  const adminToken = process.env.ADMIN_TOKEN;
  const providedToken = event.headers?.['x-admin-token'] || event.headers?.['X-Admin-Token'];

  if (!adminToken) {
    console.error('[Auth] ADMIN_TOKEN environment variable not configured');
    return jsonResponse(503, {
      error: 'Administrator authentication is not configured on this deployment',
    });
  }

  if (!providedToken || providedToken !== adminToken) {
    console.warn('[Auth] Invalid or missing admin token attempted for issue update');
    return jsonResponse(403, { error: 'Invalid or missing administrator token' });
  }

  if (!id || id.length > 100) {
    return jsonResponse(400, { error: 'Invalid issue ID' });
  }

  let body: unknown;
  try {
    body = parseBody(event);
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  if (!body || typeof body !== 'object') {
    return jsonResponse(400, { error: 'Request body must be a JSON object' });
  }

  const input = body as Record<string, unknown>;

  if (!input.status || !VALID_STATUSES.includes(input.status as IssueStatus)) {
    return jsonResponse(400, {
      error: 'Invalid or missing status',
      valid: VALID_STATUSES,
    });
  }

  const updated = await updateIssueInDB(id, { status: input.status as IssueStatus });

  if (!updated) {
    return jsonResponse(404, { error: 'Issue not found', id });
  }

  return jsonResponse(200, {
    message: 'Issue updated successfully',
    issue: updated,
  });
}
