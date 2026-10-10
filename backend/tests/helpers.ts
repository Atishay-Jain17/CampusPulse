import { APIGatewayProxyEventV2 } from 'aws-lambda';

/**
 * Creates a minimal mock API Gateway V2 event for testing
 */
export function mockEvent(
  method: string,
  path: string,
  body?: object,
  headers?: Record<string, string>,
  queryParams?: Record<string, string>,
  pathParameters?: Record<string, string>
): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: `${method} ${path}`,
    rawPath: path,
    rawQueryString: queryParams
      ? new URLSearchParams(queryParams).toString()
      : '',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    requestContext: {
      http: {
        method,
        path,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'jest-test',
      },
      accountId: '123456789012',
      apiId: 'test-api',
      domainName: 'test.execute-api.us-east-1.amazonaws.com',
      domainPrefix: 'test',
      requestId: 'test-request-id',
      routeKey: `${method} ${path}`,
      stage: 'test',
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
    },
    body: body ? JSON.stringify(body) : undefined,
    pathParameters: pathParameters,
    isBase64Encoded: false,
    queryStringParameters: queryParams,
    stageVariables: undefined,
    cookies: [],
  } as unknown as APIGatewayProxyEventV2;
}

export function parseResponse(response: { body?: string; statusCode?: number }) {
  return {
    statusCode: response.statusCode,
    body: response.body ? JSON.parse(response.body) : null,
  };
}
