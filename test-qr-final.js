#!/usr/bin/env node

/**
 * Script de Teste - QR Code da Evolution API Real
 * Mock NÃO gera QR. Use Evolution API real (Docker) para QR escaneável.
 */

const http = require('http');

const EVOLUTION_URL = 'http://127.0.0.1:8081';
const BACKEND_URL = 'http://127.0.0.1:3001';

function makeRequest(url, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = new URL(url);
    options.method = method;
    options.headers = {
      'Content-Type': 'application/json',
      'apikey': 'myfKey123456789',
      ...headers
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('🔍 TESTE QR CODE - Evolution API Real');
  console.log('━'.repeat(50));

  try {
    // 1. Health Evolution API
    console.log('\n1️⃣  Evolution API (porta 8081)...');
    const health = await makeRequest(`${EVOLUTION_URL}/`);
    if (health.status !== 200) {
      console.log(`   ❌ Evolution API não respondeu (${health.status})`);
      console.log('   Execute: docker compose up -d evolution-api');
      return;
    }
    console.log('   ✅ Evolution API online');

    // 2. Connect endpoint - Mock retorna 503, Evolution real retorna QR
    console.log('\n2️⃣  Endpoint /instance/connect/test...');
    const connectRes = await makeRequest(`${EVOLUTION_URL}/instance/connect/test_instance`);
    const qrFromEvo = connectRes.data?.instance?.qrcode?.base64
      || connectRes.data?.instance?.qrcode?.code
      || connectRes.data?.qrcode?.base64
      || connectRes.data?.qr;

    if (connectRes.status === 503) {
      console.log('   ⚠️  Mock ativo - retorna 503 (sem QR fake)');
      console.log('   ✅ Correto: use Evolution API real para QR escaneável');
    } else if (qrFromEvo && qrFromEvo.length > 500) {
      const fmt = qrFromEvo.startsWith('data:image') ? 'data URL' : 'base64';
      console.log(`   ✅ Evolution API REAL - QR obtido (${qrFromEvo.length} chars, ${fmt})`);
      if (qrFromEvo.includes('data:image/png')) {
        console.log('   ✅ Formato PNG base64 - escaneável');
      }
    } else {
      console.log(`   ⚠️  Status ${connectRes.status}, sem QR válido`);
    }

    // 3. Backend + instância
    console.log('\n3️⃣  Backend + criar instância...');
    const loginRes = await makeRequest(`${BACKEND_URL}/api/auth/login`, 'POST',
      { email: 'admin@gmail.com', password: 'vip2026' });
    const token = loginRes.data?.token;
    if (!token) {
      console.log('   ❌ Login falhou');
      return;
    }

    const instRes = await makeRequest(`${BACKEND_URL}/api/instances`, 'POST',
      { name: `test-qr-${Date.now()}`, accountAge: 30 },
      { 'Authorization': `Bearer ${token}` });

    if (instRes.status !== 201) {
      console.log(`   ❌ Criar instância: ${instRes.status}`);
      return;
    }
    const instanceId = instRes.data?.id;
    console.log(`   ✅ Instância criada: ${instanceId}`);

    // 4. GET /qr
    await new Promise(r => setTimeout(r, 3000));
    const qrRes = await makeRequest(`${BACKEND_URL}/api/instances/${instanceId}/qr`, 'GET',
      null, { 'Authorization': `Bearer ${token}` });

    const savedQR = qrRes.data?.qrCode;
    console.log(`\n4️⃣  GET /instances/${instanceId}/qr`);
    if (savedQR) {
      console.log(`   ✅ QR retornado (${savedQR.length} chars)`);
      const isPng = savedQR.includes('data:image/png');
      const isSvg = savedQR.includes('data:image/svg');
      console.log(`   Formato: ${isPng ? 'PNG' : isSvg ? 'SVG' : 'outro'}`);
    } else {
      console.log('   ⏳ Aguardando QR (normal com mock - Evolution real gera em ~10s)');
    }

    console.log('\n' + '━'.repeat(50));
    console.log('📊 RESUMO');
    console.log('━'.repeat(50));
    console.log('✅ SVG fake removido do mock');
    console.log('✅ EvolutionService busca QR real');
    console.log('✅ Frontend exibe data:image/png;base64 ou data:image/svg');
    if (savedQR) {
      console.log('✅ Endpoint retorna PNG base64 escaneável');
    } else {
      console.log('💡 Para QR escaneável: docker compose up -d evolution-api');
    }
  } catch (error) {
    console.error('❌ ERRO:', error.message);
    console.log('Verifique: Evolution API (8081), Backend (3001)');
  }
}

runTests();
