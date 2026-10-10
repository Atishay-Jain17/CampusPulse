/**
 * CampusPulse Local Development Server
 * 
 * Provides an HTTP server running the exact AWS Lambda handler
 * for offline local development and rapid evaluation without cloud deployment.
 * 
 * Runs on: http://localhost:3001
 */

import http from 'http';
import { handler } from './handler';
import { APIGatewayProxyEventV2 } from 'aws-lambda';

process.env.USE_LOCAL_STORAGE = process.env.USE_LOCAL_STORAGE || 'true';
process.env.ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'campuspulse-admin-token-2026';

const PORT = parseInt(process.env.PORT || '3001', 10);

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return;
  }

  // Collect request body
  const chunks: Buffer[] = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', async () => {
    const rawBody = Buffer.concat(chunks).toString('utf-8');
    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    const queryParams: Record<string, string> = {};
    parsedUrl.searchParams.forEach((val, key) => {
      queryParams[key] = val;
    });

    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === 'string') headers[k.toLowerCase()] = v;
      else if (Array.isArray(v)) headers[k.toLowerCase()] = v.join(', ');
    }

    const event: APIGatewayProxyEventV2 = {
      version: '2.0',
      routeKey: `${req.method} ${parsedUrl.pathname}`,
      rawPath: parsedUrl.pathname,
      rawQueryString: parsedUrl.search.replace(/^\?/, ''),
      headers,
      queryStringParameters: Object.keys(queryParams).length > 0 ? queryParams : undefined,
      requestContext: {
        accountId: 'local-dev',
        apiId: 'local-api',
        domainName: 'localhost',
        domainPrefix: 'localhost',
        http: {
          method: req.method || 'GET',
          path: parsedUrl.pathname,
          protocol: 'HTTP/1.1',
          sourceIp: req.socket.remoteAddress || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'local-dev-client',
        },
        requestId: `local-${Date.now()}`,
        routeKey: `${req.method} ${parsedUrl.pathname}`,
        stage: 'prod',
        time: new Date().toISOString(),
        timeEpoch: Date.now(),
      },
      body: rawBody || undefined,
      isBase64Encoded: false,
    };

    try {
      const response = await handler(event);
      if (typeof response === 'string') {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(response);
      } else {
        const resHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
          ...(response.headers as Record<string, string> || {}),
        };

        res.writeHead(response.statusCode || 200, resHeaders);
        res.end(response.body || '');
      }
    } catch (err) {
      console.error('[LocalServer] Handler error:', err);
      res.writeHead(500, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  🚀 CampusPulse Local API Server`);
  console.log(`  URL: http://localhost:${PORT}`);
  console.log(`  Storage: In-Memory (USE_LOCAL_STORAGE=true)`);
  console.log(`  Admin Token: ${process.env.ADMIN_TOKEN}`);
  console.log(`======================================================\n`);
  console.log(`  Endpoints:`);
  console.log(`  GET   http://localhost:${PORT}/health`);
  console.log(`  GET   http://localhost:${PORT}/issues`);
  console.log(`  POST  http://localhost:${PORT}/issues`);
  console.log(`  GET   http://localhost:${PORT}/issues/{id}`);
  console.log(`  PATCH http://localhost:${PORT}/issues/{id}\n`);
});
