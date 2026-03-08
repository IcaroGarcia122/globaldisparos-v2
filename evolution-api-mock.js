/**
 * Mock Evolution API Server
 * Simulates Evolution API for development/testing without Docker
 * Port: 8081
 */

const http = require('http');
const url = require('url');

// Store instances in memory
const instances = new Map();

/**
 * Mock Evolution API - APENAS para health check e estrutura básica.
 * QR Code: Use Evolution API REAL (Docker). Este mock NÃO gera QR escaneável.
 */

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,apikey');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  // Health check
  if (pathname === '/' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'online', version: 'mock-v1.0' }));
    return;
  }

  // Create instance (POST or GET QR Code)
  if (pathname.match(/^\/instance\/create\/?$/) && (req.method === 'GET' || req.method === 'POST')) {
    let instanceName = query.instanceName || 'default-instance';
    
    // Se for POST, parsear body
    if (req.method === 'POST') {
      let body = '';
      return req.on('data', chunk => {
        body += chunk.toString();
        if (body.length > 1e6) {
          res.writeHead(413);
          res.end('Payload muito grande');
          return;
        }
      }).on('end', () => {
        try {
          const data = JSON.parse(body);
          instanceName = data.instanceName || `instance_${Date.now()}`;
          
          // Store instance
          instances.set(instanceName, {
            name: instanceName,
            status: 'connecting',
            createdAt: new Date()
          });

          res.writeHead(201);
          res.end(JSON.stringify({
            instance: {
              instanceName: instanceName,
              instanceId: Math.random().toString(36).substr(2, 9),
              qrcode: null,
              status: 'connecting',
              statusConnection: 'connecting'
            }
          }));
        } catch (err) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'JSON inválido' }));
        }
      });
    }
    
    // GET request - create simulado
    res.writeHead(201);
    res.end(JSON.stringify({
      instance: {
        instanceName: instanceName,
        instanceId: Math.random().toString(36).substr(2, 9),
        qrcode: null,
        status: 'connecting',
        statusConnection: 'connecting'
      }
    }));

    // Store instance
    instances.set(instanceName, {
      name: instanceName,
      status: 'connecting',
      createdAt: new Date()
    });
    return;
  }

  // Get instance status
  if (pathname.match(/^\/instance\/info\/?$/) && req.method === 'GET') {
    const instanceName = query.instanceName || 'default-instance';
    const instance = instances.get(instanceName);

    if (!instance) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Instance not found' }));
      return;
    }

    res.writeHead(200);
    res.end(JSON.stringify({
      instance: {
        instanceName: instanceName,
        status: 'open', // Simulate connected status
        statusConnection: 'open',
        serverUrl: 'http://localhost:8081',
        webhookUrl: null,
        webhookByEvents: true
      }
    }));
    return;
  }

  // Get QR Code - mock NÃO gera QR real
  if (pathname.match(/^\/instance\/connect\/(.+?)\/?$/) && req.method === 'GET') {
    res.writeHead(503);
    res.end(JSON.stringify({
      error: 'QR_CODE_REQUIRES_REAL_EVOLUTION_API',
      message: 'Use Evolution API real (Docker) para QR Code escaneável.'
    }));
    return;
  }
  if (pathname.match(/^\/instance\/(.+?)\/(qrcode|connect)\/?$/) && req.method === 'GET') {
    res.writeHead(503);
    res.end(JSON.stringify({
      error: 'QR_CODE_REQUIRES_REAL_EVOLUTION_API',
      message: 'Use Evolution API real (Docker) para QR Code escaneável.'
    }));
    return;
  }

  if (pathname.match(/^\/qrcode\/(.+?)\/?$/) && req.method === 'GET') {
    res.writeHead(503);
    res.end(JSON.stringify({
      error: 'QR_CODE_REQUIRES_REAL_EVOLUTION_API',
      message: 'Use Evolution API real (Docker) para QR Code escaneável.'
    }));
    return;
  }

  // Get connection state
  if (pathname.match(/^\/instance\/connectionState\/(.+?)\/?$/) && req.method === 'GET') {
    const instanceName = pathname.split('/')[3];
    
    res.writeHead(200);
    res.end(JSON.stringify({
      instance: {
        instanceName: instanceName,
        state: 'connecting', // Pode ser: connecting, open, close, offline
        statusConnection: 'connecting'
      },
      state: 'connecting'
    }));
    return;
  }

  // Send message
  if (pathname.match(/^\/message\/sendText\/?$/) && req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        
        res.writeHead(200);
        res.end(JSON.stringify({
          key: {
            remoteJid: data.number + '@s.whatsapp.net',
            fromMe: true,
            id: Math.random().toString(36).substr(2, 9)
          },
          status: 'PENDING',
          message: {
            conversation: data.text
          }
        }));
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // Get instances list
  if (pathname.match(/^\/instance\/fetchInstances\/?$/) && req.method === 'GET') {
    const list = Array.from(instances.values()).map(inst => ({
      instanceName: inst.name,
      status: 'open',
      statusConnection: 'open'
    }));

    res.writeHead(200);
    res.end(JSON.stringify({ instances: list }));
    return;
  }

  // Delete instance
  if (pathname.match(/^\/instance\/delete\/?$/) && req.method === 'DELETE') {
    const instanceName = query.instanceName || 'default-instance';
    instances.delete(instanceName);

    res.writeHead(200);
    res.end(JSON.stringify({
      message: `Instance ${instanceName} deleted successfully`
    }));
    return;
  }

  // Default 404
  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

const PORT = 8081;

server.listen(PORT, () => {
  console.log(`\n╔═══════════════════════════════════════════════╗`);
  console.log(`║  🟢 Evolution API Mock Server                 ║`);
  console.log(`║  Port: ${PORT}                                    ║`);
  console.log(`║  Status: ONLINE                               ║`);
  console.log(`║  URL: http://localhost:${PORT}                  ║`);
  console.log(`╚═══════════════════════════════════════════════╝\n`);
});

process.on('SIGTERM', () => {
  console.log('\nEvolution API Mock Server stopped');
  server.close();
});

process.on('SIGINT', () => {
  console.log('\nEvolution API Mock Server stopped');
  server.close();
});
