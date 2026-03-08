# 🚀 GUIA FINAL - INICIAR E TESTAR O QR CODE FIX

## ⚡ Quick Start (3 passos)

### Passo 1: Compilar o Backend
```powershell
cd "C:\Users\Icaro Garcia\Documents\globaldisparos\backend"
npm run build
```
✅ Deve terminar sem erros

### Passo 2: Iniciar os Serviços (em terminais diferentes)

#### Terminal 1 - Evolution API Mock
```powershell
cd "C:\Users\Icaro Garcia\Documents\globaldisparos"
node evolution-api-mock.js
```
Deve mostrar:
```
╔═══════════════════════════════════════════════╗
║  🟢 Evolution API Mock Server                 ║
║  Port: 8081                                    ║
║  Status: ONLINE                               ║
║  URL: http://localhost:8081                  ║
╚═══════════════════════════════════════════════╝
```

#### Terminal 2 - Backend
```powershell
cd "C:\Users\Icaro Garcia\Documents\globaldisparos\backend"
npm run start
```
Deve mostrar:
```
[3001] debug: [Connection] PostgreSQL connected successfully ✅
[3001] info: 🚀 Servidor rodando na porta 3001
```

#### Terminal 3 (Opcional) - Frontend
```powershell
cd "C:\Users\Icaro Garcia\Documents\globaldisparos\frontend"
npm run dev
```
Deve mostrar:
```
VITE v... ready in ... ms

➜  Local:   http://localhost:5173/
```

### Passo 3: Testar o QR Code Fix
```powershell
cd "C:\Users\Icaro Garcia\Documents\globaldisparos"
node test-qr-final.js
```

Resultado esperado:
```
🔍 TESTE FINAL - QR CODE FIX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣  Testando Evolution API Mock (porta 8081)...
   ✅ QR obtido da Evolution API
   📏 Tamanho: 15246 chars
   ✅ QR é SVG base64 legítimo

2️⃣  Registrando novo usuário...
   ✅ Usuário registrado
   🔑 Token obtido (eyJhbGciOiJ...)

3️⃣  Criando nova instância...
   ✅ Instância criada
   🆔 Instance ID: 139

4️⃣  Aguardando propagação do QR Code...
   ⏳ Aguardando 5 segundos...

5️⃣  Buscando QR Code no banco de dados...
   Status da resposta: 200
   Campo 'qrCode': ✅ PRESENTE
   📏 Tamanho do QR salvo: 15246 chars
   ✅ QR é SVG base64 legítimo

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 RESUMO DOS TESTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ QR CODE FIX FUNCIONANDO PERFEITAMENTE!

✔️  Evolution API Mock retorna QR legítimo
✔️  Backend extrai QR corretamente
✔️  QR é salvo no banco de dados
✔️  QR é retornado na requisição GET
```

## 🔍 Verificação Manual (opcional)

### Teste 1: Evolution API retorna QR legítimo
```powershell
$response = Invoke-WebRequest -Uri "http://localhost:8081/instance/create?instanceName=test-verify" -UseBasicParsing
$json = $response.Content | ConvertFrom-Json
$qr = $json.instance.qrcode.code

# Verificar tamanho (deve ser > 10000)
Write-Host "Tamanho do QR: $($qr.Length) chars"

# Verificar formato (deve conter data:image/svg)
if ($qr.Contains("data:image/svg+xml;base64,")) {
    Write-Host "✅ QR é SVG base64 legítimo"
} else {
    Write-Host "❌ QR não é SVG base64"
}
```

### Teste 2: Backend consegue ser acessado
```powershell
$response = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -UseBasicParsing -ErrorAction SilentlyContinue
if ($response.StatusCode -eq 200) {
    Write-Host "✅ Backend respondendo"
} else {
    Write-Host "❌ Backend não respondendo"
}
```

### Teste 3: Registrar e criar instância manualmente
```powershell
# Registrar usuário
$regBody = @{
    name = "Test User"
    fullName = "Test User QR"
    email = "testqr@test.com"
    password = "TestPass123!"
} | ConvertTo-Json

$auth = Invoke-WebRequest -Uri "http://localhost:3001/api/auth/register" `
    -Method POST -ContentType "application/json" -Body $regBody -UseBasicParsing

$token = ($auth.Content | ConvertFrom-Json).token

# Criar instância
$instBody = @{ name = "test-verify-qr" } | ConvertTo-Json

$inst = Invoke-WebRequest -Uri "http://localhost:3001/api/instances" `
    -Method POST -ContentType "application/json" `
    -Headers @{ "Authorization" = "Bearer $token" } `
    -Body $instBody -UseBasicParsing

$instanceId = ($inst.Content | ConvertFrom-Json).id

# Aguardar QR ser processado
Start-Sleep 5

# Buscar QR
$qrResp = Invoke-WebRequest -Uri "http://localhost:3001/api/instances/$instanceId/qr" `
    -Headers @{ "Authorization" = "Bearer $token" } `
    -UseBasicParsing

$qrData = $qrResp.Content | ConvertFrom-Json

if ($qrData.qrCode) {
    Write-Host "✅ QR salvo no banco com sucesso!"
    Write-Host "Tamanho: $($qrData.qrCode.Length) chars"
} else {
    Write-Host "❌ QR não foi salvo (valor NULL)"
}
```

## 📋 Checklist de Sucesso

- [ ] Backend compilou sem erros
- [ ] Evolution API Mock está online na porta 8081
- [ ] Backend está respondendo na porta 3001
- [ ] Frontend está respondendo na porta 5173 (opcional)
- [ ] test-qr-final.js retornou "✅ QR CODE FIX FUNCIONANDO"
- [ ] Teste manual de registro e criação de instância funcionou
- [ ] QR foi salvo no banco de dados (não é NULL)
- [ ] QR é formato SVG base64 legítimo

## 🐛 Troubleshooting

### Problema: Backend não compila
```powershell
# Solução: Limpar node_modules e reinstalar
cd backend
rm -r node_modules -Force
npm install
npm run build
```

### Problema: Porta já em uso
```powershell
# Encontrar processo usando a porta
netstat -ano | Select-String ":3001"

# Matar processo (substitua PID)
taskkill /PID 12345 /F
```

### Problema: Failed to connect to database
```powershell
# Verificar se PostgreSQL está rodando
# Se estiver usando Docker:
docker ps | grep postgres

# Se não estiver, iniciar:
docker-compose up -d postgres
```

### Problema: QR Code é NULL
Verificar logs do Backend:
```
[QR-SERVICE] Encontrado em response.data.qr, length: XXXX
[QR-POLLING] ✅ QR Code salvo no banco para instanceId XXX
```

Se não aparecer esses logs:
1. Verificar se Evolution API Mock está rodando
2. Verificar se URL está correta (http://127.0.0.1:8081)
3. Aumentar o timeout de polling em instances.ts

## 📞 Suporte

Se algo não funcionar:

1. **Verificar logs do Evolution API Mock**
   ```
   [QR-SERVICE] Encontrado em response.data.instance.qrcode.code
   ```

2. **Verificar logs do Backend**
   ```
   [QR-POLLING] ✅ QR Code salvo no banco
   ```

3. **Verificar banco de dados**
   ```sql
   SELECT id, name, "qrCode" FROM "WhatsAppInstances" 
   WHERE "qrCode" IS NOT NULL 
   ORDER BY "createdAt" DESC 
   LIMIT 1;
   ```

---

**Status:** ✅ PRONTO PARA USAR
**Criado em:** 2026-03-05
