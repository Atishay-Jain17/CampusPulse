import { APIGatewayProxyResultV2 } from 'aws-lambda';
import { corsHeaders } from '../handler';

export async function handleHealth(): Promise<APIGatewayProxyResultV2> {
  return {
    statusCode: 200,
    headers: corsHeaders(),
    body: JSON.stringify({
      status: 'healthy',
      service: 'CampusPulse API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'production',
    }),
  };
}
