const express = require('express');
const app = express();
const PORT = 8081;

app.use(express.json());

// Store instances in memory
const instances = {};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'evolution-api-mock' });
});

// Get instance status
app.get('/instances/:instanceName/status', (req, res) => {
  const { instanceName } = req.params;
  const instance = instances[instanceName];
  
  if (!instance) {
    return res.status(404).json({ error: 'Instance not found' });
  }
  
  res.json({
    instance: instanceName,
    status: instance.status || 'connecting',
    connected: instance.connected || false,
    lastUpdate: new Date().toISOString()
  });
});

// Create instance
app.post('/instances/create', (req, res) => {
  const { instanceName } = req.body;
  
  if (!instanceName) {
    return res.status(400).json({ error: 'instanceName is required' });
  }
  
  instances[instanceName] = {
    status: 'connecting',
    connected: false,
    createdAt: new Date(),
    qrCode: null
  };
  
  res.json({
    status: 'success',
    message: 'Instance created',
    instance: instanceName
  });
});

// Get QR code
app.get('/instances/:instanceName/qrcode', (req, res) => {
  const { instanceName } = req.params;
  const instance = instances[instanceName];
  
  if (!instance) {
    return res.status(404).json({ error: 'Instance not found' });
  }
  
  // Generate a mock QR code (base64 encoded simple PNG)
  const mockQR = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  
  res.json({
    qrCode: mockQR,
    instance: instanceName,
    timestamp: new Date().toISOString()
  });
});

// Connect instance (simulate QR scan)
app.post('/instances/:instanceName/connect', (req, res) => {
  const { instanceName } = req.params;
  const instance = instances[instanceName];
  
  if (!instance) {
    return res.status(404).json({ error: 'Instance not found' });
  }
  
  instance.status = 'open';
  instance.connected = true;
  instance.connectedAt = new Date();
  
  res.json({
    status: 'success',
    message: 'Instance connected',
    instance: instanceName,
    connectionStatus: 'open'
  });
});

// Disconnect instance
app.delete('/instances/:instanceName', (req, res) => {
  const { instanceName } = req.params;
  
  if (instances[instanceName]) {
    delete instances[instanceName];
  }
  
  res.json({
    status: 'success',
    message: 'Instance deleted',
    instance: instanceName
  });
});

// Send message
app.post('/instances/:instanceName/send-message', (req, res) => {
  const { instanceName } = req.params;
  const { number, message } = req.body;
  const instance = instances[instanceName];
  
  if (!instance) {
    return res.status(404).json({ error: 'Instance not found' });
  }
  
  if (instance.status !== 'open') {
    return res.status(400).json({ error: 'Instance is not connected' });
  }
  
  res.json({
    status: 'success',
    message: 'Message sent',
    instance: instanceName,
    to: number,
    timestamp: new Date().toISOString()
  });
});

// List all instances
app.get('/instances', (req, res) => {
  res.json({
    instances: Object.keys(instances),
    count: Object.keys(instances).length
  });
});

app.listen(PORT, () => {
  console.log(`✅ Evolution API Mock rodando em http://localhost:${PORT}`);
  console.log(`📍 Health check: GET http://localhost:${PORT}/health`);
  console.log(`📍 Instâncias: GET http://localhost:${PORT}/instances`);
});
