import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { handleHealth } from './routes/health';
import { getIssues, getIssue, createIssue, updateIssue } from './routes/issues';

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const method = event.requestContext.http.method.toUpperCase();
  const path = event.requestContext.http.path;

  console.log(`[CampusPulse] ${method} ${path}`, {
    queryParams: event.queryStringParameters,
    pathParams: event.pathParameters,
  });

  try {
    // Route: GET /health
    if (method === 'GET' && path === '/prod/health') {
      return await handleHealth();
    }

    // Route: GET /issues
    if (method === 'GET' && path === '/prod/issues') {
      return await getIssues(event);
    }

    // Route: POST /issues
    if (method === 'POST' && path === '/prod/issues') {
      return await createIssue(event);
    }

    // Route: GET /issues/{id}
    const issueDetailMatch = path.match(/^\/prod\/issues\/([^/]+)$/);
    if (method === 'GET' && issueDetailMatch) {
      return await getIssue(event, issueDetailMatch[1]);
    }

    // Route: PATCH /issues/{id}
    if (method === 'PATCH' && issueDetailMatch) {
      return await updateIssue(event, issueDetailMatch[1]);
    }

    // Route: handle without /prod prefix (direct Lambda invocation or local)
    if (method === 'GET' && path === '/health') {
      return await handleHealth();
    }
    if (method === 'GET' && path === '/issues') {
      return await getIssues(event);
    }
    if (method === 'POST' && path === '/issues') {
      return await createIssue(event);
    }
    const issuePathMatch = path.match(/^\/issues\/([^/]+)$/);
    if (method === 'GET' && issuePathMatch) {
      return await getIssue(event, issuePathMatch[1]);
    }
    if (method === 'PATCH' && issuePathMatch) {
      return await updateIssue(event, issuePathMatch[1]);
    }

    return {
      statusCode: 404,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Route not found', path, method }),
    };
  } catch (error) {
    console.error('[CampusPulse] Unhandled error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

export function corsHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
  };
}
