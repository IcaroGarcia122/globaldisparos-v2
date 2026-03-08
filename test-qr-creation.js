/**
 * Script de teste: criar instância e observar QR polling nos logs
 */

const http = require('http');

const API_URL = 'http://127.0.0.1:3001'; // ✅ Usar IPv4

function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'x-socket-id': 'test-socket-123'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: JSON.parse(data)
          });
        } catch {
          resolve({
            status: res.statusCode,
            body: data
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function test() {
  try {
    console.log('🔓 Fazendo login...\n');
    
    const loginRes = await makeRequest('POST', '/api/auth/login', {
      email: 'admin@gmail.com',
      password: 'admin123'
    });

    console.log('Login response:', loginRes);
    
    if (loginRes.status !== 200 && loginRes.status !== 201) {
      // Tentar com dados padrão 
      console.log('⚠️  Login falhou, criando com user padrão...');
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWRtaW5AZ21haWwuY29tIn0.test';
      const createRes = await makeRequest('POST', '/api/instances', {
        name: `Instance-Test-${Date.now()}`,
        accountAge: 30
      }, token);
      console.log('Resposta:', JSON.stringify(createRes, null, 2));
      return;
    }

    const token = loginRes.body?.token || loginRes.body?.data?.token;
    if (!token) {
      console.log('⚠️  Nenhum token retornado');
      console.log('Resposta:', JSON.stringify(loginRes, null, 2));
      return;
    }

    console.log('✅ Login bem-sucedido!');
    console.log('\n📝 Criando instância de teste...\n');
    
    const createRes = await makeRequest('POST', '/api/instances', {
      name: `Instance-Test-${Date.now()}`,
      accountAge: 30
    }, token);

    console.log('Resposta:', JSON.stringify(createRes, null, 2));
    
    if (createRes.status === 201) {
      console.log('\n✅ Instância criada com sucesso!');
      console.log('\n⏳ Observando logs do backend por 20 segundos...');
      console.log('(Procure por [QR-SERVICE] e [QR-POLLING] nos logs do backend)\n');
      
      await new Promise(r => setTimeout(r, 20000));
      
      console.log('\n✅ Teste concluído!');
      console.log('\nProximos passos:');
      console.log('1. Verifique os logs do backend para:');
      console.log('   - [QR-SERVICE] base64 length > 1000');
      console.log('   - [QR-POLLING] tentativas e estado da conexão');
      console.log('2. Abra http://localhost:5173 no navegador');
      console.log('3. Login com admin@gmail.com / admin123');
      console.log('4. Veja o QR Code sendo exibido em tempo real');
    } else {
      console.log('\n❌ Erro ao criar instância!');
    }
  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
}

test();
